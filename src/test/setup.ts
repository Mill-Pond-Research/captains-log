import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock AudioContext
class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  createOscillator() {
    return {
      type: 'square',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
  }
  createAnalyser() {
    return {
      fftSize: 32,
      smoothingTimeConstant: 0.8,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteFrequencyData: vi.fn(),
      frequencyBinCount: 16,
    };
  }
  createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

// Mock MediaRecorder
class MockMediaRecorder {
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.onstop?.();
  }
  pause() {
    if (this.state === 'recording') this.state = 'paused';
  }
  resume() {
    if (this.state === 'paused') this.state = 'recording';
  }
  requestData() {
    if (this.ondataavailable && this.state !== 'inactive') {
      this.ondataavailable({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    }
  }
  static isTypeSupported() {
    return true;
  }
}

Object.defineProperty(window, 'AudioContext', {
  value: MockAudioContext,
  writable: true,
});

Object.defineProperty(window, 'MediaRecorder', {
  value: MockMediaRecorder,
  writable: true,
});

// Mock navigator.mediaDevices.getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    }),
  },
  writable: true,
});

// Mock scrollTo
Element.prototype.scrollTo = vi.fn();

// jsdom does not implement URL.createObjectURL/revokeObjectURL.
if (!('createObjectURL' in URL)) {
  (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:mock';
}
if (!('revokeObjectURL' in URL)) {
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
}
