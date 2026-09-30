# Freighter Wallet Integration

This guide explains how the dashboard integrates with the Freighter wallet extension for Stellar identity and transaction signing.

## Overview

Freighter is a browser extension that manages Stellar keypairs and signs transactions. The dashboard uses it to:
- Authenticate users (get their public key)
- Verify the user's current network (Mainnet, Testnet, Futurenet)
- Sign and submit transactions to the Stellar network

## Browser API

The Freighter extension exposes a global `window.freighter` object with these methods:

```ts
interface Freighter {
  isConnected(): Promise<boolean>
  getPublicKey(): Promise<string>
  getNetwork(): Promise<string>
  signTransaction(txXdr: string, options: SignOptions): Promise<string>
}

interface SignOptions {
  networkPassphrase: string
}
```

## Connection Flow

### 1. Check if Freighter is installed

```ts
if (!window.freighter) {
  // Extension not installed — prompt user to install
  window.open('https://www.freighter.app/', '_blank')
}
```

### 2. Check if already connected

```ts
const isConnected = await window.freighter.isConnected()
if (isConnected) {
  const publicKey = await window.freighter.getPublicKey()
  // User is already connected
}
```

### 3. Request connection

```ts
try {
  const publicKey = await window.freighter.getPublicKey()
  // User approved connection
} catch (err) {
  // User rejected connection
}
```

## Getting User Info

After connection, retrieve the user's public key and network:

```ts
const publicKey = await window.freighter.getPublicKey()
// e.g. "GAAAA..."

const network = await window.freighter.getNetwork()
// e.g. "TESTNET", "PUBLIC", "FUTURENET"
```

## Signing Transactions

To sign a transaction:

```ts
import { Transaction, Networks } from '@stellar/stellar-sdk'

// Build your transaction XDR
const tx = new Transaction(...)
const txXdr = tx.toEnvelope().toXDR('base64')

// Sign with Freighter
const signedXdr = await window.freighter.signTransaction(txXdr, {
  networkPassphrase: Networks.TESTNET_NETWORK_PASSPHRASE,
})
```

## Implementation in the Dashboard

### FreighterConnect Component

`components/FreighterConnect.tsx` wraps the Freighter API and provides:
- Connection state management
- Error handling (extension not installed, user rejection)
- UI for connected/disconnected states
- Disconnect button

Connection state is not local to the button. `hooks/useWalletState.ts` probes the
extension on mount and then subscribes to a `txwatch:wallet` CustomEvent, so the
header button, the landing-page button, `WalletStatusBadge` and any form gate all
show the same state. Disconnecting from one of them updates all of them, clears
`localStorage['freighter_public_key']` and removes `window.__freighterPublicKey`.

Usage:

```tsx
import FreighterConnect from '@/components/FreighterConnect'

export default function MyPage() {
  function handleConnect(publicKey: string) {
    console.log('Connected:', publicKey)
  }

  return <FreighterConnect onConnect={handleConnect} />
}
```

To react to wallet changes without rendering a button:

```tsx
import { useWalletState } from '@/hooks/useWalletState'

const { publicKey, publish } = useWalletState()
```

### Checking Connection in Forms

To verify the wallet is connected before saving data:

```ts
function isWalletConnected(): boolean {
  return typeof window !== 'undefined' && !!window.freighter
}

if (!isWalletConnected()) {
  setError('Connect your Freighter wallet first')
  return
}
```

## Network Mismatch Handling

The dashboard supports three networks: Mainnet, Testnet, and Futurenet. When a user selects a network for contract monitoring, verify it matches their wallet's current network:

```ts
const walletNetwork = await window.freighter.getNetwork()
const selectedNetwork = 'testnet' // from form

if (walletNetwork !== selectedNetwork.toUpperCase()) {
  console.warn(`Wallet is on ${walletNetwork}, but contract is on ${selectedNetwork}`)
  // Show warning to user
}
```

## Error Handling

Common error scenarios:

| Scenario | Error | Handling |
|----------|-------|----------|
| Extension not installed | `window.freighter` is undefined | Prompt to install |
| User rejects connection | Promise rejects | Show "Connection rejected" message |
| Network mismatch | `getNetwork()` returns different value | Warn user to switch networks |
| Transaction signing fails | Promise rejects | Show error message to user |

## Testing

To test Freighter integration locally:

1. Install the [Freighter extension](https://www.freighter.app/)
2. Create a test account or import an existing keypair
3. Switch to Testnet in the extension settings
4. Run `npm run dev` and test the connection flow

For automated testing, mock the `window.freighter` object in your test setup.
