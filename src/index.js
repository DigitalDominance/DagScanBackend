"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
// const LFGTokenPrice = require('./models/LFGTokenPrice');
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const node_cron_1 = __importDefault(require("node-cron"));
const cors_1 = __importDefault(require("cors"));
const zealousSwapService_1 = __importDefault(require("./services/zealousSwapService"));
const DagscanProtocolStat_1 = __importDefault(require("./models/DagscanProtocolStat"));
const DagscanToken_1 = __importDefault(require("./models/DagscanToken"));
const DagscanPool_1 = __importDefault(require("./models/DagscanPool"));
const DagscanPoolLatest_1 = __importDefault(require("./models/DagscanPoolLatest"));
const DagscanTokenPrice_1 = __importDefault(require("./models/DagscanTokenPrice"));
const DagscanTokenPriceLatest_1 = __importDefault(require("./models/DagscanTokenPriceLatest"));
const lfgRouter_1 = __importDefault(require("./routes/lfgRouter"));
const LFGTokenPrice_1 = __importDefault(require("./models/LFGTokenPrice"));
const lfgTop100Cron_1 = __importDefault(require("./jobs/lfgTop100Cron"));
const networkRouter_1 = __importDefault(require("./routes/networkRouter"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
// Create Express app
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
// MongoDB connection
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/zealous";
mongoose_1.default
    .connect(mongoUri, {
// useNewUrlParser: true,
// useUnifiedTopology: true,
})
    .then(() => {
    console.log("Connected to MongoDB");
})
    .catch((err) => {
    console.error("MongoDB connection error:", err);
});
// Instantiate the ZealousSwap service
const zealousService = new zealousSwapService_1.default();
// Immediately perform a sync on startup
zealousService.sync();
// Schedule a sync every minute
node_cron_1.default.schedule("* * * * *", () => {
    zealousService.sync();
});
/**
 * Helper middleware to catch and forward errors. Avoids unhandled promise
 * rejections when awaiting asynchronous Mongoose operations.
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
// ===================== ROUTES =====================
const zealousRouter = express_1.default.Router();
// GET /api/zealous/protocol/stats - return the latest protocol snapshot
zealousRouter.get("/protocol/stats", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const latest = yield DagscanProtocolStat_1.default.findOne().sort({ updatedAt: -1 });
    if (!latest)
        return res.status(404).json({ error: "No protocol stats found" });
    res.json(latest);
})));
// GET /api/zealous/historical/volume/daily - return daily volume differences
zealousRouter.get("/historical/volume/daily", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const dailyVolumes = yield DagscanProtocolStat_1.default.aggregate([
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                minVolume: { $min: "$totalVolumeUSD" },
                maxVolume: { $max: "$totalVolumeUSD" },
            },
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                volumeUSD: { $subtract: ["$maxVolume", "$minVolume"] },
            },
        },
        { $sort: { date: 1 } },
    ]);
    res.json(dailyVolumes);
})));
// GET /api/zealous/historical/volume - return all protocol stats sorted ascending
zealousRouter.get("/historical/volume", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const records = yield DagscanProtocolStat_1.default.find().sort({ updatedAt: 1 });
    res.json(records);
})));
// GET /api/zealous/tokens - list all tracked tokens
zealousRouter.get("/tokens", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { limit = 100, skip = 0 } = req.query;
    console.log('Zealous Router Tokens', limit, skip);
    const docs = yield DagscanToken_1.default.find().sort({ rank: 1 }).skip(Number.parseInt(skip)).limit(Number.parseInt(limit));
    res.json(docs);
})));
// GET /api/zealous/pools - list pools. Supports optional address filter and pagination
zealousRouter.get("/pools", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { address, limit = 100, skip = 0 } = req.query;
    const query = {};
    if (address)
        query.address = address;
    const docs = yield DagscanPool_1.default.find(query)
        .sort({ updatedAt: -1 })
        .skip(Number.parseInt(skip))
        .limit(Number.parseInt(limit));
    res.json(docs);
})));
// GET /api/zealous/pools/latest - return the most recent snapshot per pool address
zealousRouter.get("/pools/latest", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { limit = 100, skip = 0, sortField = "tvl", order = "desc" } = req.query;
    const allowedFields = ["tvl", "volumeUSD", "feesUSD", "apr", "updatedAt"];
    const field = allowedFields.includes(sortField) ? sortField : "tvl";
    const sortOrder = order === "asc" ? 1 : -1;
    const docs = yield DagscanPoolLatest_1.default.find()
        .sort({ [field]: sortOrder })
        .skip(Number.parseInt(skip, 10))
        .limit(Number.parseInt(limit, 10));
    const json = docs.map((doc) => {
        const obj = doc.toObject();
        if ('__v' in obj) {
            delete obj.__v;
        }
        return obj;
    });
    res.json(json);
})));
// GET /api/zealous/pools/:address/latest - get the latest snapshot for a single pool
zealousRouter.get("/pools/:address/latest", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { address } = req.params;
    const doc = yield DagscanPoolLatest_1.default.findOne({ address });
    if (!doc)
        return res.status(404).json({ error: "Pool not found" });
    const obj = doc.toObject();
    if ('__v' in obj) {
        delete obj.__v;
    }
    res.json(obj);
})));
// GET /api/zealous/tokens/:tokenAddress/price - get price history for a token
zealousRouter.get("/tokens/:tokenAddress/price", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tokenAddress } = req.params;
    const { limit = 1000, skip = 0 } = req.query;
    const docs = yield DagscanTokenPrice_1.default.find({ tokenAddress: tokenAddress.toLowerCase() })
        .sort({ timestamp: 1 })
        .skip(Number.parseInt(skip))
        .limit(Number.parseInt(limit));
    res.json(docs);
})));
// GET /api/zealous/tokens/:tokenAddress/price/daily - daily aggregated price for token
zealousRouter.get("/tokens/:tokenAddress/price/daily", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { tokenAddress } = req.params;
    const dailyPrices = yield DagscanTokenPrice_1.default.aggregate([
        { $match: { tokenAddress: tokenAddress.toLowerCase() } },
        { $sort: { timestamp: 1 } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                avgPrice: { $avg: "$priceUSD" },
                maxPrice: { $max: "$priceUSD" },
                minPrice: { $min: "$priceUSD" },
                firstPrice: { $first: "$priceUSD" },
                lastPrice: { $last: "$priceUSD" },
                logoURI: { $first: "$logoURI" },
                symbol: { $first: "$symbol" },
                name: { $first: "$name" },
            },
        },
        {
            $project: {
                _id: 0,
                date: "$_id",
                avgPrice: 1,
                maxPrice: 1,
                minPrice: 1,
                firstPrice: 1,
                lastPrice: 1,
                logoURI: 1,
                symbol: 1,
                name: 1,
            },
        },
        { $sort: { date: 1 } },
    ]);
    res.json(dailyPrices);
})));
// GET /api/zealous/tokens/:tokenAddress/current - get the current token price from latest collection
zealousRouter.get("/tokens/:tokenAddress/current", asyncHandler((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const tokenAddress = req.params.tokenAddress.toLowerCase();
    const tokenPrice = yield DagscanTokenPriceLatest_1.default.findOne({ tokenAddress });
    if (!tokenPrice)
        return res.status(404).json({ error: "Token not found" });
    const obj = tokenPrice.toObject();
    if ('__v' in obj) {
        delete obj.__v;
    }
    res.json(obj);
})));
// Mount the Zealous router under /api/zealous
app.get('/api/lfg/_health', (req, res) => res.json({ ok: true }));
app.use('/api/lfg', lfgRouter_1.default);
app.use('/lfg', lfgRouter_1.default);
app.use('/api/network', networkRouter_1.default);
app.use('/network', networkRouter_1.default);
app.get('/api/lfg/history', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tokenAddress = String(req.query.tokenAddress || req.query.address || '').toLowerCase();
        if (!tokenAddress)
            return res.status(400).json({ error: 'tokenAddress query required' });
        const { from, to, limit = 500, order = 'asc' } = req.query;
        const q = { tokenAddress };
        if (from || to) {
            q.snappedAt = {};
            if (from)
                q.snappedAt.$gte = new Date(String(from));
            if (to)
                q.snappedAt.$lte = new Date(String(to));
        }
        const docs = yield LFGTokenPrice_1.default.find(q).sort({ snappedAt: order === 'desc' ? -1 : 1 }).limit(Math.min(5000, Number(limit || 500)));
        const points = docs.map(d => ({ t: d.snappedAt.getTime(), price: d.price, marketCap: d.marketCap, v1h: d.volume1h, v4h: d.volume4h, v12h: d.volume12h, v1d: d.volume1d, v3d: d.volume3d, v7d: d.volume7d }));
        return res.json({ success: true, tokenAddress, count: points.length, points });
    }
    catch (e) {
        return res.status(500).json({ error: 'Internal error', details: String((e === null || e === void 0 ? void 0 : e.message) || e) });
    }
}));
app.get('/lfg/history', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tokenAddress = String(req.query.tokenAddress || req.query.address || '').toLowerCase();
        if (!tokenAddress)
            return res.status(400).json({ error: 'tokenAddress query required' });
        const { from, to, limit = 500, order = 'asc' } = req.query;
        const q = { tokenAddress };
        if (from || to) {
            q.snappedAt = {};
            if (from)
                q.snappedAt.$gte = new Date(String(from));
            if (to)
                q.snappedAt.$lte = new Date(String(to));
        }
        const docs = yield LFGTokenPrice_1.default.find(q).sort({ snappedAt: order === 'desc' ? -1 : 1 }).limit(Math.min(5000, Number(limit || 500)));
        const points = docs.map(d => ({ t: d.snappedAt.getTime(), price: d.price, marketCap: d.marketCap, v1h: d.volume1h, v4h: d.volume4h, v12h: d.volume12h, v1d: d.volume1d, v3d: d.volume3d, v7d: d.volume7d }));
        return res.json({ success: true, tokenAddress, count: points.length, points });
    }
    catch (e) {
        return res.status(500).json({ error: 'Internal error', details: String((e === null || e === void 0 ? void 0 : e.message) || e) });
    }
}));
app.use("/api/zealous", zealousRouter);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});
// Error handler
app.use((err, req, res, next) => {
    app.use('/api/lfg', lfgRouter_1.default);
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
});
// Start server
const port = process.env.PORT || 3005;
(0, lfgTop100Cron_1.default)();
app.listen(port, () => {
    console.log(`Zealous backend listening on port ${port}`);
});
