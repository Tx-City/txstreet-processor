export const chainConfig: any = {
    ETH: {
        wikiname: 'ethereum',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    LUKSO: {
        wikiname: 'lukso',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    EVOLUTION: {
        wikiname: 'evolution',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    FLR: {
        wikiname: 'flr',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    CELO: {
        wikiname: 'celo',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    BTC: {
        wikiname: 'bitcoin',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    DASH: {
        wikiname: 'dash',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    LTC: {
        wikiname: 'litecoin',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    XMR: {
        wikiname: 'monero',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    BCH: {
        wikiname: 'bitcoincash',
        storeBlockFile: true,
        deleteBlocksOlderThanSeconds: 90000,
        txsCollection: true
    },
    ARBI: {
        wikiname: 'arbitrum',
        rollup: true,
        storeBlockFile: false,
        deleteBlocksOlderThanSeconds: 3600,
        deleteBlocksAmount: 200,
        txsCollection: false
    },
    LUMIA: {
        wikiname: 'lumia',
        rollup: true,
        storeBlockFile: false,
        deleteBlocksOlderThanSeconds: 3600,
        deleteBlocksAmount: 200,
        txsCollection: false
    },
    MANTA: {
        wikiname: 'manta-pacific',
        rollup: true,
        storeBlockFile: false,
        deleteBlocksOlderThanSeconds: 3600,
        deleteBlocksAmount: 200,
        txsCollection: false
    }
}