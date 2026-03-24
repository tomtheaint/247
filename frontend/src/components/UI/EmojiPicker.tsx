import { useState, useRef, useEffect } from "react";
import { clsx } from "clsx";

const EMOJI_GROUPS = [
  { label: "Goals",    emojis: ["🎯", "⭐", "🏆", "🔥", "💪", "🚀", "✅", "🌟", "💡", "🎖️"] },
  { label: "Fitness",  emojis: ["🏃", "🏋️", "🚴", "🧘", "🏊", "⚽", "🎾", "🏈", "🥊", "🤸"] },
  { label: "Learning", emojis: ["📚", "🎓", "✏️", "🔬", "🧠", "📖", "🖊️", "📐", "🔭", "🎨"] },
  { label: "Career",   emojis: ["💼", "📈", "🖥️", "🤝", "🏢", "📊", "💰", "🗂️", "📧", "🔑"] },
  { label: "Health",   emojis: ["🍎", "💊", "🥗", "😴", "🫀", "🌿", "🍵", "🥦", "💧", "🧴"] },
  { label: "Creative", emojis: ["🎵", "🎸", "✍️", "📷", "🎭", "🎬", "🎹", "🎨", "🖌️", "📸"] },
  { label: "Social",   emojis: ["❤️", "👥", "🌍", "🎉", "🤗", "💬", "🫂", "🕊️", "🌈", "🎊"] },
  { label: "Finance",  emojis: ["💵", "🏦", "💳", "📉", "🏠", "🪙", "💹", "🛒", "📑", "🔐"] },
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-12 h-12 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-2xl flex items-center justify-center hover:border-brand-400 transition-colors"
        title="Choose icon"
      >
        {value || "🎯"}
      </button>

      {open && (
        <div className="absolute z-50 left-0 top-14 w-72 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl">
          {/* Group tabs */}
          <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-700 px-2 pt-2 gap-1">
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveGroup(i)}
                className={clsx(
                  "shrink-0 px-2 py-1 rounded-t text-xs font-medium whitespace-nowrap transition-colors",
                  activeGroup === i
                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 border-b-2 border-brand-500"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-5 gap-1 p-3">
            {EMOJI_GROUPS[activeGroup].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(emoji); setOpen(false); }}
                className={clsx(
                  "w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-700",
                  value === emoji && "bg-brand-100 dark:bg-brand-900/40 ring-2 ring-brand-400"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
