// Load environment variables from .env
import dotenv from 'dotenv';
dotenv.config();

// Merge command line args into environment variables, overwriting values specified in .env
import minimist from 'minimist';
Object.assign(process.env, minimist(process.argv.slice(2)));

// Setup the logger for this file. 
import debug from 'debug';
const logger = debug('src/index');

// Misc imports 
import processTransaction from '../methods/node-subscriber/process-transaction';
import processBlock from '../methods/node-subscriber/process-block';
import mongodb from '../databases/mongodb';
import * as Hooks from '../lib/chain-implementations';
import { Logger } from '../lib/utilities';
import redis from '../databases/redis';
if (process.env.USE_DATABASE === "true")
    mongodb();

// The chain implementations to be processed.
var chainsToSubscribe: string[] = [];

// Check for command line arguments matching that of blockchain implementations 
const blockchainImpls = ['BTC', 'LTC', 'XMR', 'BCH', 'ETH', 'RINKEBY']
Object.keys(process.env).forEach(key => {
    if (blockchainImpls.includes(key.toUpperCase())) {
        chainsToSubscribe.push(key.toUpperCase());
    }
});

// If we didn't override the value by specifying blockchains via command line arguments,
// parse the default array of blockchain implementations we're supposed to use from .env 
if (chainsToSubscribe.length == 0)
    chainsToSubscribe = JSON.parse(process.env.CHAINS).map((ticker: string) => ticker.toUpperCase());

const getLatestBlockLoop = async (wrapper: any) => {
    if (process.env.USE_DATABASE !== "true") return;
    const { database } = await mongodb();
    try {
        const height = await wrapper.getCurrentHeight();
        if (!isNaN(height) && height > 100) {
            //height is a valid number
            const heightExistsInDb = await database.collection(process.env.DB_COLLECTION_BLOCKS as string).find({ chain: wrapper.ticker, height }).project({ height: 1 }).limit(1).toArray();
            if (!heightExistsInDb || !heightExistsInDb.length) {
                const block = await wrapper.getBlock(height, 2);
                if (block) {
                    Logger.info(`Height: ${height}, block: ${block}`);


                    await database.collection(process.env.DB_COLLECTION_BLOCKS as string).updateOne(
                        { chain: wrapper.ticker, hash: block.hash },
                        { $setOnInsert: { processed: false, locked: false, timestamp: Date.now(), insertedAt: new Date(), processFailures: 0 } },
                        { upsert: true });
                }
            }

        }
        setTimeout(() => { getLatestBlockLoop(wrapper); }, 1000);
    } catch (error) {
        Logger.error(error);
        setTimeout(() => { getLatestBlockLoop(wrapper); }, 1000);
    }
}

const init = async () => {
    Logger.setLogLevel(Logger.LoggingLevel.Info);
    // let database: any = null;
    // if (process.env.USE_DATABASE === "true") {
    //     const db = await mongodb();
    //     database = db.database;
    //     await ensureIndexes();
    // }

    if (chainsToSubscribe.includes('BTC')) {
        const wrapperClass = await import("../lib/node-wrappers/BTC");
        let btcWrapper = new wrapperClass.default(
            { username: 'user', password: 'pass', host: process.env.BTC_NODE as string, port: 8332 },
            { host: process.env.BTC_NODE as string, port: 28332 });


        Hooks.initHooks('BTC', mongodb, redis);

        btcWrapper.initEventSystem();

        btcWrapper.on('mempool-tx', (transaction: any) => {
            processTransaction(btcWrapper, { ...transaction, processed: true });
        });

        btcWrapper.on('confirmed-block', (blockHash: string) => {
            processBlock(btcWrapper, blockHash);
        });

        getLatestBlockLoop(btcWrapper);
    }

    if (chainsToSubscribe.includes('BCH')) {
        const wrapperClass = await import("../lib/node-wrappers/BCH");
        let bchWrapper = new wrapperClass.default(
            { username: 'user', password: 'pass', host: process.env.BCH_NODE as string, port: 8332 },
            { host: process.env.BCH_NODE as string, port: 28332 });

        Hooks.initHooks('BCH', mongodb, redis);

        bchWrapper.initEventSystem();

        bchWrapper.on('mempool-tx', (transaction: any) => {
            processTransaction(bchWrapper, { ...transaction, processed: true });
        });

        bchWrapper.on('confirmed-block', (blockHash: string) => {
            processBlock(bchWrapper, blockHash);
        });

        getLatestBlockLoop(bchWrapper);
    }


    if (chainsToSubscribe.includes('LTC')) {
        const wrapperClass = await import("../lib/node-wrappers/LTC");
        let ltcWrapper = new wrapperClass.default(
            { username: 'user', password: 'pass', host: process.env.LTC_NODE as string, port: 9332 },
            { host: process.env.LTC_NODE as string, port: 28332 })

        Hooks.initHooks('LTC', mongodb, redis);

        ltcWrapper.initEventSystem();

        ltcWrapper.on('mempool-tx', (transaction: any) => {
            processTransaction(ltcWrapper, { ...transaction, processed: true });
        });

        ltcWrapper.on('confirmed-block', (blockHash: string) => {
            Logger.info(`Got block from event: ${blockHash}`);
            processBlock(ltcWrapper, blockHash);
        });

        getLatestBlockLoop(ltcWrapper);
    }

    if (chainsToSubscribe.includes('ETH')) {
        const wrapperClass = await import("../lib/node-wrappers/ETH");
        let ethWrapper = new wrapperClass.default(process.env.ETH_NODE as string);

        Hooks.initHooks('ETH', mongodb, redis);

        Logger.info("Imported chain implementations");

        ethWrapper.on('mempool-tx', (transaction: any) => {
            if (!transaction.blockHeight && transaction.blockNumber) {
                transaction.blockHeight = transaction.blockNumber;
                delete transaction.blockNumber;
            }
            processTransaction(ethWrapper, { ...transaction, processed: true });
        });

        ethWrapper.on('confirmed-block', (blockHash: string) => {
            Logger.info(`Got block from event: ${blockHash}`);
            processBlock(ethWrapper, blockHash);
        });

        getLatestBlockLoop(ethWrapper);

        ethWrapper.initEventSystem();

        Logger.info("Setup all event processors for chain.");

    }

    if (chainsToSubscribe.includes('XMR')) {
        const wrapperClass = await import("../lib/node-wrappers/XMR");
        let xmrWrapper = new wrapperClass.default(process.env.XMR_NODE as string);
        xmrWrapper.initEventSystem();
        xmrWrapper.on('mempool-tx', (transaction: any) => {
            processTransaction(xmrWrapper, { ...transaction, processed: true });
        });

        xmrWrapper.on('confirmed-block', (hash: any) => {
            processBlock(xmrWrapper, hash);
        });

        getLatestBlockLoop(xmrWrapper);
    }
}

init();

export const housingImplementations: any = {};