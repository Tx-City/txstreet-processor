import { Router } from 'express';
import blockchainRouter from './blockchain';
import wikiRouter from './wiki';

const apiRouter = Router();
apiRouter.use('/blockchain', blockchainRouter);
apiRouter.use('/wiki', wikiRouter);

export default apiRouter;