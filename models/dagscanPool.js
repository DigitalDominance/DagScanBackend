// DagScanBackend/models/dagscanPool.js
const mongoose = require('mongoose');

/**
 * We don't know your exact field set here (and you likely mutate it elsewhere),
 * so we keep strict:false to avoid breaking writes. We add defensive unique
 * indexes on the most common pool identifiers to block duplicates at the DB level.
 *
 * Collection name is pinned to 'zealousswappools' as you referenced.
 */
const dagscanPoolSchema = new mongoose.Schema(
  {},
  {
    strict: false,
    timestamps: true,
    autoIndex: true, // ensure indexes are built (prod can still override mongoose option globally)
    collection: 'zealousswappools',
  }
);

/**
 * Defensive unique indexes — any one of these will stop dup writes if your ingester
 * uses that field as the primary id. Partial filters avoid null/undefined collisions.
 * Keep all three; whichever field your pipeline actually uses will enforce uniqueness.
 */
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

module.exports =
  mongoose.models.DagscanPool ||
  mongoose.model('DagscanPool', dagscanPoolSchema);
