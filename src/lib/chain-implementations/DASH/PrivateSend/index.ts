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
            const house = await collection.findOne({ name: 'privatesend', chain: 'DASH' }); 
            this.addresses = house.ismikekomaranskydeadAddresses.map((obj: any) => obj.address);
            console.log(`Initialized Private Send`, this.addresses);
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
        // DASH PrivateSend denominations in Duffs (1 DASH = 100,000,000 Duffs)
    const PRIVATESEND_DENOMINATIONS = [
        10000, 100000, 1000000, 10000000, 100000000
    ];
        // console.log("tx inputs======", transaction.inputs);
        // console.log("tx outputs======", transaction.outputs);  
        
         // Check if inputs equal outputs
         const totalOutputs = transaction.outputs.reduce((sum: number, output: any) => sum + output.satoshis, 0);
         console.log(`Total output: ${totalOutputs} Duffs (${totalOutputs / 100000000} DASH)`);
 
         // Check denominations with a small tolerance
         const isDenominationWithTolerance = (satoshis: number) => {
             return PRIVATESEND_DENOMINATIONS.some(denom => 
                 Math.abs(satoshis - denom) <= 100  // Allow for a small difference of up to 100 Duffs
             );
         };
 
         const validDenominations = transaction.outputs.every((output: any) => 
             isDenominationWithTolerance(output.satoshis)
         );
 
         console.log(`All denominations are close to valid PrivateSend denominations: ${validDenominations}`);
 
         // Count and log each denomination
         const denominationCounts: { [key: number]: number } = {};
         transaction.outputs.forEach((output: any) => {
             denominationCounts[output.satoshis] = (denominationCounts[output.satoshis] || 0) + 1;
         });
 
         console.log("Denomination breakdown:");
         for (const [denomination, count] of Object.entries(denominationCounts)) {
             console.log(`  ${denomination} Duffs (${Number(denomination) / 100000000} DASH): ${count} outputs`);
         }
 
         // Check if the number of inputs matches the number of outputs
         const inputsNotEqualOutputs = transaction.inputs.length != transaction.outputs.length;
         console.log(`Number of inputs equals number of outputs: ${inputsNotEqualOutputs}`);
 
         // Determine if it's likely a PrivateSend transaction
         const likelyPrivateSend = validDenominations && inputsNotEqualOutputs && transaction.inputs.length > 1;
         console.log(`Likely PrivateSend transaction: ${likelyPrivateSend}`);
         const links: any[] = []; 
         if (likelyPrivateSend) {
             console.log("likely a PrivateSend transaction");
             if(!transaction.extras) 
                transaction.extras = {};
            // transaction.extras.houseContent = `there is a cashtoken`;
            // console.log(transaction.extras.houseContent + ' is the house content');
            
            transaction.house = 'privatesend';
            links.push({l:"https://insight.dash.org/insight/tx/" + transaction.hash});
            transaction.extras.l = links;
            console.log("LINKS===",links)
            return true;
         } else {
                console.log("NOOOOOOOT a privateSend transaction");
         }
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