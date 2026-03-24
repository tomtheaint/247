import { useEffect, useState, type FC } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { toast } from "react-hot-toast";
import { integrationsApi, type Integration } from "../api/integrations";
import { usersApi, type UserPreferences } from "../api/users";
import { eventsApi } from "../api/events";
import { Button } from "../components/UI/Button";
import { Input } from "../components/UI/Input";
import { clsx } from "clsx";

function IntegrationCard({
  name,
  icon,
  description,
  connected,
  connectedEmail,
  onConnect,
  onSync,
  onDisconnect,
  isConfigured,
}: {
  name: string;
  icon: React.ReactNode;
  description: string;
  connected: boolean;
  connectedEmail?: string;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  isConfigured: boolean;
}) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await onSync();
    setSyncing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-2xl">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
            {connected && connectedEmail && (
              <p className="text-xs text-brand-600 mt-1">Connected as {connectedEmail}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connected ? (
            <>
              <Button variant="secondary" size="sm" onClick={handleSync} loading={syncing}>
                Sync now
              </Button>
              <Button variant="danger" size="sm" onClick={onDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={onConnect}
              disabled={!isConfigured}
              title={!isConfigured ? "Set up credentials in backend .env first" : undefined}
            >
              Connect
            </Button>
          )}
        </div>
      </div>

      {!isConfigured && (
        <div className="mt-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3 text-xs text-amber-700 dark:text-amber-300">
          Credentials not configured. Add the API keys to your backend <code className="font-mono">.env</code> file to enable this integration.
        </div>
      )}
    </div>
  );
}

const TIMEZONE_OPTIONS = [
  { value: "America/New_York",    label: "Eastern (ET)  — UTC−5/−4" },
  { value: "America/Chicago",     label: "Central (CT)  — UTC−6/−5" },
  { value: "America/Denver",      label: "Mountain (MT) — UTC−7/−6" },
  { value: "America/Los_Angeles", label: "Pacific (PT)  — UTC−8/−7" },
  { value: "America/Anchorage",   label: "Alaska (AKT)  — UTC−9/−8" },
  { value: "Pacific/Honolulu",    label: "Hawaii (HT)   — UTC−10" },
  { value: "Europe/London",       label: "London (GMT/BST)" },
  { value: "Europe/Paris",        label: "Central Europe (CET/CEST)" },
  { value: "Asia/Tokyo",          label: "Japan (JST)   — UTC+9" },
  { value: "Australia/Sydney",    label: "Sydney (AEST) — UTC+10/+11" },
];

const CHRONOTYPE_OPTIONS = [
  { value: "EARLY_BIRD", label: "🌅 Early Bird", desc: "Prefers morning hours (6 am – 12 pm)" },
  { value: "MID_DAY",    label: "☀️ Mid Day",    desc: "Prefers midday hours (10 am – 4 pm)" },
  { value: "NIGHT_OWL",  label: "🦉 Night Owl",  desc: "Prefers evening hours (6 pm – 10 pm)" },
] as const;

