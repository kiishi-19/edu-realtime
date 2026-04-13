'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Loader2, Volume2, VolumeX, Mic, MicOff, Square, AlertCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  viaVoice?: boolean;
}

// reviewing = mic stopped, text shown for edit/confirm before sending
type VoiceState = 'idle' | 'listening' | 'reviewing' | 'processing' | 'speaking';

interface TranscriptEntry { speaker: string; text: string; time: string }

interface Props {
  sessionId: string;
  sessionTitle: string;
  transcripts: TranscriptEntry[];
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AIChatPanel({ sessionId, sessionTitle, transcripts }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: `Hi! I'm **EduBot**. Type a question or click the mic to speak to me.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [sttError, setSttError] = useState('');
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const [interimText, setInterimText] = useState(''); // live transcript while listening
  const [reviewText, setReviewText] = useState('');   // editable text in reviewing state

  const scrollRef = useRef<HTMLDivElement>(null);
  const reviewInputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<unknown>(null);
  const finalTranscriptRef = useRef('');  // accumulates final results from continuous recognition
  const userStoppedRef = useRef(false);   // true when the user clicked Stop (vs browser auto-stopping)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ── TTS ────────────────────────────────────────────────────────────────

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (useBrowserTTS && 'speechSynthesis' in window) speechSynthesis.cancel();
    setVoiceState('idle');
  }, [useBrowserTTS]);

  const speak = useCallback(async (text: string) => {
    if (!ttsEnabled) return;
    stopAudio();
    setVoiceState('speaking');

    try {
      const res = await fetch('/api/ai/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const ct = res.headers.get('Content-Type') || '';
        if (ct.includes('audio')) {
          // Real audio from ElevenLabs or Cloudflare TTS
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); setVoiceState('idle'); };
          audio.onerror = () => { URL.revokeObjectURL(url); setVoiceState('idle'); fallbackBrowserTTS(text); };
          await audio.play();
          return;
        }
        // { fallback: true } — no TTS configured server-side
        setUseBrowserTTS(true);
      }
    } catch {
      setUseBrowserTTS(true);
    }

    fallbackBrowserTTS(text);
  }, [ttsEnabled, stopAudio]);

  function fallbackBrowserTTS(text: string) {
    if (!('speechSynthesis' in window)) { setVoiceState('idle'); return; }

    const plain = text
      .replace(/```[\s\S]*?```/g, 'code block.')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\n+/g, ' ');

    const utt = new SpeechSynthesisUtterance(plain.slice(0, 500));
    utt.rate = 0.88;
    utt.pitch = 1.05;

    // Prefer Google / macOS neural voices
    const voices = speechSynthesis.getVoices();
    const preferred = ['Google US English', 'Samantha', 'Alex', 'Google UK English Female'];
    const best = preferred.reduce<SpeechSynthesisVoice | null>((found, name) =>
      found ?? (voices.find((v) => v.name === name) ?? null), null
    ) ?? voices.find((v) => v.lang.startsWith('en')) ?? null;
    if (best) utt.voice = best;

    utt.onend = () => setVoiceState('idle');
    utt.onerror = () => setVoiceState('idle');
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  }

  // ── Speech recognition ─────────────────────────────────────────────────

  type SRResult = ArrayLike<{ transcript: string }> & { isFinal?: boolean };
  type SREvent = { results: ArrayLike<SRResult>; resultIndex: number };
  type AnySR = new () => {
    lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onresult: ((e: SREvent) => void) | null;
    start(): void; stop(): void; abort(): void;
  };

  /** Called when user clicks Stop — just signals the engine to stop.
   *  All state transitions happen in onend once the browser has flushed
   *  any remaining audio into a final onresult event. */
  function stopListening() {
    userStoppedRef.current = true;
    (recognitionRef.current as { stop?: () => void } | null)?.stop?.();
    // Do NOT read finalTranscriptRef here — onresult may still fire after stop()
  }

  function toggleListening() {
    if (voiceState === 'listening') { stopListening(); return; }

    const w = window as Window & { SpeechRecognition?: AnySR; webkitSpeechRecognition?: AnySR };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { setSttError('Speech recognition requires Chrome or Edge.'); return; }

    // Reset state before starting
    finalTranscriptRef.current = '';
    userStoppedRef.current = false;
    setInterimText('');
    setSttError('');

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;  // live partial results shown in banner
    rec.maxAlternatives = 1;
    rec.continuous = true;      // don't stop on natural pauses

    rec.onstart = () => setVoiceState('listening');

    // onresult fires for each new chunk of audio.
    // IMPORTANT: use e.resultIndex — in continuous mode e.results accumulates
    // ALL results (not just new ones), so iterating from 0 would double-count.
    rec.onresult = (e: SREvent) => {
      let interim = '';
      const results = Array.from(e.results) as SRResult[];

      for (let i = e.resultIndex; i < results.length; i++) {
        const text = results[i][0]?.transcript ?? '';
        if (results[i].isFinal) {
          finalTranscriptRef.current +=
            (finalTranscriptRef.current ? ' ' : '') + text.trim();
        } else {
          interim = text;
        }
      }

      // Display everything the browser has recognised so far
      const display = finalTranscriptRef.current
        ? finalTranscriptRef.current + (interim ? ' ' + interim : '')
        : interim;
      setInterimText(display);
    };

    // onend is the SINGLE place we transition out of 'listening'.
    // It fires after stop() AND after the browser flushes the last onresult,
    // so finalTranscriptRef is guaranteed to be complete here.
    rec.onend = () => {
      userStoppedRef.current = false;
      const final = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = '';
      setInterimText('');

      if (final) {
        setReviewText(final);
        setVoiceState('reviewing');
        setTimeout(() => reviewInputRef.current?.focus(), 80);
      } else {
        setVoiceState('idle');
      }
    };

    rec.onerror = (e: { error: string }) => {
      finalTranscriptRef.current = '';
      userStoppedRef.current = false;
      setInterimText('');
      setVoiceState('idle');
      if (e.error === 'not-allowed') setSttError('Microphone permission denied. Check your browser settings.');
      else if (e.error === 'no-speech') setSttError('Nothing detected — try again.');
      else if (e.error !== 'aborted') setSttError(`Voice error: ${e.error}`);
    };

    recognitionRef.current = rec as unknown;
    try { rec.start(); } catch { setSttError('Could not start microphone. Check permissions.'); }
  }

  // ── Send message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string, viaVoice = false) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
      viaVoice,
    };

    const aiId = (Date.now() + 1).toString();
    const aiPlaceholder: Message = { id: aiId, role: 'assistant', content: '', timestamp: new Date() };

    setMessages((prev) => [...prev, userMsg, aiPlaceholder]);
    setInput('');
    setLoading(true);

    const recentTranscript = transcripts.slice(-10).map((t) => `${t.speaker}: ${t.text}`).join('\n');
    const conversationHistory = messages.slice(-8).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          question: text.trim(),
          recent_transcript: recentTranscript || undefined,
          conversation_history: conversationHistory,
          voice_mode: viaVoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: fullText } : m));
      }

      // Speak once complete
      if (ttsEnabled && fullText) speak(fullText);
      else setVoiceState('idle');
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Failed to reach EduBot';
      setMessages((prev) => prev.map((m) => m.id === aiId ? { ...m, content: `Error: ${errText}` } : m));
      setVoiceState('idle');
    } finally {
      setLoading(false);
    }
  }, [loading, messages, transcripts, sessionId, ttsEnabled, speak]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const voiceIcon = {
    idle:       <Mic className="w-5 h-5" />,
    listening:  <Square className="w-4 h-4 fill-current" />,
    reviewing:  <Mic className="w-5 h-5" />,
    processing: <Loader2 className="w-5 h-5 animate-spin" />,
    speaking:   <Volume2 className="w-5 h-5" />,
  }[voiceState];

  const voiceLabel = {
    idle:       'Click to speak',
    listening:  'Stop listening',
    reviewing:  'Record again',
    processing: 'Thinking…',
    speaking:   'Speaking…',
  }[voiceState];

  const voiceColor = {
    idle:       'bg-indigo-600 hover:bg-indigo-500 text-white',
    listening:  'bg-red-600 hover:bg-red-500 text-white animate-pulse',
    reviewing:  'bg-gray-700 hover:bg-gray-600 text-gray-300',
    processing: 'bg-yellow-700 text-white cursor-not-allowed',
    speaking:   'bg-purple-600 hover:bg-purple-500 text-white',
  }[voiceState];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            voiceState === 'speaking' ? 'bg-purple-500' : 'bg-purple-700'
          }`}>
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">EduBot</p>
            <p className="text-xs text-gray-500 capitalize">{voiceState === 'idle' ? 'AI Teaching Assistant' : voiceLabel}</p>
          </div>
        </div>
        <button
          onClick={() => { setTtsEnabled(!ttsEnabled); stopAudio(); }}
          className={`p-1.5 rounded-lg transition-colors ${ttsEnabled ? 'text-purple-400 bg-purple-900/30' : 'text-gray-600 hover:text-gray-400'}`}
          title={ttsEnabled ? 'Mute AI voice' : 'Enable AI voice'}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* Listening indicator — shows live transcript */}
      {voiceState === 'listening' && (
        <div className="mx-3 my-2 shrink-0">
          <div className="flex flex-col gap-2 bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <div className="absolute inset-0 w-3 h-3 bg-red-400 rounded-full animate-ping opacity-75" />
              </div>
              <p className="text-red-300 text-sm font-medium flex-1">Listening… speak naturally</p>
              <button onClick={stopListening} className="text-red-400 hover:text-red-200 p-1" title="Stop and use this text">
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>
            {/* Live transcript preview */}
            {interimText ? (
              <p className="text-sm text-gray-200 italic leading-snug min-h-[1.25rem]">
                "{interimText}<span className="animate-pulse">|</span>"
              </p>
            ) : (
              <p className="text-xs text-red-400/60">Waiting for speech…</p>
            )}
            <p className="text-xs text-red-400/50">Click ■ Stop when done — you can edit before sending</p>
          </div>
        </div>
      )}

      {/* Review panel — editable recognized text with send/re-record */}
      {voiceState === 'reviewing' && (
        <div className="mx-3 my-2 shrink-0 bg-gray-800 border border-indigo-500/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
            <Mic className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="text-xs text-indigo-300 font-medium">You said — edit if needed</span>
          </div>
          <textarea
            ref={reviewInputRef}
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (reviewText.trim()) {
                  setVoiceState('processing');
                  sendMessage(reviewText.trim(), true);
                  setReviewText('');
                }
              }
            }}
            className="w-full bg-transparent text-white text-sm px-3 py-2 resize-none focus:outline-none leading-relaxed"
            rows={Math.min(4, reviewText.split('\n').length + 1)}
          />
          <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-700">
            <button
              onClick={() => {
                setReviewText('');
                setVoiceState('idle');
                // Small delay then restart
                setTimeout(toggleListening, 100);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <Mic className="w-3 h-3" /> Re-record
            </button>
            <span className="flex-1" />
            <p className="text-xs text-gray-600">Shift+Enter for new line</p>
            <button
              onClick={() => {
                if (reviewText.trim()) {
                  setVoiceState('processing');
                  sendMessage(reviewText.trim(), true);
                  setReviewText('');
                }
              }}
              disabled={!reviewText.trim()}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
            >
              <Send className="w-3 h-3" /> Send
            </button>
          </div>
        </div>
      )}

      {/* STT error */}
      {sttError && (
        <div className="mx-3 mb-1 flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 px-3 py-2 rounded-lg shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{sttError}</span>
          <button onClick={() => setSttError('')} className="ml-auto text-amber-500 hover:text-amber-300">✕</button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} isStreaming={loading && msg.id !== '0' && msg.role === 'assistant' && msg.content === ''} />
        ))}
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-gray-800 space-y-2 shrink-0">
        {/* Voice button */}
        <button
          onClick={() => {
            if (voiceState === 'speaking') stopAudio();
            else if (voiceState === 'reviewing') { setReviewText(''); setVoiceState('idle'); setTimeout(toggleListening, 100); }
            else toggleListening();
          }}
          disabled={voiceState === 'processing' || loading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm transition-all ${voiceColor} disabled:opacity-50`}
        >
          {voiceIcon}
          {voiceLabel}
        </button>

        {/* Text input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Or type a question…"
            className="flex-1 bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:outline-none focus:border-purple-500 placeholder-gray-600 min-w-0"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white p-2 rounded-lg transition-colors shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>

        {useBrowserTTS && ttsEnabled && (
          <p className="text-gray-600 text-xs text-center">
            Using browser voice · Add <code className="text-gray-500">ELEVENLABS_API_KEY</code> for natural audio
          </p>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ChatBubble({ message, isStreaming }: { message: Message; isStreaming: boolean }) {
  const isBot = message.role === 'assistant';

  return (
    <div className={`flex gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      {isBot && (
        <div className="w-6 h-6 bg-purple-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${isBot ? 'bg-gray-800 text-gray-100' : 'bg-indigo-600 text-white'}`}>
        {message.viaVoice && (
          <span className="flex items-center gap-1 text-xs opacity-50 mb-1">
            <Mic className="w-2.5 h-2.5" /> voice
          </span>
        )}
        {isStreaming ? (
          <span className="flex gap-1 py-1">
            {[0, 150, 300].map((d) => (
              <span key={d} className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </span>
        ) : (
          <MarkdownText text={message.content} />
        )}
      </div>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```|\*\*.*?\*\*|`.*?`|\n)/g);
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\w+\n/, '');
          return <code key={i} className="block bg-gray-900 rounded p-2 my-1 font-mono text-xs overflow-x-auto whitespace-pre">{code}</code>;
        }
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-gray-700 rounded px-1 font-mono text-xs">{part.slice(1, -1)}</code>;
        if (part === '\n') return <br key={i} />;
        return part;
      })}
    </p>
  );
}
