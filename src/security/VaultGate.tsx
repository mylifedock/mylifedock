import { useState, useEffect } from "react";

import {
  ensureRecoveryKey,
  initializeVault,
  recoverVault,
  unlockVault,
} from "./vaultKeyService";
import { getPassphraseViaBiometrics, isBiometricEnabled } from "../application/biometricService";

type GateMode =
  | "unlock"
  | "recovery"
  | "show-recovery";

function VaultGate({
  configured,
  onUnlocked,
}: {
  configured: boolean;
  onUnlocked: () => void;
}) {
  const [mode, setMode] =
    useState<GateMode>("unlock");

  const [passphrase, setPassphrase] =
    useState("");

  const [confirmPassphrase, setConfirmPassphrase] =
    useState("");

  const [newPassphrase, setNewPassphrase] =
    useState("");

  const [recoveryKey, setRecoveryKey] =
    useState("");

  const [
    generatedRecoveryKey,
    setGeneratedRecoveryKey,
  ] = useState("");

  const [recoverySaved, setRecoverySaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [hasBiometrics, setHasBiometrics] =
    useState(false);

  const isSetup =
    !configured &&
    mode === "unlock";

  useEffect(() => {
    async function checkBio() {
      if (configured) {
        const enabled = await isBiometricEnabled();
        setHasBiometrics(enabled);
      }
    }
    void checkBio();
  }, [configured]);

  async function handleBiometricUnlock() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const bioPassphrase = await getPassphraseViaBiometrics();
      if (!bioPassphrase) {
        setBusy(false);
        return;
      }
      await unlockVault(bioPassphrase);
      onUnlocked();
    } catch (err) {
      console.error("Biometric unlock error:", err);
      const msg = err instanceof Error ? err.message : "Biometric verification failed.";
      setError(`${msg} (Or enter your passphrase below)`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError("");

    if (passphrase.length < 12) {
      setError(
        "Your vault passphrase must contain at least 12 characters.",
      );
      return;
    }

    if (
      isSetup &&
      passphrase !==
        confirmPassphrase
    ) {
      setError(
        "The passphrases do not match.",
      );
      return;
    }

    try {
      setBusy(true);

      if (isSetup) {
        const recovery =
          await initializeVault(
            passphrase,
          );

        setGeneratedRecoveryKey(
          recovery,
        );

        setPassphrase("");
        setConfirmPassphrase("");
        setRecoverySaved(false);
        setMode("show-recovery");

        return;
      }

      await unlockVault(
        passphrase,
      );

      const recovery =
        await ensureRecoveryKey();

      setPassphrase("");

      if (recovery) {
        setGeneratedRecoveryKey(
          recovery,
        );

        setRecoverySaved(false);
        setMode("show-recovery");

        return;
      }

      onUnlocked();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to unlock the vault.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRecovery(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (busy) {
      return;
    }

    setError("");

    if (!recoveryKey.trim()) {
      setError(
        "Enter your recovery key.",
      );
      return;
    }

    if (newPassphrase.length < 12) {
      setError(
        "Your new vault passphrase must contain at least 12 characters.",
      );
      return;
    }

    if (
      newPassphrase !==
      confirmPassphrase
    ) {
      setError(
        "The new passphrases do not match.",
      );
      return;
    }

    try {
      setBusy(true);

      await recoverVault(
        recoveryKey,
        newPassphrase,
      );

      setRecoveryKey("");
      setNewPassphrase("");
      setConfirmPassphrase("");

      onUnlocked();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to recover the vault.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyRecoveryKey() {
    if (!generatedRecoveryKey) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        generatedRecoveryKey,
      );
    } catch {
      setError(
        "Unable to copy the recovery key. Please copy it manually.",
      );
    }
  }

  if (mode === "show-recovery") {
    return (
      <main className="onboarding">
        <div className="onboarding-glow" />

        <div className="onboarding-card vault-gate-card">
          <div className="brand-mark large">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>

          <span className="eyebrow">
            SAVE YOUR RECOVERY KEY
          </span>

          <h1>
            Protect your
            <br />
            <span>future access.</span>
          </h1>

          <p>
            This is your emergency offline
            recovery method. MyLifeDock does not
            store the recovery key itself.
          </p>

          <textarea
            value={
              generatedRecoveryKey
            }
            readOnly
            rows={4}
            aria-label="Vault recovery key"
          />

          <button
            className="primary-button"
            type="button"
            onClick={() =>
              void copyRecoveryKey()
            }
          >
            Copy recovery key
            <span>↗</span>
          </button>

          <label>
            <input
              type="checkbox"
              checked={recoverySaved}
              onChange={(event) =>
                setRecoverySaved(
                  event.target.checked,
                )
              }
            />{" "}
            I have saved my recovery key
            somewhere safe.
          </label>

          {error && (
            <div className="vault-error">
              {error}
            </div>
          )}

          <button
            className="primary-button"
            type="button"
            disabled={!recoverySaved}
            onClick={() => {
              setGeneratedRecoveryKey("");
              onUnlocked();
            }}
          >
            Continue to MyLifeDock
            <span>→</span>
          </button>

          <div className="onboarding-security">
            <span>●</span>

            <div>
              <strong>
                Four access paths are planned
              </strong>

              <small>
                Passphrase and recovery key are
                available now. Trusted-device and
                Google recovery will be added through
                their real authentication protocols.
              </small>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (mode === "recovery") {
    return (
      <main className="onboarding">
        <div className="onboarding-glow" />

        <div className="onboarding-card vault-gate-card">
          <div className="brand-mark large">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>

          <span className="eyebrow">
            VAULT RECOVERY
          </span>

          <h1>
            Recover your
            <br />
            <span>private vault.</span>
          </h1>

          <p>
            Use your emergency recovery key to
            create a new vault passphrase.
          </p>

          <form
            className="vault-gate-form"
            onSubmit={handleRecovery}
          >
            <label htmlFor="recoveryKey">
              Recovery key
            </label>

            <textarea
              id="recoveryKey"
              value={recoveryKey}
              onChange={(event) =>
                setRecoveryKey(
                  event.target.value,
                )
              }
              placeholder="Enter your recovery key"
              rows={4}
              autoFocus
              autoComplete="off"
            />

            <label htmlFor="newVaultPassphrase">
              New vault passphrase
            </label>

            <input
              id="newVaultPassphrase"
              type="password"
              value={newPassphrase}
              onChange={(event) =>
                setNewPassphrase(
                  event.target.value,
                )
              }
              placeholder="At least 12 characters"
              autoComplete="new-password"
            />

            <label htmlFor="confirmNewVaultPassphrase">
              Confirm new passphrase
            </label>

            <input
              id="confirmNewVaultPassphrase"
              type="password"
              value={confirmPassphrase}
              onChange={(event) =>
                setConfirmPassphrase(
                  event.target.value,
                )
              }
              placeholder="Enter it again"
              autoComplete="new-password"
            />

            {error && (
              <div className="vault-error">
                {error}
              </div>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={
                busy ||
                !recoveryKey.trim() ||
                !newPassphrase ||
                !confirmPassphrase
              }
            >
              {busy
                ? "Recovering..."
                : "Recover vault"}

              <span>→</span>
            </button>
          </form>

          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setError("");
              setRecoveryKey("");
              setNewPassphrase("");
              setConfirmPassphrase("");
              setMode("unlock");
            }}
          >
            Back to unlock
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="onboarding">
      <div className="onboarding-glow" />

      <div className="onboarding-card vault-gate-card">
        <div className="brand-mark large">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>

        <span className="eyebrow">
          {isSetup
            ? "SECURE YOUR MYLIFEDOCK"
            : "MYLIFEDOCK IS LOCKED"}
        </span>

        <h1>
          {isSetup ? (
            <>
              Create your
              <br />
              <span>private vault.</span>
            </>
          ) : (
            <>
              Welcome
              <br />
              <span>back.</span>
            </>
          )}
        </h1>

        <p>
          {isSetup
            ? "Your vault key will be protected by a passphrase and an independent recovery key."
            : "Unlock your private vault to access your documents and personal information."}
        </p>

        {hasBiometrics && !isSetup && (
          <button
            type="button"
            className="secondary-button"
            onClick={handleBiometricUnlock}
            disabled={busy}
            style={{
              marginBottom: "16px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              borderColor: "rgba(167, 139, 250, 0.4)",
              background: "rgba(167, 139, 250, 0.1)",
              color: "#e2e8f0",
              fontWeight: 600,
              padding: "12px",
              borderRadius: "10px",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 0-6.88 17.23l.12.11A9.97 9.97 0 0 0 12 22a9.97 9.97 0 0 0 6.76-2.66l.12-.11A10 10 0 0 0 12 2z"/>
              <path d="M12 7a5 5 0 0 0-5 5v1a5 5 0 0 0 10 0v-1a5 5 0 0 0-5-5z"/>
            </svg>
            Unlock with Fingerprint / Face ID
          </button>
        )}

        <form
          className="vault-gate-form"
          onSubmit={handleUnlock}
        >
          <label htmlFor="vaultPassphrase">
            Vault passphrase
          </label>

          <input
            id="vaultPassphrase"
            type="password"
            value={passphrase}
            onChange={(event) =>
              setPassphrase(
                event.target.value,
              )
            }
            placeholder="At least 12 characters"
            autoFocus
            autoComplete={
              isSetup
                ? "new-password"
                : "current-password"
            }
          />

          {isSetup && (
            <>
              <label htmlFor="confirmVaultPassphrase">
                Confirm passphrase
              </label>

              <input
                id="confirmVaultPassphrase"
                type="password"
                value={confirmPassphrase}
                onChange={(event) =>
                  setConfirmPassphrase(
                    event.target.value,
                  )
                }
                placeholder="Enter it again"
                autoComplete="new-password"
              />
            </>
          )}

          {error && (
            <div className="vault-error">
              {error}
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={
              busy ||
              !passphrase ||
              (isSetup &&
                !confirmPassphrase)
            }
          >
            {busy
              ? "Securing..."
              : isSetup
                ? "Create private vault"
                : "Unlock MyLifeDock"}

            <span>→</span>
          </button>
        </form>

        {!isSetup && (
          <>
            <div style={{ marginTop: "12px" }}>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setError("");
                  setMode("recovery");
                }}
              >
                Use recovery key
                <span>↗</span>
              </button>
            </div>

            <div className="onboarding-security">
              <span>●</span>

              <div>
                <strong>
                  More recovery methods are coming
                </strong>

                <small>
                  Trusted-device and Google account
                  recovery will use real cryptographic
                  credentials rather than a server-held
                  master password.
                </small>
              </div>
            </div>
          </>
        )}

        {isSetup && (
          <div className="onboarding-security">
            <span>●</span>

            <div>
              <strong>
                Your passphrase stays yours
              </strong>

              <small>
                MyLifeDock does not store your
                passphrase.
              </small>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default VaultGate;