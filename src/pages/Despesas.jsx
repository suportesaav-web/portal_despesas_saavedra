import React, { useEffect, useState } from 'react';
import { expensesService } from '../services/expenses';

export default function Despesas({ user }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ descricao: '', amount: '', date: '', categoria: 'Alimentacao', cliente: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await expensesService.addExpense(formData, user.id, file);
      setShowModal(false);
      setFormData({ descricao: '', amount: '', date: '', categoria: 'Alimentacao', cliente: '' });
      setFile(null);
      loadData();
    } catch (error) {
      alert('Erro: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1>Minhas Despesas</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Nova Despesa
        </button>
      </header>

      <div className="glass-panel">
        <div className="table-container">
          {loading ? <p>Carregando...</p> : (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Comprovante</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(d => (
                  <tr key={d.id}>
                    <td>{new Date(d.date).toLocaleDateString('pt-BR')}</td>
                    <td>{d.descricao} <br/><small className="text-muted">{d.cliente}</small></td>
                    <td>{d.categoria}</td>
                    <td>R$ {Number(d.amount).toFixed(2).replace('.', ',')}</td>
                    <td><span className={`badge bg-secondary`}>{d.status}</span></td>
                    <td>
                      {d.foto_url ? (
                        <a href={d.foto_url} target="_blank" rel="noreferrer" className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)' }}>Ver Foto</a>
                      ) : (
                        <span className="text-muted small">Sem foto</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-content">
            <h2 style={{ marginBottom: '24px' }}>Nova Despesa</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Descrição</label>
                <input type="text" className="form-input" required value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Valor (R$)</label>
                  <input type="number" step="0.01" className="form-input" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Data</label>
                  <input type="date" className="form-input" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <select className="form-input" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})}>
                  <option value="Alimentacao">Alimentação</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Viagem">Viagem</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="form-group">
                <label>Foto do Comprovante (Opcional)</label>
                <input type="file" accept="image/*,.pdf" className="form-input" onChange={e => setFile(e.target.files[0])} />
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
