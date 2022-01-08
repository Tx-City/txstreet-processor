import io from '../../../../entry/websocket-server'

export const lastBlocks: any = {}; 
let lastBlockHeights: any = {}; 
let hashesForLastHeight: any = {}; 

export default async (data: any): Promise<any> => {
    const { chain, height, hash, from } = data; 
    const room = `${chain}-blocks`; 
    const lastBlockHeight = lastBlockHeights[chain] || 0; 
    if(height > lastBlockHeight) {
        lastBlockHeights[chain] = height;
        if(!lastBlocks[chain])
            lastBlocks[chain] = [];
        if(lastBlocks[chain].length == 5)
            lastBlocks[chain].shift();
        lastBlocks[chain].push(hash); 
        if(!hashesForLastHeight[chain])
            hashesForLastHeight[chain] = [hash];
        io.to(room).emit('block', hash); 
    } else if(height === lastBlockHeight) {
        if(hashesForLastHeight[chain].includes(hash))
            return;
        hashesForLastHeight[chain].push(hash); 
        if(!lastBlocks[chain])
            lastBlocks[chain] = [];
        if(lastBlocks[chain].length == 5)
            lastBlocks[chain].shift();
        lastBlocks[chain].push(hash); 
        io.to(room).emit('block', hash); 
    }
}
