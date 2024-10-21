import { BlockchainWrapper } from "../../lib/node-wrappers";
import claimBlock from "./claim-block";
import storeBlock from "./store-block";

// Generic workflow for processing a block to submit a processing request.
// Works with all blockchains based on their BlockchainNode implementation.
export default async (wrapper: BlockchainWrapper, id: string, height?: number, slot?: number): Promise<any> => {
  try {
    // If we are unable to claim this transaction, do not continue.
    // if(!(await claimBlock(wrapper.ticker, id)))
    //     return;

    // Store the block in the database.
    const slotToUse = slot !== undefined ? slot : null;
  
    await storeBlock(wrapper, id, height, slotToUse);
  } catch (error) {
    console.error(error);
  }
};
