import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

// Cria instâncias independentes para simular diferentes sessões de usuários
function createSupabaseClient() {
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

const SENHA_PADRAO = 'saavedra123';

async function runE2ETest() {
  console.log('====================================================');
  console.log('    TESTE PONTA A PONTA (E2E) — SAAV EXPENSES       ');
  console.log('====================================================\n');

  let testExpenseId = null;
  let testFileName = null;
  const clientVendedor = createSupabaseClient();
  const clientGestor = createSupabaseClient();
  const clientFinanceiro = createSupabaseClient();

  try {
    // ----------------------------------------------------
    // PASSO 1: Login do Vendedor (Cristiana Gehm)
    // ----------------------------------------------------
    const emailVendedor = 'cristiana.gehm@saavedra.com.br';
    console.log(`1. Autenticando Vendedor: ${emailVendedor}...`);
    const { data: authVendedor, error: errAuthV } = await clientVendedor.auth.signInWithPassword({
      email: emailVendedor,
      password: SENHA_PADRAO
    });
    if (errAuthV) throw new Error(`Falha no login do vendedor: ${errAuthV.message}`);
    const vendedorId = authVendedor.user.id;
    console.log(`   ✅ Vendedor autenticado com sucesso! UID: ${vendedorId}`);

    // ----------------------------------------------------
    // PASSO 2: Upload de Comprovante de Visita pelo Vendedor
    // ----------------------------------------------------
    console.log('\n2. Vendedor realizando upload do comprovante para o Storage...');
    testFileName = `recibo_teste_e2e_${vendedorId}_${Date.now()}.png`;
    const mockFileContent = new Blob(['Mock image content for receipt'], { type: 'image/png' });

    const { error: errUpload } = await clientVendedor.storage
      .from('comprovantes')
      .upload(testFileName, mockFileContent);

    if (errUpload) throw new Error(`Falha no upload do comprovante: ${errUpload.message}`);
    const { data: publicUrlData } = clientVendedor.storage.from('comprovantes').getPublicUrl(testFileName);
    const fotoUrl = publicUrlData.publicUrl;
    console.log(`   ✅ Comprovante enviado com sucesso! URL: ${fotoUrl}`);

    // ----------------------------------------------------
    // PASSO 3: Lançamento da Despesa de Visita (Status: ABERTO)
    // ----------------------------------------------------
    console.log('\n3. Vendedor lançando nova despesa de visita...');
    const expensePayload = {
      colaborador_id: vendedorId,
      descricao: 'Almoço e estacionamento - Visita comercial homologação E2E',
      amount: 45.80,
      date: new Date().toISOString().split('T')[0],
      categoria: 'Estacionamento',
      cliente: 'Supermercado Modelo Unidade Central (CRM Test)',
      status: 'ABERTO',
      foto_url: fotoUrl
    };

    const { data: insertedExpenses, error: errInsert } = await clientVendedor
      .from('expenses')
      .insert([expensePayload])
      .select();

    if (errInsert || !insertedExpenses || insertedExpenses.length === 0) {
      throw new Error(`Falha ao inserir despesa: ${errInsert?.message}`);
    }

    testExpenseId = insertedExpenses[0].id;
    console.log(`   ✅ Despesa cadastrada com sucesso!`);
    console.log(`      ID: ${testExpenseId}`);
    console.log(`      Status inicial: [${insertedExpenses[0].status}]`);
    console.log(`      Cliente CRM: ${insertedExpenses[0].cliente}`);
    console.log(`      Valor: R$ ${insertedExpenses[0].amount}`);

    // ----------------------------------------------------
    // PASSO 4: Login do Gestor (Saulo Scherer / Kyanne)
    // ----------------------------------------------------
    const emailGestor = 'saulo.scherer@saavedra.com.br';
    console.log(`\n4. Autenticando Gestor Comercial: ${emailGestor}...`);
    const { data: authGestor, error: errAuthG } = await clientGestor.auth.signInWithPassword({
      email: emailGestor,
      password: SENHA_PADRAO
    });
    if (errAuthG) throw new Error(`Falha no login do gestor: ${errAuthG.message}`);
    const gestorId = authGestor.user.id;
    console.log(`   ✅ Gestor autenticado! UID: ${gestorId}`);

    // Gestor consulta a despesa na fila de validação
    const { data: despesaFilaGestor, error: errGestorGet } = await clientGestor
      .from('expenses')
      .select('id, cliente, status, amount, colaborador_id')
      .eq('id', testExpenseId)
      .single();

    if (errGestorGet) throw new Error(`Gestor não localizou a despesa: ${errGestorGet.message}`);
    console.log(`   ✅ Gestor visualizou despesa ID ${despesaFilaGestor.id} com status [${despesaFilaGestor.status}]`);

    // ----------------------------------------------------
    // PASSO 5: Gestor valida a visita no CRM (Status: VALIDADO)
    // ----------------------------------------------------
    console.log('\n5. Gestor conferindo visita no CRM e aprovando etapa 1 (VALIDADO)...');
    const { data: validadoData, error: errValidar } = await clientGestor
      .from('expenses')
      .update({ status: 'VALIDADO' })
      .eq('id', testExpenseId)
      .select();

    if (errValidar) throw new Error(`Falha ao validar visita: ${errValidar.message}`);
    console.log(`   ✅ Despesa validada no CRM! Novo status: [${validadoData[0].status}]`);

    // ----------------------------------------------------
    // PASSO 6: Login do Operador Financeiro (Fernando Szklarczyk)
    // ----------------------------------------------------
    const emailFinanceiro = 'financeiro.saav@saavedra.com.br';
    console.log(`\n6. Autenticando Operador Financeiro: ${emailFinanceiro}...`);
    const { data: authFin, error: errAuthF } = await clientFinanceiro.auth.signInWithPassword({
      email: emailFinanceiro,
      password: SENHA_PADRAO
    });
    if (errAuthF) throw new Error(`Falha no login do financeiro: ${errAuthF.message}`);
    console.log(`   ✅ Financeiro autenticado! UID: ${authFin.user.id}`);

    // Financeiro consulta despesas na fila de reembolso
    const { data: despesaFilaFin, error: errFinGet } = await clientFinanceiro
      .from('expenses')
      .select('id, amount, status, foto_url')
      .eq('id', testExpenseId)
      .single();

    if (errFinGet) throw new Error(`Financeiro não localizou a despesa: ${errFinGet.message}`);
    console.log(`   ✅ Financeiro conferiu dados fiscais e anexo (${despesaFilaFin.foto_url ? 'Comprovante Presente' : 'Sem Anexo'})`);

    // ----------------------------------------------------
    // PASSO 7: Financeiro liquida o reembolso (Status: APROVADO)
    // ----------------------------------------------------
    console.log('\n7. Financeiro liquidando o reembolso (APROVADO)...');
    const { data: liquidadoData, error: errLiquidar } = await clientFinanceiro
      .from('expenses')
      .update({ status: 'APROVADO' })
      .eq('id', testExpenseId)
      .select();

    if (errLiquidar) throw new Error(`Falha ao liquidar reembolso: ${errLiquidar.message}`);
    console.log(`   ✅ Reembolso liquidado com sucesso! Status final: [${liquidadoData[0].status}]`);

    // ----------------------------------------------------
    // PASSO 8: Vendedor consulta o extrato e verifica status final
    // ----------------------------------------------------
    console.log('\n8. Vendedor consultando extrato para verificar se despesa consta como APROVADA...');
    const { data: consultaVendedor, error: errConsV } = await clientVendedor
      .from('expenses')
      .select('id, descricao, amount, status')
      .eq('id', testExpenseId)
      .single();

    if (errConsV) throw new Error(`Vendedor não conseguiu consultar extrato: ${errConsV.message}`);
    if (consultaVendedor.status !== 'APROVADO') {
      throw new Error(`Status divergente no extrato do vendedor: esperado APROVADO, obtido ${consultaVendedor.status}`);
    }
    console.log(`   ✅ Vendedor confirmou no extrato: Despesa de R$ ${consultaVendedor.amount} está [${consultaVendedor.status}]!`);

    console.log('\n====================================================');
    console.log('  🎉 FLUXO PONTA A PONTA (E2E) EXECUTADO COM SUCESSO! ');
    console.log('====================================================\n');

  } catch (err) {
    console.error(`\n❌ ERRO NO TESTE E2E: ${err.message}`);
  } finally {
    // ----------------------------------------------------
    // LIMPEZA: Remove registros de teste
    // ----------------------------------------------------
    console.log('🧹 Executando rotina de limpeza dos dados de teste...');
    if (testExpenseId) {
      const { error: errDelExp } = await clientVendedor
        .from('expenses')
        .delete()
        .eq('id', testExpenseId);
      if (errDelExp) console.warn('   ⚠️ Falha ao remover despesa de teste:', errDelExp.message);
      else console.log(`   ✅ Despesa de teste (ID: ${testExpenseId}) removida.`);
    }

    if (testFileName) {
      const { error: errDelFile } = await clientVendedor
        .storage
        .from('comprovantes')
        .remove([testFileName]);
      if (errDelFile) console.warn('   ⚠️ Falha ao remover comprovante de teste:', errDelFile.message);
      else console.log(`   ✅ Comprovante de teste (${testFileName}) removido do Storage.`);
    }

    await clientVendedor.auth.signOut();
    await clientGestor.auth.signOut();
    await clientFinanceiro.auth.signOut();
    console.log('🔒 Sessões encerradas.\n');
  }
}

runE2ETest();
