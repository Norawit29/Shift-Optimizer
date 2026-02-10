import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertSchedule, type Schedule } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useSchedules() {
  return useQuery({
    queryKey: [api.schedules.list.path],
    queryFn: async () => {
      const res = await fetch(api.schedules.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schedules");
      return api.schedules.list.responses[200].parse(await res.json());
    },
  });
}

export function useSchedule(id: number) {
  return useQuery({
    queryKey: [api.schedules.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.schedules.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch schedule");
      return api.schedules.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertSchedule) => {
      const res = await fetch(api.schedules.create.path, {
        method: api.schedules.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create schedule");
      }
      return api.schedules.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.schedules.list.path] });
      toast({
        title: "Success",
        description: "Schedule saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.schedules.delete.path, { id });
      const res = await fetch(url, {
        method: api.schedules.delete.method,
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete schedule");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.schedules.list.path] });
      toast({
        title: "Deleted",
        description: "Schedule removed successfully",
      });
    },
  });
}
