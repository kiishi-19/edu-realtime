'use client';

import type RTKClient from '@cloudflare/realtimekit';
import AIChatPanel from './AIChatPanel';
import TranscriptPanel from './TranscriptPanel';
import ParticipantsPanel from './ParticipantsPanel';

interface TranscriptEntry { speaker: string; text: string; time: string }
interface LiveCaption { speaker: string; text: string }

interface Props {
  tab: 'chat' | 'transcript' | 'participants';
  sessionId: string;
  sessionTitle: string;
  meeting: RTKClient;
  transcripts: TranscriptEntry[];
  liveCaption: LiveCaption | null;
  role: 'instructor' | 'student';
  aiEnabled: boolean;
}

export default function ClassroomSidebar({
  tab, sessionId, sessionTitle, meeting, transcripts, liveCaption, role, aiEnabled,
}: Props) {
  return (
    <div className="w-80 shrink-0 bg-gray-950 border-l border-gray-800 flex flex-col h-full animate-fade-in">
      {tab === 'chat' && aiEnabled && (
        <AIChatPanel
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          transcripts={transcripts}
        />
      )}
      {tab === 'transcript' && (
        <TranscriptPanel
          transcripts={transcripts}
          liveCaption={liveCaption}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
        />
      )}
      {tab === 'participants' && (
        <ParticipantsPanel meeting={meeting} role={role} />
      )}
    </div>
  );
}
