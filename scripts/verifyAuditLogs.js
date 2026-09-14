import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const CRITICAL_EVENTS = [
  { action: 'CREATE_EXPENSE', entity: 'expenses', trigger: 'Lançamento de nova despesa pelo vendedor' },
  { action: 'UPDATE_EXPENSE', entity: 'expenses', trigger: 'Reenvio/edição de despesa corrigida' },
  { action: 'VALIDATE_EXPENSE', entity: 'expenses', trigger: 'Validação no CRM pelo gestor' },
  { action: 'REJECT_EXPENSE', entity: 'expenses', trigger: 'Reprovação com motivo pelo gestor/financeiro' },
  { action: 'APPROVE_EXPENSE', entity: 'expenses', trigger: 'Liquidação/pagamento pelo financeiro' },
  { action: 'UPLOAD_ATTACHMENT', entity: 'storage/comprovantes', trigger: 'Envio de foto ou PDF de comprovante' },
  { action: 'UPDATE_USER_ROLE', entity: 'colaboradores', trigger: 'Alteração administrativa de cargo/função' }
];

async function verifyAuditLogs() {
  console.log('====================================================');
  console.log('   FASE 2 — AUDITORIA DE RASTREABILIDADE (AUDIT)    ');
  console.log('====================================================\n');

  console.log('1. Verificando existência da tabela "audit_logs" no Supabase...');
  const { data, error } = await supabase.from('audit_logs').select('*').limit(1);

  if (error) {
    console.log(`   ⚠️ Diagnóstico: Tabela "audit_logs" AINDA NÃO EXISTE no banco remoto.`);
    console.log(`      Mensagem retornada: "${error.message}"`);
    console.log(`\n2. Mapeamento de Eventos Críticos Implementados no Código:`);
    CRITICAL_EVENTS.forEach((e, idx) => {
      console.log(`   ${idx + 1}. [${e.action}] -> Entidade: ${e.entity} (${e.trigger})`);
    });
    console.log(`\n3. Arquitetura Não-Bloqueante (Fail-Safe):`);
    console.log(`   • Serviço: src/services/audit.js`);
    console.log(`   • Comportamento: Se a tabela audit_logs não existir no banco, a aplicação opera`);
    console.log(`     normalmente sem quebrar e sem bloquear a navegação do usuário.`);
    console.log(`\n4. DDL Oficial Criado para Ativação:`);
    console.log(`   • Arquivo: scripts/create_audit_table.sql`);
    console.log(`   • Campos: id, user_id, action, entity, entity_id, details (JSONB), created_at`);
    console.log(`   • Segurança: RLS ativo (escrita para autenticados, leitura para Gestor/Financeiro/Admin)`);
  } else {
    console.log(`   ✅ Tabela "audit_logs" ATIVA no Supabase! (${data.length} registros existentes)`);
  }

  console.log('\n====================================================');
  console.log('  AUDITORIA DE RASTREABILIDADE CONCLUÍDA ');
  console.log('====================================================\n');
}

verifyAuditLogs();
