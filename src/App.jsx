import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/auth';
import './index.css';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Despesas from './pages/Despesas';
import Aprovacoes from './pages/Aprovacoes';

import Admin from './pages/Admin';

import Relatorios from './pages/Relatorios';

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
    } catch(e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Carregando Portal Saavedra...</div>;

  if (!user) {
    return <Login onLogin={checkUser} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} />}>
          <Route index element={<Dashboard user={user} />} />
          <Route path="despesas" element={<Despesas user={user} />} />
          <Route path="aprovacoes" element={<Aprovacoes user={user} />} />
          <Route path="relatorios" element={<Relatorios user={user} />} />
          <Route path="admin" element={<Admin user={user} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
