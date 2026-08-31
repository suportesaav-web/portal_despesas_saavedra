import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';

export default function Aprovacoes({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await expensesService.getExpenses(user.profile);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleAcao = async (id, status) => {
    if(!window.confirm(`Mudar status para ${status}?`)) return;
    try {
      await expensesService.updateStatus(id, status);
      loadData();
    } catch(e) {
      alert("Erro ao atualizar: " + e.message);
    }
  };

  // Agrupa as despesas por colaborador
  const grouped = expenses.reduce((acc, curr) => {
    const nome = curr.colaboradores?.nome || 'Desconhecido';
    if (!acc[nome]) acc[nome] = [];
    acc[nome].push(curr);
    return acc;
  }, {});

  return (
    <>
      <header style={{ marginBottom: '32px' }}>
        <h1>Aprovações</h1>
        <p className="text-muted">Painel de fluxo: {user.profile?.funcao}</p>
      </header>

      {loading ? <p>Carregando...</p> : (
        <div>
          {Object.entries(grouped).map(([colaborador, itens]) => {
            const total = itens.reduce((s, i) => s + Number(i.amount), 0);
            return (
              <div key={colaborador} className="glass-panel" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{colaborador}</strong>
                  <span>R$ {total.toFixed(2)} ({itens.length} itens)</span>
                </div>
                <div style={{ padding: '16px 24px' }}>
                  {itens.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <strong>{d.descricao}</strong> <span className="badge bg-secondary ms-2">{d.status}</span>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.categoria} • {new Date(d.date).toLocaleDateString()}</div>
                        {d.foto_url && (
                          <div style={{ marginTop: '4px' }}>
                            <a href={d.foto_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}><i className="bi bi-paperclip"></i> Ver Comprovante</a>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ marginRight: '16px' }}>R$ {Number(d.amount).toFixed(2)}</strong>
                        
                        {/* Ações Técnicas */}
                        {(user.profile?.funcao === 'Kyanne' || user.profile?.funcao === 'Admin') && d.status === 'ABERTO' && (
                          <button className="btn btn-primary" onClick={() => handleAcao(d.id, 'VALIDADO')}>Validar</button>
                        )}
                        {/* Ações Financeiras */}
                        {(user.profile?.funcao === 'Financeiro' || user.profile?.funcao === 'Admin') && d.status === 'VALIDADO' && (
                          <button className="btn btn-success" onClick={() => handleAcao(d.id, 'APROVADO')}>Pagar</button>
                        )}
                        
                        {/* Reprovar geral */}
                        {(d.status === 'ABERTO' || d.status === 'VALIDADO') && (
                          <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'white' }} onClick={() => handleAcao(d.id, 'REPROVADO')}>Reprovar</button>
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
    </>
  );
}
