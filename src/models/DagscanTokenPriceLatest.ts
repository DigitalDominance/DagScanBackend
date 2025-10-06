import mongoose from "mongoose";

/**
 * DagscanTokenPriceLatest stores the most recent price for each token. This
 * collection is updated on each sync by upserting the latest price point
 * from the tokens API. Each document is keyed on the tokenAddress.
 */
const dagscanTokenPriceLatestSchema = new mongoose.Schema({
  tokenAddress: { type: String, required: true, unique: true, index: true },
  symbol: { type: String, required: true },
  name: { type: String, required: true },
  logoURI: { type: String, required: false },
  priceUSD: { type: Number, required: true },
  verified: { type: Boolean, default: false },
  rank: { type: Number, required: true },
  decimals: { type: Number, required: true },
  // timestamp of the price measurement
  timestamp: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.model("DagscanTokenPriceLatest", dagscanTokenPriceLatestSchema)
