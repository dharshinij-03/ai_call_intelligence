import { useRef, useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { citizenApi } from '../../lib/api/citizen';
import { SERVICE_URLS, ICE_SERVERS } from '../../lib/config';
import { downsampleTo16kInt16 } from '../../lib/audio';
import { ErrorBanner } from '../../components/Spinner';

interface TranscriptLine {
  id: number;
  original: string;
  translated: string;
  language: string | null;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en-IN', label: 'English (India)' },
  { code: 'hi-IN', label: 'Hindi (हिंदी)' },
  { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
  { code: 'te-IN', label: 'Telugu (తెలుగు)' },
  { code: 'bn-IN', label: 'Bengali (বাংলা)' },
  { code: 'mr-IN', label: 'Marathi (मराठी)' },
  { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
  { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' },
];

export function CitizenCallPage() {
  const { token } = useAuth();
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [status, setStatus] = useState('Not on a call');
  const [error, setError] = useState<string | null>(null);
  const [onCall, setOnCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState('');
  const [micVolume, setMicVolume] = useState(0);
  const [packetsSent, setPacketsSent] = useState(0);
  const [wsStatus, setWsStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const [lastWsMsg, setLastWsMsg] = useState<string>('None');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Not requested');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalWsRef = useRef<WebSocket | null>(null);
  const transcriptionWsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const callSessionIdRef = useRef<string | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechRecRef = useRef<any>(null);
  const lineIdRef = useRef(0);
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SPEAKING_THRESHOLD = 5; // Volume threshold to detect speaking
  const SPEAKING_TIMEOUT = 1500; // Wait 1.5s after silence to stop recording

  // Request geolocation permission on component mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported');
      return;
    }

    setLocationStatus('Requesting location permission…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus(`📍 Location captured (±${Math.round(position.coords.accuracy)}m)`);
        console.log('[GEOLOCATION] Location obtained:', position.coords);
      },
      (err) => {
        console.warn('[GEOLOCATION] Permission denied or error:', err.message);
        setLocationStatus(`❌ ${err.message}`);
        // Continue anyway - location is optional
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  function cleanup() {
    pcRef.current?.close();
    signalWsRef.current?.close();
    transcriptionWsRef.current?.close();
    if (speakingTimeoutRef.current) {
      clearTimeout(speakingTimeoutRef.current);
      speakingTimeoutRef.current = null;
    }
    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        /* ignore */
      }
      speechRecRef.current = null;
    }
    try {
      processorRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close();
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    signalWsRef.current = null;
    transcriptionWsRef.current = null;
    processorRef.current = null;
    audioContextRef.current = null;
    setOnCall(false);
    setConnecting(false);
  }

  async function startTranscriptionTee(
    stream: MediaStream,
    callSessionId: string,
    location?: { latitude: number; longitude: number; accuracy: number } | null
  ) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioCtx();
    audioContextRef.current = audioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    (window as any)._activeAudioProcessor = processor;
    (window as any)._activeAudioContext = audioContext;

    const wsBaseUrl = SERVICE_URLS.callManagementWs.replace('localhost', '127.0.0.1');
    const lat = location?.latitude;
    const lng = location?.longitude;
    const locationQs = lat != null && lng != null ? `&lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}` : '';
    const url = `${wsBaseUrl}/ws/calls/live?caller_id=${encodeURIComponent(callSessionId)}&language_code=${encodeURIComponent(selectedLang)}${locationQs}`;
    console.log('[TRANSCRIPTION] Connecting to WebSocket:', url);

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    transcriptionWsRef.current = ws;

    let audioQueue: ArrayBuffer[] = [];
    let wsOpen = false;

    setWsStatus('CONNECTING');
    ws.onopen = () => {
      console.log('[TRANSCRIPTION] WebSocket connected, flushing queued audio');
      wsOpen = true;
      setWsStatus('CONNECTED');
      setStatus('Connected to transcription service');
      for (const chunk of audioQueue) {
        ws.send(chunk);
      }
      audioQueue = [];
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      console.log('[TRANSCRIPTION] Message received:', msg);
      setLastWsMsg(JSON.stringify(msg));
      if (msg.type === 'interim') {
        // Only show interim if user is speaking
        if (isUserSpeaking) {
          setInterim(msg.original_text);
        }
      } else if (msg.type === 'final') {
        setInterim('');
        // Only add to transcript if user is/was speaking
        if (isUserSpeaking || micVolume > SPEAKING_THRESHOLD) {
          lineIdRef.current += 1;
          setTranscript((prev) => [
            ...prev,
            {
              id: lineIdRef.current,
              original: msg.original_text,
              translated: msg.translated_text,
              language: msg.detected_language || 'EN',
            },
          ]);
        }
      } else if (msg.type === 'error') {
        setError(msg.message || 'Transcription error');
      } else if (msg.type === 'started') {
        console.log('[TRANSCRIPTION] Call started:', msg.call_id);
      }
    };

    ws.onerror = (e) => {
      console.error('[TRANSCRIPTION] WebSocket error:', e);
      setWsStatus('DISCONNECTED');
    };

    ws.onclose = () => {
      console.log('[TRANSCRIPTION] WebSocket closed');
      wsOpen = false;
      setWsStatus('DISCONNECTED');
    };

    let audioPacketCount = 0;
    processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);

      let sum = 0;
      for (let i = 0; i < input.length; i += 16) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / (input.length / 16));
      const volume = Math.min(100, Math.round(rms * 450));
      setMicVolume(volume);

      // Detect if user is actively speaking based on microphone volume
      if (volume > SPEAKING_THRESHOLD) {
        setIsUserSpeaking(true);
        // Clear any pending silence timeout
        if (speakingTimeoutRef.current) {
          clearTimeout(speakingTimeoutRef.current);
          speakingTimeoutRef.current = null;
        }
      } else if (!speakingTimeoutRef.current) {
        // User is quiet - start a timeout to mark end of speech
        speakingTimeoutRef.current = setTimeout(() => {
          setIsUserSpeaking(false);
          speakingTimeoutRef.current = null;
        }, SPEAKING_TIMEOUT);
      }

      const pcm16 = downsampleTo16kInt16(input, audioContext.sampleRate);
      if (pcm16.length === 0) return;

      const chunk = pcm16.buffer.slice(pcm16.byteOffset, pcm16.byteOffset + pcm16.byteLength);
      audioPacketCount++;
      setPacketsSent(audioPacketCount);

      if (wsOpen) {
        ws.send(chunk as ArrayBuffer);
      } else {
        audioQueue.push(chunk as ArrayBuffer);
        if (audioQueue.length > 1000) {
          audioQueue = audioQueue.slice(-500);
        }
      }
    };

    source.connect(processor);
    const mute = audioContext.createGain();
    mute.gain.value = 0.0001;
    processor.connect(mute);
    mute.connect(audioContext.destination);
  }

  async function startCall() {
    if (!token) return;
    setError(null);
    setConnecting(true);
    setTranscript([]);
    setInterim('');
    setStatus('Requesting an operator…');

    try {
      const session = await citizenApi.requestCall(token, userLocation || undefined);
      callSessionIdRef.current = session.id;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      await startTranscriptionTee(stream, session.id, userLocation);

      // Web Speech API for instant client-side real-time speech display
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        try {
          const rec = new SpeechRec();
          rec.continuous = true;
          rec.interimResults = true;
          rec.maxAlternatives = 1;
          // Set recognition language dynamically based on user selection
          rec.lang = selectedLang;

          rec.onresult = (event: any) => {
            let currentInterim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              const text = res[0].transcript.trim();
              if (!text) continue;
              if (res.isFinal) {
                lineIdRef.current += 1;
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: lineIdRef.current,
                    original: text,
                    translated: text,
                    language: 'Voice (Live)',
                  },
                ]);
                setInterim('');
                if (transcriptionWsRef.current && transcriptionWsRef.current.readyState === WebSocket.OPEN) {
                  transcriptionWsRef.current.send(
                    JSON.stringify({ type: 'client_transcript', is_final: true, text, language: rec.lang || 'en-IN' })
                  );
                }
              } else {
                currentInterim += text + ' ';
                if (transcriptionWsRef.current && transcriptionWsRef.current.readyState === WebSocket.OPEN) {
                  transcriptionWsRef.current.send(
                    JSON.stringify({ type: 'client_transcript', is_final: false, text, language: rec.lang || 'en-IN' })
                  );
                }
              }
            }
            if (currentInterim.trim()) {
              setInterim(currentInterim.trim());
            }
          };

          // Auto-restart on end so recognition runs for the full call duration
          rec.onend = () => {
            if (speechRecRef.current) {
              try { rec.start(); } catch { /* ignore if already ended */ }
            }
          };

          rec.onerror = (e: any) => {
            if (e.error !== 'no-speech') {
              console.log('[WebSpeech API] error:', e.error);
            }
          };

          rec.start();
          speechRecRef.current = rec;
        } catch (err) {
          console.log('[WebSpeech API] not supported in this browser:', err);
        }
      }

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

      const signalWs = new WebSocket(
        `${SERVICE_URLS.citizenWs}/ws/signal/${session.id}?token=${encodeURIComponent(token)}`,
      );
      signalWsRef.current = signalWs;

      signalWs.onopen = () => setStatus('Waiting for an operator to answer…');

      signalWs.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'peer_joined') {
          setStatus('Operator connected — negotiating call…');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          signalWs.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
        } else if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          setStatus('Live call in progress');
          setOnCall(true);
          setConnecting(false);
        } else if (msg.type === 'ice-candidate' && msg.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {
            /* benign */
          }
        } else if (msg.type === 'peer_left' || msg.type === 'hangup') {
          setStatus('Call ended by the operator.');
          cleanup();
        }
      };

      signalWs.onerror = () => setError('Signaling connection error.');
    } catch (err) {
      const message =
        err instanceof Error && /failed to fetch/i.test(err.message)
          ? 'Could not reach the call service. Make sure citizen-service is running on port 8006, then try again.'
          : err instanceof Error
            ? err.message
            : 'Could not start the call.';
      setError(message);
      cleanup();
    }
  }

  async function endCall() {
    if (token && callSessionIdRef.current) {
      await citizenApi.endCall(token, callSessionIdRef.current).catch(() => undefined);
    }
    setStatus('Call ended.');
    cleanup();
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Call an Operator</h1>
          <p className="page-subtitle">
            Speak in any language — your voice is transcribed live and routed automatically to the right department.
          </p>
        </div>
      </div>

      {/* Action buttons + Language Selector */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={startCall}
              disabled={connecting || onCall}
              className="btn btn-success flex items-center gap-2 px-6 py-3 text-base font-semibold"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 4px 14px rgb(5 150 105 / 0.3)', borderRadius: '12px', opacity: (connecting || onCall) ? 0.6 : 1 }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full bg-white"
                style={{ opacity: connecting ? 1 : 0.7, animation: connecting ? 'pulse-ring 1s ease infinite' : 'none' }}
              />
              {connecting ? 'Connecting…' : 'Call an Operator'}
            </button>
            <button
              onClick={endCall}
              disabled={!onCall && !connecting}
              className="btn btn-danger px-6 py-3 text-base font-semibold"
              style={{ borderRadius: '12px', opacity: (!onCall && !connecting) ? 0.5 : 1 }}
            >
              End Call
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Speaking Language:</span>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={onCall || connecting}
              className="bg-transparent text-sm font-bold text-indigo-700 outline-none cursor-pointer disabled:opacity-60"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              {locationStatus.includes('📍') ? '📍 Location' : locationStatus.includes('❌') ? '❌ Location' : '⏳ Location'}
            </span>
            <span className="text-sm font-semibold text-blue-700">{locationStatus}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${onCall ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
          <span>{status}</span>
        </div>
        {(onCall || connecting) && (
          <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-mono font-semibold">
            {packetsSent} audio frames sent
          </span>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      <audio ref={remoteAudioRef} autoPlay />

      {/* NEW PROMINENT LIVE TRANSCRIPTION CONSOLE DISPLAY BOX */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Console Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Real-Time Speech Stream
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-md bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-slate-300">
              WS: {wsStatus}
            </span>
            <button
              onClick={() => setTranscript([])}
              className="text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Clear Log
            </button>
          </div>
        </div>

        {/* Audio Meter Bar */}
        {(onCall || connecting) && (
          <div className="border-b border-slate-800 bg-slate-900/50 px-5 py-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>🎙️ Voice Input Level</span>
              <span>{micVolume}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 transition-all duration-75"
                style={{ width: `${micVolume}%` }}
              />
            </div>
          </div>
        )}

        {/* Live Word Streaming Container */}
        <div className="p-5 space-y-4 min-h-[160px] max-h-[350px] overflow-y-auto">
          {/* Active Interim Word Stream */}
          {interim ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Speaking now…</span>
              </div>
              <p className="text-lg font-medium text-emerald-200 tracking-wide leading-relaxed">
                "{interim}"
                <span className="inline-block w-1.5 h-5 ml-1 bg-emerald-400 animate-pulse align-middle" />
              </p>
            </div>
          ) : (onCall || connecting) && transcript.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center mb-2 text-slate-400">
                🎙️
              </div>
              <p className="text-sm font-medium text-slate-300">Listening to your microphone…</p>
              <p className="text-xs text-slate-500 mt-1">Speak into your mic to see words appear here live.</p>
            </div>
          ) : null}

          {/* Finalized Transcripts List */}
          {transcript.length > 0 && (
            <div className="space-y-3">
              {transcript.map((line, index) => (
                <div
                  key={`${line.id}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-all hover:border-slate-700"
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
                      <span className="font-semibold text-slate-300">EN Translation:</span> {line.translated}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!onCall && !connecting && transcript.length === 0 && !interim && (
            <div className="py-10 text-center text-slate-500 text-sm">
              Click <strong className="text-slate-300 font-semibold">Call an Operator</strong> to start speaking.
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="border-t border-slate-800 bg-slate-950 px-5 py-2.5 text-[11px] font-mono text-slate-500 flex justify-between items-center">
          <span>Engine: Dual OpenAI Whisper + Browser STT</span>
          <span>Last WS Frame: {lastWsMsg.slice(0, 40)}...</span>
        </div>
      </div>
    </div>
  );
}
