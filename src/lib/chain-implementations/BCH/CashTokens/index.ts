import ChainImplementation from '../../implementation';
import mongodb from "../../../../databases/mongodb";
import fetch from 'node-fetch';

class CashTokens extends ChainImplementation {
    public addresses: string[] = [];
    public _what: any = {};
    private rpcUrl: string = 'http://65.109.115.131:8332';
    private rpcUser: string = 'user';
    private rpcPass: string = 'pass';

    async init(): Promise<ChainImplementation> {
        try {
            if (process.env.USE_DATABASE !== "true")
                return this;
            const { database } = await mongodb();
            const collection = database.collection('houses');
            const house = await collection.findOne({ name: 'cashtokens', chain: 'BCH' });
            console.log(`Initialized CASHTOKEN HOUSE`, house);
            
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
        const hash = transaction.hash;

        try {
            const links: any[] = []; 
            const transactionData = await this.getRawTransaction(hash);
            console.log("Raw transaction data:", transactionData);
            // Process the transaction data as needed
            if (transactionData && transactionData.vout) {
                for (const output of transactionData.vout) {
                    if (output.tokenData) {
                        console.log("has inside cashtoken");
                        if(!transaction.extras) 
                            transaction.extras = {};
                        // transaction.extras.houseContent = `there is a cashtoken`;
                        // console.log(transaction.extras.houseContent + ' is the house content');
                        
                        transaction.house = 'cashtokens';
                        links.push({l:"https://explorer.salemkode.com/tx/" + transaction.hash});
                        transaction.extras.l = links;
                        console.log("LINKS===",links)
                        return true;
                        break;  // We found a cashtoken, no need to continue checking
                    } else  {
                        console.log("NO cashtoken");
                        return false;
                    }
                }
            }
           

        } catch (error) {
            console.error("Error fetching raw transaction:", error);
            return false;
        }
       
    }

    private async getRawTransaction(txid: string): Promise<any> {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from(this.rpcUser + ":" + this.rpcPass).toString('base64'),
            'Content-Type': 'application/json'
        };

        const body = JSON.stringify({
            jsonrpc: "1.0",
            id: "curltest",
            method: "getrawtransaction",
            params: [txid, 2]
        });

        try {
            const response = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: headers,
                body: body
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
    
            return data.result;
        } catch (error) {
            console.error('There was an error fetching the raw transaction!', error);
            throw error;
        }
    }
}

export default new CashTokens('BCH');