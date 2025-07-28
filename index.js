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

// GET /api/protocol/stats - return the latest protocol snapshot
app.get('/api/protocol/stats', asyncHandler(async (req, res) => {
  const latest = await DagscanProtocolStat.findOne().sort({ updatedAt: -1 });
  if (!latest) return res.status(404).json({ error: 'No protocol stats found' });
  res.json(latest);
}));

// GET /api/historical/volume/daily - return daily volume differences
app.get('/api/historical/volume/daily', asyncHandler(async (req, res) => {
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

// GET /api/historical/volume - return all protocol stats sorted ascending
app.get('/api/historical/volume', asyncHandler(async (req, res) => {
  const records = await DagscanProtocolStat.find().sort({ updatedAt: 1 });
  res.json(records);
}));

// GET /api/pools - list pools. Supports optional address filter and pagination
app.get('/api/pools', asyncHandler(async (req, res) => {
  const { address, limit = 100, skip = 0 } = req.query;
  const query = {};
  if (address) query.address = address;
  const docs = await DagscanPool.find(query)
    .sort({ updatedAt: -1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(docs);
}));

// GET /api/pools/latest - return the most recent snapshot per pool address
app.get('/api/pools/latest', asyncHandler(async (req, res) => {
  const latestByPool = await DagscanPool.aggregate([
    { $sort: { updatedAt: -1 } },
    { $group: { _id: '$address', doc: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$doc' } },
    { $project: { _id: 0, __v: 0 } }
  ]);
  res.json(latestByPool);
}));

// GET /api/pools/:address/latest - get the latest snapshot for a single pool
app.get('/api/pools/:address/latest', asyncHandler(async (req, res) => {
  const { address } = req.params;
  const doc = await DagscanPool.findOne({ address }).sort({ updatedAt: -1 });
  if (!doc) return res.status(404).json({ error: 'Pool not found' });
  res.json(doc);
}));

// GET /api/tokens/:tokenAddress/price - get price history for a token
app.get('/api/tokens/:tokenAddress/price', asyncHandler(async (req, res) => {
  const { tokenAddress } = req.params;
  const { limit = 1000, skip = 0 } = req.query;
  const docs = await DagscanTokenPrice.find({ tokenAddress: tokenAddress.toLowerCase() })
    .sort({ timestamp: 1 })
    .skip(parseInt(skip))
    .limit(parseInt(limit));
  res.json(docs);
}));

// GET /api/tokens/:tokenAddress/price/daily - daily aggregated price for token
app.get('/api/tokens/:tokenAddress/price/daily', asyncHandler(async (req, res) => {
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