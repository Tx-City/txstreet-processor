import mongodb from '../../databases/mongodb';

// Create localized logger.
import { Logger } from '../../lib/utilities';

// The purpose of this method is to store chain-provided block information in the database. 
export default async (chain: string, block: any, databaseKey: string): Promise<void> => {
    try {
        // Initialize database.
        const { database } = await mongodb(); 
        const collection = database.collection(process.env.DB_COLLECTION_BLOCKS || '');

        // Upsert (Update, Create if not exists) this block in the database. 
        await collection.updateOne({ chain, [databaseKey]: block[databaseKey] }, { $set: { ...block, processed: true, locked: false, note: '[block-processor]: store-block-db', stored: false, broadcast: false } }, { upsert: true }); 
        Logger.info(`Stored block ${databaseKey}, processed=true, locked=false`)
    } catch (error) {
        Logger.error(error); 
    }
}


// chain, [databaseKey] (hash?) 
