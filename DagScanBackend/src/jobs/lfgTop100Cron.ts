// DagScanBackend/jobs/lfgTop100Cron.js
const cron = require('node-cron');
const LFGToken = require('../models/LFGToken');
const LFGTokenPrice = require('../models/LFGTokenPrice');

const LFG_BASE = 'https://api.dev-lfg.kaspa.com/tokens/search';
const DEFAULT_SORT = 'Market Cap (High to Low)';

const doFetch = async (url: any) => {
  return fetch(url);
};

const minuteBucket = (d = new Date()) =>
  new Date(Math.floor(d.getTime() / 60000) * 60000);

async function fetchTopTokens(pagesToScan = 8, cap = 100) {
  const out = [];
  for (let p = 1; p <= pagesToScan; p++) {
    const url = new URL(LFG_BASE);
    url.searchParams.set('sortBy', DEFAULT_SORT);
    url.searchParams.set('view', 'grid');
    url.searchParams.set('page', String(p));
    try {
      const r = await doFetch(url.toString());
      if (!r.ok) {
        console.warn(`[LFG_TOP100_CRON] page ${p} fetch failed: ${r.status}`);
        break;
      }
      const payload = await r.json();
      const items = Array.isArray(payload?.result) ? payload.result : [];
      for (const it of items) {
        out.push(it);
        if (out.length >= cap) break;
      }
      if (out.length >= cap || !payload?.hasMore) break;
    } catch (e: any) {
      console.warn('[LFG_TOP100_CRON] fetch error:', e?.message || e);
      break;
    }
  }
  return out.slice(0, cap);
}

async function snapshotTop(tokens: any) {
  if (!tokens.length) return;
  const snapAt = minuteBucket(new Date());

  const tokenOps = tokens.map((it: any) => ({
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

  const priceOps = tokens.map((it: any) => {
    const tokenAddress = String(it.tokenAddress || '').toLowerCase();
    const vol = it.volume || {};
    const chg = it.priceChange || {};
    return {
      updateOne: {
        filter: { tokenAddress, snappedAt: snapAt },
        update: {
          $set: {
            price: Number(it.price || 0),
            marketCap: Number(it.marketCap || 0),
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
        upsert: true,
      },
    };
  });

  if (tokenOps.length) await LFGToken.bulkWrite(tokenOps, { ordered: false });
  if (priceOps.length) await LFGTokenPrice.bulkWrite(priceOps, { ordered: false });
  return { tokens: tokens.length, snappedAt: snapAt };
}

let running = false;
function startLFGTop100Cron() {
  const enabled = (process.env.LFG_CRON_ENABLED || 'true').toLowerCase() !== 'false';
  if (!enabled) {
    console.log('[LFG_TOP100_CRON] disabled via LFG_CRON_ENABLED=false');
    return;
  }
  cron.schedule('* * * * *', async () => {
    if (running) return;
    running = true;
    try {
      const list = await fetchTopTokens(8, 100);
      if (list.length) {
        const res = await snapshotTop(list);
        console.log('[LFG_TOP100_CRON] snap', res);
      } else {
        console.log('[LFG_TOP100_CRON] no tokens fetched');
      }
    } catch (e: any) {
      console.error('[LFG_TOP100_CRON] error', e?.message || e);
    } finally {
      running = false;
    }
  });
  console.log('[LFG_TOP100_CRON] scheduled (*/1 * * * *) top 100');
}

export default startLFGTop100Cron;
