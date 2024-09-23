import ChainImplementation from '../../implementation'; 
import mongodb from "../../../../databases/mongodb";

class CoinJoin extends ChainImplementation {
    public addresses: string[] = []; 
    public _what: any = {}; 
    
    async init(): Promise<ChainImplementation> {
        try {
            console.log('DASH HOUSES')
            // Obtain addresses 
            if(process.env.USE_DATABASE !== "true")
                return this; 
            const { database } = await mongodb();
            const collection = database.collection('houses'); 
            const house = await collection.findOne({ name: 'coinjoin', chain: 'DASH' }); 
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
        // DASH PrivateSend denominations in Duffs (1 DASH = 100,000,000 Duffs)
    
        const PRIVATESEND_DENOMINATIONS = [
        10000, 100000, 1000000, 10000000, 100000000, 1000000000, 10000000000
    ];
        // console.log("tx inputs for COINJOIN======", transaction.inputs);
        // console.log("tx outputs for COINJOIN======", transaction.outputs);  
        console.log("tx for COINJOIN======");  
         // Check if inputs equal outputs
         const totalOutputs = transaction.outputs.reduce((sum: number, output: any) => sum + output.satoshis, 0);
        //  console.log(`Total output: ${totalOutputs} Duffs (${totalOutputs / 100000000} DASH)`);
 
         // Check denominations with a small tolerance
         const isDenominationWithTolerance = (satoshis: number) => {
             return PRIVATESEND_DENOMINATIONS.some(denom => 
                 Math.abs(satoshis - denom) <= 100  // Allow for a small difference of up to 100 Duffs
             );
         };
 
         const validDenominations = transaction.outputs.every((output: any) => 
             isDenominationWithTolerance(output.satoshis)
         );
 
        //  console.log(`All denominations are close to valid PrivateSend denominations: ${validDenominations}`);
 
         // Count and log each denomination
         const denominationCounts: { [key: number]: number } = {};
         transaction.outputs.forEach((output: any) => {
             denominationCounts[output.satoshis] = (denominationCounts[output.satoshis] || 0) + 1;
         });
 
        //  console.log("Denomination breakdown:");
         for (const [denomination, count] of Object.entries(denominationCounts)) {
            //  console.log(`  ${denomination} Duffs (${Number(denomination) / 100000000} DASH): ${count} outputs`);
         }
 
         // Check if the number of inputs matches the number of outputs
         const inputsEqualOutputs = transaction.inputs.length === transaction.outputs.length;
        //  console.log(`Number of inputs equals number of outputs: ${inputsEqualOutputs}`);
 
         // Determine if it's likely a PrivateSend transaction
         const likelyPrivateSend = validDenominations && inputsEqualOutputs && transaction.inputs.length > 1;
        //  console.log(`Likely PrivateSend transaction: ${likelyPrivateSend}`);
         const links: any[] = []; 
         if (likelyPrivateSend) {
            //  console.log("likely a coinjoin transaction");
             if(!transaction.extras) 
                transaction.extras = {};
            // transaction.extras.houseContent = `there is a cashtoken`;
            // console.log(transaction.extras.houseContent + ' is the house content');
            
            transaction.house = 'coinjoin';
            links.push({l:"https://insight.dash.org/insight/tx/" + transaction.hash});
            transaction.extras.l = links;
            // transaction.char = 'flash';
            transaction.extras.flash = true;
            // console.log("LINKS===",links)
            return true;
         } else {
                // console.log("NOOOOOOOT a coinjoin transaction");
         }
    }

}

export default new CoinJoin('DASH'); 