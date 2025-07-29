const mongoose = require('mongoose');

/**
 * DagscanTokenPriceLatest stores the most recent price for each token. This
 * collection is updated on each sync by upserting the latest price point
 * derived from the pools. Storing a single document per token makes it
 * efficient to query the current USD price without scanning the entire
 * `DagscanTokenPrice` history. Each document is keyed on the tokenAddress.
 */
const dagscanTokenPriceLatestSchema = new mongoose.Schema({
  tokenAddress: { type: String, required: true, unique: true, index: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  priceUSD: { type: Number, required: true },
  poolAddress: { type: String, required: true },
  // timestamp of the underlying price measurement
  timestamp: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DagscanTokenPriceLatest', dagscanTokenPriceLatestSchema);