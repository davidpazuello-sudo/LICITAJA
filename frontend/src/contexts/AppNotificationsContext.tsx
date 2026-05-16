import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

type NotificationVariant = "success" | "error";

type NotificationAction = {
  label: string;
  to?: string;
  href?: string;
};

type AppNotification = {
  id: string;
  title: string;
  message: string;
  variant: NotificationVariant;
  action?: NotificationAction;
};

type NotifyInput = {
  title: string;
  message: string;
  action?: NotificationAction;
};

type AppNotificationsContextValue = {
  notifications: AppNotification[];
  notificationCount: number;
  notifySuccess: (input: NotifyInput) => void;
  notifyError: (input: NotifyInput) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
};

const AppNotificationsContext = createContext<AppNotificationsContextValue | null>(null);

function AppNotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const pushNotification = useCallback((variant: NotificationVariant, input: NotifyInput) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setNotifications((current) => [
      {
        id,
        title: input.title,
        message: input.message,
        variant,
        action: input.action,
      },
      ...current,
    ].slice(0, 4));

    const timeout = window.setTimeout(() => {
      removeNotification(id);
    }, variant === "success" ? 5500 : 7500);

    return () => window.clearTimeout(timeout);
  }, [removeNotification]);

  const notifySuccess = useCallback((input: NotifyInput) => {
    pushNotification("success", input);
  }, [pushNotification]);

  const notifyError = useCallback((input: NotifyInput) => {
    pushNotification("error", input);
  }, [pushNotification]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = useMemo<AppNotificationsContextValue>(() => ({
    notifications,
    notificationCount: notifications.length,
    notifySuccess,
    notifyError,
    removeNotification,
    clearNotifications,
  }), [clearNotifications, notifications, notifyError, notifySuccess, removeNotification]);

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}
      <AppNotificationsViewport
        notifications={notifications}
        onClose={removeNotification}
      />
    </AppNotificationsContext.Provider>
  );
}

function AppNotificationsViewport({
  notifications,
  onClose,
}: {
  notifications: AppNotification[];
  onClose: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed right-4 top-[86px] z-[70] flex w-[min(420px,calc(100vw-32px))] flex-col gap-3 sm:right-6 lg:right-8">
      {notifications.map((notification) => (
        <AppNotificationCard key={notification.id} notification={notification} onClose={onClose} />
      ))}
    </div>
  );
}

function AppNotificationCard({
  notification,
  onClose,
}: {
  notification: AppNotification;
  onClose: (id: string) => void;
}) {
  const isSuccess = notification.variant === "success";
  const accentClasses = isSuccess
    ? "border-emerald-200 bg-[linear-gradient(180deg,#F8FFFB_0%,#EEFCF3_100%)] shadow-[0_18px_42px_rgba(16,185,129,0.16)]"
    : "border-rose-200 bg-[linear-gradient(180deg,#FFF9FA_0%,#FFF0F2_100%)] shadow-[0_18px_42px_rgba(244,63,94,0.14)]";
  const iconClasses = isSuccess ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
  const badgeClasses = isSuccess
    ? "bg-emerald-100 text-emerald-700"
    : "bg-rose-100 text-rose-700";
  const actionClasses = isSuccess
    ? "bg-emerald-600 text-white hover:bg-emerald-700"
    : "bg-rose-600 text-white hover:bg-rose-700";

  return (
    <div className={`pointer-events-auto rounded-[22px] border p-4 backdrop-blur ${accentClasses}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${iconClasses}`}>
          {isSuccess ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="m5 12 4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
              <path d="M12 8v5m0 3h.01M10.3 3.84 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.7 3.84a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`inline-flex rounded-full px-2.5 py-1 font-["DM_Mono"] text-[10px] uppercase tracking-[0.16em] ${badgeClasses}`}>
                {isSuccess ? "Concluido" : "Falha"}
              </span>
              <h3 className='mt-2 font-["DM_Sans"] text-[16px] font-semibold leading-tight text-[#0F1724]'>
                {notification.title}
              </h3>
            </div>

            <button
              type="button"
              aria-label="Fechar notificacao"
              onClick={() => onClose(notification.id)}
              className='inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[#7A869A] transition hover:text-[#0F1724]'
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p className='mt-2 font-["DM_Sans"] text-[13px] leading-[1.65] text-[#5A6478]'>
            {notification.message}
          </p>

          {notification.action ? (
            <div className="mt-4">
              {notification.action.to ? (
                <Link
                  to={notification.action.to}
                  className={`inline-flex items-center justify-center rounded-[14px] px-4 py-2.5 font-["DM_Sans"] text-[13px] font-semibold transition ${actionClasses}`}
                >
                  {notification.action.label}
                </Link>
              ) : notification.action.href ? (
                <a
                  href={notification.action.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex items-center justify-center rounded-[14px] px-4 py-2.5 font-["DM_Sans"] text-[13px] font-semibold transition ${actionClasses}`}
                >
                  {notification.action.label}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function useAppNotifications() {
  const context = useContext(AppNotificationsContext);
  if (!context) {
    throw new Error("useAppNotifications deve ser usado dentro de AppNotificationsProvider.");
  }
  return context;
}

export { AppNotificationsProvider, useAppNotifications };
