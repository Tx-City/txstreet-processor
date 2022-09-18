import ChainImplementation from '../../implementation'; 
import { Logger } from '../../../../lib/utilities';
// import redis from '../../../../databases/redis'; 
// import mongodb from "../../../../databases/mongodb";

class MWEBPeg extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        try {

        } catch (error) {
            Logger.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        // console.log(transaction);
        if(!transaction.vkern || !transaction.vkern.length) return false;
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        if (!transaction.extras)
            transaction.extras = {};

        let pegout = false;
        let isPeg = false;
        for (let i = 0; i < transaction.vkern.length; i++) {
            const vkern = transaction.vkern[i];
            if(Number(vkern.pegin) > 0) {
                pegout = false;
                isPeg = true;
            }
            if(vkern.pegout.length){
                pegout = true;
                isPeg = true;
            }
        }
        if(isPeg){
            transaction.extras.houseContent = pegout ? "MWEB Pegout" : "MWEB Pegin";
            transaction.extras[pegout?'mwebpegout':'mwebpegin'] = true;
        }
        // transaction.mweb = true;
        // transaction.extras.mweb = true;
        return true;  
    }
}

export default new MWEBPeg('LTC'); 