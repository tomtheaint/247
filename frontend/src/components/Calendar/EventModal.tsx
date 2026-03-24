import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { format, addMinutes } from "date-fns";
import { Modal } from "../UI/Modal";
import { Button } from "../UI/Button";
import { Input } from "../UI/Input";
import type { CalendarEvent } from "../../types";
import { useGoalStore } from "../../store/goalStore";
import { clsx } from "clsx";

type RecurFreq = "none" | "daily" | "weekly" | "monthly";
type DaysFilter = "all" | "weekdays" | "weekends";
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Priority = "HIGH" | "NORMAL" | "LOW";

interface FormData {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  goalId: string;
  allDay: boolean;
  isLocked: boolean;
  priority: Priority;
  recurFreq: RecurFreq;
  recurInterval: number;
  recurDays: number[];
  recurDaysFilter: DaysFilter;
  recurEndDate: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CalendarEvent>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onSnooze?: (id: string) => Promise<void>;
  event?: CalendarEvent | null;
  defaultStart?: Date;
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  // Shift to local time so datetime-local input shows the correct local hour
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function EventModal({ open, onClose, onSave, onDelete, onSnooze, event, defaultStart }: Props) {
  const { goals } = useGoalStore();
  const [snoozing, setSnoozing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { recurFreq: "none", recurInterval: 1, recurDays: [], recurDaysFilter: "all", recurEndDate: "", isLocked: false, priority: "NORMAL" },
  });

  const startTime = watch("startTime");
  const recurFreq = watch("recurFreq");
  const recurDays = watch("recurDays");
  const recurDaysFilter = watch("recurDaysFilter");
  const isLocked = watch("isLocked");
  const priority = watch("priority");

  useEffect(() => {
    setConfirmingDelete(false);
    if (event) {
      const rec = event.recurrence as { freq?: string; interval?: number; daysOfWeek?: number[]; daysFilter?: DaysFilter; endDate?: string } | null;
      reset({
        title: event.title,
        description: event.description ?? "",
        startTime: toDatetimeLocal(event.startTime),
        endTime: toDatetimeLocal(event.endTime),
        goalId: event.goalId ?? "",
        allDay: event.allDay,
        isLocked: event.isLocked ?? false,
        priority: (event.priority as Priority) ?? "NORMAL",
        recurFreq: (rec?.freq as RecurFreq) ?? "none",
        recurInterval: rec?.interval ?? 1,
        recurDays: rec?.daysOfWeek ?? [],
        recurDaysFilter: rec?.daysFilter ?? "all",
        recurEndDate: rec?.endDate ?? "",
      });
    } else {
      const start = defaultStart ?? new Date();
      const end = addMinutes(start, 60);
      reset({
        title: "",
        description: "",
        startTime: format(start, "yyyy-MM-dd'T'HH:mm"),
        endTime: format(end, "yyyy-MM-dd'T'HH:mm"),
        goalId: "",
        allDay: false,
        isLocked: false,
        recurFreq: "none",
        recurInterval: 1,
        recurDays: [],
        recurDaysFilter: "all",
        recurEndDate: "",
      });
    }
  }, [event, defaultStart, reset]);

  // Quick duration: sets endTime relative to current startTime
  const setDuration = (minutes: number) => {
    if (!startTime) return;
    const start = new Date(startTime);
    setValue("endTime", format(addMinutes(start, minutes), "yyyy-MM-dd'T'HH:mm"));
  };

