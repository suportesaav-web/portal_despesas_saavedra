import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await expensesService.getExpenses(user.profile);
      setExpenses(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // KPIs
  const totalGasto = expenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalKyanne = expenses.filter(e => e.status === 'ABERTO').length;
  const totalFinanceiro = expenses.filter(e => e.status === 'VALIDADO').length;
  const pendentes = expenses.filter(e => e.status === 'PENDENTE' || e.status === 'REPROVADO').length;

  return (
    <>
      <header style={{ marginBottom: '32px' }}>
        <div className="welcome-section" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', padding: '32px', borderRadius: '16px', boxShadow: 'var(--glass-shadow)' }}>
          <h1 style={{ margin: 0 }}>Olá, {user.profile?.nome}!</h1>
          <p style={{ opacity: 0.8, margin: 0 }}>Portal de Aprovação - {user.profile?.funcao}</p>
        </div>
      </header>

      {loading ? (
        <p>Carregando dashboard...</p>
      ) : (
        <div className="dashboard-grid">
          {/* Vendedor KPI */}
          {user.profile?.funcao === 'Vendedor' && (
            <div className="glass-panel stat-card">
              <span className="stat-label">Total Gasto</span>
              <span className="stat-value">R$ {totalGasto.toFixed(2).replace('.', ',')}</span>
            </div>
          )}

          {/* Kyanne KPI */}
          {(user.profile?.funcao === 'Kyanne' || user.profile?.funcao === 'Financeiro') && (
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--primary)' }} onClick={() => navigate('/aprovacoes')}>
              <span className="stat-label">Aprovação Técnica (Kyanne)</span>
              <span className="stat-value">{totalKyanne}</span>
            </div>
          )}

          {/* Financeiro KPI */}
          {user.profile?.funcao === 'Financeiro' && (
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success)' }} onClick={() => navigate('/aprovacoes')}>
              <span className="stat-label">Aprovação Financeira</span>
              <span className="stat-value">{totalFinanceiro}</span>
            </div>
          )}

          {/* Erros KPI */}
          <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
            <span className="stat-label">Aguardando Correção</span>
            <span className="stat-value">{pendentes}</span>
          </div>
        </div>
      )}
    </>
  );
}
