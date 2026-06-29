import React, { useEffect, useState } from 'react';
import type { Note } from '../services/NoteManagementService';
import { AudioStorageService } from '../services/AudioStorageService';
import styles from './NoteDetailModal.module.css';
import retroStyles from '../styles/RetroEffects.module.css';

interface NoteDetailModalProps {
  note: Note;
  onClose: () => void;
  onUpdate: (note: Note, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
}

const audioStorage = new AudioStorageService();

function getNoteText(note: Note): string {
  if (note.editedContent != null && note.editedContent.length > 0) {
    return note.editedContent;
  }
  return note.content
    .map(c => `[${new Date(c.timestamp).toLocaleTimeString()}] ${c.text}`)
    .join('\n');
}

function getAverageConfidence(note: Note): number {
  if (!note.content.length) return 0;
  const sum = note.content.reduce((acc, c) => acc + (c.confidence || 0), 0);
  return sum / note.content.length;
}

export const NoteDetailModal: React.FC<NoteDetailModalProps> = ({
  note,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(getNoteText(note));
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitMessage, setTransmitMessage] = useState('');
  const [confirmPurge, setConfirmPurge] = useState(false);

  // Reset internal state when the displayed note changes.
  useEffect(() => {
    setIsEditing(false);
    setDraft(getNoteText(note));
    setConfirmPurge(false);
  }, [note.id]);

  // Load audio blobs from IndexedDB for playback.
  useEffect(() => {
    let cancelled = false;
    const ids = note.audioIds ?? [];
    setAudioUrls([]);
    if (ids.length === 0) return;
    (async () => {
      const urls: string[] = [];
      for (const id of ids) {
        const blob = await audioStorage.getAudio(id);
        if (cancelled) return;
        if (blob) urls.push(URL.createObjectURL(blob));
      }
      if (!cancelled) setAudioUrls(urls);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id, note.audioIds?.join(',')]);

  // Cleanup created object URLs on unmount.
  useEffect(() => {
    return () => {
      audioUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioUrls]);

  const handleSaveEdit = () => {
    onUpdate(note, { editedContent: draft });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setDraft(getNoteText(note));
    setIsEditing(false);
  };

  const handleExportTxt = () => {
    const text = getNoteText(note);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTransmit = async () => {
    setIsTransmitting(true);
    setTransmitMessage('TRANSMITTING...');
    try {
      await navigator.clipboard.writeText(getNoteText(note));
      setTransmitMessage('TRANSMISSION COMPLETE');
    } catch {
      setTransmitMessage('TRANSMISSION FAILED');
    } finally {
      setTimeout(() => {
        setIsTransmitting(false);
        setTransmitMessage('');
      }, 1500);
    }
  };

  const handlePurge = () => {
    if (!confirmPurge) {
      setConfirmPurge(true);
      return;
    }
    onDelete(note.id);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${retroStyles.retroContainer} ${retroStyles.crtEffect}`}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.titleBar}>
          <span className={retroStyles.pixelated}>DATA RETRIEVAL</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.body}>
          <h2 className={`${styles.noteTitle} ${retroStyles.glowText}`}>{note.title}</h2>

          <div className={`${styles.meta} ${retroStyles.pixelated}`}>
            <span>FOLDER: {note.folder}</span>
            <span>CREATED: {new Date(note.createdAt).toLocaleString()}</span>
            <span>CONFIDENCE: {Math.round(getAverageConfidence(note) * 100)}%</span>
            {note.content[0]?.language && (
              <span>LANG: {note.content[0].language}</span>
            )}
          </div>

          {note.tags.length > 0 && (
            <div className={styles.tags}>
              {note.tags.map(tag => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          )}

          {audioUrls.length > 0 && (
            <div className={styles.audioSection}>
              <h3 className={retroStyles.pixelated}>AUDIO RECORDING</h3>
              {audioUrls.map((url, i) => (
                <audio key={i} controls src={url} className={styles.audioPlayer} />
              ))}
            </div>
          )}

          <div className={styles.contentArea}>
            {isEditing ? (
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className={`${styles.textarea} ${retroStyles.retroInput}`}
                rows={12}
              />
            ) : (
              <pre className={styles.contentText}>{getNoteText(note)}</pre>
            )}
          </div>

          <div className={styles.actions}>
            {isEditing ? (
              <>
                <button className={`${styles.button} ${retroStyles.pixelated}`} onClick={handleSaveEdit}>
                  SAVE
                </button>
                <button className={`${styles.button} ${retroStyles.pixelated}`} onClick={handleCancelEdit}>
                  CANCEL
                </button>
              </>
            ) : (
              <button className={`${styles.button} ${retroStyles.pixelated}`} onClick={() => setIsEditing(true)}>
                EDIT
              </button>
            )}
            <button className={`${styles.button} ${retroStyles.pixelated}`} onClick={handleExportTxt}>
              EXPORT TXT
            </button>
            <button
              className={`${styles.button} ${retroStyles.pixelated}`}
              onClick={handleTransmit}
              disabled={isTransmitting}
            >
              {isTransmitting ? transmitMessage : 'TRANSMIT'}
            </button>
            <button
              className={`${styles.button} ${styles.purgeButton} ${retroStyles.pixelated}`}
              onClick={handlePurge}
            >
              {confirmPurge ? 'CONFIRM PURGE' : 'PURGE'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
