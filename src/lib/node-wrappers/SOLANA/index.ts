import BlockchainWrapper from "../base";
import {
  Connection,
  PublicKey,
  TransactionSignature,
  BlockResponse,
  ConfirmedTransaction,
  VersionedBlockResponse,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import Client, {
  CommitmentLevel,
  SubscribeRequest,
  SubscribeRequestFilterAccountsFilter,
} from "@triton-one/yellowstone-grpc";

export default class SolanaWrapper extends BlockchainWrapper {
  
  public grpcClient: Client;
  public stream: any;
  public connection: Connection;
  public programId: PublicKey;

  constructor(host: string) {
    super("SOLANA");
   
    const parts = host.split('/');
    const xToken = parts[parts.length - 1];
    this.grpcClient = new Client(host, xToken, {
      "grpc.max_receive_message_length": 64 * 1024 * 1024 // 64MiB,
    });
    
    this.connection = new Connection(host, "processed");
    this.programId = SystemProgram.programId;
    
  }
  public async writing(){
      this.stream = await this.grpcClient.subscribe();
      const req: SubscribeRequest = {
        slots: {},
        accounts: {},
        transactions: {},
        transactionsStatus: {},
        blocks: {},
        blocksMeta: { blockmetadata: {} },
        entry: {},
        accountsDataSlice: [],
      };

    // Send subscribe request
    await new Promise<void>((resolve, reject) => {
      this.stream.write(req, (err: Error | null) => {
        if (err === null || err === undefined) { 
          resolve();
        } else {
          reject(err);
        }
      });
    }).catch((reason) => {
      console.error(reason);
      throw reason;
    });
  }


  public async initEventSystem() {
  
    await this.writing();
    
     // Handle updates
     this.stream.on("data", async (data:any) => {
        // console.log(data)
        try{   
          const hash = data.blockMeta.blockhash;
          const height = data.blockMeta.blockHeight.blockHeight;
          const slot = data.blockMeta.slot;
          console.log("slot======", data)
                if (!hash) return;
                const event = {
                  hash,
                  height: height,
                  slot: slot,
                };
                this.emit("confirmed-block", event);
              
    }catch(error){
      if(error){
        console.log(error)
      }
    }
  });
  
  
   
  
    // Subscribe to new block headers (slot updates)
    
      
      
    };
  

  public async getCurrentHeight(): Promise<null | number>{
    await this.writing();
    let slot;
     // Handle updates
     this.stream.on("data", async (data:any) => {
        // console.log(data)
        try{   
          slot = data.blockMeta.slot;
            return slot;
          } catch(error){
              if(error){
            console.log(error)
          }
        }
  })
  return slot;
}
  

  public getTransactionReceipts:  undefined

  public getTransactionReceipt: undefined;

  

  public getTransaction : undefined;

  // public getBlock: undefined;

  public async getBlock(id: number, verbosity: number): Promise<any> {
    try {
      const returnTransactionObjects = verbosity > 0;
      let block: any;
      console.log("id ++++++ ", id); //27...... height, but it should be slot
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      if (returnTransactionObjects) {
        

          // Usage:
      await delay(3000); // Wait 10 seconds
        block = await this.connection.getBlock(Number(id), { maxSupportedTransactionVersion: 0, commitment: "confirmed" });
      } else {
        await delay(3000); // Wait 10 seconds
        // Fetch block without transactions
        block = await this.connection.getBlock(Number(id), { commitment: "confirmed" });
      }

      //   console.log('before normalizing', { block });
      if (!block) return null;
      // Normalize the block data to match Ethereum structure
      block.height = block.blockHeight;
      block.slot = id;
      console.log("block height ++++++ ", block.height);
      console.log("block Parent slot ++++++++++ ", id);
      block.baseFeePerGas = 0; // Solana doesn't have gas fees like Ethereum, you can set this to 0
      block.timestamp = Math.floor(block.blockTime);
      block.hash = block.blockhash;

      // Normalize transaction data
      // if (block.transactions && returnTransactionObjects) {
      //   block.transactions = block.transactions.map((tx: any) => {
      //     let transaction = {
      //       hash: tx.transaction.signatures[0], // Solana transaction signature
      //       from:
      //         tx.transaction.message.accountKeys !== null &&
      //         tx.transaction.message.accountKeys !== undefined &&
      //         tx.transaction.message.accountKeys.length
      //           ? tx.transaction.message.accountKeys[0]?.toString()
      //           : tx.transaction.message.staticAccountKeys[0]?.toString() || null, // Sender
      //       to:
      //         tx.transaction.message.accountKeys !== null &&
      //         tx.transaction.message.accountKeys !== undefined &&
      //         tx.transaction.message.accountKeys.length
      //           ? tx.transaction.message.accountKeys[1]?.toString()
      //           : tx.transaction.message.staticAccountKeys[1]?.toString() || null, // Receiver
      //       value: tx.meta.preBalances[0] / LAMPORTS_PER_SOL, // Balance transferred in SOL
      //       fee: tx.meta.fee / LAMPORTS_PER_SOL, // Transaction fee in SOL
      //       gasPrice: 0,
      //       maxFeePerGas: 0,
      //       maxPriorityFeePerGas: 0,
      //       pendingSortPrice: 0,
      //     };

      //     // Return normalized transaction
      //     return transaction;
      //   });
      // } else {
      //   block.transactions = [];  
      // }
      block.transactions = [];  
      return block;
    } catch (error) {
      console.error("getBlock", error);
      return null;
    }
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
