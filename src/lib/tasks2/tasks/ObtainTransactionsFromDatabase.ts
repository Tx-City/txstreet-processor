import mongodb from '../../../databases/mongodb';
import OverlapProtectedInterval from "../utils/OverlapProtectedInterval";
import DropoutContainer from '../containers/Dropout';
import { setTimeout } from 'timers';

export default class ObtainTransactionsFromDatabase extends OverlapProtectedInterval {
    _lastKnownItemTimestamp: number = 0; 
    _done: boolean = false; 

    constructor(chain: string, transactions: DropoutContainer<any>) {
        super(async () => {
            try { 
                // console.log(`ObtainTransactionsFromDatabase executing for chain: ${chain}`);
                
                // Initialize the database. 
                const { database } = await mongodb(); 
                // Create a reference to the database transactions collection. 
                const collection = database.collection(`transactions_${chain}`);

                const where = {
                    processed: true, 
                    insertedAt: { $gt: this._lastKnownItemTimestamp === 0 ? new Date(Date.now() - (((1000 * 60) * 60) * 1)) : new Date(this._lastKnownItemTimestamp) } };

                // console.log(`Transaction query for ${chain}:`, JSON.stringify(where));

                let project: any = {};
                switch(chain) {
                    case 'ETH':
                        project = { _id: 0, processed: 1, insertedAt: 1, gas: 1, gasPrice: 1, maxFeePerGas: 1, dropped: 1, hash: 1, from: 1, timestamp: 1 };
                        break;
                    case 'LUKSO':
                        project = { _id: 0, processed: 1, insertedAt: 1, gas: 1, gasPrice: 1, maxFeePerGas: 1, dropped: 1, hash: 1, from: 1, timestamp: 1 };
                        break;
                    case 'EVOLUTION':
                        // Match exactly with schema fields
                        project = { _id: 0, hash: 1, owner: 1, insertedAt: 1, timestamp: 1, fee: 1, value: 1, gasUsed: 1 };
                        break;
                    case 'FLR':
                        project = { _id: 0, processed: 1, insertedAt: 1, gas: 1, gasPrice: 1, maxFeePerGas: 1, dropped: 1, hash: 1, from: 1, timestamp: 1 };
                        break;
                    case 'CELO':
                        project = { _id: 0, processed: 1, insertedAt: 1, gas: 1, gasPrice: 1, maxFeePerGas: 1, dropped: 1, hash: 1, from: 1, timestamp: 1 };
                        break;
                    case 'XMR': 
                        project = { _id: 0, hash: 1, processed: 1, fee: 1, size: 1, dropped: 1, timestamp: 1, insertedAt: 1 }
                        break;
                    case 'BTC': 
                    case 'DASH':
                        project = { _id: 0, hash: 1, processed: 1, fee: 1, size: 1, dropped: 1, timestamp: 1, insertedAt: 1, rsize: 1 }
                        break;
                    case 'LTC': 
                    case 'BCH': 
                        project = { _id: 0, hash: 1, processed: 1, fee: 1, size: 1, dropped: 1, timestamp: 1, insertedAt: 1, rsize: 1 }
                        break;
                }

                let results = await collection.find(where).project(project).toArray();
                // console.log("Sample transaction:", JSON.stringify(results[0], null, 2));
                // console.log(`Found ${results.length} transactions for ${chain}`);

                if(results.length > 0) {
                    // Convert insertedAt to timestamp for all chains
                    for(let i = 0; i < results.length; i++) {
                        if (results[i].insertedAt instanceof Date) {
                            results[i].insertedAt = results[i].insertedAt.getTime();
                        }
                        if(!results[i].timestamp) {
                            results[i].timestamp = results[i].insertedAt || Date.now();
                        }
                    }

                    // Special handling for EVOLUTION transactions
                    if(chain === 'EVOLUTION') {
                        console.log(`Processing ${results.length} EVOLUTION transactions to ensure schema compatibility`);
                        
                        // Add missing fields with default values if needed
                        for(let i = 0; i < results.length; i++) {
                            // String fields
                            if(results[i].hash === undefined || results[i].hash === null) {
                                results[i].hash = "";
                            }
                            if(results[i].owner === undefined || results[i].owner === null) {
                                results[i].owner = "";
                            }
                            
                            // Long fields
                            if(results[i].insertedAt === undefined || results[i].insertedAt === null) {
                                results[i].insertedAt = Date.now();
                            }
                            if(results[i].timestamp === undefined || results[i].timestamp === null) {
                                results[i].timestamp = Date.now();
                            }
                            if(results[i].gasUsed === undefined || results[i].gasUsed === null) {
                                results[i].gasUsed = 0;
                            }
                            
                            // Double fields
                            if(results[i].fee === undefined || results[i].fee === null) {
                                results[i].fee = 0.0;
                            }
                            if(results[i].value === undefined || results[i].value === null) {
                                results[i].value = 0.0;
                            }
                        }
                        
                        if(results.length > 0) {
                            console.log("First EVOLUTION transaction after processing:", JSON.stringify(results[0], null, 2));
                        }
                    }

                    transactions.insert(results); 
                    const latest = results.sort((a: any, b: any) => a.insertedAt - b.insertedAt)[results.length - 1]; 
                    this._lastKnownItemTimestamp = latest.insertedAt; 
                }
                this._done = true;
            } catch (error) {
                console.error("Error in ObtainTransactionsFromDatabase:", error); 
            }
        }, 250); 
    }

    waitForFirstCompletion = () => new Promise((resolve) => {
        const checkFlag = (): void => {
            if(this._done) return resolve(1);
            setTimeout(() => checkFlag(), 50);
        }
        checkFlag(); 
    })
}