const NOTIFICATIONS_STORAGE_KEY = 'saav_inapp_notifications_v1';

export const notificationService = {
  // 1. Web Push / Notificações do Navegador
  async requestNotificationPermission() {
    if (!('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  hasNotificationPermission() {
    return 'Notification' in window && Notification.permission === 'granted';
  },

  sendBrowserNotification(title, options = {}) {
    if (this.hasNotificationPermission()) {
      try {
        new Notification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          ...options
        });
      } catch (e) {
        console.warn('Erro ao emitir Web Notification:', e);
      }
    }
  },

  // 2. Central de Notificações In-App (Persistência Local)
  getInAppNotifications() {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (_err) {
      return [];
    }
  },

  addInAppNotification(notification) {
    const list = this.getInAppNotifications();
    const newEntry = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info', // 'success', 'warning', 'info'
      createdAt: new Date().toISOString(),
      read: false,
      url: notification.url || '/despesas'
    };

    const updated = [newEntry, ...list.slice(0, 49)]; // Guarda até 50 notificações
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));

    // Notificação de desktop simultânea
    this.sendBrowserNotification(newEntry.title, { body: newEntry.message });

    window.dispatchEvent(new CustomEvent('saav-notifications-changed'));
    return newEntry;
  },

  markAllAsRead() {
    const list = this.getInAppNotifications().map(n => ({ ...n, read: true }));
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('saav-notifications-changed'));
  },

  clearAll() {
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('saav-notifications-changed'));
  },

  // 3. Disparador Direto para WhatsApp Corporativo
  sendWhatsAppNotice({ phone = '', collaboratorName = '', expense, action = 'VALIDADO', reason = '', actorName = '' }) {
    const statusMap = {
      'VALIDADO': '✅ *VALIDADA pela Gestão CRM*',
      'APROVADO': '🎉 *APROVADA para Reembolso pelo Financeiro*',
      'REPROVADO': '⚠️ *REPROVADA / NECESSITA AJUSTE*'
    };

    const statusText = statusMap[action] || action;
    const valorFmt = Number(expense?.amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataFmt = expense?.date ? new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR') : '';

    let text = `🏢 *SAAVEDRA REPRESENTAÇÕES*\n` +
      `*Portal de Gestão de Despesas*\n\n` +
      `Olá, *${collaboratorName || 'Colaborador'}*!\n` +
      `Sua despesa referente a *${expense?.cliente || 'Visita / Destino'}* foi ${statusText}.\n\n` +
      `📋 *Resumo da Despesa:*\n` +
      `• *Valor:* ${valorFmt}\n` +
      `• *Data:* ${dataFmt}\n` +
      `• *Categoria:* ${expense?.categoria || 'Geral'}\n` +
      `• *Responsável:* ${actorName || 'Gestão / Financeiro'}\n`;

    if (reason) {
      text += `\n⚠️ *Motivo / Justificativa:* ${reason}\n`;
    }

    text += `\n🔗 *Acesse o portal para detalhes:* ${window.location.origin}`;

    const cleanPhone = phone.replace(/\D/g, '');
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  }
};
