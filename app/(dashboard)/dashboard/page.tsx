import Link from 'next/link';
import { getAuthUser } from '@/lib/auth';
import { getAllSessions, getSessionsByInstructor } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Plus, Video, Users, Clock, ArrowRight, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, getStatusColor } from '@/lib/utils';
import JoinSessionDialog from '@/components/sessions/JoinSessionDialog';

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const allSessions = user.role === 'instructor'
    ? await getSessionsByInstructor(user.id)
    : await getAllSessions(20);
  const sessions = user.role === 'instructor'
    ? allSessions
    : allSessions.filter((s) => s.status !== 'ended');

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled');

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5 capitalize">{user.role} account</p>
        </div>
        <div className="flex items-center gap-2">
          <JoinSessionDialog />
          {user.role === 'instructor' && (
            <Link href="/sessions/create">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New session
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Video}
          label="Active now"
          value={activeSessions.length}
          color="green"
        />
        <StatCard
          icon={Clock}
          label="Upcoming"
          value={upcomingSessions.length}
          color="blue"
        />
        <StatCard
          icon={Users}
          label={user.role === 'instructor' ? 'My sessions' : 'Available'}
          value={sessions.length}
          color="purple"
        />
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live now
          </h2>
          <div className="space-y-3">
            {activeSessions.map((s) => (
              <SessionCard key={s.id} session={s} urgent />
            ))}
          </div>
        </section>
      )}

      {/* All sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            {user.role === 'instructor' ? 'My sessions' : 'Available sessions'}
          </h2>
          <Link href="/sessions" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No sessions yet</p>
              <p className="text-gray-400 text-sm mt-1">
                {user.role === 'instructor'
                  ? 'Create your first session to get started'
                  : 'Sessions will appear here when instructors create them'}
              </p>
              {user.role === 'instructor' && (
                <Link href="/sessions/create" className="mt-4">
                  <Button size="sm">
                    <Plus className="w-4 h-4" />
                    Create session
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.slice(0, 5).map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className={`w-8 h-8 rounded-lg ${colors[color]} flex items-center justify-center mb-2`}>
          <Icon className="w-4 h-4" />
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}

function SessionCard({ session, urgent }: { session: import('@/lib/db').SessionRow; urgent?: boolean }) {
  return (
    <Card className={urgent ? 'border-green-200 bg-green-50/30' : ''}>
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-900 truncate">{session.title}</h3>
            <Badge
              variant={session.status === 'active' ? 'success' : session.status === 'scheduled' ? 'default' : 'secondary'}
            >
              {session.status === 'active' ? 'Live' : session.status}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">
            by {session.instructor_name} · {session.participant_count ?? 0} participants
          </p>
          {session.scheduled_at && (
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(session.scheduled_at)}</p>
          )}
        </div>
        <Link href={`/classroom/${session.id}`}>
          <Button size="sm" variant={urgent ? 'default' : 'outline'}>
            {urgent ? 'Join live' : 'Open'}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
