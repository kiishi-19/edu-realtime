import Link from 'next/link';
import { BookOpen, Users, Bot, Video, Mic, BarChart3, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 text-white">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-400 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">EduRealtime</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-indigo-200 hover:text-white text-sm font-medium transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-800/50 border border-indigo-700/50 text-indigo-300 text-sm px-3 py-1 rounded-full mb-6">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Powered by Cloudflare RealtimeKit
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
          The classroom, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300">
            reimagined
          </span>
        </h1>

        <p className="text-xl text-indigo-200 max-w-2xl mx-auto mb-10">
          Live video classrooms with AI tutors, real-time transcription, breakout rooms,
          and everything you need for an exceptional learning experience.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/join"
            className="flex items-center gap-2 bg-white text-indigo-900 font-semibold px-6 py-3 rounded-xl hover:bg-indigo-50 transition-colors text-sm"
          >
            Join a class
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-2 border border-indigo-600/60 text-white font-medium px-6 py-3 rounded-xl hover:bg-indigo-800/40 transition-colors text-sm"
          >
            I&apos;m an instructor
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-indigo-300/60 hover:text-indigo-200 text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {features.map((f) => (
            <div key={f.title} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-indigo-300" />
              </div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-indigo-300 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const features = [
  {
    icon: Video,
    title: 'HD Video Classrooms',
    description: 'Crystal-clear video and audio for up to 500 participants. Built on Cloudflare\'s global network.',
  },
  {
    icon: Bot,
    title: 'AI Teaching Assistant',
    description: 'Invite EduBot to your class. Students ask questions — the AI answers instantly via chat and voice.',
  },
  {
    icon: Mic,
    title: 'Live Transcription',
    description: 'Real-time captions for every speaker powered by Deepgram Nova-3. Never miss a word.',
  },
  {
    icon: Users,
    title: 'Breakout Rooms',
    description: 'Split students into smaller groups for discussions. Instructors can monitor and join any room.',
  },
  {
    icon: BarChart3,
    title: 'Session Summaries',
    description: 'AI-generated lecture summaries with key topics, Q&A highlights, and action items.',
  },
  {
    icon: BookOpen,
    title: 'Role-Based Access',
    description: 'Instructors control the class. Students participate. Up to 2 instructors per session.',
  },
];
