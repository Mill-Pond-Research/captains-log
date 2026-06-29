import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NoteDetailModal } from './NoteDetailModal';
import type { Note } from '../services/NoteManagementService';

// Mock AudioStorageService so the modal doesn't touch IndexedDB.
vi.mock('../services/AudioStorageService', () => ({
  AudioStorageService: vi.fn().mockImplementation(() => ({
    getAudio: vi.fn().mockResolvedValue(null),
    storeAudio: vi.fn().mockResolvedValue(undefined),
    deleteAudio: vi.fn().mockResolvedValue(undefined),
    deleteMany: vi.fn().mockResolvedValue(undefined),
  })),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note_1',
    title: 'Test Log',
    content: [
      { text: 'Captain log entry one', confidence: 0.9, isFinal: true, timestamp: 1000, sessionId: 's1', language: 'en' },
      { text: 'Captain log entry two', confidence: 0.8, isFinal: true, timestamp: 2000, sessionId: 's2' },
    ],
    tags: ['alpha'],
    folder: 'Main Memory',
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  };
}

describe('NoteDetailModal', () => {
  const onClose = vi.fn();
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    onUpdate.mockClear();
    onDelete.mockClear();
  });

  test('renders note title and content', () => {
    render(<NoteDetailModal note={makeNote()} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    expect(screen.getByText('Test Log')).toBeInTheDocument();
    expect(screen.getByText(/Captain log entry one/)).toBeInTheDocument();
  });

  test('shows EDIT button and toggles into edit mode', () => {
    render(<NoteDetailModal note={makeNote()} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    const editButton = screen.getByText('EDIT');
    fireEvent.click(editButton);
    expect(screen.getByText('SAVE')).toBeInTheDocument();
    expect(screen.getByText('CANCEL')).toBeInTheDocument();
  });

  test('SAVE commits editedContent via onUpdate', () => {
    render(<NoteDetailModal note={makeNote()} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('EDIT'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'edited text' } });
    fireEvent.click(screen.getByText('SAVE'));
    expect(onUpdate).toHaveBeenCalledWith(expect.anything(), { editedContent: 'edited text' });
  });

  test('EXPORT TXT triggers a download', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<NoteDetailModal note={makeNote()} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('EXPORT TXT'));
    expect(createURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
    createURLSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  test('PURGE requires confirmation before deleting', () => {
    render(<NoteDetailModal note={makeNote()} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('PURGE'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('CONFIRM PURGE')).toBeInTheDocument();
    fireEvent.click(screen.getByText('CONFIRM PURGE'));
    expect(onDelete).toHaveBeenCalledWith('note_1');
  });

  test('prefers editedContent when present', () => {
    const note = makeNote({ editedContent: 'overridden content' });
    render(<NoteDetailModal note={note} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    expect(screen.getByText('overridden content')).toBeInTheDocument();
  });

  test('closing via overlay calls onClose', () => {
    const { container } = render(<NoteDetailModal note={makeNote()} onClose={onClose} onUpdate={onUpdate} onDelete={onDelete} />);
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });
});
