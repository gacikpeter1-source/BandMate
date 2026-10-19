import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastItem {
  msg: string;
  undo?: () => void;
}
const Ctx = createContext<(msg: string, undo?: () => void) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastItem | null>(null);
  const timer = useRef<number>();
  const show = useCallback((msg: string, undo?: () => void) => {
    window.clearTimeout(timer.current);
    setT({ msg, undo });
    timer.current = window.setTimeout(() => setT(null), undo ? 7000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {t && (
        <div className="toast" role="status">
          <span>{t.msg}</span>
          {t.undo && (
            <button
              onClick={() => {
                const u = t.undo;
                setT(null);
                u?.();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
