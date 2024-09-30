import { median } from '../../../../lib/utilities';
import { ProjectedEthereumBlock, ProjectedXMRBlock, ProjectedSolanaBlock } from '../../types';

export default (blocks: ProjectedEthereumBlock[] | ProjectedXMRBlock[] | ProjectedSolanaBlock[]) => {
    return median(blocks.map((block: any) => block.transactions), true);
}