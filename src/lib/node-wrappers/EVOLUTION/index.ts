

// import { error } from "console";
import BlockchainWrapper from "../base";
import Dash from "dash"

export default class EVOLUTIONWrapper extends BlockchainWrapper {
    private ws: WebSocket | null = null;
    private isConnected: boolean = false;

    constructor(host: string) {
        super('EVOLUTION');
        // Initialize WebSocket connection
        this.ws = new WebSocket(`ws://65.109.115.131:26657/websocket`);
        
        this.ws.onopen = () => {
            console.log('WebSocket Connected');
            this.isConnected = true;
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };

        this.ws.onclose = () => {
            console.log('WebSocket Connection Closed');
            this.isConnected = false;
        };
    }
    
    public initEventSystem() {
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
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle transaction events
                if (data.result?.data?.type === 'tendermint/event/Tx') {
                    const transaction = data.result.data.value;
                    this.emit('mempool-tx', transaction);
                    console.log("Mempool TX", transaction);
                }
                
                // Handle block events
                if (data.result?.data?.type === 'tendermint/event/NewBlock') {
                    const block = data.result.data.value;
                    const blockHash = block.block_id.hash;
                    this.emit('confirmed-block', blockHash);
                    console.log("BLOCK TEST", block);
                }
            } catch (error) {
                console.error(error);
            }
        };
    }

    public async getCurrentHeight(): Promise<null | number> {
        try {
            // Fetch status data from Tendermint RPC
            const response = await fetch(`http://65.109.115.131:26657/status`, {
                headers: {
                    "accept": "application/json"
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch status: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Extract the latest block height from the sync_info
            if (data.sync_info && data.sync_info.latest_block_height) {
                return parseInt(data.sync_info.latest_block_height);
            }
            
            throw new Error('Invalid status data structure');
        } catch (error) {
            console.error(`Error fetching current height:`, error);
            return null;
        }
    }
    
    public getTransactionReceipts:  undefined

    public getTransactionReceipt: undefined;

    public getTransaction : undefined;

    public async getBlock(blockHeight: number): Promise<any> {
        try {
            // Fetch block data from Tendermint RPC
            const response = await fetch(`http://65.109.115.131:26657/block?height=${blockHeight}`, {
                headers: {
                    "accept": "application/json"
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch block: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Return block structure based on the JSON response structure
            if (data.block && data.block_id) {
                // If the response is already in the format from paste.txt
                return this.parseBlockData(data);
            } else if (data.result && data.result.block) {
                // If the response is wrapped in a "result" property (typical RPC response)
                return this.parseBlockData(data.result);
            }
            
            throw new Error('Invalid block data structure');
        } catch (error) {
            console.error(`Error fetching block at height ${blockHeight}:`, error);
            return null;
        }
    }
    
    // Helper method to parse block data from the response
    private parseBlockData(data: any) : any {
        const block = data.block;
        const header = block.header;
        
        return {
            hash: data.block_id.hash,
            timestamp: new Date(header.time).getTime(),
            height: parseInt(header.height),
            transactions: block.data.txs ? block.data.txs.length : 0,
            blockversion: parseInt(header.version.block),
            appversion: parseInt(header.version.app),
            l1lockedheight: parseInt(header.core_chain_locked_height),
            validator: header.proposer_pro_tx_hash
        };
    }

    public resolveBlock: undefined;

    public getTransactionCount:  undefined;
  
    public getTransactionSignatures: undefined;
  
    public isTransaction: undefined;
  
    public isTransactionConfirmed: undefined;
  
    public isBlock(data: any): boolean {
      if (!data.chain) return false;
      if (!data.hash) return false;
      if (!data.height) return false;
      return true;
  }
}