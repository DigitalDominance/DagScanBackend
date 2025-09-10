import { Router } from "express";
import networkController from "../controllers/networkController";

const networkRouter = Router();

networkRouter.post('/details/address', networkController.getAddressDetailsAPI);
networkRouter.post('/details/address/transaction_history', networkController.getAddressTransactionHistoryAPI);
networkRouter.post('/details/address/token_transfers', networkController.getTokenTransfersAPI);
networkRouter.post('/details/address/nfts', networkController.getAddressNFTsAPI);
networkRouter.post('/details/address/balance', networkController.getAddressTokenBalancesAPI);
networkRouter.post('/search/hash', networkController.searchByHashAPI);
networkRouter.post('/details/contract', networkController.getSmartContractDetailsAPI);
networkRouter.post('/token/info', networkController.getTokenInfoAPI);
networkRouter.post('/token/holders', networkController.getTokenHoldersAPI);
networkRouter.post('/contract/nft', networkController.getContractNFTsAPI);
networkRouter.post('/token/transfers', networkController.getTokenTransfersAPI);
networkRouter.post('/stats', networkController.getStatsAPI);
networkRouter.post('/stats/charts/transactions', networkController.getStatsTransactionsAPI);

export default networkRouter;