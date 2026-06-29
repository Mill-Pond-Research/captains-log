import { AudioStorageService } from './AudioStorageService';

/**
 * Lightweight browser-compatible event emitter (replaces Node's EventEmitter,
 * which is not available in the browser under Vite).
 */
class EventEmitter {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  removeListener(event: string, handler: Function): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach(handler => handler(...args));
  }
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: number;
  sessionId: string;
  language?: string;
}

export interface TranscriptionOptions {
  language?: string;
  model?: string;
  // Kept for backward compatibility — ignored by the new implementation
  continuous?: boolean;
  interimResults?: boolean;
}

interface GroqTranscriptionResponse {
  text: string;
  language?: string;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    avg_logprob?: number;
    no_speech_prob?: number;
  }>;
}

const GROQ_DEFAULT_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_DEFAULT_MODEL = 'whisper-large-v3-turbo';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/**
 * Modern transcription service that uses the browser's MediaRecorder API to
 * capture audio, then sends each recording segment to Groq's Whisper-based
 * speech-to-text endpoint for transcription.
 *
 * Recording is segmented: every PAUSE stops the current MediaRecorder and
 * transcribes that segment; RESUME creates a fresh MediaRecorder on the same
 * stream. This guarantees discrete audio blobs per segment (avoiding the
 * cumulative-buffer ambiguity of `requestData()` across browsers) and lets
 * transcription run asynchronously while the user resumes immediately.
 */
