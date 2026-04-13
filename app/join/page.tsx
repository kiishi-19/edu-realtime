'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Loader2, ArrowRight, Users, Lock } from 'lucide-react';
import Link from 'next/link';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'code' | 'name' | 'joining'>('code');
  const [preview, setPreview] = useState<{ title: string; instructor: string; session_id: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-fill code from URL: /join?code=ABC123
  useEffect(() => {
    const c = searchParams.get('code');
    if (c) { setCode(c.toUpperCase()); setStep('name'); }
  }, [searchParams]);

  // ── Step 1: validate the code ─────────────────────────────────────────

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Peek at the session without issuing a token yet
      const res = await fetch('/api/sessions/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() }),
      });
      const data = await res.json() as { session_id?: string; title?: string; error?: string };

      if (!res.ok) { setError(data.error ?? 'Invalid code'); return; }

      setPreview({
        session_id: data.session_id!,
        title: data.title ?? 'Class session',
        instructor: '',
      });
      setStep('name');
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: enter name + join ─────────────────────────────────────────

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setStep('joining');

    try {
      const res = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase(), name: name.trim() }),
      });
      const data = await res.json() as { session_id?: string; error?: string };

      if (!res.ok) { setError(data.error ?? 'Failed to join'); setStep('name'); return; }

      router.push(`/classroom/${data.session_id}`);
    } catch {
      setError('Network error — please try again');
      setStep('name');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 bg-indigo-400 rounded-xl flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <span className="text-white font-bold text-xl">EduRealtime</span>
      </div>

      <div className="w-full max-w-sm">
        {/* Code entry */}
        {step === 'code' && (
          <div className="bg-white rounded-2xl p-7 shadow-xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Join a class</h1>
            <p className="text-gray-500 text-sm mb-6">Enter the access code from your instructor</p>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                className="w-full text-center text-3xl font-mono font-bold tracking-[0.35em] border-2 border-gray-200 rounded-xl py-4 text-gray-900 focus:outline-none focus:border-indigo-500 uppercase placeholder-gray-200"
                autoFocus
                autoComplete="off"
                spellCheck={false}
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={code.length < 6 || loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Continue
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2">
              <p className="text-xs text-gray-400">Are you an instructor?</p>
              <Link href="/login" className="text-sm text-indigo-600 font-medium hover:underline">
                Sign in with your account →
              </Link>
            </div>
          </div>
        )}

        {/* Name entry */}
        {(step === 'name' || step === 'joining') && (
          <div className="bg-white rounded-2xl p-7 shadow-xl">
            {/* Session preview */}
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 mb-6">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-indigo-900 truncate">
                  {preview?.title ?? 'Class session'}
                </p>
                <p className="text-xs text-indigo-500 font-mono tracking-widest">{code}</p>
              </div>
              <button
                onClick={() => { setStep('code'); setPreview(null); setError(''); }}
                className="text-xs text-indigo-400 hover:text-indigo-600 shrink-0 ml-auto"
              >
                Change
              </button>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-1">What's your name?</h2>
            <p className="text-gray-500 text-sm mb-5">This is how you'll appear in the classroom</p>

            <form onSubmit={handleJoin} className="space-y-4">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 placeholder-gray-300"
                autoFocus
                maxLength={60}
                disabled={step === 'joining'}
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={!name.trim() || step === 'joining'}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                {step === 'joining' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining class…
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Join class
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-4 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              No account needed — you'll join as a guest
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
