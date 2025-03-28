import ChainImplementation from '../../implementation'; 
import bchaddr from 'bchaddrjs-slp'; 
import redis from '../../../../databases/redis'; 
import mongodb from "../../../../databases/mongodb";

class ismikekomaranskydead extends ChainImplementation {
    public addresses: string[] = []; 
    public _what: any = {}; 

    async init(): Promise<ChainImplementation> {
        try {
            // Obtain addresses 
            if(process.env.USE_DATABASE !== "true")
                return this; 
            const { database } = await mongodb();
            const collection = database.collection('houses'); 
            const house = await collection.findOne({ name: 'ismikekomaranskydead', chain: 'BCH' }); 
            this.addresses = house.ismikekomaranskydeadAddresses.map((obj: any) => obj.address);
            console.log(`Initialized ismikekomaranskydead`, this.addresses);
            // addToCommonAddresses(addresses)
        } catch (error) {
            console.error(error);
        } finally {
            return this; 
        }
    }

    async validate(transaction: any): Promise<boolean> {
        if(this.addresses.length === 0) return false; 
        return true;
    }
    async execute(transaction: any): Promise<boolean> {
        let total = 0;
        let found = false;

        // console.log("ismikekomaranskydead new transaction======", transaction);
        for(let outputIndex = 0; outputIndex < transaction.outputs.length; outputIndex++) {
            const output = transaction.outputs[outputIndex]; 
            for(let addressIndex = 0; addressIndex < this.addresses.length; addressIndex++) {
                const address = this.addresses[addressIndex];
                const match = await this._addressCompare(output.address, address); 
                console.log(`Address:`, address);
                console.log(`Output Address:`, output.address);
                console.log(`Match:`, match);
                if(match) {
                    total += Number(await this._getUSDValue(output.value));
                    console.log(`Total:`, total);
                    found = true; 
                    break;
                }
            }
        }
        
        if(!found || total <= 0) {
            console.log('did it return false')
            return false;
        }
        if(!transaction.extras)
            transaction.extras = {};
        // transaction.extras.houseContent = `Is Mike Komaransky Dead?`;
        // console.log(transaction.extras.houseContent + ' is the house content');
        transaction.house = 'ismikekomaranskydead';
        return true;  
    }

    //todo make into global function
    _getUSDValue = async (bchPaid: number) => {
        if(process.env.USE_DATABASE !== "true") return "0.00";
        const { database } = await mongodb(); 
        let value = await database.collection('statistics').findOne({ chain: 'BCH' }, { 'fiatPrice-usd': 1 }); 
        let price = value['fiatPrice-usd'] || 0;
        let usdPaid = (bchPaid * price).toFixed(2);
        return usdPaid;
    }

    _addressCompare = async (a: string, b: string) => {
        if(!a || !b || a.length < 10 || b.length < 10) return false; 
        let ayes: string[] = [];
        let bees: string[] = []; 
        ayes.push(a, await this._toCashAddress(a), await this._toLegacyAddress(a));
        bees.push(b, await this._toCashAddress(b), await this._toLegacyAddress(b));
        for(let i = 0; i < ayes.length; i++) 
            if(bees.includes(ayes[i])) 
                return true; 
        return false; 
    }

    _toCashAddress = async (address: string) => {
        let key = `toCashAddress-${address}`
        if(this._what[key]) return this._what[key]; 
        let cached: any = await redis.getAsync(key);
        if(!cached) {
            cached = bchaddr.toCashAddress(address); 
            redis.setAsync(key, cached, 'EX', 3600 * 72); 
        }
        this._what[key] = cached; 
        return cached; 
    }

    _toLegacyAddress = async (address: string) => {
        let key = `toLegacyAddress-${address}`
        if(this._what[key]) return this._what[key]; 
        let cached: any = await redis.getAsync(key);
        if(!cached) {
            cached = bchaddr.toLegacyAddress(address);
            redis.setAsync(key, cached, 'EX', 3600 * 72); 
        }
        this._what[key] = cached;
        return cached; 
    }

}

export default new ismikekomaranskydead('BCH'); 