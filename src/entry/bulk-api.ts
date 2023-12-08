const Express = require('express');
const cors = require('cors');
const net = require('net');
const Web3 = require('web3');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config({});

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE_RPC));
const app = Express();

app.use(Express.json({ limit: '50mb' }));
app.use(cors());

app.post('/nonces', async (request: any, response: any) => {
    console.log('calling nonces');
    const accounts = request.body.accounts;

    const tasks: any = [];
    accounts.forEach((account: any) => {
        tasks.push(
            new Promise(async (resolve, reject) => {
                try {
                    const count = await web3.eth.getTransactionCount(account);
                    resolve({ account, count });
                } catch (error) {
                    console.log('nonces error');
                    resolve({ account, count: 0 });
                }
            })
        )
    });
    response.send(await Promise.all(tasks));
});

app.post('/contract-codes', async (request: any, response: any) => {
    console.log('calling contract codes');
    const contracts = request.body.contracts;
    const tasks: any = [];
    contracts.forEach((contract: any) => {
        tasks.push(
            new Promise(async (resolve, reject) => {
                try {
                    const code = await web3.eth.getCode(contract);
                    resolve({ contract, code });
                } catch (error) {
                    console.log('contract code error');
                    resolve({ contract, code: "0x" });
                }
            })
        )
    });
    response.send(await Promise.all(tasks));
});

app.post('/transaction-receipts', async (request: any, response: any) => {
    console.log('calling transaction-receipts');
    const hashes = request.body.hashes;
    const tasks: any = [];

    hashes.forEach((hash: any) => {
        tasks.push(
            new Promise(async (resolve, reject) => {
                try {
                    const receipt = await web3.eth.getTransactionReceipt(hash);
                    resolve({ hash, receipt });
                } catch (error) {
                    console.log('transaction-receipts error:', error);
                    resolve({ hash, receipt: null });
                }
            })
        )
    });
    response.send(await Promise.all(tasks));
});

const port = 8081;
app.listen(port);
console.log("Bulk API - listening on port: " + port);