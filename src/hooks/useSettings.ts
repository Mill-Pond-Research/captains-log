import { useState, useEffect, useCallback } from 'react';
import { SoundEffectsService } from '../services/SoundEffectsService';
import { TranscriptionService } from '../services/TranscriptionService';

export interface AppSettings {
  language: string;
  model: string;
  soundEnabled: boolean;
  fontSize: number;
  audioPersistenceEnabled: boolean;
}

const STORAGE_KEY = 'captains_log_settings';

const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  model: 'whisper-large-v3-turbo',
  soundEnabled: true,
  fontSize: 18,
  audioPersistenceEnabled: true,
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {
    // ignore malformed storage
  }
  return DEFAULT_SETTINGS;
}

interface UseSettingsReturn {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const applySettings = useCallback((next: AppSettings) => {
    SoundEffectsService.setEnabled(next.soundEnabled);
    TranscriptionService.setAudioPersistence(next.audioPersistenceEnabled);
    document.documentElement.style.setProperty('--font-size-base', `${next.fontSize}px`);
  }, []);

  // Apply on mount.
  useEffect(() => {
    applySettings(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = useCallback(
    (updates: Partial<AppSettings>) => {
      setSettings(prev => {
        const next = { ...prev, ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        applySettings(next);
        return next;
      });
    },
    [applySettings],
  );

  return { settings, updateSettings };
};
