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
const DagscanToken_1 = __importDefault(require("../models/DagscanToken"));
const DagscanTokenPriceLatest_1 = __importDefault(require("../models/DagscanTokenPriceLatest"));
const DagscanTokenPrice_1 = __importDefault(require("../models/DagscanTokenPrice"));
const DagscanProtocolStat_1 = __importDefault(require("../models/DagscanProtocolStat"));
const DagscanPool_1 = __importDefault(require("../models/DagscanPool"));
const DagscanPoolLatest_1 = __importDefault(require("../models/DagscanPoolLatest"));
/**
 * This service encapsulates the logic for pulling data from Zealous Swap's
 * public APIs and persisting it to MongoDB. It now uses the dedicated tokens
 * API as the source of truth for token data and prices.
 */
class ZealousSwapService {
    constructor(options = {}) {
        this.poolsApiUrl = '';
        this.tokensApiUrl = '';
        this.pricesApiUrl = '';
        // ✅ Kasplex mainnet bases
        this.poolsApiUrl = options.poolsApiUrl || "https://kasplex.zealousswap.com/v1/pools";
        this.tokensApiUrl = options.tokensApiUrl || "https://kasplex.zealousswap.com/v1/tokens";
        this.pricesApiUrl = options.pricesApiUrl || "https://kasplex.zealousswap.com/v1/prices";
    }
    /** Fetch the latest pool and protocol information from Zealous API. */
    fetchPoolsData() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.get(this.poolsApiUrl, {
                headers: { "User-Agent": "ZealousBackendBot/1.0" },
                timeout: 10000,
            });
            return response.data;
        });
    }
    /** Fetch the latest tokens from Zealous tokens API. */
    fetchTokensData() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.get(this.tokensApiUrl, {
                headers: { "User-Agent": "ZealousBackendBot/1.0" },
                timeout: 10000,
            });
            return response.data;
        });
    }
    /** Fetch the latest token prices from Zealous prices API. */
    fetchPricesData() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield axios_1.default.get(this.pricesApiUrl, {
                headers: { "User-Agent": "ZealousBackendBot/1.0" },
                timeout: 10000,
            });
            return response.data;
        });
    }
    /** Persist tokens data into MongoDB (includes latest prices). */
    persistTokensData(tokensData) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!tokensData || !tokensData.tokens || !Array.isArray(tokensData.tokens)) {
                throw new Error("Malformed response from Zealous tokens API");
            }
            const timestamp = new Date();
            /*
             * Some tokens returned by the Zealous API may be missing optional fields
             * such as price, logoURI or rank. Mongoose will throw validation errors
             * if required fields are undefined. To make the importer more resilient,
             * ensure that all required fields have sensible defaults before writing
             * to the database. Tokens without a price are skipped entirely, as a
             * missing price makes little sense in the context of a price history
             * document. Tokens with missing decimals, name or symbol will also be
             * ignored rather than causing the entire sync to fail.
             */
            for (const rawToken of tokensData.tokens) {
                try {
                    // Normalise and validate essential fields
                    const address = typeof rawToken.address === 'string' ? rawToken.address.toLowerCase() : null;
                    const decimals = typeof rawToken.decimals === 'number' ? rawToken.decimals : null;
                    const name = typeof rawToken.name === 'string' ? rawToken.name : null;
                    const symbol = typeof rawToken.symbol === 'string' ? rawToken.symbol : null;
                    // Price may legitimately be 0, so only treat undefined/null as missing
                    const price = rawToken.price !== undefined && rawToken.price !== null ? Number(rawToken.price) : null;
                    const rank = typeof rawToken.rank === 'number' ? rawToken.rank : null;
                    // logoURI may be empty string; that's acceptable. default to empty string if missing
                    const logoURI = typeof rawToken.logoURI === 'string' ? rawToken.logoURI : '';
                    const verified = Boolean(rawToken.verified);
                    if (!address || decimals === null || !name || !symbol) {
                        // Skip invalid token definitions
                        console.warn(`Skipping token with missing required fields: ${JSON.stringify(rawToken)}`);
                        continue;
                    }
                    // Upsert basic token metadata. Even if price is missing we still
                    // maintain a record in DagscanToken so pools referencing it can be
                    // persisted.
                    yield DagscanToken_1.default.findOneAndUpdate({ address }, {
                        address,
                        decimals,
                        name,
                        symbol,
                        logoURI,
                        verified,
                        // if rank is missing set it to a high number to push it down the list
                        rank: rank !== null ? rank : 1e9,
                        updatedAt: timestamp,
                    }, { upsert: true, new: true, setDefaultsOnInsert: true });
                    // Only persist price documents if a price is available
                    if (price !== null) {
                        const priceDoc = new DagscanTokenPrice_1.default({
                            tokenAddress: address,
                            symbol,
                            name,
                            logoURI,
                            priceUSD: price,
                            timestamp: timestamp,
                        });
                        yield priceDoc.save();
                        yield DagscanTokenPriceLatest_1.default.findOneAndUpdate({ tokenAddress: address }, {
                            tokenAddress: address,
                            symbol,
                            name,
                            logoURI,
                            priceUSD: price,
                            verified,
                            rank: rank !== null ? rank : 1e9,
                            decimals,
                            timestamp: timestamp,
                        }, { upsert: true, new: true, setDefaultsOnInsert: true });
                    }
                }
                catch (err) {
                    // Log and continue on individual token errors to avoid aborting the entire sync
                    console.error(`Failed to process token ${JSON.stringify(rawToken)}:`, err);
                }
            }
        });
    }
    /** Persist pools + protocol stats into MongoDB (tracked tokens only). */
    persistPoolsData(poolsData) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            if (!poolsData || typeof poolsData !== 'object' || !poolsData.protocol || !poolsData.pools) {
                throw new Error('Malformed response from Zealous pools API');
            }
            // Build a set of tracked token addresses. If there are no tokens yet, an
            // empty set will be used. This ensures that pool snapshots can still be
            // recorded for tracked tokens without aborting due to undefined results.
            const trackedTokens = yield DagscanToken_1.default.find({}, { address: 1 }).lean();
            const trackedAddresses = new Set(trackedTokens.map((t) => String(t.address).toLowerCase()));
            // Persist protocol snapshot (TVL, volume, poolCount, updatedAt). Use
            // sensible defaults and type coercions to avoid validation errors if the
            // API returns unexpected values.
            const protocol = poolsData.protocol || {};
            const protocolStat = new DagscanProtocolStat_1.default({
                totalTVL: Number((_a = protocol.totalTVL) !== null && _a !== void 0 ? _a : 0),
                totalVolumeUSD: Number((_b = protocol.totalVolumeUSD) !== null && _b !== void 0 ? _b : 0),
                poolCount: Number((_c = protocol.poolCount) !== null && _c !== void 0 ? _c : 0),
                updatedAt: protocol.updatedAt ? new Date(protocol.updatedAt) : new Date(),
            });
            yield protocolStat.save().catch((err) => {
                console.error('Failed to save protocol stats:', err);
            });
            // Process individual pools. Only persist pools that involve at least one
            // tracked token. Coerce numeric fields into numbers and provide
            // fallbacks for missing values to satisfy the DagscanPoolLatest schema.
            const poolEntries = Object.entries(poolsData.pools || {});
            for (const [, pool] of poolEntries) {
                try {
                    const token0 = pool.token0 || {};
                    const token1 = pool.token1 || {};
                    const token0Address = String(token0.address || '').toLowerCase();
                    const token1Address = String(token1.address || '').toLowerCase();
                    if (!trackedAddresses.has(token0Address) && !trackedAddresses.has(token1Address)) {
                        continue;
                    }
                    // Construct a plain object containing all the fields expected by the
                    // DagscanPoolLatest schema. Fields that may be returned as strings
                    // or undefined are coerced into numbers, or given a default value
                    // where appropriate.
                    const poolPayload = {
                        address: pool.address,
                        token0: {
                            address: token0Address,
                            symbol: token0.symbol || '',
                            name: token0.name || '',
                            decimals: Number((_d = token0.decimals) !== null && _d !== void 0 ? _d : 0),
                        },
                        token1: {
                            address: token1Address,
                            symbol: token1.symbol || '',
                            name: token1.name || '',
                            decimals: Number((_e = token1.decimals) !== null && _e !== void 0 ? _e : 0),
                        },
                        token0Volume: (_f = pool.token0Volume) !== null && _f !== void 0 ? _f : 0,
                        token1Volume: (_g = pool.token1Volume) !== null && _g !== void 0 ? _g : 0,
                        tvl: Number((_h = pool.tvl) !== null && _h !== void 0 ? _h : 0),
                        volumeUSD: Number((_j = pool.volumeUSD) !== null && _j !== void 0 ? _j : 0),
                        token0Fees: (_k = pool.token0Fees) !== null && _k !== void 0 ? _k : 0,
                        token1Fees: (_l = pool.token1Fees) !== null && _l !== void 0 ? _l : 0,
                        feesUSD: Number((_m = pool.feesUSD) !== null && _m !== void 0 ? _m : 0),
                        token0Reserves: (_o = pool.token0Reserves) !== null && _o !== void 0 ? _o : 0,
                        token1Reserves: (_p = pool.token1Reserves) !== null && _p !== void 0 ? _p : 0,
                        apr: Number((_q = pool.apr) !== null && _q !== void 0 ? _q : 0),
                        hasUSDValues: Boolean(pool.hasUSDValues),
                        updatedAt: pool.updatedAt ? new Date(pool.updatedAt) : new Date(),
                        hasActiveFarm: Boolean(pool.hasActiveFarm),
                        farmApr: Number((_r = pool.farmApr) !== null && _r !== void 0 ? _r : 0),
                        regularFeeRate: pool.regularFeeRate,
                        discountedFeeRate: pool.discountedFeeRate,
                    };
                    // Save historical snapshot
                    const poolDoc = new DagscanPool_1.default(poolPayload);
                    yield poolDoc.save().catch((err) => {
                        console.error(`Failed to save pool snapshot for ${poolPayload.address}:`, err);
                    });
                    // Upsert latest snapshot
                    yield DagscanPoolLatest_1.default.findOneAndUpdate({ address: poolPayload.address }, Object.assign(Object.assign({}, poolPayload), { createdAt: new Date() }), { upsert: true, new: true, setDefaultsOnInsert: true }).catch((err) => {
                        console.error(`Failed to upsert pool latest for ${poolPayload.address}:`, err);
                    });
                }
                catch (err) {
                    console.error('Error processing pool data:', err);
                }
            }
        });
    }
    /** One-shot sync for scheduler. */
    sync() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Starting Zealous sync...");
                const tokensData = yield this.fetchTokensData();
                yield this.persistTokensData(tokensData);
                console.log(`Synced ${tokensData.tokens.length} tokens`);
                const poolsData = yield this.fetchPoolsData();
                yield this.persistPoolsData(poolsData);
                console.log("Pools sync completed");
                console.log("Zealous sync completed successfully");
            }
            catch (err) {
                console.error("Zealous sync failed", err);
            }
        });
    }
}
exports.default = ZealousSwapService;
