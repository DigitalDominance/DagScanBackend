import exprss, { Router } from 'express';
import LFGToken from '../models/LFGToken';
import LFGTokenPrice from '../models/LFGTokenPrice';
const router = Router();
// const LFGToken = require('../models/LFGToken');
// const LFGTokenPrice = require('../models/LFGTokenPrice');

const LFG_BASE = 'https://api.dev-lfg.kaspa.com/tokens/search';
const DEFAULT_SORT = 'Market Cap (High to Low)';
const doFetch = async (url: any) => { if (typeof global.fetch === 'function') return fetch(url); const { default: fetchPoly } = await import('node-fetch'); return fetchPoly(url); };
const minuteBucket = (d = new Date()) => new Date(Math.floor(d.getTime() / 60000) * 60000);

router.get('/_health', (req, res) => res.json({ ok: true }));

router.get('/search', async (req, res) => {
  try {
    const { q = '', page = 1, sortBy = DEFAULT_SORT } = req.query;
    const url = new URL(LFG_BASE);
    url.searchParams.set('sortBy', sortBy as string);
    url.searchParams.set('view', 'grid');
    url.searchParams.set('page', String(page));
    const r = await doFetch(url.toString());
    if (!r.ok) return res.status(502).json({ error: 'LFG API error', status: r.status });
    const payload = await r.json();
    const items = Array.isArray(payload?.result) ? payload.result : [];
    const qLower = String(q).trim().toLowerCase();
    const filtered = qLower ? items.filter((it: any) => {
      const addr = String(it.tokenAddress || '').toLowerCase();
      const tick = String(it.ticker || '').toLowerCase();
      const name = String(it.name || '').toLowerCase();
      return addr.includes(qLower) || tick.includes(qLower) || name.includes(qLower);
    }) : items;
    if (filtered.length) {
      const ops = filtered.map((it: any) => ({
        updateOne: {
          filter: { tokenAddress: String(it.tokenAddress || '').toLowerCase() },
          update: { $set: { ...it, updatedAtRemote: it.updatedAt ? new Date(it.updatedAt) : undefined, lastSyncedAt: new Date() } },
          upsert: true,
        }
      }));
      await LFGToken.bulkWrite(ops, { ordered: false });
    }
    return res.json({ success: true, page: payload?.page ?? Number(page), hasMore: !!payload?.hasMore, limit: payload?.limit ?? filtered.length, result: filtered });
  } catch (e: any) {
    console.error('LFG /search error:', e);
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
});

router.post('/:tokenAddress/snapshot', async (req, res) => {
  try {
    const tokenAddress = String(req.params.tokenAddress || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });
    let found = null;
    for (let p = 1; p <= 6 && !found; p++) {
      const url = new URL(LFG_BASE);
      url.searchParams.set('sortBy', DEFAULT_SORT); url.searchParams.set('view', 'grid'); url.searchParams.set('page', String(p));
      const r = await doFetch(url.toString()); if (!r.ok) continue;
      const payload = await r.json();
      const items = Array.isArray(payload?.result) ? payload.result : [];
      found = items.find((it: any) => String(it.tokenAddress || '').toLowerCase() === tokenAddress);
      if (!payload?.hasMore) break;
    }
    if (!found) return res.status(404).json({ error: 'Token not found on LFG pages scanned' });
    await LFGToken.updateOne({ tokenAddress }, { $set: { ...found, updatedAtRemote: found.updatedAt ? new Date(found.updatedAt) : undefined, lastSyncedAt: new Date() } }, { upsert: true });
    const snapAt = minuteBucket(new Date());
    const vol = found.volume || {}; const chg = found.priceChange || {};
    await LFGTokenPrice.updateOne({ tokenAddress, snappedAt: snapAt }, { $set: {
      price: Number(found.price || 0), marketCap: Number(found.marketCap || 0),
      volume1h: Number(vol['1h'] || 0), volume4h: Number(vol['4h'] || 0), volume12h: Number(vol['12h'] || 0),
      volume1d: Number(vol['1d'] || 0), volume3d: Number(vol['3d'] || 0), volume7d: Number(vol['7d'] || 0),
      change1h: Number(chg['1h'] || 0), change4h: Number(chg['4h'] || 0), change12h: Number(chg['12h'] || 0),
      change1d: Number(chg['1d'] || 0), change3d: Number(chg['3d'] || 0), change7d: Number(chg['7d'] || 0),
    } }, { upsert: true });
    return res.json({ success: true, tokenAddress, snappedAt: snapAt });
  } catch (e: any) {
    console.error('LFG snapshot error:', e);
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
});

// path style
router.get('/:tokenAddress/history', async (req, res) => {
  try {
    const tokenAddress = String(req.params.tokenAddress || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });
    const { from, to, limit = 500, order = 'asc' } = req.query;
    const q: { tokenAddress: string; snappedAt?: { $gte?: Date; $lte?: Date } } = { tokenAddress };
    if (from || to) { 
      q.snappedAt = {}; 
      if (from) q.snappedAt.$gte = new Date(String(from)); 
      if (to) q.snappedAt.$lte = new Date(String(to)); 
    }
    const docs = await LFGTokenPrice.find(q).sort({ snappedAt: order === 'desc' ? -1 : 1 }).limit(Math.min(5000, Number(limit || 500)));
    const points = docs.map(d => ({ t: d.snappedAt.getTime(), price: d.price, marketCap: d.marketCap, v1h: d.volume1h, v4h: d.volume4h, v12h: d.volume12h, v1d: d.volume1d, v3d: d.volume3d, v7d: d.volume7d }));
    return res.json({ success: true, tokenAddress, count: points.length, points });
  } catch (e: any) {
    console.error('LFG history error:', e);
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
});

// query style fallback
router.get('/history', async (req, res) => {
  try {
    const tokenAddress = String(req.query.tokenAddress || req.query.address || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress query required' });
    const { from, to, limit = 500, order = 'asc' } = req.query;
    const q: { tokenAddress: string; snappedAt?: { $gte?: Date; $lte?: Date } } = { tokenAddress };
    if (from || to) { 
      q.snappedAt = {}; 
      if (from) q.snappedAt.$gte = new Date(String(from)); 
      if (to) q.snappedAt.$lte = new Date(String(to)); 
    }
    const docs = await LFGTokenPrice.find(q).sort({ snappedAt: order === 'desc' ? -1 : 1 }).limit(Math.min(5000, Number(limit || 500)));
    const points = docs.map(d => ({ t: d.snappedAt.getTime(), price: d.price, marketCap: d.marketCap, v1h: d.volume1h, v4h: d.volume4h, v12h: d.volume12h, v1d: d.volume1d, v3d: d.volume3d, v7d: d.volume7d }));
    return res.json({ success: true, tokenAddress, count: points.length, points });
  } catch (e: any) {
    console.error('LFG history (fallback) error:', e);
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
});

export default router;
