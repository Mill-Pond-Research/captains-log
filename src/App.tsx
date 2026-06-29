import React, { useState } from 'react';
import './App.css';
import { TranscriptionPanel } from './components/TranscriptionPanel';
import { NoteManagementPanel } from './components/NoteManagementPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Footer, colorSchemes } from './components/Footer';
import type { ColorScheme } from './components/Footer';
import styles from './styles/RetroEffects.module.css';

function App() {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(colorSchemes[0]);
  const [activeView, setActiveView] = useState<'transcription' | 'notes' | 'settings'>('transcription');

  const handleColorSchemeChange = (newScheme: ColorScheme) => {
    setColorScheme(newScheme);
    document.documentElement.style.setProperty('--text-color', newScheme.textColor);
    document.documentElement.style.setProperty('--background-color', newScheme.backgroundColor);
    document.documentElement.style.setProperty('--border-color', newScheme.borderColor);
  };

  return (
    <div className="App" style={{
      '--text-color': colorScheme.textColor,
      '--background-color': colorScheme.backgroundColor,
      '--border-color': colorScheme.borderColor
    } as React.CSSProperties}>
      <header className={`App-header ${styles.retroContainer} ${styles.crtEffect}`}>
        <h1 className={styles.glowText}>CAPTAIN'S LOG</h1>
        <p className={styles.pixelated}>STARDATE {new Date().toLocaleDateString()}</p>
        <div className={styles.viewControls}>
          <button
            className={`${styles.viewButton} ${activeView === 'transcription' ? styles.active : ''}`}
            onClick={() => setActiveView('transcription')}
          >
            RECORD LOG
          </button>
          <button
            className={`${styles.viewButton} ${activeView === 'notes' ? styles.active : ''}`}
            onClick={() => setActiveView('notes')}
          >
            VIEW LOGS
          </button>
          <button
            className={`${styles.viewButton} ${activeView === 'settings' ? styles.active : ''}`}
            onClick={() => setActiveView('settings')}
          >
            CONFIGURE
          </button>
        </div>
      </header>
      <main>
        {activeView === 'transcription' ? (
          <TranscriptionPanel />
        ) : activeView === 'notes' ? (
          <NoteManagementPanel />
        ) : (
          <SettingsPanel />
        )}
      </main>
      <Footer 
        onColorSchemeChange={handleColorSchemeChange}
        currentScheme={colorScheme}
      />
    </div>
  );
}

export default App;
