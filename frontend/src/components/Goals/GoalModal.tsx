import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Modal } from "../UI/Modal";
import { Button } from "../UI/Button";
import { Input } from "../UI/Input";
import { EmojiPicker } from "../UI/EmojiPicker";
import { useTrackStore } from "../../store/trackStore";
import type { Goal, GoalCategory } from "../../types";

const CATEGORIES: GoalCategory[] = ["FITNESS", "LEARNING", "CAREER", "HEALTH", "CREATIVE", "SOCIAL", "FINANCE", "OTHER"];
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

interface FormData {
  title: string;
  description: string;
  category: GoalCategory;
  color: string;
  icon: string;
  isPublic: boolean;
  programTrackId: string;
  targetDate: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Goal>) => Promise<void>;
  goal?: Goal | null;
}

export function GoalModal({ open, onClose, onSave, goal }: Props) {
  const { myTracks, fetchMine } = useTrackStore();
  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: { color: "#6366f1", category: "OTHER", icon: "🎯", isPublic: false, programTrackId: "" },
  });

  useEffect(() => { fetchMine(); }, [fetchMine]);

  const selectedColor = watch("color");

  useEffect(() => {
    if (goal) {
      reset({
        title: goal.title,
        description: goal.description ?? "",
        category: goal.category,
        color: goal.color,
        icon: goal.icon ?? "🎯",
        isPublic: goal.isPublic ?? false,
        programTrackId: goal.programTrackId ?? "",
        targetDate: goal.targetDate ? goal.targetDate.slice(0, 10) : "",
      });
    } else {
      reset({ title: "", description: "", category: "OTHER", color: "#6366f1", icon: "🎯", isPublic: false, programTrackId: "", targetDate: "" });
    }
  }, [goal, reset]);

  const onSubmit = async (data: FormData) => {
    await onSave({
      ...data,
      programTrackId: data.programTrackId || null,
      targetDate: data.targetDate ? new Date(data.targetDate).toISOString() : undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={goal ? "Edit Goal" : "New Goal"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Icon</label>
            <Controller
              name="icon"
              control={control}
              render={({ field }) => <EmojiPicker value={field.value} onChange={field.onChange} />}
            />
          </div>
          <div className="flex-1">
            <Input label="Title" {...register("title", { required: "Title is required" })} error={errors.title?.message} placeholder="What do you want to achieve?" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
          <textarea
            {...register("description")}
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none dark:text-white"
            placeholder="Describe your goal..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
            <select
              {...register("category")}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <Input label="Target Date" type="date" {...register("targetDate")} />
        </div>

        {myTracks.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Part of a Track (optional)</label>
            <select
              {...register("programTrackId")}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:text-white"
            >
              <option value="">— None —</option>
              {myTracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue("color", c)}
                className="w-7 h-7 rounded-full border-2 transition-all"
                style={{ backgroundColor: c, borderColor: selectedColor === c ? "#fff" : "transparent", outline: selectedColor === c ? `2px solid ${c}` : "none" }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Make public</p>
            <p className="text-xs text-gray-400">Visible to everyone on the Community page</p>
          </div>
          <Controller
            name="isPublic"
            control={control}
            render={({ field }) => (
              <button
                type="button"
                onClick={() => field.onChange(!field.value)}
                className={`relative w-10 h-6 rounded-full transition-colors ${field.value ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"}`}
              >
                <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.value ? "translate-x-4" : "translate-x-0"}`} />
              </button>
            )}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" loading={isSubmitting} className="flex-1">{goal ? "Save Changes" : "Create Goal"}</Button>
        </div>
      </form>
    </Modal>
  );
}
