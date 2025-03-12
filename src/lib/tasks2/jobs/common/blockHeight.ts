import { ProjectedEthereumBlock, ProjectedXMRBlock, ProjectedEvolutionBlock } from '../../types';

export default (latestBlock: ProjectedEthereumBlock | ProjectedXMRBlock | ProjectedEvolutionBlock) => {
    return latestBlock.height;
}