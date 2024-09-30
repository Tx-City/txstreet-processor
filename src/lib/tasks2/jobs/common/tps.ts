import { ProjectedBTCTransaction, ProjectedEthereumTransaction, ProjectedXMRTransaction, ProjectedSolanaTransaction } from '../../types';

export default (transactions: ProjectedEthereumTransaction[] | ProjectedXMRTransaction[] | ProjectedBTCTransaction[] | ProjectedSolanaTransaction[]) => {
    return Number((transactions.length / 300).toFixed(2));
}