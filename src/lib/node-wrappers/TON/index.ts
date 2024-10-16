import BlockchainWrapper from "../base";
import fetch from "node-fetch";

interface TONBlock {
  height: number;
  hash: string;
  timestamp: number;
  transactions: any[]; // You may want to define a more specific type for transactions
}

export default class TONWrapper extends BlockchainWrapper {
  private apiUrl: string;
  private latestKnownHeight: number = 0;

  constructor() {
    super("TON");
    const apikey = "365f28ca04940f18011fccd29490c3d8";
    this.apiUrl = `https://ton-mainnet.core.chainstack.com/${apikey}/api/v3`;
  }

  public async initEventSystem() {
    setInterval(async () => {
      const latestBlock = await this.getLatestBlock();
      if (latestBlock && latestBlock.height > this.latestKnownHeight) {
        this.latestKnownHeight = latestBlock.height;
        this.emit("new-block", latestBlock);
      }
    }, 10000);
  }

  private async fetchBlocks(limit: number = 20): Promise<TONBlock[]> {
    try {
      const blocksResponse = await fetch(
        `${this.apiUrl}/blocks?limit=${limit}`
      );
      if (!blocksResponse.ok) {
        throw new Error(`HTTP error! status: ${blocksResponse.status}`);
      }
      const blocksData = await blocksResponse.json();

      const blocksWithTransactions = await Promise.all(
        blocksData.map(async (block: any) => {
          const params = new URLSearchParams({
            workchain: "0",
            shard: block.shard,
            seqno: block.result.id.seqno.toString(),
          });
          const txUrl = `https://ton-mainnet.core.chainstack.com/f2a2411bce1e54a2658f2710cd7969c3/api/v2/getBlockTransactions?${params}`;
          const txResponse = await fetch(txUrl);
          if (!txResponse.ok) {
            console.warn(
              `Failed to fetch transactions for block ${block.seqno}. Status: ${txResponse.status}`
            );
            return block;
          }
          const txData = await txResponse.json();
          return { ...block, transactions: txData };
        })
      );

      return blocksWithTransactions.map((block: any) => ({
        height: block.seqno,
        hash: block.root_hash,
        timestamp: block.gen_utime,
        transactions: block.transactions || [],
      }));
    } catch (error) {
      console.error("Error fetching blocks:", error);
      return [];
    }
  }

  public async getCurrentHeight(): Promise<null | number> {
    const latestBlock = await this.getLatestBlock();
    return latestBlock ? latestBlock.height : null;
  }

  public async getLatestBlock(): Promise<TONBlock | null> {
    const blocks = await this.fetchBlocks(1);
    return blocks.length > 0 ? blocks[0] : null;
  }

  public async getBlock(
    id: string | number,
    verbosity: number,
    shard: number = 8000000000000000
  ): Promise<TONBlock | null> {
    try {
      if (typeof id === "string") {
        const response = await fetch(
          `https://ton-mainnet.core.chainstack.com/f2a2411bce1e54a2658f2710cd7969c3/api/v2/getBlockHeader?workchain=0&shard=${shard}&seqno=${id}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const block = await response.json();
        const blockTransactions = await fetch(
          `https://ton-mainnet.core.chainstack.com/f2a2411bce1e54a2658f2710cd7969c3/api/v2/getBlockTransactions?workchain=0&shard=${shard}&seqno=${block.result.id.seqno}`
        );
        const blockTxs = await blockTransactions.json();
        return {
          height: block.result.id.seqno,
          hash: block.result.id.root_hash,
          timestamp: block.result.gen_utime,
          transactions: blockTxs.result.transactions || [],
        };
      }
    } catch (error) {
      console.error("Error fetching block:", error);
      return null;
    }
  }

  public async resolveBlock(
    id: string | number,
    verbosity: number,
    depth: number
  ): Promise<any> {
    const block = await this.getBlock(id, verbosity);
    return block ? { exists: true, block } : { exists: false };
  }

  public isBlock(data: any): boolean {
    return (
      data && typeof data.height === "number" && typeof data.hash === "string"
    );
  }

  public async getTransaction(
    id: string,
    verbosity: number,
    blockId?: string | number
  ): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/transactions/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching transaction:", error);
      return null;
    }
  }

  public async getTransactionCount(account: string): Promise<number> {
    try {
      const response = await fetch(
        `${this.apiUrl}/accounts/${account}/transactions/count`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.count;
    } catch (error) {
      console.error("Error fetching transaction count:", error);
      return 0;
    }
  }

  public isTransaction(data: any): boolean {
    return (
      data &&
      typeof data.hash === "string" &&
      typeof data.block_height === "number"
    );
  }

  public isTransactionConfirmed(transaction: any): boolean {
    return (
      transaction &&
      transaction.block_height !== null &&
      transaction.block_height !== undefined
    );
  }

  // These methods are not directly supported by the provided API, so they're left as placeholders
  public getTransactionReceipts?(block: any) {
    throw new Error("Method not implemented.");
  }

  public getTransactionReceipt?(hash: string) {
    throw new Error("Method not implemented.");
  }
}
