import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';
import { CATEGORIAS_DESPESAS, getCategoriaByCodigo } from '../data/categories';
import { getInfoPrazoMesAtual } from '../utils/dateUtils';

export default function Despesas({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);

  // Informações do prazo do mês
  const prazoInfo = getInfoPrazoMesAtual();

  // Data e hora atuais como padrão
  const dataHoje = new Date().toISOString().split('T')[0];
  const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const [formData, setFormData] = useState({
    descricao: '',
    amount: '',
    date: dataHoje,
    hora: horaAgora,
    cliente: '',
    categoria_codigo: '2.3.1'
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await expensesService.getExpenses(user.profile);
      // Filtra apenas as do próprio usuário logado
      const minhas = data.filter(d => d.colaborador_id === user.id);
      setExpenses(minhas);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleCategoriaChange = (e) => {
    setFormData({ ...formData, categoria_codigo: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cliente.trim()) {
      alert('Por favor, informe onde esteve (Cliente / Local da Visita).');
      return;
    }

    setSaving(true);
    try {
      const catInfo = getCategoriaByCodigo(formData.categoria_codigo);
      const payload = {
        ...formData,
        categoria: catInfo ? catInfo.itemNome : 'OUTROS',
        categoria_codigo: formData.categoria_codigo,
        categoria_grupo: catInfo ? `${catInfo.grupoCodigo} - ${catInfo.grupoNome}` : ''
      };

      await expensesService.addExpense(payload, user.id, file);
      setShowModal(false);
      setFormData({
        descricao: '',
        amount: '',
        date: dataHoje,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        cliente: '',
        categoria_codigo: '2.3.1'
      });
      setFile(null);
      loadData();
    } catch (error) {
      alert('Erro ao salvar despesa: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ABERTO':
        return <span className="badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>Em Aberto (Validação CRM)</span>;
      case 'VALIDADO':
        return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>Validado (Fila Financeiro)</span>;
      case 'APROVADO':
        return <span className="badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' }}>Reembolsado (Pago)</span>;
      case 'REPROVADO':
        return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' }}>Reprovado</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1>Minhas Despesas</h1>
          <p className="text-muted">Lançamentos de visitas, deslocamentos e operações de campo</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nova Despesa
        </button>
      </header>

      {/* Banner de Prazo do Mês */}
      <div 
        className="glass-panel" 
        style={{ 
          marginBottom: '24px', 
          padding: '16px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderLeft: prazoInfo.ehUrgente ? '4px solid var(--warning)' : '4px solid var(--primary)',
          background: prazoInfo.ehUrgente ? 'rgba(234, 179, 8, 0.08)' : 'rgba(99, 102, 241, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>⏱️</span>
          <div>
            <strong>Prazo Limite do Mês: {prazoInfo.formatado}</strong> (Último dia útil)
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {prazoInfo.ehHoje 
                ? 'Hoje é o último dia para prestar contas deste ciclo!'
                : prazoInfo.expirado 
                  ? 'O prazo para o mês encerrou. Lançamentos podem depender de autorização especial.'
                  : `Restam ${prazoInfo.diasRestantes} dia(s) para fechamento de lançamentos.`}
            </div>
          </div>
        </div>
        <span className="badge" style={{ background: prazoInfo.ehUrgente ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.1)' }}>
          {prazoInfo.diasRestantes >= 0 ? `${prazoInfo.diasRestantes} dias restantes` : 'Ciclo encerrado'}
        </span>
      </div>

      {/* Tabela de Lançamentos */}
      <div className="glass-panel">
        <div className="table-container">
          {loading ? (
            <p style={{ padding: '24px', textAlign: 'center' }}>Carregando suas despesas...</p>
          ) : expenses.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Você ainda não tem despesas cadastradas neste ciclo.</p>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                Cadastrar Primeira Despesa
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Cliente / Onde Esteve</th>
                  <th>Categoria</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(d => (
                  <tr key={d.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <strong>{new Date(d.date + 'T00:00:00').toLocaleDateString('pt-BR')}</strong>
                      {d.hora && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.hora}</div>}
                    </td>
                    <td>
                      <strong>{d.cliente || 'Não informado'}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem' }}>
                        {d.categoria_codigo ? `${d.categoria_codigo} - ` : ''}{d.categoria}
                      </span>
                    </td>
                    <td>
                      {d.descricao}
                      {d.motivo_reprovacao && (
                        <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                          <strong>Motivo Reprovação:</strong> {d.motivo_reprovacao}
                        </div>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                      R$ {Number(d.amount).toFixed(2).replace('.', ',')}
                    </td>
                    <td>{getStatusBadge(d.status)}</td>
                    <td>
                      {d.foto_url ? (
                        <a 
                          href={d.foto_url} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn" 
                          style={{ padding: '4px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }}
                        >
                          Ver Anexo
                        </a>
                      ) : (
                        <span className="text-muted small">Sem anexo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Nova Despesa */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '580px' }}>
            <h2 style={{ marginBottom: '8px' }}>Nova Despesa de Visita</h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
              Preencha os dados da visita para conferência com o CRM e reembolso.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Onde Esteve / Cliente */}
              <div className="form-group">
                <label>
                  Onde esteve? (Cliente / Local da Visita) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  className="form-input" 
                  required 
                  placeholder="Ex: Supermercado XYZ - Unidade Centro"
                  value={formData.cliente} 
                  onChange={e => setFormData({ ...formData, cliente: e.target.value })} 
                />
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Informe o cliente exatamente como registrado no CRM para agilizar a aprovação.
                </small>
              </div>

              {/* Data e Horário */}
              <div className="form-row">
                <div className="form-group">
                  <label>Data da Despesa <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    value={formData.date} 
                    onChange={e => setFormData({ ...formData, date: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Horário (Aprox.) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="time" 
                    className="form-input" 
                    required
                    value={formData.hora} 
                    onChange={e => setFormData({ ...formData, hora: e.target.value })} 
                  />
                </div>
              </div>

              {/* Categoria Contábil */}
              <div className="form-group">
                <label>Tipo de Despesa (Plano de Contas) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select 
                  className="form-input" 
                  value={formData.categoria_codigo} 
                  onChange={handleCategoriaChange}
                >
                  {CATEGORIAS_DESPESAS.map(grupo => (
                    <optgroup key={grupo.codigo} label={`${grupo.codigo} - ${grupo.nome}`}>
                      {grupo.itens.map(item => (
                        <option key={item.codigo} value={item.codigo}>
                          {item.codigo} - {item.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Valor e Descrição */}
              <div className="form-row">
                <div className="form-group">
                  <label>Valor Gasto (R$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0.01"
                    className="form-input" 
                    required 
                    placeholder="0,00"
                    value={formData.amount} 
                    onChange={e => setFormData({ ...formData, amount: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <label>Descrição / Justificativa <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="Ex: Estacionamento durante reunião comercial"
                    value={formData.descricao} 
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })} 
                  />
                </div>
              </div>

              {/* Foto / Comprovante */}
              <div className="form-group">
                <label>Foto do Comprovante / Recibo / Cupom Fiscal</label>
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  className="form-input" 
                  onChange={e => setFile(e.target.files[0])} 
                />
                <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Formatos aceitos: JPG, PNG e PDF (Máx. 10MB).
                </small>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Gravando e enviando anexo...' : 'Salvar Despesa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
