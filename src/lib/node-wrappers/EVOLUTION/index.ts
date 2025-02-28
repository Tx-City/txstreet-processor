import WebSocket from 'ws';
import { Tendermint34Client, TxParams } from '@cosmjs/tendermint-rpc';
import BlockchainWrapper from "../base";
import crypto from 'crypto';
import fetch from 'node-fetch';
import { get } from 'http';

export default class EVOLUTIONWrapper extends BlockchainWrapper {
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private tmClient: Tendermint34Client | null = null;
    private rpcUrl: string;
    private wsUrl: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = Infinity; // Set to Infinity to keep trying forever
    private reconnectInterval: number = 2000; // Start with 2 seconds
    private maxReconnectInterval: number = 30000; // Max 30 seconds
    private reconnectTimeoutId: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private pingIntervalTime: number = 30000; // 30 seconds ping interval

    constructor(host: string) {
        super('EVOLUTION');
        
        // Store the RPC URL for Tendermint client
        this.rpcUrl = `http://65.109.115.131:26657`;
        this.wsUrl = `ws://65.109.115.131:26657/websocket`;
        
        // Initialize WebSocket connection
        this.connectWebSocket();
        
        // Initialize Tendermint client
        this.initTendermint().catch(err => {
            console.error('Failed to initialize Tendermint client:', err);
        });
    }

    /**
     * Connect to WebSocket with auto-reconnect capability
     */
    private connectWebSocket(): void {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            console.log('WebSocket already connected or connecting');
            return;
        }

        console.log(`Connecting to WebSocket: ${this.wsUrl}`);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
            
            this.ws.on('open', () => {
                console.log('WebSocket Connected');
                this.isConnected = true;
                this.reconnectAttempts = 0; // Reset counter on successful connection
                
                // Set up ping interval to keep connection alive
                this.setupPingInterval();
                
                try {
                    this.initEventSystem();
                    console.log('Event system initialized');
                } catch (error) {
                    console.error('Failed to initialize event system:', error);
                }
                
                this.emit('connected');
            });
            
            this.ws.on('error', (event) => {
                console.error('WebSocket Error:', event);
            });
            
