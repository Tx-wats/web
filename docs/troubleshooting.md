# Troubleshooting Guide

This guide covers common errors encountered when using the **tx-watch-web** dashboard, their root causes, and step-by-step solutions.

---

## Quick Navigation

1. [Freighter Wallet Not Detected or Unavailable](#1-freighter-wallet-not-detected-or-unavailable)
2. [Wallet Connected to the Wrong Network](#2-wallet-connected-to-the-wrong-network)
3. [Mainnet RPC Requiring an API Key](#3-mainnet-rpc-requiring-an-api-key)
4. [Content Security Policy (CSP) Blocking a Custom RPC](#4-content-security-policy-csp-blocking-a-custom-rpc)
5. [Test Webhooks Blocked as Private Addresses](#5-test-webhooks-blocked-as-private-addresses)
6. [Storage Full / LocalStorage Quota Exceeded](#6-storage-full--localstorage-quota-exceeded)

---

## 1. Freighter Wallet Not Detected or Unavailable

### Symptom

- The wallet connection button displays:
  > _"Freighter not installed — install the extension and reload"_
- The wallet status badge shows **Unavailable** or remains stuck on **Disconnected**.
- When clicking "Connect Freighter", an error says `"Freighter is not responding"` or the connection popup never appears.

### Cause

- The [Freighter browser extension](https://www.freighter.app/) is not installed or is disabled in your browser.
- The extension's content script does not have permission to run on `localhost` or the current domain.
- The window is in private/incognito mode where extensions are disabled by default.
- Communication between the page and the extension timed out (managed by the timeout wrapper in `lib/freighter.ts`).

### Fix

1. **Install Freighter**: Download and install the extension from [freighter.app](https://www.freighter.app/) (supported on Chrome, Firefox, Edge, and Brave).
2. **Enable Site Access**: In your browser's extension settings, ensure Freighter is enabled and granted access to the current site (or all sites).
3. **Allow in Incognito (if applicable)**: Open `chrome://extensions` (or browser equivalent), click **Details** on Freighter, and toggle **Allow in Incognito**.
4. **Reload**: Refresh the page (`Ctrl+R` / `Cmd+R`) after installing or unlocking Freighter.
5. **Unlock Wallet**: Click the Freighter extension icon in your toolbar, log in with your password, and re-attempt connection.

---

## 2. Wallet Connected to the Wrong Network

### Symptom

- Contract registration or transaction signing fails.
- The UI displays a warning banner indicating network mismatch.
- The wallet badge displays a different network tag (e.g., `PUBLIC`) than the currently selected app network (e.g., `Testnet`).

### Cause

- Freighter is pointing to a different Stellar network than the contract you are interacting with.
- **Terminology note**: In Freighter, Stellar Mainnet is labelled as **`PUBLIC`**. This corresponds to **Mainnet** in the dashboard.

### Fix

1. Open the Freighter extension in your browser.
2. Click the network selector dropdown in the top-right corner of Freighter.
3. Select the matching network:
   - For **Mainnet**: select **PUBLIC**.
   - For **Testnet**: select **TESTNET**.
   - For **Futurenet**: select **FUTURENET**.
4. The dashboard automatically detects network switches via `subscribeWallet` and updates the UI.

---

## 3. Mainnet RPC Requiring an API Key

### Symptom

- Soroban RPC requests to Mainnet return `HTTP 401 Unauthorized` or `HTTP 403 Forbidden`.
- Contract simulation, contract verification, or balance lookups fail when switched to Mainnet.

### Cause

- The Stellar Development Foundation (SDF) does not operate an open, unauthenticated public Soroban RPC for Mainnet.
- While the dashboard defaults to a public keyless endpoint (`https://soroban-rpc.mainnet.stellar.gateway.fm`), high-volume queries or alternative RPC providers (e.g. QuickNode, Blockdaemon, NowNodes) require an authenticated API key in the URL path or headers.

### Fix

1. Obtain an RPC endpoint URL from your preferred Stellar RPC provider.
2. In your `.env.local` file (copy from `.env.example`), define the mainnet RPC URL override:
   ```bash
   NEXT_PUBLIC_SOROBAN_RPC_URL_MAINNET=https://your-mainnet-rpc-endpoint.com/v1/YOUR_API_KEY
   ```
3. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

---

## 4. Content Security Policy (CSP) Blocking a Custom RPC

### Symptom

- Browser Developer Console displays an error like:
  ```text
  Content Security Policy: The page's settings blocked the loading of a resource at https://custom-rpc.example.com (connect-src)
  ```
- Network requests in the browser fail with status `(blocked:csp)`.

### Cause

- The application enforces a strict Content Security Policy (CSP) configured in `next.config.mjs` and `middleware.ts`.
- The `connect-src` directive only permits connections to endpoints declared in environment variables (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_HORIZON_URL*`, and `NEXT_PUBLIC_SOROBAN_RPC_URL*`).
- If you use a custom Horizon or Soroban RPC URL that was not present in the environment when the application initialized, the browser blocks the connection.

### Fix

1. Add your custom endpoint to your `.env.local` file:
   ```bash
   # Custom RPC override for all networks:
   NEXT_PUBLIC_SOROBAN_RPC_URL=https://custom-rpc.example.com

   # Or network-specific overrides:
   NEXT_PUBLIC_SOROBAN_RPC_URL_TESTNET=https://custom-testnet-rpc.example.com
   NEXT_PUBLIC_HORIZON_URL_TESTNET=https://custom-testnet-horizon.example.com
   ```
2. Restart the application server. The CSP generator in `next.config.mjs` and `middleware.ts` (`networkOrigins()`) will include the new origin in the `connect-src` header.

---

## 5. Test Webhooks Blocked as Private Addresses

### Symptom

- Testing a webhook URL in the contract form fails with:
  > _"Webhook rejected: private, loopback, or internal IP addresses are not permitted"_
- Webhook test delivery returns status 400 or fails validation.

### Cause

- To prevent Server-Side Request Forgery (SSRF) and intranet port enumeration attacks, `lib/ipRanges.ts` and `lib/webhookProxy.ts` validate and reject:
  - Loopback addresses (`127.0.0.1`, `localhost`, `::1`)
  - Private RFC 1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - Carrier-grade NAT (`100.64.0.0/10`)
  - Link-local ranges (`169.254.0.0/16`, `fe80::/10`)
  - Non-HTTP(S) schemes.

### Fix

- **For local webhook development**: Use a tunneling tool to expose your local service via a public HTTPS URL:
  - **ngrok**: `ngrok http 4000` (copy the `https://...ngrok-free.app` URL)
  - **localtunnel**: `npx localtunnel --port 4000`
  - **Cloudflare Tunnels**: `cloudflared tunnel --url http://localhost:4000`
- **For testing payloads**: Use a public echo endpoint such as [webhook.site](https://webhook.site) or [httpbin.org](https://httpbin.org/post).
- **HTTPS on Mainnet**: Ensure webhook URLs for Mainnet contracts strictly use `https://` (plain `http://` is forbidden on Mainnet).

---

## 6. Storage Full / LocalStorage Quota Exceeded

### Symptom

- UI error banner:
  > _"Something went wrong with your stored data."_ or _"Storage full"_
- Contract sync reports `localSaved: false, error: 'Storage full'`.
- The application redirects to the error boundary screen (`app/error.tsx`).

### Cause

- Browsers allocate approximately 5 MB of `localStorage` per origin.
- Storing a large number of contracts, verbose alert rule configurations, and historical webhook execution logs can exceed this quota.
- Corrupted JSON in a storage key can also trigger parsing exceptions.

### Fix

1. **Download Backup**:
   - On the Error Boundary page (`app/error.tsx`) or from **Settings** (`/settings`), click **"Download backup"**. This saves all your contracts and alert configurations as a versioned JSON file (`txwatch-backup-*.json`).
2. **Reset Local Storage**:
   - Click **"Reset Local Data"** on the error page or under Settings to purge stale logs and clear localStorage safely.
3. **Restore Necessary Contracts**:
   - Navigate to **Settings** (`/settings`) → **Import Backup** → upload your backup file.
4. **Configure Retention Policy**:
   - In **Settings**, lower the **Alert retention days** setting (e.g. from 30 days to 7 days) to automatically prune historical logs and prevent future quota overflow.

---

## Need Further Help?

If your issue is not listed above:

- Check existing bug reports or open a new issue on [GitHub Issues](https://github.com/Tx-wats/web/issues).
- Verify the status of the Stellar network at [Stellar Status Dashboard](https://status.stellar.org/).
