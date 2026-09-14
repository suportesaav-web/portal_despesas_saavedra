import { supabase } from '../lib/supabase';
import { auditService } from './audit';

export const adminService = {
  // Buscar todos os usuários
  async getUsers() {
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Adicionar o perfil de um usuário (após criar no Auth do Supabase)
  async addUserProfile(uid, email, nome, funcao) {
    const { data, error } = await supabase
      .from('colaboradores')
      .insert([{
        id: uid,
        email,
        nome,
        funcao
      }])
      .select();

    if (error) throw error;

    auditService.log('ADD_USER_PROFILE', 'colaboradores', uid, { email, nome, funcao });
    return data[0];
  },

  // Atualizar a função ou nome de um colaborador
  async updateUser(uid, updates) {
    const { data, error } = await supabase
      .from('colaboradores')
      .update(updates)
      .eq('id', uid)
      .select();
      
    if (error) throw error;

    auditService.log('UPDATE_USER_ROLE', 'colaboradores', uid, updates);
    return data[0];
  },

  // Remover perfil (cuidado, não apaga a conta Auth, apenas o perfil)
  async deleteUser(uid) {
    const { error } = await supabase
      .from('colaboradores')
      .delete()
      .eq('id', uid);
      
    if (error) throw error;
  }
};
