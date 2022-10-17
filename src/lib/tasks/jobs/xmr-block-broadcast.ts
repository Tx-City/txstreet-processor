
import mongodb from '../../../databases/mongodb';
import redis from '../../../databases/redis'; 

export default async (chain: string): Promise<void> => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks'); 
        const block = await collection.find({ chain, stored: true, broadcast: false }).sort({ height: 1 }).limit(1).next(); 
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