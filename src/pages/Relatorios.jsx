import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';

export default function Relatorios({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    // Redundância: Apenas cargos autorizados devem acessar relatórios da empresa toda
    // Vendedor que entrar aqui vai ver apenas as dele por conta do RLS/Service
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

  // Lógica de Filtragem Local
  const despesasFiltradas = expenses.filter(d => {
    let passaFiltro = true;
    
    if (filtroStatus !== 'TODOS' && d.status !== filtroStatus) passaFiltro = false;
    
    if (dataInicio) {
      if (new Date(d.date) < new Date(dataInicio)) passaFiltro = false;
    }
    if (dataFim) {
      if (new Date(d.date) > new Date(dataFim)) passaFiltro = false;
    }

    return passaFiltro;
  });

  const handleExportCSV = () => {
    // Monta o cabeçalho
    const headers = ['Data', 'Colaborador', 'Descrição', 'Categoria', 'Cliente', 'Valor', 'Status', 'Comprovante'];
    
    // Converte os dados filtrados para linhas CSV
    const rows = despesasFiltradas.map(d => {
      return [
        new Date(d.date).toLocaleDateString('pt-BR'), // Data
        `"${d.colaboradores?.nome || 'Desconhecido'}"`, // Colaborador (com aspas p/ evitar erro com vírgulas no nome)
        `"${d.descricao}"`, // Descrição
        d.categoria, // Categoria
        `"${d.cliente || ''}"`, // Cliente
        d.amount.toString().replace('.', ','), // Valor formato BR
        d.status, // Status
        `"${d.foto_url || 'Sem foto'}"` // Link foto
      ];
    });

    // Junta tudo (usando ponto-e-vírgula para excel PT-BR)
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(';') + "\n"
      + rows.map(r => r.join(';')).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_despesas_${new Date().getTime()}.csv`);
    document.body.appendChild(link); // Requisito Firefox
    link.click();
    document.body.removeChild(link);
  };

  const totalFiltrado = despesasFiltradas.reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Relatórios Gerais</h1>
          <p className="text-muted">Extrato e exportação para Excel</p>
        </div>
        <button className="btn btn-success" onClick={handleExportCSV}>
          <i className="bi bi-file-earmark-excel"></i> Exportar para Excel (CSV)
        </button>
      </header>

      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Filtros</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Status</label>
            <select className="form-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="TODOS">Todos</option>
              <option value="ABERTO">Em Aberto (Fila Kyanne)</option>
              <option value="VALIDADO">Validado (Fila Financeiro)</option>
              <option value="APROVADO">Pago (Aprovado)</option>
              <option value="REPROVADO">Reprovado</option>
            </select>
          </div>
          <div className="form-group">
            <label>Data Inicial</label>
            <input type="date" className="form-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Data Final</label>
            <input type="date" className="form-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="glass-panel">
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <strong>Mostrando {despesasFiltradas.length} itens</strong>
          <strong>Total Filtrado: R$ {totalFiltrado.toFixed(2).replace('.', ',')}</strong>
        </div>
        
        <div className="table-container">
          {loading ? <p>Carregando relatórios...</p> : (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Colaborador</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {despesasFiltradas.map(d => (
                  <tr key={d.id}>
                    <td>{new Date(d.date).toLocaleDateString('pt-BR')}</td>
                    <td>{d.colaboradores?.nome || 'Você'}</td>
                    <td>{d.descricao} <br/><small className="text-muted">{d.categoria}</small></td>
                    <td>R$ {Number(d.amount).toFixed(2).replace('.', ',')}</td>
                    <td><span className="badge bg-secondary">{d.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
