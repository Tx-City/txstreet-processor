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
const deleteAmount = 4;

setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection('blocks');

        const count = await collection.find({ chain }).count();
        if (isNaN(count) || count <= keepMinBlocks + deleteAmount) {
            Logger.print(`${chain} has ${count} blocks in the db. Cancel deletion.`);
            return;
        }
        const txCollection = database.collection("transactions_" + chain);
        const oldBlocks = await collection.find({ chain }).sort({ height: 1 }).limit(deleteAmount).toArray();
        for (let i = 0; i < oldBlocks.length; i++) {
            const block = oldBlocks[i];
            if(Math.round(Date.now()/1000) - Number(block.timestamp) < 90000){ //25 hours
                Logger.info("Block " + block.height + " less than 25 hours ago. Skipping deletion.")
                continue;
            }
            const transactions = block?.transactions || [];
            const txDelete = await txCollection.deleteMany({ hash: { $in: transactions } });
            Logger.print(`Deleted ${txDelete.deletedCount} of ${transactions.length} txs from block ` + block.hash);
            const blockDelete = await collection.deleteOne({ _id: block._id });
            if (blockDelete.deletedCount) {
                Logger.print(`Deleted block ` + block.hash);
            }
            else {
                Logger.error("Failed to delete block " + block.hash);
            }

            //delete block file from NFS
            if(!chainConfig[chain].storeBlockFile) return;
            const firstPart = block.hash[block.hash.length - 1];
            const secondPart = block.hash[block.hash.length - 2];
            const filePath = path.join(dataDir, 'blocks', chain, firstPart, secondPart, block.hash);
            try {
                fs.unlinkSync(filePath);
                Logger.print(`Deleted file: ` + filePath);
            } catch (err) {
                Logger.error(err);
            }
        }
    } catch (err) {
        Logger.error(err);
    }

}, 10000).start(true);


console.log("workerData", workerData);