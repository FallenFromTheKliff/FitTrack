"use client";
import { createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminMembersQueryOptions,
  createUserMutationOptions,
  deleteUserMutationOptions,
  invalidateAdminMembersQuery,
  restoreUserMutationOptions,
  updateAdminMemberMutationOptions
} from "@fittrack/query";
import { createMemberController } from "@fittrack/app-core";
import type { IMemberContext, CreateUserInput, UpdateMemberInput } from "@fittrack/types";
import { webApiClient } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";

const MemberContext = createContext<IMemberContext | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const controller = useMemo(() => createMemberController(), []);

  const {
    data: members = [],
    isLoading,
    error: queryError
  } = useQuery({
    ...adminMembersQueryOptions(webApiClient),
    enabled: isAdmin
  });

  const error = isAdmin && queryError
    ? controller.toMessage(queryError, "Failed to fetch members.")
    : null;

  const fetchMembers = useCallback(async () => {
    await invalidateAdminMembersQuery(queryClient);
  }, [queryClient]);

  const createUserMutation = useMutation(createUserMutationOptions(webApiClient, queryClient));

  const createUser = useCallback(async (input: CreateUserInput) => {
    return controller.runAction(async () => {
      await createUserMutation.mutateAsync(input);
    }, "Failed to create user.");
  }, [controller, createUserMutation]);

  const updateMemberMutation = useMutation(updateAdminMemberMutationOptions(webApiClient, queryClient));

  const updateMember = useCallback(async (input: UpdateMemberInput) => {
    return controller.runAction(async () => {
      await updateMemberMutation.mutateAsync({
        id: input.id,
        payload: {
          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
          ...(input.activityLevel !== undefined ? { activityLevel: input.activityLevel } : {}),
          ...(input.fitnessGoal !== undefined ? { fitnessGoal: input.fitnessGoal } : {}),
          ...(input.currentWeightKg !== undefined ? { currentWeightKg: input.currentWeightKg } : {}),
          ...(input.heightCm !== undefined ? { heightCm: input.heightCm } : {})
        }
      });
    }, "Failed to update member.");
  }, [controller, updateMemberMutation]);

  const deleteUserMutation = useMutation(deleteUserMutationOptions(webApiClient, queryClient));

  const deleteUser = useCallback(async (id: string) => {
    return controller.runAction(async () => {
      await deleteUserMutation.mutateAsync(id);
    }, "Failed to delete user.");
  }, [controller, deleteUserMutation]);

  const restoreUserMutation = useMutation(restoreUserMutationOptions(webApiClient, queryClient));

  const restoreUser = useCallback(async (id: string) => {
    return controller.runAction(async () => {
      await restoreUserMutation.mutateAsync(id);
    }, "Failed to restore user.");
  }, [controller, restoreUserMutation]);

  return (
    <MemberContext.Provider value={{ members, isLoading, error, fetchMembers, createUser, updateMember, deleteUser, restoreUser }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMembers(): IMemberContext {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMembers must be used inside <MemberProvider>");
  return ctx;
}
