import ChainImplementation from '../../implementation'; 
import { Logger, getPriceAtTime, decRound } from '../../../../lib/utilities';
import { AnyHedgeManager } from '@generalprotocols/anyhedge';
import { BCHWrapper } from '../../../../lib/node-wrappers';

class AnyHedge extends ChainImplementation {
    public manager: AnyHedgeManager = new AnyHedgeManager();

    public mongodb: any;
    public redis: any; 

    async init(mongodb: any, redis: any): Promise<ChainImplementation> {
        this.mongodb = mongodb;
        this.redis = redis; 
        return this; 
    }

    // This implementation is a bit weird, as we need the data from validate, could possiblly refactor this
    // later to parse a Promise<any> from validate and feed it through to execute. 
    async validate(transaction: any): Promise<boolean> {
        return true;
    }

    async execute(transaction: any): Promise<boolean> {
        try {
            let parsed: any = null; 
            try {
                parsed = await this.manager.parseSettlementTransaction(transaction.hex); 
                if(!parsed || !parsed.settlement || !parsed.settlement.hedgeSatoshis || !parsed.settlement.longSatoshis || !parsed.settlement.oraclePrice || !parsed.settlement.settlementType)
                    return false; 
            } catch (error) { return false; }
            if(!parsed) return false; 

            let hedgeSatoshis = Number(parsed.settlement.hedgeSatoshis); 
            let longSatoshis = Number(parsed.settlement.longSatoshis);
            let totalSizeSatoshis = hedgeSatoshis + longSatoshis; 
            let totalSize = totalSizeSatoshis / 1e8; 
            let oraclePrice = Number(parsed.settlement.oraclePrice) / 100; 
            let hedgeUSDPayout = (hedgeSatoshis / 1e8) * oraclePrice; 
            let totalValueUSD = totalSize * oraclePrice; 
            let action = parsed.settlement.settlementType;
            let actionText = "settled"; 
            if(!transaction.extras)
                transaction.extras = {};
            transaction.extras.houseTween = "check"; 
            let endText = ""; 

            if(action === "liquidation") {
                actionText = "liquidated"
                transaction.extras.houseTween = "x"; 
                endText = ` at $${oraclePrice}`;
            }

            let wrapper = new BCHWrapper({ username: 'user', password: 'pass', host: process.env.BCH_NODE as string, port: 8332 }); 
            let fundingTx = await wrapper.getTransaction(parsed.funding.fundingTransaction, 2);
			if (!fundingTx || !fundingTx.time || !(Number(fundingTx.time) > 2)) {
				//failed getting transaction with time
				this._basicMessage(transaction, totalValueUSD, actionText, endText);
				return true;
			}

			let txTime = Number(fundingTx.time);
			let fundingPrice = await getPriceAtTime('BCH', txTime - 200, txTime + 200);
			if (!fundingPrice || !Array.isArray(fundingPrice) || !(Number(fundingPrice[1]) > 2)) {
				//funding price get unsuccessful
				this._basicMessage(transaction, totalValueUSD, actionText, endText);
				return true;
			}
			//successfully got a price
			let approxFundingPrice = Number(fundingPrice[1]);
			let hedgeInSatoshis = Number(hedgeUSDPayout / approxFundingPrice) * 1e8;
			let longInSatoshis = Number(totalSizeSatoshis - hedgeInSatoshis);
			let longProfits = Number(longSatoshis - longInSatoshis) / 1e8;
			this._advancedMessage(transaction, actionText, totalValueUSD, hedgeInSatoshis, hedgeUSDPayout, longProfits, endText);
            transaction.house = "anyhedge"
            return true;
        } catch (error) {
            Logger.error(error); 
            return false; 
        }
    }

    _basicMessage = (transaction: any, totalValueUSD: number, actionText: string,  endText: string) => {
        if(!transaction.extras)
            transaction.extras = {};
        transaction.extras.showBubble = true;
        transaction.extras.houseContent = `${actionText.charAt(0).toUpperCase()}${actionText.slice(1)} $${Math.round(totalValueUSD)} contract${endText}`; 
    }

    _advancedMessage = (transaction: any, actionText: string, totalValueUSD: number, hedgeInSatoshis: number, hedgeUSDPayout: number, longProfits: number, endText: string) => {
        if(!transaction.extras) 
            transaction.extras = {};
        transaction.extras.showBubble = true;
        let startText = `$${Math.round(hedgeUSDPayout)} hedge settled`; 
        if(actionText === "liquidated") 
            startText = `~${decRound(Math.abs(hedgeInSatoshis / 1e8))} BCH liquidated`; 
        else if(longProfits > 0)
            startText = `~${decRound(longProfits)} BCH profit`
        transaction.extras.houseContent = `${startText} from $${Math.round(totalValueUSD)} contract${endText}`; 
    }
}

export default new AnyHedge('BCH'); 