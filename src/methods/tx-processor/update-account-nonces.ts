import { BlockchainWrapper } from '../../lib/node-wrappers';
import { Logger } from '../../lib/utilities';
import axios from 'axios';

export default async (wrapper: BlockchainWrapper, transactions: any[]): Promise<any> => {
    try {
        var accounts: string[] = [];
        var fromToTxs: any = {};

        transactions.forEach((transaction: any) => {
            transaction.from = transaction.from.toLowerCase()
            if(!fromToTxs[transaction.from])
                fromToTxs[transaction.from] = [];
            fromToTxs[transaction.from].push(transaction);
            if(!accounts.includes(transaction))
                accounts.push(transaction.from); 
        });

        let host = (process.env.ETH_NODE as string).substring(5); 
        host = host.substring(0, host.indexOf(':')); 
        let response = await axios.post(`http://${host}/nonces`, { accounts }); 
        response.data.forEach((result: any) => {
            fromToTxs[result.account].forEach((transaction: any) => {
                transaction.fromNonce = result.count;
            });
        })

        return transactions;
    } catch (error) {
        Logger.error(error);
        return false;
    }
}

const test = {
    
}


