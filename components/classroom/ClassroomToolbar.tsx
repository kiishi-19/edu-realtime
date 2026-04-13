'use client';

import { useState, useEffect } from 'react';
import { FileText, Users, Bot, Copy, Check, ArrowLeft, Users2 } from 'lucide-react';
import Link from 'next/link';
import type RTKClient from '@cloudflare/realtimekit';
import BreakoutRoomManager from './BreakoutRoomManager';

interface Props {
  sessionTitle: string;
  sessionId: string;
  joinCode: string;
  role: 'instructor' | 'student';
  aiEnabled: boolean;
  meeting: RTKClient | null;
  sidebarTab: 'chat' | 'transcript' | 'participants' | null;
  onTabChange: (tab: 'chat' | 'transcript' | 'participants' | null) => void;
  onJoinBreakout: (token: string, roomName: string) => void;
}

export default function ClassroomToolbar({
  sessionTitle, sessionId, joinCode, role, aiEnabled, meeting, sidebarTab, onTabChange, onJoinBreakout,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [showBreakout, setShowBreakout] = useState(false);
  const [breakoutCount, setBreakoutCount] = useState(0);

  // Subscribe to RTK's connectedMeetings so the badge stays live.
  // This fires whenever rooms are added/removed — even via the meeting's built-in UI.
  useEffect(() => {
    if (!meeting?.connectedMeetings) return;

    const cm = meeting.connectedMeetings;

    // Seed with current state
    setBreakoutCount(cm.meetings?.length ?? 0);

    // Fetch fresh count from RTK
    cm.getConnectedMeetings()
      .then(({ meetings }) => setBreakoutCount(meetings.length))
      .catch(() => {});

    const handleUpdate = (payload: { meetings: unknown[] }) => {
      setBreakoutCount(payload.meetings?.length ?? 0);
    };

    cm.on('stateUpdate', handleUpdate);
    return () => { cm.off('stateUpdate', handleUpdate); };
  }, [meeting]);

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleTab(tab: 'chat' | 'transcript' | 'participants') {
    onTabChange(sidebarTab === tab ? null : tab);
  }

  return (
    <>
      <div className="bg-gray-900 border-b border-gray-800 h-14 flex items-center px-4 gap-3 shrink-0">
        {/* Back */}
        <Link href="/sessions" className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Session title */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{sessionTitle}</p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>

        {/* Join code */}
        {role === 'instructor' && (
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-2.5 py-1.5 rounded-lg font-mono transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            <span className="tracking-widest font-bold">{joinCode}</span>
          </button>
        )}

        {/* Toolbar buttons */}
        <div className="flex items-center gap-1">
          {aiEnabled && (
            <ToolbarButton icon={Bot} label="AI Chat" active={sidebarTab === 'chat'} onClick={() => toggleTab('chat')} highlight />
          )}
          <ToolbarButton icon={FileText} label="Transcript" active={sidebarTab === 'transcript'} onClick={() => toggleTab('transcript')} />
          <ToolbarButton icon={Users} label="People" active={sidebarTab === 'participants'} onClick={() => toggleTab('participants')} />

          {/* Breakout button — visible to everyone, badge shows live count */}
          <button
            onClick={() => setShowBreakout(true)}
            title="Breakout Rooms"
            className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showBreakout
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span className="hidden sm:block">Breakout</span>
            {breakoutCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {breakoutCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Breakout rooms modal */}
      {showBreakout && meeting && (
        <BreakoutRoomManager
          sessionId={sessionId}
          meeting={meeting}
          onClose={() => setShowBreakout(false)}
          onJoinBreakout={(token, name) => {
            setShowBreakout(false);
            onJoinBreakout(token, name);
          }}
        />
      )}
    </>
  );
}

function ToolbarButton({
  icon: Icon, label, active, onClick, highlight,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : highlight
          ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-900 hover:text-purple-100'
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}
