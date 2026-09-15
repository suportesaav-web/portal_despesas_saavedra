import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineStorage } from '../utils/offlineStorage';
import { expensesService } from '../services/expenses';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // { type: 'success'|'error', text: '' }

  const refreshOfflineCount = useCallback(async () => {
    try {
      const count = await offlineStorage.countOfflineExpenses();
      setOfflineCount(count);
    } catch {
      setOfflineCount(0);
    }
  }, []);

  const syncPendingExpenses = useCallback(async (onItemSynced) => {
    if (!navigator.onLine || isSyncing) return;

    try {
      const pending = await offlineStorage.getOfflineExpenses();
      if (pending.length === 0) {
        setOfflineCount(0);
        return;
      }

      setIsSyncing(true);
      setSyncStatus({ type: 'info', text: `Sincronizando ${pending.length} despesa(s) salva(s) offline...` });

      let successCount = 0;
      for (const item of pending) {
        try {
          let fileToUpload = null;
          if (item.fileBlob) {
            fileToUpload = item.fileBlob instanceof File 
              ? item.fileBlob 
              : new File([item.fileBlob], item.fileName || 'recibo.jpg', { type: item.fileType || 'image/jpeg' });
          }

          if (item.action === 'UPDATE' && item.targetId) {
            await expensesService.updateExpense(item.targetId, item.expenseData, item.userId, fileToUpload);
          } else {
            await expensesService.addExpense(item.expenseData, item.userId, fileToUpload);
          }

          await offlineStorage.deleteOfflineExpense(item.id);
          successCount++;

          if (onItemSynced) onItemSynced(item);
        } catch (err) {
          console.error('Falha ao sincronizar item offline:', item.id, err);
        }
      }

      await refreshOfflineCount();

      if (successCount > 0) {
        setSyncStatus({ 
          type: 'success', 
          text: `${successCount} despesa(s) sincronizada(s) com sucesso na nuvem!` 
        });
        window.dispatchEvent(new CustomEvent('saav-offline-synced', { detail: { count: successCount } }));
        setTimeout(() => setSyncStatus(null), 5000);
      }
    } catch (err) {
      console.error('Erro na sincronização de despesas offline:', err);
      setSyncStatus({ type: 'error', text: 'Houve uma falha na sincronização. Tentaremos novamente quando a conexão estiver estável.' });
      setTimeout(() => setSyncStatus(null), 6000);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshOfflineCount]);

  const syncPendingExpensesRef = useRef(syncPendingExpenses);
  useEffect(() => {
    syncPendingExpensesRef.current = syncPendingExpenses;
  }, [syncPendingExpenses]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingExpensesRef.current?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleStorageChanged = () => {
      refreshOfflineCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('saav-offline-changed', handleStorageChanged);

    refreshOfflineCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('saav-offline-changed', handleStorageChanged);
    };
  }, [refreshOfflineCount]);

  return {
    isOnline,
    offlineCount,
    isSyncing,
    syncStatus,
    syncPendingExpenses,
    refreshOfflineCount
  };
}
