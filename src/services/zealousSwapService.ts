import axios from 'axios'
import DagscanToken from '../models/DagscanToken';
import DagscanTokenPriceLatest from '../models/DagscanTokenPriceLatest';
import DagscanTokenPrice from '../models/DagscanTokenPrice';
import DagscanProtocolStat from '../models/DagscanProtocolStat';
import DagscanPool from '../models/DagscanPool';
import DagscanPoolLatest from '../models/DagscanPoolLatest';

/**
 * This service encapsulates the logic for pulling data from Zealous Swap's
 * public APIs and persisting it to MongoDB. It now uses the dedicated tokens
 * API as the source of truth for token data and prices.
 */
class ZealousSwapService {
  private poolsApiUrl = ''
  private tokensApiUrl = ''
  private pricesApiUrl = ''
  constructor(options: { poolsApiUrl?: string; tokensApiUrl?: string; pricesApiUrl?: string } = {}) {
    this.poolsApiUrl = options.poolsApiUrl || "https://kasplex.zealousswap.com/v1/pools"
    this.tokensApiUrl = options.tokensApiUrl || "https://kasplex.zealousswap.com/v1/tokens"
    this.pricesApiUrl = options.pricesApiUrl || "https://kasplex.zealousswap.com/v1/prices"
  }

  /**
   * Fetch the latest pool and protocol information from the Zealous API.
   * @returns {Promise<Object>} The JSON response body from Zealous Swap pools API.
   */
  async fetchPoolsData() {
    const response = await axios.get(this.poolsApiUrl, {
      headers: {
        "User-Agent": "ZealousBackendBot/1.0",
      },
      timeout: 10000,
    })
    return response.data
  }

  /**
   * Fetch the latest tokens information from the Zealous tokens API.
   * @returns {Promise<Object>} The JSON response body from Zealous Swap tokens API.
   */
  async fetchTokensData() {
    const response = await axios.get(this.tokensApiUrl, {
      headers: {
        "User-Agent": "ZealousBackendBot/1.0",
      },
      timeout: 10000,
    })
    return response.data
  }

  /**
   * Fetch the latest token prices from the Zealous prices API.
   * @returns {Promise<Object>} The JSON response body with token prices.
   */
  async fetchPricesData() {
    const response = await axios.get(this.pricesApiUrl, {
      headers: {
        "User-Agent": "ZealousBackendBot/1.0",
      },
      timeout: 10000,
    })
    return response.data
  }

