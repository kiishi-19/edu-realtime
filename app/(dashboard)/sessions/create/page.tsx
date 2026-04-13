'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CreateSessionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    scheduled_at: '',
    max_students: 50,
    ai_enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; join_code: string; title: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function update(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          scheduled_at: form.scheduled_at || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create session');
        return;
      }

      setCreated(data.session);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    if (created) {
      navigator.clipboard.writeText(created.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (created) {
    return (
      <div className="max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-700">Session created!</CardTitle>
            <CardDescription>Share the join code with your students</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-2">Join code</p>
              <p className="text-5xl font-mono font-bold tracking-[0.3em] text-indigo-600">
                {created.join_code}
              </p>
            </div>
            <Button onClick={copyCode} variant="outline" className="w-full">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy join code'}
            </Button>
            <Button
              onClick={() => router.push(`/classroom/${created.id}`)}
              className="w-full"
            >
              Enter classroom
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/sessions">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create a session</h1>
          <p className="text-sm text-gray-500">Set up your virtual classroom</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Session title *</Label>
              <Input
                id="title"
                placeholder="e.g. Introduction to React Hooks"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What will be covered in this session?"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                className="h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="scheduled_at">Scheduled at</Label>
                <Input
                  id="scheduled_at"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => update('scheduled_at', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max_students">Max students</Label>
                <Input
                  id="max_students"
                  type="number"
                  min={1}
                  max={500}
                  value={form.max_students}
                  onChange={(e) => update('max_students', parseInt(e.target.value))}
                />
              </div>
            </div>

            {/* AI toggle */}
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border border-indigo-100">
              <div>
                <p className="text-sm font-medium text-indigo-900">AI assistant</p>
                <p className="text-xs text-indigo-600">Live transcription, chat bot & summaries</p>
              </div>
              <button
                type="button"
                onClick={() => update('ai_enabled', !form.ai_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.ai_enabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.ai_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create session
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
