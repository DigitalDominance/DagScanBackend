import mongoose from "mongoose";

/**
 * DagscanTokenPrice stores derived price points for individual tokens. Each
 * document records the USD price of a token at a specific timestamp. Prices
 * are now fetched from the dedicated price API rather than derived from pools.
 */
const dagscanTokenPriceSchema = new mongoose.Schema({
  tokenAddress: { type: String, required: true, index: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  logoURI: { type: String, required: true },
  priceUSD: { type: Number, required: true },
  timestamp: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.model("DagscanTokenPrice", dagscanTokenPriceSchema)
