"use client";
import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminMembersQueryOptions,
  createStaffMutationOptions,
  deleteUserMutationOptions,
  queryKeys
} from "@fittrack/query";
import type { MemberRecord, IMemberContext, CreateStaffInput } from "@fittrack/types";
import { webApiClient } from "@/lib/api-client";

const MemberContext = createContext<IMemberContext | null>(null);

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export function MemberProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: members = [],
    isLoading,
    error: queryError
  } = useQuery(adminMembersQueryOptions(webApiClient));

  const error = queryError ? toMessage(queryError, "Failed to fetch members.") : null;

  const fetchMembers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() });
  }, [queryClient]);

  const createStaffMutation = useMutation(createStaffMutationOptions(webApiClient, queryClient));

  const createStaff = useCallback(async (input: CreateStaffInput) => {
    try {
      await createStaffMutation.mutateAsync(input);
      return { success: true as const };
    } catch (err: unknown) {
      return { success: false as const, error: toMessage(err, "Failed to create staff.") };
    }
  }, [createStaffMutation]);

  const deleteUserMutation = useMutation(deleteUserMutationOptions(webApiClient, queryClient));

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
