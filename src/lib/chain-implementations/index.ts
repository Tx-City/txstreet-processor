import { _implementations } from "./implementation";

export const enabledHooks: any = {
    //add house name manually here

    ARBI: [
        // "DefaultHousing",
    ],
    MANTA: [
        "DefaultHousing",
    ],
    ETH: [
        "Arbitrum",
        "DefaultHousing", //getting house from DB without extra logic
        "Uniswap",
        "Opensea",
        "Sushi"
    ],
    LTC: [
        "DefaultHousing",
        "MWEB",
        "MWEBPeg",
        "Segwit"
    ],
    BCH: [
        "CashFusion",
        "ismikekomaranskydead",
        "CashTokens",
        "EatBCH",
        "Memo",
        "SLP"
    ],
    DASH: [
        // "DefaultHousing",
        "CoinJoin",
        "PrivateSend",
    ],
    LUKSO: [
        // "DefaultHousing",
    ],
    LUMIA: [
        // "DefaultHousing",
    ],
    FLR: [
        // "DefaultHousing",
    ],
    CELO: [
        // "DefaultHousing",
    ],
    BTC: [
        // "DefaultHousing",
    ],
}

export const initHooks = async (chain: string) => {
    for (let i = 0; i < enabledHooks[chain].length; i++) {
        const className = enabledHooks[chain][i];
        const implClass = await import('./' + chain + '/' + className + '/index');
        await implClass.default.init();
    }
}

export default async (chain: string, transaction: any) => {
    let tasks: Promise<boolean>[] = [];
    let implementations = _implementations[chain] || [];
    implementations.forEach((implementation) => {
        tasks.push(new Promise<boolean>(async (resolve) => {
            try {
                let result = await implementation.validate(transaction);
                let executed = false;
                if (result) executed = await implementation.execute(transaction);
                if (result && transaction.blockHash && executed && (implementation as any).confirmed) await (implementation as any).confirmed(transaction);
                return resolve(true);
            } catch (error) {
                return resolve(false);
            }
        }))
    })
    await Promise.all(tasks);
}
