/**
 * Offline cache - Phase 5. IndexedDB cache for API responses.
 * Caches GET responses; returns cached data when offline.
 */
const DB_NAME = 'mediation-offline-cache';
const STORE_NAME = 'responses';
const TTL_MS = 5 * 60 * 1000; // 5 minutes

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
      };
    });
  }
  return dbPromise;
}

function cacheKey(url, params) {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `${url}${q}`;
}

export async function getCached(url, params) {
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey(url, params));
      req.onsuccess = () => {
        const entry = req.result;
        if (entry && Date.now() - entry.timestamp < TTL_MS) {
          resolve(entry.data);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setCached(url, params, data) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        key: cacheKey(url, params),
        data,
        timestamp: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cache write errors
  }
}

export function isOnline() {
  return navigator.onLine;
}
