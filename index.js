const express = require('express');
const mongoose = require('mongoose');
const cron = require('node-cron');
const cors = require('cors');

const DagscanProtocolStat = require('./models/dagscanProtocolStat');
const DagscanPool = require('./models/dagscanPool');
const DagscanTokenPrice = require('./models/dagscanTokenPrice');
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
  // Parse query params with defaults
  const { limit = 100, skip = 0, sortField = 'tvl', order = 'desc' } = req.query;
  // Build sort stage based on provided field and order
  const sortStage = {};
  // Only allow known sortable fields to prevent injection; default to tvl
  const allowedFields = ['tvl', 'volumeUSD', 'feesUSD', 'apr', 'updatedAt'];
  const field = allowedFields.includes(sortField) ? sortField : 'tvl';
  sortStage[field] = order === 'asc' ? 1 : -1;

  const pipeline = [
    // Sort by updatedAt descending so that $group picks the most recent doc per pool
    { $sort: { updatedAt: -1 } },
    { $group: { _id: '$address', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    // Sort by chosen field for market cap ordering
    { $sort: sortStage },
    // Apply pagination
    { $skip: parseInt(skip, 10) },
    { $limit: parseInt(limit, 10) },
    { $project: { _id: 0, __v: 0 } }
  ];
  // Use allowDiskUse to permit MongoDB to spill to disk when sorting large datasets
  const agg = DagscanPool.aggregate(pipeline).allowDiskUse(true);
  const latestByPool = await agg.exec();
  res.json(latestByPool);
}));

// GET /api/zealous/pools/:address/latest - get the latest snapshot for a single pool
zealousRouter.get('/pools/:address/latest', asyncHandler(async (req, res) => {
  const { address } = req.params;
  const doc = await DagscanPool.findOne({ address }).sort({ updatedAt: -1 });
  if (!doc) return res.status(404).json({ error: 'Pool not found' });
  res.json(doc);
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