// Shared with call-management-service/demo and citizen-service/demo — downsamples
// mic audio to 16kHz mono PCM16, the format call-management-service's live
// transcription WebSocket expects.
export function downsampleTo16kInt16(float32Buffer: Float32Array, inRate: number): Int16Array {
  const outRate = 16000;
  const ratio = inRate / outRate;
  const outLength = Math.floor(float32Buffer.length / ratio);
  const out = new Int16Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, float32Buffer.length - 1);
    const frac = srcIndex - i0;
    const sample = float32Buffer[i0] * (1 - frac) + float32Buffer[i1] * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

/* ═══════════════════════════════════════════════════
   SPEECH-TO-TEXT (STT) — Web Speech API
═══════════════════════════════════════════════════ */

export interface STTState {
  recording: boolean;
  rec: SpeechRecognition | null;
  lang: string;
}

export type STTResultCallback = (text: string, isFinal: boolean) => void;
export type STTErrorCallback = (error: string) => void;

const STT_STATE: STTState = {
  recording: false,
  rec: null,
  lang: 'en-US'
};

export function isSTTSupported(): boolean {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SR;
}

export function startSpeechToText(
  onResult: STTResultCallback,
  onError?: STTErrorCallback
): boolean {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SR) {
    const errorMsg = 'Speech Recognition not supported. Use Google Chrome.';
    onError?.(errorMsg);
    console.error(errorMsg);
    return false;
  }

  STT_STATE.rec = new SR();
  STT_STATE.rec.lang = STT_STATE.lang;
  STT_STATE.rec.interimResults = true;
  STT_STATE.rec.continuous = false;

  STT_STATE.rec.onstart = () => {
    STT_STATE.recording = true;
    console.log('🎤 Listening...');
  };

  STT_STATE.rec.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript + ' ';
      } else {
        interim += transcript;
      }
    }

    const text = final.trim() || interim;
    const isFinal = final.length > 0;
    onResult(text, isFinal);
  };

  STT_STATE.rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    STT_STATE.recording = false;
    const errors: Record<string, string> = {
      'no-speech': 'No speech detected.',
      'not-allowed': 'Microphone permission denied. Allow access in browser settings.',
      'audio-capture': 'Microphone not found.',
      'network': 'Network error.',
      'aborted': 'Speech recognition aborted.'
    };
    const errorMsg = errors[event.error] || `Speech error: ${event.error}`;
    onError?.(errorMsg);
    console.error(errorMsg);
  };

  STT_STATE.rec.onend = () => {
    STT_STATE.recording = false;
  };

  try {
    STT_STATE.rec.start();
    return true;
  } catch (err) {
    const errorMsg = `Failed to start speech recognition: ${err}`;
    onError?.(errorMsg);
    console.error(errorMsg);
    return false;
  }
}

export function stopSpeechToText(): void {
  STT_STATE.recording = false;
  if (STT_STATE.rec) {
    try {
      STT_STATE.rec.stop();
    } catch (err) {
      console.error('Error stopping speech recognition:', err);
    }
    STT_STATE.rec = null;
  }
}

export function toggleSpeechToText(
  onResult: STTResultCallback,
  onError?: STTErrorCallback
): boolean {
  if (STT_STATE.recording) {
    stopSpeechToText();
    return false;
  } else {
    return startSpeechToText(onResult, onError);
  }
}

export function setSpeechLanguage(lang: string): void {
  STT_STATE.lang = lang;
  // Update running recognition if any
  if (STT_STATE.rec) {
    STT_STATE.rec.lang = lang;
  }
}

export function getSpeechLanguage(): string {
  return STT_STATE.lang;
}

export function isRecording(): boolean {
  return STT_STATE.recording;
}
