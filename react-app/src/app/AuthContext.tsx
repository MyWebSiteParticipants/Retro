import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { completeOAuthIfReturning, signOut as doSignOut, whoAmI, type Viewer } from "../github/auth";
import { getToken } from "../github/client";

interface AuthState {
  /** undefined = still checking; null = signed out. */
  viewer: Viewer | null | undefined;
  error: string | null;
  /** Re-check the token (after OAuth return or PAT paste). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<Viewer | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      if (!(await getToken())) {
        setViewer(null);
        return;
      }
      setViewer(await whoAmI());
      setError(null);
    } catch (e) {
      setViewer(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await completeOAuthIfReturning();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      await refresh();
    })();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await doSignOut();
    setViewer(null);
  }, []);

  return <Ctx.Provider value={{ viewer, error, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
