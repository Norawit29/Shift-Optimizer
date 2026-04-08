import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  picture: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  clientId: string;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  clientId: "",
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => fetchAuth());
    } else {
      setTimeout(() => fetchAuth(), 100);
    }

    function fetchAuth() {
      Promise.all([
        fetch("/api/auth/me").then(r => r.json()),
        fetch("/api/auth/google-client-id").then(r => r.json()),
      ]).then(([me, cid]) => {
        if (me) setUser(me);
        if (cid?.clientId) setClientId(cid.clientId);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, []);

  const login = useCallback(async (credential: string) => {
    const res = await fetch("/api/auth/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    if (res.ok) {
      const u = await res.json();
      setUser(u);
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
      queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/presets"] });
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    queryClient.clear();
    window.location.href = "/";
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clientId }}>
      {children}
    </AuthContext.Provider>
  );
}
