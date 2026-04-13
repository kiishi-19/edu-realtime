'use client';

import { useState } from 'react';
import { Sparkles, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  sessionId: string;
}

export default function PostSessionSummary({ sessionId }: Props) {
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generateSummary() {
    if (!transcript.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/sessions/${sessionId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate summary');
        return;
      }
      setSummary(data.summary);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function downloadSummary() {
    if (!summary) return;
    const blob = new Blob([summary], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-summary-${sessionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Session Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary ? (
          <>
            <p className="text-sm text-gray-500">
              Paste the session transcript below to generate an AI-powered summary with key topics,
              questions asked, and action items.
            </p>
            <Textarea
              placeholder="Paste transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-32 font-mono text-xs"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button
              onClick={generateSummary}
              disabled={loading || !transcript.trim()}
              className="w-full"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate summary
            </Button>
          </>
        ) : (
          <>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {summary}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadSummary} size="sm">
                <Download className="w-4 h-4" />
                Download
              </Button>
              <Button variant="ghost" onClick={() => setSummary(null)} size="sm">
                Regenerate
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
