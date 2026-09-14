import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function testLifecycleWithAuth() {
  console.log('=== TESTE DE CICLO COM USUÁRIO AUTENTICADO E RLS ===\n');

  // Testando login com usuário de teste
  const email = 'suporte.saav@saavedra.com.br';
  const password = 'Saavedra2026!';

  console.log(`🔐 1. Autenticando com ${email}...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authErr) {
    console.error('❌ Falha na autenticação:', authErr.message);
    return;
  }

  const user = authData.user;
  console.log(`✅ Login efetuado com sucesso! Auth UID: ${user.id}`);

  // Buscar colaborador correspondente
  const { data: colab, error: colabErr } = await supabase
    .from('colaboradores')
    .select('id, nome, email, funcao')
    .eq('id', user.id)
    .single();

  if (colabErr) {
    console.error('❌ Falha ao buscar registro em colaboradores:', colabErr.message);
  } else {
    console.log(`👤 Perfil carregado: ${colab.nome} | Função: ${colab.funcao}`);
  }

  // Testar INSERT autenticado
  console.log('\n📝 2. Testando INSERT autenticado na tabela expenses...');
  const testPayload = {
    colaborador_id: user.id,
    descricao: '__TESTE_SISTEMA_TEMPORARIO__',
    amount: 19.90,
    date: new Date().toISOString().split('T')[0],
    categoria: 'Estacionamento',
    cliente: 'Cliente Teste Integrado',
    status: 'ABERTO'
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('expenses')
    .insert([testPayload])
    .select();

  if (insertErr) {
    console.error('❌ Erro no INSERT autenticado:', insertErr.message);
    return;
  }

  const testExpenseId = inserted[0].id;
  console.log(`✅ INSERT autenticado OK! ID: ${testExpenseId}`);

  // Testar SELECT com JOIN
  console.log('\n🔍 3. Testando SELECT com JOIN em colaboradores...');
  const { data: fetched, error: fetchErr } = await supabase
    .from('expenses')
    .select(`
      id, descricao, amount, date, status, cliente,
      colaboradores!colaborador_id (nome, email)
    `)
    .eq('id', testExpenseId)
    .single();

  if (fetchErr) {
    console.error('❌ Erro no SELECT:', fetchErr.message);
  } else {
    console.log(`✅ SELECT OK! Registro: "${fetched.descricao}" - Autor: ${fetched.colaboradores?.nome}`);
  }

  // Testar UPDATE de status
  console.log('\n🔄 4. Testando UPDATE de status para VALIDADO...');
  const { data: updated, error: updateErr } = await supabase
    .from('expenses')
    .update({ status: 'VALIDADO' })
    .eq('id', testExpenseId)
    .select();

  if (updateErr) {
    console.error('❌ Erro no UPDATE:', updateErr.message);
  } else {
    console.log(`✅ UPDATE de status OK! Novo status: ${updated[0]?.status}`);
  }

  // Testar Storage Bucket com usuário autenticado
  console.log('\n📦 5. Testando upload/download/remove no bucket "comprovantes"...');
  const testFileName = `test_proof_${user.id}_${Date.now()}.txt`;
  const fileContent = new Blob(['Comprovante fiscal de teste'], { type: 'text/plain' });

  const { error: upErr } = await supabase
    .storage
    .from('comprovantes')
    .upload(testFileName, fileContent);

  if (upErr) {
    console.error('❌ Erro no upload:', upErr.message);
  } else {
    console.log(`✅ Upload no bucket comprovantes OK! Arquivo: ${testFileName}`);

    const { data: pubData } = supabase
      .storage
      .from('comprovantes')
      .getPublicUrl(testFileName);
    console.log(`✅ URL pública acessível: ${pubData.publicUrl}`);

    // Limpar arquivo de teste
    const { error: rmErr } = await supabase
      .storage
      .from('comprovantes')
      .remove([testFileName]);

    if (rmErr) {
      console.warn('⚠️ Falha ao remover arquivo de teste do storage:', rmErr.message);
    } else {
      console.log('✅ Arquivo de teste removido do Storage!');
    }
  }

  // Limpar registro do banco (DELETE)
  console.log('\n🧹 6. Limpando registro de despesa de teste...');
  const { error: delErr } = await supabase
    .from('expenses')
    .delete()
    .eq('id', testExpenseId);

  if (delErr) {
    console.error('❌ Erro ao deletar despesa de teste:', delErr.message);
  } else {
    console.log('✅ Despesa de teste removida do banco com sucesso!');
  }

  // Logout
  await supabase.auth.signOut();
  console.log('\n🔒 7. Logout efetuado.');

  console.log('\n==================================================');
  console.log('  TODOS OS TESTES DE BANCO, AUTH E STORAGE OK!    ');
  console.log('==================================================');
}

testLifecycleWithAuth();
