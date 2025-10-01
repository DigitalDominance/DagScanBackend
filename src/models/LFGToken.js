"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const LFGTokenSchema = new mongoose_1.default.Schema({
    tokenAddress: { type: String, required: true },
    deployerAddress: { type: String },
    ticker: { type: String, index: true },
    name: { type: String, index: true },
    description: { type: String },
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
}, { timestamps: true, autoIndex: true, collection: 'lfg_tokens' });
LFGTokenSchema.pre('save', function (next) { if (this.tokenAddress)
    this.tokenAddress = this.tokenAddress.toLowerCase(); if (this.deployerAddress)
    this.deployerAddress = this.deployerAddress.toLowerCase(); next(); });
LFGTokenSchema.index({ tokenAddress: 1 }, { unique: true, partialFilterExpression: { tokenAddress: { $type: 'string' } } });
LFGTokenSchema.index({ ticker: 1 });
LFGTokenSchema.index({ name: 1 });
exports.default = mongoose_1.default.models.LFGToken || mongoose_1.default.model('LFGToken', LFGTokenSchema);
