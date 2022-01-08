import ChainImplementation from '../../implementation'; 

class Donation extends ChainImplementation {
    public donationAddress: string = "MN42cQVeBCrhGquUzVWEz7cESxg6dq8MjC";
    public mongodb: any;
    public redis: any; 

    async init(mongodb: any, redis: any): Promise<ChainImplementation> {
        this.mongodb = mongodb;
        this.redis = redis; 
        return this; 
    }

    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        let price = 0;
        if(process.env.USE_DATABASE) {
            const { database } = await this.mongodb(); 
            let value = await database.collection('statistics').findOne({ chain: 'LTC' }, { 'fiatPrice-usd': 1 }); 
            price = value['fiatPrice-usd'];
        }

        for(let i = 0; i < transaction.outputs.length; i++) {
            if(transaction.outputs[i].address !== this.donationAddress) continue; 
            let ltcPaid = transaction.outputs[i].value;
            let usdPaid = (ltcPaid * price).toFixed(2);

            if(!transaction.extras)
                transaction.extras = {}; 
            transaction.extras.houseContent = `I donated $${usdPaid} to TxStreet!`;
            transaction.extras.donationAmount = { coin: ltcPaid, usd: usdPaid }; 
            transaction.extras.showBubble = true; 
            transaction.house = 'donation';
        }
        return true; 
    }
}

export default new Donation('LTC'); 