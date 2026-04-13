'use client';

import { useEffect, useState } from 'react';
import { Users, Mic, MicOff, Video, VideoOff, Crown } from 'lucide-react';
import type RTKClient from '@cloudflare/realtimekit';
import type { RTKParticipant } from '@cloudflare/realtimekit';
import { getInitials } from '@/lib/utils';

interface DisplayParticipant {
  id: string;
  name: string;
  isHost: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isLocal: boolean;
}

interface Props {
  meeting: RTKClient;
  role: 'instructor' | 'student';
}

export default function ParticipantsPanel({ meeting, role }: Props) {
  const [participants, setParticipants] = useState<DisplayParticipant[]>([]);

  useEffect(() => {
    function updateParticipants() {
      const seen = new Set<string>(); // deduplicate by name
      const all: DisplayParticipant[] = [];

      // Self
      const self = meeting.self;
      if (self) {
        const name = self.name || 'You';
        seen.add(name.toLowerCase());
        all.push({
          id: self.id || 'self',
          name,
          isHost: role === 'instructor',
          audioEnabled: self.audioEnabled,
          videoEnabled: self.videoEnabled,
          isLocal: true,
        });
      }

      // Active peers — deduplicate by name to handle stale reconnect ghosts
      if (meeting.participants?.active) {
        for (const p of meeting.participants.active.values()) {
          const name = p.name || 'Participant';
          const key = name.toLowerCase();
          if (seen.has(key)) continue; // skip duplicate connection
          seen.add(key);
          all.push({
            id: p.id,
            name,
            isHost: false,
            audioEnabled: p.audioEnabled ?? true,
            videoEnabled: p.videoEnabled ?? true,
            isLocal: false,
          });
        }
      }

      setParticipants(all);
    }

    updateParticipants();

    // Re-render on participant changes
    const onJoin = () => updateParticipants();
    const onLeave = () => updateParticipants();

    meeting.participants?.active?.on('participantJoined', onJoin);
    meeting.participants?.active?.on('participantLeft', onLeave);

    return () => {
      meeting.participants?.active?.off('participantJoined', onJoin);
      meeting.participants?.active?.off('participantLeft', onLeave);
    };
  }, [meeting, role]);

  const instructors = participants.filter((p) => p.isHost || p.isLocal && role === 'instructor');
  const students = participants.filter((p) => !p.isHost && !(p.isLocal && role === 'instructor'));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <Users className="w-4 h-4 text-indigo-400" />
        <p className="text-white text-sm font-medium">Participants</p>
        <span className="ml-auto text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
          {participants.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Instructors */}
        {instructors.length > 0 && (
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-1">Instructors</p>
            <div className="space-y-1">
              {instructors.map((p) => (
                <ParticipantRow key={p.id} participant={p} />
              ))}
            </div>
          </section>
        )}

        {/* Students */}
        {students.length > 0 && (
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 px-1">
              Students ({students.length})
            </p>
            <div className="space-y-1">
              {students.map((p) => (
                <ParticipantRow key={p.id} participant={p} />
              ))}
            </div>
          </section>
        )}

        {participants.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Users className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-gray-500 text-sm">No participants yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ParticipantRow({ participant }: { participant: DisplayParticipant }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
      <div className="w-7 h-7 rounded-full bg-indigo-800 text-indigo-200 text-xs font-bold flex items-center justify-center shrink-0">
        {getInitials(participant.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-gray-200 text-sm truncate">
          {participant.name}
          {participant.isLocal && <span className="text-gray-500 ml-1">(you)</span>}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {participant.isHost && <Crown className="w-3 h-3 text-amber-400" />}
        {participant.audioEnabled ? (
          <Mic className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-red-500" />
        )}
        {participant.videoEnabled ? (
          <Video className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <VideoOff className="w-3.5 h-3.5 text-red-500" />
        )}
      </div>
    </div>
  );
}
