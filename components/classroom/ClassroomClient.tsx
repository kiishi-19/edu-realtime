'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RealtimeKitProvider, useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { ArrowLeft, Users2 } from 'lucide-react';
import ClassroomSidebar from './ClassroomSidebar';
import ClassroomToolbar from './ClassroomToolbar';

// TranscriptionData from the RTK package
interface TranscriptionData {
  id: string;
  name: string;
  peerId: string;
  userId: string;
  customParticipantId: string;
  transcript: string;
  isPartialTranscript: boolean;
  date: Date;
}

interface TranscriptEntry { speaker: string; text: string; time: string }
interface LiveCaption { speaker: string; text: string }

// ── Camera constraints shared by main + breakout ──────────────────────────
const VIDEO_DEFAULTS = {
  audio: true,
  video: true,
  mediaConfiguration: {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
  },
};

// ── Breakout meeting (rendered in-place, replacing the main meeting) ───────

function BreakoutView({
  token,
  roomName,
  onLeave,
}: {
  token: string;
  roomName: string;
  onLeave: () => void;
}) {
  const [breakoutMeeting, initBreakout] = useRealtimeKitClient();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    initBreakout({ authToken: token, defaults: VIDEO_DEFAULTS });
  }, [token, initBreakout, initialized]);

  // Leave breakout and return to main room
  useEffect(() => {
    if (!breakoutMeeting) return;
    const handler = () => onLeave();
    breakoutMeeting.self?.on('roomLeft', handler);
    return () => { breakoutMeeting.self?.off('roomLeft', handler); };
  }, [breakoutMeeting, onLeave]);

  return (
    <div className="flex-1 min-w-0 overflow-hidden flex flex-col relative">
      {/* Breakout banner */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-full px-4 py-1.5 shadow-lg">
        <Users2 className="w-3.5 h-3.5 text-indigo-400" />
        <span className="text-white text-xs font-medium">{roomName}</span>
        <span className="text-gray-500 text-xs">· Breakout Room</span>
        <button
          onClick={onLeave}
          className="ml-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-200 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Return to main room
        </button>
      </div>

      {/* Breakout meeting — fills remaining height */}
      <div className="flex-1 overflow-hidden" style={{ height: '100%' }}>
        {breakoutMeeting ? (
          <RealtimeKitProvider value={breakoutMeeting}>
            <RtkMeeting
              mode="fill"
              meeting={breakoutMeeting}
              showSetupScreen={false}
            />
          </RealtimeKitProvider>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-900">
            <div className="text-center text-white space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 text-sm">Joining {roomName}…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main classroom client ─────────────────────────────────────────────────

interface Props {
  sessionId: string;
  user: { id: string; name: string; email: string; role: string };
  sessionTitle: string;
  aiEnabled: boolean;
  joinCode: string;
  instructorId: string;
}

export default function ClassroomClient({
  sessionId, user, sessionTitle, aiEnabled, joinCode, instructorId,
}: Props) {
  const router = useRouter();
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [role, setRole] = useState<'instructor' | 'student'>('student');
  const [error, setError] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'transcript' | 'participants' | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(null);
  const [joining, setJoining] = useState(false);

  // Breakout state — when set, BreakoutView replaces the main meeting pane
  const [breakout, setBreakout] = useState<{ token: string; roomName: string } | null>(null);

  // ── Join main session ────────────────────────────────────────────────

  useEffect(() => {
    async function joinSession() {
      setJoining(true);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/join`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to join session'); return; }
        setAuthToken(data.auth_token);
        setRole(data.role);
      } catch {
        setError('Network error while joining session');
      } finally {
        setJoining(false);
      }
    }
    joinSession();
  }, [sessionId]);

  useEffect(() => {
    if (!authToken) return;
    initMeeting({ authToken, defaults: VIDEO_DEFAULTS });
  }, [authToken, initMeeting]);

  // ── Transcription ────────────────────────────────────────────────────

  useEffect(() => {
    if (!meeting) return;

    const handleTranscript = (data: TranscriptionData) => {
      const speaker = data.name || 'Participant';
      if (data.isPartialTranscript) {
        // Live — show immediately as the speaker is talking
        setLiveCaption({ speaker, text: data.transcript });
      } else {
        // Final — commit to history and clear the live row
        setLiveCaption(null);
        setTranscripts((prev) => [
          ...prev.slice(-199),
          { speaker, text: data.transcript, time: data.date.toISOString() },
        ]);
      }
    };

    const loadExisting = () => {
      const existing = meeting.ai?.transcripts ?? [];
      if (existing.length > 0) {
        setTranscripts(
          existing
            .filter((t) => !t.isPartialTranscript)
            .map((t) => ({ speaker: t.name || 'Participant', text: t.transcript, time: t.date.toISOString() }))
        );
      }
    };

    const startTranscription = async () => {
      meeting.ai?.off('transcript', handleTranscript);
      meeting.ai?.on('transcript', handleTranscript);
      loadExisting();
      try { await meeting.ai?.getActiveTranscript(); } catch { /* non-fatal */ }
    };

    if (meeting.self?.roomJoined) startTranscription();
    meeting.self?.on('roomJoined', startTranscription);

    return () => {
      meeting.ai?.off('transcript', handleTranscript);
      meeting.self?.off('roomJoined', startTranscription);
    };
  }, [meeting]);

  // ── Room leave (end session) ─────────────────────────────────────────

  useEffect(() => {
    if (!meeting) return;
    const handleRoomLeft = async () => {
      if (role === 'instructor' && instructorId === user.id) {
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'ended' }),
        });
      }
      router.push('/dashboard');
    };
    meeting.self?.on('roomLeft', handleRoomLeft);
    return () => { meeting.self?.off('roomLeft', handleRoomLeft); };
  }, [meeting, role, instructorId, user.id, sessionId, router]);

  // ── Breakout room handlers ───────────────────────────────────────────

  const handleJoinBreakout = useCallback((token: string, roomName: string) => {
    setBreakout({ token, roomName });
    setSidebarTab(null); // close sidebar when entering breakout
  }, []);

  const handleLeaveBreakout = useCallback(() => {
    setBreakout(null);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center space-y-4">
          <p className="text-red-400 text-lg">{error}</p>
          <button onClick={() => router.push('/sessions')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm">
            Back to sessions
          </button>
        </div>
      </div>
    );
  }

  if (joining || !authToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center text-white space-y-3">
          <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-300 text-sm">Joining classroom…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-900 flex flex-col">
      <ClassroomToolbar
        sessionTitle={sessionTitle}
        sessionId={sessionId}
        joinCode={joinCode}
        role={role}
        aiEnabled={aiEnabled}
        meeting={meeting}
        sidebarTab={sidebarTab}
        onTabChange={setSidebarTab}
        onJoinBreakout={handleJoinBreakout}
      />

      <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
        {/* Main meeting OR breakout — mutually exclusive in the same pane */}
        {breakout ? (
          <BreakoutView
            token={breakout.token}
            roomName={breakout.roomName}
            onLeave={handleLeaveBreakout}
          />
        ) : (
          <div className="flex-1 min-w-0 overflow-hidden relative">
            {meeting ? (
              <RealtimeKitProvider value={meeting}>
                <RtkMeeting mode="fill" meeting={meeting} showSetupScreen />
              </RealtimeKitProvider>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Sidebar — only shown in main room */}
        {sidebarTab && meeting && !breakout && (
          <ClassroomSidebar
            tab={sidebarTab}
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            meeting={meeting}
            transcripts={transcripts}
            liveCaption={liveCaption}
            role={role}
            aiEnabled={aiEnabled}
          />
        )}
      </div>
    </div>
  );
}
