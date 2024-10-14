import { BlockchainWrapper } from "../../lib/node-wrappers";
import redis from "../../databases/redis";
import axios from "axios";

let globalWrapper: BlockchainWrapper = null;

function setAccountValue(accountValues: any, account: string, value: number) {
  accountValues[account] = value;
  const key = (globalWrapper as any).ticker + "-nonce-" + account;
  redis.setAsync(key, value, "EX", 3600);
}

export default async (
  wrapper: BlockchainWrapper,
  transactions: any[],
  returnSingle = false,
  bypassCache = false,
  bulkApi = Boolean(process.env.USE_BULK_API)
): Promise<any> => {
  globalWrapper = wrapper;
  let calls = 0;
  let cachedCount = 0;
  try {
    var accounts: { [key: string]: boolean } = {};
    var accountValues: { [key: string]: number } = {};

    let cachedTasks: Promise<boolean>[] = [];
    transactions.forEach(async (transaction: any) => {
      cachedTasks.push(
        new Promise<boolean>(async (resolve) => {
          try {
            transaction.from = transaction.from.toLowerCase();
            const key = (wrapper as any).ticker + "-nonce-" + transaction.from;

            if (
              !bypassCache &&
              !accounts[transaction.from] &&
              !accountValues[transaction.from]
            ) {
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
        })
      );
    });
    await Promise.all(cachedTasks);
    const lxy = (wrapper as any).ticker;

    // switch (lxy) {
    //     case "ETH":
    //         const url = new URL(process.env.ETH_NODE);
    //         console.log(`http://${url.hostname}/nonces`);
    //         let response = await axios.post(`http://${url.hostname}:81/nonces`, { accounts: Object.keys(accounts) });
    //         response.data.forEach((result: any) => {
    //             setAccountValue(accountValues, result.account, result.count);
    //         });
    //         break;
    //     case "LUKSO":
    //         console.log("BULK API IS NOT ENABLED FOR LUKSO")
    //         //create requests for accounts that aren't cached
    //         let requests: { [key: string]: any }[] = [];
    //         // let requestsArr: Promise<number>[] = [];
    //         for (const account in accounts) {
    //             if (typeof accountValues[account] !== "undefined") continue;
    //             let request = wrapper.getTransactionCount(account);
    //             calls++;
    //             requests.push({ account, result: request });
    //             // requestsArr.push(request);
    //             // await new Promise(r => setTimeout(r, 5));
    //         }
    //         // await Promise.all(requestsArr);

    //         for (let i = 0; i < requests.length; i++) {
    //             const request = requests[i];
    //             let result = await request.result;
    //             setAccountValue(accountValues, request.account, result);
    //         }
    //         break;
    //     case "CELO":
    //         let requests1: { [key: string]: any }[] = [];
    //         // let requestsArr: Promise<number>[] = [];
    //         for (const account in accounts) {
    //             if (typeof accountValues[account] !== "undefined") continue;
    //             let request = wrapper.getTransactionCount(account);
    //             calls++;
    //             requests.push({ account, result: request });
    //             // requestsArr.push(request);
    //             // await new Promise(r => setTimeout(r, 5));
    //         }
    //         // await Promise.all(requestsArr);

    //         for (let i = 0; i < requests.length; i++) {
    //             const request = requests[i];
    //             let result = await request.result;
    //             setAccountValue(accountValues, request.account, result);
    //         }
    //         break;
    //     default:
    //         console.log("default");
    //         break;
    // }
    // if (bulkApi && ( lxy != "LUKSO" || lxy != "CELO")) {
    if (bulkApi && lxy == "ETH") {
      const url = new URL(process.env.ETH_NODE);
      console.log(111112222);
      console.log(`http://${url.hostname}/nonces`);
      let response = await axios.post(`http://${url.hostname}:81/nonces`, {
        accounts: Object.keys(accounts),
      });
      response.data.forEach((result: any) => {
        setAccountValue(accountValues, result.account, result.count);
      });
    } else if (lxy == "LUKSO") {
      console.log("BULK API IS NOT ENABLED FOR LUKSO");
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
        let result = await request.result;
        setAccountValue(accountValues, request.account, result);
      }
    } else if (lxy == "CELO") {
      console.log("BULK API IS NOT ENABLED FOR CELO");
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
        let result = await request.result;
        setAccountValue(accountValues, request.account, result);
      }
    }

    // TODO: TON
    /*else if (lxy == "TON") {
            console.log("BULK API IS NOT ENABLED FOR TON")
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
                let result = await request.result;
                setAccountValue(accountValues, request.account, result);
            }   
        }*/

    transactions.forEach(async (transaction: any) => {
      transaction.fromNonce = accountValues[transaction.from] || 0;
    });

    // console.log(calls + " nonce calls", cachedCount + " cached");
    if (returnSingle) return transactions[0];
    return transactions;
  } catch (error) {
    console.error(error);
    return false;
  }
};
