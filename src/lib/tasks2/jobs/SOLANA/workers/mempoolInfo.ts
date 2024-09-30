import { setInterval } from "../../../utils/OverlapProtectedInterval";
import mongodb from '../../../../../databases/mongodb';
import redis from '../../../../../databases/redisEvents';
import { Connection } from '@solana/web3.js';  // Solana web3.js

let lastExecutionResults = {
    'pending-transactions': 0,
};

// Solana connection (using mainnet-beta cluster)
const solanaConnection = new Connection(process.env.SOLANA_NODE || 'https://api.mainnet-beta.solana.com', 'confirmed');

setInterval(async () => {
    try {
        // Fetch the recent blockhash and number of transactions in the queue
        const { blockhash, feeCalculator } = await solanaConnection.getRecentBlockhash();
        const pendingTransactions = await solanaConnection.getTransactionCount('confirmed');  // Pending transactions count

        lastExecutionResults['pending-transactions'] = pendingTransactions;
    } catch (error) {
        console.error('Error fetching Solana transaction status:', error);
    } finally {
        try {
            const { database } = await mongodb();
            const collection = database.collection('statistics');

            if (process.env.UPDATE_DATABASES.toLowerCase() === "true") {
                // Update database and publish to Redis
                await collection.updateOne({ chain: 'SOLANA' }, { $set: lastExecutionResults });
                redis.publish('stats', JSON.stringify({ chain: "SOLANA", ...lastExecutionResults }));
            } else {
                console.log('=========================');
                console.log(lastExecutionResults);
            }
        } catch (error) {
            console.error('Error updating database or Redis:', error);
        }
    }
}, 1000).start(true);
