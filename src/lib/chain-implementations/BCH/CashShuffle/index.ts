import ChainImplementation from '../../implementation'; 
import { Logger } from '../../../../lib/utilities';

class CashShuffle extends ChainImplementation {

    public mongodb: any;
    public redis: any; 

    async init(mongodb: any, redis: any): Promise<ChainImplementation> {
        try {
            this.mongodb = mongodb;
            this.redis = redis; 

        } catch (error) {
            Logger.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        if(transaction.inputs.length < 3) return false;
        if(transaction.outputs.length < 5) return false;
        if(transaction.outputs.length < transaction.inputs.length) return false; 
        if(transaction.outputs.length != (transaction.inputs.length * 2) - 1) return false; 
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        const identical = this._identicalOutputs(transaction.outputs);
        for(const value in identical) {
            let count = identical[value];
            if(count < 3 || count != transaction.inputs.length) continue; 
            if(!transaction.extras)
                transaction.extras = {};
            transaction.extras.houseTween = "shuffle";
            transaction.house = "cashshuffle"; 
        }
        return true; 
    }

    smallestOutput(outputs: any[], minimum:number=10270){
        let smallest = 2100000000000000;
        for (let i = 0; i < outputs.length; i++) {
            let output = outputs[i];
            if(output.value < minimum) continue;
            if(output.value < smallest) smallest = output.value;
        }
        return smallest;
    }

    _identicalOutputs(outputs: any[]){
        let identical: any = {};
        for (let i = 0; i < outputs.length; i++) {
            let output = outputs[i];
            if(!output.value) continue;
            if(typeof identical[output.value] === "undefined") identical[output.value] = 0;
            identical[output.value]++;
        }
        return identical;
    }

}

export default new CashShuffle('BCH'); 