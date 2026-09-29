/** Vibrates the phone, but only once the page has been touched (browsers refuse, noisily, before that). */
export function buzz(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* not allowed */
  }
}
