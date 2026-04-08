import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useProStatus } from "@/hooks/useProStatus";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, Crown, LogOut, CreditCard, ChevronDown, Sparkles, CalendarDays } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

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

export function GoogleSignInButton({
  className,
  label,
  buttonVariant = "outline",
  buttonSize = "sm",
}: {
  className?: string;
  label?: string;
  buttonVariant?: "outline" | "default";
  buttonSize?: "sm" | "lg" | "default";
}) {
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
    return (
      <div className="flex flex-col items-center gap-2 w-full" data-testid="button-google-signin">
        <div ref={buttonRef} style={{ minHeight: 40 }} className="flex justify-center" />
      </div>
    );
  }

  return (
    <Button
      variant={buttonVariant}
      size={buttonSize}
      onClick={handleClick}
      className={className}
      aria-label="Sign in with Google"
      data-testid="button-google-signin"
    >
      <LogIn className="h-4 w-4 mr-1.5" aria-hidden="true" />
      {label ?? "Sign in"}
    </Button>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const { isPro } = useProStatus();
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: productsData } = useQuery<{ data: any[] }>({
    queryKey: ["/api/stripe/products"],
    staleTime: 5 * 60 * 1000,
  });

  const monthlyPrice = productsData?.data?.[0]?.prices?.find(
    (p: any) => p.recurring?.interval === "month"
  );

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { priceId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: () => {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: lang === "th" ? "ไม่สามารถเปิดหน้าชำระเงินได้" : "Could not open checkout",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stripe/portal", {});
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
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
    proMember: lang === "th" ? "สมาชิก Pro" : "Pro Member",
    freePlan: lang === "th" ? "แผนฟรี" : "Free Plan",
    manageSub: lang === "th" ? "จัดการสมาชิก" : "Manage Subscription",
    upgradePro: lang === "th" ? "อัปเกรดเป็น Pro" : "Upgrade to Pro",
    trialNote: lang === "th" ? "ทดลองฟรี 14 วัน" : "14-day free trial",
    logout: lang === "th" ? "ออกจากระบบ" : "Logout",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          aria-label="User menu"
          data-testid="button-user-menu"
        >
          <div className="relative shrink-0">
            {user.picture ? (
              <img
                src={`/api/avatar/${user.id}`}
                alt={user.name}
                width="32"
                height="32"
                className="w-8 h-8 rounded-full object-cover"
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

      <DropdownMenuContent align="end" className="w-64 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl" sideOffset={8}>
        {/* Profile header */}
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="relative shrink-0">
            {user.picture ? (
              <img
                src={`/api/avatar/${user.id}`}
                alt={user.name}
                width="44"
                height="44"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-700"
              />
            ) : (
              <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-base font-bold text-primary">
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            {isPro && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-white dark:border-slate-900 flex items-center justify-center">
                <Crown className="w-2.5 h-2.5 text-amber-900" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
            <div className="mt-1">
              {isPro ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-full px-2 py-0.5">
                  <Crown className="w-2.5 h-2.5" />{t.proMember}
                </span>
              ) : (
                <span className="inline-flex items-center text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">
                  {t.freePlan}
                </span>
              )}
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

        {/* My Schedules */}
        <DropdownMenuItem
          className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          onSelect={() => navigate("/history")}
          data-testid="menu-item-my-schedules"
        >
          <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{lang === "th" ? "ตารางเวรของฉัน" : "My Schedules"}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

        {/* Subscription action */}
        {isPro ? (
          <DropdownMenuItem
            className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            onSelect={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            data-testid="menu-item-manage-subscription"
          >
            <CreditCard className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{portalMutation.isPending ? (lang === "th" ? "กำลังโหลด..." : "Loading...") : t.manageSub}</span>
          </DropdownMenuItem>
        ) : (
          <div className="px-1 py-0.5">
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
              onClick={() => {
                if (monthlyPrice) {
                  checkoutMutation.mutate(monthlyPrice.id);
                } else {
                  navigate("/pricing");
                }
              }}
              disabled={checkoutMutation.isPending}
              data-testid="menu-item-upgrade-pro"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="whitespace-nowrap">
                {checkoutMutation.isPending
                  ? (lang === "th" ? "กำลังโหลด..." : "Loading...")
                  : t.upgradePro}
              </span>
              {!checkoutMutation.isPending && (
                <span className="ml-auto text-[10px] font-normal bg-white/20 rounded-full px-1.5 py-0.5 whitespace-nowrap">
                  {t.trialNote}
                </span>
              )}
            </button>
          </div>
        )}

        <DropdownMenuSeparator className="my-1.5 bg-slate-100 dark:bg-slate-800" />

        {/* Logout */}
        <DropdownMenuItem
          className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer rounded-xl text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
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
