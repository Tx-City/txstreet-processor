import ChainImplementation from '../../implementation'; 

class CashFusion extends ChainImplementation {

    async init(): Promise<ChainImplementation> {
        return this;
    }

    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        // console.log(`CashFusion Transaction:`, transaction);    
        for(let i = 0; i < transaction.asmArrays.length; i++) {
            // console.log(`CashFusion Transaction.asmArrays:`, transaction.asmArrays);
            const asmArray = transaction.asmArrays[i];
            const op_return = asmArray[0] === "OP_RETURN";
            if(!op_return) continue 
            console.log(`Code:`, asmArray[1]);
            const code = asmArray[1]; 
            if(code === "46555a00") {
                console.log(`CashFusion Detected`);
                console.log(`Transaction:`, transaction); 
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