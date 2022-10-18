
import mongodb from '../../../databases/mongodb';
import redis from '../../../databases/redis'; 
import createBlockJson from '../../..//methods/tx-processor/create-block-json';

export default async (chain: string): Promise<void> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks'); 
        //first check if the transaction fetching is failing, and then update them to be picked up again to create the block json
        let block = await collection.find({ chain, stored: false, broadcast: false, processed: true, lastTransactionFetch: { $lt: Date.now() - 60000 } }).sort({ height: 1 }).limit(1).next();
        if(block){
            console.log("found stuck block " + block.hash);
            if(block.transactions && block.transactions.length){
                const remainingTransactions = await database.collection('transactions_' + chain).find({ blockHash: block.hash, confirmed: false }).project({ _id: 1 }).toArray();
                if(remainingTransactions.length){
                    for (let i = 0; i < remainingTransactions.length; i++) {
                        const rtx = remainingTransactions[i];
                        console.log("updated failed tx " + rtx.hash);
                        await database.collection('transactions_' + chain).updateOne({ _id: rtx._id }, { $set: { confirmed: false, processed: true, blockHeight: block.height, locked: false, processFailures: 0 }});
                    }
                    // confirmed: false, processed: true, blockHeight: { $ne: null }, locked: false, processFailures: { $lte: 5 }
                    
                }
                return;
            }
        }

        block = await collection.find({ chain, stored: true, broadcast: false }).sort({ height: 1 }).limit(1).next(); 
        if(!block) return; 
        const parent = await collection.findOne({ chain, hash: block.hash });

        if(block.stored && parent.stored || block.stored && !parent) {
            await collection.updateOne({ chain, hash: block.hash }, { $set: { broadcast: true } }); 
            redis.publish('block', JSON.stringify({ chain, height: block.height, hash: block.hash })); 
        } else {
            console.log(`Waiting on parent block`);
        }
    } catch (error) {
        console.error(error); 
    }
}