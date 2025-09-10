import mongoose from "mongoose";


/**
 * DagscanPoolLatest stores the most recent snapshot for each liquidity pool on
 * Zealous Swap. Unlike `DagscanPool`, which stores every historic snapshot,
 * this collection maintains a single document per pool address. During each
 * sync we upsert (insert or replace) the latest data for a given pool, so
 * that queries for current pool state can be performed efficiently without
 * expensive aggregations over the historical collection. Fields mirror
 * DagscanPool for easy substitution in API responses.
 */
const dagscanPoolLatestSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, index: true },
  token0: {
    address: { type: String, required: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    decimals: { type: Number, required: true }
  },
  token1: {
    address: { type: String, required: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    decimals: { type: Number, required: true }
  },
  token0Volume: { type: mongoose.Schema.Types.Mixed, required: true },
  token1Volume: { type: mongoose.Schema.Types.Mixed, required: true },
  tvl: { type: Number, required: true },
  volumeUSD: { type: Number, required: true },
  token0Fees: { type: mongoose.Schema.Types.Mixed, required: true },
  token1Fees: { type: mongoose.Schema.Types.Mixed, required: true },
  feesUSD: { type: Number, required: true },
  token0Reserves: { type: mongoose.Schema.Types.Mixed, required: true },
  token1Reserves: { type: mongoose.Schema.Types.Mixed, required: true },
  apr: { type: Number, required: true },
  hasUSDValues: { type: Boolean, default: false },
  updatedAt: { type: Date, required: true },
  hasActiveFarm: { type: Boolean, default: false },
  farmApr: { type: Number, default: 0 },
  regularFeeRate: { type: Number },
  discountedFeeRate: { type: Number },
  // Preserve the time this snapshot was stored in the latest collection
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('DagscanPoolLatest', dagscanPoolLatestSchema);
