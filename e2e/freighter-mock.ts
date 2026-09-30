export interface FreighterMockOptions {
  /** What `isConnected()` reports before the user approves access. */
  connected: boolean
  address: string
  network: string
  networkPassphrase: string
}

export const DEFAULT_FREIGHTER_MOCK: FreighterMockOptions = {
  connected: false,
  address: 'GBVFLWXWZNMSMLSJT2YHKVJNLM3FBRNJMZ2QZUPMHSWOMWHP2BYSBUE',
  network: 'TESTNET',
  networkPassphrase: 'Test SDF Network ; September 2015',
}

/**
 * Installs a fake Freighter extension in the page.
 *
 * `@stellar/freighter-api` reaches the extension over `postMessage`, so the
 * mock answers the same request/response protocol the real extension uses
 * rather than exposing a `window.freighter` object.
 *
 * Pass the function itself to `context.addInitScript` — it is serialised by
 * source, so it must stay self-contained (no imports or module-scope values).
 */
export function installFreighterMock(options: FreighterMockOptions) {
  const networkDetails = {
    network: options.network,
    networkName: options.network,
    networkUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: options.networkPassphrase,
  }

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    const request = event.data
    if (!request || request.source !== 'FREIGHTER_EXTERNAL_MSG_REQUEST') return

    let payload: Record<string, unknown> = {}
    switch (request.type) {
      case 'REQUEST_CONNECTION_STATUS':
        payload = {
          isConnected: options.connected,
          publicKey: options.connected ? options.address : '',
        }
        break
      // Access and address requests are answered as if the user approved, so a
      // test can drive the explicit connect flow.
      case 'REQUEST_ACCESS':
      case 'REQUEST_PUBLIC_KEY':
        payload = { publicKey: options.address }
        break
      case 'REQUEST_NETWORK_DETAILS':
        payload = { networkDetails }
        break
      case 'REQUEST_ALLOWED_STATUS':
        payload = { isAllowed: true }
        break
      case 'SUBMIT_TRANSACTION':
        payload = {
          signedTransaction: request.transactionXdr,
          signerAddress: options.address,
        }
        break
      default:
        return
    }

    window.postMessage(
      {
        source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messagedId: request.messagedId,
        apiError: null,
        ...payload,
      },
      window.location.origin
    )
  })
}