  /**
   * Persist tokens data from the tokens API into MongoDB.
   * @param {Object} tokensData The JSON object returned from fetchTokensData().
   */
  async persistTokensData(tokensData: any) {
    if (!tokensData || !tokensData.tokens || !Array.isArray(tokensData.tokens)) {
      throw new Error("Malformed response from Zealous tokens API")
    }

    const timestamp = new Date()

    for (const token of tokensData.tokens) {
      // Upsert token information
      await DagscanToken.findOneAndUpdate(
        { address: token.address.toLowerCase() },
        {
          address: token.address.toLowerCase(),
          decimals: token.decimals,
          name: token.name,
          symbol: token.symbol,
          logoURI: token.logoURI,
          verified: token.verified,
          rank: token.rank,
          updatedAt: timestamp,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )

      // Save historical price data
      const priceDoc = new DagscanTokenPrice({
        tokenAddress: token.address.toLowerCase(),
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI,
        priceUSD: token.price,
        timestamp: timestamp,
      })
      await priceDoc.save()

      // Upsert latest price
      await DagscanTokenPriceLatest.findOneAndUpdate(
        { tokenAddress: token.address.toLowerCase() },
        {
          tokenAddress: token.address.toLowerCase(),
          symbol: token.symbol,
          name: token.name,
          logoURI: token.logoURI,
          priceUSD: token.price,
          verified: token.verified,
          rank: token.rank,
          decimals: token.decimals,
          timestamp: timestamp,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
    }
  }

  /**
   * Persist pools data, but only for tokens that exist in our tokens collection.
   * This ensures we only track volume data for verified tokens.
   * @param {Object} poolsData The JSON object returned from fetchPoolsData().
   */
  async persistPoolsData(poolsData: any) {
    if (!poolsData || typeof poolsData !== "object" || !poolsData.protocol || !poolsData.pools) {
      throw new Error("Malformed response from Zealous pools API")
    }

    // Get all tracked token addresses
    const trackedTokens = await DagscanToken.find({}, { address: 1 })
    const trackedAddresses = new Set(trackedTokens.map((t) => t.address.toLowerCase()))

    // Save protocol snapshot
    const protocol = poolsData.protocol
    const protocolStat = new DagscanProtocolStat({
      totalTVL: protocol.totalTVL,
      totalVolumeUSD: protocol.totalVolumeUSD,
      poolCount: protocol.poolCount,
      updatedAt: new Date(protocol.updatedAt),
    })
    await protocolStat.save()

    // Save pool snapshots only for pools containing tracked tokens
    const poolEntries = Object.entries(poolsData.pools)
    for (const [addr, pool] of poolEntries) {
      const token0Address = (pool as any).token0.address.toLowerCase()
      const token1Address = (pool as any).token1.address.toLowerCase()

      // Only process pools that contain at least one tracked token
      if (trackedAddresses.has(token0Address) || trackedAddresses.has(token1Address)) {
        const poolDoc = new DagscanPool({
          address: (pool as any).address,
          token0: (pool as any).token0,
          token1: (pool as any).token1,
          token0Volume: (pool as any).token0Volume,
          token1Volume: (pool as any).token1Volume,
          tvl: (pool as any).tvl,
          volumeUSD: (pool as any).volumeUSD,
          token0Fees: (pool as any).token0Fees,
          token1Fees: (pool as any).token1Fees,
          feesUSD: (pool as any).feesUSD,
          token0Reserves: (pool as any).token0Reserves,
          token1Reserves: (pool as any).token1Reserves,
          apr: (pool as any).apr,
          hasUSDValues: (pool as any).hasUSDValues,
          updatedAt: new Date((pool as any).updatedAt),
          hasActiveFarm: (pool as any).hasActiveFarm,
          farmApr: (pool as any).farmApr,
          regularFeeRate: (pool as any).regularFeeRate,
          discountedFeeRate: (pool as any).discountedFeeRate,
        })
        await poolDoc.save()

        // Upsert into the latest pool collection
        await DagscanPoolLatest.findOneAndUpdate(
          { address: (pool as any).address },
          {
            address: (pool as any).address,
            token0: (pool as any).token0,
            token1: (pool as any).token1,
            token0Volume: (pool as any).token0Volume,
            token1Volume: (pool as any).token1Volume,
            tvl: (pool as any).tvl,
            volumeUSD: (pool as any).volumeUSD,
            token0Fees: (pool as any).token0Fees,
            token1Fees: (pool as any).token1Fees,
            feesUSD: (pool as any).feesUSD,
            token0Reserves: (pool as any).token0Reserves,
            token1Reserves: (pool as any).token1Reserves,
            apr: (pool as any).apr,
            hasUSDValues: (pool as any).hasUSDValues,
            updatedAt: new Date((pool as any).updatedAt),
            hasActiveFarm: (pool as any).hasActiveFarm,
            farmApr: (pool as any).farmApr,
            regularFeeRate: (pool as any).regularFeeRate,
            discountedFeeRate: (pool as any).discountedFeeRate,
            createdAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
      }
    }
  }

  /**
   * Fetch and persist the latest Zealous data from both APIs. This helper is used by the
   * scheduler to perform one complete sync cycle. Errors are logged but
   * swallowed to avoid crashing the scheduler.
   */
  async sync() {
    try {
      console.log("Starting Zealous sync...")

      // First, fetch and persist tokens data (this includes prices)
      const tokensData = await this.fetchTokensData()
      await this.persistTokensData(tokensData)
      console.log(`Synced ${tokensData.tokens.length} tokens`)

      // Then, fetch and persist pools data (only for tracked tokens)
      const poolsData = await this.fetchPoolsData()
      await this.persistPoolsData(poolsData)
      console.log("Pools sync completed")

      console.log("Zealous sync completed successfully")
    } catch (err) {
      console.error("Zealous sync failed", err)
    }
  }
}

export default ZealousSwapService;
