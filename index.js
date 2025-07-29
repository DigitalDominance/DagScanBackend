const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');

const DagscanProtocolStat = require('./models/dagscanProtocolStat');
const DagscanPool = require('./models/dagscanPool');
const DagscanTokenPrice = require('./models/dagscanTokenPrice');
const DagscanPoolLatest = require('./models/dagscanPoolLatest');
const ZealousSwapService = require('./services/zealousSwapService');

// Create Express app
const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zealous';
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Instantiate the ZealousSwap service
const zealousService = new ZealousSwapService();

// Immediately perform a sync on startup
zealousService.sync();

// Schedule a sync every minute
cron.schedule('* * * * *', () => {
  zealousService.sync();
});

/**
 * Helper middleware to catch and forward errors. Avoids unhandled promise
 * rejections when awaiting asynchronous Mongoose operations.
 */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ===================== ROUTES =====================

//
// To make the API endpoints specific to the Zealous data source, we wrap
// them inside a dedicated Router and mount it under the `/api/zealous`
// prefix. This ensures that when additional DEX backends are introduced
// they can live alongside Zealous without route collisions. All Zealous
// endpoints mirror the previously exposed paths but are now namespaced
// to `api/zealous/…`. For example, the latest protocol stats are
// available at `/api/zealous/protocol/stats` rather than `/api/protocol/stats`.

const zealousRouter = express.Router();

// GET /api/zealous/protocol/stats - return the latest protocol snapshot
zealousRouter.get('/protocol/stats', asyncHandler(async (req, res) => {
  const latest = await DagscanProtocolStat.findOne().sort({ updatedAt: -1 });
  if (!latest) return res.status(404).json({ error: 'No protocol stats found' });
  res.json(latest);
}));

// GET /api/zealous/historical/volume/daily - return daily volume differences
zealousRouter.get('/historical/volume/daily', asyncHandler(async (req, res) => {
  const dailyVolumes = await DagscanProtocolStat.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
        minVolume: { $min: '$totalVolumeUSD' },
        maxVolume: { $max: '$totalVolumeUSD' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        volumeUSD: { $subtract: ['$maxVolume', '$minVolume'] }
      }
    },
    { $sort: { date: 1 } }
  ]);
  res.json(dailyVolumes);
}));

// GET /api/zealous/historical/volume - return all protocol stats sorted ascending
zealousRouter.get('/historical/volume', asyncHandler(async (req, res) => {
  const records = await DagscanProtocolStat.find().sort({ updatedAt: 1 });
  res.json(records);
}));

