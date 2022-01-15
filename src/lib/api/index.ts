import { Router } from 'express';
import blockchainRouter from './blockchain';
import nftRouter from "./nft";
import wikiRouter from './wiki';

const apiRouter = Router();
apiRouter.use('/blockchain', blockchainRouter);
apiRouter.use('/wiki', wikiRouter);
apiRouter.use('/nft', nftRouter);

export default apiRouter;