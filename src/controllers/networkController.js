"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
// Mock verified contracts registry - in a real app this would come from an API
const VERIFIED_CONTRACTS = {
    "0xa0b86991c31cc0c0c0c0c0c0c0c0c0c0c0c0c0c0c": {
        isContract: true,
        isVerified: true,
        name: "USD Coin",
        symbol: "USDC",
        decimals: 6,
        contractType: "ERC20",
    },
    "0xdac17f958d2ee523a2206206994597c13d831ec7": {
        isContract: true,
        isVerified: true,
        name: "Tether USD",
        symbol: "USDT",
        decimals: 6,
        contractType: "ERC20",
    },
    "0x6b175474e89094c44da98b954eedeac495271d0f": {
        isContract: true,
        isVerified: true,
        name: "Dai Stablecoin",
        symbol: "DAI",
        decimals: 18,
        contractType: "ERC20",
    },
};
// Mock data for when RPC is unavailable
const MOCK_DATA = {
    latestBlockNumber: 1234567,
    blocks: [
        {
            number: "0x12d687",
            hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            timestamp: "0x" + Math.floor(Date.now() / 1000).toString(16),
            transactions: ["0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
            gasUsed: "0x5208",
            gasLimit: "0x1c9c380",
            miner: "0x1234567890123456789012345678901234567890",
            parentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            difficulty: "0x1bc16d674ec80000",
            size: "0x220",
        },
    ],
    transactions: [
        {
            hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            from: "0x1234567890123456789012345678901234567890",
            to: "0x0987654321098765432109876543210987654321",
            value: "0xde0b6b3a7640000",
            gasPrice: "0x4a817c800",
            gas: "0x5208",
            input: "0x",
            blockNumber: "0x12d687",
            blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            transactionIndex: "0x0",
            nonce: "0x1",
        },
    ],
    receipts: [
        {
            status: "0x1",
            gasUsed: "0x5208",
        },
    ],
};
class NetWorkController {
    constructor() {
        //   private rpcUrls: string[]
        //   private explorerApiUrls: string[]
        //   private chainId: number
        this.currentRpcIndex = 0;
        this.useMockData = false;
        this.baseApiUrl = "https://api-explorer.kasplex.org/api/v2";
        this.switchNetwork = (network) => {
            if (network === "kasplex") {
                return {
                    rpcUrls: [
                        "https://evmrpc.kasplex.org/",
                        "https://evmrpc.kasplex.org/",
                    ],
                    explorerApiUrls: [
                        "https://api-explorer.kasplex.org/api/v2",
                        "https:/explorer.kasplex.org/api",
                        "https://explorer.kasplex.org/v1",
                        "https://explorer.kasplex.org/v1",
                        "https://explorer.kasplex.org/api/v2",
                    ],
                    chainId: 167012,
                    baseApiUrl: "https://api-explorer.kasplex.org/api/v2",
                };
            }
            else {
                return {
                    rpcUrls: ["https://caravel.igralabs.com:8545"],
                    explorerApiUrls: ["https://explorer.caravel.igralabs.com/api/v2"],
                    chainId: 19416,
                    baseApiUrl: "https://explorer.caravel.igralabs.com/api/v2",
                };
            }
        };
        this.getAddressTransactionHistoryAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, limit, network } = req.body;
                const config = this.switchNetwork(network);
                const transactionHistory = yield this.getAddressTransactionHistory(config, address, limit || 100);
                res.status(200).json({ transactionHistory });
            }
            catch (error) {
                console.error("Error in getAddressTransactionHistoryAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getAddressTokenBalancesAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, network } = req.body;
                const config = this.switchNetwork(network);
                const tokenBalances = yield this.getAddressTokenBalances(config, address);
                res.status(200).json({ tokenBalances });
            }
            catch (error) {
                console.error("Error in getAddressTokenBalancesAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getAddressTokenTransfersAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, limit, network } = req.body;
                const config = this.switchNetwork(network);
                const tokenTransfers = yield this.getAddressTokenTransfers(config, address, limit || 50);
                res.status(200).json({ tokenTransfers });
            }
            catch (error) {
                console.error("Error in getAddressTokenTransfersAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getAddressNFTsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, limit, network } = req.body;
                const config = this.switchNetwork(network);
                const nfts = yield this.getAddressNFTs(config, address, limit || 50);
                res.status(200).json({ nfts });
            }
            catch (error) {
                console.error("Error in getAddressNFTsAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getAddressDetailsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, network } = req.body;
                if (!address || typeof address !== "string") {
                    return res.status(400).json({ error: "Missing or invalid 'query' parameter" });
                }
                const config = this.switchNetwork(network);
                const addressDetails = yield this.getAddressDetails(config, address);
                res.status(200).json({ addressDetails });
            }
            catch (error) {
                console.error("Error in getAddressDetailsAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.searchByHashAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { query, network } = req.body;
                const config = this.switchNetwork(network);
                const result = yield this.searchByHash(config, query);
                res.status(200).json({ result });
            }
            catch (error) {
                console.error("Error in searchByHashAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getSmartContractDetailsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, network } = req.body;
                const config = this.switchNetwork(network);
                const smartcontractDetails = yield this.getSmartContractDetails(config, address);
                res.status(200).json({ smartcontractDetails });
            }
            catch (error) {
                console.error("Error in getSmartContractDetailsAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getTokenInfoAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, network } = req.body;
                const config = this.switchNetwork(network);
                const tokenInfo = yield this.getTokenInfo(config, address);
                res.status(200).json({ tokenInfo });
            }
            catch (error) {
                console.error("Error in getTokenInfoAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getTokenHoldersAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, limit, network } = req.body;
                const config = this.switchNetwork(network);
                const holdersData = yield this.getTokenHolders(config, address, limit || 50);
                res.status(200).json({ holdersData });
            }
            catch (error) {
                console.error("Error in getTokenHoldersAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getContractNFTsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, limit, network } = req.body;
                const config = this.switchNetwork(network);
                const nftData = yield this.getContractNFTs(config, address, limit);
                res.status(200).json({ nftData });
            }
            catch (error) {
                console.error("Error in getContractNFTsAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getTokenTransfersAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { address, limit, network } = req.body;
                const config = this.switchNetwork(network);
                const transfers = yield this.getTokenTransfers(config, address, limit);
                res.status(200).json({ transfers });
            }
            catch (error) {
                console.error("Error in getTokenTransfersAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getStatsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { network } = req.body;
                console.log('Network: ', network);
                const config = this.switchNetwork(network);
                console.log('Base API Config:', config);
                const stats = (yield axios_1.default.get(`${config.baseApiUrl}/stats`)).data;
                res.status(200).json({ stats });
            }
            catch (error) {
                console.error("Error in getStatsAPI:", error);
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getStatsTransactionsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { network } = req.body;
                console.log('Network: ', network);
                const config = this.switchNetwork(network);
                console.log('Base API Config:', config);
                const transactions = (yield axios_1.default.get(`${config.baseApiUrl}/stats/charts/transactions`)).data;
                res.status(200).json({ transactions });
            }
            catch (error) {
                console.error("Error in getStatsTransactionsAPI:");
                res.status(500).json({ error: "Internal server error" });
            }
        });
        this.getLatestBlocksAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { count, network } = req.body;
            try {
                const config = this.switchNetwork(network);
                const blocks = (yield axios_1.default.get(`${config.baseApiUrl}/blocks?type=block`)).data.items;
                // res.status(200).json({ blocks });
                const customBlocks = blocks.slice(0, count).map((block) => ({
                    number: block.height,
                    hash: block.hash,
                    timestamp: new Date(block.timestamp).getTime(),
                    transactions: block.transactions_count || 0,
                    gasUsed: block.gas_used || "0",
                    gasLimit: block.gas_limit || '0',
                    miner: block.miner.hash,
                }));
                res.status(200).json({ blocks: customBlocks });
            }
            catch (error) {
                console.error("Failed to fetch latest blocks:", error);
                const blocks = Array.from({ length: count }, (_, i) => ({
                    number: MOCK_DATA.latestBlockNumber - i,
                    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                    timestamp: Date.now() - i * 12000,
                    transactions: Math.floor(Math.random() * 50),
                    gasUsed: "21000",
                    gasLimit: "30000000",
                    miner: "0x1234567890123456789012345678901234567890",
                }));
                res.status(200).json({ blocks });
            }
        });
        this.getLatestTransactionsAPI = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { count, network } = req.body;
            try {
                const config = this.switchNetwork(network);
                const transactions = (yield axios_1.default.get(`${config.baseApiUrl}/transactions?filter=validated`)).data.items;
                const customTransactions = transactions.slice(0, count).map((transaction) => ({
                    hash: transaction.hash,
                    from: transaction.from.hash,
                    to: transaction.to.hash,
                    toInfo: {
                        isContract: transaction.to.is_contract,
                        isVerified: transaction.to.is_verified
                    },
                    value: transaction.value / 1e18,
                    gasPrice: transaction.gas_price / 1e18,
                    timestamp: transaction.timestamp,
                    status: transaction.status === "ok" ? "success" : "failed",
                    type: ["KAS Transfer", "Token Transfer", "Contract Call"][transaction.type],
                    input: transaction.raw_input
                }));
                res.status(200).json({ transactions: customTransactions });
            }
            catch (error) {
                console.error("Failed to fetch latest transactions:", error);
                const transactions = Array.from({ length: count }, () => ({
                    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                    from: "0x1234567890123456789012345678901234567890",
                    to: "0x0987654321098765432109876543210987654321",
                    toInfo: { isContract: false, isVerified: false },
                    value: (Math.random() * 10).toFixed(4),
                    gasPrice: (20 + Math.random() * 50).toFixed(2),
                    timestamp: Date.now() - Math.random() * 3600000,
                    status: Math.random() > 0.1 ? "success" : "failed",
                    type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
                    input: "0x",
                }));
                res.status(200).json({ transactions });
            }
        });
        // this.rpcUrls = [];
        // this.explorerApiUrls = [];
        // this.chainId = 167012
        this.switchNetwork = this.switchNetwork.bind(this);
    }
    isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    isValidTxHash(hash) {
        return /^0x[a-fA-F0-9]{64}$/.test(hash);
    }
    // Try explorer APIs first for indexed data
    explorerApiCall(endpoint_1) {
        return __awaiter(this, arguments, void 0, function* (endpoint, params = {}, config) {
            for (const baseUrl of config.explorerApiUrls) {
                try {
                    const url = new URL(endpoint, baseUrl);
                    Object.entries(params).forEach(([key, value]) => {
                        url.searchParams.append(key, String(value));
                    });
                    console.log(`🔍 Trying explorer API: ${url.toString()}`);
                    const response = yield fetch(url.toString(), {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        signal: AbortSignal.timeout(15000),
                    });
                    if (response.ok) {
                        const data = yield response.json();
                        console.log(`✅ Explorer API success: ${baseUrl}`);
                        return data;
                    }
                    else {
                        console.warn(`❌ Explorer API failed: ${response.status} ${response.statusText}`);
                    }
                }
                catch (error) {
                    console.warn(`❌ Explorer API error for ${baseUrl}:`, error.message);
                }
            }
            return null;
        });
    }
    rpcCall(config_1, method_1) {
        return __awaiter(this, arguments, void 0, function* (config, method, params = [], retries = 3) {
            if (this.useMockData) {
                return this.getMockResponse(method, params, config);
            }
            let lastError = null;
            for (let rpcIndex = 0; rpcIndex < config.rpcUrls.length; rpcIndex++) {
                const rpcUrl = config.rpcUrls[rpcIndex];
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000);
                        const response = yield fetch(rpcUrl, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                                jsonrpc: "2.0",
                                method,
                                params,
                                id: Date.now(),
                            }),
                            signal: controller.signal,
                        });
                        clearTimeout(timeoutId);
                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }
                        const data = yield response.json();
                        if (data.error) {
                            throw new Error(`RPC Error: ${data.error.message}`);
                        }
                        this.currentRpcIndex = rpcIndex;
                        return data.result;
                    }
                    catch (error) {
                        lastError = error;
                        console.warn(`RPC call failed for ${method} (attempt ${attempt + 1}/${retries}) on ${rpcUrl}:`, error.message);
                        if (attempt < retries - 1) {
                            yield new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500));
                        }
                    }
                }
            }
            console.error(`All RPC endpoints failed for ${method}. Switching to mock data mode.`);
            this.useMockData = true;
            return this.getMockResponse(method, params, config);
        });
    }
    getMockResponse(method, params, config) {
        switch (method) {
            case "eth_blockNumber":
                return `0x${MOCK_DATA.latestBlockNumber.toString(16)}`;
            case "eth_getBlockByNumber":
                const blockNumber = params[0];
                const includeTransactions = params[1];
                const mockBlock = Object.assign({}, MOCK_DATA.blocks[0]);
                if (blockNumber !== "latest") {
                    const num = typeof blockNumber === "string" ? Number.parseInt(blockNumber, 16) : blockNumber;
                    mockBlock.number = `0x${num.toString(16)}`;
                }
                if (!includeTransactions) {
                    mockBlock.transactions = mockBlock.transactions.map((tx) => (typeof tx === "string" ? tx : tx));
                }
                return mockBlock;
            case "eth_getTransactionByHash":
                return MOCK_DATA.transactions[0];
            case "eth_getTransactionReceipt":
                return MOCK_DATA.receipts[0];
            case "eth_gasPrice":
                return "0x4a817c800";
            case "eth_getBalance":
                return "0xde0b6b3a7640000";
            case "eth_getCode":
                return "0x";
            case "eth_getTransactionCount":
                return "0xa";
            case "eth_call":
                return "0x0";
            case "eth_getLogs":
                return [
                    {
                        address: "0x1234567890123456789012345678901234567890",
                        topics: ["0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
                        data: "0x",
                        blockNumber: "0x12d687",
                        transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                        transactionIndex: "0x0",
                        blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                        logIndex: "0x0",
                    },
                ];
            default:
                console.warn(`Mock response not implemented for method: ${method}`);
                return null;
        }
    }
    getCode(address, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.rpcCall(config, "eth_getCode", [address, "latest"]);
            }
            catch (error) {
                return "0x";
            }
        });
    }
    getContractInfo(config, address) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isValidAddress(address)) {
                return { isContract: false, isVerified: false };
            }
            const verified = VERIFIED_CONTRACTS[address.toLowerCase()];
            if (verified) {
                return verified;
            }
            try {
                const code = yield this.getCode(address, config);
                const isContract = code !== "0x" && code.length > 2;
                if (isContract) {
                    return {
                        isContract: true,
                        isVerified: false,
                        contractType: "Other",
                    };
                }
                return { isContract: false, isVerified: false };
            }
            catch (error) {
                console.error("Error getting contract info:", error);
                return { isContract: false, isVerified: false };
            }
        });
    }
    detectTransactionType(tx, receipt) {
        if (!tx.to) {
            return "Contract Creation";
        }
        if (tx.input && tx.input !== "0x" && tx.input.length > 2) {
            const methodId = tx.input.slice(0, 10);
            const erc20Methods = {
                "0xa9059cbb": "Token Transfer",
                "0x23b872dd": "Token Transfer From",
                "0x095ea7b3": "Token Approval",
                "0x18160ddd": "Total Supply Call",
                "0x70a08231": "Balance Query",
                "0xdd62ed3e": "Allowance Query",
            };
            const erc721Methods = {
                "0x42842e0e": "NFT Transfer",
                "0x23b872dd": "NFT Transfer From",
                "0x6352211e": "NFT Owner Query",
                "0x081812fc": "NFT Approval Query",
            };
            const defiMethods = {
                "0x7ff36ab5": "Swap KAS→Tokens",
                "0x18cbafe5": "Swap Tokens→KAS",
                "0x38ed1739": "Swap Tokens",
                "0xb6f9de95": "Swap KAS→Tokens",
                "0xe8e33700": "Add Liquidity",
                "0x02751cec": "Remove Liquidity",
                "0xa694fc3a": "Stake",
                "0x2e1a7d4d": "Withdraw",
            };
            if (erc20Methods[methodId])
                return erc20Methods[methodId];
            if (erc721Methods[methodId])
                return erc721Methods[methodId];
            if (defiMethods[methodId])
                return defiMethods[methodId];
            return "Contract Call";
        }
        if (tx.value && tx.value !== "0x0") {
            return "KAS Transfer";
        }
        return "Transaction";
    }
    getLatestBlockNumber(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.rpcCall(config, "eth_blockNumber");
            return Number.parseInt(result, 16);
        });
    }
    getBlock(config_1, blockNumber_1) {
        return __awaiter(this, arguments, void 0, function* (config, blockNumber, includeTransactions = false) {
            const blockParam = blockNumber === "latest" ? "latest" : `0x${blockNumber.toString(16)}`;
            return yield this.rpcCall(config, "eth_getBlockByNumber", [blockParam, includeTransactions]);
        });
    }
    getTransaction(config, txHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.rpcCall(config, "eth_getTransactionByHash", [txHash]);
        });
    }
    getTransactionReceipt(config, txHash) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.rpcCall(config, "eth_getTransactionReceipt", [txHash]);
        });
    }
    getGasPrice(config) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.rpcCall(config, "eth_gasPrice");
            return (Number.parseInt(result, 16) / 1e9).toFixed(2);
        });
    }
    getBalance(address, config) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.rpcCall(config, "eth_getBalance", [address, "latest"]);
            return (Number.parseInt(result, 16) / 1e18).toFixed(4);
        });
    }
    getNetworkStats(config) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const [latestBlockNumber, gasPrice] = yield Promise.all([this.getLatestBlockNumber(config), this.getGasPrice(config)]);
                const latestBlock = yield this.getBlock(config, latestBlockNumber, true);
                const blockPromises = [];
                for (let i = 0; i < 5; i++) {
                    blockPromises.push(this.getBlock(config, latestBlockNumber - i));
                }
                const blocks = yield Promise.all(blockPromises);
                const blockTimes = [];
                for (let i = 0; i < blocks.length - 1; i++) {
                    const timeDiff = Number.parseInt(blocks[i].timestamp, 16) - Number.parseInt(blocks[i + 1].timestamp, 16);
                    blockTimes.push(timeDiff);
                }
                const avgBlockTime = blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 12;
                return {
                    latestBlock: latestBlockNumber,
                    totalTransactions: ((_a = latestBlock.transactions) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    avgBlockTime: avgBlockTime,
                    gasPrice,
                };
            }
            catch (error) {
                console.error("Failed to fetch network stats:", error);
                return {
                    latestBlock: MOCK_DATA.latestBlockNumber,
                    totalTransactions: 15,
                    avgBlockTime: 12.5,
                    gasPrice: "20.00",
                };
            }
        });
    }
    getLatestBlocks(config_1) {
        return __awaiter(this, arguments, void 0, function* (config, count = 10) {
            try {
                const latestBlockNumber = yield this.getLatestBlockNumber(config);
                const blockPromises = [];
                for (let i = 0; i < count; i++) {
                    blockPromises.push(this.getBlock(config, latestBlockNumber - i, true));
                }
                const blocks = yield Promise.all(blockPromises);
                return blocks.map((block, index) => {
                    var _a;
                    return ({
                        number: Number.parseInt(block.number, 16),
                        hash: block.hash || `0x${Math.random().toString(16).substr(2, 64)}`,
                        timestamp: Number.parseInt(block.timestamp, 16) * 1000,
                        transactions: ((_a = block.transactions) === null || _a === void 0 ? void 0 : _a.length) || Math.floor(Math.random() * 50),
                        gasUsed: Number.parseInt(block.gasUsed || "0", 16).toString(),
                        gasLimit: Number.parseInt(block.gasLimit || "0", 16).toString(),
                        miner: block.miner || "0x1234567890123456789012345678901234567890",
                    });
                });
            }
            catch (error) {
                console.error("Failed to fetch latest blocks:", error);
                return Array.from({ length: count }, (_, i) => ({
                    number: MOCK_DATA.latestBlockNumber - i,
                    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                    timestamp: Date.now() - i * 12000,
                    transactions: Math.floor(Math.random() * 50),
                    gasUsed: "21000",
                    gasLimit: "30000000",
                    miner: "0x1234567890123456789012345678901234567890",
                }));
            }
        });
    }
    getLatestTransactions(config_1) {
        return __awaiter(this, arguments, void 0, function* (config, count = 15) {
            try {
                const blocksToFetch = Math.min(15, Math.ceil(count / 3));
                const latestBlocks = yield this.getLatestBlocks(config, blocksToFetch);
                const allTransactions = [];
                for (const block of latestBlocks) {
                    try {
                        const fullBlock = yield this.getBlock(config, block.number, true);
                        if (fullBlock.transactions && Array.isArray(fullBlock.transactions)) {
                            for (const tx of fullBlock.transactions) {
                                if (typeof tx === "object" && tx.hash && this.isValidTxHash(tx.hash)) {
                                    try {
                                        const receipt = yield this.getTransactionReceipt(config, tx.hash);
                                        const txType = this.detectTransactionType(tx, receipt);
                                        let toInfo = null;
                                        if (tx.to) {
                                            try {
                                                toInfo = yield this.getContractInfo(config, tx.to);
                                            }
                                            catch (error) {
                                                console.error("Failed to get contract info:", error);
                                                toInfo = { isContract: false, isVerified: false };
                                            }
                                        }
                                        allTransactions.push({
                                            hash: tx.hash,
                                            from: tx.from,
                                            to: tx.to || "Contract Creation",
                                            toInfo,
                                            value: (Number.parseInt(tx.value || "0", 16) / 1e18).toFixed(4),
                                            gasPrice: (Number.parseInt(tx.gasPrice || "0", 16) / 1e9).toFixed(2),
                                            timestamp: Number.parseInt(fullBlock.timestamp, 16) * 1000,
                                            status: (receipt === null || receipt === void 0 ? void 0 : receipt.status) === "0x1" ? "success" : "failed",
                                            type: txType,
                                            input: tx.input || "0x",
                                        });
                                        if (allTransactions.length >= count) {
                                            break;
                                        }
                                    }
                                    catch (error) {
                                        console.error("Failed to get transaction receipt:", error);
                                    }
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error("Failed to get full block:", error);
                    }
                    if (allTransactions.length >= count) {
                        break;
                    }
                }
                allTransactions.sort((a, b) => b.timestamp - a.timestamp);
                while (allTransactions.length < count) {
                    const mockTx = {
                        hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                        from: "0x1234567890123456789012345678901234567890",
                        to: "0x0987654321098765432109876543210987654321",
                        toInfo: { isContract: false, isVerified: false },
                        value: (Math.random() * 10).toFixed(4),
                        gasPrice: (20 + Math.random() * 50).toFixed(2),
                        timestamp: Date.now() - Math.random() * 3600000,
                        status: Math.random() > 0.1 ? "success" : "failed",
                        type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
                        input: "0x",
                    };
                    allTransactions.push(mockTx);
                }
                return allTransactions.slice(0, count);
            }
            catch (error) {
                console.error("Failed to fetch latest transactions:", error);
                return Array.from({ length: count }, () => ({
                    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                    from: "0x1234567890123456789012345678901234567890",
                    to: "0x0987654321098765432109876543210987654321",
                    toInfo: { isContract: false, isVerified: false },
                    value: (Math.random() * 10).toFixed(4),
                    gasPrice: (20 + Math.random() * 50).toFixed(2),
                    timestamp: Date.now() - Math.random() * 3600000,
                    status: Math.random() > 0.1 ? "success" : "failed",
                    type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
                    input: "0x",
                }));
            }
        });
    }
    // NEW: Ultra-fast address transaction history using Kasplex Frontend API
    getAddressTransactionHistory(config_1, address_1) {
        return __awaiter(this, arguments, void 0, function* (config, address, limit = 100) {
            var _a;
            console.log(`🚀 Using Kasplex Frontend API for address: ${address}`);
            try {
                // Use the official Kasplex frontend API
                const apiUrl = `${config.baseApiUrl}/addresses/${address}/transactions`;
                console.log(`📡 Fetching from: ${apiUrl}`);
                const response = yield fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(15000),
                });
                if (!response.ok) {
                    throw new Error(`API responded with ${response.status}: ${response.statusText}`);
                }
                const data = yield response.json();
                console.log(`✅ API Success: Found ${((_a = data.items) === null || _a === void 0 ? void 0 : _a.length) || 0} transactions`);
                if (data.items && Array.isArray(data.items)) {
                    // Transform the API response to our format
                    const transactions = data.items.slice(0, limit).map((tx) => {
                        var _a, _b, _c;
                        // Determine transaction type from the API data
                        let txType = "Transaction";
                        if (tx.transaction_types && tx.transaction_types.length > 0) {
                            const type = tx.transaction_types[0];
                            switch (type) {
                                case "token_transfer":
                                    txType = "Token Transfer";
                                    break;
                                case "contract_creation":
                                    txType = "Contract Creation";
                                    break;
                                case "contract_call":
                                    txType = "Contract Call";
                                    break;
                                case "coin_transfer":
                                    txType = "KAS Transfer";
                                    break;
                                case "token_creation":
                                    txType = "Token Creation";
                                    break;
                                default:
                                    txType = "Transaction";
                            }
                        }
                        else if (tx.method) {
                            // Use method name if available
                            switch (tx.method) {
                                case "transfer":
                                    txType = "Token Transfer";
                                    break;
                                case "transferFrom":
                                    txType = "Token Transfer From";
                                    break;
                                case "approve":
                                    txType = "Token Approval";
                                    break;
                                default:
                                    txType = tx.method;
                            }
                        }
                        // Convert value from wei to KAS
                        let value = "0.0000";
                        if (tx.value && tx.value !== "0") {
                            try {
                                const valueInWei = typeof tx.value === "string" ? tx.value : tx.value.toString();
                                value = (Number.parseInt(valueInWei, 10) / 1e18).toFixed(4);
                            }
                            catch (error) {
                                console.warn("Error parsing value:", error);
                                value = "0.0000";
                            }
                        }
                        // Convert gas price
                        let gasPrice = "0.00";
                        if (tx.gas_price) {
                            try {
                                gasPrice = (Number.parseInt(tx.gas_price, 10) / 1e9).toFixed(2);
                            }
                            catch (error) {
                                console.warn("Error parsing gas price:", error);
                            }
                        }
                        // Parse timestamp
                        let timestamp = Date.now();
                        if (tx.timestamp) {
                            try {
                                timestamp = new Date(tx.timestamp).getTime();
                            }
                            catch (error) {
                                console.warn("Error parsing timestamp:", error);
                            }
                        }
                        return {
                            hash: tx.hash,
                            from: ((_a = tx.from) === null || _a === void 0 ? void 0 : _a.hash) || tx.from,
                            to: ((_b = tx.to) === null || _b === void 0 ? void 0 : _b.hash) || tx.to || "Contract Creation",
                            value,
                            gasPrice,
                            timestamp,
                            status: tx.status === "ok" ? "success" : "failed",
                            type: txType,
                            method: tx.method || "",
                            blockNumber: tx.block_number,
                            gasUsed: ((_c = tx.gas_used) === null || _c === void 0 ? void 0 : _c.toString()) || "0",
                            // Include contract info if available
                            fromInfo: tx.from
                                ? {
                                    isContract: tx.from.is_contract || false,
                                    isVerified: tx.from.is_verified || false,
                                    name: tx.from.name || undefined,
                                }
                                : null,
                            toInfo: tx.to
                                ? {
                                    isContract: tx.to.is_contract || false,
                                    isVerified: tx.to.is_verified || false,
                                    name: tx.to.name || undefined,
                                }
                                : null,
                        };
                    });
                    console.log(`🎯 Processed ${transactions.length} transactions successfully`);
                    return transactions.sort((a, b) => b.timestamp - a.timestamp);
                }
                console.warn("⚠️ API returned no transaction items");
                return [];
            }
            catch (error) {
                console.error("❌ Kasplex Frontend API failed:", error.message);
                // Fallback to mock data instead of complex RPC calls
                console.log("🔄 Using fallback mock data");
                return Array.from({ length: Math.min(10, limit) }, (_, i) => ({
                    hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                    from: "0x1234567890123456789012345678901234567890",
                    to: "0x0987654321098765432109876543210987654321",
                    value: (Math.random() * 10).toFixed(4),
                    gasPrice: (20 + Math.random() * 50).toFixed(2),
                    timestamp: Date.now() - i * 3600000,
                    status: Math.random() > 0.1 ? "success" : "failed",
                    type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
                    method: "",
                    blockNumber: 1234567 - i,
                    gasUsed: "21000",
                    fromInfo: { isContract: false, isVerified: false },
                    toInfo: { isContract: false, isVerified: false },
                }));
            }
        });
    }
    // NEW: Get token balances for an address
    getAddressTokenBalances(config, address) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const apiUrl = `${config.baseApiUrl}/addresses/${address}/token-balances`;
                const response = yield fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Token balances API failed: ${response.status}`);
                }
                const data = yield response.json();
                if (Array.isArray(data)) {
                    return data.map((balance) => {
                        var _a, _b, _c, _d, _e, _f;
                        return ({
                            token: {
                                address: (_a = balance.token) === null || _a === void 0 ? void 0 : _a.address,
                                name: (_b = balance.token) === null || _b === void 0 ? void 0 : _b.name,
                                symbol: (_c = balance.token) === null || _c === void 0 ? void 0 : _c.symbol,
                                decimals: (_d = balance.token) === null || _d === void 0 ? void 0 : _d.decimals,
                                type: (_e = balance.token) === null || _e === void 0 ? void 0 : _e.type,
                                icon_url: (_f = balance.token) === null || _f === void 0 ? void 0 : _f.icon_url,
                            },
                            value: balance.value,
                            token_id: balance.token_id,
                        });
                    });
                }
                return [];
            }
            catch (error) {
                console.error("Failed to get token balances:", error);
                return [];
            }
        });
    }
    // NEW: Get token transfers for an address
    getAddressTokenTransfers(config_1, address_1) {
        return __awaiter(this, arguments, void 0, function* (config, address, limit = 50) {
            try {
                const apiUrl = `${config.baseApiUrl}/addresses/${address}/token-transfers`;
                const response = yield fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Token transfers API failed: ${response.status}`);
                }
                const data = yield response.json();
                if (data.items && Array.isArray(data.items)) {
                    return data.items.slice(0, limit).map((transfer) => {
                        var _a, _b;
                        return ({
                            transaction_hash: transfer.transaction_hash,
                            from: (_a = transfer.from) === null || _a === void 0 ? void 0 : _a.hash,
                            to: (_b = transfer.to) === null || _b === void 0 ? void 0 : _b.hash,
                            token: transfer.token,
                            total: transfer.total,
                            method: transfer.method,
                            timestamp: transfer.timestamp,
                            type: transfer.type,
                        });
                    });
                }
                return [];
            }
            catch (error) {
                console.error("Failed to get token transfers:", error);
                return [];
            }
        });
    }
    // NEW: Get NFTs for an address
    getAddressNFTs(config_1, address_1) {
        return __awaiter(this, arguments, void 0, function* (config, address, limit = 50) {
            try {
                const apiUrl = `${config.baseApiUrl}/addresses/${address}/nft`;
                const response = yield fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`NFT API failed: ${response.status}`);
                }
                const data = yield response.json();
                if (data.items && Array.isArray(data.items)) {
                    return data.items.slice(0, limit).map((nft) => {
                        var _a;
                        return ({
                            id: nft.id,
                            token_type: nft.token_type,
                            value: nft.value,
                            is_unique: nft.is_unique,
                            image_url: nft.image_url || ((_a = nft.metadata) === null || _a === void 0 ? void 0 : _a.image_url),
                            animation_url: nft.animation_url,
                            external_app_url: nft.external_app_url,
                            metadata: nft.metadata,
                            token: nft.token,
                            holder_address_hash: nft.holder_address_hash,
                        });
                    });
                }
                return [];
            }
            catch (error) {
                console.error("Failed to get NFTs:", error);
                return [];
            }
        });
    }
    getAddressDetails(config, address) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isValidAddress(address)) {
                throw new Error(`Invalid address format: ${address}`);
            }
            try {
                const [balance, transactionCount, tokenBalances, nfts] = yield Promise.all([
                    this.getBalance(address, config),
                    this.rpcCall(config, "eth_getTransactionCount", [address, "latest"]),
                    this.getAddressTokenBalances(config, address), // Get token balances
                    this.getAddressNFTs(config, address), // NEW: Get NFTs
                ]);
                let contractInfo;
                try {
                    contractInfo = yield this.getContractInfo(config, address);
                }
                catch (error) {
                    console.error("Error getting contract info:", error);
                    contractInfo = { isContract: false, isVerified: false };
                }
                // Get transaction history using the new fast API
                const addressTransactions = yield this.getAddressTransactionHistory(config, address, 200);
                return {
                    type: "address",
                    address,
                    balance,
                    transactionCount: Number.parseInt(transactionCount, 16),
                    transactions: addressTransactions,
                    tokenBalances, // Include token balances
                    nfts, // NEW: Include NFTs
                    contractInfo,
                };
            }
            catch (error) {
                console.error("Failed to get address details:", error);
                throw error;
            }
        });
    }
    searchByHash(config, query) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanQuery = query.trim();
            if (this.isValidAddress(cleanQuery)) {
                return yield this.getAddressDetails(config, cleanQuery);
            }
            else if (this.isValidTxHash(cleanQuery)) {
                try {
                    const tx = yield this.getTransaction(config, cleanQuery);
                    if (tx) {
                        const receipt = yield this.getTransactionReceipt(config, cleanQuery);
                        const txType = this.detectTransactionType(tx, receipt);
                        let fromInfo = null;
                        let toInfo = null;
                        if (tx.from && this.isValidAddress(tx.from)) {
                            try {
                                fromInfo = yield this.getContractInfo(config, tx.from);
                            }
                            catch (error) {
                                console.error("Error getting from address contract info:", error);
                                fromInfo = { isContract: false, isVerified: false };
                            }
                        }
                        if (tx.to && this.isValidAddress(tx.to)) {
                            try {
                                toInfo = yield this.getContractInfo(config, tx.to);
                            }
                            catch (error) {
                                console.error("Error getting to address contract info:", error);
                                toInfo = { isContract: false, isVerified: false };
                            }
                        }
                        return Object.assign(Object.assign({ type: "transaction" }, tx), { fromInfo,
                            toInfo, status: (receipt === null || receipt === void 0 ? void 0 : receipt.status) === "0x1" ? "success" : "failed", gasUsed: (receipt === null || receipt === void 0 ? void 0 : receipt.gasUsed) || "0", timestamp: Date.now(), txType });
                    }
                }
                catch (error) {
                    console.error("Transaction not found, trying as block hash:", error);
                    try {
                        const block = yield this.rpcCall(config, "eth_getBlockByHash", [cleanQuery, true]);
                        if (block) {
                            return {
                                type: "block",
                                number: Number.parseInt(block.number, 16),
                                hash: block.hash,
                                timestamp: Number.parseInt(block.timestamp, 16) * 1000,
                                transactions: block.transactions || [],
                                gasUsed: block.gasUsed || "0",
                                gasLimit: block.gasLimit || "0",
                                miner: block.miner || "0x0000000000000000000000000000000000000000",
                                parentHash: block.parentHash || "",
                                difficulty: block.difficulty || "0",
                                size: block.size || "0",
                            };
                        }
                    }
                    catch (blockError) {
                        console.error("Not a valid block hash:", blockError);
                    }
                }
            }
            else if (/^\d+$/.test(cleanQuery)) {
                try {
                    const blockNumber = Number.parseInt(cleanQuery);
                    const block = yield this.getBlock(config, blockNumber, true);
                    if (block) {
                        return {
                            type: "block",
                            number: Number.parseInt(block.number, 16),
                            hash: block.hash,
                            timestamp: Number.parseInt(block.timestamp, 16) * 1000,
                            transactions: block.transactions || [],
                            gasUsed: block.gasUsed || "0",
                            gasLimit: block.gasLimit || "0",
                            miner: block.miner || "0x0000000000000000000000000000000000000000",
                            parentHash: block.parentHash || "",
                            difficulty: block.difficulty || "0",
                            size: block.size || "0",
                        };
                    }
                }
                catch (error) {
                    console.error("Invalid block number:", error);
                }
            }
            throw new Error("Invalid search query format");
        });
    }
    getBlockDetails(blockNumber, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const block = yield this.getBlock(config, blockNumber, true);
                return {
                    type: "block",
                    number: Number.parseInt(block.number, 16),
                    hash: block.hash,
                    timestamp: Number.parseInt(block.timestamp, 16) * 1000,
                    transactions: block.transactions || [],
                    gasUsed: block.gasUsed || "0",
                    gasLimit: block.gasLimit || "0",
                    miner: block.miner || "0x0000000000000000000000000000000000000000",
                    parentHash: block.parentHash || "",
                    difficulty: block.difficulty || "0",
                    size: block.size || "0",
                };
            }
            catch (error) {
                console.error("Failed to get block details:", error);
                throw error;
            }
        });
    }
    getTransactionDetails(txHash, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [tx, receipt] = yield Promise.all([this.getTransaction(config, txHash), this.getTransactionReceipt(config, txHash)]);
                if (!tx)
                    throw new Error("Transaction not found");
                const block = yield this.getBlock(config, Number.parseInt(tx.blockNumber, 16));
                const txType = this.detectTransactionType(tx, receipt);
                let fromInfo = null;
                let toInfo = null;
                if (tx.from) {
                    try {
                        fromInfo = yield this.getContractInfo(config, tx.from);
                    }
                    catch (error) {
                        fromInfo = { isContract: false, isVerified: false };
                    }
                }
                if (tx.to) {
                    try {
                        toInfo = yield this.getContractInfo(config, tx.to);
                    }
                    catch (error) {
                        toInfo = { isContract: false, isVerified: false };
                    }
                }
                return {
                    type: "transaction",
                    hash: tx.hash,
                    from: tx.from,
                    fromInfo,
                    to: tx.to || "Contract Creation",
                    toInfo,
                    value: (Number.parseInt(tx.value || "0", 16) / 1e18).toFixed(4),
                    gasPrice: (Number.parseInt(tx.gasPrice || "0", 16) / 1e9).toFixed(2),
                    gasUsed: (receipt === null || receipt === void 0 ? void 0 : receipt.gasUsed) || "0",
                    gasLimit: tx.gas || "0",
                    timestamp: Number.parseInt(block.timestamp, 16) * 1000,
                    status: (receipt === null || receipt === void 0 ? void 0 : receipt.status) === "0x1" ? "success" : "failed",
                    blockNumber: Number.parseInt(tx.blockNumber, 16),
                    blockHash: tx.blockHash,
                    transactionIndex: Number.parseInt(tx.transactionIndex, 16),
                    nonce: tx.nonce,
                    input: tx.input || "0x",
                    txType,
                };
            }
            catch (error) {
                console.error("Failed to get transaction details:", error);
                throw error;
            }
        });
    }
    // NEW: Get smart contract details using the new API endpoints
    getSmartContractDetails(config, address) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const apiUrl = `${config.baseApiUrl}/smart-contracts/${address}`;
                const response = yield fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Smart contract API failed: ${response.status}`);
                }
                const data = yield response.json();
                return data;
            }
            catch (error) {
                console.error("Failed to get smart contract details:", error);
                return null;
            }
        });
    }
    // NEW: Get token info using the new API endpoints
    getTokenInfo(config, address) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const apiUrl = `${config.baseApiUrl}/tokens/${address}`;
                const response = yield fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Token info API failed: ${response.status}`);
                }
                const data = yield response.json();
                return data;
            }
            catch (error) {
                console.error("Failed to get token info:", error);
                return null;
            }
        });
    }
    // NEW: Get contract source code
    getContractCode(address, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First try to get smart contract details which includes source code
                const contractDetails = yield this.getSmartContractDetails(config, address);
                if (contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.source_code) {
                    return { code: contractDetails.source_code };
                }
                // Fallback to RPC call for bytecode
                const code = yield this.rpcCall(config, "eth_getCode", [address, "latest"]);
                if (code && code !== "0x" && code.length > 2) {
                    return { code };
                }
                return null;
            }
            catch (error) {
                console.error("Failed to get contract code:", error);
                return null;
            }
        });
    }
    // NEW: Get contract metadata (token info, etc.)
    getContractMetadata(address, config) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Try to get both smart contract details and token info
                const [contractDetails, tokenInfo] = yield Promise.all([
                    this.getSmartContractDetails(config, address),
                    this.getTokenInfo(config, address),
                ]);
                return Object.assign(Object.assign({ 
                    // Smart contract specific data
                    isVerified: (contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.is_verified) || false, isFullyVerified: (contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.is_fully_verified) || false, compilerVersion: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.compiler_version, language: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.language, optimizationEnabled: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.optimization_enabled, verifiedAt: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.verified_at, abi: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.abi, constructorArgs: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.constructor_args, 
                    // Token specific data
                    totalSupply: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.total_supply, decimals: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.decimals, holders: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.holders, exchangeRate: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.exchange_rate, circulatingMarketCap: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.circulating_market_cap, iconUrl: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.icon_url, 
                    // Combined metadata
                    name: (contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.name) || (tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.name), symbol: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.symbol, type: tokenInfo === null || tokenInfo === void 0 ? void 0 : tokenInfo.type, 
                    // Additional contract info
                    createdAt: contractDetails === null || contractDetails === void 0 ? void 0 : contractDetails.verified_at }, contractDetails), tokenInfo);
            }
            catch (error) {
                console.error("Failed to get contract metadata:", error);
                return {};
            }
        });
    }
    // NEW: Get token holders for a contract
    getTokenHolders(config_1, address_1) {
        return __awaiter(this, arguments, void 0, function* (config, address, limit = 50) {
            try {
                const holdersUrl = `${config.baseApiUrl}/tokens/${address}/holders`;
                const response = yield fetch(holdersUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Token holders API failed: ${response.status}`);
                }
                const data = yield response.json();
                if (data.items && Array.isArray(data.items)) {
                    const holders = data.items.slice(0, limit).map((holder, index) => {
                        var _a;
                        return ({
                            address: ((_a = holder.address) === null || _a === void 0 ? void 0 : _a.hash) || holder.address,
                            balance: holder.value,
                            tokenId: holder.token_id,
                            percentage: (Number.parseFloat(holder.value || "0") / Number.parseFloat(data.total_supply || "1")) * 100,
                        });
                    });
                    return { holders };
                }
                return { holders: [] };
            }
            catch (error) {
                console.error("Failed to get token holders:", error);
                return { holders: [] };
            }
        });
    }
    // NEW: Get NFTs from a contract collection
    getContractNFTs(config_1, address_1) {
        return __awaiter(this, arguments, void 0, function* (config, address, limit = 50) {
            try {
                const nftsUrl = `${config.baseApiUrl}/tokens/${address}/instances`;
                const response = yield fetch(nftsUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Contract NFTs API failed: ${response.status}`);
                }
                const data = yield response.json();
                if (data.items && Array.isArray(data.items)) {
                    const nfts = data.items.slice(0, limit).map((nft) => {
                        var _a, _b;
                        return ({
                            id: nft.id,
                            owner: ((_a = nft.owner) === null || _a === void 0 ? void 0 : _a.hash) || nft.holder_address_hash,
                            metadata: nft.metadata,
                            image_url: nft.image_url || ((_b = nft.metadata) === null || _b === void 0 ? void 0 : _b.image_url),
                            animation_url: nft.animation_url,
                            token_type: nft.token_type || "ERC721",
                            isUnique: nft.is_unique,
                            externalAppUrl: nft.external_app_url,
                        });
                    });
                    return { nfts };
                }
                return { nfts: [] };
            }
            catch (error) {
                console.error("Failed to get contract NFTs:", error);
                return { nfts: [] };
            }
        });
    }
    // NEW: Get token transfers for a contract
    getTokenTransfers(config_1, address_1) {
        return __awaiter(this, arguments, void 0, function* (config, address, limit = 50) {
            try {
                const transfersUrl = `${config.baseApiUrl}/tokens/${address}/transfers`;
                const response = yield fetch(transfersUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                    signal: AbortSignal.timeout(10000),
                });
                if (!response.ok) {
                    throw new Error(`Token transfers API failed: ${response.status}`);
                }
                const data = yield response.json();
                if (data.items && Array.isArray(data.items)) {
                    return data.items.slice(0, limit).map((transfer) => {
                        var _a, _b;
                        return ({
                            blockHash: transfer.block_hash,
                            from: (_a = transfer.from) === null || _a === void 0 ? void 0 : _a.hash,
                            to: (_b = transfer.to) === null || _b === void 0 ? void 0 : _b.hash,
                            logIndex: transfer.log_index,
                            method: transfer.method,
                            timestamp: transfer.timestamp,
                            token: transfer.token,
                            total: transfer.total,
                            transactionHash: transfer.transaction_hash,
                            type: transfer.type,
                        });
                    });
                }
                return [];
            }
            catch (error) {
                console.error("Failed to get token transfers:", error);
                return [];
            }
        });
    }
    isUsingMockData() {
        return this.useMockData;
    }
    resetConnection(config) {
        return __awaiter(this, void 0, void 0, function* () {
            this.useMockData = false;
            this.currentRpcIndex = 0;
            try {
                yield this.getLatestBlockNumber(config);
                console.log("Successfully reconnected to RPC");
            }
            catch (error) {
                console.log("Still unable to connect to RPC, continuing with mock data");
            }
        });
    }
}
exports.default = new NetWorkController();
