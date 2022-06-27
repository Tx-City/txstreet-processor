import ChainImplementation from '../../implementation'; 
import { Logger, decRound } from '../../../../lib/utilities';
import redis from '../../../../databases/redis'; 
// @ts-ignore-line
// import abiDecoder from 'abi-decoder'; 
// import axios from 'axios';

// import contract_0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f from "./0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f.json";

class Arbitrum extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        try {
            console.log('initialized arbitrum sequencer');
        } catch (error) {
            Logger.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        return transaction.from.toLowerCase() === "0xa4b10ac61e79ea1e150df70b8dda53391928fd14" && transaction.to.toLowerCase() === "0x4c6f947ae67f572afa4ae0730947de7c874f95ef";
    }

    async execute(transaction: any): Promise<boolean> {
        if(transaction.house === "arbitrum") return true;
        transaction.house = 'arbitrum'; //ALWAYS SET!
        if(!transaction.extras) transaction.extras = {};
        transaction.extras.mailman = true;

        //send redis event for this hash
        redis.publish('arbiRollup', JSON.stringify({hash: transaction.hash}));


        // if(getData(this, transaction) && !transaction?.extras?.showBubble) {
        //     transaction.extras.showBubble = false;
        // }
        return true;
    }
}

export default new Arbitrum("ETH");