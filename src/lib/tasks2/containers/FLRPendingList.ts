
import { readNFSFile } from '../../../lib/utilities';
import { ProjectedEthereumTransaction } from '../types';
import mongodb from '../../../databases/mongodb';
import redis from '../../../databases/redisEvents';
import path from 'path';
import fs from 'fs';
import OverlapProtectedInterval, { setInterval } from '../utils/OverlapProtectedInterval';
import { ETHTransactionsSchema } from '../../../data/schemas';

export default class FLRPendingList {
    // The maximum allowed size of the collection. 
    public capacity: number = 50000;
    // Index -> Value 
    public array: ProjectedEthereumTransaction[] = [];
    // Key -> Index 
    _mapByKey: { [key: string]: any } = {};
    // The internal task used to write the pending list to disk.
    _writeTaskInstance: OverlapProtectedInterval
    // The path at which the file is to be written at. 
    _filePath: string;
    // A flag that states rather or not the array has been updated since the last write.
    _dirtyFlag: boolean = false;
    // A glaf that states rather or not the list has been initialized.
    _initialized: boolean = false;

    _remove: string[] = [];

    _toAdd: ProjectedEthereumTransaction[] = [];

    constructor() {
        this.add = this.add.bind(this);
        this.remove = this.remove.bind(this);
        this._onConfirmedBlock = this._onConfirmedBlock.bind(this);
        this._onDroppedTransactions = this._onDroppedTransactions.bind(this);
        this._onPendingTransactions = this._onPendingTransactions.bind(this);

        this._filePath = path.join(__dirname, '..', '..', '..', 'data', 'FLR-pendingTransactions.bin');
        // Whenever a new transaction is broadcast.
        redis.subscribe('pendingTx');

        redis.events.on('pendingTx', async (data) => {
            const { chain } = data;
            if (chain !== "FLR") return;

            // Format the socket-format back into the ETHTransactionSchema Format.
            const transaction: ProjectedEthereumTransaction = {
                hash: data.tx,
                from: data.fr,
                insertedAt: new Date(data.ia).getTime(),
                timestamp: data.t,
                gas: data.g,
                gasPrice: data.gp || null,
                maxFeePerGas: data.mfpg || null,
                maxPriorityFeePerGas: data.mpfpg || null,
                value: Number(data.tot * Math.pow(10, 18)) || 0,
                dropped: false,
                processed: true,
                extras: data.e,
                pExtras: data.pe
            }


            // Add the transaction to this list.
            this._onPendingTransactions([transaction])

            // Remove all transactions included in deletedHashes (dh)
            if (data.dh)
                this.remove(data.dh);
        });

        // Whenever a new block comes in.
        redis.subscribe('block');
        redis.events.on('block', (data) => {
            const { chain, hash } = data;
            if (chain !== 'FLR') return;
            this._onConfirmedBlock(hash);
        });

        // Whenever transactions are removed(dropped).
        redis.subscribe('removeTx');
        redis.events.on('removeTx', (data) => {

            const { chain, hashes } = data;
            if (chain !== 'FLR') return;
            this._onDroppedTransactions(hashes);
        })

        // Initiate the _writeTask to create a new pending list every second. 
        this._writeTaskInstance = setInterval(this._writeTask, 2000).start(false);


        setInterval(async () => {
            const { database } = await mongodb();
            const collection = database.collection('transactions_FLR');
            const hashes = this.array.map((a: any) => a.hash);
            const result = await collection.find({ hash: { $in: hashes }, $or: [{ blockHash: { $ne: null } }, { dropped: { $exists: true } }] }).project({ _id: 0, hash: 1 }).toArray();
            const toDelete = result.map((result: any) => result.hash);
            this.remove(toDelete);
        }, 10000).start(false);

        setInterval(async () => {
            if (!this._toAdd.length) return;
            this.array = this.array.concat(this._toAdd);
            this._toAdd = [];
            this.array = this.array.sort((a: ProjectedEthereumTransaction, b: ProjectedEthereumTransaction) => this._getSortValue(a) - this._getSortValue(b));
            if (this.array.length > this.capacity)
                this.array.splice(0, this.array.length - this.capacity);
            this._rebuildKeyMap();
        }, 1000).start(false);
    }

    /**
     * Adds a transaction to the collection. Takes care of finding a place to insert the transaction 
     * as well as ignoring the transaction if there's no room for it based on the universal gas price.
     * 
     * @param transactions An array of transactions that we want to add. 
     */
    add(transactions: ProjectedEthereumTransaction[]) {
        this._toAdd = this._toAdd.concat(transactions);
    }

    /**
     * Removes transaction hashes from the collection & rebuilds lookup maps. 
     * 
     * @param hashes The hashes
     */
    remove(hashes: string[]) {
        if (!this._initialized) {
            this._remove = this._remove.concat(hashes);
            return;
        }

        let indexesToDelete: number[] = [];
        for (let i = 0; i < hashes.length; i++) {
            let hash = hashes[i];
            let index = this._mapByKey[hash];
            if (index == null) continue;
            indexesToDelete.push(index);
        }

        if (indexesToDelete.length > 0) {
            for (let i = 0; i < indexesToDelete.length; i++)
                delete this.array[indexesToDelete[i]];
            this.array = this.array.filter((value) => value);
            this._toAdd = this._toAdd.filter((value) => value);
            this._rebuildKeyMap();
        }
    }

