import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth';
import OfflineStatusBar from './OfflineStatusBar';
import NotificationCenter from './NotificationCenter';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationCenter />
          <button 
            type="button"
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Fechar Menu' : 'Abrir Menu'}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Backdrop escurecido para o drawer mobile */}
      {mobileMenuOpen && (
        <div className="mobile-backdrop" onClick={closeMobileMenu} />
      )}

      {/* Sidebar (Desktop fixo / Mobile off-canvas drawer) */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-header">
          <div className="brand-logo-badge">
            <span>S</span>
          </div>
          <div className="brand-logo-meta">
            <span className="brand-company">SAAVEDRA</span>
            <span className="brand-app-name">EXPENSES PORTAL</span>
          </div>
        </div>

        <ul className="nav-links" style={{ flex: 1 }}>
          <Link to="/" className={`nav-link ${isActive('/')}`} onClick={closeMobileMenu}>
            <span className="nav-icon">📊</span>
            <span>Dashboard</span>
          </Link>
          
          <Link to="/despesas" className={`nav-link ${isActive('/despesas')}`} onClick={closeMobileMenu}>
            <span className="nav-icon">🧾</span>
            <span>Minhas Despesas</span>
          </Link>

          {['Gestor', 'Supervisor', 'Kyanne', 'Financeiro', 'Admin'].includes(user?.profile?.funcao) && (
            <Link to="/aprovacoes" className={`nav-link ${isActive('/aprovacoes')}`} onClick={closeMobileMenu}>
              <span className="nav-icon">✅</span>
              <span>Aprovações CRM</span>
            </Link>
          )}

          <Link to="/relatorios" className={`nav-link ${isActive('/relatorios')}`} onClick={closeMobileMenu}>
            <span className="nav-icon">📑</span>
            <span>Relatórios & Extratos</span>
          </Link>

          {['Financeiro', 'Admin'].includes(user?.profile?.funcao) && (
            <Link to="/politicas" className={`nav-link ${isActive('/politicas')}`} onClick={closeMobileMenu}>
              <span className="nav-icon">🛡️</span>
              <span>Políticas & Tetos</span>
            </Link>
          )}

          {user?.profile?.funcao === 'Admin' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin')}`} onClick={closeMobileMenu}>
              <span className="nav-icon">👥</span>
              <span>Gestão de Usuários</span>
            </Link>
          )}
        </ul>

        <div className="sidebar-footer">
          <button 
            type="button" 
            className="btn-logout" 
            onClick={handleLogout}
          >
            <span>🚪</span>
            <span>Sair do Sistema</span>
          </button>
          <span className="system-version-tag">Saavedra Repr. • v2.4</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Topbar Superior no Desktop */}
        <header className="desktop-topbar">
          <div className="topbar-left">
            <span className="topbar-portal-tag">PORTAL SAAVEDRA</span>
            <span className="topbar-breadcrumb-sep">/</span>
            <span className="topbar-page-name">
              {location.pathname === '/' && 'Dashboard Executivo'}
              {location.pathname === '/despesas' && 'Minhas Despesas'}
              {location.pathname === '/aprovacoes' && 'Aprovações de Reembolso CRM'}
              {location.pathname === '/relatorios' && 'Relatórios & Extratos Financeiros'}
              {location.pathname === '/politicas' && 'Políticas & Tetos Orçamentários'}
              {location.pathname === '/admin' && 'Gestão de Usuários'}
            </span>
          </div>

          <div className="topbar-right">
            <NotificationCenter />
            
            <div className="topbar-divider"></div>
            
            <div className="topbar-user-pill">
              <div className="user-avatar-circle">
                {user?.profile?.nome ? user.profile.nome.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info-column">
                <span className="user-pill-name">{user?.profile?.nome || 'Usuário'}</span>
                <span className="user-pill-role">{user?.profile?.funcao || 'Colaborador'}</span>
              </div>
            </div>

            <button 
              type="button" 
              className="topbar-btn-logout" 
              onClick={handleLogout}
              title="Sair do Sistema"
              aria-label="Sair do Sistema"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        <OfflineStatusBar />
        <div className="page-content-wrapper">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
