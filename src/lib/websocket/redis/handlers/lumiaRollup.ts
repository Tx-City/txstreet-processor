import io from '../../../../entry/websocket-server'

export const rollupTxs: any = {}; 

export default async (data: any): Promise<any> => {
    const hash = data.hash;
	if(rollupTxs[hash]) return;
    const room = `LUMIA-blocks`
	
    setTimeout(() => {
        delete rollupTxs[hash];
    }, 60000 * 60 * 24 * 7);

	io.to(room).emit('lumiaRollup', hash); 
}


