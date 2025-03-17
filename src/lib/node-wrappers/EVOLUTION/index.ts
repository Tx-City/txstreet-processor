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
        // 37.27.97.175:36657 65.109.115.131:26657/websocket
        
        this.rpcUrl = process.env.EVOLUTION_NODE_RPC
        this.wsUrl = process.env.EVOLUTION_NODE;
        
        // Initialize WebSocket connection
        this.connectWebSocket();
        
        // Initialize Tendermint client
        this.initTendermint().catch(err => {
            console.error('Failed to initialize Tendermint client:', err);
        });
    }

    /**
     * Connect to WebSocket with auto-reconnect capability
     * Updated to use consolidated event handling
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
                
                // Initialize event system after connection
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
            
            // No message handler here - all message handling is now in initEventSystem()
            
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
            // console.log(222222222);
            // console.log(JSON.stringify(txSubscription));
            this.ws.send(JSON.stringify(txSubscription));

            // Handle transaction events directly in the subscription
            this.ws.on('message', async (data: WebSocket.Data) => {
                try {
                    const parsedData = JSON.parse(data.toString());
                    
                    // Handle transaction events
                    if (parsedData.result?.data?.type === 'tendermint/event/Tx') {
                        const txevent = parsedData.result.data.value;
                        // console.log('Transaction event structure in side initEventSystem():', JSON.stringify(txevent, null, 2));

                        if (!txevent.tx) {
                            console.error('Transaction event missing tx field');
                            return;
                        }
                        
                        const txHash = await this.calculateDashTransactionHash(txevent.tx);
                        const transaction = await this.getTransaction(txHash, 2);
                        // console.log("transaction inside initEventSystem():", transaction);
                        this.emit('mempool-tx', transaction);
                        // console.log("Mempool TX", transaction);
                    }
                } catch (error) {
                    console.error('Error handling transaction event:', error);
                }
            });

            // Subscribe to new block events
            const blockSubscription = {
                jsonrpc: "2.0",
                method: "subscribe",
                params: ["tm.event='NewBlock'"],
                id: 2
            };
            this.ws.send(JSON.stringify(blockSubscription));
            
            // Handle block events directly in the subscription
            this.ws.on('message', async (data: WebSocket.Data) => {
                try {
                    const parsedData = JSON.parse(data.toString());
                    
                    // Handle block events
                    if (parsedData.result?.data?.type === 'tendermint/event/NewBlock') {
                        const block = parsedData.result.data.value;
                        const blockHash = block.block_id.hash;
                        
                        this.emit('confirmed-block', blockHash);
                        // console.log("Block confirmed:", blockHash);
                    }
                } catch (error) {
                    console.error('Error handling block event:', error);
                }
            });
        }
    
    /**
     * Initialize Tendermint client
     */
    private async initTendermint(): Promise<void> {
        try {
            this.tmClient = await Tendermint34Client.connect(this.rpcUrl);
            console.log('Tendermint client initialized');
        } catch (error) {
            // console.error('Error initializing Tendermint client:', error);
            
            // Retry connecting to Tendermint client
            setTimeout(() => {
                // console.log('Retrying Tendermint client connection...');
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
     * Get current blockchain height using WebSocket
    */
    public async getCurrentHeight(): Promise<null | number> {
        try {
            // Try WebSocket first if connected
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    // Use sendWebSocketRequest method that's already defined in the class
                    const statusResponse = await this.sendWebSocketRequest('status', [], 5000);
                    
                    if (statusResponse && statusResponse.sync_info && statusResponse.sync_info.latest_block_height) {
                        const height = parseInt(statusResponse.sync_info.latest_block_height);
                        // console.log(`getCurrentHeight (WebSocket): ${height}`);
                        return height;
                    }
                    
                    throw new Error('Invalid status response structure from WebSocket');
                } catch (wsError) {
                    console.warn(`WebSocket status request failed: ${wsError.message}, falling back to Tendermint client`);
                    // Continue to Tendermint client method
                }
            }
            
            // Fallback to Tendermint client
            if (!this.tmClient) {
                await this.initTendermint();
            }
            
            // Get status from Tendermint client
            const status = await this.tmClient!.status();
            // console.log(`getCurrentHeight (Tendermint client)`, parseInt(status.syncInfo.latestBlockHeight.toString()));
            // Extract the block height
            return parseInt(status.syncInfo.latestBlockHeight.toString());
        } catch (error) {
            // Fallback to HTTP request if both WebSocket and Tendermint client fail
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
     * Gets transaction receipts for all transactions in a block
     * @param block The block containing transactions
     * @returns Array of transaction receipts
     */
    public async getTransactionReceipts(block: any): Promise<any[]> {
        try {
            // Check if block exists
            if (block) {
                // Handle case where transactions property might not be an array
                const transactions = Array.isArray(block.transactions) ? block.transactions : 
                                    (Array.isArray(block.tx) ? block.tx : []);
                // Handle empty transactions array
                if (transactions.length === 0) {
                    return [];
                }
                
                // Process all transactions in parallel using Promise.all
                const receipts = await Promise.all(
                    transactions.map(async (txHash: string) => {
                        try {
                            return await this.getTransactionReceipt(txHash);
                        } catch (txError) {
                            console.error(`Error processing transaction ${txHash}:`, txError);
                            return null;
                        }
                    })
                );
                
                // Filter out any null receipts (failed fetches)
                return receipts.filter(receipt => receipt !== null);
            }
            
            // Block doesn't exist
            return [];
        } catch (error) {
            console.error(`Error getting transaction receipts for block ${block?.height || 'unknown'}:`, error);
            return [];
        }
    }

  /**
 * Get transaction details using WebSocket first, with fallback to Tendermint client
 */
public async getTransaction(id: string, verbosity: number = 1, blockId?: string | number): Promise<any> {
    try {
        // Try WebSocket first if connected
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                // Convert hex hash to base64 format needed for the RPC call
                const txHash = Buffer.from(id, 'hex');
                const txBase64 = txHash.toString('base64');
                
                // Use tx endpoint which accepts a base64-encoded transaction hash
                const wsResponse = await this.sendWebSocketRequest('tx', {
                    hash: txBase64,
                    prove: verbosity > 1 // Request proof data for higher verbosity
                }, 5000);
                
                if (!wsResponse) {
                    throw new Error('Empty transaction response from WebSocket');
                }
                // console.log('TRANSACTION VERBOSITY ====== :', verbosity);
                // Create the transaction info object
                const txInfo = {
                    hash: id,
                    // owner: '', // Would need chain-specific logic
                    insertedAt: Date.now(),
                    timestamp: Math.floor(Date.now() / 1000),
                    fee: 0,
                    value: 0,
                    gasUsed: wsResponse.tx_result?.gas_used ? Number(wsResponse.tx_result.gas_used) : 0,
                };
                
                // Add additional details for higher verbosity
                if (verbosity > 1) {
                    // console.log('TRANSACTION VERBOSITY ====== :', verbosity);
                    // console.log('Transaction response:', wsResponse);
                    
                    // Decode the transaction if it exists
                    let decodedTx = null;
                    if (wsResponse.tx) {
                        try {
                            decodedTx = await this.decodeTransaction(wsResponse.tx);
                        } catch (decodeError) {
                            console.warn(`Failed to decode transaction: ${decodeError.message}`);
                        }
                    }
                    
                    return {
                        ...txInfo,
                        height: wsResponse.height ? parseInt(wsResponse.height) : 0,
                        index: wsResponse.index,
                        owner: decodedTx.identityId || '', // Use decoded owner from transaction
                        logs: wsResponse.tx_result?.log || '',
                        txData: wsResponse.tx || null,
                        decodedTx: decodedTx, // Add the decoded transaction data
                        tx_result: wsResponse.tx_result || {},
                        proof: wsResponse.proof || null
                    };
                }
                
                return txInfo;
            } catch (wsError) {
                console.warn(`WebSocket transaction request failed: ${wsError.message}, falling back to Tendermint client`);
                // Continue to the fallback implementation
            }
        }
        
        // Fallback to the original implementation
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
            hash: id,
            owner: '', // Would need chain-specific logic
            insertedAt: Date.now(),
            timestamp: Math.floor(Date.now() / 1000),
            fee: 0,
            value: 0,
            gasUsed: txResponse.result.gasUsed ? Number(txResponse.result.gasUsed) : 0,
        };
        
        if (verbosity > 1) {
            // Fixed property access for gasUsed
            return {
                // Basic info
                ...txInfo,
                height: txResponse.height,
                index: txResponse.index,
                // Additional details
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
 * Decodes a transaction using the platform-explorer API
 * @param base64Transaction The base64-encoded transaction to decode
 * @returns A promise that resolves to the decoded transaction data
 */
private async decodeTransaction(base64Transaction: string): Promise<any> {
    try {
        const response = await fetch('https://platform-explorer.pshenmic.dev/transaction/decode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base64: base64Transaction,
            }),
        });

        if (!response.ok) {
            throw new Error(`Error decoding transaction: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Failed to decode transaction:', error);
        throw error;
    }
}

/**
 * Get transaction receipt by hash using WebSocket first, with fallback to Tendermint client
 * @param hash Transaction hash in hex format
 * @returns Transaction receipt object or null if not found
 */
public async getTransactionReceipt(hash: string): Promise<any> {
    try {
        // Validate hash
        if (!hash || typeof hash !== 'string') {
            console.warn('Invalid transaction hash provided:', hash);
            return null;
        }
        
        // Try WebSocket first if connected
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                // Convert hex hash to base64 format needed for the RPC call
                const txHash = Buffer.from(hash, 'hex');
                const txBase64 = txHash.toString('base64');
                
                // Use tx endpoint which accepts a base64-encoded transaction hash
                const wsResponse = await this.sendWebSocketRequest('tx', {
                    hash: txBase64,
                    prove: false // We don't need proof data for receipt
                }, 5000);
                
                if (!wsResponse) {
                    throw new Error('Empty transaction response from WebSocket');
                }
                
                // Map to the requested receipt structure
                return {
                    hash: hash, // Using the original hash as requested
                    owner: '', // Would need chain-specific logic
                    insertedAt: Date.now(),
                    timestamp: Math.floor(Date.now() / 1000),
                    fee: 0,
                    value: 0,
                    gasUsed: wsResponse.tx_result && wsResponse.tx_result.gas_used ? 
                        Number(wsResponse.tx_result.gas_used) : 0,
                    logs: wsResponse.tx_result && wsResponse.tx_result.log ? 
                        wsResponse.tx_result.log : '',
                    height: wsResponse.height ? parseInt(wsResponse.height) : 0
                };
            } catch (wsError) {
                console.warn(`WebSocket transaction receipt request failed: ${wsError.message}, falling back to Tendermint client`);
                // Continue to the fallback implementation
            }
        }
        
        // Fallback to the original implementation
        // Ensure Tendermint client is initialized
        if (!this.tmClient) {
            await this.initTendermint();
            
            // Verify initialization worked
            if (!this.tmClient) {
                throw new Error('Failed to initialize Tendermint client');
            }
        }
        
        // Create TxParams with proper binary hash
        const txParams: TxParams = {
            hash: new Uint8Array(Buffer.from(hash, 'hex'))
        };
        
        // Get transaction data
        const txResponse = await this.tmClient.tx(txParams);
        
        // Verify response exists
        if (!txResponse) {
            return null;
        }
        
        // Map to the requested receipt structure
        return {
            hash: hash, // Using the original hash as requested
            owner: '', // Would need chain-specific logic
            insertedAt: Date.now(),
            timestamp: Math.floor(Date.now() / 1000),
            fee: 0,
            value: 0,
            gasUsed: txResponse.result && txResponse.result.gasUsed ? 
                Number(txResponse.result.gasUsed) : 0,
            logs: txResponse.result && txResponse.result.log ?
                txResponse.result.log : '',
            height: txResponse.height
        };
    } catch (error) {
        // Log error but don't throw to allow batch processing to continue
        if (error.message && error.message.includes('not found')) {
            console.warn(`Transaction ${hash} not found`);
        } else {
            console.error(`Error fetching transaction receipt ${hash}:`, error);
        }
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

    /**
     * Send a WebSocket request and wait for a response
     * @param method The JSON-RPC method to call
     * @param params The parameters to send
     * @param timeoutMs Maximum time to wait for response in milliseconds
     * @returns Promise that resolves with the response data
     */
    private async sendWebSocketRequest(method: string, params: any, timeoutMs: number = 5000): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket not connected'));
            }
            
            // Generate a unique request ID
            const requestId = `req-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
            
            // Create a timeout to reject the promise if no response arrives
            const timeoutId = setTimeout(() => {
                this.ws?.removeEventListener('message', responseHandler);
                reject(new Error(`WebSocket request timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            // Create message handler
            const responseHandler = (event: WebSocket.MessageEvent) => {
                try {
                    const response = JSON.parse(event.data.toString());
                    
                    // Check if this is the response to our request
                    if (response.id === requestId) {
                        // Clear the timeout and remove the handler
                        clearTimeout(timeoutId);
                        this.ws?.removeEventListener('message', responseHandler);
                        
                        // Check for errors
                        if (response.error) {
                            reject(new Error(`WebSocket error: ${JSON.stringify(response.error)}`));
                            return;
                        }
                        
                        // Resolve with the result
                        resolve(response.result);
                    }
                } catch (error) {
                    // Ignore parsing errors for other messages
                }
            };
            
            // Add the response handler
            this.ws.addEventListener('message', responseHandler);
            
            // Create and send the request
            const request = {
                jsonrpc: '2.0',
                id: requestId,
                method: method,
                params: params
            };
            
            try {
                this.ws.send(JSON.stringify(request));
                // console.log(`WebSocket request sent: ${method}`, params);
            } catch (error) {
                // Clear the timeout and remove the handler
                clearTimeout(timeoutId);
                this.ws?.removeEventListener('message', responseHandler);
                reject(error);
            }
        });
    }

    /**
     * Get block details
     */
    public async getBlock(id: string | number, verbosity: number = 1): Promise<any> {
        try {
            // Try WebSocket first if connected
            if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
                try {
                    // Determine method and params based on id type
                    let method: string;
                    let params: any;
                    
                    const isHash = typeof id === 'string' && /^[0-9A-Fa-f]{64}$/.test(id);
                    const isHeight = typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id));
                    
                    if (isHeight) {
                        // It's a height
                        method = 'block';
                        params = [typeof id === 'number' ? id : parseInt(id as string)];
                    } else if (isHash) {
                        // It's a hash
                        method = 'block_by_hash';
                        params = { hash: id };
                    } else {
                        throw new Error(`Invalid block identifier format: ${id}`);
                    }
                    
                    // console.log(`Requesting block via WebSocket: ${method}`, params);
                    const wsResponse = await this.sendWebSocketRequest(method, params, 8000);
                    
                    if (!wsResponse || !wsResponse.block) {
                        throw new Error('Empty block response from WebSocket');
                    }
                    
                    return this.parseRpcBlockData(wsResponse, verbosity);
                } catch (wsError) {
                    console.warn(`WebSocket request failed: ${wsError.message}, falling back to regular methods`);
                    // Continue to traditional methods
                }
            }
            
            // Fall back to Tendermint client and HTTP methods
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
                
                // console.log(`Fetching block using HTTP: ${endpoint}`);
                
                const data = await this.curlGet(endpoint);
                // console.log(`data curl response--------`, data);
                
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
                    timestamp: Math.floor(Date.now() / 1000),
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

    /**
     * Parse RPC block data from HTTP or WebSocket response
     */
    private parseRpcBlockData(data: any, verbosity: number = 1): any {
        // Make sure we have a proper structure to work with
        // console.log(`data`, data);
        if (!data || !data.block || !data.block.header) {
            console.error('Unexpected block data structure:', JSON.stringify(data));
            throw new Error('Invalid block data structure');
        }

        const block = data.block;
        const header = block.header;
        const blockId = data.block_id;
        // console.log(`-----------------------blockId----------------------`, blockId);
        
        // Try to handle base64 encoded hashes if present
        let blockHash = blockId?.hash || 'unknown';
        if (blockHash.includes('/') || blockHash.includes('+') || blockHash.includes('=')) {
            try {
                // Attempt to decode base64
                const rawHash = Buffer.from(blockHash, 'base64');
                blockHash = rawHash.toString('hex').toUpperCase();
            } catch (error) {
                console.warn(`Failed to decode potential base64 hash: ${blockHash}`);
            }
        }
        const basicBlock = {
            hash: blockHash,
            timestamp: header.time 
               ? Math.floor(new Date(header.time).getTime() / 1000) 
                : Math.floor(Date.now() / 1000),
            height: parseInt(header.height || '0'),
            transactions: block.data?.txs?.length || 0,
            blockversion: header.version?.block ? parseInt(header.version.block.toString()) : 0,
            appversion: header.version?.app ? parseInt(header.version.app.toString()) : 0,
            l1lockedheight: header.core_chain_locked_height ? 
                parseInt(header.core_chain_locked_height.toString()) : 0,
            validator: header.proposer_pro_tx_hash || '',
        };
        // console.log(`basicBlock`, basicBlock);
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
            timestamp: Math.floor(new Date(header.time).getTime() / 1000),
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