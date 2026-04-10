import { useSubscription } from "./useSubscription";

export function useProStatus() {
  const { data, isLoading } = useSubscription();
  return {
    isPro: data?.isPro ?? false,
    proSlots: data?.proSlots ?? null,
    isTrialing: data?.isTrialing ?? false,
    trialDaysLeft: data?.trialDaysLeft ?? null,
    trialUsed: data?.trialUsed ?? false,
    isLoading,
  };
}
