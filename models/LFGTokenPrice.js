const mongoose = require('mongoose');
const LFGTokenPriceSchema = new mongoose.Schema({
  tokenAddress: { type: String, required: true, index: true },
  snappedAt: { type: Date, required: true, index: true },
  price: { type: Number, required: true },
  marketCap: { type: Number },
  volume1h: { type: Number }, volume4h: { type: Number }, volume12h: { type: Number },
  volume1d: { type: Number }, volume3d: { type: Number }, volume7d: { type: Number },
  change1h: { type: Number }, change4h: { type: Number }, change12h: { type: Number },
  change1d: { type: Number }, change3d: { type: Number }, change7d: { type: Number },
}, { timestamps: true, collection: 'lfg_token_prices', autoIndex: true });
LFGTokenPriceSchema.index({ tokenAddress: 1, snappedAt: 1 }, { unique: true });
module.exports = mongoose.models.LFGTokenPrice || mongoose.model('LFGTokenPrice', LFGTokenPriceSchema);
