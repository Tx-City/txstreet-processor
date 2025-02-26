// Save as evolution-tester.js
import WebSocket from 'ws';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { EventEmitter } from 'events';
import fetch from 'node-fetch'; // Only needed for Node.js <18

// Base wrapper class
class BlockchainWrapper extends EventEmitter {
    constructor(ticker) {
        super();
        this.ticker = ticker.toUpperCase();
        this.blockDepthLimit = 5;
    }
}

// Evolution wrapper implementation
class EVOLUTIONWrapper extends BlockchainWrapper {
    constructor(host) {
        super('EVOLUTION');
        this.isConnected = false;
        
        // Store the RPC URL for Tendermint client
        this.rpcUrl = `http://${host}:26657`;
        
        // Initialize WebSocket connection using the host parameter
        this.ws = new WebSocket(`ws://${host}:26657/websocket`);
        
        this.ws.on('open', () => {
            console.log('WebSocket Connected');
            this.isConnected = true;
            this.emit('connected');
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket Error:', error);
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
    
    async initTendermint() {
        try {
            this.tmClient = await Tendermint34Client.connect(this.rpcUrl);
            console.log('Tendermint client initialized');
        } catch (error) {
            console.error('Error initializing Tendermint client:', error);
        }
    }
    
    initEventSystem() {
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

        // Handle incoming messages
        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                // Handle transaction events
                if (message.result?.data?.type === 'tendermint/event/Tx') {
                    const transaction = message.result.data.value;
                    this.emit('mempool-tx', transaction);
                    console.log("Mempool TX", transaction);
                }
                
                // Handle block events
                if (message.result?.data?.type === 'tendermint/event/NewBlock') {
                    const block = message.result.data.value;
                    const blockHash = block.block_id.hash;
                    this.emit('confirmed-block', blockHash);
                    console.log("New Block:", block.block.header.height);
                }
            } catch (error) {
                console.error(error);
            }
        });
    }

    async getCurrentHeight() {
        try {
            // Try with HTTP request first as it's most reliable
            const response = await fetch(`${this.rpcUrl}/status`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch status: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.result && data.result.sync_info && data.result.sync_info.latest_block_height) {
                return parseInt(data.result.sync_info.latest_block_height);
            }
            
            throw new Error('Invalid status data structure');
        } catch (error) {
            console.error(`Error fetching current height:`, error);
            return null;
        }
    }
    
    async getBlock(id, verbosity = 1) {
        try {
            // Handle string ID (could be hash or height as string)
            const blockHeight = typeof id === 'string' ? 
                (id.match(/^[0-9]+$/) ? parseInt(id) : null) : id;
            
            // If it's not a number (height), we need to search by hash
            if (blockHeight === null) {
                throw new Error('Fetching block by hash not implemented for Tendermint');
            }
            
            // Use HTTP request as it's most reliable
            const response = await fetch(`${this.rpcUrl}/block?height=${blockHeight}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch block: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Return block structure based on the JSON response structure
            if (data.result && data.result.block) {
                return this.parseBlockData(data.result, verbosity);
            }
            
            throw new Error('Invalid block data structure');
        } catch (error) {
            console.error(`Error fetching block ${id}:`, error);
            return null;
        }
    }
    
    // Helper method to parse block data from the response
    parseBlockData(data, verbosity = 1) {
        const block = data.block;
        const header = block.header;
        
        const basicBlock = {
            hash: data.block_id.hash,
            timestamp: new Date(header.time).getTime(),
            height: parseInt(header.height),
            transactions: block.data.txs ? block.data.txs.length : 0,
            blockversion: parseInt(header.version.block),
            appversion: parseInt(header.version.app),
            l1lockedheight: parseInt(header.core_chain_locked_height || '0'),
            validator: header.proposer_pro_tx_hash || ''
        };
        
        // For higher verbosity, include more details
        if (verbosity > 1) {
            return {
                ...basicBlock,
                txs: verbosity > 2 ? block.data.txs : 
                    (block.data.txs || []).map((tx) => tx),
                core_chain_lock: block.core_chain_lock,
                last_block_id: header.last_block_id,
                chain_id: header.chain_id
            };
        }
        
        return basicBlock;
    }

    async disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.tmClient = null;
        console.log('Disconnected from Evolution node');
    }
}

// Main test function
async function runTest() {
    const host = '65.109.115.131'; // Your Evolution node
    const evolution = new EVOLUTIONWrapper(host);
    
    // Wait for connection
    await new Promise(resolve => {
        if (evolution.isConnected) {
            resolve();
        } else {
            evolution.once('connected', resolve);
        }
    });
    
    console.log("Connected to Evolution node");
    
    // Initialize event system
    evolution.initEventSystem();
    console.log("Event system initialized");
    
    // Listen for new blocks
    evolution.on('confirmed-block', (blockHash) => {
        console.log(`New block detected: ${blockHash}`);
    });
    
    // Get current height
    const height = await evolution.getCurrentHeight();
    console.log(`Current blockchain height: ${height}`);
    
    // Get a block
    const block = await evolution.getBlock(height - 1);
    console.log(`Block at height ${height - 1}:`, JSON.stringify(block, null, 2));
    
    // Additional test: get a few recent blocks
    console.log("Fetching 5 recent blocks...");
    for (let i = 0; i < 5; i++) {
        const blockHeight = height - i;
        const block = await evolution.getBlock(blockHeight);
        console.log(`Block ${blockHeight} - Hash: ${block.hash}, Transactions: ${block.transactions}`);
    }
    
    // Keep the process running to receive WebSocket events
    console.log("\nListening for new blocks and transactions...");
    console.log("Press Ctrl+C to exit");
}

// Run the test
runTest().catch(error => {
    console.error("Test failed:", error);
    process.exit(1);
});