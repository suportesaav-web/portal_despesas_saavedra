import React, { useState, useEffect, useMemo } from 'react';
import { policiesService } from '../services/policiesService';
import { CATEGORIAS_DESPESAS } from '../data/categories';

export default function Politicas({ user }) {
  const [policies, setPolicies] = useState(policiesService.getPolicies());
  const [grupoFiltro, setGrupoFiltro] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  const canEdit = ['Admin', 'Financeiro'].includes(user?.profile?.funcao);

  useEffect(() => {
    setPolicies(policiesService.getPolicies());
    const handleUpdate = () => setPolicies(policiesService.getPolicies());
    window.addEventListener('saav-policies-updated', handleUpdate);
    return () => window.removeEventListener('saav-policies-updated', handleUpdate);
  }, []);

  // Lista plana de categorias com grupo associado
  const todasCategorias = useMemo(() => {
    const list = [];
    CATEGORIAS_DESPESAS.forEach(grupo => {
      grupo.itens.forEach(item => {
        list.push({
          codigo: item.codigo,
          nome: item.nome,
          grupoCodigo: grupo.codigo,
          grupoNome: grupo.nome
        });
      });
    });
    return list;
  }, []);

  // Filtragem por busca e por grupo
  const categoriasFiltradas = useMemo(() => {
    return todasCategorias.filter(c => {
      const matchesGrupo = grupoFiltro === 'TODOS' || c.grupoCodigo === grupoFiltro;
      const matchesBusca = !busca.trim() || 
        c.nome.toLowerCase().includes(busca.toLowerCase()) || 
        c.codigo.includes(busca);
      return matchesGrupo && matchesBusca;
    });
  }, [todasCategorias, grupoFiltro, busca]);

  const handleLimitChange = (codigo, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setPolicies(prev => ({
      ...prev,
      categoryLimits: {
        ...prev.categoryLimits,
        [codigo]: {
          ...(prev.categoryLimits[codigo] || { justificativaObrigatoria: true }),
          teto: num
        }
      }
    }));
  };

  const handleJustificationToggle = (codigo, checked) => {
    setPolicies(prev => ({
      ...prev,
      categoryLimits: {
        ...prev.categoryLimits,
        [codigo]: {
          ...(prev.categoryLimits[codigo] || { teto: 0 }),
          justificativaObrigatoria: checked
        }
      }
    }));
  };

  const handleGlobalChange = (key, value) => {
    setPolicies(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedbackMsg(null);
    try {
      await policiesService.savePolicies(policies, user.id);
      setFeedbackMsg({
        type: 'success',
        text: 'Políticas corporativas e tetos por centro de custo atualizados com sucesso!'
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (e) {
      setFeedbackMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Tem certeza de que deseja restaurar os limites de teto padrões da Saavedra?')) {
      return;
    }
    setSaving(true);
    try {
      const reset = await policiesService.resetToDefaults(user.id);
      setPolicies(reset);
      setFeedbackMsg({
        type: 'success',
        text: 'Limites restaurados para os valores padrão de fábrica com sucesso!'
      });
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (e) {
      setFeedbackMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Políticas & Tetos de Gastos</h1>
          <p className="text-muted">
            Configuração corporativa de tetos por centro de custo contábil e diretrizes de compliance
          </p>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="btn" 
              onClick={handleReset} 
              disabled={saving}
              style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-main)' }}
            >
              ↺ Restaurar Padrões
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              onClick={handleSave} 
              disabled={saving}
            >
              💾 {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        )}
      </header>

      {/* Alerta de Feedback */}
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

      {/* Aviso de Modo Consulta caso não seja Admin ou Financeiro */}
      {!canEdit && (
        <div className="alert-box alert-warning" style={{ marginBottom: '24px' }}>
          <span>
            ℹ️ <strong>Modo Consulta:</strong> As diretrizes e limites abaixo são definidos pela Diretoria e Financeiro. Seu perfil tem permissão apenas de visualização.
          </span>
        </div>
      )}

      {/* Card de Regras Globais */}
      <div className="glass-panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚙️</span> Diretrizes Globais de Fechamento e Prevenção
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          {/* Prazo Retroativo */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              Prazo Retroativo Máximo (Dias)
            </label>
            <input 
              type="number" 
              min="1" 
              max="90" 
              className="form-input"
              disabled={!canEdit || saving}
              value={policies.maxRetroactiveDays}
              onChange={e => handleGlobalChange('maxRetroactiveDays', parseInt(e.target.value) || 30)}
            />
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Despesas com data anterior a este período exigirão aprovação especial da gestão.
            </small>
          </div>

          {/* Duplicidade */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
              Detecção de Possível Duplicidade
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default', fontSize: '0.85rem' }}>
              <input 
                type="checkbox" 
                disabled={!canEdit || saving}
                checked={policies.duplicateCheckEnabled}
                onChange={e => handleGlobalChange('duplicateCheckEnabled', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              <span>Alertar se o vendedor cadastrar mesmo valor e data</span>
            </label>
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
              Ajuda a evitar lançamentos acidentais repetidos.
            </small>
          </div>

          {/* Fins de Semana */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
              Aviso de Fins de Semana
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: canEdit ? 'pointer' : 'default', fontSize: '0.85rem' }}>
              <input 
                type="checkbox" 
                disabled={!canEdit || saving}
                checked={policies.weekendAlertEnabled}
                onChange={e => handleGlobalChange('weekendAlertEnabled', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
              />
              <span>Alertar conferência de rota em sábados/domingos</span>
            </label>
            <small style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
              Estimula o vínculo com a agenda comercial de viagens no CRM.
            </small>
          </div>
        </div>
      </div>

      {/* Tabela de Tetos por Centro Contábil */}
      <div className="glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Tetos de Gastos por Centro Contábil</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {categoriasFiltradas.length} categorias exibidas • Defina R$ 0,00 para centros sem teto limite
            </span>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Buscar por categoria ou código..." 
              className="form-input" 
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ width: '220px', padding: '6px 12px', fontSize: '0.85rem' }}
            />
            <select 
              className="form-input" 
              value={grupoFiltro} 
              onChange={e => setGrupoFiltro(e.target.value)}
              style={{ width: '200px', padding: '6px 12px', fontSize: '0.85rem' }}
            >
              <option value="TODOS">Todos os Grupos</option>
              {CATEGORIAS_DESPESAS.map(g => (
                <option key={g.codigo} value={g.codigo}>{g.codigo} - {g.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: '90px' }}>Código</th>
                <th>Nome da Categoria</th>
                <th>Grupo Contábil</th>
                <th style={{ width: '180px' }}>Teto Máximo (R$)</th>
                <th style={{ width: '200px', textAlign: 'center' }}>Justificativa Obrigatória</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {categoriasFiltradas.map(c => {
                const config = policies.categoryLimits[c.codigo] || { teto: 0, justificativaObrigatoria: false };
                const temTeto = config.teto > 0;

                return (
                  <tr key={c.codigo}>
                    <td>
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 'bold' }}>
                        {c.codigo}
                      </span>
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.9rem' }}>{c.nome}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {c.grupoCodigo} - {c.grupoNome}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>R$</span>
                        <input 
                          type="number" 
                          step="5" 
                          min="0"
                          className="form-input"
                          style={{ width: '120px', padding: '6px 10px', fontSize: '0.85rem', textAlign: 'right', fontWeight: 'bold' }}
                          disabled={!canEdit || saving}
                          value={config.teto === 0 ? '' : config.teto}
                          placeholder="Sem limite"
                          onChange={e => handleLimitChange(c.codigo, e.target.value)}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: canEdit && temTeto ? 'pointer' : 'default', opacity: temTeto ? 1 : 0.4 }}>
                        <input 
                          type="checkbox" 
                          disabled={!canEdit || saving || !temTeto}
                          checked={temTeto && config.justificativaObrigatoria}
                          onChange={e => handleJustificationToggle(c.codigo, e.target.checked)}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--warning)' }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>Exigir motivo</span>
                      </label>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {temTeto ? (
                        <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                          Teto R$ {config.teto.toFixed(2).replace('.', ',')}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-muted)' }}>
                          Livre
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
