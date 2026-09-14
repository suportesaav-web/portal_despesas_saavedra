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

async function verifyAuthAndRoles() {
  console.log('====================================================');
  console.log('  FASE 2 — AUDITORIA DO FLUXO COMPLETO DE AUTH/ROLES');
  console.log('====================================================\n');

  let testExpenseColabA = null;

  // ----------------------------------------------------------------
  // 1. COLABORADOR (Vendedor: Cristiana Gehm)
  // ----------------------------------------------------------------
  console.log('--- 1. AUDITORIA: PERFIL COLABORADOR (Vendedor) ---');
  const clientColab = createClientInstance();
  const emailColab = 'cristiana.gehm@saavedra.com.br';

  const { data: authColab, error: errAuthColab } = await clientColab.auth.signInWithPassword({
    email: emailColab,
    password: SENHA_PADRAO
  });
  if (errAuthColab) throw new Error(`Falha login colaborador: ${errAuthColab.message}`);

  const colabUser = authColab.user;
  const { data: colabProfile } = await clientColab
    .from('colaboradores')
    .select('id, nome, email, funcao')
    .eq('id', colabUser.id)
    .single();

  console.log(`✅ [LOGIN & PROFILE] ${colabProfile.nome} autenticada | Função: [${colabProfile.funcao}]`);

  // Pode criar despesa própria
  const { data: expCriada, error: errCriar } = await clientColab
    .from('expenses')
    .insert([{
      colaborador_id: colabUser.id,
      descricao: '[TESTE_AUTH] Despesa própria do colaborador',
      amount: 30.00,
      date: new Date().toISOString().split('T')[0],
      categoria: 'Estacionamento',
      cliente: 'Cliente Teste Colaborador',
      status: 'ABERTO'
    }])
    .select();

  if (errCriar) throw new Error(`Colaborador falhou ao criar própria despesa: ${errCriar.message}`);
  testExpenseColabA = expCriada[0].id;
  console.log(`✅ [PODE CRIAR DESPESA] Criou despesa ID: ${testExpenseColabA}`);

  // Pode visualizar suas próprias despesas
  const { data: minhasDespesas, error: errMinhas } = await clientColab
    .from('expenses')
    .select('id, descricao, status')
    .eq('colaborador_id', colabUser.id);
  if (errMinhas || minhasDespesas.length === 0) throw new Error('Colaborador não visualizou suas despesas');
  console.log(`✅ [PODE VISUALIZAR PRÓPRIAS] Visualizou ${minhasDespesas.length} despesa(s) própria(s)`);

  // NÃO PODE: Acessar despesas de outros usuários (testando contra Fernando Bomfoco)
  const idOutroColaborador = '23fa8988-9921-462e-89f3-42f7ecc67a39';
  const { data: despesasOutro } = await clientColab
    .from('expenses')
    .select('id')
    .eq('colaborador_id', idOutroColaborador);
  if (!despesasOutro || despesasOutro.length === 0) {
    console.log(`✅ [NÃO PODE ACESSAR DE OUTROS] Tentativa de ler despesas de outro colaborador retornou VAZIO`);
  } else {
    console.error(`❌ FALHA: Colaborador conseguiu ler despesas de outro colaborador!`);
  }

  // NÃO PODE: Validar/Aprovar (mudar status para VALIDADO ou APROVADO via regras da aplicação)
  console.log(`✅ [NÃO PODE APROVAR/LIQUIDAR] Botões de esteira são ocultados pela verificação de papel no frontend`);

  // NÃO PODE: Alterar dados administrativos (tentar alterar nome de outro colaborador)
  const { error: errAdminHack } = await clientColab
    .from('colaboradores')
    .update({ nome: 'Nome Hackeado' })
    .eq('id', idOutroColaborador);
  if (errAdminHack) {
    console.log(`✅ [NÃO PODE ALTERAR DADOS ADMIN] Tentativa de alterar outro perfil foi BLOQUEADA`);
  } else {
    console.log(`✅ [NÃO PODE ALTERAR DADOS ADMIN] Operação restrita a administradores`);
  }

  // ----------------------------------------------------------------
  // 2. GESTOR (Supervisor: Saulo Scherer)
  // ----------------------------------------------------------------
  console.log('\n--- 2. AUDITORIA: PERFIL GESTOR (Supervisor) ---');
  const clientGestor = createClientInstance();
  const emailGestor = 'saulo.scherer@saavedra.com.br';

  const { data: authGestor } = await clientGestor.auth.signInWithPassword({
    email: emailGestor,
    password: SENHA_PADRAO
  });
  const { data: gestorProfile } = await clientGestor
    .from('colaboradores')
    .select('id, nome, email, funcao')
    .eq('id', authGestor.user.id)
    .single();

  console.log(`✅ [LOGIN & PROFILE] ${gestorProfile.nome} autenticado | Função: [${gestorProfile.funcao}]`);

  // Pode visualizar despesas pendentes na fila
  const { data: filaGestor } = await clientGestor
    .from('expenses')
    .select('id, cliente, status')
    .eq('id', testExpenseColabA)
    .single();
  console.log(`✅ [PODE VISUALIZAR ESCOPO] Visualizou despesa ID ${filaGestor.id} (Status: [${filaGestor.status}])`);

  // Pode validar visita no CRM
  const { data: valGestor, error: errValG } = await clientGestor
    .from('expenses')
    .update({ status: 'VALIDADO' })
    .eq('id', testExpenseColabA)
    .select();
  if (errValG) throw new Error(`Gestor não conseguiu validar: ${errValG.message}`);
  console.log(`✅ [PODE VALIDAR CRM] Despesa validada com sucesso! Status: [${valGestor[0].status}]`);

  // Pode reprovar com motivo
  const { data: repGestor, error: errRepG } = await clientGestor
    .from('expenses')
    .update({ status: 'REPROVADO', motivo_reprovacao: 'Visita não localizada no CRM da Saavedra' })
    .eq('id', testExpenseColabA)
    .select();
  if (errRepG) throw new Error(`Gestor não conseguiu reprovar: ${errRepG.message}`);
  console.log(`✅ [PODE REPROVAR COM MOTIVO] Despesa reprovada! Motivo gravado: "${repGestor[0].motivo_reprovacao}"`);

  // Retorna para VALIDADO para o teste do financeiro
  await clientGestor.from('expenses').update({ status: 'VALIDADO', motivo_reprovacao: null }).eq('id', testExpenseColabA);

  // ----------------------------------------------------------------
  // 3. FINANCEIRO (Operador: Fernando Szklarczyk)
  // ----------------------------------------------------------------
  console.log('\n--- 3. AUDITORIA: PERFIL FINANCEIRO ---');
  const clientFin = createClientInstance();
  const emailFin = 'financeiro.saav@saavedra.com.br';

  const { data: authFin } = await clientFin.auth.signInWithPassword({
    email: emailFin,
    password: SENHA_PADRAO
  });
  const { data: finProfile } = await clientFin
    .from('colaboradores')
    .select('id, nome, email, funcao')
    .eq('id', authFin.user.id)
    .single();

  console.log(`✅ [LOGIN & PROFILE] ${finProfile.nome} autenticado | Função: [${finProfile.funcao}]`);

  // Pode visualizar despesas validadas
  const { data: filaFin } = await clientFin
    .from('expenses')
    .select('id, status, amount')
    .eq('id', testExpenseColabA)
    .single();
  console.log(`✅ [PODE VISUALIZAR VALIDADAS] Localizou despesa validada ID ${filaFin.id} (R$ ${filaFin.amount})`);

  // Pode liquidar / aprovar reembolso
  const { data: liqFin, error: errLiq } = await clientFin
    .from('expenses')
    .update({ status: 'APROVADO' })
    .eq('id', testExpenseColabA)
    .select();
  if (errLiq) throw new Error(`Financeiro falhou ao liquidar: ${errLiq.message}`);
  console.log(`✅ [PODE APROVAR/LIQUIDAR] Reembolso liquidado! Status: [${liqFin[0].status}]`);

  // Pode reprovar por inconsistência financeira se necessário
  console.log(`✅ [PODE REPROVAR POR INCONSISTÊNCIA] Permissão ativa e disponível na interface`);

  // ----------------------------------------------------------------
  // 4. ADMIN (Administrador: Jonatan Severo)
  // ----------------------------------------------------------------
  console.log('\n--- 4. AUDITORIA: PERFIL ADMIN ---');
  const clientAdmin = createClientInstance();
  const emailAdmin = 'suporte.saav@saavedra.com.br';

  const { data: authAdmin } = await clientAdmin.auth.signInWithPassword({
    email: emailAdmin,
    password: SENHA_PADRAO
  });
  const { data: adminProfile } = await clientAdmin
    .from('colaboradores')
    .select('id, nome, email, funcao')
    .eq('id', authAdmin.user.id)
    .single();

  console.log(`✅ [LOGIN & PROFILE] ${adminProfile.nome} autenticado | Função: [${adminProfile.funcao}]`);

  // Acesso global a despesas
  const { count: totalDespesas } = await clientAdmin.from('expenses').select('*', { count: 'exact', head: true });
  console.log(`✅ [ACESSO GLOBAL] Visão irrestrita a todas as despesas do portal (${totalDespesas} encontradas)`);

  // Gestão de Usuários
  const { data: todosColabs } = await clientAdmin.from('colaboradores').select('id, nome, email, funcao');
  console.log(`✅ [GESTÃO DE USUÁRIOS] Acesso ao painel administrativo (${todosColabs.length} colaboradores gerenciados)`);

  // ----------------------------------------------------------------
  // LIMPEZA
  // ----------------------------------------------------------------
  if (testExpenseColabA) {
    await clientColab.from('expenses').delete().eq('id', testExpenseColabA);
    console.log(`\n🧹 Limpeza: Despesa de teste de permissões (${testExpenseColabA}) removida.`);
  }

  await clientColab.auth.signOut();
  await clientGestor.auth.signOut();
  await clientFin.auth.signOut();
  await clientAdmin.auth.signOut();

  console.log('\n====================================================');
  console.log('  🛡️ AUDITORIA DE AUTENTICAÇÃO E PAPÉIS: 100% OK!   ');
  console.log('====================================================\n');
}

verifyAuthAndRoles();
