"use client";

import AddUserPanel from "@/components/accounts/AddUserPanel";

import { useAccountsPage } from "./AccountsPageContext";

export default function AccountsCreateSurface() {
  const { addLoading, addLoadingLabel, handleAdd, isCreateMode, members, setContentMode } =
    useAccountsPage();

  if (!isCreateMode) return null;

  return (
    <div
      key="create"
      className="members-create-shell"
      style={{
        width: "100%",
        maxWidth: "none",
        margin: 0,
      }}
    >
      <AddUserPanel
        existingAccounts={members}
        isLoading={addLoading}
        loadingLabel={addLoadingLabel}
        onBack={() => setContentMode("directory")}
        onSubmit={handleAdd}
      />
    </div>
  );
}
