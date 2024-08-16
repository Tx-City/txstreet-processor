import ChainImplementation from '../../implementation'; 
import mongodb from "../../../../databases/mongodb";

class CashTokens extends ChainImplementation {
    public addresses: string[] = []; 
    public _what: any = {}; 

    async init(): Promise<ChainImplementation> {
        try {
            // Obtain addresses 
            if(process.env.USE_DATABASE !== "true")
                return this; 
            const { database } = await mongodb();
            const collection = database.collection('houses'); 
            const house = await collection.findOne({ name: 'cashtokens', chain: 'BCH' }); 
            // console.log(`Initialized cashtokens`, house);
            // addToCommonAddresses(addresses)
        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        let total = 0;
        let found = false;

        console.log("cashtokens transaction hash======", transaction.hash);
        
            // if (transaction?.tokenData !== undefined) {
            //   console.log('tokenData exists:', transaction.tokenData);
            //   transaction.house = 'cashtokens';
            //   return true;
            // }

            // console.log('tokenData does not exist');
            
        return true;  

    }

}

export default new CashTokens('BCH'); 