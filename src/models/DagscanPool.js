"use strict";
// DagScanBackend/models/dagscanPool.js
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
/**
 * Keep schema open (strict:false) to avoid breaking existing writers.
 * Add defensive unique indexes to stop duplicates bloating the DB.
 * Collection name kept as 'zealousswappools' per existing usage.
 */
const dagscanPoolSchema = new mongoose_1.default.Schema({}, {
    strict: false,
    timestamps: true,
    autoIndex: true,
    collection: 'zealousswappools',
});
// Uniqueness guards (use whichever field your pipeline actually sets)
dagscanPoolSchema.index({ poolAddress: 1 }, { unique: true, partialFilterExpression: { poolAddress: { $type: 'string' } } });
dagscanPoolSchema.index({ address: 1 }, { unique: true, partialFilterExpression: { address: { $type: 'string' } } });
dagscanPoolSchema.index({ dex: 1, poolAddress: 1 }, {
    unique: true,
    partialFilterExpression: {
        dex: { $exists: true, $type: 'string' },
        poolAddress: { $type: 'string' },
    },
});
exports.default = mongoose_1.default.models.DagscanPool ||
    mongoose_1.default.model('DagscanPool', dagscanPoolSchema);
