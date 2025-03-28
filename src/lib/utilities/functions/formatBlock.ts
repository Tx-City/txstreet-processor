export default (chain: string, block: any): Promise<any> => {
    let obj: any = {};
    obj.coin = chain;
    
    if(chain === "ETH" || chain === "LUKSO" || chain === "FLR" || chain === "RINKEBY" || chain === "ARBI" || chain === "LUMIA" || chain === "MANTA" || chain === "CELO") {
        obj.tx = block.transactions || [];
        obj.txs = block.transactions?.length; 
        obj.txFull = block.txFull;
        if(block.hash && block.hash.length > 0) obj.hash = block.hash;
        if(block.parentHash && block.parentHash.length > 0) obj.parentHash = block.parentHash;
        if(block.uncles && block.uncles.length > 0) obj.uncles = block.uncles;
        if(block.size && block.size > 0) obj.size = block.size;
        if(block.gasUsed && block.gasUsed > 0) obj.gu = block.gasUsed;
        if(block.number && block.number > 0) obj.height = block.number;
        if(block.timestamp && block.timestamp > 0) obj.time = block.timestamp;
        if(block.baseFeePerGas) obj.baseFee = block.baseFeePerGas;
        if(block.gasLimit) obj.gl = Number(block.gasLimit);

        if(block.rewards) obj.rewards = block.rewards;
        if(block.minTip) obj.minTip = block.minTip; 
        if(block.medianTip) obj.medianTip = block.medianTip;
        if(block.tips) obj.tips = block.tips;
        if(block.burned) obj.burned = block.burned; 
    }
    if (chain === "EVOLUTION") {
        // console.log("EVOLUTION BLOCK", block);
        obj.tx = block.transactions || [];
        obj.txs = block.txs || 0;
        obj.txFull = block.txFull;
        obj.hash = block.hash;
        obj.parentHash = block.last_commit.block_id.hash;;
        obj.height = block.height;
        obj.time = block.timestamp;
        obj.timestamp = block.timestamp;
        obj.bv = block.blockversion || 0;
        obj.av = block.appversion || 0;
        obj.l1h = block.l1lockedheight || 0;
        obj.v = block.validator || '';
        // console.log("OBJ----", obj);
    }
    if(chain === "LTC" || chain === "BTC" || chain === "BCH" || chain === "DASH") {
        obj.tx = block.transactions || [];
        obj.txFull = block.txFull;
        obj.txs = block.nTx || block.transactions?.length || 0;
        obj.hash = block.hash;
        obj.parentHash = block.previousblockhash;
        obj.size = block.size;
        obj.strippedsize = block.strippedsize;
        obj.height = block.height;
        obj.weight = block.weight;
        obj.timestamp = Math.round(Number(block.timestamp));
        obj.time = Math.round(Number(block.timestamp));
        if(block.mweb) obj.mweb = block.mweb;
    }

    if(chain === "XMR") {
        obj.tx = block.transactions || []; 
        obj.txs = block.txs || block.transactions?.length || 0;
        obj.txFull = block.txFull;
        obj.hash = block.hash;
        obj.parentHash = block.prevHash;
        obj.size = block.size;
        obj.height = block.height;
        obj.time = block.timestamp;
    }
    console.log("block.lastInserted", block.lastInserted);  
    if(block.lastInserted) obj.inserted = Math.round(block.lastInserted / 1000);
    // console.log('BTC BLOCK obj>>>>>>:', obj)
    return obj;
}