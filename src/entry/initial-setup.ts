// Load environment variables from .env
import dotenv from 'dotenv';
dotenv.config();

import mongodb from '../databases/mongodb';
// import fs from 'fs';
// import path from 'path';

// Merge command line args into environment variables, overwriting values specified in .env
import minimist from 'minimist';
Object.assign(process.env, minimist(process.argv.slice(2)));


const createIndexes = async (): Promise<boolean> => {
    try {
        console.log("starting indexes");
        if (process.env.USE_DATABASE !== "true")
            return true;

        const { database } = await mongodb();

        const existingCollections: any = await database.listCollections().toArray();
        const existingCollectionNames = existingCollections.map((c: any) => c.name);

        const collectionNames: string[] = ['transactions_BTC', 'transactions_ETH', 'transactions_LUKSO', 'transactions_DASH', 'transactions_EVOLUTION','transactions_FLR', 'transactions_CELO', 'transactions_LTC', 'transactions_BCH', 'transactions_XMR', 'blocks', 'contracts_ETH', 'moonhead_owners', 'statistics', 'statistics_history', 'statistics_history_snapshots'];
        for (let i = 0; i < collectionNames.length; i++) {
            const name = collectionNames[i];
            if (existingCollectionNames.includes(name)) continue;
            await database.createCollection(name);
        }

        const txCollections: any[] = [
            database.collection('transactions_BTC'),
            database.collection('transactions_DASH'),
            database.collection('transactions_ETH'),
            database.collection('transactions_LUKSO'),
            database.collection('transactions_EVOLUTION'),
            database.collection('transactions_FLR'),
            database.collection('transactions_CELO'),
            database.collection('transactions_ARBI'),
            database.collection('transactions_LUMIA'),
            database.collection('transactions_MANTA'),
            database.collection('transactions_LTC'),
            database.collection('transactions_BCH'),
            database.collection('transactions_XMR')];

        // try { await database.collection('account_nonces').createIndex({ account: 1, chain: 1 }, { name: 'account_chain' }); } catch (e) { console.log(e) }
        try { await database.collection('blocks').createIndex({ chain: 1, broadcast: 1, stored: 1, height: 1 }, { name: 'chain_broadcast_stored_height' }); } catch (e) { console.log(e) }
        try { await database.collection('blocks').createIndex({ chain: 1, processed: 1, timestamp: 1 }, { name: 'chain_processed_timestamp' }); } catch (e) { console.log(e) }
        try { await database.collection('blocks').createIndex({ chain: 1, hash: 1 }, { name: 'chain_hash', unique: true, partialFilterExpression: { hash: { $type: "string" } } }); } catch (e) { console.log(e) }
        try { await database.collection('blocks').createIndex({ insertedAt: 1 }, { name: 'time_to_live', expireAfterSeconds: 1209600 }); } catch (e) { console.log(e) }
        try { await database.collection('blocks').createIndex({ chain: 1, transactions: 1 }, { name: 'chain_transactions' }); } catch (e) { console.log(e) }

        try { await database.collection('contracts_ETH').createIndex({ contract: 1 }, { name: 'contract_1', unique: true }); } catch (e) { console.log(e) }
        try { await database.collection('contracts_ETH').createIndex({ lastUpdated: 1 }, { name: 'TTL_lastUpdated', expireAfterSeconds: 604800 }); } catch (e) { console.log(e) }

        try { await database.collection('moonhead_owners').createIndex({ address: 1 }, { name: 'address' }); } catch (e) { console.log(e) }
        try { await database.collection('moonhead_owners').createIndex({ tokenId: 1 }, { name: 'tokenId' }); } catch (e) { console.log(e) }

        try { await database.collection('statistics').createIndex({ chain: 1 }, { name: 'chain', unique: true }); } catch (e) { console.log(e) }

        try { await database.collection('statistics').updateOne({ "chain": "ETH" }, { $setOnInsert: { "chain": "ETH" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "LUKSO" }, { $setOnInsert: { "chain": "LUKSO" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "EVOLUTION" }, { $setOnInsert: { "chain": "EVOLUTION" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "FLR" }, { $setOnInsert: { "chain": "FLR" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "CELO" }, { $setOnInsert: { "chain": "CELO" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "ARBI" }, { $setOnInsert: { "chain": "ARBI" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "LUMIA" }, { $setOnInsert: { "chain": "LUMIA" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "MANTA" }, { $setOnInsert: { "chain": "MANTA" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "ETH-nohistory" }, { $setOnInsert: { "chain": "ETH-nohistory" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "LUKSO-nohistory" }, { $setOnInsert: { "chain": "LUKSO-nohistory" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "EVOLUTION-nohistory" }, { $setOnInsert: { "chain": "EVOLUTION-nohistory" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "FLR-nohistory" }, { $setOnInsert: { "chain": "FLR-nohistory" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "CELO-nohistory" }, { $setOnInsert: { "chain": "CELO-nohistory" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "BTC" }, { $setOnInsert: { "chain": "BTC" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "DASH" }, { $setOnInsert: { "chain": "DASH" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "BCH" }, { $setOnInsert: { "chain": "BCH" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "XMR" }, { $setOnInsert: { "chain": "XMR" } }, { upsert: true }) } catch (e) { console.log(e) }
        try { await database.collection('statistics').updateOne({ "chain": "LTC" }, { $setOnInsert: { "chain": "LTC" } }, { upsert: true }) } catch (e) { console.log(e) }

        try { await database.collection('statistics_history').createIndex({ chain: 1, interval: 1, created: -1 }, { name: 'chain_interval_created' }); } catch (e) { console.log(e) }
        try { await database.collection('statistics_history').createIndex({ expires: 1 }, { name: 'TTL', expireAfterSeconds: 0 }); } catch (e) { console.log(e) }

        try { await database.collection('statistics_history_snapshots').createIndex({ chain: 1, interval: 1 }, { name: 'chain_interval' }); } catch (e) { console.log(e) }

        try { await database.collection('transactions_BTC').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, dropped: 1, fee: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_DASH').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, dropped: 1, fee: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_LTC').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, dropped: 1, fee: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_BCH').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, dropped: 1, fee: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_ETH').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, lastProcessed: -1, dropped: 1, pendingSortPrice: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ contract: 1, to: 1, timestamp: -1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_ETH').createIndex({ contract: 1, insertedAt: -1, to: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_ETH').createIndex({ from: 1, nonce: 1 }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ house: 1, insertedAt: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_ETH').createIndex({ lastInsert: 1 }, { name: 'TTL_lastInsert', expireAfterSeconds: 86400, partialFilterExpression: { "confirmed": false } }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_ETH').createIndex({ confirmed: 1, processed: 1, locked: 1, blockHeight: 1, lastProcessed: 1, timestamp: 1, processFailures: 1, dropped: 1 }, { name: 'general_purpose' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ from: 1 }, { name: 'from' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ to: 1 }, { name: 'to' }); } catch (e) { console.log(e) }
        
        //LUKSO
        try { await database.collection('transactions_LUKSO').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, lastProcessed: -1, dropped: 1, pendingSortPrice: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ contract: 1, to: 1, timestamp: -1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_LUKSO').createIndex({ contract: 1, insertedAt: -1, to: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_LUKSO').createIndex({ from: 1, nonce: 1 }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ house: 1, insertedAt: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_LUKSO').createIndex({ lastInsert: 1 }, { name: 'TTL_lastInsert', expireAfterSeconds: 86400, partialFilterExpression: { "confirmed": false } }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_LUKSO').createIndex({ confirmed: 1, processed: 1, locked: 1, blockHeight: 1, lastProcessed: 1, timestamp: 1, processFailures: 1, dropped: 1 }, { name: 'general_purpose' }); } catch (e) { console.log(e) }

        //EVOLUTION
        try { await database.collection('transactions_EVOLUTION').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, lastProcessed: -1, dropped: 1, pendingSortPrice: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ contract: 1, to: 1, timestamp: -1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_EVOLUTION').createIndex({ contract: 1, insertedAt: -1, to: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_EVOLUTION').createIndex({ from: 1, nonce: 1 }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ house: 1, insertedAt: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_EVOLUTION').createIndex({ lastInsert: 1 }, { name: 'TTL_lastInsert', expireAfterSeconds: 86400, partialFilterExpression: { "confirmed": false } }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_EVOLUTION').createIndex({ confirmed: 1, processed: 1, locked: 1, blockHeight: 1, lastProcessed: 1, timestamp: 1, processFailures: 1, dropped: 1 }, { name: 'general_purpose' }); } catch (e) { console.log(e) }

        //FLR
        try { await database.collection('transactions_FLR').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, lastProcessed: -1, dropped: 1, pendingSortPrice: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ contract: 1, to: 1, timestamp: -1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_FLR').createIndex({ contract: 1, insertedAt: -1, to: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_FLR').createIndex({ from: 1, nonce: 1 }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ house: 1, insertedAt: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_FLR').createIndex({ lastInsert: 1 }, { name: 'TTL_lastInsert', expireAfterSeconds: 86400, partialFilterExpression: { "confirmed": false } }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_FLR').createIndex({ confirmed: 1, processed: 1, locked: 1, blockHeight: 1, lastProcessed: 1, timestamp: 1, processFailures: 1, dropped: 1 }, { name: 'general_purpose' }); } catch (e) { console.log(e) }
        
        //CELO
        try { await database.collection('transactions_CELO').createIndex({ confirmed: 1, processed: 1, blockHeight: 1, lastProcessed: -1, dropped: 1, pendingSortPrice: -1 }, { name: 'pending_txlist' }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ contract: 1, to: 1, timestamp: -1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_CELO').createIndex({ contract: 1, insertedAt: -1, to: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_CELO').createIndex({ from: 1, nonce: 1 }); } catch (e) { console.log(e) }
        // try { await database.collection('transactions_ETH').createIndex({ house: 1, insertedAt: 1 }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_CELO').createIndex({ lastInsert: 1 }, { name: 'TTL_lastInsert', expireAfterSeconds: 86400, partialFilterExpression: { "confirmed": false } }); } catch (e) { console.log(e) }
        try { await database.collection('transactions_CELO').createIndex({ confirmed: 1, processed: 1, locked: 1, blockHeight: 1, lastProcessed: 1, timestamp: 1, processFailures: 1, dropped: 1 }, { name: 'general_purpose' }); } catch (e) { console.log(e) }

        for (let i = 0; i < txCollections.length; i++) {
            let collection = txCollections[i];
            try { await collection.createIndex({ hash: 1 }, { name: 'hash', unique: true }); } catch (e) { console.log(e) }
            // try { await collection.createIndex({ house: 1 }, { name: 'house' }); } catch (e) { console.log(e) }
            try { await collection.createIndex({ locked: 1, processed: 1, processFailures: 1, dropped: 1 }); } catch (e) { console.log(e) }
            try { await collection.createIndex({ house: 1, timestamp: -1, insertedAt: 1 }); } catch (e) { console.log(e) }
            try { await collection.createIndex({ locked: 1, processed: 1, lockedAt: 1, processFailures: 1 }); } catch (e) { console.log(e) }
            try { await collection.createIndex({ processed: 1, insertedAt: 1 }); } catch (e) { console.log(e) }
            // try { await collection.createIndex({ processed: 1, timestamp: 1 }); } catch (e) { console.log(e) }
            try { await collection.createIndex({ blockHash: 1, confirmed: 1, dropped: 1 }); } catch (e) { console.log(e) }
            try { await collection.createIndex({ insertedAt: 1 }, { name: 'TTL', expireAfterSeconds: 1209600 }); } catch (e) { console.log(e) }

        }
        console.log("end indexes");
        return true;
    } catch (error) {
        console.log(error);
        return true;
    }
}

// const createDirectories = async (): Promise<boolean> => {
//     console.log("starting directories");
//     const dataDir = path.join(process.env.DATA_DIR as string || '/mnt/disks/txstreet_storage');

//     try { await fs.promises.mkdir(dataDir, { recursive: true }); } catch (e) { console.log(e) }
//     try { await fs.promises.mkdir(path.join(dataDir, "live"), { recursive: true }); } catch (e) { console.log(e) }
//     try { await fs.promises.mkdir(path.join(dataDir, "f", "houses"), { recursive: true }); } catch (e) { console.log(e) }
//     try { await fs.promises.mkdir(path.join(dataDir, "f", "misc"), { recursive: true }); } catch (e) { console.log(e) }
//     try { await fs.promises.mkdir(path.join(dataDir, "f", "wiki"), { recursive: true }); } catch (e) { console.log(e) }
//     try { await fs.promises.mkdir(path.join(dataDir, "blocks"), { recursive: true }); } catch (e) { console.log(e) }
//     console.log("end directories");
//     return true;
// }

(async () => {
    await createIndexes();
    // await createDirectories();
    process.exit(1);
})();
