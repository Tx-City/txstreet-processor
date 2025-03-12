import { ProjectedBTCTransaction, ProjectedEthereumTransaction, ProjectedXMRTransaction, ProjectedEvolutionTransaction } from '../../types';

export default (transactions: ProjectedEthereumTransaction[] | ProjectedXMRTransaction[] | ProjectedBTCTransaction[] | ProjectedEvolutionTransaction[]) => {
    return Number((transactions.length / 300).toFixed(2));
}