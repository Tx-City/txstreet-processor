import BlockchainWrapper from "../base";
import {
  Connection,
  PublicKey,
  TransactionSignature,
  BlockResponse,
  ConfirmedTransaction,
  VersionedBlockResponse,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

export default class SolanaWrapper extends BlockchainWrapper {
  public connection: Connection;

  constructor(host: string) {
    super("SOLANA");
    this.connection = new Connection(host, "confirmed");
  }

  public initEventSystem() {
    // Subscribe to all confirmed transactions
    this.connection.onSignatureWithOptions(
        '*', // wildcard subscription for all signatures
        async (signature, context) => {
            console.log("-----------Solana transaction detected--------------");
            try {
                const sig: any = signature;
                const transaction = await this.getTransaction(sig);
                if (transaction) {
                    this.emit('mempool-tx', transaction);
                    console.log("Mempool TX", transaction);
                }
            } catch (error) {
                console.error(error);
            }
        },
        { commitment: 'confirmed' }
    );

    // Subscribe to new block headers (slot updates)
    this.connection.onSlotUpdate((slotInfo) => {
        console.log("-----------Solana block detected--------------");
        if (slotInfo.type === 'completed') {
            this.emit('confirmed-block', slotInfo.slot);
            console.log("Confirmed Block", slotInfo.slot);
        }
    });
}

  public async getCurrentHeight(): Promise<null | number> {
    try {
      const slot = await this.connection.getSlot();
      return slot;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async getTransactionReceipts(block: BlockResponse): Promise<any[]> {
    try {
      const promises = block.transactions.map((transaction: any) =>
        this.getTransactionReceipt(transaction.transaction.signatures[0])
      );
      const receipts = await Promise.all(promises);
      return receipts;
    } catch (error) {
      console.error(error);
      return [];
    }
  }

  public async getTransactionReceipt(hash: string): Promise<ConfirmedTransaction | null> {
    try {
      const receipt = await this.connection.getConfirmedTransaction(hash);
      return receipt;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async getTransaction(id: string, verbosity?: number): Promise<any> {
    try {

        let transaction: any;
      transaction = await this.connection.getTransaction(id, {
        maxSupportedTransactionVersion: 0,
      });
      return {
        hash: transaction.signatures[0],
        blockNumber: transaction.slot,
        from: transaction.message.accountKeys[0].toString(),
        to: transaction.message.accountKeys[1].toString(),
        value: transaction.meta.preBalances[0] / LAMPORTS_PER_SOL,
        gasPrice: 0,
        maxFeePerGas: 0,
        maxPriorityFeePerGas: 0,
        pendingSortPrice: 0,
      };

    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async getBlock(id: number, verbosity: number): Promise<any> {
    try {
      const returnTransactionObjects = verbosity > 0;
      let block: any;
      if (returnTransactionObjects) {
        block = await this.connection.getBlock(id, { maxSupportedTransactionVersion: 0 });
      } else {
        // Fetch block without transactions
        block = await this.connection.getBlock(id);
      }

      //   console.log('before normalizing', { block });
      if (!block) return null;

      // Normalize the block data to match Ethereum structure
      block.height = block.blockHeight;
      block.baseFeePerGas = 0; // Solana doesn't have gas fees like Ethereum, you can set this to 0
      block.timestamp = Math.floor(block.blockTime);
      block.hash = block.blockhash;

      // Normalize transaction data
      if (block.transactions && returnTransactionObjects) {
        block.transactions = block.transactions.map((tx: any) => {
          let transaction = {
            hash: tx.transaction.signatures[0], // Solana transaction signature
            from: tx.transaction.message.accountKeys !== null && tx.transaction.message.accountKeys !== undefined && tx.transaction.message.accountKeys.length ? tx.transaction.message.accountKeys[0]?.toString() : tx.transaction.message.staticAccountKeys[0]?.toString() || null, // Sender
            to: tx.transaction.message.accountKeys !== null && tx.transaction.message.accountKeys !== undefined && tx.transaction.message.accountKeys.length ? tx.transaction.message.accountKeys[1]?.toString() : tx.transaction.message.staticAccountKeys[1]?.toString() || null, // Receiver
            value: tx.meta.preBalances[0] / LAMPORTS_PER_SOL, // Balance transferred in SOL
            gasPrice: 0,
            maxFeePerGas: 0,
            maxPriorityFeePerGas: 0,
            pendingSortPrice: 0,
          };

          // Return normalized transaction
          return transaction;
        });
      } else {
        block.transactions = [];
      }
      
      return block;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  public async resolveBlock(id: number, verbosity: number, depth: number): Promise<any> {
    try {
      const block = await this.getBlock(id, verbosity);
      return block ? { exists: true, block } : { exists: false };
    } catch (error) {
      console.error(error);
      return { exists: false };
    }
  }

  public async getTransactionCount(): Promise<number> {
    try {
      const count = await this.connection.getTransactionCount();
      return count;
    } catch (error) {
      console.error(error);
      return 0;
    }
  }

  public async getTransactionSignatures(account: string): Promise<any> {
    try {
      const publicKey = new PublicKey(account);
      const signatures = await this.connection.getSignaturesForAddress(publicKey);
      return signatures.length; // Returns the number of transaction signatures
    } catch (error) {
      console.error(error);
      return 0;
    }
  }

  public isTransaction(data: any): boolean {
    return data && data.signature && data.transaction;
  }

  public isTransactionConfirmed(transaction: any): boolean {
    return transaction && transaction.meta && transaction.meta.err === null;
  }

  public isBlock(data: any): boolean {
    return data && data.blockTime && data.blockhash;
  }
}
