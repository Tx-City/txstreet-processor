import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { setInterval } from '../../../utils/OverlapProtectedInterval';
import { formatBlock, formatTransaction, storeObject } from '../../../../../lib/utilities';
// import calculateBlockStats from './calculateBlockStats';
import fs from 'fs';
import path from 'path';
const dataDir = path.join(process.env.DATA_DIR as string || '/mnt/disks/txstreet_storage');


setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks');
        const blocks = await collection.find({ chain: 'EVOLUTION', processed: true, broadcast: false, hash: { $ne: null } }).sort({ height: 1 }).limit(1).toArray();
        if (blocks.length < 1) return;
        const block = blocks[0];
        if (!block) return;
        await checkBlock(database, block);
    } catch (error) {
        console.error(error);
    }
}, 500).start(true);


const storeBlock = async (database: any, block: any) => {
 
    try {
        console.log("inside store block function");
        const remainingTxs = await database.collection('transactions_EVOLUTION').find({ confirmed: false, blockHash: block.hash, dropped: { $exists: false } }).count();
        if (remainingTxs > 0) {
            let remainingFull = await database.collection('transactions_EVOLUTION').find({ confirmed: false, blockHash: block.hash, dropped: { $exists: false } }).limit(20).toArray();
            for (let i = 0; i < remainingFull.length; i++) {
                const tx = remainingFull[i];
                if(tx.locked && Date.now() - tx.lockedAt > 3000){
                    await database.collection('transactions_EVOLUTION').updateOne({ hash: tx.hash }, { $set: { locked: false, processed: false } });
                }
            }
            console.log(`Block ${block.hash} is still waiting on ${remainingTxs} transactions to be processed.`);
            return false;
        }

        // Ensure block.transactions is an array
        if (!block.transactions || !Array.isArray(block.transactions)) {
            block.transactions = [];
        }

        block.txFull = {};
        
        // Only proceed with the query if block.transactions has items
        let transactions = [];
        if (block.transactions.length > 0) {
            transactions = await database.collection('transactions_EVOLUTION').find({ 
                hash: { $in: block.transactions }, 
                confirmed: true 
            }).toArray();
            
            if (transactions.length === 0) {
                // If no transactions found, create them
                for (let i = 0; i < block.transactions.length; i++) {
                    const hash = block.transactions[i];
                    await database.collection('transactions_EVOLUTION').updateOne(
                        { hash }, 
                        { 
                            $set: { 
                                blockHash: block.hash, 
                                blockHeight: block.height, 
                                blockNumber: block.number, 
                                confirmed: true, 
                                processed: false, 
                                locked: false, 
                                processFailures: 0, 
                                lastInsert: new Date(), 
                                insertedAt: new Date() 
                            }, 
                            $unset: { dropped: "" } 
                        }, 
                        { upsert: true }
                    );
                }
                return false;
            }
        }

        transactions.forEach((transaction: any) => {
            const formatted = formatTransaction('EVOLUTION', transaction);
            block.txFull[formatted.tx] = formatted;
        });

        console.log(`Stored Block:`, block.hash, 'TxFull', Object.values(block.txFull).length, 'Transactions:', transactions.length, 'Block transactions:', block.transactions?.length);

        const formattedBlock: any = formatBlock('EVOLUTION', block);
        formattedBlock.note = 'broadcastReadyBlocks';
        const fileContents = JSON.stringify(formattedBlock);

        const firstPart = block.hash[block.hash.length - 1];
        const secondPart = block.hash[block.hash.length - 2];
        console.log("Storing block", block.hash);
        console.log("firstPart-----------------", firstPart);
        console.log("secondPart----------------", secondPart);
        
        await storeObject(path.join('blocks', 'EVOLUTION', firstPart, secondPart, block.hash), fileContents);
        console.log("is stored getting set to true");
        await database.collection('blocks').updateOne({ chain: 'EVOLUTION', hash: block.hash }, { $set: { stored: true, broadcast: false } });
        block.stored = true;
        console.log("Block stored", block.stored);
        block.broadcast = false;
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

const checkBlock = async (database: any, block: any, depth: number = 0) => {
    console.log("inside check block function");
    if (depth > 1) return true;

    try {
        // If the block is not stored, make sure all transactions are processed and then store it. 
        if (!block.stored) {
            console.log("Block not stored - " + block.hash);
            console.log("Checking block as getting mongo error - " + block);
            if (!(await storeBlock(database, block)))
                return false;
        }

        // Validate that the block's parent is stored, if it exists
        let parent = null;
        if (block.parentHash && depth === 0)
            parent = await database.collection('blocks').findOne({ chain: 'EVOLUTION', hash: block.parentHash });

        if (parent && !parent.processed) {
            console.log("Parent is not proccessed.");
            return false;
        }

        if (parent) {
            if (!await checkBlock(database, parent, depth + 1))
                return false;
        }

        // If the previous block passed all checks (or doesn't exist, sanity, depth limit). 
        if (block.stored && parent && parent.stored || block.stored && !parent) {
            
            // console.log(`Block ${block.hash} is ready to broadcast.`);
            console.log("why is this called again and again");
            redis.publish('block', JSON.stringify({ chain: 'EVOLUTION', height: block.height, hash: block.hash }));
            await database.collection('blocks').updateOne({ chain: 'EVOLUTION', hash: block.hash }, { $set: { broadcast: true, note: 'broadcast-ready-block' } });
            // console.log("Block broadcasted");
            return true;
        } else {
            console.log("Block isn't ready, either block or parent is not stored");
            return false;
        }
    } catch (error) {
        console.error(error);
        return false;
    }
}