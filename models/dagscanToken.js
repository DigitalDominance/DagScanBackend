const mongoose = require("mongoose")

/**
 * DagscanToken stores token information fetched from the tokens API.
 * This serves as the master list of tokens we track.
 */
const dagscanTokenSchema = new mongoose.Schema({
  address: { type: String, required: true, unique: true, index: true },
  decimals: { type: Number, required: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  logoURI: { type: String, required: true },
  verified: { type: Boolean, default: false },
  rank: { type: Number, required: true },
  updatedAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model("DagscanToken", dagscanTokenSchema)
