// Utilitários de data e cálculo de prazos fiscais / contábeis

/**
 * Retorna o último dia útil do mês informado (ou mês atual se não informado).
 * Considera dias úteis de Segunda a Sexta-feira.
 */
export function getUltimoDiaUtilDoMes(ano, mes) {
  const agora = new Date();
  const targetYear = ano !== undefined ? ano : agora.getFullYear();
  const targetMonth = mes !== undefined ? mes : agora.getMonth(); // 0-indexed

  // Último dia do mês: dia 0 do mês seguinte
  const ultimoDia = new Date(targetYear, targetMonth + 1, 0);

  // Se for sábado (6), recua 1 dia para sexta (5)
  // Se for domingo (0), recua 2 dias para sexta (5)
  const diaSemana = ultimoDia.getDay();
  if (diaSemana === 6) {
    ultimoDia.setDate(ultimoDia.getDate() - 1);
  } else if (diaSemana === 0) {
    ultimoDia.setDate(ultimoDia.getDate() - 2);
  }

  return ultimoDia;
}

/**
 * Retorna informações sobre o prazo de lançamento do mês atual:
 * - dataLimite: Date
 * - diasRestantes: número de dias corridos até o prazo
 * - expirado: boolean
 * - formatado: string no padrão pt-BR
 */
export function getInfoPrazoMesAtual() {
  const agora = new Date();
  const dataLimite = getUltimoDiaUtilDoMes(agora.getFullYear(), agora.getMonth());
  
  // Zera horário para comparação de datas
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diffTime = dataLimite.getTime() - hoje.getTime();
  const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    dataLimite,
    diasRestantes,
    expirado: diasRestantes < 0,
    ehHoje: diasRestantes === 0,
    ehUrgente: diasRestantes >= 0 && diasRestantes <= 3,
    formatado: dataLimite.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  };
}

/**
 * Formata data e hora para exibição
 */
export function formatarDataHora(dataStr, horaStr) {
  if (!dataStr) return '--/--/----';
  const d = new Date(dataStr + 'T00:00:00');
  const dataFormatada = d.toLocaleDateString('pt-BR');
  if (horaStr) {
    return `${dataFormatada} às ${horaStr}`;
  }
  return dataFormatada;
}
