/**
 * Persistent unlock throttling for passphrase and recovery-key attempts.
 *
 * Survives reloads and app restarts (localStorage), unlike the previous
 * sessionStorage counter. PBKDF2 (600,000 iterations) remains the actual
 * brute-force defence; this adds escalating friction in the UI.
 */

const STORAGE_KEY = "mld_unlock_throttle";
const MAX_COOLDOWN_SECONDS = 15 * 60;

interface ThrottleState {
  failures: number;
  lockedUntil: number;
}

function read(): ThrottleState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed && typeof parsed.failures === "number" && typeof parsed.lockedUntil === "number") {
      return parsed;
    }
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return { failures: 0, lockedUntil: 0 };
}

function write(state: ThrottleState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: throttling applies for this session only.
  }
}

/** Cooldown after the given number of consecutive failures. */
export function cooldownSecondsFor(failures: number): number {
  if (failures < 3) return 0;
  if (failures < 5) return 5;
  if (failures < 6) return 15;
  return Math.min(MAX_COOLDOWN_SECONDS, 30 * 2 ** (failures - 6));
}

/** Records a failed attempt and returns the cooldown it triggers (seconds). */
export function recordUnlockFailure(now = Date.now()): number {
  const state = read();
  const failures = state.failures + 1;
  const cooldown = cooldownSecondsFor(failures);
  write({ failures, lockedUntil: cooldown > 0 ? now + cooldown * 1000 : 0 });
  return cooldown;
}

export function resetUnlockThrottle(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    // Clean up the old session-only counter as well.
    sessionStorage.removeItem("mld_failed_passphrase_attempts");
  } catch {
    // ignore storage errors
  }
}

/** Seconds left in the current lockout (0 if none). */
export function remainingCooldownSeconds(now = Date.now()): number {
  return Math.max(0, Math.ceil((read().lockedUntil - now) / 1000));
}
