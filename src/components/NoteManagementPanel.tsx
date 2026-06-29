import React, { useState, useEffect } from 'react';
import { NoteManagementService } from '../services/NoteManagementService';
import type { Note, NoteFilter, NoteSortOptions } from '../services/NoteManagementService';
import { AudioStorageService } from '../services/AudioStorageService';
import { NoteDetailModal } from './NoteDetailModal';
import styles from './NoteManagementPanel.module.css';
import retroStyles from '../styles/RetroEffects.module.css';

interface NoteManagementPanelProps {}

const audioStorage = new AudioStorageService();

function getNotePreview(note: Note): string {
  if (note.editedContent != null && note.editedContent.length > 0) {
    return note.editedContent;
  }
  return note.content.map(c => c.text).join(' ');
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${safe})`, 'gi');
  const parts = text.split(regex);
  const queryLower = query.toLowerCase();
  return parts.map((part, i) =>
    part.toLowerCase() === queryLower ? (
      <mark key={i} className={styles.highlight}>{part}</mark>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export const NoteManagementPanel: React.FC<NoteManagementPanelProps> = () => {
  const [noteService] = useState(() => new NoteManagementService());
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [detailNote, setDetailNote] = useState<Note | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<NoteFilter>({});
  const [sort, setSort] = useState<NoteSortOptions>({ field: 'updatedAt', direction: 'desc' });
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newFolder, setNewFolder] = useState('');

  useEffect(() => {
    refreshNotes();
    setFolders(noteService.getFolders());
    setTags(noteService.getAllTags());
  }, [filter, sort]);

  const refreshNotes = () => {
    setNotes(noteService.getNotes(filter, sort));
  };

  const handleCreateNote = () => {
    if (!newNoteTitle.trim()) return;

    const note = noteService.createNote(newNoteTitle, [], [], filter.folder || 'Main Memory');
    setNewNoteTitle('');
    refreshNotes();
    setSelectedNote(note);
  };

  const handleDeleteNote = (id: string) => {
    const note = noteService.getNote(id);
    if (note?.audioIds?.length) {
      void audioStorage.deleteMany(note.audioIds);
    }
    noteService.deleteNote(id);
    if (selectedNote?.id === id) {
      setSelectedNote(null);
    }
    if (detailNote?.id === id) {
      setDetailNote(null);
    }
    refreshNotes();
  };

  const handleUpdateNote = (note: Note, updates: Partial<Note>) => {
    const updatedNote = noteService.updateNote(note.id, updates);
    if (selectedNote?.id === note.id) {
      setSelectedNote(updatedNote);
    }
    if (detailNote?.id === note.id) {
      setDetailNote(updatedNote);
    }
    refreshNotes();
  };

  const handleAddTag = (note: Note) => {
    if (!newTag.trim()) return;

    const updatedTags = [...note.tags, newTag.trim()];
    handleUpdateNote(note, { tags: updatedTags });
    setNewTag('');
    setTags(noteService.getAllTags());
  };

  const handleRemoveTag = (note: Note, tagToRemove: string) => {
    const updatedTags = note.tags.filter(tag => tag !== tagToRemove);
    handleUpdateNote(note, { tags: updatedTags });
    setTags(noteService.getAllTags());
  };

  const handleMoveToFolder = (note: Note, newFolder: string) => {
    handleUpdateNote(note, { folder: newFolder });
    setFolders(noteService.getFolders());
  };

  const handleCreateFolder = () => {
    if (!newFolder.trim()) return;

    if (selectedNote) {
      handleMoveToFolder(selectedNote, newFolder);
    }
    setNewFolder('');
  };

  const handleSort = (field: NoteSortOptions['field']) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setDetailNote(note);
  };

  return (
    <div className={`${styles.panel} ${retroStyles.retroContainer}`}>
      <div className={styles.sidebar}>
        <div className={`${styles.section} ${retroStyles.pixelated}`}>
          <h3>DATA BANKS</h3>
          <div className={styles.folderList}>
            <button
              className={`${styles.folderButton} ${!filter.folder ? styles.active : ''}`}
              onClick={() => setFilter(prev => ({ ...prev, folder: undefined }))}
            >
              ALL MEMORY BANKS
            </button>
            {folders.map(folder => (
              <button
                key={folder}
                className={`${styles.folderButton} ${filter.folder === folder ? styles.active : ''}`}
                onClick={() => setFilter(prev => ({ ...prev, folder }))}
              >
                {folder}
              </button>
            ))}
          </div>
          <div className={styles.newFolder}>
            <input
              type="text"
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
              placeholder="NEW DATA BANK"
              className={retroStyles.retroInput}
            />
            <button
              onClick={handleCreateFolder}
              className={`${styles.button} ${retroStyles.pixelated}`}
              disabled={!newFolder.trim()}
            >
              CREATE
            </button>
          </div>
        </div>

        <div className={`${styles.section} ${retroStyles.pixelated}`}>
          <h3>TAGS</h3>
          <div className={styles.tagList}>
            {tags.map(tag => (
              <button
                key={tag}
                className={`${styles.tagButton} ${filter.tags?.includes(tag) ? styles.active : ''}`}
                onClick={() => setFilter(prev => ({
                  ...prev,
                  tags: prev.tags?.includes(tag)
                    ? prev.tags.filter(t => t !== tag)
                    : [...(prev.tags || []), tag]
                }))}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={`${styles.controls} ${retroStyles.pixelated}`}>
          <div className={styles.search}>
            <input
              type="text"
              placeholder="SEARCH LOGS..."
              value={filter.searchText || ''}
              onChange={e => setFilter(prev => ({ ...prev, searchText: e.target.value }))}
              className={retroStyles.retroInput}
            />
          </div>
          <div className={styles.sort}>
            <button
              onClick={() => handleSort('title')}
              className={`${styles.sortButton} ${sort.field === 'title' ? styles.active : ''}`}
            >
              TITLE {sort.field === 'title' && (sort.direction === 'asc' ? '↑' : '↓')}
            </button>
            <button
              onClick={() => handleSort('createdAt')}
              className={`${styles.sortButton} ${sort.field === 'createdAt' ? styles.active : ''}`}
            >
              DATE {sort.field === 'createdAt' && (sort.direction === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        <div className={`${styles.noteList} ${retroStyles.crtEffect}`}>
          <div className={styles.newNote}>
            <input
              type="text"
              value={newNoteTitle}
              onChange={e => setNewNoteTitle(e.target.value)}
              placeholder="NEW LOG ENTRY TITLE..."
              className={retroStyles.retroInput}
            />
            <button
              onClick={handleCreateNote}
              className={`${styles.button} ${retroStyles.pixelated}`}
              disabled={!newNoteTitle.trim()}
            >
              CREATE NEW LOG
            </button>
          </div>

          {notes.map(note => {
            const preview = getNotePreview(note);
            const truncatedPreview = preview.length > 100 ? preview.slice(0, 100) + '...' : preview;
            return (
              <div
                key={note.id}
                className={`${styles.noteItem} ${selectedNote?.id === note.id ? styles.selected : ''}`}
                onClick={() => handleNoteClick(note)}
              >
                <div className={styles.noteHeader}>
                  <h4>{highlightText(note.title, filter.searchText || '')}</h4>
                  <div className={styles.noteActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className={`${styles.deleteButton} ${retroStyles.pixelated}`}
                    >
                      DELETE
                    </button>
                  </div>
                </div>
                {truncatedPreview && (
                  <p className={styles.notePreview}>
                    {highlightText(truncatedPreview, filter.searchText || '')}
                  </p>
                )}
                <div className={styles.noteMeta}>
                  <span className={styles.folder}>{note.folder}</span>
                  <span className={styles.date}>
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.noteTags}>
                  {note.tags.map(tag => (
                    <span key={tag} className={styles.tag}>
                      {tag}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTag(note, tag);
                        }}
                        className={styles.removeTag}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedNote?.id === note.id && (
                    <div className={styles.addTag}>
                      <input
                        type="text"
                        value={newTag}
                        onChange={e => setNewTag(e.target.value)}
                        placeholder="Add tag..."
                        onClick={e => e.stopPropagation()}
                        onKeyPress={e => {
                          if (e.key === 'Enter') {
                            handleAddTag(note);
                          }
                        }}
                        className={retroStyles.retroInput}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddTag(note);
                        }}
                        className={`${styles.button} ${retroStyles.pixelated}`}
                        disabled={!newTag.trim()}
                      >
                        ADD
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detailNote && (
        <NoteDetailModal
          note={detailNote}
          onClose={() => setDetailNote(null)}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
        />
      )}
    </div>
  );
};
