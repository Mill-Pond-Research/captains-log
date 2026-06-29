import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, beforeEach } from 'vitest';
import { SettingsPanel } from './SettingsPanel';

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders all configuration controls', () => {
    render(<SettingsPanel />);
    expect(screen.getByText('SYSTEM CONFIGURATION')).toBeInTheDocument();
    expect(screen.getByText('TRANSCRIPTION LANGUAGE')).toBeInTheDocument();
    expect(screen.getByText('SPEECH MODEL')).toBeInTheDocument();
    expect(screen.getByText('SOUND EFFECTS')).toBeInTheDocument();
    expect(screen.getByText(/FONT SIZE/)).toBeInTheDocument();
    expect(screen.getByText('AUDIO PERSISTENCE')).toBeInTheDocument();
    expect(screen.getAllByText('ON').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OFF').length).toBeGreaterThan(0);
  });

  test('changing sound effects to OFF persists to localStorage', () => {
    render(<SettingsPanel />);
    const offButtons = screen.getAllByText('OFF');
    // First OFF toggle is sound effects (second is audio persistence).
    fireEvent.click(offButtons[0]);

    const saved = JSON.parse(localStorage.getItem('captains_log_settings')!);
    expect(saved.soundEnabled).toBe(false);
  });

  test('changing audio persistence to OFF persists to localStorage', () => {
    render(<SettingsPanel />);
    const offButtons = screen.getAllByText('OFF');
    fireEvent.click(offButtons[1]);

    const saved = JSON.parse(localStorage.getItem('captains_log_settings')!);
    expect(saved.audioPersistenceEnabled).toBe(false);
  });

  test('changing language persists to localStorage', () => {
    render(<SettingsPanel />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'es' } });

    const saved = JSON.parse(localStorage.getItem('captains_log_settings')!);
    expect(saved.language).toBe('es');
  });

  test('changing font size persists to localStorage', () => {
    render(<SettingsPanel />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '22' } });

    const saved = JSON.parse(localStorage.getItem('captains_log_settings')!);
    expect(saved.fontSize).toBe(22);
  });
});
