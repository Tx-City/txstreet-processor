import axios from "axios";
import { isNull } from "util";

export default async (ticker: string, fromTime: number, toTime: number) => {
    let retriesLeft = 5; 
    let results: any = null; 
    let name: string | null = null; 

    switch(ticker) {
        case 'BTC':
            name = 'bitcoin'; 
            break;
        case 'DASH':
            name = 'dash'; 
            break;
        case 'BCH': 
            name = 'bitcoin-cash'; 
            break;
        case 'LTC': 
            name = 'litecoin';
            break;
        case 'ETH':
            name = 'ethereum'; 
            break;
        case 'LUKSO':
            name = 'lukso-token-2'; //lukso-token-2
            break;
        case 'EVOLUTION':
            name = 'evolution'; 
            break;
        // case 'FLR':
        //     name = 'flare'; //flare
        //     break;
        // case 'CELO':
        //     name = 'celo'; 
        //     break;
        case 'XMR':
            name = 'monero'; 
            break;
    }

    if(!name) return null;


    const makeRequest = async (): Promise<any> => {
        try {
            const result = await axios.get(`https://api.coingecko.com/api/v3/coins/${name}/market_chart/range?vs_currency=${'usd'}&from=${fromTime}&to=${toTime}`)
            if(!result || result.status !== 200) {
                if(!result.data && !result.data.prices || !result.data.prices.length) {
                    fromTime -= 200;
                    toTime += 200;
                }
                if(--retriesLeft < 0) return null;
                return makeRequest(); 
            } else {
                console.log("FINDING LUKSO PRICE ===",result);
                let index = Math.floor(result.data.prices.length / 2); 
                results = result.data.prices[index];
            }
        } catch (error) {
            console.error(error); 
        } finally {
            if(results) return results; 
            if(--retriesLeft < 0) return null;
            return makeRequest(); 
        }
    }
    return await makeRequest(); 
}