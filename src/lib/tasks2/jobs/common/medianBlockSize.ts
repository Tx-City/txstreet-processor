import { median } from '../../../../lib/utilities';
import { ProjectedEthereumBlock, ProjectedXMRBlock, ProjectedEvolutionBlock } from '../../types';

export default (blocks: ProjectedEthereumBlock[] | ProjectedXMRBlock[] | ProjectedEvolutionBlock[]) => {
    return median(blocks.map((block: any) => block.size), true);
}