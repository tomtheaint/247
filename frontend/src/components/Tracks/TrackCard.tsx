import { useState } from "react";
import { toast } from "react-hot-toast";
import type { Track, ReactionType } from "../../types";
import { CategoryBadge, DifficultyBadge } from "../UI/Badge";
import { Button } from "../UI/Button";
import { tracksApi } from "../../api/tracks";

interface Props {
  track: Track;
  onAdopt?: (id: string) => void;
  onView?: (track: Track) => void;
  isOwned?: boolean;
  onEdit?: (track: Track) => void;
  userReaction?: ReactionType | null;
  canManage?: boolean; // reviewer or admin
  onTrackUpdated?: (t: Track) => void;
  onTrackDeleted?: (id: string) => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-yellow-400" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs text-gray-500 ml-1">({rating.toFixed(1)})</span>
    </div>
  );
}

// Inline edit modal for admin/reviewer
function EditTrackModal({ track, onClose, onSave }: { track: Track; onClose: () => void; onSave: (t: Track) => void }) {
  const [form, setForm] = useState({ title: track.title, description: track.description, isPublic: track.isPublic ?? false });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await tracksApi.adminUpdate(track.id, form);
      toast.success("Track updated");
      onSave(updated);
      onClose();
    } catch {
      toast.error("Failed to update track");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Edit Track</h2>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
          <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
        </div>
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Publicly visible</span>
          <button type="button" onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))}
            className={`relative w-10 h-6 rounded-full transition-colors ${form.isPublic ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isPublic ? "translate-x-4" : ""}`} />
          </button>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-200">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function TrackCard({ track: initialTrack, onAdopt, onView, isOwned, onEdit, userReaction: initialReaction = null, canManage = false, onTrackUpdated, onTrackDeleted }: Props) {
  const [track, setTrack] = useState(initialTrack);
  const [likes, setLikes] = useState(track.likes ?? 0);
  const [dislikes, setDislikes] = useState(track.dislikes ?? 0);
  const [myReaction, setMyReaction] = useState<ReactionType | null>(initialReaction);
  const [reacting, setReacting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const goals = track.goals ?? [];

  const handleReact = async (type: ReactionType) => {
    if (reacting) return;
    setReacting(true);
    const newType = myReaction === type ? null : type;
    try {
      const res = await tracksApi.react(track.id, newType);
      setLikes(res.likes);
      setDislikes(res.dislikes);
      setMyReaction(res.userReaction);
    } catch {
      toast.error("Failed to react");
    } finally {
      setReacting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${track.title}"? This cannot be undone.`)) return;
    try {
      await tracksApi.adminDelete(track.id);
      toast.success("Track deleted");
      onTrackDeleted?.(track.id);
    } catch {
      toast.error("Failed to delete track");
    }
  };

  const handleToggleVisibility = async () => {
    try {
      const updated = await tracksApi.adminUpdate(track.id, { isPublic: !track.isPublic });
      setTrack(updated);
      onTrackUpdated?.(updated);
      toast.success(updated.isPublic ? "Track is now public" : "Track hidden from community");
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{track.title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{track.description}</p>
          </div>
          {canManage && (
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setEditing(true)} title="Edit"
                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button onClick={handleToggleVisibility} title={track.isPublic ? "Hide from community" : "Make public"}
                className={`p-1.5 rounded-lg transition-colors ${track.isPublic ? "text-green-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {track.isPublic
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  }
                </svg>
              </button>
              <button onClick={handleDelete} title="Delete"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <CategoryBadge category={track.category} />
          <DifficultyBadge difficulty={track.difficulty} />
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
            {track.estimatedDays}d
          </span>
          {!track.isPublic && canManage && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded">hidden</span>
          )}
        </div>

        {track.ratingCount > 0 && <StarRating rating={track.rating} />}

        {/* Goals list */}
        {goals.length > 0 && (
          <div>
            <button
              onClick={() => setShowGoals(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600 font-medium transition-colors mb-1"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showGoals ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {goals.length} goal{goals.length !== 1 ? "s" : ""} in this track
            </button>
            {showGoals && (
              <div className="space-y-1 mt-1 pl-1">
                {goals.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0"
                      style={{ backgroundColor: g.color + "22", border: `1.5px solid ${g.color}55` }}>
                      {g.icon}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300 truncate">{g.title}</span>
                    {g._count && g._count.milestones > 0 && (
                      <span className="text-xs text-gray-400 shrink-0">{g._count.milestones} milestones</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400 mt-auto">
          {track.author && <span>by {track.author.displayName ?? track.author.username}</span>}
          {track._count && <span>{track._count.userTracks} adopted</span>}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => handleReact("LIKE")} disabled={reacting}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${myReaction === "LIKE" ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "border-gray-200 dark:border-gray-600 text-gray-500 hover:border-green-400 hover:text-green-500"} disabled:opacity-50`}>
            <svg className="w-3.5 h-3.5" fill={myReaction === "LIKE" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {likes}
          </button>
          <button onClick={() => handleReact("DISLIKE")} disabled={reacting}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${myReaction === "DISLIKE" ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" : "border-gray-200 dark:border-gray-600 text-gray-500 hover:border-red-400 hover:text-red-500"} disabled:opacity-50`}>
            <svg className="w-3.5 h-3.5" fill={myReaction === "DISLIKE" ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v2a2 2 0 002 2h.095c.5 0 .905-.405.905-.905a3.61 3.61 0 01.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
            </svg>
            {dislikes}
          </button>
        </div>

        <div className="flex gap-2">
          {onView && <Button variant="secondary" size="sm" onClick={() => onView(track)} className="flex-1">View</Button>}
          {onAdopt && !isOwned && <Button size="sm" onClick={() => onAdopt(track.id)} className="flex-1">Adopt Track</Button>}
          {isOwned && onEdit && <Button variant="secondary" size="sm" onClick={() => onEdit(track)} className="flex-1">Edit Track</Button>}
        </div>
      </div>

      {editing && (
        <EditTrackModal
          track={track}
          onClose={() => setEditing(false)}
          onSave={(updated) => { setTrack(updated); onTrackUpdated?.(updated); }}
        />
      )}
    </>
  );
}