function PreferencesForm() {
  const { register, handleSubmit, reset, watch, setValue, control, formState: { isSubmitting } } = useForm<UserPreferences>();
  const chronotype = watch("chronotype");

  useEffect(() => {
    usersApi.getMe().then((u) => reset({
      displayName:      u.displayName,
      wakeTimeWeekday:  (u as unknown as Record<string, string>).wakeTimeWeekday  ?? "07:00",
      sleepTimeWeekday: (u as unknown as Record<string, string>).sleepTimeWeekday ?? "23:00",
      wakeTimeWeekend:  (u as unknown as Record<string, string>).wakeTimeWeekend  ?? "08:00",
      sleepTimeWeekend: (u as unknown as Record<string, string>).sleepTimeWeekend ?? "23:00",
      chronotype:       ((u as unknown as Record<string, string>).chronotype as UserPreferences["chronotype"]) ?? "MID_DAY",
      showHolidays: (u as unknown as Record<string, unknown>).showHolidays !== false,
      timezone: (u as unknown as Record<string, string>).timezone ?? "America/New_York",
    })).catch(() => {});
  }, [reset]);

  const onSubmit = async (data: UserPreferences) => {
    try {
      await usersApi.updateMe(data);
      toast.success("Preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Chronotype */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">My chronotype</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          The app uses this to schedule goal sessions at your most productive time.
        </p>
        <div className="flex gap-3">
          {CHRONOTYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue("chronotype", opt.value)}
              className={clsx(
                "flex-1 rounded-xl border-2 p-4 text-left transition-all",
                chronotype === opt.value
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              )}
            >
              <div className="text-lg font-semibold mb-1">{opt.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Weekday schedule */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Weekday schedule</p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Wake time" type="time" {...register("wakeTimeWeekday")} />
          <Input label="Sleep time" type="time" {...register("sleepTimeWeekday")} />
        </div>
      </div>

      {/* Weekend schedule */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Weekend schedule</p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Wake time" type="time" {...register("wakeTimeWeekend")} />
          <Input label="Sleep time" type="time" {...register("sleepTimeWeekend")} />
        </div>
      </div>

      {/* Timezone */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Timezone</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Used to place scheduled sessions at the correct local time.
        </p>
        <select
          {...register("timezone")}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-brand-500"
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
      </div>

      {/* Calendar display */}
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Calendar display</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <Controller
            name={"showHolidays" as never}
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!(field.value ?? true))}
                className={clsx(
                  "relative w-10 h-6 rounded-full transition-colors",
                  (field.value ?? true) ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"
                )}
              >
                <span
                  className={clsx(
                    "absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    (field.value ?? true) ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            )}
          />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Show national holidays</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Display US federal holidays as all-day events on the calendar</p>
          </div>
        </label>
      </div>

      <Button type="submit" loading={isSubmitting}>Save preferences</Button>
    </form>
  );
}

export function SettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [configured, setConfigured] = useState({ google: false, microsoft: false });
  const [searchParams] = useSearchParams();
  const [confirmClearEvents, setConfirmClearEvents] = useState(false);
  const [clearingEvents, setClearingEvents] = useState(false);

  const loadIntegrations = async () => {
    try {
      const data = await integrationsApi.list();
      setIntegrations(data);
    } catch {
      // not critical
    }
  };

  // Check which integrations are configured (auth-url endpoint returns 501 if not)
  const checkConfigured = async () => {
    const check = async (provider: "google" | "microsoft") => {
      try {
        if (provider === "google") await integrationsApi.getGoogleAuthUrl();
        else await integrationsApi.getMicrosoftAuthUrl();
        return true;
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        return status !== 501;
      }
    };
    const [g, m] = await Promise.all([check("google"), check("microsoft")]);
    setConfigured({ google: g, microsoft: m });
  };

  useEffect(() => {
    loadIntegrations();
    checkConfigured();

    const connected = searchParams.get("connected");
    if (connected === "google") toast.success("Google Calendar connected!");
    if (connected === "microsoft") toast.success("Microsoft 365 connected!");
  }, [searchParams]);

  const connect = async (provider: "google" | "microsoft") => {
    try {
      const url =
        provider === "google"
          ? await integrationsApi.getGoogleAuthUrl()
          : await integrationsApi.getMicrosoftAuthUrl();
      window.location.href = url;
    } catch {
      toast.error("Failed to get auth URL");
    }
  };

  const sync = async (provider: "google" | "microsoft") => {
    try {
      const result =
        provider === "google"
          ? await integrationsApi.syncGoogle()
          : await integrationsApi.syncMicrosoft();
      toast.success(`Synced ${result.synced} events from ${provider === "google" ? "Google" : "Microsoft"} Calendar`);
      await loadIntegrations();
    } catch {
      toast.error("Sync failed");
    }
  };

  const handleClearAllEvents = async () => {
    setClearingEvents(true);
    try {
      const { deleted } = await eventsApi.deleteAll();
      toast.success(`Deleted ${deleted} event${deleted !== 1 ? "s" : ""}`);
      setConfirmClearEvents(false);
    } catch {
      toast.error("Failed to clear events");
    } finally {
      setClearingEvents(false);
    }
  };

  const disconnect = async (provider: string) => {
    if (!confirm(`Disconnect ${provider}?`)) return;
    await integrationsApi.disconnect(provider);
    toast.success("Disconnected");
    await loadIntegrations();
  };

  const googleIntegration = integrations.find((i) => i.provider === "google");
  const msIntegration = integrations.find((i) => i.provider === "microsoft");

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage integrations and preferences</p>
      </div>

      {/* Schedule Preferences */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">Schedule Preferences</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Used by the auto-scheduler to place goal sessions at the right time for you.
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <PreferencesForm />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">Calendar Integrations</h2>
        <div className="space-y-4">
          <IntegrationCard
            name="Google Calendar"
            icon="📅"
            description="Import and sync events from Google Calendar"
            connected={!!googleIntegration}
            connectedEmail={googleIntegration?.email}
            isConfigured={configured.google}
            onConnect={() => connect("google")}
            onSync={() => sync("google")}
            onDisconnect={() => disconnect("google")}
          />
          <IntegrationCard
            name="Microsoft 365"
            icon="📆"
            description="Import and sync events from Outlook / Microsoft 365"
            connected={!!msIntegration}
            connectedEmail={msIntegration?.email}
            isConfigured={configured.microsoft}
            onConnect={() => connect("microsoft")}
            onSync={() => sync("microsoft")}
            onDisconnect={() => disconnect("microsoft")}
          />
        </div>

        <div className="mt-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-5 text-sm text-gray-600 dark:text-gray-400">

          <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Setting up integrations</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>
              <strong>Google:</strong> Create a project at{" "}
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">console.cloud.google.com</span>,
              enable the Calendar API, create OAuth credentials, and add{" "}
              <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code> &{" "}
              <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code> to your backend <code>.env</code>.
            </li>
            <li>
              <strong>Microsoft:</strong> Register an app at{" "}
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">portal.azure.com</span>,
              add <code className="font-mono text-xs">Calendars.ReadWrite</code> permissions, and add{" "}
              <code className="font-mono text-xs">MS_CLIENT_ID</code> &{" "}
              <code className="font-mono text-xs">MS_CLIENT_SECRET</code> to your backend <code>.env</code>.
            </li>
          </ol>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Destructive actions that cannot be undone.</p>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 shadow-sm divide-y divide-red-100 dark:divide-red-900">
          <div className="flex items-center justify-between p-5 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Clear all events</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Permanently delete every event — recurring and one-off — from your calendar.
              </p>
            </div>
            <Button variant="danger" size="sm" onClick={() => setConfirmClearEvents(true)}>
              Clear events
            </Button>
          </div>
        </div>
      </section>

      {/* Clear events confirmation modal */}
      {confirmClearEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clear all events?</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This will permanently delete <strong className="text-gray-800 dark:text-gray-200">all events</strong> on your calendar — including recurring events and their entire chains. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmClearEvents(false)}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" loading={clearingEvents} onClick={handleClearAllEvents}>
                Yes, delete all
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
