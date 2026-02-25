import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

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

export function GoogleSignInButton({ className }: { className?: string }) {
  const { login, clientId } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);

  const handleCredentialResponse = useCallback((response: any) => {
    if (response.credential) {
      login(response.credential);
    }
  }, [login]);

  useEffect(() => {
    if (!clientId || scriptLoaded.current) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded.current = true;
      if (window.google && buttonRef.current) {
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
      }
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, [clientId, handleCredentialResponse]);

  useEffect(() => {
    if (scriptLoaded.current && window.google && buttonRef.current) {
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
    }
  }, [clientId, handleCredentialResponse]);

  return <div ref={buttonRef} className={className} data-testid="button-google-signin" />;
}

export function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2">
      {user.picture && (
        <img
          src={user.picture}
          alt={user.name}
          width="32"
          height="32"
          className="w-8 h-8 rounded-full"
          referrerPolicy="no-referrer"
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
