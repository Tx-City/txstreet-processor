import fs from 'fs';
import path from 'path';
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import { ETHBlocksSchema, SOLANATransactionsSchema, ETHTransactionsSchema } from '../../../../../data/schemas';
import { ProjectedSolanaBlock, ProjectedSolanaTransaction } from "../../../types";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import tps from '../../common/tps';
import medianBlockTime from '../../common/medianBlockTime';
import medianTxsPerBlock from '../../common/medianTxsPerBlock';
import blockHeight from '../../common/blockHeight';

// The last value(s) calculated during the execution of this task. 
let lastExecutionResults = {
    'tps': 0,
    'blockHeight': 0,
    'medianBlockTime': 0,
    'medianTxsPerBlock': 0,
    'medianFee-usd': 0,
}; 

let lastKnownBlock: ProjectedSolanaBlock = null;

redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain } = data;
    if(chain !== 'SOLANA') return;
    interval.force();
});

const interval = setInterval(async () => {
    try {
        // Initialize connection to the database 
        const { database } = await mongodb();

        const initTasks: Promise<void>[] = [];

        let pricePerIncrement = 0;
        let transactions: ProjectedSolanaTransaction[] = [];
        let blocks: ProjectedSolanaBlock[] = [];
        let last250Blocks: ProjectedSolanaBlock[] = [];

        // Create the task to obtain the current Solana price. 
        initTasks.push(new Promise((resolve, reject) => {
            database.collection('statistics').findOne({ chain: 'SOLANA' }, { fiatPrice: 1 })
                .then((document: any) => {
                    pricePerIncrement = document['fiatPrice-usd'] / 1000000000; // 1 SOL = 1 billion lamports
                    return resolve();
                })
                .catch(reject);
        }));

        // Create the task to load the Solana transactions collection from disk.
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'transactions-SOLANA.bin');
            fs.readFile(dataPath, (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err);

                try {
                    let parsed = ETHTransactionsSchema.fromBuffer(data);

                    // Filter transactions in the last 5 minutes
                    const now = Date.now();
                    const upperRange = now - 1000; 
                    const lowerRange = now - (1000 * 60 * 5) - 1000;

                    transactions = parsed.collection.filter((transaction: ProjectedSolanaTransaction) =>
                        transaction.insertedAt >= lowerRange && transaction.insertedAt <= upperRange
                    ).sort((a: any, b: any) => a.insertedAt - b.insertedAt);
                    return resolve();
                } catch (error) {
                    console.error(error);
                    return reject(error);
                }
            });
        }));

        // Create the task to load the Solana blocks collection from disk.
        initTasks.push(new Promise((resolve, reject) => {
            const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'blocks-SOLANA.bin');
            fs.readFile(dataPath, (err: NodeJS.ErrnoException, data: Buffer) => {
                if(err) return reject(err);

                try {
                    let parsed = ETHBlocksSchema.fromBuffer(data);

                    // Filter blocks in the last hour
                    const now = Math.floor(Date.now() / 1000);
                    const upperRange = Number(`${now - 1}000`);
                    const lowerRange = Number(`${now - (60 * 60) - 1}000`);

                    last250Blocks = parsed.collection.sort((a: any, b: any) => a.height - b.height).slice(0, 250);

                    blocks = parsed.collection.filter((block: ProjectedSolanaBlock) =>
                        block.timestamp >= lowerRange && block.timestamp <= upperRange
                    ).sort((a: any, b: any) => a.height - b.height);

                    lastKnownBlock = blocks[blocks.length - 1];
                    return resolve();
                } catch (error) {
                    console.error(error);
                    return reject(error);
                }
            });
        }));

        await Promise.all(initTasks);

        // Execute the various tasks for block and transaction metrics
        try { lastExecutionResults['tps'] = await tps(transactions); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianBlockTime'] = await medianBlockTime(last250Blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['medianTxsPerBlock'] = await medianTxsPerBlock(blocks); } catch (error) { console.error(error); };
        try { lastExecutionResults['blockHeight'] = await blockHeight(lastKnownBlock); } catch (error) { console.error(error); };

        // Example: Calculate transaction fees (in lamports) converted to USD
        try {
            const totalFeeLamports = transactions.reduce((sum, tx) => sum + tx.fee, 0);
            lastExecutionResults['medianFee-usd'] = totalFeeLamports * pricePerIncrement;
        } catch (error) { console.error(error); }

    } catch (error) {
        console.error(error);
    } finally {
        try {
            const { database } = await mongodb();
            const collection = database.collection('statistics');

            if(process.env.UPDATE_DATABASES.toLowerCase() == "true") {
                await collection.updateOne({ chain: 'SOLANA' }, { $set: lastExecutionResults });
                redis.publish('stats', JSON.stringify({ chain: "SOLANA", ...lastExecutionResults }));
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }

        } catch (error) {
            console.error(error);
        }
    }
}, 1000).start(true);
