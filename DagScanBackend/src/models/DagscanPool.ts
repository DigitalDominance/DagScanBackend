// DagScanBackend/models/dagscanPool.js

import mongoose from "mongoose";

/**
 * Keep schema open (strict:false) to avoid breaking existing writers.
 * Add defensive unique indexes to stop duplicates bloating the DB.
 * Collection name kept as 'zealousswappools' per existing usage.
 */
const dagscanPoolSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    timestamps: true,
    autoIndex: true,
    collection: 'zealousswappools',
  }
);

// Uniqueness guards (use whichever field your pipeline actually sets)
dagscanPoolSchema.index(
  { poolAddress: 1 },
  { unique: true, partialFilterExpression: { poolAddress: { $type: 'string' } } }
);

dagscanPoolSchema.index(
  { address: 1 },
  { unique: true, partialFilterExpression: { address: { $type: 'string' } } }
);

dagscanPoolSchema.index(
  { dex: 1, poolAddress: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dex: { $exists: true, $type: 'string' },
      poolAddress: { $type: 'string' },
    },
  }
);

export default
  mongoose.models.DagscanPool ||
  mongoose.model('DagscanPool', dagscanPoolSchema);
