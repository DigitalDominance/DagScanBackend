import mongoose from "mongoose";


/**
 * DagscanProtocolStat is used to record snapshots of the Zealous Swap protocol
 * statistics. Each document represents an API update with total value locked
 * (TVL), total traded volume in USD and the number of pools at a given
 * timestamp. These records allow us to derive historical volume figures by
 * comparing the min/max volume per day.
 */
const dagscanProtocolStatSchema = new mongoose.Schema({
  totalTVL: { type: Number, required: true },
  totalVolumeUSD: { type: Number, required: true },
  poolCount: { type: Number, required: true },
  /**
   * The timestamp returned by the Zealous API. Storing it separately from
   * createdAt allows us to reason about when the remote data was actually
   * updated. This is stored as an ISO date string in the API; Mongoose will
   * automatically coerce it to a JavaScript Date.
   */
  updatedAt: { type: Date, required: true },
  /**
   * When this record was inserted into our database. This is set
   * automatically by Mongoose.
   */
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('DagscanProtocolStat', dagscanProtocolStatSchema);
