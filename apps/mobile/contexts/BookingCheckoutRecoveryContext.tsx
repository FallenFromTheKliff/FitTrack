import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";

import NoticeModal from "@/components/modals/shared/NoticeModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  createBookingCheckoutRecoveryScope,
  type BookingCheckoutIosNoticePresentation,
  type BookingCheckoutRecoveryScope,
  type BookingCheckoutTerminalNotice,
} from "./bookingCheckoutRecoveryScope";

type BookingCheckoutRecoveryContextValue = {
  scope: BookingCheckoutRecoveryScope;
  terminalNotice: BookingCheckoutTerminalNotice | null;
};

const BookingCheckoutRecoveryContext =
  createContext<BookingCheckoutRecoveryContextValue | null>(null);

type NoticeState = {
  notice: BookingCheckoutTerminalNotice;
  scope: BookingCheckoutRecoveryScope;
};

type IosPresentationState = {
  presentation: BookingCheckoutIosNoticePresentation;
  scope: BookingCheckoutRecoveryScope;
};

export function BookingCheckoutRecoveryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const sessionKey =
    isAuthenticated && user?.id ? String(user.id) : null;
  const [noticeState, setNoticeState] = useState<NoticeState | null>(null);
  const [iosPresentationState, setIosPresentationState] =
    useState<IosPresentationState | null>(null);
  const scopeRef = useRef<BookingCheckoutRecoveryScope | null>(null);

  if (scopeRef.current?.sessionKey !== sessionKey) {
    scopeRef.current?.dispose();
    scopeRef.current = createBookingCheckoutRecoveryScope(
      sessionKey,
      (scope, notice) => {
        if (!notice) {
          setNoticeState((current) =>
            current?.scope === scope ? null : current,
          );
          return;
        }
        setNoticeState({ notice, scope });
      },
      (scope, presentation) => {
        if (!presentation) {
          setIosPresentationState((current) =>
            current?.scope === scope ? null : current,
          );
          return;
        }
        setIosPresentationState({ presentation, scope });
      },
    );
    scopeRef.current.setIosAppActive(
      Platform.OS !== "ios" || AppState.currentState === "active",
    );
  }

  const scope = scopeRef.current;
  if (!scope) {
    throw new Error("BookingCheckoutRecoveryProvider could not create a scope");
  }

  useEffect(() => {
    setNoticeState((current) =>
      current?.scope === scope ? current : null,
    );
    setIosPresentationState((current) =>
      current?.scope === scope ? current : null,
    );
    return () => scope.dispose();
  }, [scope]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    scope.setIosAppActive(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (nextState) => {
      scope.setIosAppActive(nextState === "active");
    });
    return () => subscription.remove();
  }, [scope]);

  const activeNotice =
    noticeState?.scope === scope && !scope.disposed
      ? noticeState.notice
      : null;
  const activeIosPresentation =
    Platform.OS === "ios" &&
    iosPresentationState?.scope === scope &&
    !scope.disposed
      ? iosPresentationState.presentation
      : null;
  const terminalNotice =
    activeIosPresentation?.request ?? activeNotice;
  const contextValue = useMemo(
    () => ({ scope, terminalNotice }),
    [scope, terminalNotice],
  );

  return (
    <BookingCheckoutRecoveryContext.Provider value={contextValue}>
      {children}
      {activeIosPresentation ? (
        <NoticeModal
          isVisible={
            activeIosPresentation.phase === "presenting" ||
            activeIosPresentation.phase === "visible"
          }
          title={activeIosPresentation.request.title}
          message={activeIosPresentation.request.message}
          buttonLabel="Continue"
          onClose={scope.dismissIosNotice}
          onDismiss={() =>
            scope.acknowledgeIosNoticeDismissed(activeIosPresentation.key)
          }
          onShow={() =>
            scope.acknowledgeIosNoticeShown(activeIosPresentation.key)
          }
        />
      ) : activeNotice ? (
        <NoticeModal
          isVisible
          title={activeNotice.title}
          message={activeNotice.message}
          buttonLabel="Continue"
          onClose={scope.dismissNotice}
        />
      ) : null}
    </BookingCheckoutRecoveryContext.Provider>
  );
}

export function useBookingCheckoutRecoveryScope() {
  return useContext(BookingCheckoutRecoveryContext)?.scope ?? null;
}

export function useBookingCheckoutRecoveryNotice() {
  return useContext(BookingCheckoutRecoveryContext)?.terminalNotice ?? null;
}
