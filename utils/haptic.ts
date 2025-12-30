/**
 * Trigger haptic feedback via Web Vibration API
 * Gracefully degrades if not supported
 */
export const triggerHaptic = (duration = 50) => {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration)
  }
}
