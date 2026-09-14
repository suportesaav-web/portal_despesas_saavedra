import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { expensesService } from '../services/expenses';
import { CATEGORIAS_DESPESAS, getCategoriaByCodigo } from '../data/categories';
import { getInfoPrazoMesAtual } from '../utils/dateUtils';
import ReceiptModal from '../components/ReceiptModal';
import StatusHistoryModal from '../components/StatusHistoryModal';

export default function Despesas({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [modalError, setModalError] = useState(null);

  // Estados dos Novos Modais de Comprovante e Histórico
  const [comprovanteAtivo, setComprovanteAtivo] = useState(null);
  const [historicoAtivo, setHistoricoAtivo] = useState(null);

  // Máscara de Moeda Express
  const [displayAmount, setDisplayAmount] = useState('');

  // Informações do prazo do mês
  const prazoInfo = getInfoPrazoMesAtual();

  // Data e hora atuais como padrão
  const dataHoje = new Date().toISOString().split('T')[0];
  const horaAgora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Lista preditiva de clientes sugeridos (ordenada por frequência)
  const clientesSugeridos = useMemo(() => {
    const map = {};
    expenses.forEach(d => {
      if (d.cliente && d.cliente.trim()) {
        const c = d.cliente.trim();
        map[c] = (map[c] || 0) + 1;
      }
    });
    return Object.keys(map).sort((a, b) => map[b] - map[a]);
  }, [expenses]);

  const [formData, setFormData] = useState({
    descricao: '',
    amount: '',
    date: dataHoje,
    hora: horaAgora,
    cliente: '',
    categoria_codigo: '2.3.1'
  });

  const loadData = useCallback(async () => {
    try {
      const data = await expensesService.getExpenses(user?.profile);
      // Filtra apenas as do próprio usuário logado
      const minhas = data.filter(d => d.colaborador_id === user?.id);
      setExpenses(minhas);
    } catch (e) {
      console.error(e);
      setFeedbackMsg({ type: 'error', text: 'Não foi possível carregar suas despesas. Verifique sua conexão.' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Função de máscara de moeda em tempo real (R$ 0,00)
  function formatCurrencyInput(val) {
    const cleanDigits = String(val || '').replace(/\D/g, '');
    if (!cleanDigits) return { display: '', number: '' };
    const num = Number(cleanDigits) / 100;
    const display = num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
    return { display, number: num.toFixed(2) };
  }

  const handleAmountChange = (e) => {
    const { display, number } = formatCurrencyInput(e.target.value);
    setDisplayAmount(display);
    setFormData(prev => ({ ...prev, amount: number }));
  };

  const handleOpenNew = () => {
    setEditingExpense(null);
    setFormData({
      descricao: '',
      amount: '',
      date: dataHoje,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      cliente: '',
      categoria_codigo: '2.3.1'
    });
    setDisplayAmount('');
    setFile(null);
    setFilePreview(null);
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (despesa) => {
    setEditingExpense(despesa);
    const horaExtraida = despesa.hora || (despesa.descricao?.match(/\[Hora:\s*([0-9:]+)\]/)?.[1] || horaAgora);
    const descLimpa = despesa.descricao ? despesa.descricao.replace(/^\[Hora:.*?\]\s*/, '') : '';
    setFormData({
      descricao: descLimpa,
      amount: despesa.amount?.toString() || '',
      date: despesa.date || dataHoje,
      hora: horaExtraida,
      cliente: despesa.cliente || '',
      categoria_codigo: despesa.categoria_codigo || '2.3.1'
    });

    if (despesa.amount) {
      const num = Number(despesa.amount);
      setDisplayAmount(num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    } else {
      setDisplayAmount('');
    }

    setFile(null);
    setFilePreview(null);
    setModalError(null);
    setShowModal(true);
  };

  const handleCategoriaChange = (e) => {
    setFormData({ ...formData, categoria_codigo: e.target.value });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setModalError(null);
    if (!selectedFile) {
      setFile(null);
      setFilePreview(null);
      return;
    }

    // Validação de Tamanho (Máx 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (selectedFile.size > MAX_SIZE) {
      setModalError('O arquivo selecionado excede o limite máximo permitido de 10MB.');
      e.target.value = '';
      setFile(null);
      setFilePreview(null);
      return;
    }

    // Validação de Tipo (Imagens ou PDF)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setModalError('Formato inválido. Por favor, envie uma foto (JPG, PNG, WebP) ou arquivo PDF.');
      e.target.value = '';
      setFile(null);
      setFilePreview(null);
      return;
    }

    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(selectedFile));
    } else {
      setFilePreview({ isPdf: true, name: selectedFile.name });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError(null);
    if (!formData.cliente.trim()) {
      setModalError('Por favor, informe onde esteve (Cliente / Local da Visita).');
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      setModalError('Por favor, informe um valor válido maior que zero.');
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

      if (editingExpense) {
        await expensesService.updateExpense(editingExpense.id, { ...payload, foto_url: editingExpense.foto_url }, user.id, file);
        setFeedbackMsg({ type: 'success', text: 'Despesa corrigida e reenviada com sucesso! Ela retornou para a esteira em status ABERTO.' });
      } else {
        await expensesService.addExpense(payload, user.id, file);
        setFeedbackMsg({ type: 'success', text: 'Despesa cadastrada com sucesso! Ela já consta na esteira de validação do CRM.' });
      }

      setShowModal(false);
      setEditingExpense(null);
      setFormData({
        descricao: '',
        amount: '',
        date: dataHoje,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        cliente: '',
        categoria_codigo: '2.3.1'
      });
      setFile(null);
      setModalError(null);
      loadData();
    } catch (error) {
      setModalError('Erro ao salvar despesa: ' + (error.message || 'Tente novamente.'));
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Minhas Despesas</h1>
          <p className="text-muted">Lançamentos de visitas, deslocamentos e operações de campo</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenNew}>
          + Nova Despesa
        </button>
      </header>

      {/* Alerta de Feedback Geral */}
      {feedbackMsg && (
        <div className={`alert-box ${feedbackMsg.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
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

      {/* Banner de Prazo do Mês */}
      <div 
        className="glass-panel" 
        style={{ 
          marginBottom: '24px', 
          padding: '16px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
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
                  <th>Comprovante / Ações</th>
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
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {d.foto_url ? (
                          <button 
                            type="button" 
                            className="btn" 
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '0.8rem', 
                              background: 'rgba(99, 102, 241, 0.15)', 
                              color: '#818cf8', 
                              border: '1px solid rgba(99, 102, 241, 0.3)' 
                            }}
                            onClick={() => setComprovanteAtivo({ url: d.foto_url, expense: d })}
                            title="Visualizar comprovante com zoom e rotação"
                          >
                            🧾 Comprovante
                          </button>
                        ) : (
                          <span className="text-muted small">Sem anexo</span>
                        )}

                        <button 
                          type="button" 
                          className="btn" 
                          style={{ 
                            padding: '5px 10px', 
                            fontSize: '0.8rem', 
                            background: 'rgba(255, 255, 255, 0.08)', 
                            border: '1px solid rgba(255, 255, 255, 0.12)' 
                          }}
                          onClick={() => setHistoricoAtivo(d)}
                          title="Ver linha do tempo e auditoria da despesa"
                        >
                          🕒 Histórico
                        </button>

                        {d.status === 'REPROVADO' && (
                          <button 
                            type="button" 
                            className="btn" 
                            style={{ 
                              padding: '5px 10px', 
                              fontSize: '0.8rem', 
                              background: '#f59e0b', 
                              color: '#000', 
                              fontWeight: 'bold', 
                              border: 'none' 
                            }}
                            onClick={() => handleOpenEdit(d)}
                            title="Corrigir apontamento e reenviar para validação"
                          >
                            ✏️ Corrigir
                          </button>
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

      {/* Modal de Nova / Correção de Despesa */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content" style={{ maxWidth: '580px' }}>
            <h2 style={{ marginBottom: '8px' }}>
              {editingExpense ? 'Corrigir e Reenviar Despesa' : 'Nova Despesa de Visita'}
            </h2>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '20px' }}>
              {editingExpense 
                ? 'Ajuste os dados solicitados pela gestão para submeter novamente a despesa à esteira de aprovação.' 
                : 'Preencha os dados da visita para conferência com o CRM e reembolso.'}
            </p>

            {modalError && (
              <div className="alert-box alert-danger">
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Onde Esteve / Cliente com Autocomplete */}
              <div className="form-group">
                <label>
                  Onde esteve? (Cliente / Local da Visita) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input 
                  type="text" 
                  list="clientes-sugeridos"
                  className="form-input" 
                  required 
                  disabled={saving}
                  placeholder="Digite ou escolha um cliente visitado..."
                  value={formData.cliente} 
                  onChange={e => setFormData({ ...formData, cliente: e.target.value })} 
                />
                <datalist id="clientes-sugeridos">
                  {clientesSugeridos.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>

                {clientesSugeridos.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Frequentes:</span>
                    {clientesSugeridos.slice(0, 4).map(c => (
                      <button
                        key={c}
                        type="button"
                        className="badge"
                        style={{ 
                          background: 'rgba(99, 102, 241, 0.15)', 
                          color: '#a5b4fc', 
                          border: '1px solid rgba(99, 102, 241, 0.3)', 
                          cursor: 'pointer',
                          padding: '2px 8px',
                          fontSize: '0.75rem'
                        }}
                        onClick={() => setFormData(prev => ({ ...prev, cliente: c }))}
                      >
                        + {c}
                      </button>
                    ))}
                  </div>
                )}
                <small className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
                  Informe o cliente exatamente como registrado no CRM para agilizar a validação.
                </small>
              </div>

              {/* Data e Horário com Atalho Agora */}
              <div className="form-row">
                <div className="form-group">
                  <label>Data da Despesa <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="date" 
                    className="form-input" 
                    required 
                    disabled={saving}
                    value={formData.date} 
                    onChange={e => setFormData({ ...formData, date: e.target.value })} 
                  />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0 }}>Horário <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <button
                      type="button"
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '4px',
                        color: 'var(--text-main)',
                        fontSize: '0.75rem',
                        padding: '2px 6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      }))}
                      title="Definir horário atual"
                    >
                      🕒 Agora
                    </button>
                  </div>
                  <input 
                    type="time" 
                    className="form-input" 
                    required
                    disabled={saving}
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
                  disabled={saving}
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

              {/* Valor com Máscara Moeda e Descrição */}
              <div className="form-row">
                <div className="form-group">
                  <label>Valor Gasto (R$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text" 
                    inputMode="numeric"
                    className="form-input" 
                    required 
                    disabled={saving}
                    placeholder="R$ 0,00"
                    value={displayAmount} 
                    onChange={handleAmountChange} 
                  />
                  <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Digite apenas os números (centavos automáticos).
                  </small>
                </div>
                <div className="form-group">
                  <label>Descrição / Justificativa <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    disabled={saving}
                    placeholder="Ex: Estacionamento durante reunião comercial"
                    value={formData.descricao} 
                    onChange={e => setFormData({ ...formData, descricao: e.target.value })} 
                  />
                </div>
              </div>

              {/* Foto / Comprovante com Preview */}
              <div className="form-group">
                <label>Foto do Comprovante / Recibo / Cupom Fiscal</label>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  className="form-input" 
                  disabled={saving}
                  onChange={handleFileChange} 
                />
                
                {/* Miniatura / Preview da foto selecionada */}
                {filePreview && (
                  <div style={{ 
                    marginTop: '10px', 
                    padding: '10px 14px', 
                    background: 'rgba(255, 255, 255, 0.04)', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {typeof filePreview === 'string' ? (
                        <img 
                          src={filePreview} 
                          alt="Pré-visualização do recibo" 
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)' }} 
                        />
                      ) : (
                        <span style={{ fontSize: '1.8rem' }}>📄</span>
                      )}
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{file?.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#10b981' }}>
                          ✓ {(file?.size ? (file.size / 1024).toFixed(0) : 0)} KB • Pronto para envio
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: 'none' }}
                      onClick={() => { setFile(null); setFilePreview(null); }}
                    >
                      Remover
                    </button>
                  </div>
                )}

                <small className="text-muted" style={{ fontSize: '0.75rem', display: 'block', marginTop: '6px' }}>
                  📷 Toque para fotografar com a câmera do celular ou escolher arquivo (JPG, PNG, WebP, PDF até 10MB).
                </small>
              </div>

              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Gravando e enviando anexo...' : (editingExpense ? 'Reenviar para Aprovação' : 'Salvar Despesa')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
