import { BlockchainWrapper } from '../../lib/node-wrappers';
import { Logger } from '../../lib/utilities';
import redis from '../../databases/redis';
// import axios from 'axios';
// import removeBadTransactions from './remove-bad-transactions';


export default async (wrapper: BlockchainWrapper, transactions: any[]): Promise<any> => {
    try {
        var accounts: { [key: string]: boolean } = {}
        var accountValues: { [key: string]: number } = {}
        var accountCached: { [key: string]: boolean } = {}
        // var fromToTxs: any = {};

        transactions.forEach(async (transaction: any) => {
            transaction.from = transaction.from.toLowerCase();
            const key = (wrapper as any).ticker + "-nonce-" + transaction.from;
            if (!accounts[transaction.from] && !accountValues[transaction.from]) {
                let cached: any = await redis.getAsync(key);
                if (cached){
                    accountValues[transaction.from] = Number(cached);
                    accountCached[transaction.from] = true;
                }
            }
            accounts[transaction.from] = true;

            // if (!fromToTxs[transaction.from])
            //     fromToTxs[transaction.from] = [];
            // fromToTxs[transaction.from].push(transaction);
        });

        //create requests for accounts that aren't cached
        let requests: { [key: string]: any }[] = [];
        let requestsArr: Promise<number>[] = [];
        for (const account in accounts) {
            if(accountValues[account]) continue;
            let request = wrapper.getTransactionCount(account);
            requests.push({account, result: request});
            requestsArr.push(request);
            await new Promise(r => setTimeout(r, 5));
        }
       await Promise.all(requestsArr);

        requests.forEach((request : any) => {
            let account = request.account;
            let result = request.result;
            accountValues[account] = result;
            const key = (wrapper as any).ticker + "-nonce-" + account;
            if(!accountCached[account]) redis.setAsync(key, result, 'EX', 3600);
        });

        transactions.forEach(async (transaction: any) => {
            transaction.fromNonce = accountValues[transaction.from] || 0;
        });

        // for (let i = 0; i < accounts.length; i++) {
        //     const account = accounts[i];
        //     const result = Number(results[i]);
        //     fromToTxs[account].forEach((transaction: any) => {
        //         transaction.fromNonce = result;
        //     });

        // }

        // let host = (process.env.ETH_NODE as string).substring(5); 
        // host = host.substring(0, host.indexOf(':')); 
        // let response = await axios.post(`http://${host}/nonces`, { accounts }); 
        // response.data.forEach((result: any) => {
        //     fromToTxs[result.account].forEach((transaction: any) => {
        //         transaction.fromNonce = result.count;
        //     });
        // })
        console.log(transactions);
        return transactions;
    } catch (error) {
        Logger.error(error);
        return false;
    }
}