    /**
     * Called whenever transaction(s) are broadcast on the network.
     * 
     * @param transactions The transactions broadcast.
     */
    _onPendingTransactions = async (transactions: ProjectedEthereumTransaction[]) => {
        this.add(transactions);
    };

    /**
     * Called whenever a block is confirmed on the network.
     * 
     * @param hash The hash of the block.
     */
    _onConfirmedBlock = async (hash: string) => {
        try {
            if (!hash) return;

            let attempts = 0;
            const obtainBlock = async (): Promise<any> => {
                try {
                    if (attempts >= 5) return null;
                    const directory = process.env.DATA_DIR || path.join('/mnt', 'disks', 'txstreet_storage');
                    const firstPart = hash[hash.length - 1];
                    const secondPart = hash[hash.length - 2];
                    const filePath = path.join(directory, 'blocks', 'FLR', firstPart, secondPart, hash);
                    const data = await readNFSFile(filePath);
                    const block = JSON.parse(data as string);
                    if (block) return block;
                    return null;
                } catch (error) {
                    attempts++;
                    console.error(error);
                    return obtainBlock();
                }
            }

            const block = await obtainBlock();
            if (!block) {
                console.log(`FLRPendingList Failed to get data for block: ${hash}`);
                return;
            }
            if (block.insertedAt) block.insertedAt = new Date(block.insertedAt).getTime();

            const transactions = block.tx || [];

            // We have no use for confirmed transactions in the pending list. 
            this.remove(transactions);
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Called whenever transaction(s) are dropped from the network.
     * 
     * @param hashes The hashes.
     */
    _onDroppedTransactions = async (hashes: string[]) => {
        if (!hashes.length) return;
        this.remove(hashes);
    }

    /**
     * Obtains the "sort value" or "universal gas price" for a transaction.
     * 
     * @param transaction The transaction.
     */
    _getSortValue(transaction: ProjectedEthereumTransaction) {
        if (transaction.hasOwnProperty('gasPrice') && transaction.gasPrice != null)
            return transaction.gasPrice;
        if (transaction.hasOwnProperty('maxFeePerGas') && transaction.maxFeePerGas != null)
            return transaction.maxFeePerGas;
        return 0;
    }

    /**
     * Rebuillds the _mapByKey object used to map Key->Index.
     */
    _rebuildKeyMap() {
        // Empty the object.
        this._mapByKey = {};

        // Sort the array
        this.array = this.array.sort((a: any, b: any) => this._getSortValue(a) - this._getSortValue(b));

        // Iterate over all elements and assign the value. 
        for (let i = 0; i < this.array.length; i++) {
            let entry = this.array[i];
            if (!entry) continue;
            let key = entry['hash'];
            this._mapByKey[key] = i;
        }

        // Update the dirty flag
        this._dirtyFlag = true;
    }

    /**
     * Fetches the original collection of #capacity transactions from the database and populates the collection. 
     */
    async init() {
        try {
            const { database } = await mongodb();
            const collection = database.collection('transactions_FLR');
            const where: any = { confirmed: false, processed: true, blockHash: { $eq: null }, dropped: { $exists: false } };
            const project = { _id: 0, processed: 1, insertedAt: 1, gas: 1, value: 1, gasPrice: 1, maxFeePerGas: 1, maxPriorityFeePerGas: 1, dropped: 1, hash: 1, from: 1, timestamp: 1, extras: 1, pExtras: 1 };
            const results = await collection.find(where).project(project).sort({ pendingSortPrice: -1 }).limit(this.capacity).toArray();
            for (let i = 0; i < results.length; i++)
                results[i].insertedAt = new Date(results[i].insertedAt).getTime();
            this.add(results);
            console.log(`Added ${results.length} results from the database, initialization completed`);
            this._initialized = true;
            console.log('Removing', this._remove.length);
            this.remove(this._remove);
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * An internal task that is executed every 1000ms
     */
    _writeTask = async (): Promise<void> => {
        try {
            if (!this._initialized) return;
            if (!this._dirtyFlag) return;
            this._dirtyFlag = false;

            for (let i = 0; i < this.array.length; i++) {
                const entry = this.array[i];
                if (entry.extras && typeof entry.extras !== "string") entry.extras = JSON.stringify(entry.extras);
                if (entry.pExtras && typeof entry.pExtras !== "string") entry.pExtras = JSON.stringify(entry.pExtras);

                //@ts-ignore
                Object.keys(entry).forEach((k) => (!entry[k] || entry[k] == null || entry[k] == "null") && delete entry[k]);
            }

            const contents = ETHTransactionsSchema.toBuffer({ timestamp: Date.now(), collection: this.array });

            const writingFilePath = this._filePath.replace(/\.bin$/, '-writing.bin');
            fs.writeFileSync(writingFilePath, contents);
            fs.rename(writingFilePath, this._filePath, (err) => {
                this._dirtyFlag = false;
                if (err) throw err
            });
        } catch (error) { }
    }
}