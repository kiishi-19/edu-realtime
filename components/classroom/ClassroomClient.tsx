'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RealtimeKitProvider, useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import type { LeaveRoomState } from '@cloudflare/realtimekit';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { ArrowLeft, Users2, Bot, FileText, Users } from 'lucide-react';
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
  sessionId,
  sessionTitle,
  aiEnabled,
  role,
}: {
  token: string;
  roomName: string;
  onLeave: () => void;
  sessionId: string;
  sessionTitle: string;
  aiEnabled: boolean;
  role: 'instructor' | 'student';
}) {
  const [breakoutMeeting, initBreakout] = useRealtimeKitClient();
  const [initialized, setInitialized] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'transcript' | 'participants' | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [liveCaption, setLiveCaption] = useState<LiveCaption | null>(null);

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);
    initBreakout({ authToken: token, defaults: VIDEO_DEFAULTS });
  }, [token, initBreakout, initialized]);

  // Leave breakout and return to main room (triggered by RTK's own leave button)
  useEffect(() => {
    if (!breakoutMeeting) return;
    const handler = () => onLeave();
    breakoutMeeting.self?.on('roomLeft', handler);
    return () => { breakoutMeeting.self?.off('roomLeft', handler); };
  }, [breakoutMeeting, onLeave]);

  // Transcript — same logic as the main room, wired to the breakout meeting
  useEffect(() => {
    if (!breakoutMeeting) return;

    const handleTranscript = (data: TranscriptionData) => {
      const speaker = data.name || 'Participant';
      if (data.isPartialTranscript) {
        setLiveCaption({ speaker, text: data.transcript });
      } else {
        setLiveCaption(null);
        setTranscripts((prev) => [
          ...prev.slice(-199),
          { speaker, text: data.transcript, time: data.date.toISOString() },
        ]);
      }
    };

    const startTranscription = async () => {
      breakoutMeeting.ai?.off('transcript', handleTranscript);
      breakoutMeeting.ai?.on('transcript', handleTranscript);
      const existing = breakoutMeeting.ai?.transcripts ?? [];
      if (existing.length > 0) {
        setTranscripts(
          existing
            .filter((t) => !t.isPartialTranscript)
            .map((t) => ({ speaker: t.name || 'Participant', text: t.transcript, time: t.date.toISOString() }))
        );
      }
      try { await breakoutMeeting.ai?.getActiveTranscript(); } catch { /* non-fatal */ }
    };

    if (breakoutMeeting.self?.roomJoined) startTranscription();
    breakoutMeeting.self?.on('roomJoined', startTranscription);

    return () => {
      breakoutMeeting.ai?.off('transcript', handleTranscript);
      breakoutMeeting.self?.off('roomJoined', startTranscription);
    };
  }, [breakoutMeeting]);

  // Explicit "Return" button — leave the breakout room first, then hand back
  const handleReturn = useCallback(async () => {
    if (breakoutMeeting?.self?.roomJoined) {
      try { await breakoutMeeting.leaveRoom(); } catch { /* non-fatal */ }
      // onLeave will be called by the roomLeft event handler above
    } else {
      onLeave();
    }
  }, [breakoutMeeting, onLeave]);

  function toggleTab(tab: 'chat' | 'transcript' | 'participants') {
    setSidebarTab((prev) => (prev === tab ? null : tab));
  }

  return (
    <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
      {/* Breakout header bar */}
      <div className="bg-gray-900 border-b border-gray-800 h-12 shrink-0 flex items-center px-4 gap-3">
        {/* Room identity */}
        <div className="flex items-center gap-2 min-w-0">
          <Users2 className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-white text-sm font-medium truncate">{roomName}</span>
          <span className="text-gray-500 text-xs shrink-0">· Breakout</span>
        </div>

        <div className="flex-1" />

        {/* Sidebar toggle buttons */}
        <div className="flex items-center gap-1">
          {aiEnabled && (
            <button
              onClick={() => toggleTab('chat')}
              title="AI Chat"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sidebarTab === 'chat'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-purple-900/50 text-purple-300 hover:bg-purple-900 hover:text-purple-100'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:block">AI Chat</span>
            </button>
          )}
          <button
            onClick={() => toggleTab('transcript')}
            title="Transcript"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sidebarTab === 'transcript'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:block">Transcript</span>
          </button>
          <button
            onClick={() => toggleTab('participants')}
            title="Participants"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sidebarTab === 'participants'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span className="hidden sm:block">People</span>
          </button>
        </div>

        {/* Return button */}
        <button
          onClick={handleReturn}
          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-200 bg-red-900/20 hover:bg-red-900/40 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:block">Main room</span>
        </button>
      </div>

      {/* Meeting + sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Breakout meeting */}
        <div className="flex-1 min-w-0 overflow-hidden">
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

        {/* Sidebar — AI chat, transcript, or participants */}
        {sidebarTab && breakoutMeeting && (
          <ClassroomSidebar
            tab={sidebarTab}
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            meeting={breakoutMeeting}
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

  // Prevents the roomLeft handler from redirecting when we leave intentionally for a breakout
  const leavingForBreakout = useRef(false);

  // ── Join main session ────────────────────────────────────────────────

  // Extracted so it can be called both on mount and when returning from breakout
  const joinMainSession = useCallback(async (signal?: AbortSignal) => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/join`, {
        method: 'POST',
        signal,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to join session'); return null; }
      setRole(data.role);
      return data.auth_token as string;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      setError('Network error while joining session');
      return null;
    } finally {
      // Only clear joining if the request wasn't aborted
      if (!signal?.aborted) setJoining(false);
    }
  }, [sessionId]);

  // Initial join — AbortController prevents double-call from React Strict Mode
  useEffect(() => {
    const controller = new AbortController();
    joinMainSession(controller.signal).then((token) => {
      if (token) setAuthToken(token);
    });
    return () => { controller.abort(); };
  }, [joinMainSession]);

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
    const handleRoomLeft = async ({ state }: { state: LeaveRoomState }) => {
      // If we left intentionally to join a breakout, don't redirect
      if (leavingForBreakout.current) {
        leavingForBreakout.current = false;
        return;
      }
      // Only mark the session as ended when the meeting was explicitly ended
      // for everyone (state === 'ended'). A plain 'left' means the instructor
      // simply left the room — the session should remain active for others.
      if (state === 'ended' && role === 'instructor' && instructorId === user.id) {
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

  const handleJoinBreakout = useCallback(async (token: string, roomName: string) => {
    // Mark that we're leaving for a breakout so roomLeft doesn't redirect
    leavingForBreakout.current = true;
    setSidebarTab(null);
    setBreakout({ token, roomName });
    // Leave the main room — user should not be in both rooms simultaneously
    if (meeting?.self?.roomJoined) {
      try { await meeting.leaveRoom(); } catch { /* non-fatal */ }
    }
  }, [meeting]);

  const handleLeaveBreakout = useCallback(async () => {
    setBreakout(null);
    setAuthToken(null); // Clears auth so the loading screen shows while re-joining
    const token = await joinMainSession();
    if (token) setAuthToken(token);
  }, [joinMainSession]);

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
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            aiEnabled={aiEnabled}
            role={role}
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
