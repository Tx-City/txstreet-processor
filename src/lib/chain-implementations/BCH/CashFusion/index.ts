import ChainImplementation from '../../implementation'; 
import { Logger } from '../../../../lib/utilities';

class CashFusion extends ChainImplementation {

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
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        for(let i = 0; i < transaction.asmArrays.length; i++) {
            const asmArray = transaction.asmArrays[i];
            const op_return = asmArray[0] === "OP_RETURN";
            if(!op_return) continue 

            const code = asmArray[1]; 
            if(code === "46555a00") {
                if(!transaction.extras)
                    transaction.extras = {};
                transaction.extras.houseTween = "shuffle"; 
                transaction.house = "cashfusion"; 
                break;
            }
        }
        return true; 
    }
}

export default new CashFusion('BCH'); 