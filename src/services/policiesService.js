import { CATEGORIAS_DESPESAS } from '../data/categories';
import { auditService } from './audit';

const POLICIES_STORAGE_KEY = 'saav_corporate_policies_v2';

// Tetos padrão iniciais por código de centro/categoria
const DEFAULT_CATEGORY_LIMITS = {
  // 2.3 Despesas Operacionais
  '2.3.1': { teto: 50.0, justificativaObrigatoria: true }, // Estacionamento
  '2.3.2': { teto: 90.0, justificativaObrigatoria: true }, // Pedágio
  '2.3.3': { teto: 120.0, justificativaObrigatoria: true }, // Frango Treinamento
  '2.3.4': { teto: 150.0, justificativaObrigatoria: true }, // Carne Bovina
  '2.3.5': { teto: 200.0, justificativaObrigatoria: true }, // Aluguel Mobi
  '2.3.6': { teto: 300.0, justificativaObrigatoria: true }, // Aluguel T-Cross

  // 2.4 Marketing
  '2.4.1': { teto: 300.0, justificativaObrigatoria: true }, // Amostras
  '2.4.2': { teto: 200.0, justificativaObrigatoria: true }, // Brindes
  '2.4.3': { teto: 45.0, justificativaObrigatoria: true },  // Coffee
  '2.4.4': { teto: 250.0, justificativaObrigatoria: true }, // Produtos Promocionais
  '2.4.5': { teto: 30.0, justificativaObrigatoria: true },  // Balas
  '2.4.7': { teto: 25.0, justificativaObrigatoria: true },  // Pipoca
  '2.4.8': { teto: 25.0, justificativaObrigatoria: true },  // Paçoca
  '2.4.9': { teto: 25.0, justificativaObrigatoria: true },  // Pirulito
  '2.4.10': { teto: 25.0, justificativaObrigatoria: true }, // Mariola
  '2.4.11': { teto: 40.0, justificativaObrigatoria: true }, // Mouse Pad
  '2.4.12': { teto: 35.0, justificativaObrigatoria: true }, // Bombom

  // 2.5 Outras Despesas
  '2.5.1': { teto: 60.0, justificativaObrigatoria: true },  // Material Escritório
  '2.5.2': { teto: 100.0, justificativaObrigatoria: true }, // Outros

  // 2.6 Despesas Operacionais Gerais
  '2.6.1': { teto: 280.0, justificativaObrigatoria: true }, // Combustível / Transporte
  '2.6.2': { teto: 250.0, justificativaObrigatoria: true }, // Hospedagem
  '2.6.3': { teto: 70.0, justificativaObrigatoria: true },  // Alimentação em Viagem
  '2.6.4': { teto: 350.0, justificativaObrigatoria: true }, // Manutenção Veículo
  '2.6.5': { teto: 150.0, justificativaObrigatoria: true }, // Demais Operacionais

  // 2.7 Outra Despesa
  '2.7.1': { teto: 200.0, justificativaObrigatoria: true }, // Serviços Terceiros
  '2.7.2': { teto: 80.0, justificativaObrigatoria: true },  // Cartorárias
  '2.7.3': { teto: 100.0, justificativaObrigatoria: true }  // Diversos
};

const DEFAULT_GLOBAL_POLICIES = {
  maxRetroactiveDays: 30,
  duplicateCheckEnabled: true,
  weekendAlertEnabled: true,
  closingDay: 25,
  categoryLimits: DEFAULT_CATEGORY_LIMITS
};

export const policiesService = {
  // Carrega as políticas ativas do sistema
  getPolicies() {
    try {
      const stored = localStorage.getItem(POLICIES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_GLOBAL_POLICIES,
          ...parsed,
          categoryLimits: {
            ...DEFAULT_CATEGORY_LIMITS,
            ...(parsed.categoryLimits || {})
          }
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar políticas do armazenamento local:', e);
    }
    return DEFAULT_GLOBAL_POLICIES;
  },

  // Salva novas diretrizes configuradas pelo Admin/Financeiro
  async savePolicies(newPolicies, userId) {
    try {
      const payload = {
        ...newPolicies,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };

      localStorage.setItem(POLICIES_STORAGE_KEY, JSON.stringify(payload));

      // Emite evento global para que todas as telas atualizem suas regras em tempo real
      window.dispatchEvent(new CustomEvent('saav-policies-updated', { detail: payload }));

      // Registro de auditoria
      if (userId) {
        auditService.log('UPDATE_POLICIES', 'system_policies', 'global', {
          maxRetroactiveDays: payload.maxRetroactiveDays,
          limitsCount: Object.keys(payload.categoryLimits || {}).length
        }, userId);
      }

      return payload;
    } catch (err) {
      console.error('Erro ao salvar políticas:', err);
      throw new Error('Não foi possível salvar as diretrizes corporativas.');
    }
  },

  // Restaura os limites originais padrão da Saavedra
  async resetToDefaults(userId) {
    return this.savePolicies(DEFAULT_GLOBAL_POLICIES, userId);
  },

  // Retorna o teto configurado para uma categoria específica
  getCategoryLimit(codigo) {
    const policies = this.getPolicies();
    return policies.categoryLimits[codigo] || { teto: 0, justificativaObrigatoria: false };
  }
};
