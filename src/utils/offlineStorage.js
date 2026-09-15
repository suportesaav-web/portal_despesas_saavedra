// Utilitário de Armazenamento Local Seguro usando IndexedDB para Operação Offline
const DB_NAME = 'saav_offline_expenses_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_expenses';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB não suportado neste navegador.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('userId', 'userId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineStorage = {
  // Salva uma despesa e seu arquivo (Blob) no banco de dados local
  async saveOfflineExpense(expenseData, userId, file, options = {}) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record = {
        id: `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        action: options.action || 'CREATE', // 'CREATE' ou 'UPDATE'
        targetId: options.targetId || null,
        expenseData,
        userId,
        fileBlob: file || null,
        fileName: file ? file.name : null,
        fileType: file ? file.type : null,
        createdAt: new Date().toISOString()
      };

      const request = store.add(record);

      request.onsuccess = () => {
        // Dispara evento global para componentes atualizarem badges
        window.dispatchEvent(new CustomEvent('saav-offline-changed'));
        resolve(record);
      };

      request.onerror = () => reject(request.error);
    });
  },

  // Retorna todas as despesas pendentes de sincronização
  async getOfflineExpenses() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  },

  // Remove um item após sincronizado com sucesso
  async deleteOfflineExpense(id) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('saav-offline-changed'));
        resolve(true);
      };

      request.onerror = () => reject(request.error);
    });
  },

  // Retorna quantidade de despesas offline pendentes
  async countOfflineExpenses() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => resolve(request.result || 0);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return 0;
    }
  }
};
