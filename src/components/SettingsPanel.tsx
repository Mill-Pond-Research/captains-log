import React from 'react';
import { useSettings } from '../hooks/useSettings';
import styles from './SettingsPanel.module.css';
import retroStyles from '../styles/RetroEffects.module.css';

export const SettingsPanel: React.FC = () => {
  const { settings, updateSettings } = useSettings();

  const languages = ['en', 'es', 'fr', 'de'];
  const models = [
    { value: 'whisper-large-v3-turbo', label: 'WHISPER LARGE V3 TURBO (FAST)' },
    { value: 'whisper-large-v3', label: 'WHISPER LARGE V3 (ACCURATE)' },
  ];

  return (
    <div className={`${styles.panel} ${retroStyles.retroContainer}`}>
      <h2 className={`${styles.title} ${retroStyles.glowText}`}>SYSTEM CONFIGURATION</h2>

      <div className={`${styles.section} ${retroStyles.pixelated}`}>
        <label className={styles.label}>TRANSCRIPTION LANGUAGE</label>
        <select
          value={settings.language}
          onChange={e => updateSettings({ language: e.target.value })}
          className={`${styles.select} ${retroStyles.retroInput}`}
        >
          {languages.map(lang => (
            <option key={lang} value={lang}>{lang.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div className={`${styles.section} ${retroStyles.pixelated}`}>
        <label className={styles.label}>SPEECH MODEL</label>
        <select
          value={settings.model}
          onChange={e => updateSettings({ model: e.target.value })}
          className={`${styles.select} ${retroStyles.retroInput}`}
        >
          {models.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className={`${styles.section} ${retroStyles.pixelated}`}>
        <label className={styles.label}>SOUND EFFECTS</label>
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleButton} ${settings.soundEnabled ? styles.on : styles.off}`}
            onClick={() => updateSettings({ soundEnabled: true })}
          >
            ON
          </button>
          <button
            className={`${styles.toggleButton} ${!settings.soundEnabled ? styles.on : styles.off}`}
            onClick={() => updateSettings({ soundEnabled: false })}
          >
            OFF
          </button>
        </div>
      </div>

      <div className={`${styles.section} ${retroStyles.pixelated}`}>
        <label className={styles.label}>
          FONT SIZE: <span className={retroStyles.glowText}>{settings.fontSize}px</span>
        </label>
        <input
          type="range"
          min={14}
          max={24}
          step={1}
          value={settings.fontSize}
          onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
          className={styles.slider}
        />
      </div>

      <div className={`${styles.section} ${retroStyles.pixelated}`}>
        <label className={styles.label}>AUDIO PERSISTENCE</label>
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleButton} ${settings.audioPersistenceEnabled ? styles.on : styles.off}`}
            onClick={() => updateSettings({ audioPersistenceEnabled: true })}
          >
            ON
          </button>
          <button
            className={`${styles.toggleButton} ${!settings.audioPersistenceEnabled ? styles.on : styles.off}`}
            onClick={() => updateSettings({ audioPersistenceEnabled: false })}
          >
            OFF
          </button>
        </div>
        <p className={styles.note}>
          STORES RECORDED SEGMENTS IN INDEXEDDB FOR PLAYBACK. NOTE: VERY SHORT
          SEGMENTS (UNDER 10s) MAY STILL BE BILLED AT THE 10s MINIMUM.
        </p>
      </div>
    </div>
  );
};
