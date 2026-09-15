import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';
import { useNavigate } from 'react-router-dom';
import { getInfoPrazoMesAtual } from '../utils/dateUtils';
import ReportPrintModal from '../components/ReportPrintModal';

const CHART_COLORS = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#0ea5e9', // Sky
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#14b8a6', // Teal
  '#64748b'  // Slate
];

export default function Dashboard({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReportModal, setShowReportModal] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);
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

  // KPIs Básicos
  const totalGasto = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const totalCRM = expenses.filter(e => e.status === 'ABERTO').length;
  const totalFinanceiro = expenses.filter(e => e.status === 'VALIDADO').length;
  const totalAprovado = expenses.filter(e => e.status === 'APROVADO').length;
  const reprovadas = expenses.filter(e => e.status === 'REPROVADO' || e.status === 'PENDENTE').length;

  // KPIs Avançados de Inteligência Financeira
  const ticketMedio = expenses.length > 0 ? totalGasto / expenses.length : 0;
  const maiorDespesa = expenses.length > 0 ? Math.max(...expenses.map(e => Number(e.amount || 0))) : 0;
  const taxaAprovacao = expenses.length > 0 ? Math.round((totalAprovado / expenses.length) * 100) : 0;

  const isGestao = ['Gestor', 'Supervisor', 'Kyanne', 'Admin'].includes(user.profile?.funcao);
  const isFinanceiro = ['Financeiro', 'Admin'].includes(user.profile?.funcao);

  // BI 1: Distribuição por Categoria Contábil
  const categoryMap = {};
  expenses.forEach(e => {
    const cat = e.categoria || 'Geral / Outros';
    categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount || 0);
  });
  const categoriesList = Object.entries(categoryMap)
    .map(([nome, valor]) => ({
      nome,
      valor,
      percent: totalGasto > 0 ? (valor / totalGasto) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor);

  // Top 5 categorias + agrupamento "Outras" se houver muitas
  let donutCategories = categoriesList;
  if (categoriesList.length > 6) {
    const top5 = categoriesList.slice(0, 5);
    const restValor = categoriesList.slice(5).reduce((acc, c) => acc + c.valor, 0);
    donutCategories = [
      ...top5,
      {
        nome: 'Outras Categorias',
        valor: restValor,
        percent: totalGasto > 0 ? (restValor / totalGasto) * 100 : 0
      }
    ];
  }

  // BI 2: Ranking por Colaborador (Gestão) ou Status (Vendedor)
  const colabMap = {};
  expenses.forEach(e => {
    const nome = e.colaboradores?.nome || user?.profile?.nome || 'Você';
    if (!colabMap[nome]) colabMap[nome] = { nome, total: 0, count: 0 };
    colabMap[nome].total += Number(e.amount || 0);
    colabMap[nome].count += 1;
  });
  const rankingColaboradores = Object.values(colabMap).sort((a, b) => b.total - a.total);
  const maxColabTotal = rankingColaboradores.length > 0 ? Math.max(...rankingColaboradores.map(c => c.total)) : 1;

  // Distribuição por Status para perfil Vendedor
  const statusDist = [
    { label: 'Em Aberto (CRM)', status: 'ABERTO', color: '#3b82f6' },
    { label: 'Validadas (Financeiro)', status: 'VALIDADO', color: '#eab308' },
    { label: 'Liquidadas / Pagas', status: 'APROVADO', color: '#22c55e' },
    { label: 'Reprovadas / Ajuste', status: 'REPROVADO', color: '#ef4444' }
  ].map(s => {
    const itens = expenses.filter(e => e.status === s.status);
    const total = itens.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    return {
      ...s,
      count: itens.length,
      total,
      percent: totalGasto > 0 ? (total / totalGasto) * 100 : 0
    };
  });

  // Cálculo SVG Donut
  const radius = 58;
  const circumference = 2 * Math.PI * radius;

  const donutSlices = useMemo(() => {
    return donutCategories.map((cat, idx) => {
      const color = CHART_COLORS[idx % CHART_COLORS.length];
      const strokeDash = (cat.percent / 100) * circumference;
      const prevPercentSum = donutCategories.slice(0, idx).reduce((sum, c) => sum + c.percent, 0);
      const strokeOffset = -(prevPercentSum / 100) * circumference;
      return {
        ...cat,
        color,
        strokeDash,
        strokeOffset
      };
    });
  }, [donutCategories, circumference]);

  return (
    <>
      <header style={{ marginBottom: '32px' }}>
        <div 
          className="welcome-section" 
          style={{ 
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)', 
            padding: '32px', 
            borderRadius: '16px', 
            boxShadow: 'var(--glass-shadow)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Olá, {user.profile?.nome}!</h1>
            <p style={{ opacity: 0.85, margin: '6px 0 0 0' }}>
              SAAV EXPENSES — Painel Estratégico ({user.profile?.funcao})
            </p>
          </div>

          <button 
            type="button" 
            className="btn" 
            style={{ 
              background: '#ffffff', 
              color: '#0f172a', 
              fontWeight: 600, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
            onClick={() => setShowReportModal(true)}
          >
            <span>📑</span> Emitir Prestação de Contas (PDF A4)
          </button>
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
        <p style={{ textAlign: 'center', padding: '32px' }}>Carregando métricas e inteligência do dashboard...</p>
      ) : (
        <>
          {/* Grade de KPIs Primários de Fluxo */}
          <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
            {/* Card Total Gasto */}
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #6366f1' }}>
              <span className="stat-label">
                {user.profile?.funcao === 'Vendedor' ? 'Meu Total em Despesas' : 'Total Geral no Portal'}
              </span>
              <span className="stat-value">R$ {totalGasto.toFixed(2).replace('.', ',')}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {expenses.length} lançamentos registrados
              </span>
            </div>

            {/* Validação CRM KPI */}
            {isGestao && (
              <div 
                className="glass-panel stat-card" 
                style={{ borderLeft: '4px solid #3b82f6', cursor: 'pointer' }} 
                onClick={() => navigate('/aprovacoes')}
              >
                <span className="stat-label">1. Fila CRM (Aberto)</span>
                <span className="stat-value">{totalCRM}</span>
                <span style={{ fontSize: '0.78rem', color: '#60a5fa', marginTop: '4px' }}>
                  Aguardando conferência de rota →
                </span>
              </div>
            )}

            {/* Financeiro KPI */}
            {isFinanceiro && (
              <div 
                className="glass-panel stat-card" 
                style={{ borderLeft: '4px solid #eab308', cursor: 'pointer' }} 
                onClick={() => navigate('/aprovacoes')}
              >
                <span className="stat-label">2. Fila Reembolso</span>
                <span className="stat-value">{totalFinanceiro}</span>
                <span style={{ fontSize: '0.78rem', color: '#facc15', marginTop: '4px' }}>
                  Validadas pelo CRM →
                </span>
              </div>
            )}

            {/* Liquidados / Pagos KPI */}
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #22c55e' }}>
              <span className="stat-label">Reembolsos Liquidados</span>
              <span className="stat-value">{totalAprovado}</span>
              <span style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: '4px' }}>
                {taxaAprovacao}% de taxa de aprovação
              </span>
            </div>

            {/* Reprovadas KPI */}
            <div className="glass-panel stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <span className="stat-label">Reprovadas / Ajustes</span>
              <span className="stat-value">{reprovadas}</span>
              <span style={{ fontSize: '0.78rem', color: '#f87171', marginTop: '4px' }}>
                Necessitam atenção
              </span>
            </div>
          </div>

          {/* Novos KPIs Analíticos (Ticket Médio & Maior Despesa) */}
          <div className="analytics-kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '2rem', background: 'rgba(99, 102, 241, 0.12)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🏷️
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticket Médio</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>R$ {ticketMedio.toFixed(2).replace('.', ',')}</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '2rem', background: 'rgba(236, 72, 153, 0.12)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                📈
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Maior Despesa</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>R$ {maiorDespesa.toFixed(2).replace('.', ',')}</div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '2rem', background: 'rgba(34, 197, 94, 0.12)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🎯
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conformidade</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#4ade80' }}>{taxaAprovacao}% Aprovado</div>
              </div>
            </div>
          </div>

          {/* Seção de Gráficos Analíticos de BI */}
          <div className="bi-charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            
            {/* Gráfico 1: Donut de Categorias Contábeis */}
            <div className="glass-panel bi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Distribuição por Categoria</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Plano de contas contábeis</span>
                </div>
                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                  {categoriesList.length} tipos
                </span>
              </div>

              {categoriesList.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  Nenhuma despesa registrada para exibir o gráfico.
                </p>
              ) : (
                <div className="donut-chart-container" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  
                  {/* SVG Donut */}
                  <div style={{ position: 'relative', width: '160px', height: '160px', flexShrink: 0 }}>
                    <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform: 'rotate(-90deg)' }}>
                      {/* Trilha de fundo */}
                      <circle
                        cx="80"
                        cy="80"
                        r={radius}
                        fill="transparent"
                        stroke="rgba(255, 255, 255, 0.05)"
                        strokeWidth="20"
                      />
                      
                      {/* Fatias das categorias */}
                      {donutSlices.map((cat) => (
                        <circle
                          key={cat.nome}
                          cx="80"
                          cy="80"
                          r={radius}
                          fill="transparent"
                          stroke={cat.color}
                          strokeWidth="20"
                          strokeDasharray={`${cat.strokeDash} ${circumference}`}
                          strokeDashoffset={cat.strokeOffset}
                          style={{
                            transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                            cursor: 'pointer',
                            opacity: hoveredCategory && hoveredCategory !== cat.nome ? 0.45 : 1
                          }}
                          onMouseEnter={() => setHoveredCategory(cat.nome)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        />
                      ))}
                    </svg>

                    {/* Centro do Donut */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {hoveredCategory ? 'Selecionado' : 'Total'}
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 'bold', maxWidth: '110px', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {hoveredCategory 
                          ? `R$ ${(categoryMap[hoveredCategory] || 0).toFixed(0)}` 
                          : `R$ ${totalGasto.toFixed(0)}`}
                      </span>
                    </div>
                  </div>

                  {/* Legenda Lateral Interativa */}
                  <div className="donut-legend" style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {donutCategories.map((cat, idx) => {
                      const color = CHART_COLORS[idx % CHART_COLORS.length];
                      const isHovered = hoveredCategory === cat.nome;
                      return (
                        <div 
                          key={cat.nome}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            background: isHovered ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={() => setHoveredCategory(cat.nome)}
                          onMouseLeave={() => setHoveredCategory(null)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, flexShrink: 0 }}></span>
                            <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={cat.nome}>
                              {cat.nome}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{cat.percent.toFixed(0)}%</span>
                            <strong>R$ {cat.valor.toFixed(0)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Gráfico 2: Ranking por Colaborador ou Resumo por Status */}
            <div className="glass-panel bi-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {isGestao || isFinanceiro ? 'Gastos por Colaborador' : 'Evolução por Status'}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {isGestao || isFinanceiro ? 'Ranking proporcional de submissões' : 'Acompanhamento do seu fluxo'}
                  </span>
                </div>
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                  {isGestao || isFinanceiro ? `${rankingColaboradores.length} membros` : 'Meu Ciclo'}
                </span>
              </div>

              {isGestao || isFinanceiro ? (
                /* Lista de Barras: Ranking de Colaboradores */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {rankingColaboradores.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Nenhum colaborador com despesas.</p>
                  ) : (
                    rankingColaboradores.slice(0, 6).map((c, i) => {
                      const barPercent = Math.min(100, Math.round((c.total / maxColabTotal) * 100));
                      return (
                        <div key={c.nome} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                            <span style={{ fontWeight: 500 }}>
                              <span style={{ opacity: 0.5, marginRight: '6px' }}>#{i + 1}</span>
                              {c.nome}
                            </span>
                            <span>
                              <strong>R$ {c.total.toFixed(2).replace('.', ',')}</strong>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({c.count} rec.)</span>
                            </span>
                          </div>
                          <div style={{ height: '7px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div 
                              style={{ 
                                height: '100%', 
                                width: `${barPercent}%`, 
                                background: i === 0 ? 'linear-gradient(90deg, #6366f1, #a855f7)' : '#6366f1',
                                borderRadius: '4px',
                                transition: 'width 0.5s ease-in-out'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Lista de Barras: Status para Vendedor */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {statusDist.map(s => {
                    const barPercent = Math.min(100, Math.round(s.percent));
                    return (
                      <div key={s.status} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }}></span>
                            <span style={{ fontWeight: 500 }}>{s.label}</span>
                          </div>
                          <span>
                            <strong>R$ {s.total.toFixed(2).replace('.', ',')}</strong>
                            <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({s.count})</span>
                          </span>
                        </div>
                        <div style={{ height: '7px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div 
                            style={{ 
                              height: '100%', 
                              width: `${barPercent}%`, 
                              background: s.color,
                              borderRadius: '4px',
                              transition: 'width 0.5s ease-in-out'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </>
      )}

      {/* Modal Emissor de Prestação de Contas em Folha A4 */}
      {showReportModal && (
        <ReportPrintModal 
          expenses={expenses}
          user={user}
          periodoDescricao={`Ciclo de Fechamento ${prazoInfo.formatado}`}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </>
  );
}

