"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * DagscanTokenPriceLatest stores the most recent price for each token. This
 * collection is updated on each sync by upserting the latest price point
 * from the tokens API. Each document is keyed on the tokenAddress.
 */
const dagscanTokenPriceLatestSchema = new mongoose_1.default.Schema({
    tokenAddress: { type: String, required: true, unique: true, index: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    logoURI: { type: String, required: true },
    priceUSD: { type: Number, required: true },
    verified: { type: Boolean, default: false },
    rank: { type: Number, required: true },
    decimals: { type: Number, required: true },
    // timestamp of the price measurement
    timestamp: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});
exports.default = mongoose_1.default.model("DagscanTokenPriceLatest", dagscanTokenPriceLatestSchema);
