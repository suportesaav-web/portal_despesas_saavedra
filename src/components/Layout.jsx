import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';

export default function Layout({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path ? 'active' : '';
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-container">
      {/* Mobile Top Header (visível apenas em telas <= 768px) */}
      <header className="mobile-header">
        <div className="mobile-header-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          <span>SAAV EXPENSES</span>
        </div>
        <button 
          type="button"
          className="mobile-menu-btn" 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Fechar Menu' : 'Abrir Menu'}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Backdrop escurecido para o drawer mobile */}
      {mobileMenuOpen && (
        <div className="mobile-backdrop" onClick={closeMobileMenu} />
      )}

      {/* Sidebar (Desktop fixo / Mobile off-canvas drawer) */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          SAAV EXPENSES
        </div>
        
        <div style={{ marginBottom: '24px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.profile?.nome || 'Usuário'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.profile?.funcao || 'Sem perfil'}</div>
        </div>

        <ul className="nav-links" style={{ flex: 1 }}>
          <Link to="/" className={`nav-link ${isActive('/')}`} onClick={closeMobileMenu}>
            <i className="bi bi-house-door"></i> Dashboard
          </Link>
          
          <Link to="/despesas" className={`nav-link ${isActive('/despesas')}`} onClick={closeMobileMenu}>
            <i className="bi bi-receipt"></i> Minhas Despesas
          </Link>

          {['Gestor', 'Supervisor', 'Kyanne', 'Financeiro', 'Admin'].includes(user?.profile?.funcao) && (
            <Link to="/aprovacoes" className={`nav-link ${isActive('/aprovacoes')}`} onClick={closeMobileMenu}>
              <i className="bi bi-check-circle"></i> Aprovações
            </Link>
          )}

          <Link to="/relatorios" className={`nav-link ${isActive('/relatorios')}`} onClick={closeMobileMenu}>
            <i className="bi bi-graph-up"></i> Relatórios
          </Link>

          {user?.profile?.funcao === 'Admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={closeMobileMenu}>
              <i className="bi bi-people"></i> Gestão de Usuários
            </Link>
          )}
        </ul>

        <button 
          type="button"
          className="btn" 
          style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', width: '100%', minHeight: '44px' }} 
          onClick={handleLogout}
        >
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
