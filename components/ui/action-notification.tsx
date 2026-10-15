"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CircleAlert, CheckCircle2, X } from "lucide-react";

type NotificationVariant = "success" | "error";

interface NotificationItem {
  id: string;
  key: string;
  message: string;
  count: number;
  variant: NotificationVariant;
}

interface NotifyOptions {
  key?: string;
  variant?: NotificationVariant;
}

interface ActionNotificationContextValue {
  notify: (message: string, options?: NotifyOptions) => void;
}

const ActionNotificationContext = createContext<
  ActionNotificationContextValue | undefined
>(undefined);

const notificationDuration = 1800;

export function ActionNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const nextIdRef = useRef(0);

  const notify = useCallback((message: string, options: NotifyOptions = {}) => {
    const key = options.key ?? message;
    const variant = options.variant ?? "success";
    const existingTimer = timersRef.current.get(key);
    if (existingTimer) window.clearTimeout(existingTimer);

    setNotifications((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) =>
          item.key === key
            ? { ...item, count: item.count + 1, variant }
            : item,
        );
      }

      return [
        ...current,
        {
          id: `${key}-${nextIdRef.current++}`,
          key,
          message,
          count: 1,
          variant,
        },
      ];
    });

    const timer = window.setTimeout(() => {
      setNotifications((current) =>
        current.filter((notification) => notification.key !== key),
      );
      timersRef.current.delete(key);
    }, notificationDuration);
    timersRef.current.set(key, timer);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  return (
    <ActionNotificationContext.Provider value={{ notify }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[200] flex justify-center px-4"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex w-fit max-w-[calc(100vw-2rem)] flex-col gap-2">
          {notifications.map((notification) => (
            <div
              key={`${notification.id}-${notification.count}`}
              role={notification.variant === "error" ? "alert" : "status"}
              className={`action-notification pointer-events-auto flex w-fit max-w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${notification.variant === "error" ? "border-rose-200 bg-rose-50 text-rose-700 shadow-rose-950/10" : "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-950/10"}`}
            >
              {notification.variant === "error" ? (
                <CircleAlert className="size-4 shrink-0" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1">
                {notification.message}
                {notification.count > 1 ? ` (${notification.count})` : ""}
              </span>
              <button
                type="button"
                className={`shrink-0 transition ${notification.variant === "error" ? "text-rose-600 hover:text-rose-900" : "text-emerald-600 hover:text-emerald-900"}`}
                aria-label="Đóng thông báo"
                onClick={() => {
                  const timer = timersRef.current.get(notification.key);
                  if (timer) window.clearTimeout(timer);
                  timersRef.current.delete(notification.key);
                  setNotifications((current) =>
                    current.filter((item) => item.key !== notification.key),
                  );
                }}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ActionNotificationContext.Provider>
  );
}

export function useActionNotification(): ActionNotificationContextValue {
  const context = useContext(ActionNotificationContext);
  if (!context) {
    throw new Error(
      "useActionNotification must be used within ActionNotificationProvider",
    );
  }
  return context;
}
