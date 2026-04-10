import { useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Crown, Gift, FlaskConical, Clock } from "lucide-react";
import { GoogleSignInButton } from "@/components/GoogleSignIn";
import { Link, useSearch } from "wouter";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/Navbar";

const PRICING_TIERS = [
  { label: "11–15", slots: 15, monthly: 259, yearly: 2639 },
  { label: "20",    slots: 20, monthly: 335, yearly: 3415 },
  { label: "25",    slots: 25, monthly: 409, yearly: 4169 },
  { label: "30",    slots: 30, monthly: 485, yearly: 4945 },
  { label: "35",    slots: 35, monthly: 559, yearly: 5699 },
  { label: "40",    slots: 40, monthly: 635, yearly: 6475 },
  { label: "45",    slots: 45, monthly: 709, yearly: 7229 },
  { label: "50",    slots: 50, monthly: 785, yearly: 8005 },
];

const FREE_FEATURES = {
  th: [
    "ระบบจัดเวรด้วย AI",
    "บุคลากรสูงสุด 15 คน",
    "ประเภทเวรสูงสุด 3 ประเภท",
    "ระดับบุคลากรสูงสุด 3 ระดับ",
    "บันทึกตาราง",
    "ดูตารางรายเดือน",
  ],
  en: [
    "AI-powered scheduling",
    "Up to 15 staff members",
    "Up to 3 shift types",
    "Up to 3 staff levels",
    "Save schedules",
    "Monthly schedule view",
  ],
};

const PRO_FEATURES = {
  th: [
    "รองรับทุกฟีเจอร์ Free",
    "ประเภทเวรสูงสุด 5 ประเภท",
    "ระดับบุคลากรสูงสุด 5 ระดับ",
    "เกลี่ยวันหยุดและวันสำคัญ",
    "ดูตารางรายบุคคล",
    "ส่งออก Excel (.xlsx)",
  ],
  en: [
    "Includes all Free features",
    "Up to 5 shift types",
    "Up to 5 staff levels",
    "Holiday & weekend balancing",
    "Per-staff schedule view",
    "Export to Excel (.xlsx)",
  ],
};

