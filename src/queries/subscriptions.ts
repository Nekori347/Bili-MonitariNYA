import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSubscriptions,
  removeSubscription,
  upsertSubscription,
  updateSubscription,
  type Subscription,
} from "../services/database/subscriptions";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
};

export function useSubscriptions() {
  return useQuery({
    queryKey: subscriptionKeys.all,
    queryFn: () => listSubscriptions(),
    staleTime: 30_000,
  });
}

export function useAddSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sub: { mid: number; name: string; videoLimit?: number }) =>
      upsertSubscription(sub),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useUpdateSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ mid, patch }: { mid: number; patch: Partial<Subscription> }) =>
      updateSubscription(mid, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}

export function useRemoveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mid: number) => removeSubscription(mid),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
}
