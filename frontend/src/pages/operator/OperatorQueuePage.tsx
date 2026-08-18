import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { citizenApi } from '../../lib/api/citizen';
import { callAnalysisApi } from '../../lib/api/callAnalysis';
import { assignmentApi } from '../../lib/api/assignment';
import { SERVICE_URLS, ICE_SERVERS } from '../../lib/config';
import { ErrorBanner } from '../../components/Spinner';
import { UrgencyBadge, StatusBadge } from '../../components/Badge';
import { formatDateTime, formatRelative } from '../../lib/format';
import type { CallAnalysisOut, AssignmentOut } from '../../lib/types';
import {
  Brain,
  Sparkles,
  Building2,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  PhoneCall,
  Headphones,
  MapPin,
  History,
  FileText
} from 'lucide-react';

interface QueueEntry {
  call_session_id: string;
  citizen_name: string;
  requested_at: string;
}

interface TranscriptLine {
  id: number;
  original: string;
  translated: string;
  language: string | null;
}

interface AISummaryData {
  callId: string;
  analysis?: CallAnalysisOut;
  assignment?: AssignmentOut;
  loading: boolean;
  error?: string;
}

export function OperatorQueuePage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<Record<string, QueueEntry>>({});
  const [status, setStatus] = useState('Watching the queue…');
  const [error, setError] = useState<string | null>(null);
  const [onCall, setOnCall] = useState(false);
  const [activeCitizen, setActiveCitizen] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const [wsListenStatus, setWsListenStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'WAITING'>('DISCONNECTED');
  const [aiSummary, setAiSummary] = useState<AISummaryData | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const queueWsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalWsRef = useRef<WebSocket | null>(null);
  const transcriptionWsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callSessionIdRef = useRef<string | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const lineIdRef = useRef(0);

  // Auto-scroll to bottom when new transcript appears
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interim]);

  useEffect(() => {
    if (!token) return;

    // 1. Initial REST fetch of queue
    citizenApi.queue(token)
      .then((items) => {
        const initialMap: Record<string, QueueEntry> = {};
        for (const item of items) {
          initialMap[item.id] = {
            call_session_id: item.id,
            citizen_name: item.citizen_name || 'Citizen',
            requested_at: item.requested_at,
          };
        }
        setQueue(initialMap);
      })
      .catch(() => undefined);

    // 2. Connect WebSocket for live updates
    const ws = new WebSocket(`${SERVICE_URLS.citizenWs}/ws/operator-queue?token=${encodeURIComponent(token)}`);
    queueWsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'call_waiting') {
        setQueue((prev) => ({ ...prev, [msg.call_session_id]: msg }));
      } else if (msg.type === 'call_claimed') {
        setQueue((prev) => {
          const next = { ...prev };
          delete next[msg.call_session_id];
          return next;
        });
      }
    };

    ws.onerror = () => {
      console.warn('[OPERATOR] Queue WS error — polling fallback active');
    };

    // 3. Fallback poll every 5s
    const interval = setInterval(() => {
      citizenApi.queue(token)
        .then((items) => {
          const updatedMap: Record<string, QueueEntry> = {};
          for (const item of items) {
            updatedMap[item.id] = {
              call_session_id: item.id,
              citizen_name: item.citizen_name || 'Citizen',
              requested_at: item.requested_at,
            };
          }
          setQueue(updatedMap);
        })
        .catch(() => undefined);
    }, 5000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, [token]);

  async function fetchAiSummary(callId: string) {
    setAiSummary({ callId, loading: true });
    try {
      let analysis: CallAnalysisOut | undefined;
      let assignment: AssignmentOut | undefined;

      // 1. Try fetching existing analysis
      try {
        analysis = await callAnalysisApi.getAnalysis(callId);
      } catch {
        // 2. If no analysis exists yet, automatically trigger analysis
        try {
          const res = await fetch(`${SERVICE_URLS.callAnalysis}/analyze/${callId}`, { method: 'POST' });
          if (res.ok) {
            analysis = await res.json();
          }
        } catch {
          /* ignore */
        }
      }

      // 3. Fetch or trigger department assignment routing
      if (analysis) {
        try {
          assignment = await assignmentApi.getAssignment(callId);
        } catch {
          try {
            assignment = await assignmentApi.route(callId);
          } catch {
            /* ignore */
          }
        }
      }

      if (!analysis) {
        setAiSummary({
          callId,
          loading: false,
          error: 'Speech analysis is currently generating for this call. Please wait a moment or click Refresh.',
        });
        return;
      }

      setAiSummary({ callId, analysis, assignment, loading: false });
    } catch {
      setAiSummary({
        callId,
        loading: false,
        error: 'Unable to retrieve AI analysis. Click Refresh to try again.',
      });
    }
  }

  function cleanupCall() {
    pcRef.current?.close();
    signalWsRef.current?.close();
    transcriptionWsRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    signalWsRef.current = null;
    transcriptionWsRef.current = null;
    setOnCall(false);
    setActiveCitizen(null);
    setWsListenStatus('DISCONNECTED');

    // Trigger AI analysis + summary when call ends
    if (callSessionIdRef.current) {
      void fetchAiSummary(callSessionIdRef.current);
    }
  }

  function startListeningToTranscription(callSessionId: string) {
    const wsUrl = `${SERVICE_URLS.callManagementWs.replace('localhost', '127.0.0.1')}/ws/calls/live?listen_only=true&call_id=${callSessionId}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    transcriptionWsRef.current = ws;
    setWsListenStatus('WAITING');

    ws.onopen = () => {
      console.log('[OPERATOR] Listening to transcription WS:', wsUrl);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'started') {
        setWsListenStatus(msg.waiting ? 'WAITING' : 'CONNECTED');
      } else if (msg.type === 'interim') {
        setWsListenStatus('CONNECTED');
        setInterim(msg.original_text || '');
      } else if (msg.type === 'final') {
        setWsListenStatus('CONNECTED');
        setInterim('');
        lineIdRef.current += 1;
        setTranscript((prev) => [
          ...prev,
          {
            id: lineIdRef.current,
            original: msg.original_text,
            translated: msg.translated_text,
            language: msg.detected_language,
          },
        ]);
        // Update live preview (don't trigger analysis — just show what exists)
        if (callSessionIdRef.current) {
          void fetchAiSummary(callSessionIdRef.current);
        }
      } else if (msg.type === 'call_ended') {
        setWsListenStatus('DISCONNECTED');
        setInterim('');
        // Call ended — trigger full AI analysis
        if (callSessionIdRef.current) {
          void fetchAiSummary(callSessionIdRef.current);
        }
      }
    };

    ws.onerror = () => setWsListenStatus('DISCONNECTED');
    ws.onclose = () => setWsListenStatus('DISCONNECTED');
  }

  async function acceptCall(id: string, citizenName: string) {
    if (!token) return;
    setError(null);
    try {
      await citizenApi.acceptCall(token, id);
    } catch {
      setError('Failed to accept — someone else may have taken it.');
      return;
    }
    callSessionIdRef.current = id;
    setQueue((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveCitizen(citizenName);
    setTranscript([]);
    setInterim('');
    lineIdRef.current = 0;
    startListeningToTranscription(id);
    void fetchAiSummary(id);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
      };
      pc.onicecandidate = (event) => {
        if (event.candidate && signalWsRef.current?.readyState === WebSocket.OPEN) {
          signalWsRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
      };

      const signalWs = new WebSocket(`${SERVICE_URLS.citizenWs}/ws/signal/${id}?token=${encodeURIComponent(token)}`);
      signalWsRef.current = signalWs;
      setStatus('Connecting to citizen…');

      signalWs.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          signalWs.send(JSON.stringify({ type: 'answer', sdp: pc.localDescription }));
          setStatus('Live call in progress');
          setOnCall(true);
        } else if (msg.type === 'ice-candidate' && msg.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            /* benign */
          }
        } else if (msg.type === 'peer_left' || msg.type === 'hangup') {
          setStatus('Call ended by the citizen.');
          cleanupCall();
        }
      };
      signalWs.onerror = () => setError('Signaling connection error.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied.');
      cleanupCall();
    }
  }

  async function endCall() {
    if (token && callSessionIdRef.current) {
      await citizenApi.endCall(token, callSessionIdRef.current).catch(() => undefined);
    }
    setStatus('Call ended.');
    cleanupCall();
  }

  const allEntries = Object.values(queue);
  const nowMs = Date.now();

  // Active waiting calls: requested within the last 30 minutes
  const activeWaitingCalls = allEntries.filter((c) => {
    const ageMs = nowMs - new Date(c.requested_at).getTime();
    return ageMs < 30 * 60 * 1000;
  });

  // Past call history: requested more than 30 minutes ago
  const pastCalls = allEntries.filter((c) => {
    const ageMs = nowMs - new Date(c.requested_at).getTime();
    return ageMs >= 30 * 60 * 1000;
  });

  const wsStatusColor =
    wsListenStatus === 'CONNECTED' ? 'bg-emerald-500' :
    wsListenStatus === 'WAITING' ? 'bg-yellow-400 animate-pulse' :
    'bg-slate-500';

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Operator Console</h1>
          <p className="page-subtitle">
            Accept active waiting calls, monitor live speech transcripts, and review AI summaries sent to officers.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Active Queue ({activeWaitingCalls.length})
        </div>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Active Waiting Calls Panel */}
      <div className="card overflow-hidden animate-fade-in-up">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones size={18} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-800">Waiting Calls (Live Now)</h2>
          </div>
          <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200">
            {activeWaitingCalls.length} waiting
          </span>
        </div>
        <div className="p-5">
          {activeWaitingCalls.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              No active calls waiting right now — all clear.
            </div>
          ) : (
            <div className="space-y-3">
              {activeWaitingCalls.map((c) => (
                <div
                  key={c.call_session_id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all hover:border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                      <PhoneCall size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{c.citizen_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Waiting {formatRelative(c.requested_at)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => acceptCall(c.call_session_id, c.citizen_name)}
                    disabled={onCall}
                    className="btn btn-success btn-sm"
                  >
                    Accept Call
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Call Panel */}
      {(onCall || activeCitizen) && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Call status bar */}
          <div className="card p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${onCall ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {activeCitizen ? `Citizen: ${activeCitizen}` : 'Active Call'}
                </p>
                <p className="text-xs text-slate-500">{status}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {callSessionIdRef.current && (
                <button
                  onClick={() => callSessionIdRef.current && fetchAiSummary(callSessionIdRef.current)}
                  className="btn btn-secondary btn-xs flex items-center gap-1.5"
                >
                  <Sparkles size={13} className="text-indigo-500" />
                  Analyze Live
                </button>
              )}
              <button
                onClick={endCall}
                disabled={!onCall}
                className="btn btn-danger btn-sm"
              >
                End Call
              </button>
            </div>
          </div>

          <audio ref={remoteAudioRef} autoPlay />

          {/* LIVE TRANSCRIPT CONSOLE */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${wsListenStatus === 'CONNECTED' ? 'animate-ping bg-emerald-400' : wsListenStatus === 'WAITING' ? 'animate-pulse bg-yellow-400' : 'bg-slate-600'}`} />
                  <span className={`relative inline-flex h-3 w-3 rounded-full ${wsStatusColor}`} />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Citizen Live Transcript Feed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-md px-2.5 py-1 text-[11px] font-mono font-semibold ${
                  wsListenStatus === 'CONNECTED' ? 'bg-emerald-900/50 text-emerald-300' :
                  wsListenStatus === 'WAITING' ? 'bg-yellow-900/50 text-yellow-300' :
                  'bg-slate-800 text-slate-400'
                }`}>
                  {wsListenStatus}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {transcript.length} segments
                </span>
                <button
                  onClick={() => setTranscript([])}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 min-h-[180px] max-h-[360px] overflow-y-auto">
              {interim ? (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/30 p-4">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-yellow-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
                    <span>Citizen speaking now…</span>
                  </div>
                  <p className="text-lg font-medium text-yellow-100 tracking-wide leading-relaxed">
                    "{interim}"
                    <span className="inline-block w-1.5 h-5 ml-1 bg-yellow-400 animate-pulse align-middle" />
                  </p>
                </div>
              ) : wsListenStatus === 'WAITING' ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-10 w-10 rounded-full bg-yellow-900/40 flex items-center justify-center mb-2 text-yellow-400 text-xl animate-pulse">
                    ⏳
                  </div>
                  <p className="text-sm font-medium text-slate-300">Waiting for citizen to speak…</p>
                  <p className="text-xs text-slate-500 mt-1">Transcript will appear here instantly as they talk.</p>
                </div>
              ) : transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center mb-2 text-slate-400">
                    🎙️
                  </div>
                  <p className="text-sm font-medium text-slate-300">Listening to citizen microphone…</p>
                  <p className="text-xs text-slate-500 mt-1">Speech transcripts appear here in real time.</p>
                </div>
              ) : null}

              {transcript.length > 0 && (
                <div className="space-y-3">
                  {transcript.map((line, index) => (
                    <div
                      key={`${line.id}-${index}`}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-slate-700 transition-colors"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                          {line.language || 'EN'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">#{line.id}</span>
                      </div>
                      <p className="text-base font-semibold text-slate-100">{line.original}</p>
                      {line.translated && line.translated !== line.original && (
                        <p className="mt-1.5 text-xs text-slate-400 border-t border-slate-800/80 pt-1.5">
                          <span className="font-semibold text-slate-300">EN:</span> {line.translated}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <div className="border-t border-slate-800 bg-slate-950 px-5 py-2.5 text-[11px] font-mono text-slate-500 flex justify-between items-center">
              <span>Source: OpenAI Whisper · Pub/sub broadcast stream</span>
              <span>{transcript.length} finalized segments</span>
            </div>
          </div>
        </div>
      )}

      {/* AI SUMMARY CARD SENT TO OFFICER */}
      {aiSummary && (
        <div className="card p-6 border-2 border-indigo-100 bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 animate-fade-in-up">
          <div className="flex items-center justify-between mb-4 border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Brain size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 text-base">AI Summary Sent to Department Officer</h2>
                  <span className="badge bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">
                    Live Routing
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  This summary & department assignment has been transmitted to the officer's portal.
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchAiSummary(aiSummary.callId)}
              disabled={aiSummary.loading}
              className="btn btn-secondary btn-xs flex items-center gap-1.5"
            >
              <RefreshCw size={12} className={aiSummary.loading ? 'animate-spin' : ''} />
              {aiSummary.loading ? 'Updating…' : 'Refresh'}
            </button>
          </div>

          {aiSummary.loading && (
            <div className="py-6 text-center text-sm text-indigo-600 font-medium animate-pulse flex items-center justify-center gap-2">
              <Sparkles size={16} /> Generating AI complaint summary and routing officer…
            </div>
          )}

          {aiSummary.error && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 mb-0.5">Speech Analysis Pending</p>
                <p className="text-amber-700">{aiSummary.error}</p>
              </div>
            </div>
          )}

          {aiSummary.analysis && (
            <div className="space-y-4">
              {/* Summary quote box */}
              <div className="rounded-xl bg-white border border-indigo-100 p-4 shadow-sm">
                <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                  <Sparkles size={13} /> Complaint Summary
                </div>
                <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                  "{aiSummary.analysis.summary}"
                </p>
              </div>

              {/* Department & Officer Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Building2 size={11} /> Department
                  </div>
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {aiSummary.analysis.department}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <User size={11} /> Assigned Officer
                  </div>
                  <div className="text-xs font-bold text-indigo-600 truncate">
                    {aiSummary.assignment?.officer_name || 'Unassigned (Pending Staff)'}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> Urgency
                  </div>
                  <div>
                    <UrgencyBadge urgency={aiSummary.analysis.urgency} />
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <CheckCircle2 size={11} /> Status
                  </div>
                  <div>
                    <StatusBadge status={aiSummary.assignment?.status || 'ASSIGNED'} />
                  </div>
                </div>
              </div>

              {/* Location & SLA Details */}
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 bg-white/70 p-3 rounded-xl border border-slate-200">
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-slate-400" />
                  Location: <strong className="text-slate-700 font-semibold">{aiSummary.analysis.location || 'City Center'}</strong>
                </span>
                {aiSummary.assignment?.sla_due_at && (
                  <span className="flex items-center gap-1">
                    <Clock size={13} className="text-slate-400" />
                    SLA Deadline: <strong className="text-indigo-600 font-semibold">{formatDateTime(aiSummary.assignment.sla_due_at)}</strong>
                  </span>
                )}
              </div>

              {/* AI Reasoning */}
              {aiSummary.analysis.reasoning && (
                <div className="text-xs text-slate-500 border-t border-indigo-100 pt-3">
                  <span className="font-semibold text-slate-700">AI Routing Rationale:</span> {aiSummary.analysis.reasoning}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Call History & AI Summaries Section */}
      {pastCalls.length > 0 && (
        <div className="card overflow-hidden animate-fade-in-up">
          <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Call History & Past Summaries</h2>
            </div>
            <span className="text-xs text-slate-400 font-medium">{pastCalls.length} past calls</span>
          </div>
          <div className="p-5 divide-y divide-slate-100">
            {pastCalls.map((c) => (
              <div
                key={c.call_session_id}
                className="flex flex-wrap items-center justify-between py-3 gap-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{c.citizen_name}</p>
                    <p className="text-xs text-slate-400">Called {formatRelative(c.requested_at)}</p>
                  </div>
                </div>
                <button
                  onClick={() => fetchAiSummary(c.call_session_id)}
                  disabled={aiSummary?.loading && aiSummary.callId === c.call_session_id}
                  className="btn btn-ghost btn-xs flex items-center gap-1.5"
                >
                  <Brain size={13} />
                  {aiSummary?.callId === c.call_session_id ? 'Viewing AI Summary' : 'View AI Summary'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
