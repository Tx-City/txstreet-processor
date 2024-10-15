import BlockchainWrapper from "../base";
import Web3 from "web3";

export default class TONWrapper extends BlockchainWrapper {
  public initEventSystem() {
    throw new Error("Method not implemented.");
  }
  public getTransactionReceipts?(block: any) {
    throw new Error("Method not implemented.");
  }
  public getTransactionReceipt?(hash: string) {
    throw new Error("Method not implemented.");
  }
  public getTransaction(
    id: string,
    verbosity: number,
    blockId?: string | number
  ) {
    throw new Error("Method not implemented.");
  }
  public getBlock(id: string | number, verbosity: number) {
    throw new Error("Method not implemented.");
  }
  public resolveBlock(
    id: string | number,
    verbosity: number,
    epth: number
  ): Promise<any> {
    throw new Error("Method not implemented.");
  }
  public getTransactionCount(account: string): Promise<number> {
    throw new Error("Method not implemented.");
  }
  public isTransaction(data: any): boolean {
    throw new Error("Method not implemented.");
  }
  public isTransactionConfirmed(transaction: any): boolean {
    throw new Error("Method not implemented.");
  }
  public isBlock(data: any): boolean {
    throw new Error("Method not implemented.");
  }
  public getCurrentHeight(): Promise<null | number> {
    throw new Error("Method not implemented.");
  }
  public web3: Web3;

  constructor(host: string) {
    super("TON");
    const provider = new Web3.providers.WebsocketProvider(host);
    this.web3 = new Web3(provider);
  }
}
