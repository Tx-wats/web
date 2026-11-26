import { networkOrigins, apiOrigin } from './lib/networkUrls.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const hstsHeaders =
      process.env.NODE_ENV === 'production' &&
      process.env.ENABLE_HSTS === 'true'
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains',
            },
          ]
        : []
    // #118, #475: Build CSP with support for Freighter and configured API/RPC hosts
    const cspAllowList = ["'self'", ...apiOrigin(), ...networkOrigins()]
      .filter((d, i, a) => a.indexOf(d) === i) // deduplicate
      .join(' ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          ...hstsHeaders,
          // #118, #475: CSP allows self, API (if configured), Horizon, Soroban RPC, and Freighter
          {
            key: 'Content-Security-Policy',
            value: `default-src ${cspAllowList}; script-src ${cspAllowList} 'nonce-REPLACE_WITH_NONCE'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${cspAllowList} wss:; frame-src 'self' https://connect.freighter.app; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'`,
          },
          // #118: HSTS for production (add Preload with caution)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // #118: Restrictive Permissions-Policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ]
  },
  // #118: Removed unused remotePatterns for stellar.expert
}

export default nextConfig
