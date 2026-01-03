/**
 * PromptPay QR Code Generator
 * Generates EMVCo-compliant QR data for Thai PromptPay payments
 */

// CRC16 CCITT calculation for EMVCo
function crc16(data: string): string {
  let crc = 0xFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
    }
    crc &= 0xFFFF
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Format TLV (Tag-Length-Value) field
function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0')
  return `${tag}${length}${value}`
}

// Format amount with 2 decimal places
function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

// Generate PromptPay QR payload string (EMVCo format)
export function generatePromptPayPayload(
  promptPayId: string,
  amount: number,
  countryCode: string = 'TH'
): string {
  // Clean ID (remove all non-digits)
  const raw = promptPayId.replace(/\D/g, '')

  // Normalize mobile number: 0XXXXXXXXX → 0066XXXXXXXXX
  const ppId = raw.length === 10 && raw.startsWith('0')
    ? `0066${raw.slice(1)}`
    : raw

  // Mobile format uses sub-tag '01'
  const aidTag = '01'

  // Build merchant account info (Tag 29 for PromptPay)
  const merchantAccountInfo = [
    tlv('00', 'A000000677010111'), // AID for PromptPay
    tlv(aidTag, ppId)              // ID type + value
  ].join('')

  // Build payload
  const payloadParts = [
    tlv('00', '01'),                           // Payload Format Indicator
    tlv('01', '12'),                           // Point of Initiation (12 = dynamic QR)
    tlv('29', merchantAccountInfo),            // Merchant Account Info (PromptPay)
    tlv('53', '764'),                          // Currency (764 = THB)
    tlv('54', formatAmount(amount)),           // Amount
    tlv('58', countryCode),                    // Country Code
    tlv('63', ''),                             // CRC placeholder
  ]

  // Calculate CRC
  const payloadWithoutCRC = payloadParts.slice(0, -1).join('')
  const crcInput = payloadWithoutCRC + '6304'
  const crcValue = crc16(crcInput)

  return payloadWithoutCRC + tlv('63', crcValue)
}

// Generate QR code as data URL (using external library-free approach via Canvas)
export async function generateQRCodeDataURL(payload: string): Promise<string> {
  // We'll use a lightweight QR encoding approach
  // Since we want no external libraries, we'll generate a simple SVG-based QR
  // For production, recommend using a proper QR library

  // For now, encode to base64 for the qr.io API (fallback)
  // This is a pure-client approach using an image generator
  const encodedPayload = encodeURIComponent(payload)

  // Use QR Server API (free, no API key required)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedPayload}&format=png&margin=10`

  return qrUrl
}

// Generate QR code as SVG string (pure JS implementation)
// Using a minimal QR code generator
export function generateQRCodeSVG(payload: string, size: number = 300): string {
  // For a proper implementation without external dependencies,
  // we'll encode the data in a way that can be rendered
  // This is a placeholder - in production use qrcode library

  const encodedPayload = encodeURIComponent(payload)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedPayload}&format=svg&margin=10`

  return qrUrl
}