export class TranscriptionService extends EventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private currentSegmentChunks: Blob[] = [];
  private currentSegmentId: string = '';
  private currentSegmentStartTime: number = 0;
  private segmentIds: string[] = [];

  private isRecording: boolean = false;
  private isPaused: boolean = false;
  private shouldRecord: boolean = false;
  private stoppingSession: boolean = false;

  private sessionLanguage: string = '';
  private activeModel: string = GROQ_DEFAULT_MODEL;

  // Audio level analysis (for VU meter)
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrame: number | null = null;

  private audioStorage = new AudioStorageService();

  // Configuration
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private language: string;

  /** Toggled from settings; gates IndexedDB audio persistence. */
  public static audioPersistenceEnabled: boolean = true;

  public static setAudioPersistence(enabled: boolean): void {
    TranscriptionService.audioPersistenceEnabled = enabled;
  }

  constructor(options?: { apiKey?: string; endpoint?: string; model?: string; language?: string }) {
    super();
    this.apiKey =
      options?.apiKey ||
      (import.meta as any).env?.VITE_GROQ_API_KEY ||
      '';
    this.endpoint = options?.endpoint || GROQ_DEFAULT_ENDPOINT;
    this.model = options?.model || GROQ_DEFAULT_MODEL;
    this.language = options?.language || 'en';
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Checks whether the browser supports audio recording and an API key is configured.
   */
  public isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!this.apiKey;
  }

  /** True while a MediaRecorder is actively capturing audio. */
  public get recording(): boolean {
    return this.isRecording;
  }

  /** True while the session is active but paused (not capturing). */
  public get paused(): boolean {
    return this.isPaused;
  }

  /** True while the session is active (recording or paused). */
  public get active(): boolean {
    return this.isRecording || this.isPaused;
  }

  /**
   * Begins recording audio from the microphone.
   * Emits 'start' when recording begins, 'audiolevel' continuously while recording.
   */
  public async start(options: TranscriptionOptions = {}): Promise<void> {
    if (this.active) return;

    if (!this.isSupported()) {
      this.emit('error', {
        error: 'not-supported',
        message: !this.apiKey
          ? 'No API key configured. Set VITE_GROQ_API_KEY in your .env file.'
          : 'MediaRecorder is not supported in this browser.',
      });
      return;
    }

    this.sessionLanguage = options.language || this.language;
    this.activeModel = options.model || this.model;
    this.shouldRecord = true;
    this.stoppingSession = false;
    this.segmentIds = [];
    this.isPaused = false;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
        },
      });
    } catch (err) {
      this.shouldRecord = false;
      this.emit('error', {
        error: 'microphone-access-denied',
        message: err instanceof Error ? err.message : 'Failed to access microphone.',
      });
      return;
    }

    if (!this.shouldRecord) {
      // User stopped before getUserMedia resolved
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
      return;
    }

    this.setupAudioAnalysis(this.mediaStream);

    this.beginSegment();

    this.isRecording = true;
    this.emit('start', {
      timestamp: this.currentSegmentStartTime,
      sessionId: this.currentSegmentId,
    });
  }

  /**
   * Pauses recording: stops the current MediaRecorder, which flushes the
   * segment and triggers async transcription. Emits 'paused' immediately so
   * the UI can resume right away; transcription continues in the background.
   */
  public pause(): void {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.stoppingSession = false;
    if (this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Resumes recording with a fresh MediaRecorder on the same stream.
   * Emits 'resumed'.
   */
  public resume(): void {
    if (!this.isPaused || !this.mediaStream) return;
    this.isPaused = false;
    this.beginSegment();
    this.isRecording = true;
    this.emit('resumed', {
      timestamp: this.currentSegmentStartTime,
      sessionId: this.currentSegmentId,
    });
  }

  /**
   * Stops the session. If actively recording, flushes and transcribes the
   * final segment (awaiting completion) before tearing down. Emits 'end'.
   */
  public stop(): void {
    if (!this.active) return;

    this.shouldRecord = false;
    this.stoppingSession = true;

    if (this.isRecording && this.mediaRecorder) {
      // Stop the recorder; handleRecorderStop awaits the final segment
      // transcription, then tears down and emits 'end'.
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } else {
      // Paused — no pending audio. Tear down immediately.
      this.teardown();
      this.emit('end', { sessionId: this.currentSegmentId });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────

  private beginSegment(): void {
    this.currentSegmentId = this.generateSessionId();
    this.currentSegmentStartTime = Date.now();
    this.currentSegmentChunks = [];
    this.segmentIds.push(this.currentSegmentId);
    this.createRecorder();
    this.mediaRecorder?.start();
  }

  private createRecorder(): void {
    if (!this.mediaStream) return;
    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.mediaStream, { mimeType })
      : new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.currentSegmentChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      void this.handleRecorderStop();
    };
  }

  private async handleRecorderStop(): Promise<void> {
    const chunks = this.currentSegmentChunks;
    const segmentId = this.currentSegmentId;
    const segmentTimestamp = this.currentSegmentStartTime;
    const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
    this.currentSegmentChunks = [];
    this.mediaRecorder = null;
    this.isRecording = false;

    const blob = new Blob(chunks, { type: mimeType });

    if (this.stoppingSession) {
      // Final stop: transcribe the last segment, then tear down + emit 'end'.
      await this.transcribeSegment(blob, segmentId, segmentTimestamp);
      this.teardown();
      this.emit('end', { sessionId: segmentId });
    } else {
      // Pause: kick off async transcription, emit 'paused' immediately.
      void this.transcribeSegment(blob, segmentId, segmentTimestamp);
      this.isPaused = true;
      this.emit('paused', { sessionId: segmentId });
    }
  }

  private async transcribeSegment(
    blob: Blob,
    segmentId: string,
    timestamp: number,
  ): Promise<void> {
    if (blob.size === 0) {
      this.emit('segmentcomplete', { sessionId: segmentId, audioId: null });
      return;
    }

    if (blob.size > MAX_FILE_SIZE) {
      this.emit('error', {
        error: 'file-too-large',
        message: `Segment is ${(blob.size / 1024 / 1024).toFixed(1)} MB. Maximum is 25 MB.`,
      });
      this.emit('segmentcomplete', { sessionId: segmentId, audioId: null });
      return;
    }

    // Persist audio (if enabled) before transcription so the id is ready
    // regardless of whether transcription succeeds.
    let audioId: string | null = null;
    if (TranscriptionService.audioPersistenceEnabled) {
      try {
        audioId = segmentId;
        await this.audioStorage.storeAudio(segmentId, blob);
      } catch {
        audioId = null;
      }
    }

    this.emit('transcribing', { sessionId: segmentId });

    try {
      const formData = new FormData();
      const fileExtension = this.getFileExtension(blob.type);
      formData.append('file', blob, `recording.${fileExtension}`);
      formData.append('model', this.activeModel);
      formData.append('language', this.sessionLanguage);
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', '0');

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData?.error?.message ||
          `Transcription failed with HTTP ${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      const data: GroqTranscriptionResponse = await response.json();

      // Compute an average confidence from segment log probabilities.
      // avg_logprob ranges from ~0 (perfect) to ~-1 (poor).
      // Convert to a 0–1 confidence: confidence = exp(avg_logprob)
      let confidence = 0.9;
      if (data.segments && data.segments.length > 0) {
        const voiced = data.segments.filter(s => (s.no_speech_prob ?? 1) < 0.5);
        const avgLogprob =
          voiced.reduce((acc, s) => acc + (s.avg_logprob ?? -0.3), 0) /
          Math.max(1, voiced.length);
        confidence = Math.max(0, Math.min(1, Math.exp(avgLogprob)));
      }

      const result: TranscriptionResult = {
        text: data.text.trim(),
        confidence,
        isFinal: true,
        timestamp,
        sessionId: segmentId,
        language: data.language || this.sessionLanguage,
      };

      this.emit('result', result);
    } catch (err) {
      this.emit('error', {
        error: 'transcription-failed',
        message: err instanceof Error ? err.message : 'Failed to transcribe audio.',
      });
    }

    this.emit('segmentcomplete', { sessionId: segmentId, audioId });
  }

  private teardown(): void {
    this.stopAudioAnalysis();
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
    this.isRecording = false;
    this.isPaused = false;
    this.shouldRecord = false;
    this.stoppingSession = false;
  }

  private getSupportedMimeType(): string | undefined {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return undefined;
  }

  private setupAudioAnalysis(stream: MediaStream): void {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 32;
      this.analyser.smoothingTimeConstant = 0.8;

      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      const analyze = () => {
        if (this.analyser && this.isRecording) {
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((acc, val) => acc + val, 0) / dataArray.length;
          const normalizedLevel = Math.min(Math.floor((average / 255) * 10), 9);
          this.emit('audiolevel', normalizedLevel);
          this.animationFrame = requestAnimationFrame(analyze);
        }
      };
      analyze();
    } catch (err) {
      console.warn('Audio analysis setup failed — VU meter will be inactive:', err);
    }
  }

  private stopAudioAnalysis(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
    this.emit('audiolevel', 0);
  }

  private getFileExtension(mimeType: string): string {
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('mp4')) return 'mp4';
    return 'webm';
  }

  public getAvailableLanguages(): string[] {
    return [
      'en', // English
      'es', // Spanish
      'fr', // French
      'de', // German
    ];
  }
}