function formatPrice(amount: number, currency: string) {
  if (currency === "thb") {
    return `฿${(amount / 100).toLocaleString("th-TH")}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export default function PricingPage() {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { data: subData } = useSubscription();
  const { toast } = useToast();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const isCanceled = params.get("canceled") === "true";

  useEffect(() => {
    if (isCanceled) {
      toast({
        title: lang === "th" ? "ยกเลิกการชำระเงิน" : "Payment canceled",
        variant: "destructive",
      });
    }
  }, [isCanceled]);

  const checkoutMutation = useMutation({
    mutationFn: async ({ slotCount, billingCycle }: { slotCount: number; billingCycle: string }) => {
      const res = await apiRequest("POST", "/api/stripe/checkout", { slotCount, billingCycle });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.url) window.open(data.url, "_blank");
    },
    onError: (error: any) => {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: error.message || (lang === "th" ? "ไม่สามารถดำเนินการได้" : "Something went wrong"),
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
    onError: (error: any) => {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const trialMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trial/start", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/subscription"] });
      toast({
        title: lang === "th" ? "เริ่มทดลองใช้ฟรีแล้ว!" : "Free trial started!",
        description: lang === "th" ? "คุณมีสิทธิ์ใช้ฟีเจอร์ Pro ฟรี 14 วัน ไม่ต้องใส่บัตรเครดิต" : "You have 14 days of free Pro access — no credit card needed.",
      });
    },
    onError: (err: any) => {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: err.message || (lang === "th" ? "ไม่สามารถเริ่มทดลองได้" : "Could not start trial"),
        variant: "destructive",
      });
    },
  });

  const isPro = subData?.isPro ?? false;
  const isTrialing = subData?.isTrialing ?? false;
  const trialDaysLeft = subData?.trialDaysLeft ?? null;
  const trialUsed = subData?.trialUsed ?? false;
  const hasActivePaidSub = isPro && !isTrialing;

  const [slotIndex, setSlotIndex] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const selectedTier = PRICING_TIERS[slotIndex];

  const [enterpriseForm, setEnterpriseForm] = useState({
    orgName: "", contactName: "", email: "", phone: "", staffCount: "", message: "",
  });
  const [enterpriseSubmitted, setEnterpriseSubmitted] = useState(false);

  const enterpriseMutation = useMutation({
    mutationFn: async (data: typeof enterpriseForm) => {
      const res = await apiRequest("POST", "/api/enterprise-leads", data);
      return res.json();
    },
    onSuccess: () => {
      setEnterpriseSubmitted(true);
      setEnterpriseForm({ orgName: "", contactName: "", email: "", phone: "", staffCount: "", message: "" });
    },
    onError: () => {
      toast({
        title: lang === "th" ? "เกิดข้อผิดพลาด" : "Error",
        description: lang === "th" ? "ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่" : "Could not submit. Please try again.",
        variant: "destructive",
      });
    },
  });


  const t = {
    title: lang === "th" ? "ราคาและแผนบริการ" : "Pricing Plans",
    subtitle: lang === "th"
      ? "เลือกแผนที่เหมาะกับคุณ — เริ่มต้นฟรี อัปเกรดเมื่อพร้อม"
      : "Choose the plan that fits you — start free, upgrade when ready",
    free: "Free",
    freeDesc: lang === "th" ? "สำหรับทีมขนาดเล็ก" : "For small teams",
    pro: "Pro",
    proDesc: lang === "th" ? "สำหรับโรงพยาบาลทุกขนาด" : "For hospitals of any size",
    month: lang === "th" ? "/เดือน" : "/month",
    year: lang === "th" ? "/ปี" : "/year",
    currentPlan: lang === "th" ? "แผนปัจจุบัน" : "Current Plan",
    getStarted: lang === "th" ? "เริ่มใช้งานฟรี" : "Get Started Free",
    subscribePro: lang === "th" ? "สมัคร Pro" : "Subscribe to Pro",
    startTrial: lang === "th" ? "ทดลองใช้ฟรี 14 วัน — ไม่ต้องใส่บัตรเครดิต" : "Start 14-Day Free Trial — No Card Required",
    manageSubscription: lang === "th" ? "จัดการสมาชิก" : "Manage Subscription",
    loginRequired: lang === "th" ? "เข้าสู่ระบบเพื่อสมัคร" : "Sign in to subscribe",
    perYear: lang === "th" ? "ต่อปี" : "per year",
    saveLabel: lang === "th" ? "ประหยัด" : "Save",

    currentlyPro: lang === "th" ? "คุณเป็นสมาชิก Pro แล้ว" : "You're already a Pro member",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 pt-28 pb-16">

        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-4">{t.title}</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">{t.subtitle}</p>
        </div>

        {isPro && user && (
          <div className="mb-10 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center text-amber-800 dark:text-amber-300 font-medium flex items-center justify-center gap-2">
            <Crown className="w-5 h-5" />
            {t.currentlyPro}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch pt-6 pb-2">
          {/* Free Plan */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-7 shadow-sm flex flex-col transition-colors hover:border-primary cursor-default">
            <div className="mb-6">
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                {t.free}
              </div>
              <div className="text-4xl font-bold text-slate-900 dark:text-slate-50">฿0</div>
              <div className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{t.freeDesc}</div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {FREE_FEATURES[lang as "th" | "en"].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <Link href="/create">
              <Button
                variant="outline"
                className="w-full"
                data-testid="button-free-plan"
                disabled={!isPro && !!user}
              >
                {!user ? t.getStarted : isPro ? t.getStarted : t.currentPlan}
              </Button>
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="rounded-2xl border-2 border-primary bg-white dark:bg-slate-800 px-7 pt-10 pb-8 shadow-xl relative overflow-visible flex flex-col md:-my-4">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <Badge className="gap-1 bg-primary text-white border-0 text-xs px-3 py-1 font-semibold shadow-md whitespace-nowrap">
                <Gift className="w-3 h-3" />
                {lang === "th" ? "ยอดนิยม · ทดลอง 14 วัน" : "Most Popular · 14-day trial"}
              </Badge>
            </div>

            <div className="mb-4">
              <div className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
                {t.pro}
              </div>

              {/* Billing cycle toggle */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-1 mb-4 w-fit">
                <button
                  onClick={() => setBillingCycle("monthly")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${billingCycle === "monthly" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                  data-testid="button-billing-monthly"
                >
                  {lang === "th" ? "รายเดือน" : "Monthly"}
                </button>
                <button
                  onClick={() => setBillingCycle("yearly")}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${billingCycle === "yearly" ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400"}`}
                  data-testid="button-billing-yearly"
                >
                  {lang === "th" ? "รายปี" : "Yearly"}
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">-15%</span>
                </button>
              </div>

              {/* Dynamic price */}
              <div className="flex items-end gap-1">
                <div className="text-4xl font-bold text-slate-900 dark:text-slate-50">
                  ฿{billingCycle === "monthly" ? selectedTier.monthly.toLocaleString() : selectedTier.yearly.toLocaleString()}
                </div>
                <div className="text-base font-normal text-slate-500 mb-1">
                  {billingCycle === "monthly" ? t.month : t.year}
                </div>
              </div>

              {/* Slot label */}
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "th"
                  ? `บุคลากรสูงสุด ${selectedTier.label} คน`
                  : `Up to ${selectedTier.label} staff members`}
              </div>
            </div>

            {/* Slot slider */}
            <div className="mb-5">
              <div className="flex justify-between text-[11px] text-slate-400 mb-1 px-0.5">
                <span>11–15</span>
                <span>50 {lang === "th" ? "คน" : "staff"}</span>
              </div>
              <input
                type="range"
                min={0}
                max={PRICING_TIERS.length - 1}
                step={1}
                value={slotIndex}
                onChange={(e) => setSlotIndex(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
                data-testid="slider-slot-count"
              />
              <div className="flex justify-between mt-1 px-0.5">
                {PRICING_TIERS.map((tier, i) => (
                  <button
                    key={i}
                    onClick={() => setSlotIndex(i)}
                    className={`text-[10px] font-medium transition-colors leading-none ${i === slotIndex ? "text-primary" : "text-slate-300 dark:text-slate-600"}`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-3 mb-6 flex-1">
              {PRO_FEATURES[lang as "th" | "en"].map((feature, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {hasActivePaidSub ? (
              <Button className="w-full gap-2" variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending} data-testid="button-manage-subscription">
                {portalMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.manageSubscription}
              </Button>
            ) : isTrialing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm font-medium">
                  <Clock className="w-4 h-4 shrink-0" />
                  {lang === "th" ? `ทดลองใช้อยู่ — เหลืออีก ${trialDaysLeft} วัน` : `Trial active — ${trialDaysLeft} days left`}
                </div>
                <Button
                  className="w-full gap-2 bg-amber-500 hover:bg-amber-600"
                  onClick={() => checkoutMutation.mutate({ slotCount: selectedTier.slots, billingCycle })}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-subscribe-pro"
                >
                  {checkoutMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Crown className="w-4 h-4" />
                  {lang === "th" ? "สมัคร Pro เพื่อต่ออายุ" : "Subscribe to continue"}
                </Button>
              </div>
            ) : !user ? (
              <GoogleSignInButton
                className="w-full gap-2"
                label={lang === "th" ? "เข้าสู่ระบบเพื่อสมัคร" : "Sign in to subscribe"}
                buttonVariant="default"
                buttonSize="default"
              />
            ) : !trialUsed ? (
              <div className="space-y-2">
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => trialMutation.mutate()}
                  disabled={trialMutation.isPending}
                  data-testid="button-start-trial"
                >
                  {trialMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                  {trialMutation.isPending ? (lang === "th" ? "กำลังเริ่ม..." : "Starting...") : t.startTrial}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-sm"
                  onClick={() => checkoutMutation.mutate({ slotCount: selectedTier.slots, billingCycle })}
                  disabled={checkoutMutation.isPending}
                  data-testid="button-subscribe-pro"
                >
                  {checkoutMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.subscribePro}
                </Button>
              </div>
            ) : (
              <Button
                className="w-full gap-2"
                onClick={() => checkoutMutation.mutate({ slotCount: selectedTier.slots, billingCycle })}
                disabled={checkoutMutation.isPending}
                data-testid="button-subscribe-pro"
              >
                {checkoutMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {t.subscribePro}
              </Button>
            )}

            {!isPro && user && !trialUsed && (
              <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === "th"
                  ? "ทดลองได้ 1 ครั้งต่อ 1 บัญชี — ใช้ฟีเจอร์ Pro ครบทุกอย่างฟรี 14 วัน"
                  : "One trial per account — full Pro access for 14 days"}
              </p>
            )}
          </div>

          {/* Enterprise Plan */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-7 shadow-sm flex flex-col transition-colors hover:border-primary cursor-default">
            <div className="mb-5">
              <div className="mb-1">
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Enterprise
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                {lang === "th" ? "ติดต่อเรา" : "Contact Us"}
              </div>
              <div className="text-slate-500 dark:text-slate-400 mt-1 text-sm text-justify">
                {lang === "th"
                  ? "ปรับแต่งระบบให้เข้ากับองค์กรของคุณ — ทีมของเราพร้อมช่วยออกแบบระบบจัดเวรที่ตอบโจทย์โรงพยาบาลระดับใหญ่และองค์กรสุขภาพโดยเฉพาะ"
                  : "Tailored to your organization — our team will design a scheduling solution for large hospitals and healthcare enterprises."}
              </div>
            </div>

            <div className="flex-1">
              {enterpriseSubmitted ? (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === "th" ? "ส่งข้อมูลเรียบร้อยแล้ว!" : "Inquiry submitted!"}
                  </p>
                  <p className="text-sm text-slate-500">
                    {lang === "th" ? "ทีมงานจะติดต่อกลับภายใน 1-2 วันทำการ" : "Our team will contact you within 1-2 business days."}
                  </p>
                  <button className="text-xs text-primary underline mt-1" onClick={() => setEnterpriseSubmitted(false)}>
                    {lang === "th" ? "ส่งใหม่" : "Submit another"}
                  </button>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!enterpriseForm.orgName || !enterpriseForm.contactName || !enterpriseForm.email) return;
                    enterpriseMutation.mutate(enterpriseForm);
                  }}
                >
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === "th" ? "ชื่อองค์กร / โรงพยาบาล *" : "Organization / Hospital name *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={enterpriseForm.orgName}
                      onChange={(e) => setEnterpriseForm(f => ({ ...f, orgName: e.target.value }))}
                      placeholder={lang === "th" ? "ชื่อองค์กร หรือ โรงพยาบาล" : "e.g. City Hospital"}
                      className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="input-enterprise-org"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === "th" ? "ชื่อผู้ติดต่อ *" : "Contact name *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={enterpriseForm.contactName}
                      onChange={(e) => setEnterpriseForm(f => ({ ...f, contactName: e.target.value }))}
                      placeholder={lang === "th" ? "ชื่อ-นามสกุล" : "Full name"}
                      className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="input-enterprise-contact"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        {lang === "th" ? "อีเมล *" : "Email *"}
                      </label>
                      <input
                        type="email"
                        required
                        value={enterpriseForm.email}
                        onChange={(e) => setEnterpriseForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="email@hospital.com"
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid="input-enterprise-email"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        {lang === "th" ? "เบอร์โทร" : "Phone"}
                      </label>
                      <input
                        type="tel"
                        value={enterpriseForm.phone}
                        onChange={(e) => setEnterpriseForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="08x-xxx-xxxx"
                        className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        data-testid="input-enterprise-phone"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === "th" ? "จำนวนบุคลากรโดยประมาณ" : "Approx. staff count"}
                    </label>
                    <select
                      value={enterpriseForm.staffCount}
                      onChange={(e) => setEnterpriseForm(f => ({ ...f, staffCount: e.target.value }))}
                      className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      data-testid="select-enterprise-staff"
                    >
                      <option value="">{lang === "th" ? "เลือก..." : "Select..."}</option>
                      <option value="50-100">50–100 {lang === "th" ? "คน" : "staff"}</option>
                      <option value="100-300">100–300 {lang === "th" ? "คน" : "staff"}</option>
                      <option value="300-500">300–500 {lang === "th" ? "คน" : "staff"}</option>
                      <option value="500+">500+ {lang === "th" ? "คน" : "staff"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                      {lang === "th" ? "ความต้องการเพิ่มเติม" : "Additional requirements"}
                    </label>
                    <textarea
                      rows={2}
                      value={enterpriseForm.message}
                      onChange={(e) => setEnterpriseForm(f => ({ ...f, message: e.target.value }))}
                      placeholder={lang === "th" ? "อธิบายความต้องการขององค์กร..." : "Describe your needs..."}
                      className="w-full text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                      data-testid="textarea-enterprise-message"
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full gap-2 mt-1" disabled={enterpriseMutation.isPending} data-testid="button-enterprise-submit">
                    {enterpriseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {lang === "th" ? "ส่งข้อมูลติดต่อ" : "Send Inquiry"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-500">
            {lang === "th"
              ? "ชำระเงินผ่าน Stripe — ปลอดภัย ยกเลิกได้ทุกเมื่อ"
              : "Payments powered by Stripe — secure, cancel anytime"}
          </p>
        </div>
      </div>
    </div>
  );
}
