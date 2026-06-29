# Captain's Log

An 80s-inspired voice note dictation and transcription application that provides a unique, efficient, and enjoyable user experience for capturing and managing spoken thoughts, ideas, and notes.

![Captain's Log](/img/captainslog-screenshot.PNG)

## Features

- **Segmented Voice Recording**
  - Start, pause, and resume recording with a single cycle button
  - Each pause sends the current audio segment for transcription immediately
  - Resume works instantly — transcription runs asynchronously in the background
  - Visual feedback with retro-style VU meter (freezes during pause)
  - Spacebar hold-to-record support
  - Countdown timer with pause-aware elapsed-time tracking

- **Groq Whisper Transcription**
  - Automatic voice-to-text via Groq's `whisper-large-v3-turbo` API
  - Per-segment transcription with timestamp-ordered results
  - Confidence scores derived from segment log-probabilities
  - Support for multiple languages (en, es, fr, de)
  - Configurable model selection (turbo vs. accurate)

- **Note Management**
  - Create, edit, and delete log entries
  - Folder organization and tagging system
  - Search with keyword highlighting
  - Note detail modal with full transcription view
  - Edit notes with a textarea (preserves original segments)

- **Audio Persistence & Playback**
  - Recorded segments stored in IndexedDB for playback
  - Audio playback directly within the note detail modal
  - Configurable audio persistence toggle in settings

- **Export & Sharing**
  - Export notes as `.txt` files
  - Copy note text to clipboard with retro "TRANSMIT" animation

- **Retro UI/UX**
  - Authentic 80s computer aesthetic with CRT effects and scanlines
  - Green, amber, and white terminal color schemes
  - Period-appropriate sound effects (toggleable)
  - Adjustable font size (14–24px)
  - Classic terminal-style interface with VT323 monospace font

- **Privacy**
  - Local-first: all data stored in localStorage and IndexedDB
  - No cloud sync — your recordings stay on your device
  - API key stored locally in `.env`

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A [Groq API key](https://console.groq.com/) for speech-to-text
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone the repository:
```powershell
git clone https://github.com/technicalmonk/captains-log.git
cd captains-log
```

2. Install dependencies:
```powershell
npm install
```

3. Create a `.env` file with your Groq API key:
```
VITE_GROQ_API_KEY=your_groq_api_key_here
```

4. Start the development server:
```powershell
npm run dev
```

The application will open in your default browser at `http://localhost:5173`.

### Available Scripts

- `npm run dev` — Runs the app in development mode with Vite
- `npm run build` — Type-checks and builds the app for production
- `npm run preview` — Previews the production build locally
- `npm test` — Runs the test suite (Vitest)
- `npm run test:watch` — Runs tests in watch mode

## Technology Stack

- Frontend: React 19
- Build Tool: Vite 7
- Speech-to-Text: Groq Whisper API (`whisper-large-v3-turbo`)
- Audio Capture: MediaRecorder API
- Audio Storage: IndexedDB
- Data Storage: localStorage
- Styling: CSS Modules with CRT/retro effects
- State Management: React Hooks
- Testing: Vitest + Testing Library

## Configuration

Settings are accessible via the **CONFIGURE** view in the app header:

| Setting | Options | Description |
|---------|---------|-------------|
| Language | en, es, fr, de | Transcription language sent to Groq |
| Model | whisper-large-v3-turbo, whisper-large-v3 | Speed vs. accuracy tradeoff |
| Sound Effects | ON / OFF | Toggle retro beep/startup sounds |
| Font Size | 14–24px | Adjustable base font size |
| Audio Persistence | ON / OFF | Store recorded segments in IndexedDB for playback |

Settings persist in localStorage and apply immediately.

## Recording Flow

```
START RECORDING → click → recording begins, button becomes PAUSE
PAUSE → click → stops current segment, sends audio to Groq,
         transcription appears when ready, button becomes RESUME
RESUME → click → starts new segment, button becomes PAUSE
SAVE LOG → if recording: sends final segment, saves all results as a note
CLEAR LOG → stops recording, discards all transcription and audio
Timer expiry / spacebar release → sends final segment, stops recording
```

## Browser Compatibility

Tested and supported in:
- Chrome (latest 3 versions)
- Firefox (latest 3 versions)
- Safari (latest 2 versions)
- Edge (latest 3 versions)

Note: MediaRecorder and IndexedDB are required. All modern browsers support these APIs.

## Troubleshooting

### Common Issues

1. **Microphone Access**
   - Ensure browser has microphone permissions
   - Check system microphone settings
   - Verify HTTPS if running in production (required for getUserMedia)

2. **Transcription Issues**
   - Confirm `VITE_GROQ_API_KEY` is set in your `.env` file
   - Check internet connection (Groq API requires network access)
   - Very short segments (<10s) are still billed at the 10s minimum by Groq

3. **Build Problems**
   - Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
   - Verify Node.js version: `node --version` (needs v18+)

4. **No Sound Effects**
   - Check the Sound Effects toggle in CONFIGURE settings
   - AudioContext may be suspended until first user interaction (click anywhere)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by 1980s computer systems
- Speech-to-text powered by [Groq](https://groq.com/)
- Built with modern web technologies
