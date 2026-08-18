# Speech-to-Text (STT) Integration Guide

This document explains how to use the Speech-to-Text functionality integrated into the complaint-tracker frontend.

## Overview

The STT module uses the **Web Speech API** to convert spoken audio to text in real-time. It supports multiple languages and works best in Google Chrome.

## Files

- **`src/lib/audio.ts`** - Core STT functions and types
- **`src/components/SpeechToTextButton.tsx`** - Pre-built React component

## Installation

The STT functions are already integrated into `src/lib/audio.ts`. No additional dependencies needed.

## Usage

### Option 1: Use the Pre-built Component

```tsx
import { SpeechToTextButton } from '../components/SpeechToTextButton';

export function MyPage() {
  return (
    <SpeechToTextButton
      language="en-US"
      onTranscript={(text) => console.log('Interim:', text)}
      onFinalTranscript={(text) => console.log('Final:', text)}
      onError={(error) => console.error('Error:', error)}
    />
  );
}
```

### Option 2: Use Raw Functions

```tsx
import {
  isSTTSupported,
  startSpeechToText,
  stopSpeechToText,
  toggleSpeechToText,
  setSpeechLanguage,
  isRecording
} from '../lib/audio';

export function MyComponent() {
  const handleStart = () => {
    startSpeechToText(
      (text, isFinal) => {
        console.log('Transcript:', text);
        if (isFinal) console.log('✅ Final result:', text);
      },
      (error) => {
        console.error('❌ Error:', error);
      }
    );
  };

  const handleStop = () => {
    stopSpeechToText();
  };

  return (
    <>
      <button onClick={handleStart}>Start Listening</button>
      <button onClick={handleStop}>Stop Listening</button>
    </>
  );
}
```

## API Reference

### `isSTTSupported(): boolean`
Check if the browser supports Speech Recognition.

```ts
if (isSTTSupported()) {
  console.log('STT is available');
}
```

### `startSpeechToText(onResult, onError?): boolean`
Start listening and transcribe speech to text.

**Parameters:**
- `onResult: (text: string, isFinal: boolean) => void` - Called for each result
- `onError?: (error: string) => void` - Called if error occurs

**Returns:** `true` if started successfully

```ts
startSpeechToText(
  (text, isFinal) => {
    console.log(text); // "What is the water cycle"
    if (isFinal) {
      console.log('Complete:', text);
    }
  },
  (error) => {
    console.error('Failed:', error);
  }
);
```

### `stopSpeechToText(): void`
Stop listening.

```ts
stopSpeechToText();
```

### `toggleSpeechToText(onResult, onError?): boolean`
Toggle between start and stop.

```ts
const started = toggleSpeechToText(
  (text, isFinal) => { /* handle */ },
  (error) => { /* handle error */ }
);
console.log(started ? 'Started' : 'Stopped');
```

### `setSpeechLanguage(lang: string): void`
Set the language for recognition.

```ts
setSpeechLanguage('hi-IN'); // Hindi
setSpeechLanguage('en-US'); // English (US)
```

### `getSpeechLanguage(): string`
Get the current language.

```ts
console.log(getSpeechLanguage()); // 'en-US'
```

### `isRecording(): boolean`
Check if currently recording.

```ts
if (isRecording()) {
  console.log('Microphone is active');
}
```

## Supported Languages

| Language | Code |
|----------|------|
| English (US) | `en-US` |
| English (India) | `en-IN` |
| Hindi | `hi-IN` |
| Tamil | `ta-IN` |
| Telugu | `te-IN` |
| Kannada | `kn-IN` |
| Malayalam | `ml-IN` |

## Real-time vs Final Results

The callback receives **two types of results**:

```ts
startSpeechToText((text, isFinal) => {
  if (!isFinal) {
    // Interim result: "What is the wa..."
    console.log('Interim:', text);
  } else {
    // Final result: "What is the water cycle"
    console.log('Final:', text);
  }
});
```

## Error Handling

Common errors:

| Error | Solution |
|-------|----------|
| `no-speech` | User didn't speak. Retry. |
| `not-allowed` | Microphone permission denied. Check browser settings. |
| `audio-capture` | No microphone found. Check device. |
| `network` | Network error. Check connection. |

## Browser Compatibility

- ✅ **Google Chrome** - Full support
- ✅ **Edge** - Full support
- ✅ **Safari** - Limited support (iOS 14.5+)
- ❌ **Firefox** - Not supported

## Example: Voice-Activated Complaint Form

```tsx
import { useState } from 'react';
import { SpeechToTextButton } from '../components/SpeechToTextButton';

export function ComplaintForm() {
  const [complaint, setComplaint] = useState('');

  return (
    <form>
      <textarea
        value={complaint}
        onChange={(e) => setComplaint(e.target.value)}
        placeholder="Type or use voice input..."
      />
      
      <SpeechToTextButton
        language="en-IN"
        onFinalTranscript={(text) => {
          setComplaint(complaint + ' ' + text);
        }}
        onError={(error) => {
          console.error('Mic error:', error);
        }}
      />
      
      <button type="submit">Submit Complaint</button>
    </form>
  );
}
```

## Performance Tips

1. **Stop when done** - Always call `stopSpeechToText()` to free up microphone
2. **Handle errors gracefully** - Provide fallback UI when STT fails
3. **Check browser support** - Use `isSTTSupported()` before rendering
4. **Use keyboard shortcut** - Add Space key binding for quick access

## Troubleshooting

**Microphone not working?**
- Check browser permissions: Settings → Privacy → Microphone
- Try Google Chrome (best support)
- Ensure microphone is connected and enabled

**Only getting interim results?**
- Wait for the user to finish speaking
- `isFinal` becomes `true` when user pauses

**"Not Supported" message?**
- Use Google Chrome or Edge
- Firefox and Safari have limited/no support

## Integration with Gemini API

To combine STT with Gemini AI:

```tsx
import { startSpeechToText } from '../lib/audio';
import { callGemini } from '../lib/api'; // Your Gemini function

async function voiceQuestion() {
  let question = '';
  
  startSpeechToText(
    (text, isFinal) => {
      if (isFinal) {
        question = text;
        // Send to Gemini API
        callGemini(question).then(answer => {
          console.log('Answer:', answer);
        });
      }
    }
  );
}
```

## License

Part of the Complaint Tracker platform. See main README for details.
