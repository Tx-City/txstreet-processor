import ChainImplementation from '../../implementation'; 
import redis from '../../../../databases/redis'; 
// @ts-ignore-line
// import abiDecoder from 'abi-decoder'; 
// import axios from 'axios';

// import contract_0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f from "./0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f.json";

class Lumia extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        try {
            console.log('initialized lumia sequencer');
        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        return transaction.from.toLowerCase() === "0x8f2d2da3044b0a1ea54ee26f7fe376cd9ec4393f" && transaction.to.toLowerCase() === "0x92726f7de49300dbdb60930066bc1d0803c0740b";
    }

    async execute(transaction: any): Promise<boolean> {
        if(transaction.house === "lumia") return true;
        transaction.house = 'lumia'; //ALWAYS SET!
        if(!transaction.extras) transaction.extras = {};
        transaction.extras.mailman = true;

        //send redis event for this hash
        redis.publish('lumiaRollup', JSON.stringify({hash: transaction.hash}));


        // if(getData(this, transaction) && !transaction?.extras?.showBubble) {
        //     transaction.extras.showBubble = false;
        // }
        return true;
    }
}

export default new Lumia("ETH");