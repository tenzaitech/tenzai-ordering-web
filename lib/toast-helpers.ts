/**
 * Normalize any error input into a string message for toast display.
 * Handles various API error shapes:
 *   - string
 *   - { message_th: string }
 *   - { message: string }
 *   - { error: { message_th: string } }
 *   - { error: { message: string } }
 *   - { code: string, message_th: string }
 */
export function normalizeToastMessage(input: unknown): string {
  if (typeof input === 'string') return input

  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>

    // Direct message_th (Thai message preferred)
    if (typeof obj.message_th === 'string') return obj.message_th

    // Nested error object with message_th
    if (obj.error && typeof obj.error === 'object') {
      const errObj = obj.error as Record<string, unknown>
      if (typeof errObj.message_th === 'string') return errObj.message_th
      if (typeof errObj.message === 'string') return errObj.message
    }

    // Direct message
    if (typeof obj.message === 'string') return obj.message

    // Nested error as string
    if (typeof obj.error === 'string') return obj.error
  }

  return 'เกิดข้อผิดพลาด กรุณาลองใหม่'
}
