import path from 'path';
import redis from '../../../databases/redis'; 
import mongodb from '../../../databases/mongodb';
import { Connection, PublicKey } from '@solana/web3.js';

enum ExecutionType {
    Large,
    Small,
    Custom
}

var _currentExecutionType: ExecutionType = ExecutionType.Large; 

const getExecutionType = (): ExecutionType => {
    if(_currentExecutionType === ExecutionType.Large) 
        _currentExecutionType = ExecutionType.Small;
    else if(_currentExecutionType === ExecutionType.Small)
        _currentExecutionType = ExecutionType.Large;
    return _currentExecutionType;
}

const getQueryForExecutionType = (chain: string, executionType: ExecutionType): any => {
    let where: any = {};
    let project: any = {};
    let limit: number = 0;
    let sort: any = null; 
    let fifteenSeconds = Date.now() - (1000 * 15 * 1); 

    switch(executionType) {
        case ExecutionType.Custom:
            where = { processed: true, confirmed: false, slot: { $eq: null }, lastProcessed: { $lte: fifteenSeconds }, dropped: { $exists: false } }; 
            project = { _id: 0, hash: 1 };
            limit = 25;
            sort = { pendingSortPrice: -1 };  
            return { where, project, limit, sort };
        case ExecutionType.Large:
            return [
                {
                    $match: {
                        confirmed: false,
                        processed: true,
                        slot: {
                            $eq: null
                        },
                        dropped: { $exists: false }
                    }
                }, 
                { $sort: { pendingSortPrice: -1 } }, 
                { $limit: 20000 },
                { $sort: { lastProcessed: 1 } }, 
                { $limit: 150 },
                { $project: { _id: 0, hash: 1 } }
            ];
        case ExecutionType.Small:
            where = { processed: true, confirmed: false, slot: { $eq: null }, dropped: { $exists: false } };
            project = { _id: 0, hash: 1 }; 
            limit = 150;
            sort = { lastProcessed: 1 };
            return { where, project, limit, sort };  
    }
}

export default async (chain: string): Promise<void> => {
    try {
        const solanaConnection = new Connection(process.env.SOLANA_RPC_URL as string);
        const { database } = await mongodb();
        const collection = database.collection('transactions_' + chain || ''); 

        const executionType = getExecutionType(); 
        const queryInstructions = getQueryForExecutionType(chain, executionType);

        let query = null; 
        if (executionType == ExecutionType.Large) {
            query = collection.aggregate(queryInstructions); 
        } else {
            query = collection.find(queryInstructions.where, queryInstructions.project);
            if(Object.keys(queryInstructions.sort).length) query = query.sort(queryInstructions.sort); 
            if(queryInstructions.limit) query = query.limit(queryInstructions.limit); 
            if(queryInstructions.skip) query = query.skip(queryInstructions.skip);
        }
        
        const transactions = await query.toArray(); 
        if(transactions.length === 0) return; 

        const solanaTxPromises: Promise<any>[] = []; 
        transactions.forEach((transaction: any) => {
            solanaTxPromises.push(new Promise(async (resolve) => {
                try {
                    const nodeTx = await solanaConnection.getConfirmedTransaction(transaction.hash);
                    return resolve({ hash: transaction.hash, nodeTx }); 
                } catch (error) {
                    console.error(error);
                    return resolve({ hash: transaction.hash, nodeTx: null }); 
                }
            }));
        });

        const results = await Promise.all(solanaTxPromises); 
        const writeInstructions: any[] = [];
        const deleteTxHashes: any[] = [];
        const checkSlots: number[] = []; 
        const now = Date.now(); 

        results.forEach(({ hash, nodeTx }) => {
            if (nodeTx) {
                if (nodeTx.slot && !checkSlots.includes(nodeTx.slot)) 
                    checkSlots.push(nodeTx.slot);

                let set = { lastProcessed: now, confirmed: false };
                if (nodeTx.slot) {
                    set.confirmed = true;
                    deleteTxHashes.push(hash);
                }

                writeInstructions.push({
                    updateOne: {
                        filter: { hash },
                        update: { $set: set }
                    } 
                });
            } else {
                deleteTxHashes.push(hash);
                writeInstructions.push({
                    updateOne: {
                        filter: { hash },
                        update: { $set: { dropped: true } }
                    }
                }); 
            }
        });

        if(writeInstructions.length > 0) {
            console.log("solana bad tx removing " + deleteTxHashes.length, ExecutionType[_currentExecutionType]);
            redis.publish('removeTx', JSON.stringify({ chain, hashes: deleteTxHashes })); 
            await collection.bulkWrite(writeInstructions); 
        }

        const blockInstructions: any[] = []; 
        if(checkSlots.length > 0) {
            const blockTasks: Promise<any>[] = [];
            checkSlots.forEach((slot: number) => {
                blockTasks.push(new Promise(async (resolve) => {
                    try {
                        const dbBlock = await database.collection(`blocks`).findOne({ chain, slot }); 
                        if(!dbBlock) {
                            blockInstructions.push({
                                updateOne: {
                                    filter: { chain, slot },
                                    update: { $set: { processed: false, locked: false, note: '[cronjob]: solana-remove-bad-txs' },  $setOnInsert: { timestamp: Date.now(), insertedAt: new Date(), lastInsert: new Date(), processFailures: 0, processMetadata: true, processTransactions: true } },
                                    upsert: true 
                                }  
                            });
                        }
                    } catch (error) {
                        resolve(1); 
                    }
                }));
            });

            await Promise.all(blockTasks); 
            if(blockInstructions.length)
                await database.collection(`blocks`).bulkWrite(blockInstructions); 
        }

    } catch (error) {
        console.error(error);
    }
}
