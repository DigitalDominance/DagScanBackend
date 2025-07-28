const mongoose = require('mongoose');

/**
 * DagscanTokenPrice stores derived price points for individual tokens. Each
 * document records the USD price of a token at a specific timestamp along with
 * the pool it was derived from. Storing the pool address makes it possible
 * to trace back how a price was calculated. Multiple price points per token
 * per day will exist; clients can aggregate these points for charting.
 */
const dagscanTokenPriceSchema = new mongoose.Schema({
  tokenAddress: { type: String, required: true, index: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  priceUSD: { type: Number, required: true },
  poolAddress: { type: String, required: true },
  timestamp: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DagscanTokenPrice', dagscanTokenPriceSchema);