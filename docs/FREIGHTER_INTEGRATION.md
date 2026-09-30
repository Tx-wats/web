# Freighter Wallet Integration

This guide explains how the dashboard integrates with the Freighter wallet extension for Stellar identity and transaction signing.

## Overview

Freighter is a browser extension that manages Stellar keypairs and signs transactions. The dashboard uses it to:
- Authenticate users (get their public key)
- Verify the user's current network (Mainnet, Testnet, Futurenet)
- Sign and submit transactions to the Stellar network

## The `@stellar/freighter-api` package

The dashboard does not talk to the extension directly. All access goes through
[`@stellar/freighter-api`](https://www.npmjs.com/package/@stellar/freighter-api),
the supported client for current Freighter releases. The package locates the
extension and exchanges messages with it on the page's behalf, so the app never
reads a `window.freighter` object or hand-writes a `declare global` type for it.

The functions the dashboard uses:

| Function | Returns | Used for |
|----------|---------|----------|
| `isConnected()` | `{ isConnected }` | Is the extension installed and this site already approved? |
| `requestAccess()` | `{ address }` | Explicit connect — prompts the user to approve the site |
| `getAddress()` | `{ address }` | Read the active public key of an approved session |
| `getNetworkDetails()` | `{ network, networkUrl, networkPassphrase, sorobanRpcUrl? }` | Which network the wallet is on |
| `signTransaction(xdr, opts)` | `{ signedTxXdr, signerAddress }` | Sign a base64 XDR envelope |

Two behaviours of the package drive the wrapper design in `lib/freighter.ts`:

- **Errors are values, not exceptions.** A rejected request resolves with an
  `error` field instead of throwing.
- **Missing extension can hang.** Requests are sent with `postMessage`; when no
  extension answers, some of them never settle. `lib/freighter.ts` time-boxes
  every call and reports a timeout as "extension unavailable".

## `lib/freighter.ts`

`lib/freighter.ts` is the only module that imports `@stellar/freighter-api`.
Everything else in the app uses it, so error handling, timeouts and network
naming live in one place.

```ts
import {
  connectFreighter,        // explicit connect flow (requestAccess + network details)
  isExtensionAvailable,    // is the extension installed and answering?
  readFreighterConnection, // current session, or null when unavailable
  getWalletNetwork,        // "TESTNET" | "PUBLIC" | "FUTURENET", or null
  isNetworkMatch,          // compare a dashboard Network with the wallet network
  signWithFreighter,       // sign a base64 XDR envelope
  openFreighterInstallPage,
  FreighterUnavailableError,
  FreighterRejectedError,
} from '@/lib/freighter'
```

## Connection Flow

### 1. Check if Freighter is installed

```ts
import { isExtensionAvailable, openFreighterInstallPage } from '@/lib/freighter'

if (!(await isExtensionAvailable())) {
  openFreighterInstallPage()
}
```

### 2. Read the current session

```ts
import { readFreighterConnection } from '@/lib/freighter'

const connection = await readFreighterConnection()

if (connection === null) {
  // Extension not installed or not responding
} else if (connection.publicKey === null) {
  // Extension installed, but this site has not been approved yet
} else {
  // connection.publicKey — e.g. "GAAAA..."
  // connection.network    — e.g. "TESTNET"
}
```

This is what `FreighterConnect`, `useFreighterConnection`, `useWallet`, and
`WalletStatusBadge` all use to render their state.

### 3. Explicit connect

`requestAccess()` is the user-facing approval prompt. It is only called from an
explicit connect action, never on mount:

```ts
import { connectFreighter } from '@/lib/freighter'

try {
  const session = await connectFreighter()
  // session.publicKey, session.network, session.networkPassphrase
} catch (err) {
  if (err instanceof FreighterUnavailableError) {
    openFreighterInstallPage()
  }
  // FreighterRejectedError — the user declined
}
```

## Signing Transactions

```ts
import { Transaction, Networks } from '@stellar/stellar-sdk'
import { signWithFreighter } from '@/lib/freighter'

// Build your transaction XDR
const tx = new Transaction(...)
const txXdr = tx.toEnvelope().toXDR('base64')

// Sign with Freighter
const signedXdr = await signWithFreighter(txXdr, {
  networkPassphrase: Networks.TESTNET_NETWORK_PASSPHRASE,
})
```

## Implementation in the Dashboard

### FreighterConnect Component

`components/FreighterConnect.tsx` wraps `lib/freighter.ts` and provides:
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
### Nothing is persisted

The connected public key is deliberately **not** written to `localStorage`. The
extension owns the session, so a cached key would survive an account switch
inside Freighter and show a stale address. Every mount re-reads the session from
the extension, and "Disconnect" only clears the local view — the site stays
approved in Freighter until the user revokes it there.

### Checking Connection in Forms

To verify the wallet is connected before saving data, use the connection hook
rather than checking for the extension's presence:

```ts
import { useFreighterConnection } from '@/lib/useFreighterConnection'

const { isConnected, loading } = useFreighterConnection()

if (!isConnected) {
  setError('Connect your Freighter wallet first')
  return
}
```

## Network Mismatch Handling

The dashboard supports three networks: Mainnet, Testnet, and Futurenet. When a
user selects a network for contract monitoring, verify it matches their wallet's
current network:

```ts
import { getWalletNetwork, isNetworkMatch } from '@/lib/freighter'

const walletNetwork = await getWalletNetwork() // "TESTNET", "PUBLIC", "FUTURENET"
const selectedNetwork = 'testnet' // from the form

if (!isNetworkMatch(selectedNetwork, walletNetwork)) {
  console.warn(`Wallet is on ${walletNetwork}, but contract is on ${selectedNetwork}`)
  // Show warning to user
}
```

## Error Handling

Common error scenarios:

| Scenario | Signal | Handling |
|----------|--------|----------|
| Extension not installed | `isExtensionAvailable()` is `false`, or a call times out | Prompt to install |
| User rejects connection | `requestAccess()` resolves with `error` | Throw `FreighterRejectedError`, show "Connection rejected" |
| Network mismatch | `getWalletNetwork()` returns a different value | Warn user to switch networks |
| Transaction signing fails | `signTransaction()` resolves with `error` | Throw `FreighterRejectedError`, show error message |

## Testing

To test Freighter integration locally:

1. Install the [Freighter extension](https://www.freighter.app/)
2. Create a test account or import an existing keypair
3. Switch to Testnet in the extension settings
4. Run `npm run dev` and test the connection flow

For unit tests, mock the package module rather than a global:

```ts
vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn(),
  getAddress: vi.fn(),
  getNetworkDetails: vi.fn(),
  requestAccess: vi.fn(),
  signTransaction: vi.fn(),
}))
```

See `__tests__/FreighterConnect.test.tsx` for a complete example.

For Playwright, the extension API is reached over `postMessage`, so a plain
object assignment no longer works. `e2e/freighter-mock.ts` installs a fake
extension that answers the same message protocol the real one does:

```ts
import { DEFAULT_FREIGHTER_MOCK, installFreighterMock } from './freighter-mock'

await context.addInitScript(installFreighterMock, { ...DEFAULT_FREIGHTER_MOCK, connected: true })
```
