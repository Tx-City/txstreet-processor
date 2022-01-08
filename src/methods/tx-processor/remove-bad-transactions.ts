import { BlockchainWrapper } from '../../lib/node-wrappers';
import { Logger } from '../../lib/utilities';
import mongodb from '../../databases/mongodb'; 


export default async (wrapper: BlockchainWrapper, hashes: string[]): Promise<boolean> => {
    try {
        if(!hashes.length) return; 

        // Initialize the database. 
        const { database } = await mongodb();
        const collection = database.collection(process.env.DB_COLLECTION_TRANSACTIONS + '_' + wrapper.ticker || '');

        // The query matching all documents that should be removed. 
        const where = { hash: { $in: hashes } }; 
        const update = { $set: { dropped: true } };

        // Execute the query 
        await collection.updateMany(where, update); 
        return true;
    } catch (error) {
        Logger.error(error); 
        return false;;
    }
}