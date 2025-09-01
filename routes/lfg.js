// DagScanBackend/routes/lfg.js
const express = require('express');
const router = express.Router();

const LFGToken = require('../models/LFGToken');
const LFGTokenPrice = require('../models/LFGTokenPrice');

const LFG_BASE = 'https://api.dev-lfg.kaspa.com/tokens/search';
const DEFAULT_SORT = 'Market Cap (High to Low)';

const doFetch = async (url) => {
  if (global.fetch) return fetch(url);
  const { default: fetchPoly } = await import('node-fetch');
  return fetchPoly(url);
};

const minuteBucket = (d = new Date()) =>
  new Date(Math.floor(d.getTime() / 60000) * 60000);

// GET /api/lfg/search?q=KCOM&page=1&sortBy=Market%20Cap%20(High%20to%20Low)
router.get('/search', async (req, res) => {
  try {
    const { q = '', page = 1, sortBy = DEFAULT_SORT } = req.query;

    const url = new URL(LFG_BASE);
    url.searchParams.set('sortBy', sortBy);
    url.searchParams.set('view', 'grid');
    url.searchParams.set('page', String(page));

    const r = await doFetch(url.toString());
    if (!r.ok) {
      return res.status(502).json({ error: 'LFG API error', status: r.status });
    }
    const payload = await r.json();
    const items = Array.isArray(payload?.result) ? payload.result : [];

    const qLower = String(q).trim().toLowerCase();
    const filtered = qLower
      ? items.filter((it) => {
          const addr = String(it.tokenAddress || '').toLowerCase();
          const tick = String(it.ticker || '').toLowerCase();
          const name = String(it.name || '').toLowerCase();
          return addr.includes(qLower) || tick.includes(qLower) || name.includes(qLower);
        })
      : items;

    if (filtered.length) {
      const ops = filtered.map((it) => ({
        updateOne: {
          filter: { tokenAddress: String(it.tokenAddress || '').toLowerCase() },
          update: {
            $set: {
              deployerAddress: it.deployerAddress,
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
      }));
      await LFGToken.bulkWrite(ops, { ordered: false });
    }

    return res.json({
      success: true,
      page: payload?.page ?? Number(page),
      hasMore: !!payload?.hasMore,
      limit: payload?.limit ?? filtered.length,
      result: filtered,
    });
  } catch (err) {
    console.error('LFG /search error:', err);
    return res.status(500).json({ error: 'Internal error', details: String(err?.message || err) });
  }
});

// POST /api/lfg/:tokenAddress/snapshot
router.post('/:tokenAddress/snapshot', async (req, res) => {
  try {
    const tokenAddress = String(req.params.tokenAddress || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });

    // scan first few pages to find the token by address
    const pagesToScan = Math.max(1, Math.min(10, Number(req.query.pages || 3)));
    let found = null;
    for (let p = 1; p <= pagesToScan && !found; p++) {
      const url = new URL(LFG_BASE);
      url.searchParams.set('sortBy', DEFAULT_SORT);
      url.searchParams.set('view', 'grid');
      url.searchParams.set('page', String(p));

      const r = await doFetch(url.toString());
      if (!r.ok) continue;
      const payload = await r.json();
      const items = Array.isArray(payload?.result) ? payload.result : [];
      found = items.find((it) => String(it.tokenAddress || '').toLowerCase() === tokenAddress);
      if (found) break;
      if (!payload?.hasMore) break;
    }

    if (!found) return res.status(404).json({ error: 'Token not found on LFG pages scanned' });

    // upsert token metadata
    await LFGToken.updateOne(
      { tokenAddress },
      {
        $set: {
          deployerAddress: found.deployerAddress,
          ticker: found.ticker,
          name: found.name,
          description: found.description,
          totalSupply: found.totalSupply,
          image: found.image,
          colorHex: found.colorHex,
          devLock: found.devLock,
          isHypedLaunch: found.isHypedLaunch,
          bondingCurve: found.bondingCurve,
          state: found.state,
          decimals: found.decimals,
          version: found.version,
          isNSFW: found.isNSFW,
          txHash: found.txHash,
          socials: found.socials,

          price: found.price,
          marketCap: found.marketCap,
          volume: found.volume,
          priceChange: found.priceChange,

          updatedAtRemote: found.updatedAt ? new Date(found.updatedAt) : undefined,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const snapAt = minuteBucket(new Date());
    const vol = found.volume || {};
    const chg = found.priceChange || {};

    await LFGTokenPrice.updateOne(
      { tokenAddress, snappedAt: snapAt },
      {
        $set: {
          price: Number(found.price || 0),
          marketCap: Number(found.marketCap || 0),
          volume1h: Number(vol['1h'] || 0),
          volume4h: Number(vol['4h'] || 0),
          volume12h: Number(vol['12h'] || 0),
          volume1d: Number(vol['1d'] || 0),
          volume3d: Number(vol['3d'] || 0),
          volume7d: Number(vol['7d'] || 0),
          change1h: Number(chg['1h'] || 0),
          change4h: Number(chg['4h'] || 0),
          change12h: Number(chg['12h'] || 0),
          change1d: Number(chg['1d'] || 0),
          change3d: Number(chg['3d'] || 0),
          change7d: Number(chg['7d'] || 0),
        },
      },
      { upsert: true }
    );

    return res.json({ success: true, tokenAddress, snappedAt: snapAt });
  } catch (err) {
    console.error('LFG snapshot error:', err);
    return res.status(500).json({ error: 'Internal error', details: String(err?.message || err) });
  }
});

// GET /api/lfg/:tokenAddress/history
router.get('/:tokenAddress/history', async (req, res) => {
  try {
    const tokenAddress = String(req.params.tokenAddress || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress required' });

    const { from, to, limit = 500, order = 'asc' } = req.query;
    const q = { tokenAddress };
    if (from || to) {
      q.snappedAt = {};
      if (from) q.snappedAt.$gte = new Date(from);
      if (to) q.snappedAt.$lte = new Date(to);
    }

    const docs = await LFGTokenPrice.find(q)
      .sort({ snappedAt: order === 'desc' ? -1 : 1 })
      .limit(Math.min(5000, Number(limit || 500)));

    const points = docs.map((d) => ({
      t: d.snappedAt.getTime(),
      price: d.price,
      marketCap: d.marketCap,
      v1h: d.volume1h,
      v4h: d.volume4h,
      v12h: d.volume12h,
      v1d: d.volume1d,
      v3d: d.volume3d,
      v7d: d.volume7d,
    }));

    return res.json({ success: true, tokenAddress, count: points.length, points });
  } catch (err) {
    console.error('LFG history error:', err);
    return res.status(500).json({ error: 'Internal error', details: String(err?.message || err) });
  }
});

module.exports = router;
