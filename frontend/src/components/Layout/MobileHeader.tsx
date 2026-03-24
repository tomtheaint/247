import { useAuthStore } from "../../store/authStore";

interface Props {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: Props) {
  const { user } = useAuthStore();

  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0 border-b border-gray-700">
      <button
        onClick={onMenuClick}
        className="p-2 -ml-1 rounded-lg hover:bg-gray-800 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-xs">24</div>
        <span className="font-bold tracking-tight">24/7</span>
      </div>

      <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold uppercase">
        {user?.displayName?.[0] ?? user?.username?.[0] ?? "?"}
      </div>
    </header>
  );
}
