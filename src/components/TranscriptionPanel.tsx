import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranscription } from '../hooks/useTranscription';
import { useSettings } from '../hooks/useSettings';
import { SoundEffectsService } from '../services/SoundEffectsService';
import styles from './TranscriptionPanel.module.css';
import retroStyles from '../styles/RetroEffects.module.css';
import GlitchEffect from './GlitchEffect';
import { NoteManagementService } from '../services/NoteManagementService';

const MAX_RECORDING_TIME_SECONDS = 60;
const RED_WARNING_THRESHOLD_SECONDS = 10;
const YELLOW_WARNING_THRESHOLD_SECONDS = 20;

const soundEffects = new SoundEffectsService();

export const TranscriptionPanel: React.FC = () => {
  const screenRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const {
    isListening,
    isTranscribing,
    isPaused,
    isSupported,
    transcription,
    signalStrength,
    segmentAudioIds,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    clearTranscription,
    error
  } = useTranscription();

  const [isSpacebarPressed, setIsSpacebarPressed] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(MAX_RECORDING_TIME_SECONDS);
  const [status, setStatus] = useState<'standby' | 'initializing' | 'scanning' | 'processing' | 'paused' | 'ready'>('standby');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteService] = useState(() => new NoteManagementService());
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  const accumulatedRef = useRef(0);
  const segmentStartRef = useRef<number | null>(null);
  const pendingSaveTitleRef = useRef<string | null>(null);

  useEffect(() => {
    soundEffects.playStartupSound();
    const bootTimer = setTimeout(() => {
      setIsBooting(false);
    }, 3000);
    return () => clearTimeout(bootTimer);
  }, []);

  // Track total recorded time across pause/resume cycles (pauses excluded).
  useEffect(() => {
    if (isListening && !isPaused) {
      segmentStartRef.current = Date.now();
    } else if (isPaused && segmentStartRef.current !== null) {
      accumulatedRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    } else if (!isListening) {
      accumulatedRef.current = 0;
      segmentStartRef.current = null;
      setTimeRemaining(MAX_RECORDING_TIME_SECONDS);
    }
  }, [isListening, isPaused]);

  // Countdown — freezes while paused, stops recording when time expires.
  useEffect(() => {
    if (!isListening) return;
    const timer = setInterval(() => {
      if (isPaused || segmentStartRef.current === null) return;
      const elapsedMs = accumulatedRef.current + (Date.now() - segmentStartRef.current);
      const remaining = Math.max(0, MAX_RECORDING_TIME_SECONDS - Math.ceil(elapsedMs / 1000));
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        stopTranscription();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isListening, isPaused, stopTranscription]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (
      event.code === 'Space' &&
      !event.repeat &&
      !isSpacebarPressed &&
      !isListening &&
      !isPaused &&
      !isTranscribing &&
      !isEditingTitle
    ) {
      event.preventDefault();
      setIsSpacebarPressed(true);
      soundEffects.playBeep(1200, 100);
      void startTranscription({
        language: settings.language,
        model: settings.model,
        continuous: true,
        interimResults: true,
      });
    }
  }, [startTranscription, isSpacebarPressed, isListening, isPaused, isTranscribing, isEditingTitle, settings.language, settings.model]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space') {
      event.preventDefault();
      setIsSpacebarPressed(false);
      soundEffects.playBeep(800, 100);
      if (isListening || isPaused) stopTranscription();
    }
  }, [stopTranscription, isListening, isPaused]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    if (isPaused) {
      setStatus('paused');
    } else if (isTranscribing) {
      setStatus('processing');
    } else if (isListening) {
      setStatus('initializing');
      const initTimer = setTimeout(() => {
        setStatus('scanning');
      }, 1000);
      return () => clearTimeout(initTimer);
    } else if (isBooting) {
      setStatus('initializing');
    } else {
      setStatus('ready');
      const standbyTimer = setTimeout(() => {
        setStatus('standby');
      }, 1000);
      return () => clearTimeout(standbyTimer);
    }
  }, [isListening, isPaused, isTranscribing, isBooting]);

  const handleCycle = () => {
    if (!isListening && !isPaused) {
      soundEffects.playBeep(1200, 100);
      void startTranscription({
        language: settings.language,
        model: settings.model,
        continuous: true,
        interimResults: true,
      });
    } else if (isListening && !isPaused) {
      soundEffects.playBeep(800, 100);
      pauseTranscription();
    } else if (isPaused) {
      soundEffects.playBeep(1200, 100);
      resumeTranscription();
    }
  };

  const cycleLabel = !isListening && !isPaused
    ? 'START RECORDING'
    : isListening && !isPaused
      ? 'PAUSE'
      : 'RESUME';

  const handleClear = () => {
    soundEffects.playBeep(600, 100);
    if (isListening || isPaused) stopTranscription();
    clearTranscription();
    setNoteTitle('');
    pendingSaveTitleRef.current = null;
  };

  const commitSave = useCallback((title: string) => {
    noteService.createNote(title, transcription, [], 'Main Memory', segmentAudioIds);
    soundEffects.playBeep(1000, 100);
    clearTranscription();
    setNoteTitle('');
  }, [transcription, segmentAudioIds, noteService, clearTranscription]);

  const handleSaveNote = () => {
    if (!transcription.length) return;
    const title = noteTitle.trim() || `Log Entry ${new Date().toLocaleString()}`;

    if (isListening && !isPaused) {
      // Actively recording: flush the final segment and defer the save until
      // the session ends so the note includes the in-progress segment.
      pendingSaveTitleRef.current = title;
      stopTranscription();
      return;
    }

    // Paused or idle: save now, then stop to release the microphone if active.
    commitSave(title);
    pendingSaveTitleRef.current = null;
    if (isListening || isPaused) stopTranscription();
  };

  // Perform a deferred save once the final segment has landed and the session
  // has ended (stop() awaits the final transcription before emitting 'end').
  useEffect(() => {
    if (pendingSaveTitleRef.current && !isListening && !isTranscribing) {
      const title = pendingSaveTitleRef.current;
      pendingSaveTitleRef.current = null;
      commitSave(title);
    }
  }, [isListening, isTranscribing, transcription, segmentAudioIds, commitSave]);

  useEffect(() => {
    if (screenRef.current) {
      screenRef.current.scrollTo({
        top: screenRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcription]);

  if (!isSupported) {
    return (
      <div className={`${styles.panel} ${retroStyles.retroContainer}`}>
        <div className={retroStyles.glowText}>
          {error || 'ERROR: SPEECH RECOGNITION NOT SUPPORTED ON THIS TERMINAL'}
        </div>
        {!error && (
          <div className={retroStyles.glowText} style={{ fontSize: '14px', marginTop: '8px' }}>
            Set VITE_GROQ_API_KEY in your .env file to enable transcription.
          </div>
        )}
      </div>
    );
  }

  const getLatestTranscription = () => {
    const formattedText = Array.isArray(transcription)
      ? transcription
          .map(t => `[${new Date(t.timestamp).toLocaleTimeString()}] ${t.text}`)
          .join('\n')
      : '';

    return (
      <>
        {formattedText}
        {isTranscribing && (
          <span className={styles.cursorContainer}>
            <span className={styles.cursor} /> TRANSCRIBING...
          </span>
        )}
        {!isTranscribing && (
          <span className={styles.cursorContainer}><span className={styles.cursor} /></span>
        )}
      </>
    );
  };

  const getSignalClass = (index: number) => {
    if (index > signalStrength) return styles.inactive;
    const level = Math.floor((index / 10) * 3);
    const activeClass = styles.active;
    switch (level) {
      case 0:
        return `${activeClass} ${styles.low}`;
      case 1:
        return `${activeClass} ${styles.medium}`;
      case 2:
        return `${activeClass} ${styles.high}`;
      default:
        return styles.inactive;
    }
  };

  const getTimerClass = () => {
    if (!isListening && !isPaused) return '';
    if (timeRemaining <= RED_WARNING_THRESHOLD_SECONDS) return styles.redWarning;
    if (timeRemaining <= YELLOW_WARNING_THRESHOLD_SECONDS) return styles.yellowWarning;
    return styles.normalTime;
  };

  const handleTitleFocus = () => {
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    soundEffects.playBeep(1000, 100);
  };

  return (
    <div className={`${styles.panel} ${retroStyles.retroContainer}`}>
      <div className={`${styles.statusBar} ${retroStyles.pixelated}`}>
        <div className={`${styles.statusText} ${styles[status]} ${retroStyles.pixelated}`}>
          STATUS: {status.toUpperCase()}
        </div>
        <div className={`${styles.timer} ${getTimerClass()} ${retroStyles.glowText}`}>
          {timeRemaining}s
        </div>
        <div className={`${styles.spacebarIndicator} ${retroStyles.crtEffect}`}>
          <div className={`${styles.led} ${isSpacebarPressed ? styles.active : ''}`} />
          <span className={isEditingTitle ? styles.disabled : ''}>SPACE</span>
        </div>
        <div className={styles.signalStrength}>
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className={`${styles.bar} ${getSignalClass(i)} ${retroStyles.crtEffect}`}
            />
          ))}
        </div>
      </div>

      <div ref={screenRef} className={`${styles.screen} ${retroStyles.crtEffect}`}>
        <GlitchEffect>
          {getLatestTranscription()}
        </GlitchEffect>
      </div>

      <div className={styles.controls}>
        <div className={styles.titleRow}>
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            onFocus={handleTitleFocus}
            placeholder="LOG ENTRY TITLE..."
            className={retroStyles.retroInput}
          />
          <button
            onClick={handleSaveTitle}
            className={`${styles.button} ${retroStyles.pixelated}`}
            disabled={!isEditingTitle}
          >
            SAVE TITLE
          </button>
        </div>
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.button} ${isListening || isPaused ? styles.active : ''} ${retroStyles.pixelated}`}
            onClick={handleCycle}
            disabled={isEditingTitle}
          >
            {cycleLabel}
          </button>
          <button
            className={`${styles.button} ${retroStyles.pixelated}`}
            onClick={handleClear}
          >
            CLEAR LOG
          </button>
          <button
            className={`${styles.button} ${retroStyles.pixelated}`}
            onClick={handleSaveNote}
            disabled={transcription.length === 0 || isTranscribing}
          >
            SAVE LOG
          </button>
        </div>
      </div>
    </div>
  );
};
