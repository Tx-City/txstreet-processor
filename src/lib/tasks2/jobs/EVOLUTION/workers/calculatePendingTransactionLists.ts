import { formatTransaction, storeObject } from "../../../../utilities";
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import path from 'path';
import { EVOLUTIONTransactionsSchema } from "../../../../../data/schemas";
import { ProjectedEvolutionTransaction } from "../../../types";
import fs from 'fs';

const cache: any = {};

redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain } = data;
    if (chain !== 'DASH') return;
    interval.force();
});

const readFile = (path: string) => new Promise<Buffer>((resolve, reject) => {
    fs.readFile(path, (err: NodeJS.ErrnoException, data: Buffer) => {
        if (err) return reject(err);
        return resolve(data);
    })
})
console.log('Calculating EVOLUTION Pending Transactions');
const interval = setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection(`transactions_EVOLUTION`);
        // console.log('Calculating EVOLUTION Pending Transactions');
        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'EVOLUTION-pendingTransactions.bin');
        let data = await readFile(dataPath);
        let parsed = EVOLUTIONTransactionsSchema.fromBuffer(data);
        let pTransactions = parsed.collection.sort((a: ProjectedEvolutionTransaction, b: ProjectedEvolutionTransaction) => b.fee - a.fee);

        let hashes: string[] = pTransactions.map((tx: ProjectedEvolutionTransaction) => tx.hash);
        let needed: string[] = [];

        // Determine missing items in cache. 
        hashes.forEach((hash: string) => {
            if (!cache[hash])
                needed.push(hash);
        })

        // Cache needed items. 
        let results = await collection.find({ hash: { $in: needed } }).project({ hash: 1, extras: 1, total: 1 }).toArray();
        results.forEach((result: any) => {
            cache[result.hash] = result;
        })

        // Assign cache. 
        for (let i = 0; i < pTransactions.length; i++) {
            let cached = cache[pTransactions[i].hash];
            Object.assign(pTransactions[i], cached);
        }

        // Remove unused cached items
        Object.keys(cache).forEach((key: string) => {
            if (!hashes.includes(key))
                delete cache[key];
        })
        console.log('EVOLUTION Pending Transactions:', pTransactions.length);
        await storeObject(path.join('live', `pendingTxs-EVOLUTION`), JSON.stringify(pTransactions.map((tx: any) => formatTransaction('EVOLUTION', tx))));
    } catch (error) {
        console.error(error);
    }
}, 3000).start(true);