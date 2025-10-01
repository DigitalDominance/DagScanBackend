import axios from "axios"
import { Request, Response } from "express"

interface RPCResponse<T = any> {
  jsonrpc: string
  id: number
  result?: T
  error?: {
      code: number
      message: string
  }
}

interface ContractInfo {
  isContract: boolean
  isVerified: boolean
  name?: string
  symbol?: string
  decimals?: number
  totalSupply?: string
  contractType?: "ERC20" | "ERC721" | "ERC1155" | "Other"
}

interface Config {
    baseApiUrl: string;
    rpcUrls: string[];
    explorerApiUrls: string[];
    chainId: number;
}

// Mock verified contracts registry - in a real app this would come from an API
const VERIFIED_CONTRACTS: Record<string, ContractInfo> = {
  "0xa0b86991c31cc0c0c0c0c0c0c0c0c0c0c0c0c0c0c": {
      isContract: true,
      isVerified: true,
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      contractType: "ERC20",
  },
  "0xdac17f958d2ee523a2206206994597c13d831ec7": {
      isContract: true,
      isVerified: true,
      name: "Tether USD",
      symbol: "USDT",
      decimals: 6,
      contractType: "ERC20",
  },
  "0x6b175474e89094c44da98b954eedeac495271d0f": {
      isContract: true,
      isVerified: true,
      name: "Dai Stablecoin",
      symbol: "DAI",
      decimals: 18,
      contractType: "ERC20",
  },
}

