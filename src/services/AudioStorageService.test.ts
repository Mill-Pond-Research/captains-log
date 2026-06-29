import { describe, test, expect, beforeEach } from 'vitest';
import { AudioStorageService } from '../services/AudioStorageService';

// Minimal in-memory IndexedDB mock sufficient for the AudioStorageService API.
function createMockIndexedDB() {
  const stores = new Map<string, Map<string, { id: string; blob: Blob }>>();

  class MockRequest {
    result: unknown = undefined;
    error: unknown = null;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    fire(result: unknown) {
      this.result = result;
      // Defer to mimic async IDB eventing.
      setTimeout(() => this.onsuccess?.(), 0);
    }
  }

  class MockObjectStore {
    private data: Map<string, { id: string; blob: Blob }>;
    constructor(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      this.data = stores.get(name)!;
    }
    put(value: { id: string; blob: Blob }) {
      this.data.set(value.id, value);
      const req = new MockRequest();
      req.fire(value.id);
      return req;
    }
    get(id: string) {
      const req = new MockRequest();
      req.fire(this.data.get(id));
      return req;
    }
    delete(id: string) {
      this.data.delete(id);
      const req = new MockRequest();
      req.fire(undefined);
      return req;
    }
  }

  class MockTransaction {
    stores: Record<string, MockObjectStore> = {};
    constructor(names: string[]) {
      for (const n of names) this.stores[n] = new MockObjectStore(n);
    }
    objectStore(name: string) {
      return this.stores[name];
    }
  }

  class MockDB {
    objectStoreNames = { contains: (name: string) => stores.has(name) } as unknown as DOMStringList;
    createObjectStore(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      return new MockObjectStore(name);
    }
    transaction(names: string | string[]) {
      const arr = Array.isArray(names) ? names : [names];
      return new MockTransaction(arr);
    }
  }

  class MockOpenRequest {
    result: MockDB = new MockDB();
    error: unknown = null;
    onupgradeneeded: (() => void) | null = null;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() {
      setTimeout(() => {
        if (!stores.has('audio')) stores.set('audio', new Map());
        this.onupgradeneeded?.();
        this.onsuccess?.();
      }, 0);
    }
  }

  const indexedDB = {
    open: () => new MockOpenRequest(),
  };

  return { indexedDB, stores };
}

describe('AudioStorageService', () => {
  beforeEach(() => {
    const mock = createMockIndexedDB();
    Object.defineProperty(globalThis, 'indexedDB', {
      value: mock.indexedDB,
      writable: true,
      configurable: true,
    });
  });

  test('store, get, and delete an audio blob', async () => {
    const service = new AudioStorageService();
    const blob = new Blob(['audio-bytes'], { type: 'audio/webm' });

    await service.storeAudio('seg1', blob);

    const retrieved = await service.getAudio('seg1');
    expect(retrieved).toBeInstanceOf(Blob);
    expect(retrieved!.size).toBe(blob.size);

    await service.deleteAudio('seg1');
    const afterDelete = await service.getAudio('seg1');
    expect(afterDelete).toBeNull();
  });

  test('getAudio returns null for unknown id', async () => {
    const service = new AudioStorageService();
    const retrieved = await service.getAudio('does-not-exist');
    expect(retrieved).toBeNull();
  });

  test('deleteMany removes all listed ids', async () => {
    const service = new AudioStorageService();
    const blob = new Blob(['x'], { type: 'audio/webm' });
    await service.storeAudio('a', blob);
    await service.storeAudio('b', blob);
    await service.storeAudio('c', blob);

    await service.deleteMany(['a', 'b']);

    expect(await service.getAudio('a')).toBeNull();
    expect(await service.getAudio('b')).toBeNull();
    expect(await service.getAudio('c')).not.toBeNull();
  });

  test('deleteMany is a no-op for empty list', async () => {
    const service = new AudioStorageService();
    await expect(service.deleteMany([])).resolves.toBeUndefined();
  });
});
