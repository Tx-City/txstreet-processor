import BlockchainWrapper from "../base";
import { Connection, PublicKey, TransactionSignature, BlockResponse, ConfirmedTransaction } from '@solana/web3.js';

export default class SolanaWrapper extends BlockchainWrapper {
    public connection: Connection;

    constructor(host: string) {
        super('SOL');
        this.connection = new Connection(host, 'confirmed');
    }

    public initEventSystem(): void {
        // Solana doesn't have a mempool concept, but you can subscribe to account changes or slot notifications
        this.connection.onSlotChange((slotInfo: any) => {
            this.emit('new-slot', slotInfo);
            console.log("New Slot:", slotInfo);
        });

        this.connection.onSignature(null as TransactionSignature, (signatureResult: any) => {
            this.emit('signature-result', signatureResult);
            console.log("Signature Result:", signatureResult);
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

    public async getTransaction(id: string, verbosity: number): Promise<any> {
        try {
            const transaction = await this.connection.getTransaction(id);
            return transaction;
        } catch (error) {
            console.error(error);
            return null;
        }
    }

    public async getBlock(id: number, verbosity: number): Promise<BlockResponse | null> {
        try {
            const block = await this.connection.getBlock(id);
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
