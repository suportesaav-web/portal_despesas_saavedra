import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const EXPECTED_COLUMNS = [
  { name: 'id', required: true },
  { name: 'colaborador_id', required: true },
  { name: 'descricao', required: true },
  { name: 'amount', required: true },
  { name: 'date', required: true },
  { name: 'hora', required: false, migration: true },
  { name: 'categoria', required: true },
  { name: 'categoria_codigo', required: false, migration: true },
  { name: 'categoria_grupo', required: false, migration: true },
  { name: 'cliente', required: true },
  { name: 'status', required: true },
  { name: 'foto_url', required: true },
  { name: 'motivo_reprovacao', required: true },
  { name: 'validado_por', required: false, migration: true },
  { name: 'liquidado_por', required: false, migration: true },
  { name: 'data_validacao', required: false, migration: true },
  { name: 'data_liquidacao', required: false, migration: true }
];

async function verifyDatabase() {
  console.log('====================================================');
  console.log('  FASE 2 — DIAGNÓSTICO E AUDITORIA DO BANCO DE DADOS ');
  console.log('====================================================\n');

  // 1. Conexão
  console.log('1. Verificando conectividade com o Supabase...');
  try {
    const { count, error } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`   ✅ Conexão estabelecida com sucesso! (${count} colaboradores encontrados)`);
  } catch (err) {
    console.error(`   ❌ Falha de conexão: ${err.message}`);
    return;
  }

  // 2. Existência das colunas na tabela expenses
  console.log('\n2. Auditando as 17 colunas da tabela "expenses"...');
  const columnsReport = [];
  for (const col of EXPECTED_COLUMNS) {
    const { error } = await supabase.from('expenses').select(col.name).limit(1);
    if (error) {
      columnsReport.push({ col: col.name, status: 'AUSENTE', note: col.migration ? 'Pendente de migration.sql' : 'ERRO' });
      console.log(`   ⚠️ Coluna [${col.name}]: AUSENTE ${col.migration ? '(Pendente de migration.sql)' : ''}`);
    } else {
      columnsReport.push({ col: col.name, status: 'OK', note: 'Ativa' });
      console.log(`   ✅ Coluna [${col.name}]: ATIVA`);
    }
  }

  // 3. Capacidade de INSERT, SELECT, UPDATE e Integridade das Relações
  console.log('\n3. Testando operações CRUD com integridade referencial...');
  const testEmail = 'suporte.saav@saavedra.com.br';
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'Saavedra2026!'
  });

  if (authErr) {
    console.error(`   ❌ Falha na autenticação do usuário de teste: ${authErr.message}`);
    return;
  }

  const adminUser = authData.user;
  console.log(`   ✅ Autenticado como ${testEmail} (UID: ${adminUser.id})`);

  let tempExpenseId = null;
  try {
    // Payload básico garantido
    const basePayload = {
      colaborador_id: adminUser.id,
      descricao: '[AUDITORIA_FASE_2] Teste de integridade de esquema',
      amount: 50.00,
      date: new Date().toISOString().split('T')[0],
      categoria: 'Estacionamento',
      cliente: 'Cliente Teste Auditoria',
      status: 'ABERTO'
    };

    // INSERT
    const { data: insertData, error: insertErr } = await supabase
      .from('expenses')
      .insert([basePayload])
      .select();

    if (insertErr) throw new Error(`Falha no INSERT: ${insertErr.message}`);
    tempExpenseId = insertData[0].id;
    console.log(`   ✅ INSERT bem-sucedido! ID criado: ${tempExpenseId}`);

    // SELECT com JOIN (Integridade referencial com colaboradores)
    const { data: selectData, error: selectErr } = await supabase
      .from('expenses')
      .select(`
        id, descricao, amount, status,
        colaboradores!colaborador_id (id, nome, email, funcao)
      `)
      .eq('id', tempExpenseId)
      .single();

    if (selectErr) throw new Error(`Falha no SELECT com JOIN: ${selectErr.message}`);
    console.log(`   ✅ SELECT com JOIN OK! Relacionamento com colaborador validado:`);
    console.log(`      Colaborador vinculado: ${selectData.colaboradores?.nome} (${selectData.colaboradores?.email})`);

    // UPDATE
    const { data: updateData, error: updateErr } = await supabase
      .from('expenses')
      .update({ status: 'VALIDADO', motivo_reprovacao: 'Teste de update aprovado' })
      .eq('id', tempExpenseId)
      .select();

    if (updateErr) throw new Error(`Falha no UPDATE: ${updateErr.message}`);
    console.log(`   ✅ UPDATE bem-sucedido! Novo status: ${updateData[0].status}`);

  } catch (opErr) {
    console.error(`   ❌ Falha em operação no banco: ${opErr.message}`);
  } finally {
    // Limpeza
    if (tempExpenseId) {
      await supabase.from('expenses').delete().eq('id', tempExpenseId);
      console.log(`   ✅ Limpeza: Registro de teste ${tempExpenseId} removido.`);
    }
    await supabase.auth.signOut();
  }

  // 4. Resumo e Diagnóstico
  const totalPresentes = columnsReport.filter(c => c.status === 'OK').length;
  const totalAusentes = columnsReport.filter(c => c.status === 'AUSENTE').length;

  console.log('\n====================================================');
  console.log(`  RESUMO DA AUDITORIA DO BANCO:`);
  console.log(`  Colunas ativas no banco: ${totalPresentes} de ${EXPECTED_COLUMNS.length}`);
  console.log(`  Colunas pendentes de migração: ${totalAusentes}`);
  if (totalAusentes > 0) {
    console.log(`  ⚠️ Para ativar as ${totalAusentes} colunas pendentes, execute:`);
    console.log(`     scripts/migration.sql no SQL Editor do Supabase.`);
  } else {
    console.log(`  🎉 Todas as colunas esperadas estão 100% ativas no banco!`);
  }
  console.log('====================================================\n');
}

verifyDatabase();
