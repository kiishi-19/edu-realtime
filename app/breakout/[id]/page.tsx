'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RealtimeKitProvider, useRealtimeKitClient } from '@cloudflare/realtimekit-react';
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui';
import { ArrowLeft, Users2 } from 'lucide-react';

export default function BreakoutPage() {
  const searchParams = useSearchParams();
  const [meeting, initMeeting] = useRealtimeKitClient();
  const [initialized, setInitialized] = useState(false);

  const token = searchParams.get('token');
  // Read room name directly from the URL — avoids sessionStorage which causes
  // SSR/client hydration mismatch (server gets 'Breakout Room', client gets real name)
  const roomName = searchParams.get('name') || 'Breakout Room';

  useEffect(() => {
    if (!token || initialized) return;
    setInitialized(true);
    initMeeting({ authToken: token, defaults: { audio: true, video: true } });
  }, [token, initMeeting, initialized]);

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>Invalid breakout room link</p>
      </div>
    );
  }

  return (
    // h-screen (not min-h-screen) so flex-1 child gets a computable height for mode="fill"
    <div className="h-screen overflow-hidden bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => window.close()}
          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Users2 className="w-4 h-4 text-indigo-400" />
        <p className="text-white text-sm font-medium">{roomName}</p>
        <span className="ml-2 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Breakout Room</span>
      </div>

      {/* Meeting — explicit height so the RTK component fills correctly */}
      <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 48px)' }}>
        {meeting ? (
          <RealtimeKitProvider value={meeting}>
            <RtkMeeting
              mode="fill"
              meeting={meeting}
              showSetupScreen={false}
            />
          </RealtimeKitProvider>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-white space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400 text-sm">Joining breakout room...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
