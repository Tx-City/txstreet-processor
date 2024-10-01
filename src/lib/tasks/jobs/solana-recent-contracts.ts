import { storeObject } from '../../../lib/utilities';
import mongodb from '../../../databases/mongodb';
import Bottleneck from 'bottleneck';
import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import path from 'path';

const limiter = new Bottleneck({
    maxConcurrent: 1,
    minTime: 201
});

const SOLANA_RPC_URL = process.env.SOLANA_NODE || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL);

export default async (chain: string, label: string, timeFrom: number): Promise<void> => {
    try {
        const { database } = await mongodb();
        const txCollection = database.collection(`transactions_${chain}`);

        const time = Date.now();
        const results = await txCollection.aggregate([
            { $match: { contract: true, insertedAt: { $gte: new Date(timeFrom) } } },
            { $group: { _id: "$to", txCount: { $sum: 1 } } },
            { $sort: { txCount: -1 } },
            { $limit: 100 },
            { $lookup: { from: 'contracts_SOLANA', localField: '_id', foreignField: 'contract', as: 'contracts' } },
            { $project: { _id: 1, txCount: 1, contract: { $first: "$contracts" } } },
            { $project: { 
                _id: 1,
                txCount: 1,
                contract: 1,
                nameless: 1,
                lastChecked: 1,
                weightedTransactions: {
                    $add: [
                        "$txCount", 
                        { $ifNull: ["$contract.weight", 0] }
                    ]
                } 
            } },
            { $sort: { weightedTransactions: - 1 } },
            { $limit: 10 }
        ]).toArray();
        
        console.log('Took', Date.now() - time, 'ms on label', label, 'returned', results.length); 

        // ForEach results where .contract is null, obtain information from Solana RPC or third-party API
        let solanaTasks: any[] = [];
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (!result.contract || result.nameless || (result?.lastChecked && Date.now() - result.lastChecked > 300000)) {
                const promise = limiter.schedule(async () => {
                    try {
                        const publicKey = new PublicKey(result._id);
                        // Fetch data from Solana RPC or use a third-party service to get contract details
                        let response = await connection.getAccountInfo(publicKey);
                        if (response) {
                            const contract: any = {
                                contract: result._id,
                                name: result._id, // Adjust based on actual data fetched
                                lastChecked: Date.now(),
                                weight: 0, // Set weight or metadata as needed
                            };

                            // Add deployment info and other necessary details (if available)
                            contract.lastUpdated = new Date();
                            result.contract = contract;
                            await database.collection(`contracts_${chain}`).updateOne({ contract: result._id }, { $set: contract }, { upsert: true });
                            return contract;
                        } else {
                            return null;
                        }
                    } catch (error) {
                        console.error(error);
                    }
                });
                solanaTasks.push(promise);
            }
        }

        await Promise.all(solanaTasks);

        // Assign weight based on position in the result
        let bulk: any[] = [];
        for (let i = 0; i < results.length; i++) {
            let result = results[i];
            let weight = i <= 3 ? -0.03 : i <= 6 ? -0.02 : -0.01;
            bulk.push({
                updateOne: {
                    filter: { contract: result._id },
                    update: { $inc: { weight }, $set: { lastUpdated: new Date() } }
                }
            });
        }

        if (bulk.length > 0)
            await database.collection(`contracts_${chain}`).bulkWrite(bulk);

        // Adjust weight for contracts not in the top results
        const exclude = results.map((result: any) => result._id);
        await database.collection(`contracts_${chain}`).updateMany({ contract: { $nin: exclude }, weight: { $lte: -0.01 } }, { $inc: { weight: 0.01 } });

        // Prepare final sorted values
        let values = results.map((result: any) => ({
            hash: result._id,
            transactions: result.txCount,
            weightedTransactions: result.weightedTransactions,
            contract: {
                name: result.contract.name,
                weight: result.contract.weight,
                deployedOn: result.contract.deployedOn,
                deployedWith: result.contract.deployedWith
            }
        }));

        values = values.sort((a: any, b: any) => b.weightedTransactions - a.weightedTransactions);
        await storeObject(path.join('live', `trending-contracts-${chain}-${label}`), JSON.stringify(values));
    } catch (error) {
        console.error(error);
    }
};
