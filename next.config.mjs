/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // #118: Build CSP with support for Freighter and configured API/RPC hosts
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com'
    const horizonUrl = process.env.NEXT_PUBLIC_HORIZON_URL || 'https://horizon.stellar.org'
    const sorobanUrl = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || 'https://mainnet.stellar.validationcloud.io'

    // Extract domain from URLs for CSP
    const apiDomain = new URL(apiUrl).hostname
    const horizonDomain = new URL(horizonUrl).hostname
    const sorobanDomain = new URL(sorobanUrl).hostname

    const cspAllowList = [
      'self',
      `https://${apiDomain}`,
      `https://${horizonDomain}`,
      `https://${sorobanDomain}`,
    ].filter((d, i, a) => a.indexOf(d) === i) // deduplicate
    .join(' ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // #118: CSP allows self, API, Horizon, Soroban RPC, and Freighter
          { key: 'Content-Security-Policy', value: `default-src ${cspAllowList}; script-src ${cspAllowList} 'nonce-REPLACE_WITH_NONCE'; connect-src ${cspAllowList} wss:; frame-src 'self' https://connect.freighter.app` },
          // #118: HSTS for production (add Preload with caution)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // #118: Restrictive Permissions-Policy
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
  // #118: Removed unused remotePatterns for stellar.expert
}

export default nextConfig
