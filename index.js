const LFGTokenPrice = require('./models/LFGTokenPrice');
const express = require("express")
const mongoose = require("mongoose")
const cron = require("node-cron")
const cors = require("cors")

const DagscanProtocolStat = require("./models/dagscanProtocolStat")
const DagscanPool = require("./models/dagscanPool")
const DagscanTokenPrice = require("./models/dagscanTokenPrice")
const DagscanPoolLatest = require("./models/dagscanPoolLatest")
const DagscanTokenPriceLatest = require("./models/dagscanTokenPriceLatest")
const DagscanToken = require("./models/dagscanToken")
const ZealousSwapService = require("./services/zealousSwapService")
const lfgRouter = require('./routes/lfg');
const { startLFGTop100Cron } = require('./jobs/lfgTop100Cron');

// Create Express app
const app = express()
app.use(express.json())
app.use(cors())

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/zealous"
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB")
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err)
  })

// Instantiate the ZealousSwap service
const zealousService = new ZealousSwapService()

// Immediately perform a sync on startup
zealousService.sync()

// Schedule a sync every minute
cron.schedule("* * * * *", () => {
  zealousService.sync()
})

/**
 * Helper middleware to catch and forward errors. Avoids unhandled promise
 * rejections when awaiting asynchronous Mongoose operations.
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// ===================== ROUTES =====================

const zealousRouter = express.Router()

// GET /api/zealous/protocol/stats - return the latest protocol snapshot
zealousRouter.get(
  "/protocol/stats",
  asyncHandler(async (req, res) => {
    const latest = await DagscanProtocolStat.findOne().sort({ updatedAt: -1 })
    if (!latest) return res.status(404).json({ error: "No protocol stats found" })
    res.json(latest)
  }),
)

// GET /api/zealous/historical/volume/daily - return daily volume differences
zealousRouter.get(
  "/historical/volume/daily",
  asyncHandler(async (req, res) => {
    const dailyVolumes = await DagscanProtocolStat.aggregate([
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
    ])
    res.json(dailyVolumes)
  }),
)

// GET /api/zealous/historical/volume - return all protocol stats sorted ascending
zealousRouter.get(
  "/historical/volume",
  asyncHandler(async (req, res) => {
    const records = await DagscanProtocolStat.find().sort({ updatedAt: 1 })
    res.json(records)
  }),
)

// GET /api/zealous/tokens - list all tracked tokens
zealousRouter.get(
  "/tokens",
  asyncHandler(async (req, res) => {
    const { limit = 100, skip = 0 } = req.query
    const docs = await DagscanToken.find().sort({ rank: 1 }).skip(Number.parseInt(skip)).limit(Number.parseInt(limit))
    res.json(docs)
  }),
)

// GET /api/zealous/pools - list pools. Supports optional address filter and pagination
zealousRouter.get(
  "/pools",
  asyncHandler(async (req, res) => {
    const { address, limit = 100, skip = 0 } = req.query
    const query = {}
    if (address) query.address = address
    const docs = await DagscanPool.find(query)
      .sort({ updatedAt: -1 })
      .skip(Number.parseInt(skip))
      .limit(Number.parseInt(limit))
    res.json(docs)
  }),
)

// GET /api/zealous/pools/latest - return the most recent snapshot per pool address
zealousRouter.get(
  "/pools/latest",
  asyncHandler(async (req, res) => {
    const { limit = 100, skip = 0, sortField = "tvl", order = "desc" } = req.query
    const allowedFields = ["tvl", "volumeUSD", "feesUSD", "apr", "updatedAt"]
    const field = allowedFields.includes(sortField) ? sortField : "tvl"
    const sortOrder = order === "asc" ? 1 : -1

    const docs = await DagscanPoolLatest.find()
      .sort({ [field]: sortOrder })
      .skip(Number.parseInt(skip, 10))
      .limit(Number.parseInt(limit, 10))

    const json = docs.map((doc) => {
      const obj = doc.toObject()
      delete obj.__v
      return obj
    })
    res.json(json)
  }),
)

// GET /api/zealous/pools/:address/latest - get the latest snapshot for a single pool
zealousRouter.get(
  "/pools/:address/latest",
  asyncHandler(async (req, res) => {
    const { address } = req.params
    const doc = await DagscanPoolLatest.findOne({ address })
    if (!doc) return res.status(404).json({ error: "Pool not found" })
    const obj = doc.toObject()
    delete obj.__v
    res.json(obj)
  }),
)

// GET /api/zealous/tokens/:tokenAddress/price - get price history for a token
zealousRouter.get(
  "/tokens/:tokenAddress/price",
  asyncHandler(async (req, res) => {
    const { tokenAddress } = req.params
    const { limit = 1000, skip = 0 } = req.query
    const docs = await DagscanTokenPrice.find({ tokenAddress: tokenAddress.toLowerCase() })
      .sort({ timestamp: 1 })
      .skip(Number.parseInt(skip))
      .limit(Number.parseInt(limit))
    res.json(docs)
  }),
)

// GET /api/zealous/tokens/:tokenAddress/price/daily - daily aggregated price for token
zealousRouter.get(
  "/tokens/:tokenAddress/price/daily",
  asyncHandler(async (req, res) => {
    const { tokenAddress } = req.params
    const dailyPrices = await DagscanTokenPrice.aggregate([
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
    ])
    res.json(dailyPrices)
  }),
)

// GET /api/zealous/tokens/:tokenAddress/current - get the current token price from latest collection
zealousRouter.get(
  "/tokens/:tokenAddress/current",
  asyncHandler(async (req, res) => {
    const tokenAddress = req.params.tokenAddress.toLowerCase()
    const tokenPrice = await DagscanTokenPriceLatest.findOne({ tokenAddress })
    if (!tokenPrice) return res.status(404).json({ error: "Token not found" })

    const obj = tokenPrice.toObject()
    delete obj.__v
    res.json(obj)
  }),
)

// Mount the Zealous router under /api/zealous
app.get('/api/lfg/_health', (req,res)=>res.json({ok:true}));
app.use('/api/lfg', lfgRouter);
app.use('/lfg', lfgRouter);
app.get('/api/lfg/history', async (req, res) => {
  try {
    const tokenAddress = String(req.query.tokenAddress || req.query.address || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress query required' });
    const { from, to, limit = 500, order = 'asc' } = req.query;
    const q = { tokenAddress };
    if (from || to) { q.snappedAt = {}; if (from) q.snappedAt.$gte = new Date(from); if (to) q.snappedAt.$lte = new Date(to); }
    const docs = await LFGTokenPrice.find(q).sort({ snappedAt: order === 'desc' ? -1 : 1 }).limit(Math.min(5000, Number(limit || 500)));
    const points = docs.map(d => ({ t: d.snappedAt.getTime(), price: d.price, marketCap: d.marketCap, v1h: d.volume1h, v4h: d.volume4h, v12h: d.volume12h, v1d: d.volume1d, v3d: d.volume3d, v7d: d.volume7d }));
    return res.json({ success: true, tokenAddress, count: points.length, points });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
});
app.get('/lfg/history', async (req, res) => {
  try {
    const tokenAddress = String(req.query.tokenAddress || req.query.address || '').toLowerCase();
    if (!tokenAddress) return res.status(400).json({ error: 'tokenAddress query required' });
    const { from, to, limit = 500, order = 'asc' } = req.query;
    const q = { tokenAddress };
    if (from || to) { q.snappedAt = {}; if (from) q.snappedAt.$gte = new Date(from); if (to) q.snappedAt.$lte = new Date(to); }
    const docs = await LFGTokenPrice.find(q).sort({ snappedAt: order === 'desc' ? -1 : 1 }).limit(Math.min(5000, Number(limit || 500)));
    const points = docs.map(d => ({ t: d.snappedAt.getTime(), price: d.price, marketCap: d.marketCap, v1h: d.volume1h, v4h: d.volume4h, v12h: d.volume12h, v1d: d.volume1d, v3d: d.volume3d, v7d: d.volume7d }));
    return res.json({ success: true, tokenAddress, count: points.length, points });
  } catch (e) {
    return res.status(500).json({ error: 'Internal error', details: String(e?.message || e) });
  }
});
app.use("/api/zealous", zealousRouter)

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" })
})

// Error handler
app.use((err, req, res, next) => {
app.use('/api/lfg', lfgRouter);
  console.error(err)
  res.status(500).json({ error: "Internal server error" })
})

// Start server
const port = process.env.PORT || 3000
startLFGTop100Cron();
app.listen(port, () => {
  console.log(`Zealous backend listening on port ${port}`)
})