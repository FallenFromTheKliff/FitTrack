"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { api } from "@/lib/axios";
import { queryKeys } from "@fittrack/query";
import type { MemberRecord, IMemberContext, CreateStaffInput } from "@fittrack/types";

const MemberContext = createContext<IMemberContext | null>(null);

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (Array.isArray(data?.message)) return data.message.join(" ");
    if (typeof data?.message === "string") return data.message;
  }
  return fallback;
}

export function MemberProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading,
    error: queryError
  } = useQuery<MemberRecord[]>({
    queryKey: queryKeys.adminMembers(),
    queryFn: async () => {
      const { data } = await api.get<MemberRecord[]>("/admin/users");
      return data;
    }
  });

  const error = queryError ? toMessage(queryError, "Failed to fetch members.") : null;

  const fetchMembers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() });
  }, [queryClient]);

  const createStaffMutation = useMutation({
    mutationFn: async (input: CreateStaffInput) => {
      await api.post("/admin/create-staff", input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() });
    }
  });

  const createStaff = useCallback(async (input: CreateStaffInput) => {
    try {
      await createStaffMutation.mutateAsync(input);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: toMessage(err, "Failed to create staff.") };
    }
  }, [createStaffMutation]);

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<MemberRecord[]>(queryKeys.adminMembers(), (prev) =>
        prev ? prev.filter((m) => m.id !== id) : []
      );
    }
  });

  const deleteUser = useCallback(async (id: string) => {
    try {
      await deleteUserMutation.mutateAsync(id);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: toMessage(err, "Failed to delete user.") };
    }
  }, [deleteUserMutation]);

  return (
    <MemberContext.Provider value={{ members, isLoading, error, fetchMembers, createStaff, deleteUser }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMembers(): IMemberContext {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMembers must be used inside <MemberProvider>");
  return ctx;
}