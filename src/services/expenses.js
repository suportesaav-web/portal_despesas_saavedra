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
    const fileName = `${userId}_${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('comprovantes')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Retorna a URL pública
    const { data } = supabase.storage.from('comprovantes').getPublicUrl(filePath);
    return data.publicUrl;
  },

  // Insert a new expense
  async addExpense(expense, userId, file) {
    let fotoUrl = null;
    if (file) {
      fotoUrl = await this.uploadFile(file, userId);
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        colaborador_id: userId,
        descricao: expense.descricao,
        amount: parseFloat(expense.amount),
        date: expense.date,
        categoria: expense.categoria,
        cliente: expense.cliente || null,
        status: 'ABERTO',
        foto_url: fotoUrl
      }])
      .select();

    if (error) throw error;
    return data[0];
  },

  // Update status (Aprovação)
  async updateStatus(expenseId, novoStatus, motivo = null) {
    const { data, error } = await supabase
      .from('expenses')
      .update({ status: novoStatus, motivo_reprovacao: motivo })
      .eq('id', expenseId)
      .select();
      
    if (error) throw error;
    return data[0];
  }
};
