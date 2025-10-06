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

    /*
     * Only persist VERIFIED tokens. Unverified tokens are skipped entirely
     * (no metadata, no price history).
     */
    for (const rawToken of tokensData.tokens) {
      try {
        // Normalise and validate essential fields
        const address  = typeof rawToken.address  === 'string' ? rawToken.address.toLowerCase() : null
        const decimals = typeof rawToken.decimals === 'number' ? rawToken.decimals : null
        const name     = typeof rawToken.name     === 'string' ? rawToken.name : null
        const symbol   = typeof rawToken.symbol   === 'string' ? rawToken.symbol : null
        // Price may legitimately be 0, so only treat undefined/null as missing
        const price    = rawToken.price !== undefined && rawToken.price !== null ? Number(rawToken.price) : null
        const rank     = typeof rawToken.rank     === 'number' ? rawToken.rank : null
        // logoURI may be empty string; that's acceptable. default to empty string if missing
        const logoURI  = typeof rawToken.logoURI  === 'string' ? rawToken.logoURI : ''
        const verified = rawToken.verified === true

        // Skip invalid token definitions
        if (!address || decimals === null || !name || !symbol) {
          console.warn(`Skipping token with missing required fields: ${JSON.stringify(rawToken)}`)
          continue
        }

        // 🚫 Skip anything not verified
        if (!verified) {
          // Optional: uncomment to log once in a while
          // console.info(`Skipping UNVERIFIED token ${symbol} (${address})`)
          continue
        }

        // Upsert basic token metadata (verified only)
        await DagscanToken.findOneAndUpdate(
          { address },
          {
            address,
            decimals,
            name,
            symbol,
            logoURI,
            verified: true,
            // if rank is missing set it to a high number to push it down the list
            rank: rank !== null ? rank : 1e9,
            updatedAt: timestamp,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )

        // Only persist price documents if a price is available
        if (price !== null) {
          const priceDoc = new DagscanTokenPrice({
            tokenAddress: address,
            symbol,
            name,
            logoURI,
            priceUSD: price,
            timestamp: timestamp,
          })
          await priceDoc.save()

          await DagscanTokenPriceLatest.findOneAndUpdate(
            { tokenAddress: address },
            {
              tokenAddress: address,
              symbol,
              name,
              logoURI,
              priceUSD: price,
              verified: true,
              rank: rank !== null ? rank : 1e9,
              decimals,
              timestamp: timestamp,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
          )
        }
      } catch (err: unknown) {
        // Log and continue on individual token errors to avoid aborting the entire sync
        console.error(`Failed to process token ${JSON.stringify(rawToken)}:`, err)
      }
    }
  }

  /** Persist pools + protocol stats into MongoDB (tracked tokens only). */
  async persistPoolsData(poolsData: any) {
    if (!poolsData || typeof poolsData !== 'object' || !poolsData.protocol || !poolsData.pools) {
      throw new Error('Malformed response from Zealous pools API')
    }

    // Track ONLY verified tokens
    const trackedTokens = await DagscanToken.find({ verified: true }, { address: 1 }).lean()
    const trackedAddresses = new Set(trackedTokens.map((t) => String(t.address).toLowerCase()))

    // Persist protocol snapshot (TVL, volume, poolCount, updatedAt)
    const protocol = poolsData.protocol || {}
    const protocolStat = new DagscanProtocolStat({
      totalTVL: Number(protocol.totalTVL ?? 0),
      totalVolumeUSD: Number(protocol.totalVolumeUSD ?? 0),
      poolCount: Number(protocol.poolCount ?? 0),
      updatedAt: protocol.updatedAt ? new Date(protocol.updatedAt) : new Date(),
    })
    await protocolStat.save().catch((err: unknown) => {
      console.error('Failed to save protocol stats:', err)
    })

    // Process individual pools: only persist pools that include at least 1 verified token
    const poolEntries = Object.entries(poolsData.pools || {})
    for (const [, pool] of poolEntries) {
      try {
        const token0 = (pool as any).token0 || {}
        const token1 = (pool as any).token1 || {}
        const token0Address = String(token0.address || '').toLowerCase()
        const token1Address = String(token1.address || '').toLowerCase()

        if (!trackedAddresses.has(token0Address) && !trackedAddresses.has(token1Address)) {
          // Both sides unverified → skip pool entirely
          continue
        }

        const poolPayload: any = {
          address: (pool as any).address,
          token0: {
            address: token0Address,
            symbol: token0.symbol || '',
            name: token0.name || '',
            decimals: Number(token0.decimals ?? 0),
          },
          token1: {
            address: token1Address,
            symbol: token1.symbol || '',
            name: token1.name || '',
            decimals: Number(token1.decimals ?? 0),
          },
          token0Volume: (pool as any).token0Volume ?? 0,
          token1Volume: (pool as any).token1Volume ?? 0,
          tvl: Number((pool as any).tvl ?? 0),
          volumeUSD: Number((pool as any).volumeUSD ?? 0),
          token0Fees: (pool as any).token0Fees ?? 0,
          token1Fees: (pool as any).token1Fees ?? 0,
          feesUSD: Number((pool as any).feesUSD ?? 0),
          token0Reserves: (pool as any).token0Reserves ?? 0,
          token1Reserves: (pool as any).token1Reserves ?? 0,
          apr: Number((pool as any).apr ?? 0),
          hasUSDValues: Boolean((pool as any).hasUSDValues),
          updatedAt: (pool as any).updatedAt ? new Date((pool as any).updatedAt) : new Date(),
          hasActiveFarm: Boolean((pool as any).hasActiveFarm),
          farmApr: Number((pool as any).farmApr ?? 0),
          regularFeeRate: (pool as any).regularFeeRate,
          discountedFeeRate: (pool as any).discountedFeeRate,
        }

        // Save historical snapshot
        const poolDoc = new DagscanPool(poolPayload)
        await poolDoc.save().catch((err: unknown) => {
          console.error(`Failed to save pool snapshot for ${poolPayload.address}:`, err)
        })

        // Upsert latest snapshot
        await DagscanPoolLatest.findOneAndUpdate(
          { address: poolPayload.address },
          {
            ...poolPayload,
            createdAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        ).catch((err: unknown) => {
          console.error(`Failed to upsert pool latest for ${poolPayload.address}:`, err)
        })
      } catch (err: unknown) {
        console.error('Error processing pool data:', err)
      }
    }
  }

  /** One-shot sync for scheduler. */
  async sync() {
    try {
      console.log("Starting Zealous sync...")
      const tokensData = await this.fetchTokensData()
      await this.persistTokensData(tokensData)
      console.log(`Synced verified tokens only`)

      const poolsData = await this.fetchPoolsData()
      await this.persistPoolsData(poolsData)
      console.log("Pools sync completed")
      console.log("Zealous sync completed successfully")
    } catch (err: unknown) {
      console.error("Zealous sync failed", err)
    }
  }
}

export default ZealousSwapService;
