import { useState } from "react";

import {
  ensureRecoveryKey,
  initializeVault,
  recoverVault,
  unlockVault,
} from "./vaultKeyService";

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
    useState<GateMode>(
      configured
        ? "unlock"
        : "unlock",
    );

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

  const isSetup =
    !configured &&
    mode === "unlock";

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
            M
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
            M
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
            className="primary-button"
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
          M
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
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setError("");
                setMode("recovery");
              }}
            >
              Use recovery key
              <span>↗</span>
            </button>

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