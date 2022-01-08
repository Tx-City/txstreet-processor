import { BlockchainWrapper } from '../../lib/node-wrappers';
import { Logger } from '../../lib/utilities';
import debug from 'debug';
import claimBlock from './claim-block';
import storeBlock from './store-block';

const logger = debug('methods/process-block'); 

// Generic workflow for processing a block to submit a processing request. 
// Works with all blockchains based on their BlockchainNode implementation. 
export default async (wrapper: BlockchainWrapper, id: string): Promise<any> => {
    try { 
        // If we are unable to claim this transaction, do not continue. 
        // if(!(await claimBlock(wrapper.ticker, id)))
        //     return;

        // Store the block in the database.
        await storeBlock(wrapper, id); 
    } catch (error) {
        Logger.error(error);
    }
}