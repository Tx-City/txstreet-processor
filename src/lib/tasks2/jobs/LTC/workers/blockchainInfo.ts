import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { LTCWrapper } from '../../../../../lib/node-wrappers';

let lastExecutionResults = {
    'blockchainSize': 0,
};

setInterval(async () => {
    try {
        const wrapper = new LTCWrapper(
            { username: 'user', password: 'pass', host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_PORT) },
            { host: process.env.LTC_NODE as string, port: Number(process.env.LTC_NODE_ZMQPORT) });
        const promise = () => new Promise((resolve) => {
            wrapper.rpc.getBlockchainInfo((err: any, resp: any) => {
                if (!resp || !resp.result) return resolve({ difficulty: '0', size: 0 });
                return resolve({
                    size: resp.result.size_on_disk / 1000000
                });
            })
        });
        const results: any = await promise();
        if (results) {
            lastExecutionResults['blockchainSize'] = results.size;
        }
    } catch (error) {
        console.error(error);
    } finally {
        // Wrapping a try/catch inside of a finally looks a little messy, but it's required to prevent a critical failure in the event
        // of a database error. We do this in finally so that we can make sure to update values that have successfully updated in the event
        // of an error.
        try {
            const { database } = await mongodb();
            const collection = database.collection('statistics');

            if (process.env.UPDATE_DATABASES.toLowerCase() == "true") {
                // TODO: Optimize to not re-insert data to lower bandwidth consumption. 
                await collection.updateOne({ chain: 'LTC' }, { $set: lastExecutionResults });
                redis.publish('stats', JSON.stringify({ chain: "LTC", ...lastExecutionResults }));
            } else {
                console.log('=========================')
                console.log(lastExecutionResults);
            }
        } catch (error) {
            console.error(error);
        }
    }
}, 5000).start(true);
