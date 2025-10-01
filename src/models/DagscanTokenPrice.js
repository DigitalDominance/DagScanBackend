"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * DagscanTokenPrice stores derived price points for individual tokens. Each
 * document records the USD price of a token at a specific timestamp. Prices
 * are now fetched from the dedicated price API rather than derived from pools.
 */
const dagscanTokenPriceSchema = new mongoose_1.default.Schema({
    tokenAddress: { type: String, required: true, index: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    logoURI: { type: String, required: true },
    priceUSD: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});
exports.default = mongoose_1.default.model("DagscanTokenPrice", dagscanTokenPriceSchema);
