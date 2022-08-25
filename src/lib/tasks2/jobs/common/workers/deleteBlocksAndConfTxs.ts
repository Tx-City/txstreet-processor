const { workerData } = require('worker_threads');
import mongodb from '../../../../../databases/mongodb';
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import { Logger } from '../../../../../lib/utilities';
import { chainConfig } from "../../../../../data/chains";
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.env.DATA_DIR as string || '/mnt/disks/txstreet_storage');
const chain: string = workerData.chain;
const keepMinBlocks = 300;

setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks');

        const count = await collection.find({ chain }).count();
        if (isNaN(count) || count <= keepMinBlocks + (chainConfig[chain].deleteBlocksAmount || 4)) {
            Logger.print(`${chain} has ${count} blocks in the db. Cancel deletion.`);
            return;
        }
        const oldBlocks = await collection.find({ chain }).project({ _id: 1, timestamp: 1, height: 1, hash: 1, transactions: 1 }).sort({ height: 1 }).limit(chainConfig[chain].deleteBlocksAmount || 4).toArray();
        for (let i = 0; i < oldBlocks.length; i++) {
            const block = oldBlocks[i];
            let timestamp = Number(block.timestamp);
            if(timestamp > 9999999999) timestamp /= 1000;
            let now = Math.round(Date.now() / 1000);
            if (now - timestamp < (chainConfig[chain].deleteBlocksOlderThanSeconds || 90000)) { //25 hours
                Logger.info("Block " + block.height + " less than " + (chainConfig[chain].deleteBlocksOlderThanSeconds || 90000) + " seconds ago. Skipping deletion.", now, timestamp, now - timestamp);
                continue;
            }
            const transactions = block?.transactions || [];
            if (chainConfig[chain].txsCollection) {
                const txCollection = database.collection("transactions_" + chain);
                const txDelete = await txCollection.deleteMany({ hash: { $in: transactions } });
                Logger.print(`Deleted ${txDelete.deletedCount} of ${transactions.length} txs from block ` + block.hash);
            }
            const blockDelete = await collection.deleteOne({ _id: block._id });
            if (blockDelete.deletedCount) {
                Logger.print(`Deleted block ` + block.hash);
            }
            else {
                Logger.error("Failed to delete block " + block.hash);
            }

            //delete block file from NFS
            // if (!chainConfig[chain].storeBlockFile) continue;
            // const firstPart = block.hash[block.hash.length - 1];
            // const secondPart = block.hash[block.hash.length - 2];
            // const filePath = path.join(dataDir, 'blocks', chain, firstPart, secondPart, block.hash);
            // try {
            //     fs.unlinkSync(filePath);
            //     Logger.print(`Deleted file: ` + filePath);
            // } catch (err) {
            //     Logger.error(err);
            // }
        }
    } catch (err) {
        Logger.error(err);
    }

}, 10000).start(true);


console.log("workerData", workerData);