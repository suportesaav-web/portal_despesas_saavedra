import { policiesService } from '../services/policiesService';
import { getCategoriaByCodigo } from './categories';

/**
 * Valida os dados de uma despesa contra as políticas dinâmicas da empresa
 * @param {object} expense { amount, date, hora, categoria_codigo, descricao, cliente }
 * @param {Array} existingExpenses Lista de despesas já cadastradas pelo usuário
 * @param {object} [customPolicies] Políticas customizadas (opcional)
 * @returns {object} { isCompliant, alerts, requiresJustification }
 */
export function validateExpenseCompliance(expense, existingExpenses = [], customPolicies = null) {
  const policies = customPolicies || policiesService.getPolicies();
  const alerts = [];
  let requiresJustification = false;

  const amountNum = parseFloat(expense.amount || 0);
  const catCodigo = expense.categoria_codigo;

  // 1. Teto Específico por Centro de Custo / Categoria Contábil
  if (catCodigo && amountNum > 0) {
    const config = policies.categoryLimits[catCodigo];
    if (config && config.teto > 0 && amountNum > config.teto) {
      const catInfo = getCategoriaByCodigo(catCodigo);
      const catNome = catInfo ? catInfo.itemNome : catCodigo;
      const tetoFmt = config.teto.toFixed(2).replace('.', ',');
      const valorFmt = amountNum.toFixed(2).replace('.', ',');

      if (config.justificativaObrigatoria) {
        requiresJustification = true;
      }

      alerts.push({
        id: `LIMIT_EXCEEDED_${catCodigo}`,
        type: 'warning',
        title: `Teto de ${catNome} Excedido`,
        message: `O valor informado (R$ ${valorFmt}) ultrapassa o teto corporativo de R$ ${tetoFmt} estabelecido para este centro. ${config.justificativaObrigatoria ? 'Descreva detalhadamente a justificativa no campo Descrição.' : ''}`
      });
    }
  }

  // 2. Prevenção de Despesa Duplicada (se ativado nas políticas)
  if (policies.duplicateCheckEnabled && amountNum > 0 && expense.date) {
    const isDuplicate = existingExpenses.some(d => {
      if (expense.id && d.id === expense.id) return false;
      const sameAmount = Math.abs(parseFloat(d.amount || 0) - amountNum) < 0.01;
      const sameDate = d.date === expense.date;
      const sameCat = d.categoria_codigo === expense.categoria_codigo;
      return sameAmount && sameDate && sameCat;
    });

    if (isDuplicate) {
      alerts.push({
        id: 'POSSIBLE_DUPLICATE',
        type: 'caution',
        title: 'Possível Despesa Duplicada',
        message: `Já existe outro lançamento registrado em ${new Date(expense.date + 'T00:00:00').toLocaleDateString('pt-BR')} no valor de R$ ${amountNum.toFixed(2).replace('.', ',')} nesta mesma categoria. Verifique se não se trata de duplicidade.`
      });
    }
  }

  // 3. Verificação de Lançamento Retroativo (Prazo em dias)
  if (expense.date && policies.maxRetroactiveDays > 0) {
    const expenseDate = new Date(expense.date + 'T00:00:00');
    const today = new Date();
    const diffTime = today.getTime() - expenseDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > policies.maxRetroactiveDays) {
      requiresJustification = true;
      alerts.push({
        id: 'RETROACTIVE_EXPENSE',
        type: 'warning',
        title: 'Lançamento Retroativo Excedido',
        message: `Esta despesa ocorreu há mais de ${policies.maxRetroactiveDays} dias. Por ultrapassar o prazo padrão, necessitará de aprovação especial da gestão.`
      });
    }

    // 4. Aviso de Fim de Semana (se ativado nas políticas)
    if (policies.weekendAlertEnabled) {
      const dayOfWeek = expenseDate.getDay(); // 0 = Domingo, 6 = Sábado
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        alerts.push({
          id: 'WEEKEND_EXPENSE',
          type: 'info',
          title: 'Despesa em Fim de Semana',
          message: 'Lançamento efetuado em sábado ou domingo. Lembre-se de vincular a rota de visitação do CRM.'
        });
      }
    }
  }

  return {
    isCompliant: alerts.filter(a => a.type === 'warning').length === 0,
    requiresJustification,
    alerts
  };
}
