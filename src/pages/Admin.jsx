import React, { useEffect, useState } from 'react';
import { adminService } from '../services/admin';

export default function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ uid: '', email: '', nome: '', funcao: 'Vendedor' });

  useEffect(() => {
    // Redundância de segurança no Frontend
    if (user.profile?.funcao !== 'Admin') return;
    loadUsers();
  }, [user]);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await adminService.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar usuários: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await adminService.addUserProfile(formData.uid, formData.email, formData.nome, formData.funcao);
      setShowModal(false);
      setFormData({ uid: '', email: '', nome: '', funcao: 'Vendedor' });
      loadUsers();
    } catch (e) {
      alert("Erro ao adicionar usuário: " + e.message);
    }
  };

  const handleUpdateRole = async (uid, newRole) => {
    if(!window.confirm(`Tem certeza que deseja mudar a função para ${newRole}?`)) return;
    try {
      await adminService.updateUser(uid, { funcao: newRole });
      loadUsers();
    } catch(e) {
      alert("Erro ao atualizar: " + e.message);
    }
  };

  const handleDelete = async (uid) => {
    if(!window.confirm("CUIDADO: Tem certeza que deseja deletar este perfil?")) return;
    try {
      await adminService.deleteUser(uid);
      loadUsers();
    } catch(e) {
      alert("Erro ao deletar (ele pode estar atrelado a despesas): " + e.message);
    }
  };

  if (user.profile?.funcao !== 'Admin') {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}><h1>Acesso Negado</h1><p>Apenas Administradores podem acessar esta área.</p></div>;
  }

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1>Painel de Controle</h1>
          <p className="text-muted">Gestão de Colaboradores</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Vincular Novo Usuário
        </button>
      </header>

      <div className="glass-panel">
        <div className="table-container">
          {loading ? <p>Carregando usuários...</p> : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Função (Cargo)</th>
                  <th>Data Criação</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 'bold' }}>{u.nome}</td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <select 
                        className="form-input" 
                        style={{ padding: '4px 8px', width: 'auto', background: 'transparent' }} 
                        value={u.funcao}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        disabled={u.id === user.id} // Não deixa o admin tirar o próprio cargo
                      >
                        <option value="Admin">Administrador (Total)</option>
                        <option value="Financeiro">Financeiro (Pagar)</option>
                        <option value="Kyanne">Técnico (Kyanne)</option>
                        <option value="Vendedor">Vendedor (Básico)</option>
                      </select>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn" 
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '6px 12px' }}
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === user.id}
                      >
                        Remover
                      </button>
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
            <h2 style={{ marginBottom: '24px' }}>Vincular Usuário</h2>
            <div style={{ padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem' }}>
              <strong>Atenção:</strong> Por segurança, as senhas só podem ser criadas no painel Auth do Supabase. 
              Crie o login lá primeiro, copie o <strong>User UID</strong> e cole abaixo para ativar o perfil no sistema.
            </div>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>User UID (do Supabase Auth)</label>
                <input type="text" className="form-input" required value={formData.uid} onChange={e => setFormData({...formData, uid: e.target.value})} placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>E-mail</label>
                  <input type="email" className="form-input" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input type="text" className="form-input" required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label>Função no Sistema</label>
                <select className="form-input" value={formData.funcao} onChange={e => setFormData({...formData, funcao: e.target.value})}>
                  <option value="Vendedor">Vendedor</option>
                  <option value="Kyanne">Técnico (Kyanne)</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Admin">Administrador (Total)</option>
                </select>
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Vincular Perfil</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
