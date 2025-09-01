const mongoose = require('mongoose');
const LFGTokenSchema = new mongoose.Schema({
  tokenAddress: { type: String, required: true },
  ticker: { type: String, index: true },
  name: { type: String, index: true },
  description: { type: String },
  deployerAddress: { type: String },
  totalSupply: { type: Number },
  image: { type: String },
  colorHex: { type: String },
  devLock: { type: String },
  isHypedLaunch: { type: Boolean },
  bondingCurve: { type: String },
  state: { type: String },
  decimals: { type: Number },
  version: { type: Number },
  isNSFW: { type: Boolean },
  txHash: { type: String },
  socials: { type: Object },
  price: { type: Number },
  marketCap: { type: Number },
  volume: { type: Object },
  priceChange: { type: Object },
  updatedAtRemote: { type: Date },
  lastSyncedAt: { type: Date },
}, { timestamps: true, collection: 'lfg_tokens', autoIndex: true });
LFGTokenSchema.pre('save', function(next){ if(this.tokenAddress) this.tokenAddress=this.tokenAddress.toLowerCase(); next(); });
LFGTokenSchema.index({ tokenAddress: 1 }, { unique: true, partialFilterExpression: { tokenAddress: { $type: 'string' } } });
module.exports = mongoose.models.LFGToken || mongoose.model('LFGToken', LFGTokenSchema);