  const toggleDay = (day: number) => {
    const current = recurDays ?? [];
    setValue("recurDays", current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  };

  const onSubmit = async (data: FormData) => {
    const recurrence =
      data.recurFreq !== "none"
        ? {
            freq: data.recurFreq,
            interval: data.recurInterval,
            ...(data.recurFreq === "weekly" ? { daysOfWeek: data.recurDays } : {}),
            ...(data.recurFreq === "daily" && data.recurDaysFilter !== "all" ? { daysFilter: data.recurDaysFilter } : {}),
            ...(data.recurEndDate ? { endDate: data.recurEndDate } : {}),
          }
        : null;

    await onSave({
      title: data.title,
      description: data.description,
      startTime: new Date(data.startTime).toISOString(),
      endTime: new Date(data.endTime).toISOString(),
      allDay: data.allDay,
      isLocked: data.isLocked,
      priority: data.priority,
      goalId: data.goalId || undefined,
      isRecurring: data.recurFreq !== "none",
      recurrence,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={event ? "Edit Event" : "New Event"} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              label="Title"
              {...register("title", { required: "Title is required" })}
              error={errors.title?.message}
              placeholder="Event title"
            />
          </div>
          <button
            type="button"
            onClick={() => setValue("isLocked", !isLocked)}
            title={isLocked ? "Locked — optimizer won't move this event" : "Unlocked — optimizer can reschedule this event"}
            className={`mb-0.5 p-2.5 rounded-lg border transition-colors ${
              isLocked
                ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                : "border-gray-300 dark:border-gray-600 text-gray-400 hover:border-amber-400 hover:text-amber-500"
            }`}
          >
            <svg className="w-4 h-4" fill={isLocked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isLocked
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              }
            </svg>
          </button>
        </div>
        {isLocked && (
          <p className="text-xs text-amber-600 dark:text-amber-400 -mt-3 flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            This event is locked. The optimizer will schedule other events around it.
          </p>
        )}

        {/* Start / End */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start" type="datetime-local" {...register("startTime", { required: true })} />
          <Input label="End" type="datetime-local" {...register("endTime", { required: true })} />
        </div>

        {/* Quick duration buttons */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick duration</span>
          <div className="flex gap-2">
            {[
              { label: "30 min", minutes: 30 },
              { label: "1 hour", minutes: 60 },
              { label: "1.5 hrs", minutes: 90 },
              { label: "2 hours", minutes: 120 },
            ].map(({ label, minutes }) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setDuration(minutes)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Goal (optional)</label>
          <select
            {...register("goalId")}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
          >
            <option value="">— No goal —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>{g.icon ? `${g.icon} ` : ""}{g.title}</option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Priority</span>
          <div className="flex gap-2">
            {([
              { value: "HIGH",   label: "High",   color: "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300" },
              { value: "NORMAL", label: "Normal", color: "border-brand-400 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300" },
              { value: "LOW",    label: "Low",    color: "border-gray-400 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300" },
            ] as { value: Priority; label: string; color: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setValue("priority", opt.value)}
                className={clsx(
                  "flex-1 py-1.5 rounded-lg border-2 text-sm font-medium transition-all",
                  priority === opt.value ? opt.color : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {priority === "HIGH" && (
            <p className="text-xs text-red-600 dark:text-red-400">High priority events won't be moved by the optimizer or auto-fix.</p>
          )}
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
          <textarea
            {...register("description")}
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none dark:text-white"
          />
        </div>

        {/* Recurrence */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Repeat</span>
            <select
              {...register("recurFreq")}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {recurFreq !== "none" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Every</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  {...register("recurInterval", { valueAsNumber: true, min: 1 })}
                  className="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm text-center outline-none focus:border-brand-500 dark:text-white"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {recurFreq === "daily" ? "day(s)" : recurFreq === "weekly" ? "week(s)" : "month(s)"}
                </span>
              </div>

              {recurFreq === "daily" && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Repeat on</span>
                  <div className="flex gap-2">
                    {([["all", "All days"], ["weekdays", "Weekdays only"], ["weekends", "Weekends only"]] as [DaysFilter, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setValue("recurDaysFilter", val)}
                        className={clsx(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          recurDaysFilter === val
                            ? "bg-brand-600 text-white border-brand-600"
                            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurFreq === "weekly" && (
                <div className="space-y-2">
                  {/* Quick-select presets */}
                  <div className="flex gap-2">
                    {[
                      { label: "Weekdays", days: [1, 2, 3, 4, 5] },
                      { label: "Weekends", days: [0, 6] },
                      { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
                    ].map(({ label, days: preset }) => {
                      const active =
                        preset.length === recurDays?.length &&
                        preset.every((d) => recurDays?.includes(d));
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setValue("recurDays", preset)}
                          className={clsx(
                            "px-3 py-1 rounded-lg text-xs font-medium border transition-colors",
                            active
                              ? "bg-brand-600 text-white border-brand-600"
                              : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-brand-400 hover:text-brand-600"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Individual day toggles */}
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS_OF_WEEK.map((day, i) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={clsx(
                          "w-10 h-10 rounded-full text-xs font-medium transition-colors",
                          recurDays?.includes(i)
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Input
                label="End date (optional)"
                type="date"
                {...register("recurEndDate")}
                className="mt-1"
              />
            </>
          )}
        </div>

        <div className="flex gap-3 pt-1">
          {event && onDelete && !confirmingDelete && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
          {event && onDelete && confirmingDelete && (
            <>
              <span className="text-sm text-red-600 dark:text-red-400 self-center">Delete this event?</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={async () => { await onDelete(event.id); onClose(); }}
              >
                Yes, delete
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </Button>
            </>
          )}
          {event && onSnooze && !event.isLocked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={snoozing}
              title="Reschedule to next available slot"
              onClick={async () => {
                setSnoozing(true);
                try { await onSnooze(event.id); onClose(); }
                finally { setSnoozing(false); }
              }}
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Snooze
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={isSubmitting} className="flex-1">
            {event ? "Save Changes" : "Create Event"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
