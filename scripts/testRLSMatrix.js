import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const url = process.env.VITE_SUPABASE_URL || '';
const key = process.env.VITE_SUPABASE_ANON_KEY || '';

function createClientInstance() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

const SENHA_PADRAO = 'saavedra123';

// Usuários da Saavedra para a matriz de testes
const USERS = {
  colabA: { email: 'cristiana.gehm@saavedra.com.br', papel: 'Vendedor' },
  colabB: { email: 'fernando.bomfoco@saavedra.com.br', papel: 'Vendedor' },
  gestor: { email: 'saulo.scherer@saavedra.com.br', papel: 'Gestor' },
  financeiro: { email: 'financeiro.saav@saavedra.com.br', papel: 'Financeiro' },
  admin: { email: 'suporte.saav@saavedra.com.br', papel: 'Admin' }
};

async function runRLSMatrix() {
  console.log('====================================================');
  console.log('    FASE 2 — MATRIZ DE TESTES DE SEGURANÇA RLS      ');
  console.log('====================================================\n');

  const results = [];

  // Inicializar clientes autenticados
  const clientA = createClientInstance();
  const clientB = createClientInstance();
  const clientGestor = createClientInstance();
  const clientFin = createClientInstance();
  const clientAdmin = createClientInstance();

  console.log('1. Autenticando atores no Supabase Auth...');
  const { data: authA } = await clientA.auth.signInWithPassword({ email: USERS.colabA.email, password: SENHA_PADRAO });
  const { data: authB } = await clientB.auth.signInWithPassword({ email: USERS.colabB.email, password: SENHA_PADRAO });
  const { data: authG } = await clientGestor.auth.signInWithPassword({ email: USERS.gestor.email, password: SENHA_PADRAO });
  const { data: authF } = await clientFin.auth.signInWithPassword({ email: USERS.financeiro.email, password: SENHA_PADRAO });
  const { data: authAdmin } = await clientAdmin.auth.signInWithPassword({ email: USERS.admin.email, password: SENHA_PADRAO });

  const idA = authA.user.id;
  const idB = authB.user.id;
  console.log(`   Colaborador A: ${USERS.colabA.email} (UID: ${idA})`);
  console.log(`   Colaborador B: ${USERS.colabB.email} (UID: ${idB})`);
  console.log(`   Gestor:        ${USERS.gestor.email}`);
  console.log(`   Financeiro:    ${USERS.financeiro.email}`);
  console.log(`   Admin:         ${USERS.admin.email}\n`);

  let expBId = null;

  try {
    // Setup: Colaborador B cria uma despesa legítima
    const { data: setupB, error: errSetupB } = await clientB.from('expenses').insert([{
      colaborador_id: idB,
      descricao: '[RLS_TEST] Despesa legítima do Colaborador B',
      amount: 85.50,
      date: new Date().toISOString().split('T')[0],
      categoria: 'Estacionamento',
      cliente: 'Cliente Confidencial B',
      status: 'ABERTO'
    }]).select();

    if (errSetupB || !setupB) throw new Error(`Falha no setup de B: ${errSetupB?.message}`);
    expBId = setupB[0].id;
    console.log(`📌 Despesa de teste criada para Colaborador B: ID ${expBId} (Status: ABERTO)\n`);

    // ---------------------------------------------------------------
    // RLS-001: Usuário A tenta visualizar despesa do usuário B
    // ---------------------------------------------------------------
    console.log('--- RLS-001: Usuário A tenta visualizar despesa do usuário B ---');
    const { data: res001, error: err001 } = await clientA
      .from('expenses')
      .select('id, descricao, amount')
      .eq('id', expBId);

    const isBlocked001 = err001 || !res001 || res001.length === 0;
    results.push({
      id: 'RLS-001',
      descricao: 'Usuário A tenta visualizar despesa do usuário B',
      esperado: 'BLOQUEADO',
      obtido: isBlocked001 ? 'BLOQUEADO' : 'PERMITIDO',
      sucesso: isBlocked001,
      detalhes: isBlocked001 ? 'PostgreSQL retornou conjunto vazio / acesso negado' : 'FALHA: Usuário A leu dados de B'
    });
    console.log(`Resultado RLS-001: [${isBlocked001 ? '✅ BLOQUEADO' : '❌ FALHA'}]\n`);

    // ---------------------------------------------------------------
    // RLS-002: Usuário A tenta editar despesa do usuário B
    // ---------------------------------------------------------------
    console.log('--- RLS-002: Usuário A tenta editar despesa do usuário B ---');
    const { data: res002, error: err002 } = await clientA
      .from('expenses')
      .update({ amount: 9999.99 })
      .eq('id', expBId)
      .select();

    const isBlocked002 = err002 || !res002 || res002.length === 0;
    results.push({
      id: 'RLS-002',
      descricao: 'Usuário A tenta editar despesa do usuário B',
      esperado: 'BLOQUEADO',
      obtido: isBlocked002 ? 'BLOQUEADO' : 'PERMITIDO',
      sucesso: isBlocked002,
      detalhes: isBlocked002 ? 'Zero linhas afetadas no PostgreSQL / rejeição' : 'FALHA: Usuário A alterou dados de B'
    });
    console.log(`Resultado RLS-002: [${isBlocked002 ? '✅ BLOQUEADO' : '❌ FALHA'}]\n`);

    // ---------------------------------------------------------------
    // RLS-003: Colaborador tenta validar uma despesa (bypass de frontend)
    // ---------------------------------------------------------------
    console.log('--- RLS-003: Colaborador tenta validar uma despesa diretamente no PostgreSQL ---');
    // Tentativa do Colaborador B tentar validar a sua própria despesa para pular a esteira de aprovação
    const { data: res003, error: err003 } = await clientB
      .from('expenses')
      .update({ status: 'VALIDADO' })
      .eq('id', expBId)
      .select();

    // Como as policies no Postgres estão configuradas? Vamos avaliar se o Postgres bloqueou ou permitiu
    const isBlocked003 = err003 || !res003 || res003.length === 0;
    // Checamos no banco se o status realmente virou VALIDADO
    const { data: check003 } = await clientAdmin.from('expenses').select('status').eq('id', expBId).single();
    const statusAlterou003 = check003.status === 'VALIDADO';

    results.push({
      id: 'RLS-003',
      descricao: 'Colaborador tenta validar uma despesa (status VALIDADO)',
      esperado: 'BLOQUEADO',
      obtido: !statusAlterou003 ? 'BLOQUEADO' : 'PERMITIDO NO BANCO (Protegido apenas no Frontend)',
      sucesso: !statusAlterou003,
      detalhes: !statusAlterou003 
        ? 'PostgreSQL bloqueou a alteração de status por Colaborador' 
        : 'ATENÇÃO: A política de UPDATE da tabela expenses permite que o dono atualize qualquer coluna da sua linha'
    });
    console.log(`Resultado RLS-003: [${!statusAlterou003 ? '✅ BLOQUEADO' : '⚠️ PERMITIDO NO BANCO'}]\n`);

    // Se alterou para VALIDADO, reseta para ABERTO
    if (statusAlterou003) {
      await clientAdmin.from('expenses').update({ status: 'ABERTO' }).eq('id', expBId);
    }

    // ---------------------------------------------------------------
    // RLS-004: Colaborador tenta aprovar uma despesa (bypass de frontend)
    // ---------------------------------------------------------------
    console.log('--- RLS-004: Colaborador tenta aprovar/liquidar uma despesa no PostgreSQL ---');
    const { data: res004, error: err004 } = await clientB
      .from('expenses')
      .update({ status: 'APROVADO' })
      .eq('id', expBId)
      .select();

    const { data: check004 } = await clientAdmin.from('expenses').select('status').eq('id', expBId).single();
    const statusAlterou004 = check004.status === 'APROVADO';

    results.push({
      id: 'RLS-004',
      descricao: 'Colaborador tenta aprovar/liquidar uma despesa (status APROVADO)',
      esperado: 'BLOQUEADO',
      obtido: !statusAlterou004 ? 'BLOQUEADO' : 'PERMITIDO NO BANCO (Protegido apenas no Frontend)',
      sucesso: !statusAlterou004,
      detalhes: !statusAlterou004 
        ? 'PostgreSQL bloqueou a alteração para APROVADO' 
        : 'ATENÇÃO: A política de UPDATE atual permite que o autor atualize qualquer campo da despesa'
    });
    console.log(`Resultado RLS-004: [${!statusAlterou004 ? '✅ BLOQUEADO' : '⚠️ PERMITIDO NO BANCO'}]\n`);

    // Reseta para ABERTO
    await clientAdmin.from('expenses').update({ status: 'ABERTO' }).eq('id', expBId);

    // ---------------------------------------------------------------
    // RLS-005: Gestor valida uma despesa
    // ---------------------------------------------------------------
    console.log('--- RLS-005: Gestor valida uma despesa (status VALIDADO) ---');
    const { data: res005, error: err005 } = await clientGestor
      .from('expenses')
      .update({ status: 'VALIDADO' })
      .eq('id', expBId)
      .select();

    const isPermitted005 = !err005 && res005 && res005.length > 0 && res005[0].status === 'VALIDADO';
    results.push({
      id: 'RLS-005',
      descricao: 'Gestor valida uma despesa',
      esperado: 'PERMITIDO',
      obtido: isPermitted005 ? 'PERMITIDO' : 'BLOQUEADO',
      sucesso: isPermitted005,
      detalhes: isPermitted005 ? 'Gestor validou com sucesso no PostgreSQL' : `Erro: ${err005?.message}`
    });
    console.log(`Resultado RLS-005: [${isPermitted005 ? '✅ PERMITIDO' : '❌ ERRO'}]\n`);

    // ---------------------------------------------------------------
    // RLS-006: Gestor reprova uma despesa
    // ---------------------------------------------------------------
    console.log('--- RLS-006: Gestor reprova uma despesa com justificativa ---');
    const { data: res006, error: err006 } = await clientGestor
      .from('expenses')
      .update({ status: 'REPROVADO', motivo_reprovacao: 'Visita reprovada por teste de RLS' })
      .eq('id', expBId)
      .select();

    const isPermitted006 = !err006 && res006 && res006.length > 0 && res006[0].status === 'REPROVADO';
    results.push({
      id: 'RLS-006',
      descricao: 'Gestor reprova uma despesa',
      esperado: 'PERMITIDO',
      obtido: isPermitted006 ? 'PERMITIDO' : 'BLOQUEADO',
      sucesso: isPermitted006,
      detalhes: isPermitted006 ? 'Gestor reprovou com sucesso e gravou motivo' : `Erro: ${err006?.message}`
    });
    console.log(`Resultado RLS-006: [${isPermitted006 ? '✅ PERMITIDO' : '❌ ERRO'}]\n`);

    // Retorna para VALIDADO para o teste do financeiro
    await clientGestor.from('expenses').update({ status: 'VALIDADO', motivo_reprovacao: null }).eq('id', expBId);

    // ---------------------------------------------------------------
    // RLS-007: Financeiro aprova/liquida
    // ---------------------------------------------------------------
    console.log('--- RLS-007: Financeiro aprova/liquida reembolso ---');
    const { data: res007, error: err007 } = await clientFin
      .from('expenses')
      .update({ status: 'APROVADO' })
      .eq('id', expBId)
      .select();

    const isPermitted007 = !err007 && res007 && res007.length > 0 && res007[0].status === 'APROVADO';
    results.push({
      id: 'RLS-007',
      descricao: 'Financeiro aprova/liquida despesa',
      esperado: 'PERMITIDO',
      obtido: isPermitted007 ? 'PERMITIDO' : 'BLOQUEADO',
      sucesso: isPermitted007,
      detalhes: isPermitted007 ? 'Financeiro liquidou despesa no PostgreSQL com sucesso' : `Erro: ${err007?.message}`
    });
    console.log(`Resultado RLS-007: [${isPermitted007 ? '✅ PERMITIDO' : '❌ ERRO'}]\n`);

    // ---------------------------------------------------------------
    // RLS-008: Admin acessa dados globais
    // ---------------------------------------------------------------
    console.log('--- RLS-008: Admin acessa dados globais ---');
    const { data: res008, error: err008, count: totalAdmin } = await clientAdmin
      .from('expenses')
      .select('id, colaborador_id, status', { count: 'exact' });

    const isPermitted008 = !err008 && totalAdmin > 0;
    results.push({
      id: 'RLS-008',
      descricao: 'Admin acessa dados globais',
      esperado: 'PERMITIDO',
      obtido: isPermitted008 ? 'PERMITIDO' : 'BLOQUEADO',
      sucesso: isPermitted008,
      detalhes: isPermitted008 ? `Admin acessou globalmente ${totalAdmin} despesas de todos os colaboradores` : `Erro: ${err008?.message}`
    });
    console.log(`Resultado RLS-008: [${isPermitted008 ? '✅ PERMITIDO' : '❌ ERRO'}]\n`);

  } finally {
    // Cleanup
    if (expBId) {
      await clientAdmin.from('expenses').delete().eq('id', expBId);
      console.log(`🧹 Limpeza: Despesa de teste ${expBId} removida.`);
    }
    await clientA.auth.signOut();
    await clientB.auth.signOut();
    await clientGestor.auth.signOut();
    await clientFin.auth.signOut();
    await clientAdmin.auth.signOut();
  }

  console.log('\n====================================================');
  console.log('      TABELA RESUMO DA MATRIZ DE TESTES RLS         ');
  console.log('====================================================');
  console.table(results.map(r => ({
    ID: r.id,
    'Cenário de Teste': r.descricao,
    Esperado: r.esperado,
    Obtido: r.obtido,
    'Status Teste': r.sucesso ? 'PASSOU' : 'ATENÇÃO / FALHA'
  })));
}

runRLSMatrix();
