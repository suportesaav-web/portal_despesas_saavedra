import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';
import { useNavigate } from 'react-router-dom';
import { getInfoPrazoMesAtual } from '../utils/dateUtils';

export default function Dashboard({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const prazoInfo = getInfoPrazoMesAtual();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await expensesService.getExpenses(user?.profile);
        setExpenses(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // KPIs
  const totalGasto = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalCRM = expenses.filter(e => e.status === 'ABERTO').length;
  const totalFinanceiro = expenses.filter(e => e.status === 'VALIDADO').length;
  const totalAprovado = expenses.filter(e => e.status === 'APROVADO').length;
  const reprovadas = expenses.filter(e => e.status === 'REPROVADO' || e.status === 'PENDENTE').length;

  const isGestao = ['Gestor', 'Supervisor', 'Kyanne', 'Admin'].includes(user.profile?.funcao);
  const isFinanceiro = ['Financeiro', 'Admin'].includes(user.profile?.funcao);

  return (
    <>
      <header style={{ marginBottom: '32px' }}>
        <div className="welcome-section" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', padding: '32px', borderRadius: '16px', boxShadow: 'var(--glass-shadow)' }}>
          <h1 style={{ margin: 0 }}>Olá, {user.profile?.nome}!</h1>
          <p style={{ opacity: 0.85, margin: '6px 0 0 0' }}>
            SAAV EXPENSES — Perfil: {user.profile?.funcao}
          </p>
        </div>
      </header>

      {/* Banner de Fechamento Mensal */}
      <div 
        className="glass-panel prazo-banner" 
        style={{ 
          marginBottom: '24px', 
          borderLeft: prazoInfo.ehUrgente ? '4px solid var(--warning)' : '4px solid var(--primary)',
          background: prazoInfo.ehUrgente ? 'rgba(234, 179, 8, 0.08)' : 'rgba(99, 102, 241, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📅</span>
          <div>
            <strong>Fechamento Mensal: {prazoInfo.formatado}</strong> (Último dia útil)
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {prazoInfo.expirado 
                ? 'Prazo do ciclo atual encerrado.' 
                : `Lançamentos de visitas devem ser submetidos até o prazo (${prazoInfo.diasRestantes} dias restantes).`}
            </div>
          </div>
        </div>
        <button 
          type="button"
          className="btn" 
          style={{ 
            fontSize: '0.85rem', 
            background: 'rgba(255, 255, 255, 0.1)', 
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'var(--text-main)',
            whiteSpace: 'nowrap'
          }} 
          onClick={() => navigate('/despesas')}
        >
          Ir para Despesas →
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '32px' }}>Carregando métricas do dashboard...</p>
      ) : (
        <div className="dashboard-grid">
          {/* Card Total Gasto */}
          <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
            <span className="stat-label">
              {user.profile?.funcao === 'Vendedor' ? 'Meu Total em Despesas' : 'Total Geral no Portal'}
            </span>
            <span className="stat-value">R$ {totalGasto.toFixed(2).replace('.', ',')}</span>
          </div>

          {/* Validação CRM / Administrativo KPI */}
          {isGestao && (
            <div 
              className="glass-panel stat-card" 
              style={{ borderLeft: '4px solid #3b82f6', cursor: 'pointer' }} 
              onClick={() => navigate('/aprovacoes')}
            >
              <span className="stat-label">1. Validação no CRM (Aberto)</span>
              <span className="stat-value">{totalCRM}</span>
            </div>
          )}

          {/* Financeiro KPI */}
          {isFinanceiro && (
            <div 
              className="glass-panel stat-card" 
              style={{ borderLeft: '4px solid #eab308', cursor: 'pointer' }} 
              onClick={() => navigate('/aprovacoes')}
            >
              <span className="stat-label">2. Fila Reembolso (Financeiro)</span>
              <span className="stat-value">{totalFinanceiro}</span>
            </div>
          )}

          {/* Liquidados / Pagos KPI */}
          <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
            <span className="stat-label">Reembolsos Liquidados</span>
            <span className="stat-value">{totalAprovado}</span>
          </div>

          {/* Reprovadas / Erros KPI */}
          <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <span className="stat-label">Reprovadas / Ajustes</span>
            <span className="stat-value">{reprovadas}</span>
          </div>
        </div>
      )}
    </>
  );
}
