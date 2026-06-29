/**
 * IndexedDB-backed persistence for audio blobs.
 *
 * localStorage cannot store binary data efficiently, so recordings are kept in
 * IndexedDB under a single `audio` object store keyed by segment id.
 */
const DB_NAME = 'captains_log_audio';
const DB_VERSION = 1;
const STORE_NAME = 'audio';

export class AudioStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        this.dbPromise = null;
        reject(new Error('IndexedDB is not available in this environment.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.openDB();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public storeAudio(id: string, blob: Blob): Promise<void> {
    return this.withStore<IDBValidKey>('readwrite', store =>
      store.put({ id, blob }),
    ).then(() => undefined);
  }

  public getAudio(id: string): Promise<Blob | null> {
    return this.withStore<{ id: string; blob: Blob } | undefined>(
      'readonly',
      store => store.get(id) as IDBRequest<{ id: string; blob: Blob } | undefined>,
    ).then(record => (record ? record.blob : null));
  }

  public deleteAudio(id: string): Promise<void> {
    return this.withStore<undefined>('readwrite', store => store.delete(id)).then(
      () => undefined,
    );
  }

  public async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await Promise.all(ids.map(id => this.deleteAudio(id)));
  }
}
