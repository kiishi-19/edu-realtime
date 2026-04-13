import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import DashboardNav from '@/components/dashboard/DashboardNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardNav user={user} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}
