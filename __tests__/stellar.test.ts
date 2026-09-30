import { isValidContractId, mapFreighterNetwork } from '@/lib/stellar'

describe('isValidContractId', () => {
  it('accepts valid contract IDs', () => {
    expect(isValidContractId('CDSO4GGZH7KBUQYKOIQDCMCFSRYEPOVDUX7Z4IB5TWNTLT2GDRKDQOYR')).toBe(
      true
    )
    expect(isValidContractId('CCSHRYACRNVSLC5NP3V2DL6LGID57TQT2TJXVUVXBBZX6SED6N3F7X6J')).toBe(true)
  })

  it('rejects wrong prefix', () => {
    expect(isValidContractId('GBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345')).toBe(
      false
    )
  })

  it('rejects wrong length', () => {
    expect(isValidContractId('CBCDEF')).toBe(false)
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345EXTRA')).toBe(
      false
    )
  })

  it('rejects lowercase input', () => {
    expect(isValidContractId('cbcdefghijklmnopqrstuvwxyz234567abcdefghijklmnopqrstuvwxyz2345')).toBe(
      false
    )
  })

  it('rejects invalid characters', () => {
    expect(isValidContractId('CBCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ234!')).toBe(
      false
    )
  })

  it('rejects contract IDs with invalid checksum even if regex format matches', () => {
    // Matches /^C[A-Z2-7]{55}$/ but fails CRC16 checksum
    expect(isValidContractId('CDSO4GGZH7KBUQYKOIQDCMCFSRYEPOVDUX7Z4IB5TWNTLT2GDRKDQOYQ')).toBe(
      false
    )
  })
})

describe('mapFreighterNetwork', () => {
  it('maps PUBLIC and MAINNET to mainnet', () => {
    expect(mapFreighterNetwork('PUBLIC')).toBe('mainnet')
    expect(mapFreighterNetwork('public')).toBe('mainnet')
    expect(mapFreighterNetwork('MAINNET')).toBe('mainnet')
  })

  it('maps TESTNET to testnet', () => {
    expect(mapFreighterNetwork('TESTNET')).toBe('testnet')
    expect(mapFreighterNetwork('testnet')).toBe('testnet')
  })

  it('maps FUTURENET to futurenet', () => {
    expect(mapFreighterNetwork('FUTURENET')).toBe('futurenet')
    expect(mapFreighterNetwork('futurenet')).toBe('futurenet')
  })

  it('returns null for unknown or empty networks', () => {
    expect(mapFreighterNetwork(null)).toBeNull()
    expect(mapFreighterNetwork(undefined)).toBeNull()
    expect(mapFreighterNetwork('')).toBeNull()
    expect(mapFreighterNetwork('LOCALNET')).toBeNull()
  })
})
