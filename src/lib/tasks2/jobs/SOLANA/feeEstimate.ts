import fs from 'fs';
import path from 'path';
import { Connection } from '@solana/web3.js';

let currentHeight = 0;
let feeEstimate = 0;
let transactionLimit = 1000;  // Arbitrary limit for estimating transactions per block

// Connection to Solana
const solanaConnection = new Connection(process.env.SOLANA_NODE || 'https://api.mainnet-beta.solana.com', 'confirmed');

async function go() {
  const _path = path.join(__dirname, '..', '..', '..', '..', 'data', 'SOLANA-pendingTransactions.json');
  const _result = fs.readFileSync(_path).toString('utf-8');
  const result = JSON.parse(_result);
  const list: any = [...result].reverse();

  const blocks = generateBlocks(list);
  const final = finalizeBlocks(blocks);
  return final;
}

function getTransactionSize(entry: any) {
  // Estimate transaction size (could be improved by using actual data)
  return entry.size || 500; // 500 bytes as an example
}

function getTransactionFee(entry: any) {
  // Solana transaction fee is typically static (5000 lamports), but can be adjusted based on the complexity
  return entry.fee || 5000;  // Using a default fee (could be fetched dynamically)
}

function getFittingTxs(list: any[], block: any, start: number) {
  let spaceRemaining = transactionLimit - block.transactionsUsed;
  let txs: any = [];
  for (let i = start - 1; i >= 0; i--) {
    if (spaceRemaining < 1) break; // No more space for transactions
    let entry: any = list[i];

    const txSize = getTransactionSize(entry);
    if (txSize < spaceRemaining) {
      // It fits!
      spaceRemaining -= txSize;
      txs.push(entry);
    }
  }
  return txs;
}

function generateBlocks(list: any[]): any {
  const blocksGenerate = 3;
  const blocks: any = [];

  for (let blockIndex = 0; blockIndex < blocksGenerate; blockIndex++) {
    blocks[blockIndex] = {
      height: currentHeight + blockIndex + 1,
      feeEstimate: feeEstimate,
      txArray: [],
      transactionsUsed: 0,
    };
    const block = blocks[blockIndex];
    for (let i = list.length - 1; i >= 0; i--) {
      const entry: any = list[i];
      const txSize = getTransactionSize(entry);
      if (block.transactionsUsed + txSize > transactionLimit) {
        let fittedTxs = getFittingTxs(list, block, i + 1);
        for (let j = 0; j < fittedTxs.length; j++) {
          const fittedTx: any = fittedTxs[j];
          const fittedTxSize = getTransactionSize(fittedTx);
          block.txArray.push(fittedTx);
          block.transactionsUsed += fittedTxSize;
          list.splice(list.indexOf(fittedTx), 1);
        }
        break;
      }

      block.txArray.push(entry);
      block.transactionsUsed += txSize;
      list.splice(i, 1);
      block.transactionsUsed = Math.min(block.transactionsUsed, transactionLimit);
    }
  }
  return blocks;
}

function finalizeBlocks(blocks: any[]) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const fees = [];
    for (let j = 0; j < block.txArray.length; j++) {
      const tx = block.txArray[j];
      const fee = getTransactionFee(tx);
      fees.push(fee);
    }
    fees.sort((a, b) => a - b);

    block.txCount = block.txArray.length;
    block.minFee = fees.length > 0 ? fees[0] : 5000;  // Minimum fee (default 5000 lamports)
    block.maxFee = fees.length > 0 ? fees[fees.length - 1] : 10000;  // Maximum fee (default 10000 lamports)
    block.avgFee = fees.length > 0 ? Math.floor(fees.reduce((a, b) => a + b, 0) / fees.length) : 7500;  // Average fee
    delete block.txArray;  // Remove transactions array after processing
  }
  return blocks;
}

export default async (_currentHeight: number, _transactionLimit: number) => {
  currentHeight = _currentHeight;
  transactionLimit = _transactionLimit;

  return await go();
};
