/**
 * This method is used by blockchains that implement transaction counts, namely
 * Ethereum and Rinkeby at the time of documenting. It's purpose is to assign a
 * transaction count to the transaction data and update a cached collection in the
 * database for all counts. 
 */
import { BlockchainWrapper } from "../../lib/node-wrappers"

export default async (wrapper: BlockchainWrapper , transaction: any): Promise<any> => {
    if(!(wrapper as any).getTransactionCount) 
        return transaction;

    try {
        transaction.fromNonce = (await (wrapper as any).getTransactionCount(transaction.from)) || 0; 
        return transaction; 
    } catch (error) {
        return transaction;
    }
}