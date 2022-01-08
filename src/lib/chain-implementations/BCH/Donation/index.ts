import ChainImplementation from '../../implementation'; 

class Donation extends ChainImplementation {
    public donationAddress: string = "bitcoincash:qpyuhug3xvcg4lpp2d8edymd75peh8rd6yg3mhn3p5";
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
        if(process.env.USE_DATABASE === "true") {
            const { database } = await this.mongodb(); 
            let value = await database.collection('statistics').findOne({ chain: 'BCH' }, { 'fiatPrice-usd': 1 }); 
            price = value['fiatPrice-usd'];
        }

        for(let i = 0; i < transaction.outputs.length; i++) {
            if(transaction.outputs[i].address !== this.donationAddress) continue; 
            let bchPaid = transaction.outputs[i].value;
            let usdPaid = (bchPaid * price).toFixed(2);

            if(!transaction.extras)
                transaction.extras = {}; 
            transaction.extras.houseContent = `I donated $${usdPaid} to TxStreet!`;
            transaction.extras.donationAmount = { coin: bchPaid, usd: usdPaid }; 
            transaction.extras.showBubble = true; 
            transaction.house = 'donation';
        }
        return true; 
    }
}

export default new Donation('BCH'); 