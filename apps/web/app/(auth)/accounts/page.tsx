import type { Metadata } from "next";

import AccountsCreateSurface from "@/components/accounts/AccountsCreateSurface";
import AccountsDirectorySurface from "@/components/accounts/AccountsDirectorySurface";
import AccountsModalLayer from "@/components/accounts/AccountsModalLayer";
import { AccountsPageProvider } from "@/components/accounts/AccountsPageContext";
import AccountsPageFrame from "@/components/accounts/AccountsPageFrame";
import AccountsResponsiveStyles from "@/components/accounts/AccountsResponsiveStyles";

export const dynamic = "force-dynamic";

const ACCOUNTS_ROUTE = {
  title: "Accounts | FitTrack",
  description: "Manage FitTrack member, coach, staff, and admin accounts.",
};

export const metadata: Metadata = {
  title: ACCOUNTS_ROUTE.title,
  description: ACCOUNTS_ROUTE.description,
};

export default function AccountsPage() {
  return (
    <AccountsPageProvider>
      <AccountsPageFrame>
        <AccountsCreateSurface />
        <AccountsDirectorySurface />
        <AccountsModalLayer />
        <AccountsResponsiveStyles />
      </AccountsPageFrame>
    </AccountsPageProvider>
  );
}