// GET /api/zealous/pools - list pools. Supports optional address filter and pagination
zealousRouter.get('/pools', asyncHandler(async (req, res) => {
  const { address, limit = 100, skip = 0 } = req.query;
  const query = {};
  if (address) query.address = address;
  const docs = await DagscanPool.find(query)
    .sort({ updatedAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(docs);
}));

// GET /api/zealous/pools/latest - return the most recent snapshot per pool address
//
// This endpoint previously returned all pools in memory, which caused MongoDB
// to exceed its 32MB in‑memory sort limit. To avoid out‑of‑memory errors and
// support large datasets, this implementation uses the `allowDiskUse` option
// and adds pagination and custom sorting. Clients can request a slice of the
// result set using `limit` and `skip` query parameters, and specify a field to
// sort on (defaults to `tvl`, a reasonable proxy for market cap). Sorting
// direction is controlled via `order=asc|desc` (default `desc`).
zealousRouter.get('/pools/latest', asyncHandler(async (req, res) => {
  // Read query params with defaults and validate sort field to prevent injection.
  const { limit = 100, skip = 0, sortField = 'tvl', order = 'desc' } = req.query;
  const allowedFields = ['tvl', 'volumeUSD', 'feesUSD', 'apr', 'updatedAt'];
  const field = allowedFields.includes(sortField) ? sortField : 'tvl';
  const sortOrder = order === 'asc' ? 1 : -1;
  // Query the latest pool collection directly. Because there is exactly one
  // document per address, this operation does not require a grouping
  // aggregation and is therefore much more efficient. Pagination and sorting
  // are applied using simple query options.
  const docs = await DagscanPoolLatest.find()
    .sort({ [field]: sortOrder })
    .skip(parseInt(skip, 10))
    .limit(parseInt(limit, 10));
  // Convert Mongoose documents to plain objects and remove internal fields
  const json = docs.map(doc => {
    const obj = doc.toObject();
    delete obj.__v;
    return obj;
  });
  res.json(json);
}));

// GET /api/zealous/pools/:address/latest - get the latest snapshot for a single pool
zealousRouter.get('/pools/:address/latest', asyncHandler(async (req, res) => {
  const { address } = req.params;
  // Query the latest pool collection directly for this address
  const doc = await DagscanPoolLatest.findOne({ address });
  if (!doc) return res.status(404).json({ error: 'Pool not found' });
  const obj = doc.toObject();
  delete obj.__v;
  res.json(obj);
}));

// GET /api/zealous/tokens/:tokenAddress/price - get price history for a token
zealousRouter.get('/tokens/:tokenAddress/price', asyncHandler(async (req, res) => {
  const { tokenAddress } = req.params;
  const { limit = 1000, skip = 0 } = req.query;
  const docs = await DagscanTokenPrice.find({ tokenAddress: tokenAddress.toLowerCase() })
    .sort({ timestamp: 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(docs);
}));

// GET /api/zealous/tokens/:tokenAddress/price/daily - daily aggregated price for token
zealousRouter.get('/tokens/:tokenAddress/price/daily', asyncHandler(async (req, res) => {
  const { tokenAddress } = req.params;
  const dailyPrices = await DagscanTokenPrice.aggregate([
    { $match: { tokenAddress: tokenAddress.toLowerCase() } },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        avgPrice: { $avg: '$priceUSD' },
        maxPrice: { $max: '$priceUSD' },
        minPrice: { $min: '$priceUSD' },
        firstPrice: { $first: '$priceUSD' },
        lastPrice: { $last: '$priceUSD' }
      }
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        avgPrice: 1,
        maxPrice: 1,
        minPrice: 1,
        firstPrice: 1,
        lastPrice: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
  res.json(dailyPrices);
}));

// GET /api/zealous/tokens/:tokenAddress/current - compute the current token price
//
// This endpoint derives the current USD price for a token using the latest
// snapshot of pools that contain the token. It selects the pool with the
// highest TVL to maximize liquidity and then calculates the price based on
// half the TVL divided by the token's reserves. If no pool contains the
// token, a 404 is returned.
zealousRouter.get('/tokens/:tokenAddress/current', asyncHandler(async (req, res) => {
  const tokenAddress = req.params.tokenAddress.toLowerCase();
  // Find the pool with the highest TVL that contains this token as token0 or token1
  const pool = await DagscanPoolLatest.findOne({
    $or: [
      { 'token0.address': tokenAddress },
      { 'token1.address': tokenAddress }
    ]
  }).sort({ tvl: -1 });
  if (!pool) return res.status(404).json({ error: 'Token not found in any pool' });
  let priceUSD;
  let symbol;
  // Compute price depending on whether the token is token0 or token1
  if (pool.token0.address.toLowerCase() === tokenAddress) {
    const reserves = Number(pool.token0Reserves) / Math.pow(10, pool.token0.decimals);
    priceUSD = reserves > 0 ? (pool.tvl / 2) / reserves : 0;
    symbol = pool.token0.symbol;
  } else {
    const reserves = Number(pool.token1Reserves) / Math.pow(10, pool.token1.decimals);
    priceUSD = reserves > 0 ? (pool.tvl / 2) / reserves : 0;
    symbol = pool.token1.symbol;
  }
  res.json({
    tokenAddress: tokenAddress,
    symbol: symbol,
    priceUSD: priceUSD,
    poolAddress: pool.address,
    updatedAt: pool.updatedAt
  });
}));

// Mount the Zealous router under /api/zealous
app.use('/api/zealous', zealousRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Zealous backend listening on port ${port}`);
});