            this.ws.on('close', (code, reason) => {
                console.log(`WebSocket Connection Closed: Code ${code}, Reason: ${reason}`);
                this.isConnected = false;
                
                // Clear ping interval
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                    this.pingInterval = null;
                }
                
                // Schedule reconnect
                this.scheduleReconnect();
            });
            
            this.ws.on('message', async (data: WebSocket.Data) => {
                this.handleWebSocketMessage(data);
            });
            
        } catch (error) {
            console.error('Error creating WebSocket:', error);
            this.scheduleReconnect();
        }
    }
    
    /**
     * Set up ping interval to keep connection alive
     */
    private setupPingInterval(): void {
        // Clear any existing interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        
        // Setup new ping interval
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Send a ping message to keep the connection alive
                const pingMessage = {
                    jsonrpc: "2.0",
                    method: "health",
                    id: "ping-" + Date.now()
                };
                
                try {
                    this.ws.send(JSON.stringify(pingMessage));
                    console.log('Ping sent to keep connection alive');
                } catch (error) {
                    console.error('Error sending ping:', error);
                    // If there's an error sending the ping, the connection might be dead
                    this.reconnect();
                }
            } else if (this.ws) {
                // Connection is not open but exists
                console.warn('WebSocket exists but is not open. Current state:', this.ws.readyState);
                this.reconnect();
            } else {
                // No connection exists
                console.warn('No WebSocket connection exists');
                this.reconnect();
            }
        }, this.pingIntervalTime);
    }
    
    /**
     * Schedule a reconnect with exponential backoff
     */
    private scheduleReconnect(): void {
        // Clear any existing reconnect timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
        }
        
        // If we've reached max attempts, stop trying
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`Maximum reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
            return;
        }
        
        // Calculate backoff time with exponential increase and jitter
        const backoff = Math.min(
            this.maxReconnectInterval,
            this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts)
        );
        const jitter = Math.random() * 0.5 + 0.75; // Random factor between 0.75 and 1.25
        const delay = Math.floor(backoff * jitter);
        
        console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${Math.round(delay / 1000)} seconds`);
        
        // Schedule reconnect
        this.reconnectTimeoutId = setTimeout(() => {
            this.reconnect();
        }, delay);
    }
    
    /**
     * Perform the actual reconnect
     */
    private reconnect(): void {
        this.reconnectAttempts++;
        console.log(`Reconnect attempt ${this.reconnectAttempts}`);
        
        // Close existing connection if any
        if (this.ws) {
            try {
                this.ws.terminate();
            } catch (error) {
                console.error('Error terminating WebSocket:', error);
            }
            this.ws = null;
        }
        
        // Create new connection
        this.connectWebSocket();
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    private async handleWebSocketMessage(data: WebSocket.Data): Promise<void> {
        try {
            const parsedData = JSON.parse(data.toString());
            
            // Handle transaction events
            if (parsedData.result?.data?.type === 'tendermint/event/Tx') {
                const txevent = parsedData.result.data.value;
                
                console.log('Transaction event structure:', JSON.stringify(txevent, null, 2));
                
                // Extract the tx field - make sure this matches your actual data structure
                if (!txevent.tx) {
                    console.error('Transaction event missing tx field');
                    return;
                }
                
                const txHash = await this.calculateDashTransactionHash(txevent.tx);
                const transaction = this.getTransaction(txHash, 1);
                
                console.log("Hash:", txHash);
                this.emit('mempool-tx', transaction);
                console.log("Mempool TX", transaction);
            }
            
            // Handle block events
            if (parsedData.result?.data?.type === 'tendermint/event/NewBlock') {
                const block = parsedData.result.data.value;
                const blockHash = block.block_id.hash;
                console.log("Hash:", blockHash);
                this.emit('confirmed-block', blockHash);
                console.log("BLOCK TEST", block);
            }
            
            // Handle ping responses
            if (parsedData.id && typeof parsedData.id === 'string' && parsedData.id.startsWith('ping-')) {
                console.log('Received ping response');
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    }

    /**
     * Initialize event system for WebSocket subscriptions
     */
    public initEventSystem() {
        if (!this.ws || !this.isConnected) {
            // throw new Error('WebSocket not connected');
            console.log('WebSocket not connected, will initialize when connected');
            this.once('connected', () => {
                this.initEventSystem(); // Will call itself when connected
            });
            return; 
        }

        // Subscribe to transaction events
        const txSubscription = {
            jsonrpc: "2.0",
            method: "subscribe",
            params: ["tm.event='Tx'"],
            id: 1
        };
        this.ws.send(JSON.stringify(txSubscription));

        // Subscribe to new block events
        const blockSubscription = {
            jsonrpc: "2.0",
            method: "subscribe",
            params: ["tm.event='NewBlock'"],
            id: 2
        };
        this.ws.send(JSON.stringify(blockSubscription));
    }
    
    /**
     * Initialize Tendermint client
     */
    private async initTendermint(): Promise<void> {
        try {
            this.tmClient = await Tendermint34Client.connect(this.rpcUrl);
            console.log('Tendermint client initialized');
        } catch (error) {
            console.error('Error initializing Tendermint client:', error);
            
            // Retry connecting to Tendermint client
            setTimeout(() => {
                console.log('Retrying Tendermint client connection...');
                this.initTendermint();
            }, 5000);
        }
    }

    // Rest of the methods remain the same...
    // [Including calculateDashTransactionHash, getTransaction, getBlock, etc.]

    private async calculateDashTransactionHash(base64Data: string): Promise<string> {
        // Decode the Base64 data to binary
        const binaryData: Buffer = Buffer.from(base64Data, "base64");
      
        // Calculate SHA-256 hash
        const hash: Buffer = crypto.createHash("sha256").update(binaryData).digest();
      
        // Convert to uppercase hex string
        return hash.toString("hex").toUpperCase();
    }

    /**
     * Format block data into a structured JSON representation
     */
    public formatBlockLog(block: any, verbosity: number = 1): { 
        formatted: string, 
        compact: string 
    } {
        const blockLog = {
            height: block.height,
            hash: block.hash,
            chainId: block.chain_id || 'unknown',
            timestamp: new Date(block.timestamp).toISOString(),
            age: `${Math.floor((Date.now() - block.timestamp) / 1000)} seconds`,
            transactions: {
                count: block.transactions || 0,
                status: (block.transactions === 0) ? 'empty' : 'active'
            },
            validator: block.validator || 'unknown',
            metadata: {
                blockVersion: block.blockversion || 0,
                appVersion: block.appversion || 0,
                l1LockedHeight: block.l1lockedheight || 0,
                consensusHash: block.consensusHash || '',
                appHash: block.appHash || ''
            }
        };

        if (verbosity > 1) {
            (blockLog as any).additionalDetails = {
                lastBlockId: block.last_block_id,
                coreChainLock: block.core_chain_lock
            };
        }

        return {
            formatted: JSON.stringify(blockLog, null, 2),
            compact: JSON.stringify(blockLog)
        };
    }

    /**
     * Get current blockchain height
     */
    public async getCurrentHeight(): Promise<null | number> {
        try {
            // Ensure Tendermint client is initialized
            if (!this.tmClient) {
                await this.initTendermint();
            }
            
            // Get status from Tendermint client
            const status = await this.tmClient!.status();
            console.log(`getCurrentHeight`, parseInt(status.syncInfo.latestBlockHeight.toString()));
            // Extract the block height
            return parseInt(status.syncInfo.latestBlockHeight.toString());
        } catch (error) {
            // Fallback to HTTP request if Tendermint client fails
            try {
                const response = await fetch(`${this.rpcUrl}/status`, {
                    headers: {
                        "accept": "application/json"
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch status: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (data.sync_info && data.sync_info.latest_block_height) {
                    return parseInt(data.sync_info.latest_block_height);
                }
                
                throw new Error('Invalid status data structure');
            } catch (fallbackError) {
                console.error(`Error fetching current height:`, fallbackError);
                return null;
            }
        }
    }

    /**
     * Get transaction receipts for a block
     */
    public async getTransactionReceipts(block: any): Promise<any[]> {
        try {
            if (block && block.transactions && Array.isArray(block.transactions)) {
                const receipts = await Promise.all(
                    block.transactions.map(async (txHash: string) => {
                        return await this.getTransactionReceipt(txHash);
                    })
                );
                
                return receipts.filter(receipt => receipt !== null);
            }
            
            return [];
        } catch (error) {
            console.error(`Error getting transaction receipts for block:`, error);
            return [];
        }
    }

    /**
     * Get transaction receipt by hash
     */
    public async getTransactionReceipt(hash: string): Promise<any> {
        try {
            // Ensure Tendermint client is initialized
            if (!this.tmClient) {
                await this.initTendermint();
            }
            
            // Correct TxParams structure
            const txParams: TxParams = {
                hash: new Uint8Array(Buffer.from(hash, 'hex'))
            };
            
            // Get transaction data
            const txResponse = await this.tmClient!.tx(txParams);
            
            // Map to a receipt-like structure
            return {
                hash: Buffer.from(txResponse.hash).toString('hex').toUpperCase(),
                height: txResponse.height,
                index: txResponse.index,
                success: txResponse.result.code === 0,
                gasUsed: txResponse.result.gasUsed ? Number(txResponse.result.gasUsed) : 0,
                logs: txResponse.result.log || ""
            };
        } catch (error) {
            console.error(`Error fetching transaction receipt ${hash}:`, error);
            return null;
        }
    }

    /**
     * Get transaction details
     */
    public async getTransaction(id: string, verbosity: number = 1, blockId?: string | number): Promise<any> {
        try {
            // Ensure Tendermint client is initialized
            if (!this.tmClient) {
                await this.initTendermint();
            }
            
            // Correct TxParams structure
            const txParams: TxParams = {
                hash: new Uint8Array(Buffer.from(id, 'hex'))
            };
            
            // Get transaction data
            const txResponse = await this.tmClient!.tx(txParams);
            
            const txInfo = {
                tx: Buffer.from(txResponse.tx).toString('base64'),
                owner: '', // Would need chain-specific logic
                insertedAt: Date.now(),
                timestamp: Date.now(),
                fee: 0,
                value: 0,
                gasUsed: txResponse.result.gasUsed ? Number(txResponse.result.gasUsed) : 0,
            };
            
            if (verbosity > 1) {
                return {
                    ...txInfo,
                    height: txResponse.height,
                    index: txResponse.index,
                    success: txResponse?.result.code === 0,
                    logs: txResponse?.result.log || '',
                };
            }
            
            return txInfo;
        } catch (error) {
            console.error(`Error fetching transaction ${id}:`, error);
            return null;
        }
    }

    /**
     * Get block details
     */
    private async curlGet(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            // Import the child_process module with proper types
            const { exec } = require('child_process') as typeof import('child_process');
            
            // Use fetch API instead of curl when possible
            try {
                return fetch(url, {
                    headers: {
                        "accept": "application/json"
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => resolve(data))
                .catch(error => {
                    console.log(`Fetch failed, falling back to curl: ${error.message}`);
                    // Continue to curl fallback
                });
            } catch (fetchError) {
                console.log(`Fetch attempt failed: ${fetchError.message}`);
                // Continue to curl fallback
            }
            
            // Fix the URL to handle quotes properly
            // Remove existing quotes around the hash value if present
            const fixedUrl = url.replace(/hash="([^"]+)"/, 'hash=$1');
            
            // Create a curl command with proper escaping
            const curlCommand = `curl -s -X GET "${fixedUrl}" -H "accept: application/json"`;
            
            console.log(`Executing: ${curlCommand}`);
            
            // Execute the curl command with proper type annotations
            exec(curlCommand, (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                    console.error(`Curl error: ${error.message}`);
                    reject(error);
                    return;
                }
                
                if (stderr) {
                    console.error(`Curl stderr: ${stderr}`);
                }
                
                // Parse the JSON response
                try {
                    const data = JSON.parse(stdout);
                    resolve(data);
                } catch (parseError) {
                    console.error(`Error parsing curl output: ${parseError.message}`);
                    console.error(`Raw output: ${stdout.substring(0, 200)}...`);
                    reject(parseError);
                }
            });
        });
    }

    public async getBlock(id: string | number, verbosity: number = 1): Promise<any> {
        try {
            // Ensure Tendermint client is initialized
            if (!this.tmClient) {
                await this.initTendermint();
            }
            
            // Detect if this is a hash (64 character hex string) or height
            const isHash = typeof id === 'string' && /^[0-9A-Fa-f]{64}$/.test(id);
            const isHeight = typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id));
            
            if (isHeight) {
                // It's a height, use Tendermint client
                const blockHeight = typeof id === 'number' ? id : parseInt(id);
                try {
                    const blockResponse = await this.tmClient!.block(blockHeight);
                    const blockResults = await this.tmClient!.blockResults(blockHeight);
                    return this.parseBlockData(blockResponse, blockResults, verbosity);
                } catch (clientError) {
                    console.error(`Tendermint client error for height ${blockHeight}:`, clientError);
                    throw clientError; // Re-throw to fall back to HTTP
                }
            } else if (isHash) {
                // It's a hash, skip Tendermint client and use HTTP directly
                throw new Error('Using HTTP fallback for hash lookup');
            } else {
                throw new Error(`Invalid block identifier format: ${id}`);
            }
        } catch (error) {
            console.error(`Error fetching block ${id}:`, error);
            
            // Fallback to HTTP request
            try {
                // Determine the correct endpoint based on whether it's a hash or height
                const isHash = typeof id === 'string' && /^[0-9A-Fa-f]{64}$/.test(id);
                
                let endpoint;
                if (isHash) {
                    // For hash queries, use the block_by_hash endpoint without wrapping hash in quotes
                    endpoint = `${this.rpcUrl}/block_by_hash?hash=${id}`;
                } else {
                    // For height queries, use the block endpoint
                    endpoint = `${this.rpcUrl}/block?height=${id}`;
                }
                
                console.log(`Fetching block using HTTP: ${endpoint}`);
                
                const data = await this.curlGet(endpoint);
                console.log(`data curl response--------`, data);
                
                // Handle both response formats
                if (data.result && data.result.block) {
                    // Format 1: Response has a result wrapper
                    return this.parseRpcBlockData(data.result, verbosity);
                } else if (data.block && data.block_id) {
                    // Format 2: Response has direct block data
                    return this.parseRpcBlockData(data, verbosity);
                }
                
                // If we get here, the structure is unexpected
                console.error('Unexpected response structure:', JSON.stringify(data));
                throw new Error('Invalid response format');
            } catch (fallbackError) {
                console.error(`HTTP request failed for block ${id}:`, fallbackError);
                
                // Return minimal block data to avoid crashes
                return {
                    hash: typeof id === 'string' ? id : `unknown_${id}`,
                    timestamp: Date.now(),
                    height: typeof id === 'number' ? id : (parseInt(String(id), 10) || 0),
                    transactions: 0,
                    blockversion: 0,
                    appversion: 0,
                    l1lockedheight: 0,
                    validator: "unknown",
                    error: `Block data could not be retrieved: ${fallbackError.message}`
                };
            }
        }
    }

    private parseRpcBlockData(data: any, verbosity: number = 1): any {
        // Make sure we have a proper structure to work with
        console.log(`data`, data);
        if (!data || !data.block || !data.block.header) {
            console.error('Unexpected block data structure:', JSON.stringify(data));
            throw new Error('Invalid block data structure');
        }
    
        const block = data.block;
        const header = block.header;
        const blockId = data.block_id;
        console.log(`-----------------------blockId----------------------`, blockId);
        const basicBlock = {
            hash: blockId?.hash || 'unknown',
            timestamp: header.time ? new Date(header.time).getTime() : Date.now(),
            height: parseInt(header.height || '0'),
            transactions: block.data?.txs?.length || 0,
            blockversion: header.version?.block ? parseInt(header.version.block.toString()) : 0,
            appversion: header.version?.app ? parseInt(header.version.app.toString()) : 0,
            l1lockedheight: header.core_chain_locked_height ? 
                parseInt(header.core_chain_locked_height.toString()) : 0,
            validator: header.proposer_pro_tx_hash || '',
        };
        console.log(`basicBlock`, basicBlock);
        // For higher verbosity, include more details
        if (verbosity > 1) {
            return {
                ...basicBlock,
                chain_id: header.chain_id,
                txs: block.data?.txs || [],
                core_chain_lock: block.core_chain_lock,
                last_commit: block.last_commit,
                fullHeader: header
            };
        }
        
        return basicBlock;
    }
 
    /**
     * Parse block data from Tendermint client SDK response
     */
    private parseBlockData(blockResponse: any, blockResults: any, verbosity: number = 1): any {
        const block = blockResponse.block;
        const header = block.header;
        const blockId = blockResponse.blockId;
        
        // Calculate transaction count and extract tx hashes
        const txs = block.data.txs || [];
        const txHashes = txs.map((tx: Uint8Array) => Buffer.from(tx).toString('hex').toUpperCase());
        
        const basicBlock = {
            hash: Buffer.from(blockId.hash).toString('hex').toUpperCase(),
            timestamp: new Date(header.time).getTime(),
            height: Number(header.height),
            transactions: txs.length,
            blockversion: Number(header.version.block),
            appversion: Number(header.version.app),
            l1lockedheight: header.coreChainLockedHeight ? Number(header.coreChainLockedHeight) : 0,
            validator: header.proposerAddress ? Buffer.from(header.proposerAddress).toString('hex').toUpperCase() : '',
        };
        
        // For higher verbosity, include more details
        if (verbosity > 1) {
            return {
                ...basicBlock,
                txHashes: txHashes,
                blockResults: {
                    height: blockResults.height,
                    txsResults: blockResults.txsResults,
                    beginBlockEvents: blockResults.beginBlockEvents,
                    endBlockEvents: blockResults.endBlockEvents,
                    validatorUpdates: blockResults.validatorUpdates,
                    consensusUpdates: blockResults.consensusUpdates
                },
                evidence: block.evidence,
                lastCommit: block.lastCommit,
                fullHeader: header
            };
        }
        
        return basicBlock;
    }
    
    /**
     * Resolve block details with optional logging
     */
    public resolveBlock: undefined;
    // public async resolveBlock(id: string | number, verbosity: number = 1, depth: number = 0): Promise<any> {
    //     // Check depth limit to prevent infinite recursion
    //     if (depth >= this.blockDepthLimit) {
    //         throw new Error(`Depth limit reached (${this.blockDepthLimit})`);
    //     }
        
    //     try {
    //         // Get the block
    //         const block = await this.getBlock(id, verbosity);
            
    //         if (!block) {
    //             throw new Error(`Block ${id} not found`);
    //         }
            
    //         // If high verbosity, resolve all transactions in the block
    //         if (verbosity > 1 && block.txs && Array.isArray(block.txs)) {
    //             block.transactions = await Promise.all(
    //                 block.txs.map(async (txId: string) => {
    //                     return await this.getTransaction(txId, verbosity - 1, block.height);
    //                 })
    //             );
    //         }
            
    //         // Optional: Log the block if needed
    //         if (verbosity > 0) {
    //             const formattedBlock = this.formatBlockLog(block, verbosity);
    //             console.log('Block Information:');
    //             console.log(formattedBlock.formatted);
    //         }
            
    //         return block;
    //     } catch (error) {
    //         console.error(`Error resolving block ${id}:`, error);
    //         throw error;
    //     }
    // }

    /**
     * Get transaction count for an account (base class compatibility)
     */
    public getTransactionCount:  undefined;
    
    /**
     * Check if data represents a transaction (synchronous)
     */
    public isTransaction(data: any): boolean {
        return !!(
            data && 
            data.hash && 
            (data.tx !== undefined || data.txResult !== undefined)
        );
    }
  
    /**
     * Check if a transaction is confirmed (synchronous)
     */
    public isTransactionConfirmed(transaction: any): boolean {
        return !!(transaction && transaction.height && transaction.height > 0);
    }
  
    /**
     * Check if data represents a block
     */
    public isBlock(data: any): boolean {
        return !!(
            data && 
            data.hash && 
            data.height && 
            data.timestamp
        );
    }
    
    /**
     * Clean up resources and disconnect
     */
    public async disconnect(): Promise<void> {
        // Clear ping interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Clear reconnect timeout
        if (this.reconnectTimeoutId) {
            clearTimeout(this.reconnectTimeoutId);
            this.reconnectTimeoutId = null;
        }
        
        // Close WebSocket
        if (this.ws) {
            this.ws.terminate();
            this.ws = null;
        }
        
        this.tmClient = null;
        this.isConnected = false;
    }
}