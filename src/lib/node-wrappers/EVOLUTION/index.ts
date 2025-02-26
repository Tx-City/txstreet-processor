import WebSocket from 'ws';
import { Tendermint34Client, TxParams } from '@cosmjs/tendermint-rpc';
import BlockchainWrapper from "../base";

export default class EVOLUTIONWrapper extends BlockchainWrapper {
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;
    private tmClient: Tendermint34Client | null = null;
    private rpcUrl: string;

    /**
     * Initialize event system for WebSocket subscriptions
     */
    public initEventSystem(): void {
        if (!this.ws || !this.isConnected) {
            throw new Error('WebSocket not connected');
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

        // Handle incoming messages - Fixed type for ws.onmessage
        this.ws.on('message', (data: WebSocket.Data) => {
            try {
                const parsedData = JSON.parse(data.toString());
                
                // Handle transaction events
                if (parsedData.result?.data?.type === 'tendermint/event/Tx') {
                    const transaction = parsedData.result.data.value;
                    this.emit('mempool-tx', transaction);
                    console.log("Mempool TX", transaction);
                }
                
                // Handle block events
                if (parsedData.result?.data?.type === 'tendermint/event/NewBlock') {
                    const block = parsedData.result.data.value;
                    const blockHash = block.block_id.hash;
                    this.emit('confirmed-block', blockHash);
                    console.log("BLOCK TEST", block);
                }
            } catch (error) {
                console.error(error);
            }
        });
    }

    constructor(host: string) {
        super('EVOLUTION');
        
        // Store the RPC URL for Tendermint client
        this.rpcUrl = `http://${host}:26657`;
        
        // Initialize WebSocket connection using the host parameter
        this.ws = new WebSocket(`ws://${host}:26657/websocket`);
        
        this.ws.on('open', () => {
            console.log('WebSocket Connected');
            this.isConnected = true;
        });

        // Fixed type for ws.onerror
        this.ws.on('error', (event) => {
            console.error('WebSocket Error:', event);
        });

        this.ws.on('close', () => {
            console.log('WebSocket Connection Closed');
            this.isConnected = false;
        });
        
        // Initialize Tendermint client
        this.initTendermint().catch(err => {
            console.error('Failed to initialize Tendermint client:', err);
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
            console.error('Error initializing Tendermint client:', error);
        }
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
            
            // Map to a receipt-like structure - Fixed property name gasUsed
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
                hash: Buffer.from(txResponse.hash).toString('hex').toUpperCase(),
                height: txResponse.height,
                index: txResponse.index,
                success: txResponse.result.code === 0
            };
            
            if (verbosity > 1) {
                // Fixed property access for gasUsed
                return {
                    ...txInfo,
                    tx: Buffer.from(txResponse.tx).toString('base64'),
                    owner: '', // Would need chain-specific logic
                    insertedAt: Date.now(),
                    timestamp: Date.now(),
                    fee: 0,
                    value: 0,
                    gasUsed: txResponse.result.gasUsed ? Number(txResponse.result.gasUsed) : 0,
                    logs: txResponse.result.log || '',
                    result: txResponse.result
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
    public async getBlock(id: string | number, verbosity: number = 1): Promise<any> {
        try {
            // Ensure Tendermint client is initialized
            if (!this.tmClient) {
                await this.initTendermint();
            }
            
            // Handle string ID (could be hash or height as string)
            const blockHeight = typeof id === 'string' ? 
                (id.match(/^[0-9]+$/) ? parseInt(id) : null) : id;
            
            // If it's not a number (height), we need to search by hash
            if (blockHeight === null) {
                throw new Error('Fetching block by hash not implemented for Tendermint');
            }
            
            // Using Tendermint client directly to fetch the block
            const blockResponse = await this.tmClient!.block(blockHeight);
            
            // Get block results for more details if needed
            const blockResults = await this.tmClient!.blockResults(blockHeight);
            
            // Combine data and parse it
            return this.parseBlockData(blockResponse, blockResults, verbosity);
        } catch (error) {
            console.error(`Error fetching block ${id}:`, error);
            
            // Fallback to HTTP request if client fails
            try {
                const response = await fetch(`${this.rpcUrl}/block?height=${id}`, {
                    headers: {
                        "accept": "application/json"
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch block: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Fallback parsing for RPC response format
                if (data.result && data.result.block) {
                    return this.parseRpcBlockData(data.result, verbosity);
                }
                
                throw new Error('Invalid block data structure');
            } catch (fallbackError) {
                console.error(`Fallback request failed for block ${id}:`, fallbackError);
                return null;
            }
        }
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
            
            // Add additional context
            // chain_id: header.chainId,
            // last_block_id: header.lastBlockId ? {
            //     hash: Buffer.from(header.lastBlockId.hash).toString('hex').toUpperCase(),
            //     parts: {
            //         total: header.lastBlockId.parts.total,
            //         hash: Buffer.from(header.lastBlockId.parts.hash).toString('hex').toUpperCase()
            //     }
            // } : null,
            // consensusHash: Buffer.from(header.consensusHash).toString('hex').toUpperCase(),
            // appHash: Buffer.from(header.appHash).toString('hex').toUpperCase(),
            // lastResultsHash: Buffer.from(header.lastResultsHash).toString('hex').toUpperCase(),
            // evidenceHash: Buffer.from(header.evidenceHash).toString('hex').toUpperCase(),
            // validatorsHash: Buffer.from(header.validatorsHash).toString('hex').toUpperCase()
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
     * Parse block data from RPC response (fallback method)
     */
    private parseRpcBlockData(data: any, verbosity: number = 1): any {
        const block = data.block;
        const header = block.header;
        
        const basicBlock = {
            hash: data.block_id?.hash || 'unknown',
            timestamp: header.time ? new Date(header.time).getTime() : Date.now(),
            height: parseInt(header.height || '0'),
            transactions: block.data?.txs?.length || 0,
            blockversion: header.version?.block ? parseInt(header.version.block.toString()) : 0,
            appversion: header.version?.app ? parseInt(header.version.app.toString()) : 0,
            l1lockedheight: parseInt(header.core_chain_locked_height || '0'),
            validator: header.proposer_pro_tx_hash || '',
            
            // Add additional context with optional chaining
            // chain_id: header.chain_id,
            // last_block_id: header.last_block_id,
            // consensusHash: header.consensus_hash,
            // appHash: header.app_hash
        };
        
        // For higher verbosity, include more details
        if (verbosity > 1) {
            return {
                ...basicBlock,
                txs: verbosity > 2 ? block.data?.txs || [] : 
                    (block.data?.txs || []).map((tx: string) => tx),
                core_chain_lock: block.core_chain_lock,
                fullHeader: header
            };
        }
        
        return basicBlock;
    }

    /**
     * Resolve block details with optional logging
     */
    public async resolveBlock(id: string | number, verbosity: number = 1, depth: number = 0): Promise<any> {
        // Check depth limit to prevent infinite recursion
        if (depth >= this.blockDepthLimit) {
            throw new Error(`Depth limit reached (${this.blockDepthLimit})`);
        }
        
        try {
            // Get the block
            const block = await this.getBlock(id, verbosity);
            
            if (!block) {
                throw new Error(`Block ${id} not found`);
            }
            
            // If high verbosity, resolve all transactions in the block
            if (verbosity > 1 && block.txs && Array.isArray(block.txs)) {
                block.transactions = await Promise.all(
                    block.txs.map(async (txId: string) => {
                        return await this.getTransaction(txId, verbosity - 1, block.height);
                    })
                );
            }
            
            // Optional: Log the block if needed
            if (verbosity > 0) {
                const formattedBlock = this.formatBlockLog(block, verbosity);
                console.log('Block Information:');
                console.log(formattedBlock.formatted);
            }
            
            return block;
        } catch (error) {
            console.error(`Error resolving block ${id}:`, error);
            throw error;
        }
    }

    /**
     * Get transaction count for an account (base class compatibility)
     */
    public async getTransactionCount(account: string): Promise<number> {
        console.warn('getTransactionCount by account not directly supported in Tendermint');
        return 0;
    }
  
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
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.tmClient = null;
    }
}