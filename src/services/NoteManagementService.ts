import type { TranscriptionResult } from './TranscriptionService';

export interface Note {
  id: string;
  title: string;
  content: TranscriptionResult[];
  tags: string[];
  folder: string;
  createdAt: number;
  updatedAt: number;
  editedContent?: string;
  audioIds?: string[];
}

export interface NoteFilter {
  searchText?: string;
  tags?: string[];
  folder?: string;
  startDate?: number;
  endDate?: number;
}

export interface NoteSortOptions {
  field: 'title' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}

const STORAGE_KEY = 'captains_log_notes';

export class NoteManagementService {
  private notes: Note[] = [];

  constructor() {
    this.loadNotes();
  }

  private loadNotes(): void {
    const savedNotes = localStorage.getItem(STORAGE_KEY);
    if (savedNotes) {
      this.notes = JSON.parse(savedNotes);
    }
  }

  private saveNotes(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
  }

  private generateId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createNote(title: string, content: TranscriptionResult[], tags: string[] = [], folder: string = 'Main Memory', audioIds: string[] = []): Note {
    const note: Note = {
      id: this.generateId(),
      title,
      content,
      tags,
      folder,
      audioIds,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.notes.push(note);
    this.saveNotes();
    return note;
  }

  updateNote(id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>): Note {
    const noteIndex = this.notes.findIndex(note => note.id === id);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    this.notes[noteIndex] = {
      ...this.notes[noteIndex],
      ...updates,
      updatedAt: Date.now()
    };

    this.saveNotes();
    return this.notes[noteIndex];
  }

  deleteNote(id: string): void {
    const noteIndex = this.notes.findIndex(note => note.id === id);
    if (noteIndex === -1) {
      throw new Error('Note not found');
    }

    this.notes.splice(noteIndex, 1);
    this.saveNotes();
  }

  getNotes(filter?: NoteFilter, sort?: NoteSortOptions): Note[] {
    let filteredNotes = [...this.notes];

    // Apply filters
    if (filter) {
      if (filter.searchText) {
        const searchLower = filter.searchText.toLowerCase();
        filteredNotes = filteredNotes.filter(note =>
          note.title.toLowerCase().includes(searchLower) ||
          note.content.some(c => c.text.toLowerCase().includes(searchLower)) ||
          note.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      if (filter.tags?.length) {
        filteredNotes = filteredNotes.filter(note =>
          filter.tags!.some(tag => note.tags.includes(tag))
        );
      }

      if (filter.folder) {
        filteredNotes = filteredNotes.filter(note => note.folder === filter.folder);
      }

      if (filter.startDate) {
        filteredNotes = filteredNotes.filter(note => note.createdAt >= filter.startDate!);
      }

      if (filter.endDate) {
        filteredNotes = filteredNotes.filter(note => note.createdAt <= filter.endDate!);
      }
    }

    // Apply sorting
    if (sort) {
      filteredNotes.sort((a, b) => {
        const aValue = a[sort.field];
        const bValue = b[sort.field];
        const modifier = sort.direction === 'asc' ? 1 : -1;
        
        if (typeof aValue === 'string') {
          return aValue.localeCompare(bValue as string) * modifier;
        }
        return ((aValue as number) - (bValue as number)) * modifier;
      });
    }

    return filteredNotes;
  }

  getNote(id: string): Note | undefined {
    return this.notes.find(note => note.id === id);
  }

  getFolders(): string[] {
    return Array.from(new Set(this.notes.map(note => note.folder)));
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>();
    this.notes.forEach(note => note.tags.forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet);
  }
} 