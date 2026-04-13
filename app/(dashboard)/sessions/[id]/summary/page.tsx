import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthUser } from '@/lib/auth';
import { getSessionById, getSessionParticipants } from '@/lib/db';
import { ArrowLeft, Clock, Users, BookOpen, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDuration } from '@/lib/utils';
import PostSessionSummary from '@/components/sessions/PostSessionSummary';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionSummaryPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const session = await getSessionById(id);
  if (!session) redirect('/sessions');

  const participants = await getSessionParticipants(id);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Link href="/sessions">
          <button className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{session.title}</h1>
          <p className="text-sm text-gray-500">Session summary</p>
        </div>
      </div>

      {/* Session stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Duration</p>
              <p className="font-semibold text-gray-900">
                {session.ended_at
                  ? formatDuration(session.created_at, session.ended_at)
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Participants</p>
              <p className="font-semibold text-gray-900">{participants.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <Badge variant="secondary">Ended</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session info */}
      <Card>
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Instructor</p>
            <p className="text-sm font-medium text-gray-900">{session.instructor_name}</p>
          </div>
          {session.description && (
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-gray-500">Description</p>
              <p className="text-sm text-gray-700 text-right">{session.description}</p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-sm text-gray-700">{formatDate(session.created_at)}</p>
          </div>
          {session.ended_at && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Ended</p>
              <p className="text-sm text-gray-700">{formatDate(session.ended_at)}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Participants list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participants ({participants.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.email}</p>
                </div>
                <Badge variant={p.role === 'instructor' ? 'default' : 'secondary'} className="capitalize">
                  {p.role}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary component (client) */}
      {session.ai_enabled === 1 && <PostSessionSummary sessionId={id} />}
    </div>
  );
}
