import React, { useState, useEffect, useRef } from 'react';
import { notificationService } from '../services/notificationService';

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [hasPermission, setHasPermission] = useState(notificationService.hasNotificationPermission());
  const dropdownRef = useRef(null);

  const refreshNotifications = () => {
    setNotifications(notificationService.getInAppNotifications());
    setHasPermission(notificationService.hasNotificationPermission());
  };

  useEffect(() => {
    refreshNotifications();

    const handleChange = () => refreshNotifications();
    window.addEventListener('saav-notifications-changed', handleChange);

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('saav-notifications-changed', handleChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      notificationService.markAllAsRead();
    }
  };

  const handleRequestPush = async () => {
    const granted = await notificationService.requestNotificationPermission();
    setHasPermission(granted);
    if (granted) {
      notificationService.addInAppNotification({
        title: 'Notificações Ativadas',
        message: 'Você receberá avisos quando suas despesas forem avaliadas.',
        type: 'success'
      });
    }
  };

  return (
    <div className="notification-center-wrapper" ref={dropdownRef}>
      <button 
        type="button" 
        className="notification-bell-btn"
        onClick={handleToggle}
        aria-label="Abrir notificações"
        title="Central de Notificações"
      >
        <span style={{ fontSize: '1.2rem' }}>🔔</span>
        {unreadCount > 0 && (
          <span className="notification-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-panel">
          <div className="notification-header">
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>Notificações</h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {notifications.length === 0 ? 'Nenhum aviso' : `${notifications.length} aviso(s)`}
              </span>
            </div>
            {notifications.length > 0 && (
              <button 
                type="button" 
                className="btn-link"
                onClick={() => notificationService.clearAll()}
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}
              >
                Limpar
              </button>
            )}
          </div>

          {!hasPermission && 'Notification' in window && (
            <div className="notification-push-prompt">
              <span style={{ fontSize: '0.8rem' }}>Ative alertas no celular para saber quando suas despesas forem aprovadas.</span>
              <button 
                type="button" 
                className="btn btn-sm btn-primary"
                onClick={handleRequestPush}
                style={{ marginTop: '6px', width: '100%', fontSize: '0.75rem', padding: '4px' }}
              >
                Ativar Notificações do Navegador
              </button>
            </div>
          )}

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <span>Nenhuma notificação recente.</span>
              </div>
            ) : (
              notifications.map((item) => {
                const icon = item.type === 'success' ? '✅' : item.type === 'warning' ? '⚠️' : 'ℹ️';
                const timeStr = new Date(item.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
                return (
                  <div key={item.id} className={`notification-item ${item.read ? 'read' : 'unread'}`}>
                    <span className="notification-item-icon">{icon}</span>
                    <div className="notification-item-content">
                      <div className="notification-item-title">{item.title}</div>
                      <div className="notification-item-desc">{item.message}</div>
                      <div className="notification-item-time">{timeStr}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
