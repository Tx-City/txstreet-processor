import { ProjectedSolanaBlock, ProjectedSolanaTransaction } from "../../../types";

export default (block: any, transactions: any) => {
    // Example calculations for block statistics relevant to Solana

    const stats = {
        totalTransactions: transactions.length,
        totalFees: 0, // Aggregate transaction fees
        // You can add more statistics as needed
    };

    transactions.forEach((transaction: any) => {
        // Assuming transaction.fee exists and holds the transaction fee
        stats.totalFees += transaction.fee || 0; // Default to 0 if fee is not present
    });

    // Here you can add more calculations or format the stats as needed
    const formattedStats = {
        blockHash: block.blockhash, // Solana blockhash
        blockHeight: block.slot, // Solana slot is equivalent to block height
        ...stats,
    };

    return formattedStats; // Return the calculated statistics
}
