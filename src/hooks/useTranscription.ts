import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TranscriptionService,
} from '../services/TranscriptionService';
import type {
  TranscriptionResult,
  TranscriptionOptions,
} from '../services/TranscriptionService';

const STORAGE_KEY = 'captains_log_transcriptions';

interface UseTranscriptionReturn {
  isListening: boolean;
  isTranscribing: boolean;
  isPaused: boolean;
  isSupported: boolean;
  transcription: TranscriptionResult[];
  signalStrength: number;
  segmentAudioIds: string[];
  startTranscription: (options?: TranscriptionOptions) => Promise<void>;
  stopTranscription: () => void;
  pauseTranscription: () => void;
  resumeTranscription: () => void;
  error: string | null;
  clearTranscription: () => void;
}

export const useTranscription = (): UseTranscriptionReturn => {
  const [service] = useState(() => new TranscriptionService());
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [signalStrength, setSignalStrength] = useState(0);
  const [transcription, setTranscription] = useState<TranscriptionResult[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [error, setError] = useState<string | null>(null);
  const [segmentAudioIds, setSegmentAudioIds] = useState<string[]>([]);

  // Tracks how many segments are currently transcribing so that
  // isTranscribing stays true until every concurrent segment has finished.
  const pendingCount = useRef(0);
  // When set, incoming results/segment audio ids are discarded (used after a
  // clear/save so a final in-flight segment doesn't repopulate state).
  const discardRef = useRef(false);

  const saveToStorage = useCallback((next: TranscriptionResult[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    const handleStart = () => {
      setIsListening(true);
      setIsPaused(false);
      setError(null);
      setSegmentAudioIds([]);
      pendingCount.current = 0;
      setIsTranscribing(false);
      discardRef.current = false;
    };

    const handleTranscribing = () => {
      pendingCount.current += 1;
      setIsTranscribing(true);
    };

    const handleResult = (result: TranscriptionResult) => {
      if (discardRef.current) return;
      // Insert ordered by timestamp so out-of-order async completions
      // still render in the order they were recorded.
      setTranscription(prev => {
        const next = [...prev, result].sort((a, b) => a.timestamp - b.timestamp);
        saveToStorage(next);
        return next;
      });
    };

    const handlePaused = () => {
      setIsPaused(true);
    };

    const handleResumed = () => {
      setIsPaused(false);
    };

    const handleSegmentComplete = (data: { sessionId: string; audioId: string | null }) => {
      pendingCount.current = Math.max(0, pendingCount.current - 1);
      if (pendingCount.current === 0) {
        setIsTranscribing(false);
      }
      if (data.audioId && !discardRef.current) {
        setSegmentAudioIds(prev => [...prev, data.audioId as string]);
      }
    };

    const handleError = (errorData: { error: string; message?: string }) => {
      setError(errorData.message || errorData.error);
      // On error the session is no longer usable.
      setIsListening(false);
      setIsPaused(false);
      setIsTranscribing(false);
      pendingCount.current = 0;
    };

    const handleEnd = () => {
      setIsListening(false);
      setIsPaused(false);
      setIsTranscribing(false);
      pendingCount.current = 0;
      discardRef.current = false;
    };

    const handleAudioLevel = (level: number) => {
      setSignalStrength(level);
    };

    service.on('start', handleStart);
    service.on('transcribing', handleTranscribing);
    service.on('result', handleResult);
    service.on('paused', handlePaused);
    service.on('resumed', handleResumed);
    service.on('segmentcomplete', handleSegmentComplete);
    service.on('error', handleError);
    service.on('end', handleEnd);
    service.on('audiolevel', handleAudioLevel);

    return () => {
      service.removeListener('start', handleStart);
      service.removeListener('transcribing', handleTranscribing);
      service.removeListener('result', handleResult);
      service.removeListener('paused', handlePaused);
      service.removeListener('resumed', handleResumed);
      service.removeListener('segmentcomplete', handleSegmentComplete);
      service.removeListener('error', handleError);
      service.removeListener('end', handleEnd);
      service.removeListener('audiolevel', handleAudioLevel);
    };
  }, [service, saveToStorage]);

  const startTranscription = useCallback(
    async (options?: TranscriptionOptions) => {
      setError(null);
      await service.start(options);
    },
    [service],
  );

  const stopTranscription = useCallback(() => {
    service.stop();
  }, [service]);

  const pauseTranscription = useCallback(() => {
    service.pause();
  }, [service]);

  const resumeTranscription = useCallback(() => {
    service.resume();
  }, [service]);

  const clearTranscription = useCallback(() => {
    discardRef.current = true;
    setTranscription([]);
    setSegmentAudioIds([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    isListening,
    isTranscribing,
    isPaused,
    isSupported: service.isSupported(),
    transcription,
    signalStrength,
    segmentAudioIds,
    startTranscription,
    stopTranscription,
    pauseTranscription,
    resumeTranscription,
    error,
    clearTranscription,
  };
};
