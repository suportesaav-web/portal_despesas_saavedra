import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { authService } from './services/auth';
import './index.css';

import Layout from './components/Layout';
import Login from './pages/Login';

// Lazy loading das páginas para dividir o bundle (Code-Splitting)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Despesas = lazy(() => import('./pages/Despesas'));
const Aprovacoes = lazy(() => import('./pages/Aprovacoes'));
const Admin = lazy(() => import('./pages/Admin'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Politicas = lazy(() => import('./pages/Politicas'));

const PageFallback = () => (
  <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
    <span style={{ fontSize: '1.5rem' }}>⏳</span>
    <span>Carregando módulo...</span>
  </div>
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = authService.onAuthStateChange(() => {
      checkUser();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    try {
      const u = await authService.getCurrentUser();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Carregando SAAV EXPENSES...</div>;

  if (!user) {
    return (
      <>
        <Login onLogin={checkUser} />
        <Analytics />
        <SpeedInsights />
      </>
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout user={user} />}>
            <Route index element={<Suspense fallback={<PageFallback />}><Dashboard user={user} /></Suspense>} />
            <Route path="despesas" element={<Suspense fallback={<PageFallback />}><Despesas user={user} /></Suspense>} />
            <Route path="aprovacoes" element={<Suspense fallback={<PageFallback />}><Aprovacoes user={user} /></Suspense>} />
            <Route path="relatorios" element={<Suspense fallback={<PageFallback />}><Relatorios user={user} /></Suspense>} />
            <Route path="politicas" element={<Suspense fallback={<PageFallback />}><Politicas user={user} /></Suspense>} />
            <Route path="admin" element={<Suspense fallback={<PageFallback />}><Admin user={user} /></Suspense>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default App;
