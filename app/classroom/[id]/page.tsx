import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import { getSessionById } from '@/lib/db';
import ClassroomClient from '@/components/classroom/ClassroomClient';

export default async function ClassroomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const session = await getSessionById(id);

  if (!session) redirect('/sessions');
  if (session.status === 'ended') redirect(`/sessions/${id}/summary`);

  return (
    <ClassroomClient
      sessionId={id}
      user={user}
      sessionTitle={session.title}
      aiEnabled={session.ai_enabled === 1}
      joinCode={session.join_code}
      instructorId={session.instructor_id}
    />
  );
}
