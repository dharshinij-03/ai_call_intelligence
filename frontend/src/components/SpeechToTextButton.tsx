import React, { useState, useEffect } from 'react';
import {
  isSTTSupported,
  startSpeechToText,
  stopSpeechToText,
  toggleSpeechToText,
  setSpeechLanguage,
  isRecording
} from '../lib/audio';

interface SpeechToTextButtonProps {
  onTranscript?: (text: string) => void;
  onFinalTranscript?: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const SpeechToTextButton: React.FC<SpeechToTextButtonProps> = ({
  onTranscript,
  onFinalTranscript,
  onError,
  language = 'en-US',
  className = '',
  style = {}
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');

  useEffect(() => {
    setIsSupported(isSTTSupported());
    if (language) {
      setSpeechLanguage(language);
    }
  }, [language]);

  const handleToggle = () => {
    const result = toggleSpeechToText(
      (text, isFinal) => {
        onTranscript?.(text);
        
        if (isFinal) {
          setFinalTranscript(text);
          onFinalTranscript?.(text);
          setIsListening(false);
        }
      },
      (error) => {
        onError?.(error);
        setIsListening(false);
      }
    );

    if (result) {
      setIsListening(true);
      setFinalTranscript('');
    } else {
      setIsListening(false);
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        className={className}
        style={style}
        title="Speech recognition requires Google Chrome"
      >
        🎤 Voice (Not Supported)
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleToggle}
        className={className}
        style={{
          ...style,
          backgroundColor: isListening ? '#ff6b6b' : '#52e09c',
          opacity: isListening ? 1 : 0.8,
          transition: 'all 0.2s ease'
        }}
        aria-pressed={isListening}
        title={isListening ? 'Click to stop listening' : 'Click to start listening'}
      >
        {isListening ? '⏹ Stop' : '🎤 Listen'}
      </button>
      
      {finalTranscript && (
        <div style={{ marginTop: '8px', fontSize: '0.9rem', color: '#dff0e8' }}>
          <strong>You said:</strong> {finalTranscript}
        </div>
      )}
    </div>
  );
};
