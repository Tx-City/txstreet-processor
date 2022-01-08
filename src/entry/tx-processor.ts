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
import * as Wrappers from '../lib/node-wrappers';
import processPendingTransactions from '../methods/tx-processor/process-pending-transactions'; 
import processConfirmedTransactions from '../methods/tx-processor/process-confirmed-transactions';
import { Logger } from '../lib/utilities';
import { LoggingLevel } from '../lib/utilities/functions/logger';

Logger.setLogLevel(LoggingLevel.Info);

// A collection of all initialized BlockchainNode instances. 
const nodes: { [key: string]: Wrappers.BlockchainWrapper } = {}; 

// Iterate over blockchain implementations and initialize them if they're
const blockchainImpls = ['BTC', 'LTC', 'BCH', 'XMR', 'ETH', 'RINKEBY']
var nodesToInit: string[] = []; 

// Check for command line arguments matching that of blockchain implementations 
Object.keys(process.env).forEach(key => {
    if(blockchainImpls.includes(key.toUpperCase())) {
        nodesToInit.push(key.toUpperCase()); 
    }
})

// Non event-blocking infinite loop for processPending
const processPending = async (wrapper: Wrappers.BlockchainWrapper) => {
    try {
        await processPendingTransactions(wrapper); 
    } catch (error) {
        logger(error);
    } finally {
        process.nextTick(() => processPending(wrapper));
    }
}


// Non event-blocking infinite loop for processPending
const processConfirmed = async (wrapper: Wrappers.BlockchainWrapper) => {
    try {
        await processConfirmedTransactions(wrapper); 
    } catch (error) {
        logger(error);
    } finally {
        process.nextTick(() => processConfirmed(wrapper));
    }
}

// Async runner.
const run = async () => {
    if(nodesToInit.includes('BTC')) {
        const btcWrapper = new Wrappers.BTCWrapper(
            { username: 'user', password: 'pass', host: process.env.BTC_NODE as string, port: 8332 },
            { host: process.env.BTC_NODE as string, port: 28332 })
        if(process.env.PROCESS_PENDING == "true")
            processPending(btcWrapper);
        if(process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(btcWrapper);
    }

    if(nodesToInit.includes('BCH')) {
        const bchWrapper = new Wrappers.BCHWrapper(
            { username: 'user', password: 'pass', host: process.env.BCH_NODE as string, port: 8332 },
            { host: process.env.BCH_NODE as string, port: 28332 })
        if(process.env.PROCESS_PENDING == "true")
            processPending(bchWrapper);
        if(process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(bchWrapper);
    }


    if(nodesToInit.includes('XMR')) {
        const xmrWrapper = new Wrappers.XMRWrapper(process.env.XMR_NODE as string); 
        if(process.env.PROCESS_PENDING == "true")
            processPending(xmrWrapper);
        if(process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(xmrWrapper);
    }


    if(nodesToInit.includes('LTC')) {
        const ltcWrapper = new Wrappers.LTCWrapper(
            { username: 'user', password: 'pass', host: process.env.BTC_NODE as string, port: 9332 },
            { host: process.env.BTC_NODE as string, port: 28332 })
        if(process.env.PROCESS_PENDING == "true")
            processPending(ltcWrapper);
        if(process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(ltcWrapper);
    }

    if(nodesToInit.includes('ETH')) {
        const ethWrapper = new Wrappers.ETHWrapper(process.env.ETH_NODE as string); 
        if(process.env.PROCESS_PENDING == "true")
            processPending(ethWrapper);
        if(process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(ethWrapper);
    }

    if(nodesToInit.includes('RINKEBY')) {
        const rinkebyWrapper = new Wrappers.RINKEBYWrapper(process.env.RINKEBY_NODE as string); 
        if(process.env.PROCESS_PENDING == "true")
            processPending(rinkebyWrapper);
        if(process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(rinkebyWrapper);
    }
}

run(); 