'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, Loader2, Sparkles } from 'lucide-react';

interface TranscriptEntry { speaker: string; text: string; time: string }
interface LiveCaption { speaker: string; text: string }

interface Props {
  transcripts: TranscriptEntry[];
  liveCaption: LiveCaption | null;
  sessionId: string;
  sessionTitle: string;
}

export default function TranscriptPanel({ transcripts, liveCaption, sessionId, sessionTitle }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveCaptionRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  // Auto-scroll to bottom whenever new text arrives (committed or live)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [transcripts, liveCaption]);

  function downloadTranscript() {
    const text = transcripts
      .map((t) => `[${new Date(t.time).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}] ${t.speaker}: ${t.text}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${sessionTitle.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function generateSummary() {
    if (transcripts.length < 3) return;
    setGenerating(true);
    setSummary(null);
    const transcript = transcripts.map((t) => `${t.speaker}: ${t.text}`).join('\n');
    try {
      const res = await fetch(`/api/sessions/${sessionId}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (res.ok) setSummary(data.summary);
    } finally {
      setGenerating(false);
    }
  }

  const isEmpty = transcripts.length === 0 && !liveCaption;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <p className="text-white text-sm font-medium">Live Transcript</p>
          {liveCaption && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={generateSummary}
            disabled={generating || transcripts.length < 3}
            className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-gray-800 transition-colors"
            title="Generate AI summary"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Summary
          </button>
          <button
            onClick={downloadTranscript}
            disabled={transcripts.length === 0}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-40 hover:bg-gray-800 rounded-lg transition-colors"
            title="Download transcript"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="m-3 p-3 bg-purple-900/30 border border-purple-700/40 rounded-lg text-xs text-purple-200 leading-relaxed max-h-48 overflow-y-auto shrink-0">
          <p className="text-purple-400 font-semibold mb-1 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Summary
          </p>
          <p className="whitespace-pre-wrap">{summary}</p>
        </div>
      )}

      {/* Transcript list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-gray-500 text-sm">No transcript yet</p>
            <p className="text-gray-600 text-xs mt-1">Transcription begins when participants speak</p>
          </div>
        ) : (
          <>
            {/* Committed transcript entries */}
            {transcripts.map((entry, i) => (
              <TranscriptRow
                key={i}
                speaker={entry.speaker}
                text={entry.text}
                time={new Date(entry.time).toLocaleTimeString('en-US', {
                  timeZone: 'America/Chicago',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                dim={!!liveCaption} // dim history while someone is actively speaking
              />
            ))}

            {/* Live caption row — updates in real-time as the speaker talks */}
            {liveCaption && (
              <div ref={liveCaptionRef} className="animate-fade-in">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="text-xs font-medium text-green-400">{liveCaption.speaker}</span>
                  <span className="flex gap-0.5 items-center">
                    <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="w-1 h-1 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '240ms' }} />
                  </span>
                </div>
                <p className="text-white text-sm leading-relaxed">
                  {liveCaption.text}
                  {/* Blinking cursor to indicate active speech */}
                  <span className="inline-block w-0.5 h-4 bg-green-400 ml-0.5 align-middle animate-pulse" />
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TranscriptRow({
  speaker, text, time, dim,
}: {
  speaker: string; text: string; time: string; dim: boolean;
}) {
  return (
    <div className={`transition-opacity duration-300 ${dim ? 'opacity-50' : 'opacity-100'}`}>
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-xs font-medium text-indigo-400">{speaker}</span>
        <span className="text-gray-600 text-xs">{time}</span>
      </div>
      <p className="text-gray-300 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
