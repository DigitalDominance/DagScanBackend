const axios = require('axios');
const DagscanProtocolStat = require('../models/dagscanProtocolStat');
const DagscanPool = require('../models/dagscanPool');
const DagscanTokenPrice = require('../models/dagscanTokenPrice');

/**
 * This service encapsulates the logic for pulling data from Zealous Swap's
 * public API and persisting it to MongoDB. By separating this logic out of
 * the HTTP layer it becomes trivial to schedule periodic synchronisations
 * without cluttering the main server file.
 */
class ZealousSwapService {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || 'https://api.zealousswap.com/v1/pools';
  }

  /**
   * Fetch the latest pool and protocol information from the Zealous API.
   * On success the data is returned as JSON. On failure an error is thrown.
   *
   * @returns {Promise<Object>} The JSON response body from Zealous Swap.
   */
  async fetchData() {
    const response = await axios.get(this.apiUrl, {
      headers: {
        'User-Agent': 'ZealousBackendBot/1.0'
      },
      timeout: 10000
    });
    return response.data;
  }

  /**
   * Convert a pool object from the Zealous API into two price points. Each
   * price is computed using the pool's TVL divided by twice the reserve of
   * the respective token (scaled for decimals). This formula approximates
   * the USD price of each token under the assumption that liquidity is
   * evenly distributed between the two assets. If reserves or TVL are
   * missing or zero the price is undefined and the token is omitted.
   *
   * @param {Object} pool The pool entry from the API.
   * @returns {Array<Object>} An array of price objects.
   */
  deriveTokenPrices(pool) {
    const prices = [];
    try {
      // Only attempt price calculation if TVL and reserves are present and non‑zero.
      if (pool.hasUSDValues && pool.tvl && pool.token0Reserves && pool.token1Reserves) {
        const halfTVL = pool.tvl / 2;
        // Token 0 price
        const t0Reserves = Number(pool.token0Reserves) / Math.pow(10, pool.token0.decimals);
        if (t0Reserves > 0) {
          const price0 = halfTVL / t0Reserves;
          prices.push({
            tokenAddress: pool.token0.address,
            symbol: pool.token0.symbol,
            name: pool.token0.name,
            priceUSD: price0,
            poolAddress: pool.address,
            timestamp: new Date(pool.updatedAt)
          });
        }
        // Token 1 price
        const t1Reserves = Number(pool.token1Reserves) / Math.pow(10, pool.token1.decimals);
        if (t1Reserves > 0) {
          const price1 = halfTVL / t1Reserves;
          prices.push({
            tokenAddress: pool.token1.address,
            symbol: pool.token1.symbol,
            name: pool.token1.name,
            priceUSD: price1,
            poolAddress: pool.address,
            timestamp: new Date(pool.updatedAt)
          });
        }
      }
    } catch (err) {
      // Swallow errors here so one malformed pool doesn't break the whole run
      console.error('Error deriving token prices', err);
    }
    return prices;
  }

  /**
   * Persist a single API run into MongoDB. All records are inserted without
   * updating previous entries – this preserves history. New records are
   * created for the protocol stats, each pool and the derived token prices.
   *
   * @param {Object} data The JSON object returned from `fetchData()`.
   */
  async persistData(data) {
    if (!data || typeof data !== 'object' || !data.protocol || !data.pools) {
      throw new Error('Malformed response from Zealous API');
    }
    // Save protocol snapshot
    const protocol = data.protocol;
    const protocolStat = new DagscanProtocolStat({
      totalTVL: protocol.totalTVL,
      totalVolumeUSD: protocol.totalVolumeUSD,
      poolCount: protocol.poolCount,
      updatedAt: new Date(protocol.updatedAt)
    });
    await protocolStat.save();
    // Save each pool snapshot and derive token prices
    const poolEntries = Object.entries(data.pools);
    for (const [addr, pool] of poolEntries) {
      const poolDoc = new DagscanPool({
        address: pool.address,
        token0: pool.token0,
        token1: pool.token1,
        token0Volume: pool.token0Volume,
        token1Volume: pool.token1Volume,
        tvl: pool.tvl,
        volumeUSD: pool.volumeUSD,
        token0Fees: pool.token0Fees,
        token1Fees: pool.token1Fees,
        feesUSD: pool.feesUSD,
        token0Reserves: pool.token0Reserves,
        token1Reserves: pool.token1Reserves,
        apr: pool.apr,
        hasUSDValues: pool.hasUSDValues,
        updatedAt: new Date(pool.updatedAt),
        hasActiveFarm: pool.hasActiveFarm,
        farmApr: pool.farmApr,
        regularFeeRate: pool.regularFeeRate,
        discountedFeeRate: pool.discountedFeeRate
      });
      await poolDoc.save();
      // Derive and save token prices
      const prices = this.deriveTokenPrices(pool);
      for (const price of prices) {
        const priceDoc = new DagscanTokenPrice(price);
        await priceDoc.save();
      }
    }
  }

  /**
   * Fetch and persist the latest Zealous data. This helper is used by the
   * scheduler to perform one complete sync cycle. Errors are logged but
   * swallowed to avoid crashing the scheduler.
   */
  async sync() {
    try {
      const data = await this.fetchData();
      await this.persistData(data);
    } catch (err) {
      console.error('Zealous sync failed', err);
    }
  }
}

module.exports = ZealousSwapService;