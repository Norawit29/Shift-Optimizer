import { useQuery } from "@tanstack/react-query";

export interface SubscriptionData {
  subscription: any | null;
  isPro: boolean;
}

export function useSubscription() {
  return useQuery<SubscriptionData>({
    queryKey: ["/api/stripe/subscription"],
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
}
