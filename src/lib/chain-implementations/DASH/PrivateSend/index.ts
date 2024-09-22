import ChainImplementation from '../../implementation';
import mongodb from "../../../../databases/mongodb";
import fetch from 'node-fetch';

interface Input {
    prevTxId: string;
    // Add other properties of the input object if needed
}

interface Output {
    satoshis: number;
    // Add other properties of the output object if needed
}

class PrivateSend extends ChainImplementation {
    public addresses: string[] = [];
    public _what: any = {};
    private rpcUrl: string = 'http://65.109.115.131:9998';
    private rpcUser: string = 'user';
    private rpcPass: string = 'pass';
    private PRIVATESEND_DENOMINATIONS = [
        10000, 100000, 1000000, 10000000, 100000000
    ];

    async init(): Promise<ChainImplementation> {
        try {
            // Obtain addresses 
            
            if(process.env.USE_DATABASE !== "true")
                return this; 
            const { database } = await mongodb();
            const collection = database.collection('houses'); 
            const house = await collection.findOne({ name: 'privatesend', chain: 'DASH' }); 
            console.log('DASH PRIVATE SEND HOUSE')
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
        // console.log("tx inputs for PRIVATE SEND======", transaction.inputs);
        // console.log("tx outputs for PRIVATE SEND======", transaction.outputs); 
        console.log("tx for PRIVATE SEND======", transaction.hash); 

        let privateSendInputCount = 0;

        // Check each input's previous transaction
        for (const input of transaction.inputs) {
            try {
                const rawTx = await this.getRawTransaction(input.prevTxId);
                console.log(`Raw transaction for prevTxId ${input.prevTxId}:`, rawTx);
                
                // Parse the raw transaction
                const parsedTx = await this.decodeRawTransaction(rawTx);
                
                // Check if the previous transaction's outputs are PrivateSend denominations
                if (this.isPrivateSendTransaction(parsedTx)) {
                    privateSendInputCount++;
                    console.log(`Previous transaction ${input.prevTxId} is likely a PrivateSend transaction.`);
                } else {
                    console.log(`Previous transaction ${input.prevTxId} is not a PrivateSend transaction.`);
                }
            } catch (error) {
                console.error(`Failed to process previous transaction for prevTxId ${input.prevTxId}:`, error);
            }
        }

        console.log(`Number of PrivateSend inputs: ${privateSendInputCount}`);

        const totalOutputs = transaction.outputs.reduce((sum: number, output: Output) => sum + output.satoshis, 0);
        console.log(`Total outputs: ${totalOutputs} Duffs (${totalOutputs / 100000000} DASH)`);

        const inputsNotEqualOutputs = transaction.inputs.length !== transaction.outputs.length;
        console.log(`Inputs equal outputs: ${inputsNotEqualOutputs}`);
        const likelyPrivateSend = inputsNotEqualOutputs && privateSendInputCount > 0;
        console.log(`Likely PrivateSend transaction: ${likelyPrivateSend}`);
        
        if (likelyPrivateSend) {
            console.log("For sure a PrivateSend transaction");
            if(!transaction.extras) 
                transaction.extras = {};
            transaction.house = 'privatesend';
            const links = [{l: `https://insight.dash.org/insight/tx/${transaction.hash}`}];
            transaction.extras.l = links;
            console.log("LINKS===", links);
            return true;
        } else {
            console.log("NOOOOOOOT a privateSend transaction");
            return false;
        }
    }

    private isPrivateSendTransaction(transaction: any): boolean {
        // if (!transaction || !Array.isArray(transaction.vout)) {
        //     console.log("Transaction structure is not as expected:", transaction);
        //     return false;
        // }
        return transaction.vout.every((output: any) => {
            if (!output || typeof output.value !== 'number') {
                console.log("Output structure is not as expected:", output);
                return false;
            }
            const satoshis = Math.round(output.value * 100000000); // Convert DASH to satoshis
            return this.isDenominationWithTolerance(satoshis);
        });
    }

    private isDenominationWithTolerance(satoshis: number): boolean {
        return this.PRIVATESEND_DENOMINATIONS.some(denom => 
            Math.abs(satoshis - denom) <= 100
        );
    }

    private async getRawTransaction(txid: string): Promise<string> {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from(this.rpcUser + ":" + this.rpcPass).toString('base64'),
            'Content-Type': 'application/json'
        };

        const body = JSON.stringify({
            jsonrpc: "1.0",
            id: "curltest",
            method: "getrawtransaction",
            params: [txid, false]
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
    
            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`);
            }

            return data.result;
        } catch (error) {
            console.error('There was an error fetching the raw transaction!', error);
            throw error;
        }
    }

    private async decodeRawTransaction(rawTx: string): Promise<any> {
        const headers = {
            'Authorization': 'Basic ' + Buffer.from(this.rpcUser + ":" + this.rpcPass).toString('base64'),
            'Content-Type': 'application/json'
        };

        const body = JSON.stringify({
            jsonrpc: "1.0",
            id: "curltest",
            method: "decoderawtransaction",
            params: [rawTx]
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
    
            if (data.error) {
                throw new Error(`RPC error: ${data.error.message}`);
            }

            return data.result;
        } catch (error) {
            console.error('There was an error decoding the raw transaction!', error);
            throw error;
        }
    }
}

export default new PrivateSend('DASH');