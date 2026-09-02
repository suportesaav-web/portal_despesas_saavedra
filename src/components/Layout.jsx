import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function Layout({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          CorpExpenses
        </div>
        
        <div style={{ marginBottom: '24px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.profile?.nome || 'Usuário'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.profile?.funcao || 'Sem perfil'}</div>
        </div>

        <ul className="nav-links" style={{ flex: 1 }}>
          <Link to="/" className={`nav-link ${isActive('/')}`}>
            <i className="bi bi-house-door"></i> Dashboard
          </Link>
          
          <Link to="/despesas" className={`nav-link ${isActive('/despesas')}`}>
            <i className="bi bi-receipt"></i> Minhas Despesas
          </Link>

          {['Gestor', 'Supervisor', 'Kyanne', 'Financeiro', 'Admin'].includes(user?.profile?.funcao) && (
            <Link to="/aprovacoes" className={`nav-link ${isActive('/aprovacoes')}`}>
              <i className="bi bi-check-circle"></i> Aprovações
            </Link>
          )}

          <Link to="/relatorios" className={`nav-link ${isActive('/relatorios')}`}>
            <i className="bi bi-graph-up"></i> Relatórios
          </Link>

          {user?.profile?.funcao === 'Admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin')}`}>
              <i className="bi bi-people"></i> Gestão de Usuários
            </Link>
          )}
        </ul>

        <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }} onClick={handleLogout}>
          Sair
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
