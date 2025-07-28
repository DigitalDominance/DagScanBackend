const mongoose = require('mongoose');

/**
 * DagscanPool represents a snapshot of an individual liquidity pool on
 * Zealous Swap. Each record contains information about the two tokens that
 * compose the pool, liquidity metrics and fee parameters. Multiple records
 * will exist for a given pool address as we store every minute update; the
 * most recent record can be queried by sorting on `updatedAt`.
 */
const dagscanPoolSchema = new mongoose.Schema({
  address: { type: String, required: true, index: true },
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
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DagscanPool', dagscanPoolSchema);