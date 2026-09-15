import React from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export default function OfflineStatusBar() {
  const { isOnline, offlineCount, isSyncing, syncStatus, syncPendingExpenses } = useNetworkStatus();

  if (isOnline && offlineCount === 0 && !syncStatus) {
    return null;
  }

  return (
    <div className="offline-status-bar">
      {!isOnline && (
        <div className="offline-badge-alert">
          <span className="pulse-dot-amber"></span>
          <span>
            <strong>Modo Estrada (Sem Conexão):</strong> Suas despesas e fotos serão guardadas com segurança no seu aparelho e enviadas quando o sinal voltar.
          </span>
          {offlineCount > 0 && (
            <span className="badge badge-warning" style={{ marginLeft: '8px' }}>
              {offlineCount} salva(s) localmente
            </span>
          )}
        </div>
      )}

      {isOnline && offlineCount > 0 && (
        <div className="offline-badge-sync">
          <span className="pulse-dot-blue"></span>
          <span>
            Conexão restabelecida! Há <strong>{offlineCount} despesa(s)</strong> pendente(s) de envio.
          </span>
          <button 
            type="button" 
            className="btn btn-sm btn-primary"
            onClick={() => syncPendingExpenses()}
            disabled={isSyncing}
            style={{ marginLeft: '12px', padding: '4px 12px', fontSize: '0.8rem' }}
          >
            {isSyncing ? 'Enviando...' : '🚀 Sincronizar Agora'}
          </button>
        </div>
      )}

      {syncStatus && (
        <div className={`offline-feedback-msg ${syncStatus.type}`}>
          <span>{syncStatus.type === 'success' ? '✅' : 'ℹ️'} {syncStatus.text}</span>
        </div>
      )}
    </div>
  );
}
