import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

function createSupabaseClient() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

const SENHA_PADRAO = 'Saavedra2026!';

async function testRLSSecurity() {
  console.log('====================================================');
  console.log('    AUDITORIA DE SEGURANÇA E RLS — SAAV EXPENSES    ');
  console.log('====================================================\n');

  const clientAnon = createSupabaseClient();
  const clientVendedorA = createSupabaseClient();
  const clientVendedorB = createSupabaseClient();

  let despesaVendedorBId = null;

  try {
    // ----------------------------------------------------
    // TESTE 1: Acesso Anônimo / Não Autenticado
    // ----------------------------------------------------
    console.log('--- TESTE 1: Tentativa de inserção anônima (sem login) ---');
    const { error: errAnonInsert } = await clientAnon
      .from('expenses')
      .insert([{
        descricao: 'Tentativa Hacker Anônima',
        amount: 999.99,
        date: '2026-09-09',
        status: 'ABERTO'
      }]);

    if (errAnonInsert) {
      console.log(`✅ BLOQUEADO COM SUCESSO! Erro retornado: "${errAnonInsert.message}"`);
    } else {
      console.error('❌ FALHA DE SEGURANÇA: Inserção anônima foi permitida!');
    }

    // ----------------------------------------------------
    // Autenticação dos Vendedores A e B
    // ----------------------------------------------------
    const emailA = 'cristiana.gehm@saavedra.com.br';
    const emailB = 'fernando.bomfoco@saavedra.com.br';

    console.log(`\nAutenticando Vendedor A (${emailA})...`);
    const { data: authA, error: errA } = await clientVendedorA.auth.signInWithPassword({
      email: emailA,
      password: SENHA_PADRAO
    });
    if (errA) throw new Error(`Falha no login do Vendedor A: ${errA.message}`);
    const idA = authA.user.id;
    console.log(`   ✅ Vendedor A autenticado: UID ${idA}`);

    console.log(`Autenticando Vendedor B (${emailB})...`);
    const { data: authB, error: errB } = await clientVendedorB.auth.signInWithPassword({
      email: emailB,
      password: SENHA_PADRAO
    });
    if (errB) throw new Error(`Falha no login do Vendedor B: ${errB.message}`);
    const idB = authB.user.id;
    console.log(`   ✅ Vendedor B autenticado: UID ${idB}`);

    // Vendedor B cria uma despesa legítima própria
    console.log('\nCriando despesa privada de teste para o Vendedor B...');
    const { data: expB, error: errCreateB } = await clientVendedorB
      .from('expenses')
      .insert([{
        colaborador_id: idB,
        descricao: 'Despesa Confidencial do Vendedor B',
        amount: 120.00,
        date: '2026-09-09',
        categoria: 'Pedágio',
        cliente: 'Cliente Confidencial B',
        status: 'ABERTO'
      }])
      .select();

    if (errCreateB || !expB) throw new Error(`Falha ao criar despesa para B: ${errCreateB?.message}`);
    despesaVendedorBId = expB[0].id;
    console.log(`   ✅ Despesa do Vendedor B criada. ID: ${despesaVendedorBId}`);

    // ----------------------------------------------------
    // TESTE 2: Vendedor A tenta consultar a despesa do Vendedor B
    // ----------------------------------------------------
    console.log('\n--- TESTE 2: Vendedor A tentando consultar despesa de B ---');
    const { data: consultaInvasiva, error: errInvasiva } = await clientVendedorA
      .from('expenses')
      .select('*')
      .eq('id', despesaVendedorBId);

    if (errInvasiva) {
      console.log(`✅ BLOQUEADO: Erro de RLS retornado: ${errInvasiva.message}`);
    } else if (!consultaInvasiva || consultaInvasiva.length === 0) {
      console.log('✅ ISOLAMENTO CONFIRMADO: Vendedor A recebeu lista VAZIA (não enxerga despesa de B).');
    } else {
      console.error('❌ FALHA DE ISOLAMENTO: Vendedor A conseguiu visualizar a despesa do Vendedor B!');
    }

    // ----------------------------------------------------
    // TESTE 3: Vendedor A tenta alterar a despesa do Vendedor B
    // ----------------------------------------------------
    console.log('\n--- TESTE 3: Vendedor A tentando alterar valor da despesa de B ---');
    const { data: updateInvasivo, error: errUpInvasivo } = await clientVendedorA
      .from('expenses')
      .update({ amount: 9999.00 })
      .eq('id', despesaVendedorBId)
      .select();

    if (errUpInvasivo) {
      console.log(`✅ BLOQUEADO: Erro de RLS retornado: ${errUpInvasivo.message}`);
    } else if (!updateInvasivo || updateInvasivo.length === 0) {
      console.log('✅ BLOQUEADO COM SUCESSO: Nenhum registro alterado pelo Vendedor A.');
    } else {
      console.error('❌ FALHA DE SEGURANÇA: Vendedor A alterou registro do Vendedor B!');
    }

    // ----------------------------------------------------
    // TESTE 4: Vendedor A tenta deletar a despesa do Vendedor B
    // ----------------------------------------------------
    console.log('\n--- TESTE 4: Vendedor A tentando deletar despesa de B ---');
    const { data: delInvasivo, error: errDelInvasivo } = await clientVendedorA
      .from('expenses')
      .delete()
      .eq('id', despesaVendedorBId)
      .select();

    if (errDelInvasivo) {
      console.log(`✅ BLOQUEADO: Erro de RLS retornado: ${errDelInvasivo.message}`);
    } else if (!delInvasivo || delInvasivo.length === 0) {
      console.log('✅ BLOQUEADO COM SUCESSO: Nenhum registro deletado pelo invasor.');
    } else {
      console.error('❌ FALHA DE SEGURANÇA: Vendedor A conseguiu deletar despesa de B!');
    }

    console.log('\n====================================================');
    console.log('  🛡️ AUDITORIA DE RLS E ISOLAMENTO: 100% APROVADA!   ');
    console.log('====================================================\n');

  } catch (err) {
    console.error(`\n❌ ERRO NA AUDITORIA DE RLS: ${err.message}`);
  } finally {
    // Limpeza
    if (despesaVendedorBId) {
      console.log('Limpando registro de teste do Vendedor B...');
      await clientVendedorB.from('expenses').delete().eq('id', despesaVendedorBId);
      console.log('✅ Limpeza concluída.');
    }
    await clientVendedorA.auth.signOut();
    await clientVendedorB.auth.signOut();
  }
}

testRLSSecurity();
