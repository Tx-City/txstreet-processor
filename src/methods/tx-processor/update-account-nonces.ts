import { BlockchainWrapper } from '../../lib/node-wrappers';
import { Logger } from '../../lib/utilities';
import redis from '../../databases/redis';


export default async (wrapper: BlockchainWrapper, transactions: any[], returnSingle = false, bypassCache = false): Promise<any> => {
    let calls = 0;
    let cachedCount = 0;
    try {
        var accounts: { [key: string]: boolean } = {}
        var accountValues: { [key: string]: number } = {}

        let cachedTasks: Promise<boolean>[] = [];
        transactions.forEach(async (transaction: any) => {
            cachedTasks.push(new Promise<boolean>(async (resolve) => {
                try {
                    transaction.from = transaction.from.toLowerCase();
                    const key = (wrapper as any).ticker + "-nonce-" + transaction.from;
                    if (!bypassCache && !accounts[transaction.from] && !accountValues[transaction.from]) {
                        let cached: any = await redis.getAsync(key);
                        if (cached) {
                            cachedCount++;
                            accountValues[transaction.from] = Number(cached);
                        }
                    }
                    accounts[transaction.from] = true;
                    return resolve(true);
                } catch (error) {
                    console.error(error);
                    return resolve(false);
                }
            }));
        });
        await Promise.all(cachedTasks);

        //create requests for accounts that aren't cached
        let requests: { [key: string]: any }[] = [];
        // let requestsArr: Promise<number>[] = [];
        for (const account in accounts) {
            if (typeof accountValues[account] !== "undefined") continue;
            let request = wrapper.getTransactionCount(account);
            calls++;
            requests.push({ account, result: request });
            // requestsArr.push(request);
            // await new Promise(r => setTimeout(r, 5));
        }
        // await Promise.all(requestsArr);

        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];

            // }
            // requests.forEach(async (request: any) => {
            let account = request.account;
            let result = await request.result;
            accountValues[account] = result;
            const key = (wrapper as any).ticker + "-nonce-" + account;
            redis.setAsync(key, result, 'EX', 3600 * 12);
        }


        transactions.forEach(async (transaction: any) => {
            transaction.fromNonce = accountValues[transaction.from] || 0;
        });

        // console.log(calls + " nonce calls", cachedCount + " cached");
        if (returnSingle) return transactions[0];
        return transactions;
    } catch (error) {
        Logger.error(error);
        return false;
    }
}
