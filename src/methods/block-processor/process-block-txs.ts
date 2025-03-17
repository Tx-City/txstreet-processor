import { BlockchainWrapper } from '../../lib/node-wrappers';
import { waitForTime, formatBlock } from '../../lib/utilities';

import unlockRequest from './unlock-request';
import { formatTransaction } from '../../lib/utilities';
import redis from '../../databases/redisEvents';
import mongodb from "../../databases/mongodb";
import callChainHooks from '../../lib/chain-implementations';

const getRequests = async (chain: string): Promise<[] | null> => {
    // console.log("ttttttttttt process-block-txs.ts");
    // Get a reference to the database collection, setup collections & sessions for transactions. 
    const { connection, database } = await mongodb();
    const collection = database.collection('blocks');
    let session = connection.startSession();

    try {
        // The result which we're going to return from the transaction.
        var results: any = null;

        // Use a transaction here to lock the request so that other nodes can't get it by issuing 
        // an 'in-the-middle' query.
        await session.withTransaction(async () => {
            // Find any unprocessed request. 
            results = await collection.find({ chain, locked: false, processed: false, lastInserted: { $gte: (Date.now() - 60000) } }, { session, sort: { lastInserted: 1 } }).limit(50).toArray();

            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                await collection.updateOne({ _id: result._id }, { $set: { locked: true } }, { session });
            }
        });

        return results;
    } catch (error) {
        console.error(error);
        return null;
    } finally {
        await session.endSession();
    }
}

const action = async (wrapper: BlockchainWrapper): Promise<void> => {
    console.log("tx tx tx tx process-block-txs.ts");
    let request: any = null;
    try {
        // The database key of the identifying property for this request.
        // This is usually the hash, but if a user-generated request supplies a height it can change.
        let databaseKey = 'hash';

        // Obtain the block id (hash or height) to process if once was not provided
        const requests = await getRequests(wrapper.ticker);

        if (!Array.isArray(requests)) return;
        for (let i = 0; i < requests.length; i++) {
            (async () => {


                let block: any = requests[i];
                const blockId: any = block.hash || block.number;
                let resolvedBlock = await wrapper.getBlock(blockId, 2);

                // The exists field is appended to ensure that the execution flow is stopped in the event of an error
                // that has already been logged by the localized log in the blockchain implementation.
                if (!resolvedBlock) {
                    console.warn(`Could not get block for hash in process-block-txssss ${blockId} results: ${resolvedBlock}`)
                    await unlockRequest(wrapper.ticker, blockId as string);
                    return await waitForTime(100);
                }

                block = { ...resolvedBlock, ...block };

                let transactions: any[] = block.transactions;
                if (block.transactions?.length && typeof block.transactions[0] === 'object') {
                    block.transactions = block.transactions.map((tx: any) => tx.hash);
                }
                // Store the block in the database 
                // await storeBlockDatabase(wrapper.ticker, block, databaseKey);

                const differences: any[] = [];
                block.txFull = {};

                const transactionPromises: any = [];
                transactions.forEach((transaction: any) => {
                    transactionPromises.push(new Promise(async (resolve) => {
                        await callChainHooks(wrapper.ticker, transaction);
                        const formatted = formatTransaction(wrapper.ticker, transaction);
                        block.txFull[formatted.tx] = formatted;
                        resolve(true);
                    }));
                });
                await Promise.all(transactionPromises);

                block.transactionsFull = transactions;

                const { database } = await mongodb();
                const formatted: any = formatBlock(wrapper.ticker, block);

                console.log("broadcasting: " + block.height);
                redis.publish('block', JSON.stringify({ chain: wrapper.ticker, height: block.height, hash: block.hash, block: formatted }));

                database.collection('blocks').updateOne({ chain: wrapper.ticker, hash: block.hash }, { $set: { ...block, processed: true, broadcast: true, txsChecked: true, locked: false, note: '[block-processor]: store-block-db', stored: false } }, { upsert: true });
            })();
        }
    } catch (error) {
        if (request && request.hash)
            await unlockRequest(wrapper.ticker, request.hash);
        console.error(error);
    }
}


// This function handles Phase 1 of fulfilling a request to process a block.
// Phase 2 is started inside of the redis message callback when a transaction processor
// responds that a blocks transactions have been completely processed. You can find the
// callback that registers this in src/index 
export default async (wrapper: BlockchainWrapper, blockId: string | number = null, depth: number = 0, searchRequest: boolean = true): Promise<void> => {
    await action(wrapper);
}