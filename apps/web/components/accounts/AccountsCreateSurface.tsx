"use client";

import AddUserPanel from "@/components/accounts/AddUserPanel";
import FitModal from "@/components/modals/FitModal";
import { UserPlus } from "lucide-react";

import { useAccountsPage } from "./AccountsPageContext";

export default function AccountsCreateSurface() {
  const { addLoading, addLoadingLabel, handleAdd, isCreateMode, members, setContentMode } =
    useAccountsPage();

  if (!isCreateMode) return null;

  return (
    <FitModal
      isOpen={isCreateMode}
      onClose={() => setContentMode("directory")}
      title="Create Account"
      subtitle="Create a real account through the live account API."
      icon={UserPlus}
      maxWidth={1180}
      hideFooterDivider
    >
      <div
        key="create"
        className="members-create-shell"
        style={{
          width: "100%",
          maxWidth: "none",
          margin: 0,
          height: "100%",
          minHeight: 0,
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
    </FitModal>
  );
}
