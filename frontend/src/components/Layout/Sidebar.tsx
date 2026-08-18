import { NavLink } from "react-router-dom";
import { clsx } from "clsx";
import { useAuthStore } from "../../store/authStore";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { to: "/calendar", label: "Calendar", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { to: "/recurring", label: "Recurring", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  { to: "/goals", label: "Goals", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  { to: "/tracks", label: "My Tracks", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { to: "/community", label: "Community", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { to: "/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

interface Props {
  onClose?: () => void;
  /** Narrowed to icons. Only the desktop rail does this; the mobile drawer is
   *  already a deliberate act to open and has the whole screen to use. */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onClose, collapsed = false, onToggleCollapse }: Props) {
  const { user, logout } = useAuthStore();
  const role = user?.role ?? "USER";

  const links = [
    ...baseLinks,
    ...(role === "ADMIN" || role === "REVIEWER"
      ? [{ to: "/reviewer", label: "Reviewer", icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" }]
      : []),
    ...(role === "ADMIN"
      ? [{ to: "/admin", label: "Admin", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" }]
      : []),
  ];

  return (
    <aside className={clsx("flex flex-col bg-gray-900 text-white h-full", collapsed ? "w-16" : "w-64")}>
      <div className={clsx("flex items-center border-b border-gray-700", collapsed ? "flex-col gap-2 p-3" : "gap-3 p-6")}>
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center font-bold text-sm shrink-0">24</div>
        {!collapsed && <span className="font-bold text-lg tracking-tight flex-1">24/7</span>}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? "Expand the menu" : "Collapse the menu"}
            aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
            aria-expanded={!collapsed}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d={collapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            // The label is the tooltip once it is not on screen, so a narrowed
            // rail is still readable rather than a column of guesses.
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx("flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-brand-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )
            }
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div className={clsx("border-t border-gray-700", collapsed ? "p-2" : "p-4")}>
        <div className={clsx("flex items-center py-2 mb-2", collapsed ? "justify-center" : "gap-3 px-3")}>
          <div
            className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold uppercase shrink-0"
            title={collapsed ? (user?.displayName ?? user?.username) : undefined}
          >
            {user?.displayName?.[0] ?? user?.username?.[0] ?? "?"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.displayName ?? user?.username}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role?.toLowerCase()}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={collapsed ? "Sign out" : undefined}
          aria-label="Sign out"
          className={clsx(
            "w-full flex items-center py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors",
            collapsed ? "justify-center px-2" : "gap-2 px-3",
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
