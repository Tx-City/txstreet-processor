import mongodb from '../../../databases/mongodb';
import OverlapProtectedInterval from "../utils/OverlapProtectedInterval";
import DropoutContainer from '../containers/Dropout';
import { setTimeout } from 'timers';

export default class ObtainBlocksFromDatabase extends OverlapProtectedInterval {
    _lastKnownItemTimestamp: number = 0; 
    _done: boolean = false; 
    _firstExecution: boolean = true; 

    constructor(chain: string, blocks: DropoutContainer<any>) {
        super(async () => {
            try { 
                console.log(`ObtainBlocksFromDatabase executing for chain: ${chain}`);
                
                // Initialize the database. 
                const { database } = await mongodb(); 
                // Create a reference to the database transactions collection. 
                const collection = database.collection(`blocks`); 

                let divider = 1;
                switch(chain) {
                    case 'ETH':
                    case 'LUKSO':
                    case 'EVOLUTION':
                    case 'FLR':
                    case 'CELO':
                    case 'ARBI':
                    case 'LUMIA':
                    case 'MANTA':
                    case 'XMR':
                    case 'BTC':
                    case 'DASH':
                    case 'BCH':
                    case 'LTC':
                        divider = 1000;
                        break;
                }
              
                const where: any = {
                    chain,
                    hash: { $ne: null },
                    height: { $ne: null }, 
                    processed: true, 
                    timestamp: { $gt: this._lastKnownItemTimestamp === 0 ? Math.floor((Date.now() - (((1000 * 60) * 60) * 24)) / divider) : this._lastKnownItemTimestamp } };
                
                console.log(`Query conditions for ${chain}:`, JSON.stringify(where));
                    
                let project: any = {};
                switch(chain) {
                    case 'ETH':
                        project = { _id: 0, value: 1, hash: 1, from: 1, baseFeePerGas: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, gasUsedDif: 1, transactions: 1 };
                        break;
                    case 'LUKSO':
                        project = { _id: 0, value: 1, hash: 1, from: 1, baseFeePerGas: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, gasUsedDif: 1, transactions: 1 };
                        break; 
                    case 'EVOLUTION':
                        project = { _id: 0, hash: 1, timestamp: 1, height: 1, transactions: 1, blockversion: 1, appversion: 1, l1lockedheight: 1, validator: 1 };
                        break;
                    case 'FLR':
                        project = { _id: 0, value: 1, hash: 1, from: 1, baseFeePerGas: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, gasUsedDif: 1, transactions: 1 };
                        break;  
                    case 'CELO':
                        project = { _id: 0, value: 1, hash: 1, from: 1, baseFeePerGas: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, gasUsedDif: 1, transactions: 1 };
                        break;  
                    case 'ARBI':
                        project = { _id: 0, value: 1, hash: 1, from: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, transactions: 1 };
                        break;
                    case 'LUMIA':
                        project = { _id: 0, value: 1, hash: 1, from: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, transactions: 1 };
                        break;
                    case 'MANTA':
                        project = { _id: 0, value: 1, hash: 1, from: 1, gasUsed: 1, gasLimit: 1, difficulty: 1, size: 1, height: 1, timestamp: 1, transactions: 1 };
                        break;
                    case 'XMR': 
                        project = { _id: 0, hash: 1, timestamp: 1, height: 1, difficulty: 1, transactions: 1, size: 1 }
                        break;
                    case 'BTC':
                    case 'BCH':
                    case 'DASH':
                    case 'LTC': 
                        project = { _id: 0, hash: 1, timestamp: 1, height: 1, difficulty: 1, transactions: 1, size: 1 }
                        break;
                }

                // Initialize results
                let results: any[] = [];
  
                results = await collection.find(where).project(project).toArray();
                console.log("Sample block:", JSON.stringify(results[0], null, 2));
                
                
                console.log(`Found ${results.length} blocks for ${chain}`);

                // Make sure we atleast have 250 blocks. 
                if(results.length < 250 && this._firstExecution) {
                    try {
                        // Find earliest known height. 
                        let earliest = results.length > 0 ? 
                            results.sort((a: any, b: any) => b.height - a.height)[results.length - 1] : null; 
                            
                        if(!earliest) {
                            const earlyResults = await collection.find(
                                { chain, hash: { $ne: null }, height: { $ne: null } }
                            ).project(project).sort({ height: -1 }).limit(1).toArray();
                            
                            earliest = earlyResults.length > 0 ? earlyResults[0] : null;
                        }
                        
                        if (earliest) {
                            let earliestHeight = earliest.height;
                            const remainder = 250 - results.length;
                            
                            console.log(`Fetching ${remainder} more blocks before height ${earliestHeight}`);
                            
                            let _results = await collection.find({ 
                                chain, 
                                height: { $lt: earliestHeight } 
                            }).project(project).sort({ height: -1 }).limit(remainder).toArray();
                            
                            console.log(`Found ${_results.length} additional blocks`);
                            results = results.concat(_results);
                        }
                    } catch (error) {
                        console.error("Error fetching additional blocks:", error);
                    }
                }

                // Process transactions field
                for(let i = 0; i < results.length; i++) {
                    if(!results[i].transactions) {
                        results[i].transactions = [];
                    }
                    
                    // Convert transactions to count if it's an array
                    if(Array.isArray(results[i].transactions)) {
                        let txcount = results[i].transactions.length; 
                        delete results[i].transactions;
                        results[i].transactions = txcount;
                    }
                    
                    if(!results[i].gasUsedDif) {
                        results[i].gasUsedDif = 0.0; 
                    }
                }

                // Special handling for EVOLUTION chain to ensure required fields exist
                if(chain === 'EVOLUTION' && results.length > 0) {
                    console.log(`Processing ${results.length} EVOLUTION blocks to ensure schema compatibility`);
                    
                    // Add missing fields with default values if needed
                    for(let i = 0; i < results.length; i++) {
                        // Make sure required fields exist with valid values
                        if(results[i].hash === undefined || results[i].hash === null) {
                            results[i].hash = "";
                        }
                        
                        if(results[i].timestamp === undefined || results[i].timestamp === null) {
                            results[i].timestamp = Date.now();
                        }
                        
                        if(results[i].height === undefined || results[i].height === null) {
                            results[i].height = 0;
                        }
                        
                        if(results[i].transactions === undefined || results[i].transactions === null) {
                            results[i].transactions = 0;
                        }
                        
                        if(results[i].blockversion === undefined || results[i].blockversion === null) {
                            results[i].blockversion = 0;
                        }
                        
                        if(results[i].appversion === undefined || results[i].appversion === null) {
                            results[i].appversion = 0;
                        }
                        
                        if(results[i].l1lockedheight === undefined || results[i].l1lockedheight === null) {
                            results[i].l1lockedheight = 0;
                        }
                        
                        if(results[i].validator === undefined || results[i].validator === null) {
                            results[i].validator = "";
                        }
                    }
                    
                    console.log("First EVOLUTION block after processing:", JSON.stringify(results[0], null, 2));
                }

                if(results.length > 0) {
                    console.log(`Sorting and inserting ${results.length} blocks for ${chain}`);
                    const latest = results.sort((a: any, b: any) => a.height - b.height)[results.length - 1]; 
                    this._lastKnownItemTimestamp = latest.timestamp; 
                    
                    blocks.insert(results);
                    console.log(`Successfully inserted blocks for ${chain}`);
                } else {
                    console.log(`No blocks to insert for ${chain}`);
                }
                
                this._done = true; 
                if(this._firstExecution) {
                    this._firstExecution = false;
                }
            } catch (error) {
                console.error("Error in ObtainBlocksFromDatabase:", error);
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