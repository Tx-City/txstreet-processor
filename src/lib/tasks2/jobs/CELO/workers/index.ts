import path from 'path';
import { Worker } from 'worker_threads';
import CELOPendingList from '../../../containers/CELOPendingList';

export default async () => {
    const keys = Object.keys(process.env);
    const workerData: any = { }; 
    keys.forEach((key: string) => workerData[key] = process.env[key]); 

    try {
        console.log('Starting...');
        const pendingTxList = new CELOPendingList(); 
        await pendingTxList.init();

        new Worker(path.join(__dirname, 'createPendingTransactionList.js'), { workerData }); 

        new Worker(path.join(__dirname, 'calculateStats.js'), { workerData })
        new Worker(path.join(__dirname, 'mempoolInfo.js'), { workerData })
        new Worker(path.join(__dirname, 'broadcastReadyBlocks.js'), { workerData })
        new Worker(path.join(__dirname, 'calcGasEstimates.js'), { workerData })
    } catch (error) {
        console.error(error); 
    }
}