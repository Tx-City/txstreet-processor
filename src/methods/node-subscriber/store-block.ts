import debug from 'debug'; 
import mongodb from '../../databases/mongodb';
import { BlockchainWrapper } from '../../lib/node-wrappers';
import { Logger } from '../../lib/utilities';

const logger = debug('methods/store-block')

// Stores a #Block in the MongoDB Database.
export default async (wrapper: BlockchainWrapper, hash: string): Promise<Boolean> => {
    try {
        if(process.env.USE_DATABASE == "true") {
            const { database } = await mongodb(); 
            const collection = database.collection('blocks');
            
            await collection.updateOne({ chain: wrapper.ticker, hash }, { 
                $set: { lastInserted: Date.now(), node: true, note: '[node-sub]: store-block' },
                $setOnInsert: { insertedAt: new Date(), processed: false, locked: false, processFailures: 0, processMetadata: true, processTransactions: true }
            }, { upsert: true });
        }
    } catch (error) {
        Logger.error(error);
    }
    return false;
}