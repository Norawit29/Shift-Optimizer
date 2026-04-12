import { useQuery } from "@tanstack/react-query";

export interface SubscriptionData {
  subscription: any | null;
  isPro: boolean;
  proSlots: number | null;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  trialUsed: boolean;
  enforcementDate: string;
  isEnforced: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
