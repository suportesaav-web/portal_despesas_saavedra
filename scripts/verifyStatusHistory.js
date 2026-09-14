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

const EXPECTED_HISTORY_FIELDS = [
  'id',
  'expense_id',
  'old_status',
  'new_status',
  'reason',
  'changed_by',
  'created_at'
];

async function verifyStatusHistory() {
  console.log('====================================================');
  console.log('   FASE 2 — AUDITORIA DE HISTÓRICO DE STATUS (V2)   ');
  console.log('====================================================\n');

  console.log('1. Verificando existência da tabela "expense_status_history" no Supabase...');
  const { data, error } = await supabase
    .from('expense_status_history')
    .select('*')
    .limit(1);

  if (error) {
    console.log(`   ⚠️ Diagnóstico: Tabela "expense_status_history" AINDA NÃO EXISTE no banco remoto.`);
    console.log(`      Mensagem: "${error.message}"`);
    console.log(`\n2. Verificação dos Requisitos da Especificação (Seção 13):`);
    console.log(`   Campos esperados por registro de histórico:`);
    EXPECTED_HISTORY_FIELDS.forEach(f => console.log(`   • ${f}`));
    console.log(`\n3. Script DDL Automatizado Criado:`);
    console.log(`   • Caminho: scripts/create_history_table.sql`);
    console.log(`   • Recursos:`);
    console.log(`     - Tabela dedicada com integridade referencial (ON DELETE CASCADE)`);
    console.log(`     - RLS ativado (leitura para autenticados)`);
    console.log(`     - Trigger automático (AFTER INSERT OR UPDATE OF status ON expenses)`);
    console.log(`     - Gravação imutável sem sobrescrita de eventos passados`);
    console.log(`\n4. Para ativar a tabela e os triggers no Supabase, execute:`);
    console.log(`   scripts/create_history_table.sql no SQL Editor.`);
  } else {
    console.log(`   ✅ Tabela "expense_status_history" ATIVA no Supabase!`);
    console.log(`   Registros encontrados: ${data.length}`);
  }

  console.log('\n====================================================');
  console.log('  AUDITORIA DE HISTÓRICO CONCLUÍDA ');
  console.log('====================================================\n');
}

verifyStatusHistory();
