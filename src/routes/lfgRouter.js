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
const express_1 = require("express");
const LFGToken_1 = __importDefault(require("../models/LFGToken"));
const LFGTokenPrice_1 = __importDefault(require("../models/LFGTokenPrice"));
const router = (0, express_1.Router)();
// const LFGToken = require('../models/LFGToken');
// const LFGTokenPrice = require('../models/LFGTokenPrice');
const LFG_BASE = 'https://api.lfg.kaspa.com/tokens/search';
const DEFAULT_SORT = 'Market Cap (High to Low)';
const doFetch = (url) => __awaiter(void 0, void 0, void 0, function* () { if (typeof global.fetch === 'function')
    return fetch(url); const { default: fetchPoly } = yield Promise.resolve().then(() => __importStar(require('node-fetch'))); return fetchPoly(url); });
const minuteBucket = (d = new Date()) => new Date(Math.floor(d.getTime() / 60000) * 60000);
router.get('/_health', (req, res) => res.json({ ok: true }));
router.get('/search', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { q = '', page = 1, sortBy = DEFAULT_SORT } = req.query;
        const url = new URL(LFG_BASE);
        url.searchParams.set('sortBy', sortBy);
        url.searchParams.set('view', 'grid');
        url.searchParams.set('page', String(page));
        const r = yield doFetch(url.toString());
        if (!r.ok)
            return res.status(502).json({ error: 'LFG API error', status: r.status });
        const payload = yield r.json();
        const items = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.result) ? payload.result : [];
        const qLower = String(q).trim().toLowerCase();
        const filtered = qLower ? items.filter((it) => {
            const addr = String(it.tokenAddress || '').toLowerCase();
            const tick = String(it.ticker || '').toLowerCase();
            const name = String(it.name || '').toLowerCase();
            return addr.includes(qLower) || tick.includes(qLower) || name.includes(qLower);
        }) : items;
        if (filtered.length) {
            const ops = filtered.map((it) => ({
                updateOne: {
                    filter: { tokenAddress: String(it.tokenAddress || '').toLowerCase() },
                    update: { $set: Object.assign(Object.assign({}, it), { updatedAtRemote: it.updatedAt ? new Date(it.updatedAt) : undefined, lastSyncedAt: new Date() }) },
                    upsert: true,
                }
            }));
            yield LFGToken_1.default.bulkWrite(ops, { ordered: false });
        }
        return res.json({ success: true, page: (_a = payload === null || payload === void 0 ? void 0 : payload.page) !== null && _a !== void 0 ? _a : Number(page), hasMore: !!(payload === null || payload === void 0 ? void 0 : payload.hasMore), limit: (_b = payload === null || payload === void 0 ? void 0 : payload.limit) !== null && _b !== void 0 ? _b : filtered.length, result: filtered });
    }
    catch (e) {
        console.error('LFG /search error:', e);
        return res.status(500).json({ error: 'Internal error', details: String((e === null || e === void 0 ? void 0 : e.message) || e) });
    }
}));
router.post('/:tokenAddress/snapshot', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tokenAddress = String(req.params.tokenAddress || '').toLowerCase();
        if (!tokenAddress)
            return res.status(400).json({ error: 'tokenAddress required' });
        let found = null;
        for (let p = 1; p <= 6 && !found; p++) {
            const url = new URL(LFG_BASE);
            url.searchParams.set('sortBy', DEFAULT_SORT);
            url.searchParams.set('view', 'grid');
            url.searchParams.set('page', String(p));
            const r = yield doFetch(url.toString());
            if (!r.ok)
                continue;
            const payload = yield r.json();
            const items = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.result) ? payload.result : [];
            found = items.find((it) => String(it.tokenAddress || '').toLowerCase() === tokenAddress);
            if (!(payload === null || payload === void 0 ? void 0 : payload.hasMore))
                break;
        }
        if (!found)
            return res.status(404).json({ error: 'Token not found on LFG pages scanned' });
        yield LFGToken_1.default.updateOne({ tokenAddress }, { $set: Object.assign(Object.assign({}, found), { updatedAtRemote: found.updatedAt ? new Date(found.updatedAt) : undefined, lastSyncedAt: new Date() }) }, { upsert: true });
        const snapAt = minuteBucket(new Date());
        const vol = found.volume || {};
        const chg = found.priceChange || {};
        yield LFGTokenPrice_1.default.updateOne({ tokenAddress, snappedAt: snapAt }, { $set: {
                price: Number(found.price || 0), marketCap: Number(found.marketCap || 0),
                volume1h: Number(vol['1h'] || 0), volume4h: Number(vol['4h'] || 0), volume12h: Number(vol['12h'] || 0),
                volume1d: Number(vol['1d'] || 0), volume3d: Number(vol['3d'] || 0), volume7d: Number(vol['7d'] || 0),
                change1h: Number(chg['1h'] || 0), change4h: Number(chg['4h'] || 0), change12h: Number(chg['12h'] || 0),
                change1d: Number(chg['1d'] || 0), change3d: Number(chg['3d'] || 0), change7d: Number(chg['7d'] || 0),
            } }, { upsert: true });
        return res.json({ success: true, tokenAddress, snappedAt: snapAt });
    }
    catch (e) {
        console.error('LFG snapshot error:', e);
        return res.status(500).json({ error: 'Internal error', details: String((e === null || e === void 0 ? void 0 : e.message) || e) });
    }
}));
// path style
router.get('/:tokenAddress/history', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tokenAddress = String(req.params.tokenAddress || '').toLowerCase();
        if (!tokenAddress)
            return res.status(400).json({ error: 'tokenAddress required' });
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
        console.error('LFG history error:', e);
        return res.status(500).json({ error: 'Internal error', details: String((e === null || e === void 0 ? void 0 : e.message) || e) });
    }
}));
// query style fallback
router.get('/history', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        console.error('LFG history (fallback) error:', e);
        return res.status(500).json({ error: 'Internal error', details: String((e === null || e === void 0 ? void 0 : e.message) || e) });
    }
}));
exports.default = router;
