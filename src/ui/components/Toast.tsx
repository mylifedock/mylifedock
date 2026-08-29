import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

import type { ReactNode } from "react";

type ToastType =
  | "success"
  | "error"
  | "info";

type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (
    message: string,
    type?: ToastType,
  ) => void;
};

const ToastContext =
  createContext<ToastContextValue>({
    showToast: () => {},
  });

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<
    Toast[]
  >([]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
    ) => {
      const id = crypto.randomUUID();

      setToasts((prev) => [
        ...prev,
        { id, message, type },
      ]);

      window.setTimeout(() => {
        setToasts((prev) =>
          prev.filter(
            (t) => t.id !== id,
          ),
        );
      }, 4000);
    },
    [],
  );

  return (
    <ToastContext.Provider
      value={{ showToast }}
    >
      {children}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`toast toast-${toast.type}`}
            >
              <span className="toast-icon">
                {toast.type === "success"
                  ? "✓"
                  : toast.type === "error"
                    ? "✗"
                    : "ℹ"}
              </span>

              <span>{toast.message}</span>

              <button
                type="button"
                className="toast-close"
                onClick={() =>
                  setToasts((prev) =>
                    prev.filter(
                      (t) =>
                        t.id !== toast.id,
                    ),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
