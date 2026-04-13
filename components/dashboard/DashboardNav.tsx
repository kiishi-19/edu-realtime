'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, LogOut, LayoutDashboard, Video } from 'lucide-react';
import { getInitials } from '@/lib/utils';

interface Props {
  user: { id: string; name: string; email: string; role: string };
}

export default function DashboardNav({ user }: Props) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 hidden sm:block">EduRealtime</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:block">Dashboard</span>
          </Link>
          <Link
            href="/sessions"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Video className="w-4 h-4" />
            <span className="hidden sm:block">Sessions</span>
          </Link>
        </nav>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
              {getInitials(user.name)}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-gray-900 leading-none">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
