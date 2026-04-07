import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, Crown, Settings, LogOut, CreditCard, ChevronDown, ExternalLink } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

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
  const { isPro } = useProStatus();
  const { data: subData } = useSubscription();
  const { lang } = useLanguage();
  const { toast } = useToast();

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: () => {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: lang === "th" ? "ไม่สามารถเปิดหน้าจัดการสมาชิกได้" : "Could not open subscription portal",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const t = {
    settings: lang === "th" ? "ตั้งค่า" : "Settings",
    account: lang === "th" ? "บัญชีของฉัน" : "My Account",
    subscription: lang === "th" ? "สมาชิกภาพ" : "Subscription",
    proMember: lang === "th" ? "สมาชิก Pro" : "Pro Member",
    freePlan: lang === "th" ? "แผนฟรี" : "Free Plan",
    manageSub: lang === "th" ? "จัดการ / ยกเลิกสมาชิก" : "Manage / Cancel",
    upgradePro: lang === "th" ? "อัปเกรดเป็น Pro" : "Upgrade to Pro",
    logout: lang === "th" ? "ออกจากระบบ" : "Logout",
    pricing: lang === "th" ? "ดูแผนราคา" : "View Pricing",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label={t.settings}
          data-testid="button-user-menu"
        >
          <div className="relative shrink-0">
            {user.picture ? (
              <img
                src={`/api/avatar/${user.id}`}
                alt={user.name}
                width="32"
                height="32"
                className="w-8 h-8 rounded-full"
                data-testid="img-user-avatar"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            {isPro && (
              <div
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-slate-950 flex items-center justify-center"
                data-testid="badge-pro-avatar"
              >
                <Crown className="w-2 h-2 text-amber-900" />
              </div>
            )}
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:inline max-w-[96px] truncate" data-testid="text-user-name">
            {user.name}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 p-1.5" sideOffset={8}>
        {/* Profile header */}
        <div className="px-3 py-2.5 mb-1">
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              {user.picture ? (
                <img
                  src={`/api/avatar/${user.id}`}
                  alt={user.name}
                  width="40"
                  height="40"
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-base font-bold text-primary">
                  {user.name?.[0]?.toUpperCase()}
                </div>
              )}
              {isPro && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-slate-950 flex items-center justify-center">
                  <Crown className="w-2 h-2 text-amber-900" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
            </div>
          </div>

          {/* Pro/Free badge */}
          <div className="mt-2.5">
            {isPro ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-2.5 py-1.5 border border-amber-200 dark:border-amber-800/50">
                <Crown className="w-3.5 h-3.5" />
                {t.proMember}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-md px-2.5 py-1.5 border border-slate-200 dark:border-slate-700">
                {t.freePlan}
              </div>
            )}
          </div>
        </div>

        <DropdownMenuSeparator className="my-1" />

        {/* Subscription section */}
        {isPro ? (
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-md"
            onSelect={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            data-testid="menu-item-manage-subscription"
          >
            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{portalMutation.isPending ? (lang === "th" ? "กำลังโหลด..." : "Loading...") : t.manageSub}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link
              href="/pricing"
              className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-md"
              data-testid="menu-item-upgrade-pro"
            >
              <Crown className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-amber-600 dark:text-amber-400 font-medium">{t.upgradePro}</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1" />

        {/* Logout */}
        <DropdownMenuItem
          className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-md text-slate-600 dark:text-slate-400"
          onSelect={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {t.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
