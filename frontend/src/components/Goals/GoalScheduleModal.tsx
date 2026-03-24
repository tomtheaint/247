import { useState } from "react";
import { Modal } from "../UI/Modal";
import { Button } from "../UI/Button";
import type { Goal } from "../../types";
import { clsx } from "clsx";
import { client } from "../../api/client";
import { toast } from "react-hot-toast";
import { useEventStore } from "../../store/eventStore";

interface Props {
  open: boolean;
  onClose: () => void;
  goal: Goal;
}

type Pace = "slow" | "medium" | "fast";
type DayPref = "weekdays" | "weekends" | "both";
type TimePref = "morning" | "afternoon" | "evening";

const PACE_CONFIG: Record<Pace, { label: string; desc: string; hoursPerWeek: number; color: string; icon: string }> = {
  slow:   { label: "Slow",   desc: "1–3 hrs / week",  hoursPerWeek: 2, color: "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",  icon: "🌱" },
  medium: { label: "Medium", desc: "3–5 hrs / week",  hoursPerWeek: 4, color: "border-brand-400 bg-brand-50 dark:bg-brand-900/20",        icon: "🚀" },
  fast:   { label: "Fast",   desc: "5+ hrs / week",   hoursPerWeek: 6, color: "border-orange-400 bg-orange-50 dark:bg-orange-900/20",      icon: "⚡" },
};

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hrs", value: 90 },
  { label: "2 hours", value: 120 },
];

const DAY_OPTIONS: { label: string; value: DayPref; sub: string }[] = [
  { label: "Weekdays",  value: "weekdays", sub: "Mon – Fri" },
  { label: "Weekends",  value: "weekends", sub: "Sat – Sun" },
  { label: "Any day",   value: "both",     sub: "Mon – Sun" },
];

const TIME_OPTIONS: { label: string; value: TimePref; sub: string }[] = [
  { label: "Morning",   value: "morning",   sub: "6 am – 12 pm" },
  { label: "Afternoon", value: "afternoon", sub: "12 pm – 5 pm" },
  { label: "Evening",   value: "evening",   sub: "5 pm – 10 pm" },
];

function OptionButton<T extends string>({
  value, selected, onClick, label, sub, extraClass,
}: {
  value: T; selected: boolean; onClick: (v: T) => void;
  label: string; sub?: string; extraClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={clsx(
        "flex-1 rounded-xl border-2 p-3 text-left transition-all",
        selected
          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
        extraClass
      )}
    >
      <div className="text-sm font-semibold">{label}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </button>
  );
}

export function GoalScheduleModal({ open, onClose, goal }: Props) {
  const [pace, setPace] = useState<Pace>("medium");
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState<DayPref>("weekdays");
  const [time, setTime] = useState<TimePref>("evening");
  const [weeks, setWeeks] = useState(2);
  const [customWeeks, setCustomWeeks] = useState(true);
  const [customWeeksInput, setCustomWeeksInput] = useState("2");
  const [scheduleMode, setScheduleMode] = useState<"pace" | "timesPerWeek">("pace");
  const [timesPerWeek, setTimesPerWeek] = useState(3);
  const [loading, setLoading] = useState(false);
  const { fetch: fetchEvents } = useEventStore();

  const sessionsPerWeek = scheduleMode === "timesPerWeek"
    ? timesPerWeek
    : Math.round((PACE_CONFIG[pace].hoursPerWeek * 60) / duration);
  const totalSessions = sessionsPerWeek * weeks;

  const handleSchedule = async () => {
    setLoading(true);
    try {
      const { data } = await client.post("/scheduling/goal", {
        goalId: goal.id,
        ...(scheduleMode === "pace" ? { pace } : { timesPerWeek }),
        eventLengthMinutes: duration,
        days,
        timeOfDay: time,
        weeks,
        tzOffset: new Date().getTimezoneOffset(),
      });
      toast.success(`Scheduled ${data.created} sessions on your calendar!`);
      await fetchEvents();
      onClose();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Scheduling failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Schedule: ${goal.title}`} size="lg">
      <div className="space-y-6">

        {/* Schedule mode toggle */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Scheduling method</p>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setScheduleMode("pace")}
              className={clsx(
                "flex-1 py-2 text-sm font-medium transition-colors",
                scheduleMode === "pace"
                  ? "bg-brand-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
              )}
            >
              Pace
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode("timesPerWeek")}
              className={clsx(
                "flex-1 py-2 text-sm font-medium transition-colors",
                scheduleMode === "timesPerWeek"
                  ? "bg-brand-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
              )}
            >
              Times / week
            </button>
          </div>
        </div>

        {scheduleMode === "pace" ? (
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Pace</p>
            <div className="flex gap-2">
              {(Object.entries(PACE_CONFIG) as [Pace, typeof PACE_CONFIG[Pace]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPace(key)}
                  className={clsx(
                    "flex-1 rounded-xl border-2 p-3 text-center transition-all",
                    pace === key
                      ? `border-2 ${cfg.color} font-semibold`
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  )}
                >
                  <div className="text-xl mb-1">{cfg.icon}</div>
                  <div className="text-sm font-bold">{cfg.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{cfg.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Times per week</p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTimesPerWeek(n)}
                  className={clsx(
                    "w-12 h-12 rounded-xl border-2 text-sm font-bold transition-all",
                    timesPerWeek === n
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                  )}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Event length */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Session length</p>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDuration(opt.value)}
                className={clsx(
                  "flex-1 rounded-xl border-2 py-2 text-sm font-medium transition-all",
                  duration === opt.value
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Days */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Which days?</p>
          <div className="flex gap-2">
            {DAY_OPTIONS.map((opt) => (
              <OptionButton key={opt.value} value={opt.value} selected={days === opt.value}
                onClick={setDays} label={opt.label} sub={opt.sub} />
            ))}
          </div>
        </div>

        {/* Time of day */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Time of day</p>
          <div className="flex gap-2">
            {TIME_OPTIONS.map((opt) => (
              <OptionButton key={opt.value} value={opt.value} selected={time === opt.value}
                onClick={setTime} label={opt.label} sub={opt.sub} />
            ))}
          </div>
        </div>

        {/* Duration in weeks */}
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Schedule for how many weeks?
          </p>
          <div className="flex gap-2">
            {[4, 8, 12, 16].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => { setWeeks(w); setCustomWeeks(false); }}
                className={clsx(
                  "flex-1 rounded-xl border-2 py-2 text-sm font-medium transition-all",
                  !customWeeks && weeks === w
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                )}
              >
                {w}w
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setCustomWeeks(true); setCustomWeeksInput(String(weeks)); }}
              className={clsx(
                "flex-1 rounded-xl border-2 py-2 text-sm font-medium transition-all",
                customWeeks
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
              )}
            >
              Custom
            </button>
          </div>
          {customWeeks && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={52}
                value={customWeeksInput}
                onChange={(e) => {
                  setCustomWeeksInput(e.target.value);
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 52) setWeeks(v);
                }}
                className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-center outline-none focus:border-brand-500 dark:text-white"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">weeks (1–52)</span>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-4 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-900 dark:text-white">
            {sessionsPerWeek}× {duration} min
          </span>{" "}
          sessions per week × {weeks} weeks ={" "}
          <span className="font-semibold text-brand-600">{totalSessions} sessions</span> added to your calendar.
          Placed in {time} slots on {days === "both" ? "any day" : days}.
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSchedule} loading={loading} className="flex-1">
            Schedule Sessions
          </Button>
        </div>
      </div>
    </Modal>
  );
}
