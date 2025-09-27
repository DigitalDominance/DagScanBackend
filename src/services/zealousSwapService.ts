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
    // ✅ Kasplex mainnet bases
    this.poolsApiUrl  = options.poolsApiUrl  || "https://kasplex.zealousswap.com/v1/pools"
    this.tokensApiUrl = options.tokensApiUrl || "https://kasplex.zealousswap.com/v1/tokens"
    this.pricesApiUrl = options.pricesApiUrl || "https://kasplex.zealousswap.com/v1/prices"
  }

  /** Fetch the latest pool and protocol information from Zealous API. */
  async fetchPoolsData() {
    const response = await axios.get(this.poolsApiUrl, {
      headers: { "User-Agent": "ZealousBackendBot/1.0" },
      timeout: 10000,
    })
    return response.data
  }

  /** Fetch the latest tokens from Zealous tokens API. */
  async fetchTokensData() {
    const response = await axios.get(this.tokensApiUrl, {
      headers: { "User-Agent": "ZealousBackendBot/1.0" },
      timeout: 10000,
    })
    return response.data
  }

  /** Fetch the latest token prices from Zealous prices API. */
  async fetchPricesData() {
    const response = await axios.get(this.pricesApiUrl, {
      headers: { "User-Agent": "ZealousBackendBot/1.0" },
      timeout: 10000,
    })
    return response.data
  }

  /** Persist tokens data into MongoDB (includes latest prices). */
  async persistTokensData(tokensData: any) {
    if (!tokensData || !tokensData.tokens || !Array.isArray(tokensData.tokens)) {
      throw new Error("Malformed response from Zealous tokens API")
    }
    const timestamp = new Date()
    for (const token of tokensData.tokens) {
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

      const priceDoc = new DagscanTokenPrice({
        tokenAddress: token.address.toLowerCase(),
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI,
        priceUSD: token.price,
        timestamp: timestamp,
      })
      await priceDoc.save()

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

  /** Persist pools + protocol stats into MongoDB (tracked tokens only). */
  async persistPoolsData(poolsData: any) {
    if (!poolsData || typeof poolsData !== "object" || !poolsData.protocol || !poolsData.pools) {
      throw new Error("Malformed response from Zealous pools API")
    }

    const trackedTokens = await DagscanToken.find({}, { address: 1 })
    const trackedAddresses = new Set(trackedTokens.map((t) => t.address.toLowerCase()))

    // ✅ Protocol snapshot (TVL, volume, poolCount, updatedAt)
    const protocol = poolsData.protocol
    const protocolStat = new DagscanProtocolStat({
      totalTVL: protocol.totalTVL,
      totalVolumeUSD: protocol.totalVolumeUSD,
      poolCount: protocol.poolCount,
      updatedAt: new Date(protocol.updatedAt),
    })
    await protocolStat.save()

    // Pools (only those involving tracked tokens)
    const poolEntries = Object.entries(poolsData.pools)
    for (const [addr, pool] of poolEntries) {
      const token0Address = (pool as any).token0.address.toLowerCase()
      const token1Address = (pool as any).token1.address.toLowerCase()
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

  /** One-shot sync for scheduler. */
  async sync() {
    try {
      console.log("Starting Zealous sync...")
      const tokensData = await this.fetchTokensData()
      await this.persistTokensData(tokensData)
      console.log(`Synced ${tokensData.tokens.length} tokens`)

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
