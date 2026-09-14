import React, { useEffect, useState, useCallback } from 'react';
import { expensesService } from '../services/expenses';

export default function StatusHistoryModal({ expense, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fecha com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadHistory = useCallback(async () => {
    if (!expense?.id) return;
    setLoading(true);
    try {
      const data = await expensesService.getStatusHistory(expense.id);
      setHistory(data);
    } catch (err) {
      console.error('Erro ao carregar histórico de status:', err);
    } finally {
      setLoading(false);
    }
  }, [expense]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ABERTO':
        return { label: 'Lançamento Aberto', class: 'badge-warning', icon: '📝' };
      case 'VALIDADO':
        return { label: 'Validado no CRM', class: 'badge-info', icon: '🔍' };
      case 'APROVADO':
        return { label: 'Liquidado / Aprovado', class: 'badge-success', icon: '✅' };
      case 'REPROVADO':
        return { label: 'Reprovado / Ajuste', class: 'badge-danger', icon: '⚠️' };
      default:
        return { label: status || 'Registro', class: 'badge-neutral', icon: '📌' };
    }
  };

  if (!expense) return null;

  return (
    <div className="status-modal-overlay" onClick={onClose}>
      <div 
        className="status-modal-container glass-panel" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="status-modal-header">
          <div>
            <h3 className="status-modal-title">
              🕒 Linha do Tempo & Rastreabilidade
            </h3>
            <p className="status-modal-subtitle">
              Despesa #{expense.id} • {expense.cliente || 'Cliente não informado'} • 
              <strong> R$ {Number(expense.amount || 0).toFixed(2)}</strong>
            </p>
          </div>
          <button 
            type="button" 
            className="receipt-btn-close" 
            onClick={onClose} 
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Corpo da Timeline */}
        <div className="status-modal-body">
          {loading ? (
            <div className="timeline-loading">
              <span>Carregando histórico auditável...</span>
            </div>
          ) : history.length > 0 ? (
            <div className="timeline-container">
              {history.map((item, index) => {
                const badge = getStatusBadge(item.new_status);
                const autorNome = item.colaboradores?.nome || 'Sistema / Usuário';
                const autorEmail = item.colaboradores?.email ? `(${item.colaboradores.email})` : '';
                const dataFormatada = new Date(item.created_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={item.id || index} className="timeline-item">
                    <div className="timeline-marker-wrapper">
                      <div className={`timeline-marker ${badge.class}`}>
                        <span>{badge.icon}</span>
                      </div>
                      {index < history.length - 1 && <div className="timeline-line" />}
                    </div>

                    <div className="timeline-content">
                      <div className="timeline-header-row">
                        <span className={`status-badge ${badge.class}`}>
                          {badge.label}
                        </span>
                        <span className="timeline-date">{dataFormatada}</span>
                      </div>

                      <div className="timeline-actor">
                        <strong>Por:</strong> {autorNome} <span className="timeline-email">{autorEmail}</span>
                      </div>

                      {item.old_status && (
                        <div className="timeline-transition">
                          <span className="transition-tag">{item.old_status}</span>
                          <span className="transition-arrow">➔</span>
                          <span className="transition-tag">{item.new_status}</span>
                        </div>
                      )}

                      {item.reason && (
                        <div className="timeline-reason-box">
                          <strong>Motivo da Não Conformidade:</strong>
                          <p>"{item.reason}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="timeline-empty-state">
              <span className="empty-icon">📋</span>
              <h4>Histórico Base Registrado</h4>
              <p>
                Status Atual: <strong className="status-badge badge-info">{expense.status}</strong>
              </p>
              {expense.motivo_reprovacao && (
                <div className="timeline-reason-box" style={{ marginTop: '12px', textAlign: 'left' }}>
                  <strong>Motivo Registrado:</strong>
                  <p>"{expense.motivo_reprovacao}"</p>
                </div>
              )}
              <small className="empty-hint">
                As novas transições de status realizadas a partir de agora serão registradas de forma imutável nesta linha do tempo.
              </small>
            </div>
          )}
        </div>

        {/* Footer do Modal */}
        <div className="status-modal-footer">
          <div className="status-indicator-legend">
            <span>🛡️ Trilha de auditoria protegida por trigger imutável no PostgreSQL</span>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
