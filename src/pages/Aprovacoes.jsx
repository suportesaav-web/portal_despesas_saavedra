import React, { useEffect, useState, useCallback } from 'react';
import { expensesService } from '../services/expenses';

export default function Aprovacoes({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState(
    user?.profile?.funcao === 'Financeiro' ? 'FINANCEIRO' : 'ADMIN'
  );

  // Modal de Reprovação
  const [reprovandoId, setReprovandoId] = useState(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');
  const [processando, setProcessando] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [modalError, setModalError] = useState(null);

  const isAdministrativo = ['Gestor', 'Supervisor', 'Kyanne', 'Admin'].includes(user?.profile?.funcao);
  const isFinanceiro = ['Financeiro', 'Admin'].includes(user?.profile?.funcao);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await expensesService.getExpenses(user?.profile);
      setExpenses(data);
    } catch (e) {
      console.error(e);
      setFeedbackMsg({ type: 'error', text: 'Não foi possível atualizar a lista de despesas: ' + e.message });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Ação de Validação no CRM (Administrativo)
  const handleValidarCRM = async (id, cliente) => {
    if (!window.confirm(`Confirma que a visita em "${cliente || 'este cliente'}" foi localizada e verificada no CRM?`)) {
      return;
    }
    setProcessando(true);
    setFeedbackMsg(null);
    try {
      await expensesService.updateStatus(id, 'VALIDADO', null, user.id);
      setFeedbackMsg({ type: 'success', text: `Despesa da visita em "${cliente || 'cliente'}" validada com sucesso no CRM!` });
      loadData();
    } catch (e) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao validar visita: ' + e.message });
    } finally {
      setProcessando(false);
    }
  };

  // Ação de Reembolso / Liquidação (Financeiro)
  const handleLiquidar = async (id, valor) => {
    if (!window.confirm(`Confirmar programação de reembolso/pagamento de R$ ${Number(valor).toFixed(2).replace('.', ',')}?`)) {
      return;
    }
    setProcessando(true);
    setFeedbackMsg(null);
    try {
      await expensesService.updateStatus(id, 'APROVADO', null, user.id);
      setFeedbackMsg({ type: 'success', text: `Reembolso de R$ ${Number(valor).toFixed(2).replace('.', ',')} liquidado com sucesso!` });
      loadData();
    } catch (e) {
      setFeedbackMsg({ type: 'error', text: 'Erro ao liquidar despesa: ' + e.message });
    } finally {
      setProcessando(false);
    }
  };

  // Abrir modal de reprovação
  const abrirModalReprovar = (id) => {
    setReprovandoId(id);
    setMotivoReprovacao('');
    setModalError(null);
  };

  // Confirmar reprovação com justificativa
  const handleConfirmarReprovacao = async (e) => {
    e.preventDefault();
    setModalError(null);
    if (!motivoReprovacao.trim()) {
      setModalError('Por favor, descreva a justificativa da reprovação para orientar a equipe.');
      return;
    }
    setProcessando(true);
    try {
      await expensesService.updateStatus(reprovandoId, 'REPROVADO', motivoReprovacao.trim(), user.id);
      setReprovandoId(null);
      setMotivoReprovacao('');
      setFeedbackMsg({ type: 'warning', text: 'Despesa reprovada. O vendedor foi sinalizado com a justificativa apontada.' });
      loadData();
    } catch (e) {
      setModalError('Erro ao reprovar: ' + e.message);
    } finally {
      setProcessando(false);
    }
  };

  // Filtragem das despesas pela esteira ativa
  const despesasFiltradas = expenses.filter(d => {
    if (abaAtiva === 'ADMIN') return d.status === 'ABERTO';
    if (abaAtiva === 'FINANCEIRO') return d.status === 'VALIDADO';
    return true; // 'TODOS'
  });

  // Agrupamento por colaborador
  const grouped = despesasFiltradas.reduce((acc, curr) => {
    const nome = curr.colaboradores?.nome || 'Desconhecido';
    if (!acc[nome]) acc[nome] = [];
    acc[nome].push(curr);
    return acc;
  }, {});

  const totalAberto = expenses.filter(e => e.status === 'ABERTO').length;
  const totalValidado = expenses.filter(e => e.status === 'VALIDADO').length;

  return (
    <>
      <header style={{ marginBottom: '24px' }}>
        <h1>Esteira de Aprovações</h1>
        <p className="text-muted">Fluxo de auditoria CRM e liquidação de reembolsos — {user.profile?.funcao}</p>
      </header>

      {/* Alerta de Feedback da Esteira */}
      {feedbackMsg && (
        <div className={`alert-box ${feedbackMsg.type === 'success' ? 'alert-success' : feedbackMsg.type === 'warning' ? 'alert-warning' : 'alert-danger'}`}>
          <span>{feedbackMsg.text}</span>
          <button 
            type="button" 
            onClick={() => setFeedbackMsg(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Navegação entre as Filas */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {isAdministrativo && (
          <button 
            className={`btn ${abaAtiva === 'ADMIN' ? 'btn-primary' : ''}`}
            style={{ background: abaAtiva === 'ADMIN' ? undefined : 'rgba(255,255,255,0.05)' }}
            onClick={() => setAbaAtiva('ADMIN')}
          >
            1. Validação no CRM (Administrativo)
            <span className="badge" style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)' }}>
              {totalAberto}
            </span>
          </button>
        )}

        {isFinanceiro && (
          <button 
            className={`btn ${abaAtiva === 'FINANCEIRO' ? 'btn-primary' : ''}`}
            style={{ background: abaAtiva === 'FINANCEIRO' ? undefined : 'rgba(255,255,255,0.05)' }}
            onClick={() => setAbaAtiva('FINANCEIRO')}
          >
            2. Programação de Reembolso (Financeiro)
            <span className="badge" style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.2)' }}>
              {totalValidado}
            </span>
          </button>
        )}

        <button 
          className={`btn ${abaAtiva === 'TODOS' ? 'btn-primary' : ''}`}
          style={{ background: abaAtiva === 'TODOS' ? undefined : 'rgba(255,255,255,0.05)' }}
          onClick={() => setAbaAtiva('TODOS')}
        >
          Visão Geral ({expenses.length})
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px' }}>Carregando esteira de aprovações...</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '8px' }}>🎉 Nenhuma despesa pendente nesta fila!</p>
          <span style={{ fontSize: '0.9rem' }}>
            {abaAtiva === 'ADMIN' 
              ? 'Todas as visitas em aberto já foram conferidas no CRM.' 
              : 'Não há despesas validadas aguardando pagamento no momento.'}
          </span>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([colaborador, itens]) => {
            const totalColaborador = itens.reduce((s, i) => s + Number(i.amount), 0);
            return (
              <div key={colaborador} className="glass-panel" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
                {/* Cabeçalho do Colaborador */}
                <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '1.1rem' }}>{colaborador}</strong>
                    <span className="text-muted" style={{ fontSize: '0.85rem', marginLeft: '12px' }}>
                      {itens.length} {itens.length === 1 ? 'lançamento' : 'lançamentos'}
                    </span>
                  </div>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                    Total: R$ {totalColaborador.toFixed(2).replace('.', ',')}
                  </strong>
                </div>

                {/* Lista de Itens do Colaborador */}
                <div style={{ padding: '16px 24px' }}>
                  {itens.map(d => (
                    <div 
                      key={d.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        padding: '16px 0', 
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        gap: '20px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        {/* Cliente e Horário (Chave CRM) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontWeight: 600 }}>
                            📍 CRM: {d.cliente || 'Local não informado'}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            📅 {new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')} {d.hora ? `às ${d.hora}` : ''}
                          </span>
                        </div>

                        {/* Descrição e Categoria */}
                        <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '4px' }}>
                          {d.descricao}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <strong>Categoria:</strong> {d.categoria_codigo ? `${d.categoria_codigo} - ` : ''}{d.categoria}
                        </div>

                        {/* Motivo de reprovação se houver */}
                        {d.motivo_reprovacao && (
                          <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                            <strong>Motivo apontado:</strong> {d.motivo_reprovacao}
                          </div>
                        )}

                        {/* Link do Comprovante */}
                        {d.foto_url && (
                          <div style={{ marginTop: '6px' }}>
                            <a 
                              href={d.foto_url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn" 
                              style={{ padding: '3px 8px', fontSize: '0.75rem', background: 'rgba(255,255,255,0.08)' }}
                            >
                              📎 Ver Comprovante Anexo
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Valor e Ações */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ textAlign: 'right', marginRight: '8px' }}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                            R$ {Number(d.amount).toFixed(2).replace('.', ',')}
                          </div>
                          <span className="badge bg-secondary" style={{ fontSize: '0.75rem' }}>
                            {d.status}
                          </span>
                        </div>

                        {/* Botão de Validação Administrativa (CRM) */}
                        {isAdministrativo && d.status === 'ABERTO' && (
                          <button 
                            className="btn btn-primary" 
                            onClick={() => handleValidarCRM(d.id, d.cliente)}
                            disabled={processando}
                          >
                            ✅ Validar no CRM
                          </button>
                        )}

                        {/* Botão de Liquidação Financeira */}
                        {isFinanceiro && d.status === 'VALIDADO' && (
                          <button 
                            className="btn btn-success" 
                            onClick={() => handleLiquidar(d.id, d.amount)}
                            disabled={processando}
                          >
                            💰 Liquidar Reembolso
                          </button>
                        )}

                        {/* Botão de Reprovação (disponível para aberto ou validado) */}
                        {(d.status === 'ABERTO' || d.status === 'VALIDADO') && (
                          <button 
                            className="btn" 
                            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }} 
                            onClick={() => abrirModalReprovar(d.id)}
                            disabled={processando}
                          >
                            Reprovar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Reprovação com Justificativa Obrigatória */}
      {reprovandoId && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '480px' }}>
            <h2 style={{ marginBottom: '8px', color: 'var(--danger)' }}>Reprovar Despesa</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
              Informe o motivo da não conformidade (ex: visita não localizada no CRM, divergência de valor ou falta de comprovante).
            </p>

            {modalError && (
              <div className="alert-box alert-danger">
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmarReprovacao}>
              <div className="form-group">
                <label>Motivo da Reprovação <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea 
                  className="form-input" 
                  rows="4" 
                  required 
                  placeholder="Ex: Visita na data e horário informados não foi localizada no registro do CRM do vendedor."
                  value={motivoReprovacao}
                  onChange={e => setMotivoReprovacao(e.target.value)}
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn" onClick={() => setReprovandoId(null)} disabled={processando}>
                  Cancelar
                </button>
                <button type="submit" className="btn" style={{ background: 'var(--danger)', color: 'white' }} disabled={processando}>
                  {processando ? 'Gravando...' : 'Confirmar Reprovação'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
