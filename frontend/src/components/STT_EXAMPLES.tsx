/**
 * EXAMPLE: How to Use Speech-to-Text in Complaint Tracker
 * 
 * This file demonstrates real-world usage of the STT (Speech-to-Text)
 * functions integrated into the complaint tracker application.
 */

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 1: Simple Voice Input for Complaint Description
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from 'react';
import { SpeechToTextButton } from '../components/SpeechToTextButton';
import { startSpeechToText, setSpeechLanguage } from '../lib/audio';

export function ComplaintFormWithVoice() {
  const [description, setDescription] = useState('');
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    setIsListening(true);
    startSpeechToText(
      (text, isFinal) => {
        setDescription(text);
        if (isFinal) {
          setIsListening(false);
          console.log('Final complaint:', text);
        }
      },
      (error) => {
        console.error('Voice input error:', error);
        setIsListening(false);
      }
    );
  };

  return (
    <div className="complaint-form">
      <h2>File a Complaint</h2>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          className="form-input"
        />
      </div>

      <div className="form-actions">
        <button onClick={handleVoiceInput} disabled={isListening}>
          {isListening ? '🎤 Listening...' : '🎤 Use Voice'}
        </button>
        <button type="submit">Submit Complaint</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 2: Multi-Language Voice Input (Hindi, Tamil, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export function MultiLanguageComplaint() {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('en-IN');

  const languages = [
    { code: 'en-IN', label: 'English (India)' },
    { code: 'hi-IN', label: 'हिन्दी (Hindi)' },
    { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
    { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  ];

  return (
    <div>
      <label>Language:</label>
      <select
        value={language}
        onChange={(e) => {
          setLanguage(e.target.value);
          setSpeechLanguage(e.target.value);
        }}
        className="form-input"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>

      <label>Describe your complaint in {language}:</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} />

      <SpeechToTextButton
        language={language}
        onFinalTranscript={(text) => {
          setDescription(description + ' ' + text);
        }}
        onError={(error) => alert('Error: ' + error)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 3: Interim Results + Auto-Clear
// ═══════════════════════════════════════════════════════════════════════════

export function LiveTranscription() {
  const [interim, setInterim] = useState('');
  const [final, setFinal] = useState('');

  const handleVoiceWithPreview = () => {
    startSpeechToText(
      (text, isFinal) => {
        if (isFinal) {
          // Append to final text
          setFinal((prev) => prev + ' ' + text);
          setInterim(''); // Clear interim
        } else {
          // Show interim result
          setInterim(text);
        }
      }
    );
  };

  return (
    <div>
      <button onClick={handleVoiceWithPreview}>Start Speaking</button>

      {interim && (
        <p style={{ color: '#888', fontStyle: 'italic' }}>
          You're saying: <strong>{interim}</strong> (listening...)
        </p>
      )}

      {final && (
        <p style={{ color: '#333' }}>
          Transcribed: <strong>{final}</strong>
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 4: Keyboard Shortcut (Space to Start/Stop)
// ═══════════════════════════════════════════════════════════════════════════

export function VoiceWithKeyboardShortcut() {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.ctrlKey) {
        e.preventDefault();
        setRecording(!recording);

        if (!recording) {
          startSpeechToText(
            (transcript, isFinal) => {
              setText(transcript);
              if (isFinal) setRecording(false);
            }
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [recording]);

  return (
    <div>
      <p>Press <kbd>Ctrl + Space</kbd> to start voice input</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Text will appear here or speak..."
      />
      {recording && <p style={{ color: 'red' }}>🎤 Recording...</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 5: Smart Field Population (Ask Questions via Voice)
// ═══════════════════════════════════════════════════════════════════════════

export function SmartVoiceForm() {
  const [fields, setFields] = useState({
    title: '',
    department: '',
    description: '',
  });

  const [currentField, setCurrentField] = useState<keyof typeof fields>('title');

  const handleVoiceInput = (fieldName: keyof typeof fields) => {
    setCurrentField(fieldName);

    startSpeechToText(
      (text, isFinal) => {
        setFields((prev) => ({
          ...prev,
          [fieldName]: isFinal ? text : prev[fieldName] + ' ' + text,
        }));
      }
    );
  };

  return (
    <form>
      <div>
        <label>Complaint Title</label>
        <input
          type="text"
          value={fields.title}
          onChange={(e) => setFields({ ...fields, title: e.target.value })}
          placeholder="e.g., Pothole on Main Street"
        />
        <button
          type="button"
          onClick={() => handleVoiceInput('title')}
          style={{
            backgroundColor: currentField === 'title' ? '#ff6b6b' : '#52e09c',
          }}
        >
          🎤
        </button>
      </div>

      <div>
        <label>Department</label>
        <select
          value={fields.department}
          onChange={(e) => setFields({ ...fields, department: e.target.value })}
        >
          <option value="">Select department...</option>
          <option value="roads">Roads & Infrastructure</option>
          <option value="water">Water Supply</option>
          <option value="waste">Waste Management</option>
        </select>
      </div>

      <div>
        <label>Description</label>
        <textarea
          value={fields.description}
          onChange={(e) => setFields({ ...fields, description: e.target.value })}
          placeholder="Describe the issue in detail..."
        />
        <button
          type="button"
          onClick={() => handleVoiceInput('description')}
          style={{
            backgroundColor: currentField === 'description' ? '#ff6b6b' : '#52e09c',
          }}
        >
          🎤
        </button>
      </div>

      <button type="submit">Submit</button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 6: Error Handling + Retry Logic
// ═══════════════════════════════════════════════════════════════════════════

export function RobustVoiceInput() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  const handleVoiceWithRetry = () => {
    if (retryCount >= MAX_RETRIES) {
      setError('Max retries reached. Please try typing instead.');
      return;
    }

    startSpeechToText(
      (transcript, isFinal) => {
        setText(transcript);
        if (isFinal) setError('');
      },
      (errorMsg) => {
        setError(errorMsg);
        setRetryCount((prev) => prev + 1);
      }
    );
  };

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Speak or type..."
      />

      <button onClick={handleVoiceWithRetry}>
        🎤 Try Voice
      </button>

      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>
          <p>❌ {error}</p>
          <p>
            Retry {retryCount}/{MAX_RETRIES}
          </p>
          {retryCount < MAX_RETRIES && (
            <button onClick={handleVoiceWithRetry}>Retry Voice Input</button>
          )}
        </div>
      )}

      <hr />

      <label>
        <input type="checkbox" />
        I prefer to type instead
      </label>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE 7: Voice + Gemini AI Integration
// ═══════════════════════════════════════════════════════════════════════════

export async function VoiceToAIAnswer() {
  const [question, setQuestion] = useState('');
  const [answer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVoiceQuestion = async () => {
    let voiceQuestion = '';

    // Capture voice input
    await new Promise<void>((resolve) => {
      startSpeechToText(
        (text, isFinal) => {
          if (isFinal) {
            voiceQuestion = text;
            setQuestion(text);
            resolve();
          }
        }
      );
    });

    if (!voiceQuestion) return;

    // Send to Gemini API
    setLoading(true);
    try {
      // Assuming you have a Gemini API function
      // const response = await callGemini(voiceQuestion);
      // setAnswer(response);
      console.log('Would send to Gemini:', voiceQuestion);
    } catch (err) {
      console.error('Gemini error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleVoiceQuestion} disabled={loading}>
        {loading ? '⏳ Asking AI...' : '🎤 Ask a Question'}
      </button>

      {question && <p>Your question: {question}</p>}
      {answer && <p>AI Answer: {answer}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Export all examples
// ═══════════════════════════════════════════════════════════════════════════

export const STT_EXAMPLES = {
  ComplaintFormWithVoice,
  MultiLanguageComplaint,
  LiveTranscription,
  VoiceWithKeyboardShortcut,
  SmartVoiceForm,
  RobustVoiceInput,
  VoiceToAIAnswer,
};
