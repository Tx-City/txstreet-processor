import { BlockchainWrapper } from '../../lib/node-wrappers';
import { formatTransaction, Logger } from '../../lib/utilities';

import debug from 'debug'; 
import mongodb from '../../databases/mongodb';
import redis from '../../databases/redis';

const logger = debug('methods/store-transaction')

/**
 * Returns a simple object containing default fields and values for transactions to be
 * stored in the database.
 * 
 * @param ticker The ticker for the blockchain. 
 */
const defaultTransactionFields = (ticker: string) => ({
    confirmed: false, 
    locked: false,
    processFailures: 0, 
    timestamp: Date.now(), 
    insertedAt: new Date(), 
    chain: ticker,
    node: true
})

// Stores a #Block in the MongoDB Database.
export default async (wrapper: BlockchainWrapper , transaction: any): Promise<Boolean> => {
    try {
        
        // Merge the default fields into the current transaction data.
        transaction = { ...defaultTransactionFields(wrapper.ticker), ...transaction, }; 

        if(transaction.processed){
            transaction.lastProcessed = Date.now();
        }
        
        if(process.env.USE_DATABASE == "true") {
            const { database } = await mongodb(); 
            const collection = database.collection(process.env.DB_COLLECTION_TRANSACTIONS  + '_' + wrapper.ticker || '');
            // Find a transaction for this hash in the collection and update it, if one does not exist, create it. 
            const updateResults = await collection.updateOne({ hash: transaction.hash }, { 
                $set: { lastInsert: new Date(),  note: '[node-sub]: store-tx'  },
                $unset: { dropped: "" },
                $setOnInsert: { ...transaction }
            }, { upsert: true });

            const formatted = formatTransaction(wrapper.ticker, transaction);
            
            // Inform the front-end that this transaction has been detected.
            if(updateResults.upsertedId != null)
                redis.publish('pendingTx', JSON.stringify({ chain: wrapper.ticker, node: true, ...formatted }));
        }
    } catch (error) {
        Logger.error(error);
    }
    return false;
}
