import SocketIO from 'socket.io';
import { lastBlocks } from '../redis/handlers/block'; 
import { lastHouseTxs } from '../redis/handlers/pendingTx';

export default async (socket: SocketIO.Socket, room: string) => {
    socket.join(room); 
    const parts = room.split('-'); 
    const chain = parts[0];
    const channel = parts[1]; 
    const valid = JSON.parse(process.env.TICKERS);

    if(valid.includes(chain) && channel == 'blocks') {
        const hashes = lastBlocks[chain] || []; 
        socket.emit('latestblocks', hashes); 
    }

    if(valid.includes(chain) && channel == 'transactions') {
        const houseTransactions = lastHouseTxs[chain]; 
        if(!houseTransactions) {
            return;
        }

        const data: any = []; 
        Object.keys(houseTransactions).forEach(house => {
            data.push({ house, txs: houseTransactions[house] })
        });
    }

}