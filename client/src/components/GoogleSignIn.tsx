import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, LogIn } from "lucide-react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton({ className }: { className?: string }) {
  const { login, clientId } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [showGoogleBtn, setShowGoogleBtn] = useState(false);

  const handleCredentialResponse = useCallback((response: any) => {
    if (response.credential) {
      login(response.credential);
    }
  }, [login]);

  const handleClick = useCallback(async () => {
    if (showGoogleBtn || !clientId) return;
    setShowGoogleBtn(true);
    try {
      await loadGsiScript();
      setScriptReady(true);
    } catch {
      setShowGoogleBtn(false);
    }
  }, [showGoogleBtn, clientId]);

  useEffect(() => {
    if (!scriptReady || !clientId || !buttonRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "signin_with",
    });
  }, [scriptReady, clientId, handleCredentialResponse]);

  if (showGoogleBtn) {
    return <div ref={buttonRef} className={className} data-testid="button-google-signin" style={{ minHeight: 40, minWidth: 100 }} />;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={className}
      aria-label="Sign in with Google"
      data-testid="button-google-signin"
    >
      <LogIn className="h-4 w-4 mr-1.5" aria-hidden="true" />
      Sign in
    </Button>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {user.picture && (
        <img
          src={`/api/avatar/${user.id}`}
          alt={user.name}
          width="32"
          height="32"
          className="w-8 h-8 rounded-full"
          data-testid="img-user-avatar"
        />
      )}
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline" data-testid="text-user-name">
        {user.name}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        aria-label="Logout"
        data-testid="button-logout"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
