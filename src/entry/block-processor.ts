// Load environment variables from .env
import dotenv from "dotenv";
dotenv.config();
console.log("starting block-processor");

// Merge command line args into environment variables, overwriting values specified in .env
import minimist from "minimist";
Object.assign(process.env, minimist(process.argv.slice(2)));

// Misc imports
import processBlock from "../methods/block-processor/process-block";
import processBlockTxs from "../methods/block-processor/process-block-txs";
import * as Wrappers from "../lib/node-wrappers";
import { initHooks } from "../lib/chain-implementations";

// A collection of all initialized BlockchainNode instances.
const nodes: { [key: string]: Wrappers.BlockchainWrapper } = {};

// A hardcoded array of implemented blockchains.
const blockchainImpls = [
  "BTC",
  "LTC",
  "BCH",
  "XMR",
  "ETH",
  "RINKEBY",
  "ARBI",
  "LUKSO",
  "MANTA",
  "CELO",
  "DASH",
  "TON",
];
var nodesToInit: string[] = [];

// Check for command line arguments matching that of blockchain implementations
Object.keys(process.env).forEach((key) => {
  if (blockchainImpls.includes(key.toUpperCase())) {
    nodesToInit.push(key.toUpperCase());
  }
});

// Simple infinite loop terminator
var running = true;

// A simple infinite execution loop that doesn't block the event loop.
const nonBlockingInfiniteLoop = async (wrapper: Wrappers.BlockchainWrapper) => {
  try {
    if (wrapper.ticker === "ARBI") {
      await processBlockTxs(wrapper);
    } else if (wrapper.ticker === "MANTA") {
      await processBlockTxs(wrapper);
    } else {
      await processBlock(wrapper);
    }
    setTimeout(() => (running && nonBlockingInfiniteLoop(wrapper)) || null, 1);
  } catch (error) {
    console.error(error);
    setTimeout(() => (running && nonBlockingInfiniteLoop(wrapper)) || null, 1);
  }
};

const run = async () => {
  if (nodesToInit.includes("BTC")) {
    const btcWrapper = new Wrappers.BTCWrapper(
      {
        username: "user",
        password: "pass",
        host: process.env.BTC_NODE as string,
        port: Number(process.env.BTC_NODE_PORT) || 8332,
      },
      {
        host: process.env.BTC_NODE as string,
        port: Number(process.env.BTC_NODE_ZMQPORT) || 28332,
      }
    );

    nonBlockingInfiniteLoop(btcWrapper);
  }

  if (nodesToInit.includes("DASH")) {
    const dashWrapper = new Wrappers.DASHWrapper(
      {
        username: "user",
        password: "pass",
        host: process.env.DASH_NODE as string,
        port: Number(process.env.DASH_NODE) || 9998,
      },
      {
        host: process.env.DASH_NODE as string,
        port: Number(process.env.DASH_NODE_ZMQPORT) || 20009,
      }
    );

    nonBlockingInfiniteLoop(dashWrapper);
  }

  if (nodesToInit.includes("BCH")) {
    const bchWrapper = new Wrappers.BCHWrapper(
      {
        username: "user",
        password: "pass",
        host: process.env.BCH_NODE as string,
        port: Number(process.env.BCH_NODE_PORT),
      },
      {
        host: process.env.BCH_NODE as string,
        port: Number(process.env.BCH_NODE_ZMQPORT),
      }
    );

    nonBlockingInfiniteLoop(bchWrapper);
  }

  if (nodesToInit.includes("XMR")) {
    const xmrWrapper = new Wrappers.XMRWrapper(process.env.XMR_NODE as string);

    nonBlockingInfiniteLoop(xmrWrapper);
  }

  if (nodesToInit.includes("LTC")) {
    const ltcWrapper = new Wrappers.LTCWrapper(
      {
        username: "user",
        password: "pass",
        host: process.env.LTC_NODE as string,
        port: Number(process.env.LTC_NODE_PORT),
      },
      {
        host: process.env.LTC_NODE as string,
        port: Number(process.env.LTC_NODE_ZMQPORT),
      }
    );

    nonBlockingInfiniteLoop(ltcWrapper);
  }

  if (nodesToInit.includes("ETH")) {
    const ethWrapper = new Wrappers.ETHWrapper(process.env.ETH_NODE as string);

    nonBlockingInfiniteLoop(ethWrapper);
    console.log(
      "running block processor for ETH",
      nonBlockingInfiniteLoop(ethWrapper)
    );
  }

  if (nodesToInit.includes("LUKSO")) {
    const luksoWrapper = new Wrappers.LUKSOWrapper(
      process.env.LUKSO_NODE as string
    );

    nonBlockingInfiniteLoop(luksoWrapper);
    console.log(
      "running block processor for lukso",
      nonBlockingInfiniteLoop(luksoWrapper)
    );
  }
  if (nodesToInit.includes("CELO")) {
    const celoWrapper = new Wrappers.CELOWrapper(
      process.env.CELO_NODE as string
    );

    nonBlockingInfiniteLoop(celoWrapper);
    console.log(
      "running block processor for celo",
      nonBlockingInfiniteLoop(celoWrapper)
    );
  }
  if (nodesToInit.includes("ARBI")) {
    initHooks("ARBI");
    const arbiWrapper = new Wrappers.ARBIWrapper();
    nonBlockingInfiniteLoop(arbiWrapper);
  }
  if (nodesToInit.includes("MANTA")) {
    initHooks("MANTA");
    const mantaWrapper = new Wrappers.MANTAWrapper();
    nonBlockingInfiniteLoop(mantaWrapper);
  }
  if (nodesToInit.includes("RINKEBY")) {
    const rinkebyWrapper = new Wrappers.RINKEBYWrapper(
      process.env.RINKEBY_NODE as string
    );

    nonBlockingInfiniteLoop(rinkebyWrapper);
  }
  if (nodesToInit.includes("TON")) {
    // Do the TON thing
  }
};

run();
