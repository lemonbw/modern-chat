/**
 * Minimal promise wrapper around IndexedDB. The per-contact profiles hold base64 avatars, which
 * outgrow the ~5 MB localStorage quota, so they live in a database instead.
 */
const databaseName = "modern-chat";
const storeName = "profiles";
const databaseVersion = 1;

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, databaseVersion);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("Could not open IndexedDB"));
});

const withStore = async <T,>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = run(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
  } finally {
    database.close();
  }
};

export const idbGet = <T,>(key: string): Promise<T | undefined> => withStore("readonly", (store) => store.get(key) as IDBRequest<T>);
export const idbSet = (key: string, value: unknown): Promise<void> => withStore("readwrite", (store) => store.put(value, key)).then(() => undefined);
export const idbDelete = (key: string): Promise<void> => withStore("readwrite", (store) => store.delete(key)).then(() => undefined);
export const idbGetAll = <T,>(): Promise<T[]> => withStore("readonly", (store) => store.getAll() as IDBRequest<T[]>).catch(() => [] as T[]);