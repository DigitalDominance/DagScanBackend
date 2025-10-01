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
// DagScanBackend/jobs/lfgTop100Cron.js
const node_cron_1 = __importDefault(require("node-cron"));
// Import default models from ES modules. When compiled to CommonJS the
// default export is assigned to the `default` property on the require
// result. Using ESM syntax here ensures we always get the model class
// rather than an object wrapper. See: https://mongoosejs.com/docs/migrating_to_6.html
const LFGToken_1 = __importDefault(require("../models/LFGToken"));
const LFGTokenPrice_1 = __importDefault(require("../models/LFGTokenPrice"));
const LFG_BASE = 'https://api.lfg.kaspa.com/tokens/search';
const DEFAULT_SORT = 'Market Cap (High to Low)';
const doFetch = (url) => __awaiter(void 0, void 0, void 0, function* () {
    return fetch(url);
});
const minuteBucket = (d = new Date()) => new Date(Math.floor(d.getTime() / 60000) * 60000);
function fetchTopTokens() {
    return __awaiter(this, arguments, void 0, function* (pagesToScan = 8, cap = 100) {
        const out = [];
        for (let p = 1; p <= pagesToScan; p++) {
            const url = new URL(LFG_BASE);
            url.searchParams.set('sortBy', DEFAULT_SORT);
            url.searchParams.set('view', 'grid');
            url.searchParams.set('page', String(p));
            try {
                const r = yield doFetch(url.toString());
                if (!r.ok) {
                    console.warn(`[LFG_TOP100_CRON] page ${p} fetch failed: ${r.status}`);
                    break;
                }
                const payload = yield r.json();
                const items = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.result) ? payload.result : [];
                for (const it of items) {
                    out.push(it);
                    if (out.length >= cap)
                        break;
                }
                if (out.length >= cap || !(payload === null || payload === void 0 ? void 0 : payload.hasMore))
                    break;
            }
            catch (e) {
                console.warn('[LFG_TOP100_CRON] fetch error:', (e === null || e === void 0 ? void 0 : e.message) || e);
                break;
            }
        }
        return out.slice(0, cap);
    });
}
function snapshotTop(tokens) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!tokens.length)
            return;
        const snapAt = minuteBucket(new Date());
        const tokenOps = tokens.map((it) => {
            var _a, _b, _c;
            const tokenAddress = String(it.tokenAddress || '').toLowerCase();
            return {
                updateOne: {
                    filter: { tokenAddress },
                    update: {
                        $set: {
                            deployerAddress: (_c = (_b = (_a = it.deployerAddress) === null || _a === void 0 ? void 0 : _a.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : it.deployerAddress,
                            ticker: it.ticker,
                            name: it.name,
                            description: it.description,
                            totalSupply: it.totalSupply,
                            image: it.image,
                            colorHex: it.colorHex,
                            devLock: it.devLock,
                            isHypedLaunch: it.isHypedLaunch,
                            bondingCurve: it.bondingCurve,
                            state: it.state,
                            decimals: it.decimals,
                            version: it.version,
                            isNSFW: it.isNSFW,
                            txHash: it.txHash,
                            socials: it.socials,
                            price: it.price,
                            marketCap: it.marketCap,
                            volume: it.volume,
                            priceChange: it.priceChange,
                            updatedAtRemote: it.updatedAt ? new Date(it.updatedAt) : undefined,
                            lastSyncedAt: new Date(),
                        },
                    },
                    upsert: true,
                },
            };
        });
        const priceOps = tokens.map((it) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const tokenAddress = String(it.tokenAddress || '').toLowerCase();
            const vol = it.volume || {};
            const chg = it.priceChange || {};
            return {
                updateOne: {
                    filter: { tokenAddress, snappedAt: snapAt },
                    update: {
                        $set: {
                            price: Number((_a = it.price) !== null && _a !== void 0 ? _a : 0),
                            marketCap: Number((_b = it.marketCap) !== null && _b !== void 0 ? _b : 0),
                            volume1h: Number((_c = vol['1h']) !== null && _c !== void 0 ? _c : 0),
                            volume4h: Number((_d = vol['4h']) !== null && _d !== void 0 ? _d : 0),
                            volume12h: Number((_e = vol['12h']) !== null && _e !== void 0 ? _e : 0),
                            volume1d: Number((_f = vol['1d']) !== null && _f !== void 0 ? _f : 0),
                            volume3d: Number((_g = vol['3d']) !== null && _g !== void 0 ? _g : 0),
                            volume7d: Number((_h = vol['7d']) !== null && _h !== void 0 ? _h : 0),
                            change1h: Number((_j = chg['1h']) !== null && _j !== void 0 ? _j : 0),
                            change4h: Number((_k = chg['4h']) !== null && _k !== void 0 ? _k : 0),
                            change12h: Number((_l = chg['12h']) !== null && _l !== void 0 ? _l : 0),
                            change1d: Number((_m = chg['1d']) !== null && _m !== void 0 ? _m : 0),
                            change3d: Number((_o = chg['3d']) !== null && _o !== void 0 ? _o : 0),
                            change7d: Number((_p = chg['7d']) !== null && _p !== void 0 ? _p : 0),
                        },
                    },
                    upsert: true,
                },
            };
        });
        // Execute bulk operations only if the model exposes the method. This guards
        // against scenarios where the import did not return a Mongoose model (e.g.
        // due to misconfiguration) and prevents runtime "bulkWrite is not a
        // function" errors.
        if (tokenOps.length && typeof LFGToken_1.default.bulkWrite === 'function') {
            yield LFGToken_1.default.bulkWrite(tokenOps, { ordered: false });
        }
        if (priceOps.length && typeof LFGTokenPrice_1.default.bulkWrite === 'function') {
            yield LFGTokenPrice_1.default.bulkWrite(priceOps, { ordered: false });
        }
        return { tokens: tokens.length, snappedAt: snapAt };
    });
}
let running = false;
function startLFGTop100Cron() {
    const enabled = (process.env.LFG_CRON_ENABLED || 'true').toLowerCase() !== 'false';
    if (!enabled) {
        console.log('[LFG_TOP100_CRON] disabled via LFG_CRON_ENABLED=false');
        return;
    }
    node_cron_1.default.schedule('* * * * *', () => __awaiter(this, void 0, void 0, function* () {
        if (running)
            return;
        running = true;
        try {
            const list = yield fetchTopTokens(8, 100);
            if (list.length) {
                const res = yield snapshotTop(list);
                console.log('[LFG_TOP100_CRON] snap', res);
            }
            else {
                console.log('[LFG_TOP100_CRON] no tokens fetched');
            }
        }
        catch (e) {
            console.error('[LFG_TOP100_CRON] error', (e === null || e === void 0 ? void 0 : e.message) || e);
        }
        finally {
            running = false;
        }
    }));
    console.log('[LFG_TOP100_CRON] scheduled (*/1 * * * *) top 100');
}
exports.default = startLFGTop100Cron;
