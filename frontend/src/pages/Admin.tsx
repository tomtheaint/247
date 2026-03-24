import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { adminApi } from "../api/admin";
import { Button } from "../components/UI/Button";
import type { User, UserRole } from "../types";

const ROLES: UserRole[] = ["USER", "REVIEWER", "ADMIN"];

const roleBadgeClass: Record<UserRole, string> = {
  USER: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
  REVIEWER: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  ADMIN: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
};

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page, limit: 20, q: search || undefined });
      setUsers(res.data);
      setTotal(res.total);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (user: User, role: UserRole) => {
    if (user.role === role) return;
    setUpdating(user.id);
    try {
      const updated = await adminApi.updateRole(user.id, role);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: updated.role } : u)));
      toast.success(`${user.username} is now ${role}`);
    } catch {
      toast.error("Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const handleSeedTestData = async () => {
    setSeeding(true);
    try {
      const result = await adminApi.seedTestData();
      toast.success(`Created 3 goals, ${result.eventsCreated} events, and 1 track.`);
    } catch {
      toast.error("Failed to seed test data");
    } finally {
      setSeeding(false);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <p className="text-gray-500 text-sm mt-1">{total} users total</p>
      </div>

      {/* Test Data */}
      <section className="mb-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Seed Test Data</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Adds 3 goals (Learn Spanish, Run a 5K, Read 12 Books), 10 events spread across those goals, and a
              "Conversational Spanish in 90 Days" track linked to the Spanish goal — all under your account.
            </p>
          </div>
          <Button size="sm" loading={seeding} onClick={handleSeedTestData} className="shrink-0">
            Add test data
          </Button>
        </div>
      </section>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by email or username…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
              <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={4} className="px-4 py-3">
                    <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No users found</td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white uppercase">
                        {(user.displayName ?? user.username)[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{user.displayName ?? user.username}</p>
                        <p className="text-xs text-gray-400">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{user.email}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass[user.role]}`}>
                        {user.role}
                      </span>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                        disabled={updating === user.id}
                        className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
