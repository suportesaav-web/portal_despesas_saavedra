import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';
import { CATEGORIAS_DESPESAS } from '../data/categories';
import ReceiptModal from '../components/ReceiptModal';
import StatusHistoryModal from '../components/StatusHistoryModal';

export default function Relatorios({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados dos Novos Modais
  const [comprovanteAtivo, setComprovanteAtivo] = useState(null);
  const [historicoAtivo, setHistoricoAtivo] = useState(null);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [filtroGrupo, setFiltroGrupo] = useState('TODOS');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    async function loadData() {
      setLoading(true);
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

  // Lógica de Filtragem Local
  const despesasFiltradas = expenses.filter(d => {
    let passaFiltro = true;
    
    // Filtro por Status
    if (filtroStatus !== 'TODOS' && d.status !== filtroStatus) passaFiltro = false;
    
    // Filtro por Grupo de Categoria (ex: '2.3')
    if (filtroGrupo !== 'TODOS') {
      const codigoCat = d.categoria_codigo || '';
      if (!codigoCat.startsWith(filtroGrupo)) passaFiltro = false;
    }

    // Filtro por Período
    if (dataInicio && d.date < dataInicio) passaFiltro = false;
    if (dataFim && d.date > dataFim) passaFiltro = false;

    // Filtro por Busca Textual (Cliente, Colaborador, Descrição)
    if (filtroBusca.trim()) {
      const termo = filtroBusca.toLowerCase();
      const matchColaborador = (d.colaboradores?.nome || '').toLowerCase().includes(termo);
      const matchCliente = (d.cliente || '').toLowerCase().includes(termo);
      const matchDesc = (d.descricao || '').toLowerCase().includes(termo);
      const matchCat = (d.categoria || '').toLowerCase().includes(termo);
      if (!matchColaborador && !matchCliente && !matchDesc && !matchCat) {
        passaFiltro = false;
      }
    }

    return passaFiltro;
  });

  const handleExportCSV = () => {
    // Cabeçalho completo para auditoria e contabilidade
    const headers = [
      'Data',
      'Horário',
      'Colaborador',
      'Cliente / Local (CRM)',
      'Código Contábil',
      'Categoria',
      'Descrição',
      'Valor (R$)',
      'Status',
      'Motivo Reprovação',
      'Comprovante Anexo'
    ];
    
    // Linhas formatadas com aspas para segurança de pontuação
    const rows = despesasFiltradas.map(d => {
      const dataFormatada = new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR');
      const horaFormatada = d.hora || '';
      const nomeColab = d.colaboradores?.nome || 'Você';
      const clienteCRM = d.cliente || '';
      const codigoCat = d.categoria_codigo || '';
      const nomeCat = d.categoria || '';
      const descricao = (d.descricao || '').replace(/"/g, '""');
      const valorBR = Number(d.amount).toFixed(2).replace('.', ',');
      const status = d.status;
      const motivo = (d.motivo_reprovacao || '').replace(/"/g, '""');
      const foto = d.foto_url || 'Sem anexo';

      return [
        `"${dataFormatada}"`,
        `"${horaFormatada}"`,
        `"${nomeColab}"`,
        `"${clienteCRM}"`,
        `"${codigoCat}"`,
        `"${nomeCat}"`,
        `"${descricao}"`,
        `"${valorBR}"`,
        `"${status}"`,
        `"${motivo}"`,
        `"${foto}"`
      ];
    });

    // BOM UTF-8 (\uFEFF) para garantir abertura direta no Microsoft Excel do Windows sem erro de acentuação
    const csvContent = "\uFEFF" 
      + headers.join(';') + "\r\n"
      + rows.map(r => r.join(';')).join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `saav_expenses_relatorio_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalFiltrado = despesasFiltradas.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Relatórios Gerais & Extratos</h1>
          <p className="text-muted">Exportação contábil para Excel com cruzamento CRM</p>
        </div>
        <button className="btn btn-success" onClick={handleExportCSV} disabled={despesasFiltradas.length === 0}>
          📊 Exportar para Excel (CSV)
        </button>
      </header>

      {/* Painel de Filtros Avançados */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Filtros de Pesquisa</h3>
        
        <div className="form-row">
          <div className="form-group" style={{ flex: 1.5 }}>
            <label>Buscar por Cliente (CRM), Vendedor ou Descrição</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Digite o nome do cliente, vendedor..." 
              value={filtroBusca} 
              onChange={e => setFiltroBusca(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label>Status do Fluxo</label>
            <select className="form-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="TODOS">Todos os Status</option>
              <option value="ABERTO">Em Aberto (Validação CRM)</option>
              <option value="VALIDADO">Validado (Fila Reembolso)</option>
              <option value="APROVADO">Pago / Reembolsado</option>
              <option value="REPROVADO">Reprovado</option>
            </select>
          </div>

          <div className="form-group">
            <label>Grupo Contábil</label>
            <select className="form-input" value={filtroGrupo} onChange={(e) => setFiltroGrupo(e.target.value)}>
              <option value="TODOS">Todos os Grupos</option>
              {CATEGORIAS_DESPESAS.map(g => (
                <option key={g.codigo} value={g.codigo}>
                  {g.codigo} - {g.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '8px' }}>
          <div className="form-group">
            <label>Data Inicial</label>
            <input type="date" className="form-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data Final</label>
            <input type="date" className="form-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              className="btn" 
              style={{ background: 'rgba(255,255,255,0.05)', width: '100%' }}
              onClick={() => {
                setFiltroStatus('TODOS');
                setFiltroGrupo('TODOS');
                setFiltroBusca('');
                setDataInicio('');
                setDataFim('');
              }}
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Resultados da Listagem */}
      <div className="glass-panel">
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <strong>Mostrando {despesasFiltradas.length} de {expenses.length} lançamentos</strong>
          <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
            Total Filtrado: R$ {totalFiltrado.toFixed(2).replace('.', ',')}
          </strong>
        </div>
        
        <div className="table-container">
          {loading ? (
            <p style={{ padding: '32px', textAlign: 'center' }}>Carregando dados dos relatórios...</p>
          ) : despesasFiltradas.length === 0 ? (
            <p style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma despesa localizada com os filtros selecionados.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Colaborador</th>
                  <th>Cliente (CRM)</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Anexo</th>
                </tr>
              </thead>
              <tbody>
                {despesasFiltradas.map(d => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong>{new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                      {d.hora && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.hora}</div>}
                    </td>
                    <td><strong>{d.colaboradores?.nome || 'Você'}</strong></td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc' }}>
                        {d.cliente || 'Não informado'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {d.categoria_codigo ? `${d.categoria_codigo} - ` : ''}{d.categoria}
                      </span>
                    </td>
                    <td>
                      {d.descricao}
                      {d.motivo_reprovacao && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '2px' }}>
                          Reprovação: {d.motivo_reprovacao}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                      R$ {Number(d.amount).toFixed(2).replace('.', ',')}
                    </td>
                    <td>
                      <button 
                        type="button" 
                        className="badge bg-secondary" 
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => setHistoricoAtivo(d)}
                        title="Clique para ver o histórico detalhado"
                      >
                        {d.status} 🕒
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {d.foto_url ? (
                          <button 
                            type="button" 
                            className="btn" 
                            style={{ 
                              padding: '3px 8px', 
                              fontSize: '0.75rem', 
                              background: 'rgba(99, 102, 241, 0.15)', 
                              color: '#818cf8', 
                              border: '1px solid rgba(99, 102, 241, 0.3)' 
                            }}
                            onClick={() => setComprovanteAtivo({ url: d.foto_url, expense: d })}
                            title="Visualizar comprovante com zoom e rotação"
                          >
                            🧾 Ver
                          </button>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Visualizador de Comprovante Integrado */}
      {comprovanteAtivo && (
        <ReceiptModal 
          fileUrl={comprovanteAtivo.url} 
          expense={comprovanteAtivo.expense} 
          onClose={() => setComprovanteAtivo(null)} 
        />
      )}

      {/* Modal de Linha do Tempo e Histórico de Status */}
      {historicoAtivo && (
        <StatusHistoryModal 
          expense={historicoAtivo} 
          onClose={() => setHistoricoAtivo(null)} 
        />
      )}
    </>
  );
}
