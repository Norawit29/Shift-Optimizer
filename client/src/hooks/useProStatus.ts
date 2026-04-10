import { useSubscription } from "./useSubscription";

export function useProStatus() {
  const { data, isLoading } = useSubscription();
  return {
    isPro: data?.isPro ?? false,
    proSlots: data?.proSlots ?? null,
    isLoading,
  };
}
