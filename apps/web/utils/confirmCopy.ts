export type ConfirmCopy = {
  confirmLabel: string;
  loadingLabel?: string;
};

export const CONFIRM_COPY = {
  logout: {
    confirmLabel: "SIGN OUT",
    loadingLabel: "SIGNING OUT"
  },
  deleteUser: {
    confirmLabel: "DELETE USER",
    loadingLabel: "DELETING USER"
  },
  terminateAccount: {
    confirmLabel: "TERMINATE ACCOUNT",
    loadingLabel: "TERMINATING ACCOUNT"
  },
  sensitiveLogout: {
    confirmLabel: "SIGN OUT",
    loadingLabel: "SIGNING OUT"
  },
  saveAndExit: {
    confirmLabel: "SAVE & EXIT"
  }
} as const satisfies Record<string, ConfirmCopy>;
