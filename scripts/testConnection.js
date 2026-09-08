import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function fullHealthCheck() {
  console.log('==================================================');
  console.log('     RELATÓRIO COMPLETO DO AMBIENTE SUPABASE      ');
  console.log('==================================================\n');

  // 1. Tabela Colaboradores
  console.log('--- 1. TABELA colaboradores ---');
  const { data: colabs, error: colabErr } = await supabase
    .from('colaboradores')
    .select('id, nome, email, funcao, created_at');

  if (colabErr) {
    console.error('❌ Erro ao consultar colaboradores:', colabErr.message);
  } else {
    console.log(`✅ ${colabs.length} colaboradores cadastrados:`);
    colabs.forEach(c => {
      console.log(`   • ${c.nome} | ${c.email} | Função: [${c.funcao}] | UID: ${c.id}`);
    });
  }

  // 2. Tabela Expenses
  console.log('\n--- 2. TABELA expenses ---');
  const { data: expenses, error: expErr } = await supabase
    .from('expenses')
    .select('id, descricao, amount, date, status, colaborador_id')
    .limit(10);

  if (expErr) {
    console.error('❌ Erro ao consultar expenses:', expErr.message);
    if (expErr.hint) console.error('   Hint:', expErr.hint);
  } else {
    console.log(`✅ Tabela expenses acessível! (${expenses.length} registros listados)`);
    if (expenses.length > 0) {
      expenses.forEach(e => {
        console.log(`   • ID ${e.id}: ${e.descricao} - R$ ${e.amount} [Status: ${e.status}]`);
      });
    } else {
      console.log('   (Tabela está vazia no momento, pronta para receber lançamentos!)');
    }
  }

  // 3. Storage Bucket 'comprovantes'
  console.log('\n--- 3. STORAGE BUCKET comprovantes ---');
  const { data: files, error: bErr } = await supabase
    .storage
    .from('comprovantes')
    .list('', { limit: 5 });

  if (bErr) {
    console.error('❌ Erro ao verificar bucket comprovantes:', bErr.message);
    console.log('   Verifique se o bucket "comprovantes" foi criado no Supabase Storage como público.');
  } else {
    console.log(`✅ Bucket "comprovantes" acessível! (${files.length} arquivos listados)`);
    files.forEach(f => console.log(`   • ${f.name}`));
  }

  console.log('\n==================================================');
}

fullHealthCheck();
