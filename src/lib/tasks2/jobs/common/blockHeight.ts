import { ProjectedEthereumBlock, ProjectedXMRBlock, ProjectedSolanaBlock } from '../../types';

export default (latestBlock: ProjectedEthereumBlock | ProjectedXMRBlock | ProjectedSolanaBlock) => {
    return latestBlock.height;
}