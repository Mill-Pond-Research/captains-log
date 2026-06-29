import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TranscriptionPanel } from './TranscriptionPanel';
import { useTranscription } from '../hooks/useTranscription';
import { useSettings } from '../hooks/useSettings';

const defaultSettings = {
  language: 'en',
  model: 'whisper-large-v3-turbo',
  soundEnabled: true,
  fontSize: 18,
  audioPersistenceEnabled: true,
};

// Mock the useTranscription hook
vi.mock('../hooks/useTranscription', () => ({
  useTranscription: vi.fn(),
}));

// Mock the useSettings hook
vi.mock('../hooks/useSettings', () => ({
  useSettings: vi.fn(),
}));

// Mock the SoundEffectsService
vi.mock('../services/SoundEffectsService', () => ({
  SoundEffectsService: vi.fn().mockImplementation(() => ({
    playStartupSound: vi.fn(),
    playBeep: vi.fn(),
    playModemSound: vi.fn(),
    playShutdownSound: vi.fn(),
  })),
}));

function makeTranscriptionReturn(overrides: Record<string, unknown> = {}) {
  return {
    isListening: false,
    isTranscribing: false,
    isPaused: false,
    isSupported: true,
    transcription: [],
    signalStrength: 0,
    segmentAudioIds: [],
    startTranscription: vi.fn().mockResolvedValue(undefined),
    stopTranscription: vi.fn(),
    pauseTranscription: vi.fn(),
    resumeTranscription: vi.fn(),
    error: null,
    clearTranscription: vi.fn(),
    ...overrides,
  };
}

describe('TranscriptionPanel', () => {
  const mockUseTranscription = useTranscription as unknown as ReturnType<typeof vi.fn>;
  const mockUseSettings = useSettings as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockUseSettings.mockReturnValue({ settings: defaultSettings, updateSettings: vi.fn() });
    mockUseTranscription.mockReturnValue(makeTranscriptionReturn());
  });

  test('renders START RECORDING when idle', () => {
    render(<TranscriptionPanel />);
    expect(screen.getByText('START RECORDING')).toBeInTheDocument();
  });

  test('handles unsupported browser case', () => {
    mockUseTranscription.mockReturnValue(makeTranscriptionReturn({ isSupported: false }));
    render(<TranscriptionPanel />);
    expect(screen.getByText(/NOT SUPPORTED ON THIS TERMINAL/i)).toBeInTheDocument();
  });

  test('starts recording when START RECORDING is clicked', () => {
    const startTranscription = vi.fn().mockResolvedValue(undefined);
    mockUseTranscription.mockReturnValue(makeTranscriptionReturn({ startTranscription }));

    render(<TranscriptionPanel />);
    fireEvent.click(screen.getByText('START RECORDING'));
    expect(startTranscription).toHaveBeenCalled();
  });

  test('shows PAUSE and calls pauseTranscription while recording', () => {
    const pauseTranscription = vi.fn();
    mockUseTranscription.mockReturnValue(
      makeTranscriptionReturn({ isListening: true, pauseTranscription }),
    );

    render(<TranscriptionPanel />);
    const button = screen.getByText('PAUSE');
    fireEvent.click(button);
    expect(pauseTranscription).toHaveBeenCalled();
  });

  test('shows RESUME and calls resumeTranscription while paused', () => {
    const resumeTranscription = vi.fn();
    mockUseTranscription.mockReturnValue(
      makeTranscriptionReturn({ isListening: true, isPaused: true, resumeTranscription }),
    );

    render(<TranscriptionPanel />);
    const button = screen.getByText('RESUME');
    fireEvent.click(button);
    expect(resumeTranscription).toHaveBeenCalled();
  });

  test('disables SAVE LOG while transcribing', () => {
    mockUseTranscription.mockReturnValue(
      makeTranscriptionReturn({
        isTranscribing: true,
        transcription: [{ text: 'hi', confidence: 1, isFinal: true, timestamp: 1, sessionId: 's' }],
      }),
    );

    render(<TranscriptionPanel />);
    expect(screen.getByText('SAVE LOG')).toBeDisabled();
  });
});
