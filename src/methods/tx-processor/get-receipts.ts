import { BlockchainWrapper } from '../../lib/node-wrappers';
import axios from 'axios';

export default async (wrapper: BlockchainWrapper, transactions: any[], returnSingle = false, bulkApi = Boolean(process.env.USE_BULK_API)): Promise<any> => {

    console.log('getting receipt');

    try {
        let hashes: string[] = transactions.map((request: any) => request.hash);

        if (bulkApi) {
            const url = process.env.BULK_API
            const blockTransaction = transactions.find((el) => el.blockHeight);
            let response: any = []
            if (blockTransaction) {
                const blockHeight = blockTransaction.blockHeight;
                const blockHex = '0x' + blockHeight.toString(16).toUpperCase();
                console.log('Getting Receipts from BlockNumber', blockHex);
                try {
                    response = await wrapper.getTransactionReceipts(blockHex)
                    console.log('response from wrapper', response);
                } catch (err) {
                    console.log('error getting receipts from block, trying from bulk api...');
                    response = await axios.post(`http://${url}/transaction-receipts`, { hashes });
                    console.log('response from bulk api', response);
                }
            } else {
                console.log('Getting Receipts from Bulk Api');
                response = await axios.post(`http://${url}/transaction-receipts`, { hashes });
                console.log('response from bulk api', response);
            }

            response.data.forEach((result: any) => {
                for (let i = 0; i < transactions.length; i++) {
                    const transaction = transactions[i];
                    if (transaction.hash === result.hash) transaction.receipt = result.receipt;
                }
            });

        } else {
            let receiptTasks: any[] = [];
            transactions.forEach((transaction) => {
                receiptTasks.push(wrapper.getTransactionReceipt(transaction.hash));
            });
            let receiptResults = (await Promise.all(receiptTasks));
            for (let i = 0; i < receiptResults.length; i++) {
                const receiptResult = receiptResults[i];
                for (let j = 0; j < transactions.length; j++) {
                    const transaction = transactions[j];
                    if (transaction.hash === receiptResult.hash) {
                        transaction.receipt = receiptResult.receipt;
                    }
                }
            }
        }

        if (returnSingle) return transactions[0];
        return transactions;
    } catch (error) {
        console.error(error);
        return false;
    }
}
