import ChainImplementation from '../../implementation'; 
import { Logger } from "../../../../lib/utilities";
// @ts-ignore-line
import abiDecoder from "abi-decoder";
import fetch from "node-fetch";

import contract_0x7be8076f4ea4a4ad08075c2508e481d6c946d12b from "./0x7be8076f4ea4a4ad08075c2508e481d6c946d12b.json";


class Opensea extends ChainImplementation {
  public addresses: string[] = [];
  public nftList: any = {}; //TODO cache in db

  public mongodb: any;
  public redis: any; 

  async fetchContract(address: string): Promise<any> {
    if (this.nftList[address]) return this.nftList[address];
    const url = "https://api.opensea.io/api/v1/asset_contract/" + address;
    try {
      const response = await fetch(url);
      const data: any = await response.json();
      if (!data.collection) return {};
      this.nftList[address] = data;
      return data;
    } catch (error) {
      Logger.error(error);
      return {};
    }
  }

  async formatSale(transaction: any, decoded: any) {
    const nftAddr = decoded.params[0].value[4]; //bundle?
    const to = decoded.params[0].value[1]; //always true
    const from = decoded.params[0].value[decoded.params[0].value[2] === "0x0000000000000000000000000000000000000000"?8:2]; //8 if accepting offer?
    let tokenAmount = decoded.params[1].value[4];
    const tokenAddr = decoded.params[0].value[6];
    let token = "ETH";
    if (tokenAddr !== "0x0000000000000000000000000000000000000000" && tokenAddr !== "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2") {
      //TODO get custom token and divide decimals
      tokenAmount = "?"; //0.1
      token = "?"; //ETH
    } else {
      tokenAmount /= 1000000000000000000;
    }

    const details = await this.fetchContract(nftAddr);
    transaction.extras.opensea = {
      type: "trade",
      token: nftAddr,
      to,
      from,
      tokenAmount,
      tokenAddr, //TODO add token symbol
      slug: details?.collection?.slug || null,
      symbol: details?.symbol || null,
      img: details?.image_url || null,
    };

    let parts = [
      transaction.extras.opensea.symbol
      ? transaction.extras.opensea.symbol + " NFT"
      : "NFT",
      tokenAmount + " " + token,
    ];
    let message = "";
    
    if (transaction.from === from) {
      //start with nft
      message = parts[0] + " ➞ " + parts[1];
    } else {
      //start with amount
      message = parts[1] + " ➞ " + parts[0];
    }
    transaction.extras.houseContent = message;
  }

  async formatCancel(transaction: any, decoded: any) {
    const nftAddr = decoded.params[0].value[4];
    const details = await this.fetchContract(nftAddr);

    let tokenAmount = decoded.params[1].value[4];
    const tokenAddr = decoded.params[0].value[6];
    let token = "ETH";
    if (tokenAddr !== "0x0000000000000000000000000000000000000000") {
      //TODO get custom token
      token = "CUS";
    } else {
      tokenAmount /= 1000000000000000000;
    }

    //TODO get side (cancel offer or listing)
    transaction.extras.opensea = {
      type: "cancel",
      token: nftAddr,
      tokenAmount,
      tokenAddr, //TODO add token symbol
      slug: details?.collection?.slug || null,
      symbol: details?.symbol || null,
      img: details?.image_url || null,
    };

    transaction.extras.houseContent =
      "Cancel " +
      (transaction.extras.opensea.symbol
        ? transaction.extras.opensea.symbol + " NFT"
        : "NFT") +
      " Order";
  }

  async init(mongodb: any, redis: any): Promise<ChainImplementation> {
      try {
        this.mongodb = mongodb;
        this.redis = redis; 
      if (process.env.USE_DATABASE !== "false") {
        const { database } = await mongodb();
        const collection = database.collection("houses");
        const result = await collection.findOne({
          chain: this.chain,
          name: "opensea",
        });
        this.addresses = result.contracts;
        console.log('Addresses for opensea:', this.addresses);
      }

      abiDecoder.addABI(contract_0x7be8076f4ea4a4ad08075c2508e481d6c946d12b);

      console.log("initialized opensea");
    } catch (error) {
      Logger.error(error);
    } finally {
      return this;
    }
  }

  async validate(transaction: any): Promise<boolean> {
    //Needed to test locally without db
    // return(transaction.to === '0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b'.toLowerCase());
    return this.addresses.includes(transaction.to);
  }

  async execute(transaction: any): Promise<boolean> {
    if(transaction.house === 'opensea') 
      return true; 
    transaction.house = 'opensea';

    if(transaction.to === '0x7Be8076f4EA4A4AD08075C2508e481d6C946D12b'.toLowerCase()) {
      if(!transaction.extras)
        transaction.extras = { showBubble: false }; 
    
      const decoded = abiDecoder.decodeMethod(transaction.input);
      switch(decoded.name) {
        case 'atomicMatch_':
            try { await this.formatSale(transaction, decoded); } catch (error) { Logger.error(error); }
            break;
          case 'cacncelOrder_':
            try { await this.formatCancel(transaction, decoded); } catch (error) { Logger.error(error); }
            break;
      }
    }
    return true;
  }
}

export default new Opensea("ETH");