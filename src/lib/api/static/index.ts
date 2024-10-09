import express, { Request, Response, Router } from 'express';
import path from 'path';
import { readNFSFile } from '../../../lib/utilities';

const directory = process.env.DATA_DIR || path.join('/mnt', 'disks', 'txstreet_storage');

// Initialize router.
const staticRouter = Router();

staticRouter.use("/f/", express.static(path.join(directory, 'f')));

const fileCache: { [key: string]: string } = {};
const cacheExpire: { [key: string]: number } = {};

setInterval(() => {
    let keys = Object.keys(cacheExpire);
    let now = Date.now();
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        if (now >= cacheExpire[key]) {
            delete fileCache[key];
            delete cacheExpire[key];
        }
    }
}, 100);

staticRouter.get('/live/:file', async (request: Request, response: Response) => {

    let file = request.params.file;
    if (!file)
        return response.status(400).send(`file||data missing`);
    try {
        let data: any = fileCache[file];
        if (data != null) {
            console.log(`Live request served from memory cache.`);
            return response.set('content-type', 'application/json').send(data);
        }
        const filePath = path.join(directory, 'live', file);

        console.log("filePath-------------------------------------> &&&&&&&&&&&&&&&&", filePath);
        data = await readNFSFile(filePath);

        // Sanity
        if (!data || !data.length) {
            response.set('Cache-Control', 'no-store, max-age=0');
            response.set('Expires', '0');
            return response.status(404).send(false);
        }

        // This will throw an error if the JSON data is not valid, hitting the catch
        // and telling cloudflare to not cache the data. 
        JSON.parse(data);

        fileCache[filePath] = data;
        cacheExpire[filePath] = Date.now() + 2000;
        console.log('sending data');
        return response.set('content-type', 'application/json').send(data);
    } catch (error) {
        console.error(error);
        response.set('Cache-Control', 'no-store, max-age=0');
        response.set('Expires', '0');
        return response.status(404).send(false);
    }
});

