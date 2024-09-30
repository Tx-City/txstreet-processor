import mongodb from '../../../../../databases/mongodb';
import { formatTransaction, storeObject } from '../../../../../lib/utilities';
import { setInterval } from '../../../utils/OverlapProtectedInterval';
import fs from 'fs';
import path from 'path';
import { SOLANATransactionsSchema } from '../../../../../data/schemas'; // Update schema for Solana
import { ProjectedSolanaTransaction } from '../../../types'; // Update types for Solana
import { Connection, PublicKey, Transaction } from '@solana/web3.js'; // Use Solana web3.js
import * as Wrappers from '../../../../../lib/node-wrappers';

const solanaConnection = new Connection(process.env.SOLANA_NODE as string);

const readFile = (filePath: string) => new Promise<Buffer>((resolve, reject) => {
    fs.readFile(filePath, (err: NodeJS.ErrnoException, data: Buffer) => {
        if (err) return reject(err);
        return resolve(data);
    });
});

// Used to hold transaction-specific data. 
const cache: { [key: string]: any } = {};

let lastUploadTime = 0;

// The purpose of this function is to curate and store the JSON information for the current pending transaction list. 
setInterval(async () => {
    try {
        const dataPath = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'SOLANA-pendingTransactions.bin');
        const { database } = await mongodb();

        let data = await readFile(dataPath);
        let parsed = SOLANATransactionsSchema.fromBuffer(data); // Adjust to parse Solana transactions

        console.log(`Found ${parsed.collection.length} transactions`);

        let transactions = parsed.collection.sort((a: ProjectedSolanaTransaction, b: ProjectedSolanaTransaction) => b.fee - a.fee); // Sort based on fee
        let transactionMap: any = {};
        let hashes = transactions.map((t: any) => t.signature); // Use Solana's signature
        // let uniqueAccounts: string[] = [...new Set(transactions.map((transaction: ProjectedSolanaTransaction) => transaction.from))];

        // Cache Test
        let cachedHashes = Object.keys(cache);
        let requestHashes: string[] = [];
        transactions.forEach((transaction: ProjectedSolanaTransaction) => {
            transactionMap[transaction.hash] = true;
            if (!cache[transaction.hash]) requestHashes.push(transaction.hash);
        });
        cachedHashes.forEach((hash: string) => {
            if (!transactionMap[hash]) delete cache[hash];
        });

        let qResult = await database.collection('transactions_SOLANA').find({ signature: { $in: requestHashes } })
            .project({ _id: 0, signature: 1, to: 1, house: 1 }).toArray(); // Adjust collection name and fields

        qResult.forEach((doc: any) => {
            cache[doc.signature] = { to: doc.to, house: doc.house };
        });

        // Remove confirmed transactions
        // let confirmedSignatures = await solanaConnection.getConfirmedSignaturesForAddress(new PublicKey('YourAddressHere'), { limit: 100 }); // Change to relevant address
        // let confirmedHashes = confirmedSignatures.map(tx => tx.signature);
        let _remove = await database.collection('transactions_SOLANA').find({ hash: { $in: hashes }, blockHash: { $ne: null } }).project({ hash: 1 }).toArray();
        _remove = _remove.map((tx: any) => tx.hash);

        transactions = transactions.filter((tx: any) => !_remove.includes(tx.signature));
        transactions = transactions.map((transaction: any) => ({ ...transaction, ...cache[transaction.signature] }));

        // The array of transactions to store. 
        var pendingList: any[] = [];
        const addedByHash: any = {};
        const addedByAddress: any = {};

        const pushAndCheckToMove = (transaction: any): boolean => {
            if (addedByHash[transaction.signature]) return false;

            // Add this transaction to the list to be sent out. 
            pendingList.push(transaction);
            addedByHash[transaction.signature] = true;

            // Increase the amount of transactions added by an address/account.
            if (!addedByAddress[transaction.from]) addedByAddress[transaction.from] = 0;
            addedByAddress[transaction.from]++;

            return true;
        };

        // Iterate over the list of pending transactions.
        for (let i = 0; i < transactions.length; i++) {
            const transaction = transactions[i];
            if (!addedByHash[transaction.signature]) {
                transaction.from = transaction.from.toLowerCase();
                pushAndCheckToMove(transaction);
            }
        }

        if (pendingList.length > 3000)
            pendingList.splice(3000, pendingList.length - 3000);

        let count = 0;
        pendingList = pendingList.map((transaction: any) => {
            transaction.type = 0; // Adjust type as necessary
            const formatted = formatTransaction("SOLANA", transaction); // Format for Solana
            if (formatted.an == null) {
                count++;
            }
            return formatted;
        });

        if (count > 0) console.log(`Found ${count} accounts without necessary information in pending transaction creation`);

        const content = JSON.stringify(pendingList);

        if (Date.now() - lastUploadTime >= 1990) {
            const _path = path.join(__dirname, '..', '..', '..', '..', '..', 'data', 'SOLANA-pendingTransactions.json');
            const writingFilePath = _path.replace(/\.json$/, '-writing.json');
            fs.writeFileSync(writingFilePath, content);
            fs.rename(writingFilePath, _path, (err) => {
                if (err) throw err;
            });
            lastUploadTime = Date.now();
            await storeObject(path.join('live', `pendingTxs-SOLANA`), content);
        }

    } catch (error) {
        console.error(error);
    }
}, 2000).start(true);