// Mock data for when RPC is unavailable
const MOCK_DATA = {
  latestBlockNumber: 1234567,
  blocks: [
      {
          number: "0x12d687",
          hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          timestamp: "0x" + Math.floor(Date.now() / 1000).toString(16),
          transactions: ["0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
          gasUsed: "0x5208",
          gasLimit: "0x1c9c380",
          miner: "0x1234567890123456789012345678901234567890",
          parentHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          difficulty: "0x1bc16d674ec80000",
          size: "0x220",
      },
  ],
  transactions: [
      {
          hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          from: "0x1234567890123456789012345678901234567890",
          to: "0x0987654321098765432109876543210987654321",
          value: "0xde0b6b3a7640000",
          gasPrice: "0x4a817c800",
          gas: "0x5208",
          input: "0x",
          blockNumber: "0x12d687",
          blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          transactionIndex: "0x0",
          nonce: "0x1",
      },
  ],
  receipts: [
      {
          status: "0x1",
          gasUsed: "0x5208",
      },
  ],
}

class NetWorkController {
//   private rpcUrls: string[]
//   private explorerApiUrls: string[]
//   private chainId: number
  private currentRpcIndex = 0
  private useMockData = false
  public baseApiUrl = "https://api-explorer.kasplex.org/api/v2"

  constructor() {
    // this.rpcUrls = [];
    // this.explorerApiUrls = [];
    // this.chainId = 167012
    this.switchNetwork = this.switchNetwork.bind(this);
  }

  public switchNetwork = (network: "kasplex" | "igra") => {
      if (network === "kasplex") {
        return {
            rpcUrls: [
              "https://evmrpc.kasplex.org/",
              "https://evmrpc.kasplex.org/",
            ],
            explorerApiUrls: [
              "https://api-explorer.kasplex.org/api/v2",
              "https:/explorer.kasplex.org/api",
              "https://explorer.kasplex.org/v1",
              "https://explorer.kasplex.org/v1",
              "https://explorer.kasplex.org/api/v2",
            ],
            chainId: 167012,
            baseApiUrl: "https://api-explorer.kasplex.org/api/v2",
          };
      } else {
        return {
            rpcUrls: ["https://caravel.igralabs.com:8545"],
            explorerApiUrls: ["https://explorer.caravel.igralabs.com/api/v2"],
            chainId: 19416,
            baseApiUrl: "https://explorer.caravel.igralabs.com/api/v2",
          };
      }
  }

  private isValidAddress(address: string): boolean {
      return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  private isValidTxHash(hash: string): boolean {
      return /^0x[a-fA-F0-9]{64}$/.test(hash)
  }

  // Try explorer APIs first for indexed data
  private async explorerApiCall<T>(endpoint: string, params: Record<string, any> = {}, config: Config): Promise<T | null> {
      for (const baseUrl of config.explorerApiUrls) {
          try {
              const url = new URL(endpoint, baseUrl)
              Object.entries(params).forEach(([key, value]) => {
                  url.searchParams.append(key, String(value))
              })

              console.log(`🔍 Trying explorer API: ${url.toString()}`)

              const response = await fetch(url.toString(), {
                  method: "GET",
                  headers: {
                      Accept: "application/json",
                      "Content-Type": "application/json",
                  },
                  signal: AbortSignal.timeout(15000),
              })

              if (response.ok) {
                  const data = await response.json()
                  console.log(`✅ Explorer API success: ${baseUrl}`)
                  return data as T
              } else {
                  console.warn(`❌ Explorer API failed: ${response.status} ${response.statusText}`)
              }
          } catch (error: any) {
              console.warn(`❌ Explorer API error for ${baseUrl}:`, error.message)
          }
      }
      return null
  }

  async rpcCall<T>(config: Config, method: string, params: any[] = [], retries = 3): Promise<T> {
      if (this.useMockData) {
          return this.getMockResponse<T>(method, params, config)
      }

      let lastError: Error | null = null

      for (let rpcIndex = 0; rpcIndex < config.rpcUrls.length; rpcIndex++) {
          const rpcUrl = config.rpcUrls[rpcIndex]

          for (let attempt = 0; attempt < retries; attempt++) {
              try {
                  const controller = new AbortController()
                  const timeoutId = setTimeout(() => controller.abort(), 10000)

                  const response = await fetch(rpcUrl, {
                      method: "POST",
                      headers: {
                          "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                          jsonrpc: "2.0",
                          method,
                          params,
                          id: Date.now(),
                      }),
                      signal: controller.signal,
                  })

                  clearTimeout(timeoutId)

                  if (!response.ok) {
                      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                  }

                  const data: RPCResponse<T> = await response.json()

                  if (data.error) {
                      throw new Error(`RPC Error: ${data.error.message}`)
                  }

                  this.currentRpcIndex = rpcIndex
                  return data.result as T
              } catch (error: any) {
                  lastError = error as Error
                  console.warn(`RPC call failed for ${method} (attempt ${attempt + 1}/${retries}) on ${rpcUrl}:`, error.message)

                  if (attempt < retries - 1) {
                      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 500))
                  }
              }
          }
      }

      console.error(`All RPC endpoints failed for ${method}. Switching to mock data mode.`)
      this.useMockData = true
      return this.getMockResponse<T>(method, params, config)
  }

  private getMockResponse<T>(method: string, params: any[], config: Config): T {
      switch (method) {
          case "eth_blockNumber":
              return `0x${MOCK_DATA.latestBlockNumber.toString(16)}` as T

          case "eth_getBlockByNumber":
              const blockNumber = params[0]
              const includeTransactions = params[1]
              const mockBlock = { ...MOCK_DATA.blocks[0] }

              if (blockNumber !== "latest") {
                  const num = typeof blockNumber === "string" ? Number.parseInt(blockNumber, 16) : blockNumber
                  mockBlock.number = `0x${num.toString(16)}`
              }

              if (!includeTransactions) {
                  mockBlock.transactions = mockBlock.transactions.map((tx) => (typeof tx === "string" ? tx : tx))
              }

              return mockBlock as T

          case "eth_getTransactionByHash":
              return MOCK_DATA.transactions[0] as T

          case "eth_getTransactionReceipt":
              return MOCK_DATA.receipts[0] as T

          case "eth_gasPrice":
              return "0x4a817c800" as T

          case "eth_getBalance":
              return "0xde0b6b3a7640000" as T

          case "eth_getCode":
              return "0x" as T

          case "eth_getTransactionCount":
              return "0xa" as T

          case "eth_call":
              return "0x0" as T

          case "eth_getLogs":
              return [
                  {
                      address: "0x1234567890123456789012345678901234567890",
                      topics: ["0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"],
                      data: "0x",
                      blockNumber: "0x12d687",
                      transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
                      transactionIndex: "0x0",
                      blockHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
                      logIndex: "0x0",
                  },
              ] as T

          default:
              console.warn(`Mock response not implemented for method: ${method}`)
              return null as T
      }
  }

  private async getCode(address: string, config: Config): Promise<string> {
      try {
          return await this.rpcCall<string>(config, "eth_getCode", [address, "latest"])
      } catch (error) {
          return "0x"
      }
  }

  private async getContractInfo(config: Config, address: string): Promise<ContractInfo> {
      if (!this.isValidAddress(address)) {
          return { isContract: false, isVerified: false }
      }

      const verified = VERIFIED_CONTRACTS[address.toLowerCase()]
      if (verified) {
          return verified
      }

      try {
          const code = await this.getCode(address, config)
          const isContract = code !== "0x" && code.length > 2

          if (isContract) {
              return {
                  isContract: true,
                  isVerified: false,
                  contractType: "Other",
              }
          }

          return { isContract: false, isVerified: false }
      } catch (error) {
          console.error("Error getting contract info:", error)
          return { isContract: false, isVerified: false }
      }
  }

  private detectTransactionType(tx: any, receipt: any): string {
      if (!tx.to) {
          return "Contract Creation"
      }

      if (tx.input && tx.input !== "0x" && tx.input.length > 2) {
          const methodId = tx.input.slice(0, 10)

          const erc20Methods: Record<string, string> = {
              "0xa9059cbb": "Token Transfer",
              "0x23b872dd": "Token Transfer From",
              "0x095ea7b3": "Token Approval",
              "0x18160ddd": "Total Supply Call",
              "0x70a08231": "Balance Query",
              "0xdd62ed3e": "Allowance Query",
          }

          const erc721Methods: Record<string, string> = {
              "0x42842e0e": "NFT Transfer",
              "0x23b872dd": "NFT Transfer From",
              "0x6352211e": "NFT Owner Query",
              "0x081812fc": "NFT Approval Query",
          }

          const defiMethods: Record<string, string> = {
              "0x7ff36ab5": "Swap KAS→Tokens",
              "0x18cbafe5": "Swap Tokens→KAS",
              "0x38ed1739": "Swap Tokens",
              "0xb6f9de95": "Swap KAS→Tokens",
              "0xe8e33700": "Add Liquidity",
              "0x02751cec": "Remove Liquidity",
              "0xa694fc3a": "Stake",
              "0x2e1a7d4d": "Withdraw",
          }

          if (erc20Methods[methodId]) return erc20Methods[methodId]
          if (erc721Methods[methodId]) return erc721Methods[methodId]
          if (defiMethods[methodId]) return defiMethods[methodId]

          return "Contract Call"
      }

      if (tx.value && tx.value !== "0x0") {
          return "KAS Transfer"
      }

      return "Transaction"
  }

  async getLatestBlockNumber(config: Config): Promise<number> {
      const result = await this.rpcCall<string>(config, "eth_blockNumber")
      return Number.parseInt(result, 16)
  }

  async getBlock(config: Config, blockNumber: number | "latest", includeTransactions = false): Promise<any> {
      const blockParam = blockNumber === "latest" ? "latest" : `0x${blockNumber.toString(16)}`
      return await this.rpcCall(config, "eth_getBlockByNumber", [blockParam, includeTransactions])
  }

  async getTransaction(config: Config, txHash: string): Promise<any> {
      return await this.rpcCall(config, "eth_getTransactionByHash", [txHash])
  }

  async getTransactionReceipt(config: Config, txHash: string): Promise<any> {
      return await this.rpcCall(config, "eth_getTransactionReceipt", [txHash])
  }

  async getGasPrice(config: Config): Promise<string> {
      const result = await this.rpcCall<string>(config, "eth_gasPrice")
      return (Number.parseInt(result, 16) / 1e9).toFixed(2)
  }

  async getBalance(address: string, config: Config): Promise<string> {
      const result = await this.rpcCall<string>(config, "eth_getBalance", [address, "latest"])
      return (Number.parseInt(result, 16) / 1e18).toFixed(4)
  }

  async getNetworkStats(config: Config) {
      try {
          const [latestBlockNumber, gasPrice] = await Promise.all([this.getLatestBlockNumber(config), this.getGasPrice(config)])

          const latestBlock = await this.getBlock(config, latestBlockNumber, true)

          const blockPromises = []
          for (let i = 0; i < 5; i++) {
              blockPromises.push(this.getBlock(config, latestBlockNumber - i))
          }

          const blocks = await Promise.all(blockPromises)
          const blockTimes = []

          for (let i = 0; i < blocks.length - 1; i++) {
              const timeDiff = Number.parseInt(blocks[i].timestamp, 16) - Number.parseInt(blocks[i + 1].timestamp, 16)
              blockTimes.push(timeDiff)
          }

          const avgBlockTime = blockTimes.length > 0 ? blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length : 12

          return {
              latestBlock: latestBlockNumber,
              totalTransactions: latestBlock.transactions?.length || 0,
              avgBlockTime: avgBlockTime,
              gasPrice,
          }
      } catch (error) {
          console.error("Failed to fetch network stats:", error)
          return {
              latestBlock: MOCK_DATA.latestBlockNumber,
              totalTransactions: 15,
              avgBlockTime: 12.5,
              gasPrice: "20.00",
          }
      }
  }

  async getLatestBlocks(config: Config, count = 10): Promise<any[]> {
      try {
          const latestBlockNumber = await this.getLatestBlockNumber(config)
          const blockPromises = []

          for (let i = 0; i < count; i++) {
              blockPromises.push(this.getBlock(config, latestBlockNumber - i, true))
          }

          const blocks = await Promise.all(blockPromises)

          return blocks.map((block, index) => ({
              number: Number.parseInt((block as any).number, 16),
              hash: block.hash || `0x${Math.random().toString(16).substr(2, 64)}`,
              timestamp: Number.parseInt(block.timestamp, 16) * 1000,
              transactions: block.transactions?.length || Math.floor(Math.random() * 50),
              gasUsed: Number.parseInt(block.gasUsed || "0", 16).toString(),
              gasLimit: Number.parseInt(block.gasLimit || "0", 16).toString(),
              miner: block.miner || "0x1234567890123456789012345678901234567890",
          }))
      } catch (error) {
          console.error("Failed to fetch latest blocks:", error)
          return Array.from({ length: count }, (_, i) => ({
              number: MOCK_DATA.latestBlockNumber - i,
              hash: `0x${Math.random().toString(16).substr(2, 64)}`,
              timestamp: Date.now() - i * 12000,
              transactions: Math.floor(Math.random() * 50),
              gasUsed: "21000",
              gasLimit: "30000000",
              miner: "0x1234567890123456789012345678901234567890",
          }))
      }
  }

  async getLatestTransactions(config: Config, count = 15): Promise<any[]> {
      try {
          const blocksToFetch = Math.min(15, Math.ceil(count / 3))
          const latestBlocks = await this.getLatestBlocks(config, blocksToFetch)
          const allTransactions = []

          for (const block of latestBlocks) {
              try {
                  const fullBlock = await this.getBlock(config, block.number, true)
                  if (fullBlock.transactions && Array.isArray(fullBlock.transactions)) {
                      for (const tx of fullBlock.transactions) {
                          if (typeof tx === "object" && tx.hash && this.isValidTxHash(tx.hash)) {
                              try {
                                  const receipt = await this.getTransactionReceipt(config, tx.hash)
                                  const txType = this.detectTransactionType(tx, receipt)

                                  let toInfo = null
                                  if (tx.to) {
                                      try {
                                          toInfo = await this.getContractInfo(config, tx.to)
                                      } catch (error) {
                                          console.error("Failed to get contract info:", error)
                                          toInfo = { isContract: false, isVerified: false }
                                      }
                                  }

                                  allTransactions.push({
                                      hash: tx.hash,
                                      from: tx.from,
                                      to: tx.to || "Contract Creation",
                                      toInfo,
                                      value: (Number.parseInt(tx.value || "0", 16) / 1e18).toFixed(4),
                                      gasPrice: (Number.parseInt(tx.gasPrice || "0", 16) / 1e9).toFixed(2),
                                      timestamp: Number.parseInt(fullBlock.timestamp, 16) * 1000,
                                      status: receipt?.status === "0x1" ? "success" : "failed",
                                      type: txType,
                                      input: tx.input || "0x",
                                  })

                                  if (allTransactions.length >= count) {
                                      break
                                  }
                              } catch (error) {
                                  console.error("Failed to get transaction receipt:", error)
                              }
                          }
                      }
                  }
              } catch (error) {
                  console.error("Failed to get full block:", error)
              }

              if (allTransactions.length >= count) {
                  break
              }
          }

          allTransactions.sort((a, b) => b.timestamp - a.timestamp)

          while (allTransactions.length < count) {
              const mockTx = {
                  hash: `0x${Math.random().toString(16).substr(2, 64)}`,
                  from: "0x1234567890123456789012345678901234567890",
                  to: "0x0987654321098765432109876543210987654321",
                  toInfo: { isContract: false, isVerified: false },
                  value: (Math.random() * 10).toFixed(4),
                  gasPrice: (20 + Math.random() * 50).toFixed(2),
                  timestamp: Date.now() - Math.random() * 3600000,
                  status: Math.random() > 0.1 ? "success" : "failed",
                  type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
                  input: "0x",
              }
              allTransactions.push(mockTx)
          }

          return allTransactions.slice(0, count)
      } catch (error) {
          console.error("Failed to fetch latest transactions:", error)
          return Array.from({ length: count }, () => ({
              hash: `0x${Math.random().toString(16).substr(2, 64)}`,
              from: "0x1234567890123456789012345678901234567890",
              to: "0x0987654321098765432109876543210987654321",
              toInfo: { isContract: false, isVerified: false },
              value: (Math.random() * 10).toFixed(4),
              gasPrice: (20 + Math.random() * 50).toFixed(2),
              timestamp: Date.now() - Math.random() * 3600000,
              status: Math.random() > 0.1 ? "success" : "failed",
              type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
              input: "0x",
          }))
      }
  }

  // NEW: Ultra-fast address transaction history using Kasplex Frontend API
  async getAddressTransactionHistory(config: Config, address: string, limit = 100): Promise<any[]> {
      console.log(`🚀 Using Kasplex Frontend API for address: ${address}`)

      try {
          // Use the official Kasplex frontend API
          const apiUrl = `${config.baseApiUrl}/addresses/${address}/transactions`

          console.log(`📡 Fetching from: ${apiUrl}`)

          const response = await fetch(apiUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(15000),
          })

          if (!response.ok) {
              throw new Error(`API responded with ${response.status}: ${response.statusText}`)
          }

          const data = await response.json()
          console.log(`✅ API Success: Found ${data.items?.length || 0} transactions`)

          if (data.items && Array.isArray(data.items)) {
              // Transform the API response to our format
              const transactions = data.items.slice(0, limit).map((tx: any) => {
                  // Determine transaction type from the API data
                  let txType = "Transaction"
                  if (tx.transaction_types && tx.transaction_types.length > 0) {
                      const type = tx.transaction_types[0]
                      switch (type) {
                          case "token_transfer":
                              txType = "Token Transfer"
                              break
                          case "contract_creation":
                              txType = "Contract Creation"
                              break
                          case "contract_call":
                              txType = "Contract Call"
                              break
                          case "coin_transfer":
                              txType = "KAS Transfer"
                              break
                          case "token_creation":
                              txType = "Token Creation"
                              break
                          default:
                              txType = "Transaction"
                      }
                  } else if (tx.method) {
                      // Use method name if available
                      switch (tx.method) {
                          case "transfer":
                              txType = "Token Transfer"
                              break
                          case "transferFrom":
                              txType = "Token Transfer From"
                              break
                          case "approve":
                              txType = "Token Approval"
                              break
                          default:
                              txType = tx.method
                      }
                  }

                  // Convert value from wei to KAS
                  let value = "0.0000"
                  if (tx.value && tx.value !== "0") {
                      try {
                          const valueInWei = typeof tx.value === "string" ? tx.value : tx.value.toString()
                          value = (Number.parseInt(valueInWei, 10) / 1e18).toFixed(4)
                      } catch (error) {
                          console.warn("Error parsing value:", error)
                          value = "0.0000"
                      }
                  }

                  // Convert gas price
                  let gasPrice = "0.00"
                  if (tx.gas_price) {
                      try {
                          gasPrice = (Number.parseInt(tx.gas_price, 10) / 1e9).toFixed(2)
                      } catch (error) {
                          console.warn("Error parsing gas price:", error)
                      }
                  }

                  // Parse timestamp
                  let timestamp = Date.now()
                  if (tx.timestamp) {
                      try {
                          timestamp = new Date(tx.timestamp).getTime()
                      } catch (error) {
                          console.warn("Error parsing timestamp:", error)
                      }
                  }

                  return {
                      hash: tx.hash,
                      from: tx.from?.hash || tx.from,
                      to: tx.to?.hash || tx.to || "Contract Creation",
                      value,
                      gasPrice,
                      timestamp,
                      status: tx.status === "ok" ? "success" : "failed",
                      type: txType,
                      method: tx.method || "",
                      blockNumber: tx.block_number,
                      gasUsed: tx.gas_used?.toString() || "0",
                      // Include contract info if available
                      fromInfo: tx.from
                          ? {
                              isContract: tx.from.is_contract || false,
                              isVerified: tx.from.is_verified || false,
                              name: tx.from.name || undefined,
                          }
                          : null,
                      toInfo: tx.to
                          ? {
                              isContract: tx.to.is_contract || false,
                              isVerified: tx.to.is_verified || false,
                              name: tx.to.name || undefined,
                          }
                          : null,
                  }
              })

              console.log(`🎯 Processed ${transactions.length} transactions successfully`)
              return transactions.sort((a: any, b: any) => b.timestamp - a.timestamp)
          }

          console.warn("⚠️ API returned no transaction items")
          return []
      } catch (error: any) {
          console.error("❌ Kasplex Frontend API failed:", error.message)

          // Fallback to mock data instead of complex RPC calls
          console.log("🔄 Using fallback mock data")
          return Array.from({ length: Math.min(10, limit) }, (_, i) => ({
              hash: `0x${Math.random().toString(16).substr(2, 64)}`,
              from: "0x1234567890123456789012345678901234567890",
              to: "0x0987654321098765432109876543210987654321",
              value: (Math.random() * 10).toFixed(4),
              gasPrice: (20 + Math.random() * 50).toFixed(2),
              timestamp: Date.now() - i * 3600000,
              status: Math.random() > 0.1 ? "success" : "failed",
              type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
              method: "",
              blockNumber: 1234567 - i,
              gasUsed: "21000",
              fromInfo: { isContract: false, isVerified: false },
              toInfo: { isContract: false, isVerified: false },
          }))
      }
  }

  // NEW: Get token balances for an address
  async getAddressTokenBalances(config: Config, address: string): Promise<any[]> {
      try {
          const apiUrl = `${config.baseApiUrl}/addresses/${address}/token-balances`

          const response = await fetch(apiUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Token balances API failed: ${response.status}`)
          }

          const data = await response.json()

          if (Array.isArray(data)) {
              return data.map((balance: any) => ({
                  token: {
                      address: balance.token?.address,
                      name: balance.token?.name,
                      symbol: balance.token?.symbol,
                      decimals: balance.token?.decimals,
                      type: balance.token?.type,
                      icon_url: balance.token?.icon_url,
                  },
                  value: balance.value,
                  token_id: balance.token_id,
              }))
          }

          return []
      } catch (error) {
          console.error("Failed to get token balances:", error)
          return []
      }
  }

  // NEW: Get token transfers for an address
  async getAddressTokenTransfers(config: Config, address: string, limit = 50): Promise<any[]> {
      try {
          const apiUrl = `${config.baseApiUrl}/addresses/${address}/token-transfers`

          const response = await fetch(apiUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Token transfers API failed: ${response.status}`)
          }

          const data = await response.json()

          if (data.items && Array.isArray(data.items)) {
              return data.items.slice(0, limit).map((transfer: any) => ({
                  transaction_hash: transfer.transaction_hash,
                  from: transfer.from?.hash,
                  to: transfer.to?.hash,
                  token: transfer.token,
                  total: transfer.total,
                  method: transfer.method,
                  timestamp: transfer.timestamp,
                  type: transfer.type,
              }))
          }

          return []
      } catch (error) {
          console.error("Failed to get token transfers:", error)
          return []
      }
  }

  // NEW: Get NFTs for an address
  async getAddressNFTs(config: Config, address: string, limit = 50): Promise<any[]> {
      try {
          const apiUrl = `${config.baseApiUrl}/addresses/${address}/nft`

          const response = await fetch(apiUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`NFT API failed: ${response.status}`)
          }

          const data = await response.json()

          if (data.items && Array.isArray(data.items)) {
              return data.items.slice(0, limit).map((nft: any) => ({
                  id: nft.id,
                  token_type: nft.token_type,
                  value: nft.value,
                  is_unique: nft.is_unique,
                  image_url: nft.image_url || nft.metadata?.image_url,
                  animation_url: nft.animation_url,
                  external_app_url: nft.external_app_url,
                  metadata: nft.metadata,
                  token: nft.token,
                  holder_address_hash: nft.holder_address_hash,
              }))
          }

          return []
      } catch (error) {
          console.error("Failed to get NFTs:", error)
          return []
      }
  }

  async getAddressDetails(config: Config, address: string): Promise<any> {
      if (!this.isValidAddress(address)) {
          throw new Error(`Invalid address format: ${address}`)
      }

      try {
          const [balance, transactionCount, tokenBalances, nfts] = await Promise.all([
              this.getBalance(address, config),
              this.rpcCall<string>(config, "eth_getTransactionCount", [address, "latest"]),
              this.getAddressTokenBalances(config, address), // Get token balances
              this.getAddressNFTs(config, address), // NEW: Get NFTs
          ])

          let contractInfo: ContractInfo
          try {
              contractInfo = await this.getContractInfo(config, address)
          } catch (error) {
              console.error("Error getting contract info:", error)
              contractInfo = { isContract: false, isVerified: false }
          }

          // Get transaction history using the new fast API
          const addressTransactions = await this.getAddressTransactionHistory(config, address, 200)

          return {
              type: "address",
              address,
              balance,
              transactionCount: Number.parseInt(transactionCount, 16),
              transactions: addressTransactions,
              tokenBalances, // Include token balances
              nfts, // NEW: Include NFTs
              contractInfo,
          }
      } catch (error) {
          console.error("Failed to get address details:", error)
          throw error
      }
  }

  async searchByHash(config: Config, query: string): Promise<any> {
      const cleanQuery = query.trim()

      if (this.isValidAddress(cleanQuery)) {
          return await this.getAddressDetails(config, cleanQuery)
      } else if (this.isValidTxHash(cleanQuery)) {
          try {
              const tx = await this.getTransaction(config, cleanQuery)
              if (tx) {
                  const receipt = await this.getTransactionReceipt(config, cleanQuery)
                  const txType = this.detectTransactionType(tx, receipt)

                  let fromInfo: ContractInfo | null = null
                  let toInfo: ContractInfo | null = null

                  if (tx.from && this.isValidAddress(tx.from)) {
                      try {
                          fromInfo = await this.getContractInfo(config, tx.from)
                      } catch (error) {
                          console.error("Error getting from address contract info:", error)
                          fromInfo = { isContract: false, isVerified: false }
                      }
                  }
                  if (tx.to && this.isValidAddress(tx.to)) {
                      try {
                          toInfo = await this.getContractInfo(config, tx.to)
                      } catch (error) {
                          console.error("Error getting to address contract info:", error)
                          toInfo = { isContract: false, isVerified: false }
                      }
                  }

                  return {
                      type: "transaction",
                      ...tx,
                      fromInfo,
                      toInfo,
                      status: receipt?.status === "0x1" ? "success" : "failed",
                      gasUsed: receipt?.gasUsed || "0",
                      timestamp: Date.now(),
                      txType,
                  }
              }
          } catch (error) {
              console.error("Transaction not found, trying as block hash:", error)
              try {
                  const block = await this.rpcCall(config, "eth_getBlockByHash", [cleanQuery, true])
                  if (block) {
                      return {
                          type: "block",
                          number: Number.parseInt((block as any).number, 16),
                          hash: (block as any).hash,
                          timestamp: Number.parseInt((block as any).timestamp, 16) * 1000,
                          transactions: (block as any).transactions || [],
                          gasUsed: (block as any).gasUsed || "0",
                          gasLimit: (block as any).gasLimit || "0",
                          miner: (block as any).miner || "0x0000000000000000000000000000000000000000",
                          parentHash: (block as any).parentHash || "",
                          difficulty: (block as any).difficulty || "0",
                          size: (block as any).size || "0",
                      }
                  }
              } catch (blockError) {
                  console.error("Not a valid block hash:", blockError)
              }
          }
      } else if (/^\d+$/.test(cleanQuery)) {
          try {
              const blockNumber = Number.parseInt(cleanQuery)
              const block = await this.getBlock(config, blockNumber, true)
              if (block) {
                  return {
                      type: "block",
                      number: Number.parseInt(block.number, 16),
                      hash: block.hash,
                      timestamp: Number.parseInt(block.timestamp, 16) * 1000,
                      transactions: block.transactions || [],
                      gasUsed: block.gasUsed || "0",
                      gasLimit: block.gasLimit || "0",
                      miner: block.miner || "0x0000000000000000000000000000000000000000",
                      parentHash: block.parentHash || "",
                      difficulty: block.difficulty || "0",
                      size: block.size || "0",
                  }
              }
          } catch (error) {
              console.error("Invalid block number:", error)
          }
      }

      throw new Error("Invalid search query format")
  }

  async getBlockDetails(blockNumber: number, config: Config): Promise<any> {
      try {
          const block = await this.getBlock(config, blockNumber, true)
          return {
              type: "block",
              number: Number.parseInt(block.number, 16),
              hash: block.hash,
              timestamp: Number.parseInt(block.timestamp, 16) * 1000,
              transactions: block.transactions || [],
              gasUsed: block.gasUsed || "0",
              gasLimit: block.gasLimit || "0",
              miner: block.miner || "0x0000000000000000000000000000000000000000",
              parentHash: block.parentHash || "",
              difficulty: block.difficulty || "0",
              size: block.size || "0",
          }
      } catch (error) {
          console.error("Failed to get block details:", error)
          throw error
      }
  }

  async getTransactionDetails(txHash: string, config: Config): Promise<any> {
      try {
          const [tx, receipt] = await Promise.all([this.getTransaction(config, txHash), this.getTransactionReceipt(config, txHash)])

          if (!tx) throw new Error("Transaction not found")

          const block = await this.getBlock(config, Number.parseInt(tx.blockNumber, 16))
          const txType = this.detectTransactionType(tx, receipt)

          let fromInfo: ContractInfo | null = null
          let toInfo: ContractInfo | null = null

          if (tx.from) {
              try {
                  fromInfo = await this.getContractInfo(config, tx.from)
              } catch (error) {
                  fromInfo = { isContract: false, isVerified: false }
              }
          }
          if (tx.to) {
              try {
                  toInfo = await this.getContractInfo(config, tx.to)
              } catch (error) {
                  toInfo = { isContract: false, isVerified: false }
              }
          }

          return {
              type: "transaction",
              hash: tx.hash,
              from: tx.from,
              fromInfo,
              to: tx.to || "Contract Creation",
              toInfo,
              value: (Number.parseInt(tx.value || "0", 16) / 1e18).toFixed(4),
              gasPrice: (Number.parseInt(tx.gasPrice || "0", 16) / 1e9).toFixed(2),
              gasUsed: receipt?.gasUsed || "0",
              gasLimit: tx.gas || "0",
              timestamp: Number.parseInt(block.timestamp, 16) * 1000,
              status: receipt?.status === "0x1" ? "success" : "failed",
              blockNumber: Number.parseInt(tx.blockNumber, 16),
              blockHash: tx.blockHash,
              transactionIndex: Number.parseInt(tx.transactionIndex, 16),
              nonce: tx.nonce,
              input: tx.input || "0x",
              txType,
          }
      } catch (error) {
          console.error("Failed to get transaction details:", error)
          throw error
      }
  }

  // NEW: Get smart contract details using the new API endpoints
  async getSmartContractDetails(config: Config, address: string): Promise<any> {
      try {
          const apiUrl = `${config.baseApiUrl}/smart-contracts/${address}`

          const response = await fetch(apiUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Smart contract API failed: ${response.status}`)
          }

          const data = await response.json()
          return data
      } catch (error) {
          console.error("Failed to get smart contract details:", error)
          return null
      }
  }

  // NEW: Get token info using the new API endpoints
  async getTokenInfo(config: Config, address: string): Promise<any> {
      try {
          const apiUrl = `${config.baseApiUrl}/tokens/${address}`

          const response = await fetch(apiUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Token info API failed: ${response.status}`)
          }

          const data = await response.json()
          return data
      } catch (error) {
          console.error("Failed to get token info:", error)
          return null
      }
  }

  // NEW: Get contract source code
  async getContractCode(address: string, config: Config): Promise<{ code: string } | null> {
      try {
          // First try to get smart contract details which includes source code
          const contractDetails = await this.getSmartContractDetails(config, address)

          if (contractDetails?.source_code) {
              return { code: contractDetails.source_code }
          }

          // Fallback to RPC call for bytecode
          const code = await this.rpcCall<string>(config, "eth_getCode", [address, "latest"])

          if (code && code !== "0x" && code.length > 2) {
              return { code }
          }

          return null
      } catch (error) {
          console.error("Failed to get contract code:", error)
          return null
      }
  }

  // NEW: Get contract metadata (token info, etc.)
  async getContractMetadata(address: string, config: Config): Promise<any> {
      try {
          // Try to get both smart contract details and token info
          const [contractDetails, tokenInfo] = await Promise.all([
              this.getSmartContractDetails(config, address),
              this.getTokenInfo(config, address),
          ])

          return {
              // Smart contract specific data
              isVerified: contractDetails?.is_verified || false,
              isFullyVerified: contractDetails?.is_fully_verified || false,
              compilerVersion: contractDetails?.compiler_version,
              language: contractDetails?.language,
              optimizationEnabled: contractDetails?.optimization_enabled,
              verifiedAt: contractDetails?.verified_at,
              abi: contractDetails?.abi,
              constructorArgs: contractDetails?.constructor_args,

              // Token specific data
              totalSupply: tokenInfo?.total_supply,
              decimals: tokenInfo?.decimals,
              holders: tokenInfo?.holders,
              exchangeRate: tokenInfo?.exchange_rate,
              circulatingMarketCap: tokenInfo?.circulating_market_cap,
              iconUrl: tokenInfo?.icon_url,

              // Combined metadata
              name: contractDetails?.name || tokenInfo?.name,
              symbol: tokenInfo?.symbol,
              type: tokenInfo?.type,

              // Additional contract info
              createdAt: contractDetails?.verified_at,
              ...contractDetails,
              ...tokenInfo,
          }
      } catch (error) {
          console.error("Failed to get contract metadata:", error)
          return {}
      }
  }

  // NEW: Get token holders for a contract
  async getTokenHolders(config: Config, address: string, limit = 50): Promise<{ holders: any[] }> {
      try {
          const holdersUrl = `${config.baseApiUrl}/tokens/${address}/holders`

          const response = await fetch(holdersUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Token holders API failed: ${response.status}`)
          }

          const data = await response.json()

          if (data.items && Array.isArray(data.items)) {
              const holders = data.items.slice(0, limit).map((holder: any, index: number) => ({
                  address: holder.address?.hash || holder.address,
                  balance: holder.value,
                  tokenId: holder.token_id,
                  percentage: (Number.parseFloat(holder.value || "0") / Number.parseFloat(data.total_supply || "1")) * 100,
              }))

              return { holders }
          }

          return { holders: [] }
      } catch (error) {
          console.error("Failed to get token holders:", error)
          return { holders: [] }
      }
  }

  // NEW: Get NFTs from a contract collection
  async getContractNFTs(config: Config, address: string, limit = 50): Promise<{ nfts: any[] }> {
      try {
          const nftsUrl = `${config.baseApiUrl}/tokens/${address}/instances`

          const response = await fetch(nftsUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Contract NFTs API failed: ${response.status}`)
          }

          const data = await response.json()

          if (data.items && Array.isArray(data.items)) {
              const nfts = data.items.slice(0, limit).map((nft: any) => ({
                  id: nft.id,
                  owner: nft.owner?.hash || nft.holder_address_hash,
                  metadata: nft.metadata,
                  image_url: nft.image_url || nft.metadata?.image_url,
                  animation_url: nft.animation_url,
                  token_type: nft.token_type || "ERC721",
                  isUnique: nft.is_unique,
                  externalAppUrl: nft.external_app_url,
              }))

              return { nfts }
          }

          return { nfts: [] }
      } catch (error) {
          console.error("Failed to get contract NFTs:", error)
          return { nfts: [] }
      }
  }

  // NEW: Get token transfers for a contract
  async getTokenTransfers(config: Config, address: string, limit = 50): Promise<any[]> {
      try {
          const transfersUrl = `${config.baseApiUrl}/tokens/${address}/transfers`

          const response = await fetch(transfersUrl, {
              method: "GET",
              headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(10000),
          })

          if (!response.ok) {
              throw new Error(`Token transfers API failed: ${response.status}`)
          }

          const data = await response.json()

          if (data.items && Array.isArray(data.items)) {
              return data.items.slice(0, limit).map((transfer: any) => ({
                  blockHash: transfer.block_hash,
                  from: transfer.from?.hash,
                  to: transfer.to?.hash,
                  logIndex: transfer.log_index,
                  method: transfer.method,
                  timestamp: transfer.timestamp,
                  token: transfer.token,
                  total: transfer.total,
                  transactionHash: transfer.transaction_hash,
                  type: transfer.type,
              }))
          }

          return []
      } catch (error) {
          console.error("Failed to get token transfers:", error)
          return []
      }
  }

  isUsingMockData(): boolean {
      return this.useMockData
  }

  async resetConnection(config: Config): Promise<void> {
      this.useMockData = false
      this.currentRpcIndex = 0
      try {
          await this.getLatestBlockNumber(config)
          console.log("Successfully reconnected to RPC")
      } catch (error) {
          console.log("Still unable to connect to RPC, continuing with mock data")
      }
  }

  public getAddressTransactionHistoryAPI = async (req: Request, res: Response) => {
    try {
        const { address, limit, network } = req.body;

        const config = this.switchNetwork(network);

        const transactionHistory = await this.getAddressTransactionHistory(config, address, limit || 100);

        res.status(200).json({ transactionHistory });
    } catch (error) {
        console.error("Error in getAddressTransactionHistoryAPI:", error);
        res.status(500).json({ error: "Internal server error" });
    }
  }

  public getAddressTokenBalancesAPI = async (req: Request, res: Response) => {
    try {
        const { address, network } = req.body;
        
        const config = this.switchNetwork(network);

        const tokenBalances = await this.getAddressTokenBalances(config, address);

        res.status(200).json({ tokenBalances });        
    } catch (error) {
        console.error("Error in getAddressTokenBalancesAPI:", error);
        res.status(500).json({ error: "Internal server error" });        
    }
  }

  public getAddressTokenTransfersAPI = async (req: Request, res: Response) => {
    try {
        const { address, limit, network } = req.body;

        const config = this.switchNetwork(network);

        const tokenTransfers = await this.getAddressTokenTransfers(config, address, limit || 50);

        res.status(200).json({ tokenTransfers });           
    } catch (error) {
        console.error("Error in getAddressTokenTransfersAPI:", error);
        res.status(500).json({ error: "Internal server error" });               
    }
  }

  public getAddressNFTsAPI = async (req: Request, res: Response) => {
    try {
        const { address, limit, network } = req.body;

        const config = this.switchNetwork(network);

        const nfts = await this.getAddressNFTs(config, address, limit || 50);

        res.status(200).json({ nfts });           
    } catch (error) {
        console.error("Error in getAddressNFTsAPI:", error);
        res.status(500).json({ error: "Internal server error" });               
    }    
  }

  public getAddressDetailsAPI = async (req: Request, res: Response) => {
    try {
      const { address, network } = req.body;
      if (!address || typeof address !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'query' parameter" });
      }

      const config = this.switchNetwork(network);

      const addressDetails = await this.getAddressDetails(config, address);

      res.status(200).json({ addressDetails });
    } catch (error) { 
      console.error("Error in getAddressDetailsAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public searchByHashAPI = async (req: Request, res: Response) => {
    try {
      const { query, network } = req.body;

      const config = this.switchNetwork(network);      

      const result = await this.searchByHash(config, query);

      res.status(200).json({ result });
    } catch (error) {
      console.error("Error in searchByHashAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getSmartContractDetailsAPI = async (req: Request, res: Response) => {
    try {
      const { address, network } = req.body;

      const config = this.switchNetwork(network);      

      const smartcontractDetails = await this.getSmartContractDetails(config, address);

      res.status(200).json({ smartcontractDetails });
    } catch (error) {
      console.error("Error in getSmartContractDetailsAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getTokenInfoAPI = async (req: Request, res: Response) => {
    try {
      const { address, network } = req.body;

      const config = this.switchNetwork(network);      

      const tokenInfo = await this.getTokenInfo(config, address);

      res.status(200).json({ tokenInfo });
    } catch (error) {
      console.error("Error in getTokenInfoAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getTokenHoldersAPI = async (req: Request, res: Response) => {
    try {
      const { address, limit, network } = req.body;

      const config = this.switchNetwork(network);      

      const holdersData = await this.getTokenHolders(config, address, limit || 50);

      res.status(200).json({ holdersData });
    } catch (error) {
      console.error("Error in getTokenHoldersAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getContractNFTsAPI = async (req: Request, res: Response) => {
    try {
      const { address, limit, network } = req.body;

      const config = this.switchNetwork(network);      

      const nftData = await this.getContractNFTs(config, address, limit);

      res.status(200).json({ nftData });
    } catch (error) {
      console.error("Error in getContractNFTsAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getTokenTransfersAPI = async (req: Request, res: Response) => {
    try {
      const { address, limit, network } = req.body;

      const config = this.switchNetwork(network);      

      const transfers = await this.getTokenTransfers(config, address, limit);

      res.status(200).json({ transfers });
    } catch (error) {
      console.error("Error in getTokenTransfersAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getStatsAPI = async (req: Request, res: Response) => {
    try {
      const { network } = req.body;

      // Normalize network string for easier comparison
      const netStr = typeof network === 'string' ? network.toLowerCase() : '';

      // If requesting stats for the LFG Kaspa platform, fetch from its API and convert KAS values to USD
      if (netStr.includes('lfg')) {
        // Fetch stats directly from the LFG API (returns values in KAS)
        const lfgResp = await axios.get('https://api.lfg.kaspa.com/stats');
        const lfgStats = lfgResp.data;
        try {
          // Fetch the current KAS price in USD. The endpoint returns { price: number }
          const priceResp = await axios.get('https://api.kaspa.org/info/price?stringOnly=false');
          const kasPrice = Number(priceResp.data?.price ?? 0);
          if (kasPrice && lfgStats && typeof lfgStats === 'object') {
            const statsData = (lfgStats as any).data;
            if (statsData) {
              // Convert total TVL and each breakdown entry
              if (statsData.tvl && typeof statsData.tvl.total === 'number') {
                statsData.tvl.total = statsData.tvl.total * kasPrice;
              }
              if (statsData.tvl && statsData.tvl.breakdown && typeof statsData.tvl.breakdown === 'object') {
                for (const key of Object.keys(statsData.tvl.breakdown)) {
                  const val = statsData.tvl.breakdown[key];
                  if (typeof val === 'number') {
                    statsData.tvl.breakdown[key] = val * kasPrice;
                  }
                }
              }
              // Convert trade volumes (daily and other periods) across all categories
              if (statsData.tradeVolumes && typeof statsData.tradeVolumes === 'object') {
                for (const category of Object.keys(statsData.tradeVolumes)) {
                  const vols = statsData.tradeVolumes[category];
                  if (vols && typeof vols === 'object') {
                    for (const period of Object.keys(vols)) {
                      const volVal = vols[period];
                      if (typeof volVal === 'number') {
                        vols[period] = volVal * kasPrice;
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // If price fetch fails, log and return original KAS-denominated stats
          console.warn('Failed to fetch or convert KAS price:', e);
        }
        return res.status(200).json({ stats: lfgStats });
      }

      console.log('Network: ', network)

      const config = this.switchNetwork(network);

      console.log('Base API Config:', config)

      const stats = (await axios.get(`${config.baseApiUrl}/stats`)).data;

      res.status(200).json({ stats });
    } catch (error) {
      console.error("Error in getStatsAPI:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  public getStatsTransactionsAPI = async (req: Request, res: Response) => {
    try {
      const { network } = req.body;

      console.log('Network: ', network)

      const config = this.switchNetwork(network);

      console.log('Base API Config:', config)

      const transactions = (await axios.get(`${config.baseApiUrl}/stats/charts/transactions`)).data;

      res.status(200).json({ transactions });
    } catch (error) {
      console.error("Error in getStatsTransactionsAPI:");
      res.status(500).json({ error: "Internal server error" });      
    }
  }

  public getLatestBlocksAPI = async (req: Request, res: Response) => {
    const { count, network } = req.body;    
    try {
        const config = this.switchNetwork(network);

        const blocks = (await axios.get(`${config.baseApiUrl}/blocks?type=block`)).data.items;

        // res.status(200).json({ blocks });
        const customBlocks = blocks.slice(0, count).map((block: any) => ({
            number: block.height,
            hash: block.hash,
            timestamp: new Date(block.timestamp).getTime(),
            transactions: block.transactions_count || 0,
            gasUsed: block.gas_used || "0",
            gasLimit: block.gas_limit || '0',
            miner: block.miner.hash,
        }));

        res.status(200).json({ blocks: customBlocks });
    } catch (error) {
        console.error("Failed to fetch latest blocks:", error)
        const blocks = Array.from({ length: count }, (_, i) => ({
            number: MOCK_DATA.latestBlockNumber - i,
            hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            timestamp: Date.now() - i * 12000,
            transactions: Math.floor(Math.random() * 50),
            gasUsed: "21000",
            gasLimit: "30000000",
            miner: "0x1234567890123456789012345678901234567890",
        }))        
        res.status(200).json({ blocks });
    }
  }

  public getLatestTransactionsAPI = async (req: Request, res: Response) => {
    const { count, network } = req.body;        
    try {
        const config = this.switchNetwork(network);

        const transactions = (await axios.get(`${config.baseApiUrl}/transactions?filter=validated`)).data.items;        

        const customTransactions = transactions.slice(0, count).map((transaction: any) => ({
            hash: transaction.hash,
            from: transaction.from.hash,
            to: transaction.to.hash,
            toInfo: {
                isContract: transaction.to.is_contract,
                isVerified: transaction.to.is_verified
            },
            value: transaction.value / 1e18,
            gasPrice: transaction.gas_price / 1e18,
            timestamp: transaction.timestamp,
            status: transaction.status === "ok" ? "success" : "failed",
            type: ["KAS Transfer", "Token Transfer", "Contract Call"][transaction.type],
            input: transaction.raw_input
        }))
        res.status(200).json({ transactions: customTransactions });
    } catch (error) {
        console.error("Failed to fetch latest transactions:", error)
        const transactions =  Array.from({ length: count }, () => ({
            hash: `0x${Math.random().toString(16).substr(2, 64)}`,
            from: "0x1234567890123456789012345678901234567890",
            to: "0x0987654321098765432109876543210987654321",
            toInfo: { isContract: false, isVerified: false },
            value: (Math.random() * 10).toFixed(4),
            gasPrice: (20 + Math.random() * 50).toFixed(2),
            timestamp: Date.now() - Math.random() * 3600000,
            status: Math.random() > 0.1 ? "success" : "failed",
            type: ["KAS Transfer", "Token Transfer", "Contract Call"][Math.floor(Math.random() * 3)],
            input: "0x",
        }))     
        
        res.status(200).json({ transactions });
    }
  }
}

export default new NetWorkController();
