import { formatTransaction, storeObject } from "../../../../../lib/utilities";
import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import path from 'path';
import fs from 'fs';
import { EVOLUTIONTransactionsSchema } from "../../../../../data/schemas";
import { ProjectedEvolutionTransaction } from "../../../types";

// Cache for transaction metadata to reduce database queries
const cache: { [key: string]: any } = {};

// Subscribe to block events to force immediate updates when a new block is created
redis.subscribe('block');
redis.events.on('block', (data) => {
    const { chain } = data;
    if (chain !== 'EVOLUTION') return;
    interval.force();
});

// Helper function to read files
const readFile = (path: string) => new Promise<Buffer>((resolve, reject) => {
    fs.readFile(path, (err: NodeJS.ErrnoException, data: Buffer) => {
        if (err) return reject(err);
        return resolve(data);
    });
});

// Throttle control for file writes
let lastUploadTime = 0;

console.log('Initializing EVOLUTION Pending Transactions processor');

// Main processing interval
const interval = setInterval(async () => {
    try {
        const { database } = await mongodb();
        const collection = database.collection(`transactions_EVOLUTION`);
        
        // Read the binary pending transactions file
        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'EVOLUTION-pendingTransactions.bin');
        let data = await readFile(dataPath);
        let parsed = EVOLUTIONTransactionsSchema.fromBuffer(data);
        
        // Parse any JSON strings in the transaction data
        for (let i = 0; i < parsed.collection.length; i++) {
            const entry = parsed.collection[i];
            if (entry.extras && typeof entry.extras === "string") {
                try {
                    entry.extras = JSON.parse(entry.extras);
                } catch (error) {
                    // Keep as string if parse fails
                }
            }
            if (entry.pExtras && typeof entry.pExtras === "string") {
                try {
                    entry.pExtras = JSON.parse(entry.pExtras);
                } catch (error) {
                    // Keep as string if parse fails
                }
            }
        }
        
        // Sort transactions by fee (higher fees first)
        let pTransactions = parsed.collection.sort(
            (a: ProjectedEvolutionTransaction, b: ProjectedEvolutionTransaction) => 
                b.gasUsed - a.gasUsed
        );
        
        // Extract transaction hashes
        let hashes: string[] = pTransactions.map((tx: ProjectedEvolutionTransaction) => tx.hash);
        let needed: string[] = [];
        
        // Determine which transactions need to be fetched from the database
        hashes.forEach((hash: string) => {
            if (!cache[hash]) {
                needed.push(hash);
            }
        });
        
        // Fetch needed transaction metadata from database
        if (needed.length > 0) {
            let results = await collection.find({ hash: { $in: needed } })
                .project({ 
                    hash: 1, 
                    extras: 1, 
                    total: 1,
                    to: 1,
                    house: 1 
                })
                .toArray();
                
            // Update cache with fetched data
            results.forEach((result: any) => {
                cache[result.hash] = result;
            });
        }
        
        // Enrich transactions with cached metadata
        for (let i = 0; i < pTransactions.length; i++) {
            let cached = cache[pTransactions[i].hash];
            if (cached) {
                Object.assign(pTransactions[i], cached);
            }
        }
        
        // Remove confirmed transactions from the list
        let confirmedTransactions = await collection.find(
            { hash: { $in: hashes }, blockHash: { $ne: null } }
        ).project({ hash: 1 }).toArray();
        
        let confirmedHashes = confirmedTransactions.map((tx: any) => tx.hash);
        pTransactions = pTransactions.filter((tx: any) => !confirmedHashes.includes(tx.hash));
        
        // Clean up cache - remove transactions no longer in the pending list
        Object.keys(cache).forEach((key: string) => {
            if (!hashes.includes(key) || confirmedHashes.includes(key)) {
                delete cache[key];
            }
        });
        
        // Format transactions for frontend consumption
        let formattedTransactions = pTransactions.map((tx: any) => 
            formatTransaction('EVOLUTION', tx)
        );
        
        console.log('EVOLUTION Pending Transactions:', formattedTransactions.length);
        
        // Store the formatted transactions - throttle writes to reduce disk I/O
        if (Date.now() - lastUploadTime >= 1990) {
            const content = JSON.stringify(formattedTransactions);
            
            // Write to both the JSON file and the storage object
            const filePath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'EVOLUTION-pendingTransactions.json');
            const writingFilePath = filePath.replace(/\.json$/, '-writing.json');
            fs.writeFileSync(writingFilePath, content);
            fs.rename(writingFilePath, filePath, (err) => {
                if (err) throw err;
            });
            
            lastUploadTime = Date.now();
            await storeObject(path.join('live', `pendingTxs-EVOLUTION`), content);
        }
    } catch (error) {
        console.error('Error processing EVOLUTION pending transactions:', error);
    }
}, 3000).start(true);


















