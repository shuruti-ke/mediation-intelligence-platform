/**
 * Phase 5.5: Store-and-forward for offline mutations.
 * Queues POST/PATCH/PUT/DELETE when offline; retries when back online.
 */
const DB_NAME = 'mediation-offline-queue';
const STORE_NAME = 'pending';
const MAX_QUEUE = 100;

let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const store = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('created', 'createdAt', { unique: false });
      };
    });
  }
  return dbPromise;
}

let idCounter = 0;
function nextId() {
  return `q${Date.now()}_${++idCounter}`;
}

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

export function isMutation(config) {
  return config && MUTATION_METHODS.includes((config.method || 'GET').toUpperCase());
}

export function shouldQueue(config) {
  if (!config || !isMutation(config)) return false;
  const url = (config.baseURL || '') + (config.url || config.path || '');
  // Don't queue auth, login, file uploads
  if (url.includes('/auth/login') || url.includes('/auth/register')) return false;
  if (config.data instanceof FormData) return false;
  return true;
}

export async function enqueue(config) {
  try {
    const db = await getDb();
    // Store path only (axios prepends baseURL on replay)
    const path = (config.url || config.path || '').startsWith('http') ? config.url : (config.url || config.path || '');
    const entry = {
      id: nextId(),
      method: (config.method || 'GET').toUpperCase(),
      url: path,
      params: config.params || undefined,
      data: config.data,
      headers: config.headers ? { ...config.headers } : undefined,
      createdAt: Date.now(),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const countReq = store.count();
      countReq.onsuccess = () => {
        if (countReq.result >= MAX_QUEUE) {
          resolve(null);
          return;
        }
        store.add(entry);
        tx.oncomplete = () => resolve(entry.id);
        tx.onerror = () => reject(tx.error);
      };
    });
  } catch {
    return null;
  }
}

export async function getAll() {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).index('created').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function remove(id) {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function processQueue(apiInstance) {
  if (!apiInstance) return;
  const items = await getAll();
  for (const item of items) {
    try {
      const config = {
        method: item.method,
        url: item.url,
        params: item.params,
        data: item.data,
        headers: { ...item.headers },
      };
      await apiInstance.request(config);
      await remove(item.id);
    } catch (err) {
      // Stop on first failure; will retry next time online
      break;
    }
  }
}

export function initOnlineListener(apiInstance) {
  if (typeof window === 'undefined' || !apiInstance) return;
  window.addEventListener('online', () => {
    processQueue(apiInstance);
  });
}