// Assign request handlers.
staticRouter.get('/blocks/:ticker/:hash', async (request: Request, response: Response) => {
    let ticker = request.params.ticker;
    let hash = request.params.hash;
    // if(ticker === 'SOL1' || ticker === 'SOL' || ticker === 'SOLANA') {
    //     return response.status(404).send({
    //             "coin": "SOL",
    //             "txs": 153,
    //             "txFull": {
    //                 "4avKe7xNzDCzAGfdfg7WE67RV9fkeW6uDrJga9wKci": {
    //                     "tx": "4avKe7xNzDCzAGfdfg7WE67RV9fkeW6uDrJga9wKci",
    //                     "to": "7EywR7gk1nksH7ZW87i9FynZgFCax4kLMqfYtHDHhZ9G",
    //                     "fr": "4NzXXrS8Dgfdy7iAXrmdJbEYezmbhWVttVcEQ6pBmz6f",
    //                     "recentBlockhash": "4KEeXBzk6GcEsBYqHQrpx4RLXZgQLxqZddY6atEm9g8h",
    //                     "lamports": 260532,
    //                     "slot": 153689564,
    //                     "confirmations": 51,
    //                     "timestamp": "2024-10-02T07:46:04.869Z",
    //                     "signature": "4avKe7xNzDCzAGfdfg7WE67RV9fkeW6uDrJga9wKci",
    //                     "type": "transfer"
    //                 },
    //                 "3x8JFFHDdV7VJAWoBSGhKrb8n7t2h56ZXgN5WxZfB3dQ": {
    //                     "tx": "3x8JFFHDdV7VJAWoBSGhKrb8n7t2h56ZXgN5WxZfB3dQ",
    //                     "to": "5TfJ3jXK7Hv6TKtfs36CpQjeHEjvjwZz9s8oQmjLD74J",
    //                     "fr": "4vFSNsbPrhUp1Qj7sYWLoBVJNHB38xW3M3zrS8DnGJhw",
    //                     "recentBlockhash": "EwbS2VCXrNWiyF3bqiFXMnTyGS4p7QgSDGdaTsNY4iMo",
    //                     "lamports": 366840,
    //                     "slot": 153689570,
    //                     "confirmations": 905,
    //                     "timestamp": "2024-10-02T07:46:12.785Z",
    //                     "signature": "3x8JFFHDdV7VJAWoBSGhKrb8n7t2h56ZXgN5WxZfB3dQ",
    //                     "type": "transfer"
    //                 },
    //                 "5EbV6Lx6ZyyuFk3NEfjgSYYodmTfjKQmPvRpV8dsmwHS": {
    //                     "tx": "5EbV6Lx6ZyyuFk3NEfjgSYYodmTfjKQmPvRpV8dsmwHS",
    //                     "to": "7hBdF23W7Bhg3rRMEZyqsW8RH1S23M1u8sCtpyYjxVQP",
    //                     "fr": "5LPFJKFhzRWV1GVS4pH1zzNf84HwJ9HnTwPT6HqME7bp",
    //                     "recentBlockhash": "BhJ74RMXgn6FSD5E3UEfWLbrGgk9dFt5fVeZMsjqR7pA",
    //                     "lamports": 0,
    //                     "slot": 153689561,
    //                     "confirmations": 4281058,
    //                     "timestamp": "2024-10-02T07:46:06.735Z",
    //                     "signature": "5EbV6Lx6ZyyuFk3NEfjgSYYodmTfjKQmPvRpV8dsmwHS",
    //                     "type": "transfer"
    //                 },
    //                 "3V5ZjU98ZtNZnmBYHg2E9RQngZXHBurHENMwbqL29URH": {
    //                     "tx": "3V5ZjU98ZtNZnmBYHg2E9RQngZXHBurHENMwbqL29URH",
    //                     "to": "5TfJ3jXK7Hv6TKtfs36CpQjeHEjvjwZz9s8oQmjLD74J",
    //                     "fr": "CYNmevnv5WSPCdyqgk8R1uADs5LgSB5GQFiHvYQ6C1Te",
    //                     "recentBlockhash": "CYPvNR2BhbGHT3dSywHpsfVJ9pLXRmbhp5ENXPo66atQ",
    //                     "lamports": 0,
    //                     "slot": 153689570,
    //                     "confirmations": 6,
    //                     "timestamp": "2024-10-02T07:46:12.785Z",
    //                     "signature": "3V5ZjU98ZtNZnmBYHg2E9RQngZXHBurHENMwbqL29URH",
    //                     "type": "transfer"
    //                 },
    //                 "J2RA7D9oSvh47EfT5SdNr8X7SL7tDPvYpsaXtHpnyNc": {
    //                     "tx": "J2RA7D9oSvh47EfT5SdNr8X7SL7tDPvYpsaXtHpnyNc",
    //                     "to": "5uA8SPphjWgFQwCDzzSXv78HSZUJ9z2c5X9shvnMXCDz",
    //                     "fr": "Erh1U9FkAiNtQHHZ52a1vXp8N8vHwYFQ1pBgYNSJHDwT",
    //                     "recentBlockhash": "F5LxhRSrzxCdHEV4pYqEFUHzmytGZx54vjyZKLazDf8k",
    //                     "lamports": 8300,
    //                     "slot": 153689561,
    //                     "confirmations": 9780350,
    //                     "timestamp": "2024-10-02T07:46:05.595Z",
    //                     "signature": "J2RA7D9oSvh47EfT5SdNr8X7SL7tDPvYpsaXtHpnyNc",
    //                     "type": "transfer"
    //                 }
    //             },
    //             "blockhash": "CYPvNR2BhbGHT3dSywHpsfVJ9pLXRmbhp5ENXPo66atQ",
    //             "parentBlockhash": "5jqGnwvKfvmRmVcf6xZy5rY47LtP7RaR4j7U9xdmPQ1U",
    //             "blockTime": 1727855171,
    //             "slot": 153689564,
    //             "leader": "12rCFo5DPtMRjNGvknADeauDxDRup1QdrKZ8ZGnDaEtD",
    //             "inserted": 1727855173        
    //     });
    // }
    let verbose: boolean = request?.query?.verbose ? request?.query?.verbose === 'true' : true;

    if (!ticker)
        return response.json({ success: false, code: -1, message: 'Ticker not provided in request.' });
    if (!hash)
        return response.json({ success: false, code: -1, message: 'Hash not provided in request.' });

    ticker = ticker.toUpperCase();

    const sendError = () => {
        response.set('Cache-Control', 'no-store, max-age=0');
        response.set('Expires', '0');
        return response.status(404).send(false);
    }

    try {
        const firstPart = hash[hash.length - 1];
        const secondPart = hash[hash.length - 2];
        const filePath = path.join(directory, 'blocks', ticker, firstPart, secondPart, hash);
        const key: string = filePath + verbose;

        console.log("firstPart-------------------------------------> &&&&&&&&&&&&&&&&", firstPart);

        let data: any = fileCache[key];
        if (data != null) {
            console.log(`Static request served from memory cache.`);
            return response.set('content-type', 'application/json').send(data);
        }
        data = await readNFSFile(filePath);
        console.log("data-------------------------------------> &&&&&&&&&&&&&&&&", data);
        // Sanity
        if (!data || !data.length) {
            return sendError();
        }

        // This will throw an error if the JSON data is not valid, hitting the catch
        // and telling cloudflare to not cache the data. 
        const parsed = JSON.parse(data);
        if (!parsed) console.error("Cannot get: " + filePath);
        delete parsed.note;
        delete parsed.tx;
        if (!verbose) {
            delete parsed.txFull;
            parsed.verbose = false;
        }

        fileCache[key] = parsed;
        cacheExpire[key] = Date.now() + 2000;

        return response.set('content-type', 'application/json').send(parsed);
    } catch (error) {
        console.error(error);
        return sendError();
    }
});

export default staticRouter;