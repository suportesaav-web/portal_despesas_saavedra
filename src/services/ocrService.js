/**
 * Serviço de OCR e Extração Inteligente de Cupons Fiscais e Recibos
 * Carregado sob demanda via Dynamic Import para não inflar o bundle inicial
 */

let cachedWorker = null;
let workerIdleTimeout = null;

async function getWorker(onProgress) {
  if (cachedWorker) {
    if (workerIdleTimeout) {
      clearTimeout(workerIdleTimeout);
      workerIdleTimeout = null;
    }
    return cachedWorker;
  }

  if (onProgress) onProgress({ status: 'Carregando biblioteca e motor neural...', progress: 15 });

  // Dynamic import para code-splitting automático
  const { createWorker } = await import('tesseract.js');
  cachedWorker = await createWorker('por');
  return cachedWorker;
}

function scheduleWorkerCleanup() {
  if (workerIdleTimeout) clearTimeout(workerIdleTimeout);
  workerIdleTimeout = setTimeout(async () => {
    if (cachedWorker) {
      try {
        await cachedWorker.terminate();
      } catch (_) {}
      cachedWorker = null;
    }
    workerIdleTimeout = null;
  }, 2 * 60 * 1000); // 2 minutos de ociosidade
}

export const ocrService = {
  /**
   * Processa a imagem usando Tesseract.js no navegador
   * @param {File|Blob|string} imageSource 
   * @param {Function} onProgress callback para progresso (0-100)
   * @returns {Promise<{ rawText: string, extracted: object }>}
   */
  async processReceiptImage(imageSource, onProgress) {
    try {
      const worker = await getWorker(onProgress);

      if (onProgress) onProgress({ status: 'Analisando caracteres e comprovante...', progress: 45 });

      const ret = await worker.recognize(imageSource);
      const rawText = ret.data.text;

      if (onProgress) onProgress({ status: 'Interpretando dados contábeis...', progress: 90 });

      const extracted = this.parseBrazilianReceipt(rawText);

      if (onProgress) onProgress({ status: 'Concluído!', progress: 100 });

      scheduleWorkerCleanup();
      return { rawText, extracted };
    } catch (err) {
      console.error('Erro no processamento OCR:', err);
      if (cachedWorker) {
        try { await cachedWorker.terminate(); } catch (_) {}
        cachedWorker = null;
      }
      throw new Error('Não foi possível ler o comprovante automaticamente. Você pode preencher os campos manualmente.');
    }
  },

  /**
   * Extrai heuristicamente Valores, Datas, Horas, CNPJ e Categoria sugerida
   * a partir do texto do cupom fiscal / recibo brasileiro
   */
  parseBrazilianReceipt(rawText) {
    if (!rawText) return {};

    const text = rawText.toUpperCase();
    const result = {
      amount: null,
      date: null,
      hora: null,
      cliente: null,
      categoria_codigo: null,
      confidenceNotes: []
    };

    // 1. Extração de Data (DD/MM/AAAA ou DD/MM/AA)
    const dateRegex = /\b(0[1-9]|[12][0-9]|3[01])[\/\.\-](0[1-9]|1[0-2])[\/\.\-](202[0-9]|2[0-9])\b/g;
    const dateMatches = [...text.matchAll(dateRegex)];
    if (dateMatches.length > 0) {
      // Pega a primeira data válida encontrada
      const [_, day, month, yearRaw] = dateMatches[0];
      const fullYear = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      result.date = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      result.confidenceNotes.push(`Data detectada: ${day}/${month}/${fullYear}`);
    }

    // 2. Extração de Horário (HH:MM ou HH:MM:SS)
    const timeRegex = /\b([01]?[0-9]|2[0-3]):([0-5][0-9])(?::([0-5][0-9]))?\b/;
    const timeMatch = text.match(timeRegex);
    if (timeMatch) {
      result.hora = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
      result.confidenceNotes.push(`Horário detectado: ${result.hora}`);
    }

    // 3. Extração de Valor Total (R$)
    // Procura por linhas explícitas de totalização
    const totalLinesPatterns = [
      /(?:TOTAL|VALOR\s*TOTAL|VALOR\s*A\s*PAGAR|TOTAL\s*A\s*PAGAR|TOTAL\s*R\$|VALOR\s*R\$|SUBTOTAL|TOTAL\s*LIQUIDO)[^\d\n\r]*(\d{1,4}[.,]\d{2})/i,
      /(?:CARTAO|DEBITO|CREDITO|DINHEIRO|PIX)[^\d\n\r]*(\d{1,4}[.,]\d{2})/i
    ];

    let foundAmount = null;
    for (const pattern of totalLinesPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        foundAmount = match[1].replace(',', '.');
        break;
      }
    }

    // Fallback de valor: procura por todos os valores monetários no formato X,XX ou X.XX
    if (!foundAmount) {
      const genericAmounts = [...text.matchAll(/\b(\d{1,4}[.,]\d{2})\b/g)]
        .map(m => parseFloat(m[1].replace(',', '.')))
        .filter(val => val > 0 && val < 50000); // Filtra números absurdos

      if (genericAmounts.length > 0) {
        // Assume o maior valor como o total provável da nota fiscal
        foundAmount = Math.max(...genericAmounts).toFixed(2);
      }
    }

    if (foundAmount) {
      result.amount = parseFloat(foundAmount).toFixed(2);
      result.confidenceNotes.push(`Valor detectado: R$ ${result.amount.replace('.', ',')}`);
    }

    // 4. Extração de Estabelecimento / CNPJ
    const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/;
    const cnpjMatch = text.match(cnpjRegex);
    
    // Pega as primeiras linhas do texto para tentar identificar o nome da empresa
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 3 && !/^(cupom|extrato|documento|sat|danfe|nfc-e)/i.test(l));
    if (lines.length > 0) {
      // Primeira linha relevante costuma ser a Razão Social ou Nome Fantasia
      const firstLine = lines[0].replace(/[^a-zA-Z0-9\sÀ-ú\.\-]/g, '').trim();
      if (firstLine.length > 2 && firstLine.length < 50) {
        result.cliente = firstLine;
      }
    }
    if (cnpjMatch) {
      result.confidenceNotes.push(`CNPJ: ${cnpjMatch[0]}`);
      if (!result.cliente) {
        result.cliente = `Estabelecimento (CNPJ: ${cnpjMatch[0]})`;
      }
    }

    // 5. Sugestão Inteligente de Categoria Contábil
    if (/(POSTO|COMBUSTIVEL|GASOLINA|ETANOL|DIESEL|AUTO\s*POSTO|IPIRANGA|SHELL|PETROBRAS|VIBRA|LUBRIFICANTE)/i.test(text)) {
      result.categoria_codigo = '2.1.1'; // Combustível / Abastecimento
      result.confidenceNotes.push('Categoria sugerida: Combustível / Abastecimento');
    } else if (/(RESTAURANTE|CHURRASCARIA|LANCHONETE|CAFE|PIZZARIA|REFEICAO|ALMOCO|BUFFET|GRILL|BURGER|MCDONALD|SUBWAY)/i.test(text)) {
      result.categoria_codigo = '2.2.1'; // Alimentação / Refeições em Viagem
      result.confidenceNotes.push('Categoria sugerida: Alimentação / Refeições');
    } else if (/(HOTEL|POUSADA|ESTADIA|IBIS|FLAT|HOSPEDAGEM)/i.test(text)) {
      result.categoria_codigo = '2.2.2'; // Hospedagem
      result.confidenceNotes.push('Categoria sugerida: Hospedagem');
    } else if (/(PEDAGIO|AUTOPISTA|CONCESSIONARIA|CCR|ECOVIAS|ARTERIS|VIA)/i.test(text)) {
      result.categoria_codigo = '2.1.2'; // Pedágios
      result.confidenceNotes.push('Categoria sugerida: Pedágios');
    } else if (/(ESTACIONAMENTO|ESTAC|PARK|ROTATIVO|VALET)/i.test(text)) {
      result.categoria_codigo = '2.1.3'; // Estacionamento
      result.confidenceNotes.push('Categoria sugerida: Estacionamento');
    } else if (/(UBER|99APP|TAXI|CORRIDA)/i.test(text)) {
      result.categoria_codigo = '2.1.4'; // Táxi / Aplicativos
      result.confidenceNotes.push('Categoria sugerida: Táxi / Aplicativo');
    }

    return result;
  }
};
