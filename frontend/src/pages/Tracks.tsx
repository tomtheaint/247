import { useEffect, useState } from "react";
import { useTrackStore } from "../store/trackStore";
import { TrackCard } from "../components/Tracks/TrackCard";
import { TrackModal } from "../components/Tracks/TrackModal";
import { Button } from "../components/UI/Button";
import type { Track } from "../types";

export function TracksPage() {
  const { myTracks, isLoading, fetchMine } = useTrackStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Track | null>(null);

  useEffect(() => { fetchMine(); }, [fetchMine]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (track: Track) => { setEditing(track); setModalOpen(true); };

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Tracks</h1>
          <p className="text-gray-500 text-sm mt-1">Tracks you've created</p>
        </div>
        <Button onClick={openCreate}>+ New Track</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myTracks.map((track) => (
            <TrackCard key={track.id} track={track} isOwned onEdit={openEdit} />
          ))}
          {myTracks.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <p className="mb-3">You haven't created any tracks yet.</p>
              <Button onClick={openCreate} size="sm">Create your first track</Button>
            </div>
          )}
        </div>
      )}

      <TrackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {}}
        track={editing}
      />
    </div>
  );
}
