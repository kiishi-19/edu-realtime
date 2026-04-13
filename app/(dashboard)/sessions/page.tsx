'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Plus, Video, Clock, CheckCircle, BookOpen, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import JoinSessionDialog from '@/components/sessions/JoinSessionDialog';
import type { SessionRow } from '@/lib/db';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [userRole, setUserRole] = useState<string>('student');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sessRes, meRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/auth/me'),
      ]);
      if (sessRes.ok) {
        const d = await sessRes.json() as { sessions: SessionRow[] };
        setSessions(d.sessions);
      }
      if (meRes.ok) {
        const d = await meRes.json() as { user: { role: string } };
        setUserRole(d.user.role);
      }
      setLoading(false);
    }
    load();
  }, []);

  const groups = {
    active: sessions.filter((s) => s.status === 'active'),
    scheduled: sessions.filter((s) => s.status === 'scheduled'),
    ended: sessions.filter((s) => s.status === 'ended'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sessions</h1>
        <div className="flex items-center gap-2">
          <JoinSessionDialog />
          {userRole === 'instructor' && (
            <Link href="/sessions/create">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New session
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-700 font-medium">No sessions found</p>
            <p className="text-gray-400 text-sm mt-1">
              {userRole === 'instructor' ? 'Create your first class session' : 'Ask your instructor for an access code'}
            </p>
          </CardContent>
        </Card>
      )}

      {(Object.keys(groups) as Array<keyof typeof groups>).map((status) => {
        const list = groups[status];
        if (list.length === 0) return null;

        const icons = { active: Video, scheduled: Clock, ended: CheckCircle };
        const Icon = icons[status];
        const labels = { active: 'Live now', scheduled: 'Upcoming', ended: 'Ended' };

        return (
          <section key={status}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Icon className="w-4 h-4" />
              {labels[status]}
            </h2>
            <div className="space-y-3">
              {list.map((session) => (
                <SessionCard key={session.id} session={session} userRole={userRole} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SessionCard({ session, userRole }: { session: SessionRow; userRole: string }) {
  const [copied, setCopied] = useState(false);
  const badgeVariant = session.status === 'active' ? 'success' : session.status === 'scheduled' ? 'default' : 'secondary';

  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${session.join_code}`
    : `/join?code=${session.join_code}`;

  function copyLink() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-gray-900">{session.title}</h3>
              <Badge variant={badgeVariant}>{session.status === 'active' ? 'Live' : session.status}</Badge>
              {session.ai_enabled ? <Badge variant="secondary">AI</Badge> : null}
            </div>
            {session.description && (
              <p className="text-sm text-gray-500 mb-2 line-clamp-1">{session.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
              <span>by {session.instructor_name}</span>
              <span>{session.participant_count ?? 0} participants</span>
              {session.scheduled_at && <span>{formatDate(session.scheduled_at)}</span>}
            </div>

            {/* Share row — instructors see the code + a copy-link button */}
            {userRole === 'instructor' && session.join_code && (
              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-mono px-2 py-0.5 rounded">
                  Code: <span className="font-bold tracking-widest">{session.join_code}</span>
                </span>
                <button
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied!' : 'Copy join link'}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {session.status !== 'ended' && (
              <Link href={`/classroom/${session.id}`}>
                <Button size="sm" variant={session.status === 'active' ? 'default' : 'outline'}>
                  {session.status === 'active' ? 'Join live' : 'Enter'}
                </Button>
              </Link>
            )}
            {session.status === 'ended' && (
              <Link href={`/sessions/${session.id}/summary`}>
                <Button size="sm" variant="ghost">Summary</Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
