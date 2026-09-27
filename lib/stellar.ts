import { Network } from '@/types'

export const HORIZON_URLS: Record<Network, string> = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
}

export const SOROBAN_RPC_URLS: Record<Network, string> = {
  mainnet: 'https://mainnet.stellar.validationcloud.io/v1/soroban/rpc',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
}

function clean(v: string | undefined): string | undefined {
  const t = v?.trim().replace(/\/+$/, '')
  return t ? t : undefined
}

// NEXT_PUBLIC_* vars are inlined by Next.js only for literal `process.env.NAME`
// accesses, so each variable is spelled out (no dynamic lookup).
/**
 * Horizon URL for a network. Precedence: NEXT_PUBLIC_HORIZON_URL_<NETWORK>,
 * then NEXT_PUBLIC_HORIZON_URL (applies to every network), then the default.
 */
export function horizonUrl(network: Network): string {
  const perNetwork = {
    mainnet: process.env.NEXT_PUBLIC_HORIZON_URL_MAINNET,
    testnet: process.env.NEXT_PUBLIC_HORIZON_URL_TESTNET,
    futurenet: process.env.NEXT_PUBLIC_HORIZON_URL_FUTURENET,
  }[network]
  return clean(perNetwork) ?? clean(process.env.NEXT_PUBLIC_HORIZON_URL) ?? HORIZON_URLS[network]
}

/** Soroban RPC URL for a network; same precedence as horizonUrl. */
export function sorobanRpcUrl(network: Network): string {
  const perNetwork = {
    mainnet: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET,
    testnet: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_TESTNET,
    futurenet: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL_FUTURENET,
  }[network]
  return (
    clean(perNetwork) ?? clean(process.env.NEXT_PUBLIC_SOROBAN_RPC_URL) ?? SOROBAN_RPC_URLS[network]
  )
}

export const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer'

export function explorerTxUrl(network: Network, txHash: string): string {
  const net = network === 'mainnet' ? 'public' : network
  return `${STELLAR_EXPERT_BASE}/${net}/tx/${txHash}`
}

export function explorerContractUrl(network: Network, contractId: string): string {
  const net = network === 'mainnet' ? 'public' : network
  return `${STELLAR_EXPERT_BASE}/${net}/contract/${contractId}`
}

/**
 * Resolve the network to use for explorer links. Prefers the alert's own
 * network when it is a valid Network, otherwise falls back to the contract's
 * network prop.
 */
export function resolveExplorerNetwork(
  alertNetwork: string | undefined,
  fallback: Network
): Network {
  return isNetwork(alertNetwork) ? alertNetwork : fallback
}

export function isNetwork(value: string | undefined): value is Network {
  return value === 'mainnet' || value === 'testnet' || value === 'futurenet'
}

export function truncateId(id: string, chars = 8): string {
  if (id.length <= chars * 2 + 3) return id
  return `${id.slice(0, chars)}...${id.slice(-chars)}`
}

export function isValidContractId(id: string): boolean {
  return /^C[A-Z2-7]{55}$/.test(id)
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
