import { supabase } from '../lib/supabase';

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

  // Envia foto para o Storage do Supabase (Bucket 'comprovantes')
  async uploadFile(file, userId) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('comprovantes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Retorna a URL pública
    const { data } = supabase.storage.from('comprovantes').getPublicUrl(filePath);
    return data.publicUrl;
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
        return fallbackData[0];
      }
      throw err;
    }
  },

  // Update status (Validação no CRM / Liquidação Financeira / Reprovação)
  async updateStatus(expenseId, novoStatus, motivo = null, userId = null) {
    const updateData = { 
      status: novoStatus, 
      motivo_reprovacao: motivo 
    };

    if (novoStatus === 'VALIDADO' && userId) {
      updateData.validado_por = userId;
      updateData.data_validacao = new Date().toISOString();
    } else if (novoStatus === 'APROVADO' && userId) {
      updateData.liquidado_por = userId;
      updateData.data_liquidacao = new Date().toISOString();
    }

    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(updateData)
        .eq('id', expenseId)
        .select();
        
      if (!error && data && data.length > 0) {
        return data[0];
      }
      if (error) throw error;
    } catch (_err) {
      // Fallback se colunas de auditoria ainda não existirem
      const baseUpdate = { status: novoStatus, motivo_reprovacao: motivo };
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('expenses')
        .update(baseUpdate)
        .eq('id', expenseId)
        .select();

      if (fallbackError) throw fallbackError;
      return fallbackData[0];
    }
  }
};
