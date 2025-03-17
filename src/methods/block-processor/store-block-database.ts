import mongodb from '../../databases/mongodb';

const dontCheckTxs = ['ARBI', 'MANTA', 'LUMIA'];

// The purpose of this method is to store chain-provided block information in the database. 
export default async (chain: string, block: any, databaseKey: string): Promise<void> => {
    try {
        // Initialize database.
        const { database } = await mongodb(); 
        const collection = database.collection('blocks');

        // Upsert (Update, Create if not exists) this block in the database. 
        console.log(`Storing block ${databaseKey}, processed=true, locked=false`);
        console.log(`block[databaseKey]`, block[databaseKey]);
        
        const updateResult = await collection.updateOne(
            { chain, [databaseKey]: block[databaseKey] }, 
            { $set: { 
                ...block, 
                processed: true, 
                txsChecked: dontCheckTxs.includes(chain), 
                locked: false, 
                note: '[block-processor]: store-block-db', 
                stored: false, 
                broadcast: false 
              } 
            }, 
            { upsert: true }
        ); 

        // Check if the operation was successful
        if (updateResult.acknowledged) {
            // Now fetch the updated document to see its final state
            const updatedDocument = await collection.findOne({ chain, [databaseKey]: block[databaseKey] });
            
            console.log("Updated document:", JSON.stringify(updatedDocument, null, 2));
            
            // You can also log the update operation results
            console.log(`Update operation: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}, upserted=${updateResult.upsertedCount}`);
        }
    } catch (error) {
        console.error("Error storing block in database:", error);
        throw error; // Re-throw the error so calling functions know something went wrong
    }
};