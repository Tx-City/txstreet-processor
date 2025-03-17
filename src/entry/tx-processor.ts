// Load environment variables from .env
console.log('starting processor');
import dotenv from 'dotenv';
dotenv.config();

// Merge command line args into environment variables, overwriting values specified in .env
import minimist from 'minimist';
Object.assign(process.env, minimist(process.argv.slice(2)));

// Misc imports 
import * as Wrappers from '../lib/node-wrappers';
import processPendingTransactions from '../methods/tx-processor/process-pending-transactions';
import processConfirmedTransactions from '../methods/tx-processor/process-confirmed-transactions';

// A collection of all initialized BlockchainNode instances. 
const nodes: { [key: string]: Wrappers.BlockchainWrapper } = {};

// Iterate over blockchain implementations and initialize them if they're
const blockchainImpls = ['BTC', 'LTC', 'BCH', 'XMR', 'ETH', 'RINKEBY', 'LUKSO', 'EVOLUTION', 'ARBI', 'LUMIA', 'MANTA' , 'CELO', 'DASH', 'FLR'];
var nodesToInit: string[] = [];

// Check for command line arguments matching that of blockchain implementations 
Object.keys(process.env).forEach(key => {
    if (blockchainImpls.includes(key.toUpperCase())) {
        nodesToInit.push(key.toUpperCase());
    }
})
console.log('inside tx-processor.ts', nodesToInit);
// Non event-blocking infinite loop for processPending
const processPending = async (wrapper: Wrappers.BlockchainWrapper) => {

    try {
        await processPendingTransactions(wrapper);
        // console.log('processPendingTransactions');
    } catch (error) {
        console.error(error);
    } finally {
        process.nextTick(() => processPending(wrapper));
        // console.log('processPending');
    }
}


// Non event-blocking infinite loop for processPending
const processConfirmed = async (wrapper: Wrappers.BlockchainWrapper) => {
    // console.log('processConfirming');
    try {
        // console.log('processConfirmedTransactions being called at this point');
        await processConfirmedTransactions(wrapper);
        // console.log('processConfirmedTransactions being called at this point');
    } catch (error) {
        console.error(error);
    } finally {
        process.nextTick(() => processConfirmed(wrapper));
    }
}

// Async runner.
const run = async () => {
    if (nodesToInit.includes('BTC')) {
        console.log('running btc');

        const btcWrapper = new Wrappers.BTCWrapper(
            { username: 'user', password: 'pass', host: process.env.BTC_NODE as string, port: Number(process.env.BTC_NODE_PORT) || 8332 },
            { host: process.env.BTC_NODE as string, port: Number(process.env.BTC_NODE_ZMQPORT) || 28332 })
        if (process.env.PROCESS_PENDING == "true")
            processPending(btcWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(btcWrapper);
    }

    if (nodesToInit.includes('DASH')) {
        const dashWrapper = new Wrappers.DASHWrapper(
            { username: 'user', password: 'pass', host: process.env.DASH_NODE as string, port: Number(process.env.DASH_NODE_PORT) || 9998 },
            { host: process.env.DASH_NODE as string, port: Number(process.env.DASH_NODE_ZMQPORT) || 20009 })
        if (process.env.PROCESS_PENDING == "true")
            processPending(dashWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(dashWrapper);
    }

    if (nodesToInit.includes('BCH')) {
        const bchWrapper = new Wrappers.BCHWrapper(
            { username: 'user', password: 'pass', host: process.env.BCH_NODE as string, port: Number(process.env.BCH_NODE_PORT) },
            { host: process.env.BCH_NODE as string, port: Number(process.env.BCH_NODE_ZMQPORT) })
        if (process.env.PROCESS_PENDING == "true")
        processPending(bchWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(bchWrapper);
    }


    if (nodesToInit.includes('XMR')) {
        const xmrWrapper = new Wrappers.XMRWrapper(process.env.XMR_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            processPending(xmrWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(xmrWrapper);
    }


    if (nodesToInit.includes('LTC')) {
        const ltcWrapper = new Wrappers.LTCWrapper(
            { username: 'user', password: 'pass', host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_PORT) },
            { host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_ZMQPORT) })
        if (process.env.PROCESS_PENDING == "true")
            processPending(ltcWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(ltcWrapper);
    }

    if (nodesToInit.includes('ETH')) {
        const ethWrapper = new Wrappers.ETHWrapper(process.env.ETH_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            processPending(ethWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(ethWrapper);
    }

    if (nodesToInit.includes('LUKSO')) {
        const luksoWrapper = new Wrappers.LUKSOWrapper(process.env.LUKSO_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            processPending(luksoWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(luksoWrapper);
    }
    if (nodesToInit.includes('EVOLUTION')) {
        console.log('running evolution');
        const evolutionWrapper = new Wrappers.EVOLUTIONWrapper(process.env.EVOLUTION_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            // console.log("does it called processPending()")
            processPending(evolutionWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            // console.log("does it called processConfirmed()")
            processConfirmed(evolutionWrapper);
    }
    if (nodesToInit.includes('FLR')) {
        const flareWrapper = new Wrappers.FLAREWrapper(process.env.FLR_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            processPending(flareWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(flareWrapper);
    }

    if (nodesToInit.includes('CELO')) {
        const celoWrapper = new Wrappers.CELOWrapper(process.env.CELO_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            processPending(celoWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(celoWrapper);
    }

    if (nodesToInit.includes('RINKEBY')) {
        const rinkebyWrapper = new Wrappers.RINKEBYWrapper(process.env.RINKEBY_NODE as string);
        if (process.env.PROCESS_PENDING == "true")
            processPending(rinkebyWrapper);
        if (process.env.PROCESS_CONFIRMED == "true")
            processConfirmed(rinkebyWrapper);
    }
}

run(); 