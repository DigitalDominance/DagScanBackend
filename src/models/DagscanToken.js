"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * DagscanToken stores token information fetched from the tokens API.
 * This serves as the master list of tokens we track.
 */
const dagscanTokenSchema = new mongoose_1.default.Schema({
    address: { type: String, required: true, unique: true, index: true },
    decimals: { type: Number, required: true },
    name: { type: String, required: true },
    symbol: { type: String, required: true },
    logoURI: { type: String, required: true },
    verified: { type: Boolean, default: false },
    rank: { type: Number, required: true },
    updatedAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
});
exports.default = mongoose_1.default.model("DagscanToken", dagscanTokenSchema);
