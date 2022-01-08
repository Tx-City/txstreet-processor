import ChainImplementation from '../../implementation'; 

class Donation extends ChainImplementation {
    public mongodb: any;
    public redis: any; 

    async init(mongodb: any, redis: any): Promise<ChainImplementation> {
        this.mongodb = mongodb;
        this.redis = redis; 
        return this; 
    }

    async validate(transaction: any): Promise<boolean> {
        return transaction.to === "0xdbc7b76554556d2db77d289b18e0b6422e12f4da";
    }

    async execute(transaction: any): Promise<boolean> {
        let price = 0;
        if(process.env.USE_DATABASE) {
            const { database } = await this.mongodb(); 
            let value = await database.collection('statistics').findOne({ chain: 'ETH' }, { 'fiatPrice-usd': 1 }); 
            price = value['fiatPrice-usd'];
        }
        const ethPaid = transaction.value / Math.pow(10, 18);
        const usdPaid = (ethPaid * price).toFixed(2);
        if(!transaction.extras)
            transaction.extras = {}; 
        transaction.extras.houseContent = `I donated $${usdPaid} to TxStreet!`;
        transaction.extras.donationAmount = { coin: ethPaid, usd: usdPaid }; 
        transaction.extras.showBubble = true; 
        transaction.house = 'donation';
        return true; 
    }
}

export default new Donation('ETH'); 