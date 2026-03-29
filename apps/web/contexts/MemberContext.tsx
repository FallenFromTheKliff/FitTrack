"use client";
import { createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminMembersQueryOptions,
  createStaffMutationOptions,
  deleteUserMutationOptions,
  queryKeys
} from "@fittrack/query";
import { createMemberController } from "@fittrack/app-core";
import type { MemberRecord, IMemberContext, CreateStaffInput } from "@fittrack/types";
import { webApiClient } from "@/lib/api-client";

const MemberContext = createContext<IMemberContext | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const controller = useMemo(() => createMemberController(), []);

  const {
    data: members = [],
    isLoading,
    error: queryError
  } = useQuery(adminMembersQueryOptions(webApiClient));

  const error = queryError ? controller.toMessage(queryError, "Failed to fetch members.") : null;

  const fetchMembers = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.adminMembers() });
  }, [queryClient]);

  const createStaffMutation = useMutation(createStaffMutationOptions(webApiClient, queryClient));

  const createStaff = useCallback(async (input: CreateStaffInput) => {
    return controller.runAction(async () => {
      await createStaffMutation.mutateAsync(input);
    }, "Failed to create staff.");
  }, [controller, createStaffMutation]);

  const deleteUserMutation = useMutation(deleteUserMutationOptions(webApiClient, queryClient));

  const deleteUser = useCallback(async (id: string) => {
    return controller.runAction(async () => {
      await deleteUserMutation.mutateAsync(id);
    }, "Failed to delete user.");
  }, [controller, deleteUserMutation]);

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
