/**
 * externalActivity.ts
 *
 * The vault locks when the app goes to the background. Some backgrounding is
 * caused by the app itself: the camera, the file picker, the share sheet, Google
 * sign-in or the Face ID prompt. Locking there would break the action the user
 * just started (the photo could not be encrypted, the backup could not be
 * created), so those flows mark themselves here and the background lock skips
 * them. Any other backgrounding still locks immediately, and the inactivity
 * timer still applies.
 */

/** Longest time an app-started flow may keep the vault open in the background. */
const MAX_EXTERNAL_MS = 10 * 60 * 1000;

let activeFlows = 0;
let markedUntil = 0;

export function isExternalActivityActive(now = Date.now()): boolean {
  return activeFlows > 0 || now < markedUntil;
}

/**
 * Marks a flow that has no completion callback (for example a file input opening
 * the camera). The mark is cleared when the app returns to the foreground.
 */
export function markExternalActivity(now = Date.now()): void {
  markedUntil = now + MAX_EXTERNAL_MS;
}

/** Called when the app returns to the foreground. */
export function clearExternalActivityMark(): void {
  markedUntil = 0;
}

/** Runs an app-started flow that leaves the app (share sheet, sign-in, biometric prompt). */
export async function withExternalActivity<T>(flow: () => Promise<T>): Promise<T> {
  activeFlows++;
  let released = false;
  const timeout = setTimeout(() => {
    activeFlows = Math.max(0, activeFlows - 1);
    released = true;
  }, MAX_EXTERNAL_MS);
  try {
    return await flow();
  } finally {
    clearTimeout(timeout);
    if (!released) activeFlows = Math.max(0, activeFlows - 1);
  }
}
