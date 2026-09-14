import { supabase } from '../lib/supabase';
import { auditService } from './audit';

export const expensesService = {
  // Fetch expenses based on user role
  async getExpenses(userProfile) {
    let query = supabase
      .from('expenses')
      .select(`
        *,
        colaboradores (nome, email)
      `)
      .order('date', { ascending: false });

    // Perfis com visão global: Gestores, Financeiro e Admin. Vendedores veem apenas as suas.
    const perfisGlobais = ['Gestor', 'Supervisor', 'Kyanne', 'Financeiro', 'Admin'];
    if (!perfisGlobais.includes(userProfile?.funcao)) {
      query = query.eq('colaborador_id', userProfile.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Envia foto para o Storage do Supabase (Bucket 'comprovantes') com validação e URL assinada
  async uploadFile(file, userId) {
    if (!file) return null;

    // 1. Validação de Tamanho Máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('Tamanho de arquivo excedido: o comprovante deve ter no máximo 10MB.');
    }

    // 2. Validação de Extensão Permitida
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      throw new Error(`Extensão não permitida (".${fileExt}"). Formatos aceitos: JPG, PNG, WebP e PDF.`);
    }

    // 3. Validação de MIME Type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      throw new Error(`MIME type inválido ("${file.type}"). Envie uma imagem ou PDF válido.`);
    }

    const fileName = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('comprovantes')
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // 4. Mecanismo Seguro de Visualização: Gera URL Assinada (Signed URL)
    // Validade de 7 dias para visualização segura sem expor dados desnecessariamente
    let fileAccessUrl = null;
    try {
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('comprovantes')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 dias

      if (!signedErr && signedData?.signedUrl) {
        fileAccessUrl = signedData.signedUrl;
      }
    } catch (_signedErr) {
      // Fallback para getPublicUrl se signedUrl falhar
    }

    if (!fileAccessUrl) {
      const { data } = supabase.storage.from('comprovantes').getPublicUrl(filePath);
      fileAccessUrl = data.publicUrl;
    }
    
    // Log de auditoria (não-bloqueante)
    auditService.log('UPLOAD_ATTACHMENT', 'storage/comprovantes', filePath, { 
      fileName: file.name, 
      fileSize: file.size, 
      mimeType: file.type,
      signed: fileAccessUrl.includes('/sign/')
    }, userId);

    return fileAccessUrl;
  },

  // Excluir anexo do Storage
  async deleteAttachment(filePath) {
    if (!filePath) return;
    try {
      // Extrai o nome do arquivo caso receba uma URL completa
      const cleanPath = filePath.split('/').pop().split('?')[0];
      await supabase.storage.from('comprovantes').remove([cleanPath]);
    } catch (err) {
      console.warn('Falha ao remover arquivo do storage:', err.message);
    }
  },

  // Insert a new expense (com suporte resiliente a novos campos e fallback)
  async addExpense(expense, userId, file) {
    let fotoUrl = null;
    if (file) {
      fotoUrl = await this.uploadFile(file, userId);
    }

    // Payload completo com novos campos
    const fullPayload = {
      colaborador_id: userId,
      descricao: expense.descricao,
      amount: parseFloat(expense.amount),
      date: expense.date,
      hora: expense.hora || null,
      categoria: expense.categoria,
      categoria_codigo: expense.categoria_codigo || null,
      categoria_grupo: expense.categoria_grupo || null,
      cliente: expense.cliente || null,
      status: 'ABERTO',
      foto_url: fotoUrl
    };

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert([fullPayload])
        .select();

      if (!error && data && data.length > 0) {
        auditService.log('CREATE_EXPENSE', 'expenses', data[0].id, {
          cliente: data[0].cliente,
          amount: data[0].amount,
          categoria: data[0].categoria,
          temComprovante: !!fotoUrl
        }, userId);
        return data[0];
      }
      if (error) throw error;
    } catch (err) {
      // Se falhar porque as colunas hora/categoria_codigo ainda não foram criadas no banco, faz fallback
      if (err.message && (err.message.includes('column') || err.message.includes('schema'))) {
        console.warn('Tentando fallback para colunas existentes...', err.message);
        const fallbackDescricao = expense.hora 
          ? `[Hora: ${expense.hora}] ${expense.descricao}`
          : expense.descricao;

        const basePayload = {
          colaborador_id: userId,
          descricao: fallbackDescricao,
          amount: parseFloat(expense.amount),
          date: expense.date,
          categoria: expense.categoria,
          cliente: expense.cliente || null,
          status: 'ABERTO',
          foto_url: fotoUrl
        };

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('expenses')
          .insert([basePayload])
          .select();

        if (fallbackError) throw fallbackError;
        
        auditService.log('CREATE_EXPENSE', 'expenses', fallbackData[0].id, {
          cliente: fallbackData[0].cliente,
          amount: fallbackData[0].amount,
          categoria: fallbackData[0].categoria,
          temComprovante: !!fotoUrl,
          modo: 'fallback'
        }, userId);

        return fallbackData[0];
      }
      throw err;
    }
  },

  // Update status (Validação no CRM / Liquidação Financeira / Reprovação)
  async updateStatus(expenseId, novoStatus, motivo = null, userId = null) {
    // 1. Busca o status atual para validar a máquina de estados
    const { data: currentExpense, error: fetchError } = await supabase
      .from('expenses')
      .select('status')
      .eq('id', expenseId)
      .single();

    if (fetchError || !currentExpense) {
      throw new Error('Despesa não encontrada para atualização de status.');
    }

    const statusAtual = currentExpense.status;

    // Regra Imutabilidade: Despesas já liquidadas/aprovadas não podem retroagir
    if (statusAtual === 'APROVADO') {
      throw new Error('Transição inválida: Despesas já aprovadas e liquidadas são imutáveis e não podem ser reabertas.');
    }

    // Matriz de transições oficiais da Seção 12 da especificação
    const transicoesValidas = {
      'ABERTO': ['VALIDADO', 'REPROVADO'],
      'VALIDADO': ['APROVADO', 'REPROVADO'],
      'REPROVADO': ['ABERTO'],
      'APROVADO': []
    };

    if (!transicoesValidas[statusAtual]?.includes(novoStatus)) {
      throw new Error(`Transição de status inválida: não é permitido transicionar de "${statusAtual}" para "${novoStatus}".`);
    }

    // Justificativa obrigatória na reprovação
    if (novoStatus === 'REPROVADO' && (!motivo || !motivo.trim())) {
      throw new Error('Justificativa obrigatória: para reprovar uma despesa é necessário informar o motivo da não conformidade.');
    }

    const updateData = { 
      status: novoStatus, 
      motivo_reprovacao: novoStatus === 'REPROVADO' ? motivo.trim() : null
    };

    if (novoStatus === 'VALIDADO' && userId) {
      updateData.validado_por = userId;
      updateData.data_validacao = new Date().toISOString();
    } else if (novoStatus === 'APROVADO' && userId) {
      updateData.liquidado_por = userId;
      updateData.data_liquidacao = new Date().toISOString();
    }

    const actionMap = {
      'VALIDADO': 'VALIDATE_EXPENSE',
      'APROVADO': 'APPROVE_EXPENSE',
      'REPROVADO': 'REJECT_EXPENSE',
      'ABERTO': 'UPDATE_EXPENSE'
    };
    const auditAction = actionMap[novoStatus] || 'UPDATE_STATUS';

    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId)
        .select();
        
      if (!error && data && data.length > 0) {
        auditService.log(auditAction, 'expenses', expenseId, {
          oldStatus: statusAtual,
          newStatus: novoStatus,
          motivo: motivo || null
        }, userId);
        return data[0];
      }
      if (error) throw error;
    } catch (_err) {
      // Fallback se colunas de auditoria ainda não existirem
      const baseUpdate = { 
        status: novoStatus, 
        motivo_reprovacao: novoStatus === 'REPROVADO' ? motivo.trim() : null 
      };
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('expenses')
        .update(baseUpdate)
        .eq('id', expenseId)
        .select();

      if (fallbackError) throw fallbackError;

      auditService.log(auditAction, 'expenses', expenseId, {
        oldStatus: statusAtual,
        newStatus: novoStatus,
        motivo: motivo || null,
        modo: 'fallback'
      }, userId);

      return fallbackData[0];
    }
  },

  // Atualizar / Corrigir e Reenviar despesa (Colaborador após reprovação)
  async updateExpense(expenseId, expenseData, userId, newFile = null) {
    let fotoUrl = expenseData.foto_url;
    if (newFile) {
      fotoUrl = await this.uploadFile(newFile, userId);
    }

    const payload = {
      descricao: expenseData.descricao,
      amount: parseFloat(expenseData.amount),
      date: expenseData.date,
      hora: expenseData.hora || null,
      categoria: expenseData.categoria,
      categoria_codigo: expenseData.categoria_codigo || null,
      categoria_grupo: expenseData.categoria_grupo || null,
      cliente: expenseData.cliente || null,
      status: 'ABERTO',
      motivo_reprovacao: null,
      ...(fotoUrl ? { foto_url: fotoUrl } : {})
    };

    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(payload)
        .eq('id', expenseId)
        .select();

      if (!error && data && data.length > 0) {
        auditService.log('UPDATE_EXPENSE', 'expenses', expenseId, {
          action: 'CORRECAO_E_REENVIO',
          novoStatus: 'ABERTO',
          amount: data[0].amount
        }, userId);
        return data[0];
      }
      if (error) throw error;
    } catch (err) {
      // Fallback sem as novas colunas caso ainda não existam no banco
      const fallbackDescricao = expenseData.hora 
        ? `[Hora: ${expenseData.hora}] ${expenseData.descricao}`
        : expenseData.descricao;

      const fallbackPayload = {
        descricao: fallbackDescricao,
        amount: parseFloat(expenseData.amount),
        date: expenseData.date,
        categoria: expenseData.categoria,
        cliente: expenseData.cliente || null,
        status: 'ABERTO',
        motivo_reprovacao: null,
        ...(fotoUrl ? { foto_url: fotoUrl } : {})
      };

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('expenses')
        .update(fallbackPayload)
        .eq('id', expenseId)
        .select();

      if (fallbackError) throw fallbackError;

      auditService.log('UPDATE_EXPENSE', 'expenses', expenseId, {
        action: 'CORRECAO_E_REENVIO',
        novoStatus: 'ABERTO',
        amount: fallbackData[0].amount,
        modo: 'fallback'
      }, userId);

      return fallbackData[0];
    }
  },

  // Consulta o histórico de status da despesa (tabela expense_status_history)
  async getStatusHistory(expenseId) {
    try {
      const { data, error } = await supabase
        .from('expense_status_history')
        .select(`
          id, 
          old_status, 
          new_status, 
          reason, 
          created_at,
          colaboradores:changed_by (nome, email)
        `)
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Tabela expense_status_history ainda não criada ou inacessível:', error.message);
        return [];
      }
      return data || [];
    } catch (_err) {
      return [];
    }
  }
};
