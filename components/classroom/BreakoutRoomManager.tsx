'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2, Users2, LogIn } from 'lucide-react';
import type RTKClient from '@cloudflare/realtimekit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Room {
  id: string;
  title: string;
  participantCount: number;
}

interface Props {
  sessionId: string;
  meeting: RTKClient;
  onClose: () => void;
  onJoinBreakout: (token: string, roomName: string) => void;
}

export default function BreakoutRoomManager({ sessionId, meeting, onClose, onJoinBreakout }: Props) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Sync with RTK's connected meetings state ───────────────────────────
  useEffect(() => {
    const cm = meeting.connectedMeetings;
    if (!cm) { setLoading(false); return; }

    function applyState(meetings: Array<{ id?: string; title?: string; participants: unknown[] }>) {
      setRooms(
        meetings
          .filter((m) => m.id)
          .map((m) => ({
            id: m.id!,
            title: m.title || 'Breakout Room',
            participantCount: m.participants?.length ?? 0,
          }))
      );
    }

    // Apply immediately if already populated
    if (cm.meetings?.length) applyState(cm.meetings);

    // Fetch fresh from API
    cm.getConnectedMeetings()
      .then(({ meetings }) => applyState(meetings))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Subscribe to future changes (rooms created via RTK's built-in UI also fire this)
    const handleUpdate = (payload: { meetings: Array<{ id?: string; title?: string; participants: unknown[] }> }) => {
      applyState(payload.meetings ?? []);
    };

    cm.on('stateUpdate', handleUpdate);
    return () => { cm.off('stateUpdate', handleUpdate); };
  }, [meeting]);

  // ── Create a new room via RTK's connected meetings API ─────────────────
  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setCreating(true);
    setError('');

    try {
      await meeting.connectedMeetings.createMeetings([{ title: newRoomName.trim() }]);
      setNewRoomName('');
      // rooms list updates automatically via stateUpdate event
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
    } finally {
      setCreating(false);
    }
  }

  // ── Join a room — calls our API to generate a participant token ─────────
  async function joinBreakout(room: Room) {
    setJoining(room.id);
    setError('');

    try {
      const res = await fetch(`/api/sessions/${sessionId}/breakout/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: room.id }),
      });
      const data = await res.json() as { auth_token?: string; error?: string };

      if (!res.ok) throw new Error(data.error || 'Failed to join room');

      // Switch the main classroom pane to the breakout room (same tab)
      onJoinBreakout(data.auth_token!, room.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoining(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Users2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-white font-semibold">Breakout Rooms</h2>
            {rooms.length > 0 && (
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {rooms.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create room */}
        <div className="px-5 py-4 border-b border-gray-800">
          <form onSubmit={createRoom} className="flex gap-2">
            <Input
              placeholder="Room name (e.g. Group A)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
            />
            <Button type="submit" disabled={creating || !newRoomName.trim()} size="sm">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Room list */}
        <div className="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
          {loading && (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-500 mx-auto" />
            </div>
          )}

          {!loading && rooms.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">
              No breakout rooms yet. Create one above — rooms created through the meeting UI also appear here.
            </p>
          )}

          {rooms.map((room) => (
            <div key={room.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Users2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-white text-sm truncate">{room.title}</span>
                {room.participantCount > 0 && (
                  <span className="text-xs text-gray-500 shrink-0">
                    {room.participantCount} in room
                  </span>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => joinBreakout(room)}
                disabled={joining === room.id}
                className="text-indigo-400 hover:text-white hover:bg-indigo-600 shrink-0 ml-2"
              >
                {joining === room.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />}
                Join
              </Button>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-gray-800">
          <p className="text-gray-600 text-xs">
            Rooms created via the meeting controls also appear here automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
