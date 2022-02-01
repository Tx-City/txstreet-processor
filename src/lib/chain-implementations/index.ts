import { _implementations } from "./implementation";

export const enabledHooks: any = {
    ETH: [
        "DefaultHousing",
        "Uniswap",
        "Opensea",
        "Sushi"
    ],
    BTC: [
        "DefaultHousing",
    ],
    LTC: [
        "DefaultHousing",
    ],
    BCH: [
        "CashFusion",
        "EatBCH",
        "Memo",
        "SLP"
    ]
}

export const initHooks = async (chain: string, mongodb: any, redis: any) => {
    for (let i = 0; i < enabledHooks[chain].length; i++) {
        const className = enabledHooks[chain][i];
        const implClass = await import('./' + chain + '/' + className + '/index');
        await implClass.default.init(mongodb, redis);
    }
}

export default async (chain: string, transaction: any, confirmed: boolean = false) => {
    let tasks: Promise<boolean>[] = [];
    let implementations = _implementations[chain] || [];
    implementations.forEach((implementation) => {
        tasks.push(new Promise<boolean>(async (resolve) => {
            try {
                let result = await implementation.validate(transaction);
                let executed = false;
                if (result) executed = await implementation.execute(transaction);
                if (result && confirmed && executed && (implementation as any).confirmed) await (implementation as any).confirmed(transaction);
                return resolve(true);
            } catch (error) {
                return resolve(false);
            }
        }))
    })
    await Promise.all(tasks);
}
