'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';

export default function JoinSessionDialog() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/sessions/join-by-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid join code');
        return;
      }

      setOpen(false);
      router.push(`/classroom/${data.session_id}`);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <LogIn className="w-4 h-4" />
          Join session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Join a session</DialogTitle>
          <DialogDescription>Enter the 6-character code from your instructor</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleJoin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Session code</Label>
            <Input
              id="code"
              placeholder="ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              className="text-center text-2xl font-mono tracking-widest uppercase h-14"
              required
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Join session
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
