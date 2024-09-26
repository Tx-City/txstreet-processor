import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { setInterval } from '../../../utils/OverlapProtectedInterval';
import { formatBlock, formatTransaction, storeObject } from '../../../../../lib/utilities';
import fs from 'fs';
import path from 'path';
const dataDir = path.join(process.env.DATA_DIR as string || '/mnt/disks/txstreet_storage');


setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks');
        const blocks = await collection.find({ chain: 'SOLANA', processed: true, txsChecked: true, broadcast: false, hash: { $ne: null } }).sort({ height: 1 }).limit(1).toArray();
        if (blocks.length < 1) return;
        const block = blocks[0];
        if (!block) return;
        console.log(`Found unprocessed block ${block.hash}`);
        await checkBlock(database, block);
    } catch (error) {
        console.error(error);
    }
}, 500).start(true);


const storeBlock = async (database: any, block: any) => {
    try {
        // Check for unconfirmed transactions in the block
        const remainingTxs = await database.collection('transactions_SOLANA').find({ confirmed: false, blockHash: block.hash }).count();
        if (remainingTxs > 0) {
            let remainingFull = await database.collection('transactions_SOLANA').find({ confirmed: false, blockHash: block.hash }).limit(20).toArray();
            for (let i = 0; i < remainingFull.length; i++) {
                const tx = remainingFull[i];
                if (tx.locked && Date.now() - tx.lockedAt > 3000) {
                    await database.collection('transactions_SOLANA').updateOne({ hash: tx.hash }, { $set: { locked: false, processed: false } });
                }
            }
            console.log(`Block ${block.hash} is still waiting on ${remainingTxs} transactions to be processed.`);
            return false;
        }

        if (!block.transactions)
            block.transactions = [];

        block.txFull = {};
        const transactions = await database.collection('transactions_SOLANA').find({ hash: { $in: block.transactions }, confirmed: true }).toArray();
        if (block.transactions && block.transactions.length > 0 && transactions.length === 0) {
            for (let i = 0; i < block.transactions.length; i++) {
                const hash = block.transactions[i];
                await database.collection('transactions_SOLANA').updateOne({
                    hash
                }, {
                    $set: {
                        blockHash: block.hash,
                        blockHeight: block.height,
                        confirmed: true,
                        processed: false,
                        locked: false
                    }
                }, { upsert: true });
            }
            return false;
        }

        transactions.forEach((transaction: any) => {
            const formatted = formatTransaction('SOLANA', transaction);
            block.txFull[formatted.tx] = formatted;
        });

        console.log(`Stored Block:`, block.hash, 'TxFull', Object.values(block.txFull).length, 'Transactions:', transactions.length, 'Block transactions:', block.transactions?.length);

        const formattedBlock: any = formatBlock('SOLANA', block);
        formattedBlock.note = 'broadcastReadyBlocks';
        const fileContents = JSON.stringify(formattedBlock);

        const firstPart = block.hash[block.hash.length - 1];
        const secondPart = block.hash[block.hash.length - 2];
        await storeObject(path.join('blocks', 'SOLANA', firstPart, secondPart, block.hash), fileContents);

        await database.collection('blocks').updateOne({ chain: 'SOLANA', hash: block.hash }, { $set: { stored: true, broadcast: false } });
        block.stored = true;
        block.broadcast = false;
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

const checkBlock = async (database: any, block: any, depth: number = 0) => {
    if (depth > 1) return true;

    try {
        if (!block.stored) {
            console.log("Block not stored - " + block.hash);
            if (!(await storeBlock(database, block)))
                return false;
        }

        let parent = null;
        if (block.parentHash && depth === 0)
            parent = await database.collection('blocks').findOne({ chain: 'SOLANA', hash: block.parentHash });

        if (parent && !parent.processed) {
            console.log("Parent is not processed.");
            return false;
        }

        if (parent) {
            if (!await checkBlock(database, parent, depth + 1))
                return false;
        }

        if (block.stored && parent?.stored || block.stored && !parent) {
            redis.publish('block', JSON.stringify({ chain: 'SOLANA', height: block.height, hash: block.hash }));
            await database.collection('blocks').updateOne({ chain: 'SOLANA', hash: block.hash }, { $set: { broadcast: true, note: 'broadcast-ready-block' } });
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
