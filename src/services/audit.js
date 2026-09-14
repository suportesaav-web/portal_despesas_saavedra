import { supabase } from '../lib/supabase';

/**
 * Serviço simples e não-bloqueante para registro de auditoria operacional.
 * Se a tabela audit_logs ainda não existir no banco, a falha é silenciosa
 * e não interrompe a experiência do usuário.
 */
export const auditService = {
  async log(action, entity, entityId, details = null, userId = null) {
    try {
      let finalUserId = userId;
      if (!finalUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        finalUserId = session?.user?.id || null;
      }

      const logPayload = {
        user_id: finalUserId,
        action,
        entity,
        entity_id: entityId ? String(entityId) : null,
        details: details || null
      };

      await supabase.from('audit_logs').insert([logPayload]);
    } catch (err) {
      // Falha silenciosa para não travar a aplicação caso a tabela audit_logs ainda não tenha sido criada
      console.warn(`[AUDIT_LOG_SKIP] Não foi possível registrar evento "${action}":`, err.message);
    }
  }
};
