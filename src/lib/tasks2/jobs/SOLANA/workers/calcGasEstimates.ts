import { setInterval } from '../../../utils/OverlapProtectedInterval';
import { Connection } from '@solana/web3.js';
import mongodb from '../../../../../databases/mongodb';
import getGasEstimate from '../feeEstimate'; 

const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

setInterval(async () => {
    try {
        const { database } = await mongodb();
        const statistics = await database.collection('statistics').findOne({ chain: 'SOLANA' });
        
        if (!statistics) {
            console.log('No statistics found for SOLALA');
            return;
        }

        const { baseFee, blockHeight, gasUsedDif, gasLimit } = statistics;

        // Fetch recent block data if necessary, or use existing estimates
        const blockGasEstimates = await getGasEstimate(baseFee, blockHeight,/*  gasUsedDif, gasLimit */);
        const value = JSON.stringify(blockGasEstimates);
        
        if (process.env.UPDATE_DATABASES === "true") {
            await database.collection('statistics').updateOne({ chain: "SOLANA" }, { $set: { blockGasEstimates: value } }); 
        }
    } catch (error) {
        // Ignored, log the error for debugging
        console.log(error);
    }
}, 5500).start(true);
