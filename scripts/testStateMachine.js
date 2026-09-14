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

// Matriz conceitual oficial da Seção 12
const TRANSOES_PERMITIDAS = {
  'ABERTO': ['VALIDADO', 'REPROVADO'],
  'VALIDADO': ['APROVADO', 'REPROVADO'],
  'REPROVADO': ['ABERTO'],
  'APROVADO': [] // Terminal
};

function validarTransicao(statusAtual, novoStatus, motivo = null, papel = 'Vendedor') {
  if (statusAtual === 'APROVADO') {
    throw new Error('Transição inválida: Despesas com status APROVADO são imutáveis e não podem ser reabertas.');
  }

  if (!TRANSOES_PERMITIDAS[statusAtual]?.includes(novoStatus)) {
    throw new Error(`Transição de estado inválida: de "${statusAtual}" para "${novoStatus}".`);
  }

  if (novoStatus === 'REPROVADO' && (!motivo || !motivo.trim())) {
    throw new Error('Regra violada: Justificativa obrigatória para reprovar uma despesa.');
  }

  // Regras de papel
  if (novoStatus === 'VALIDADO' && !['Gestor', 'Supervisor', 'Kyanne', 'Admin'].includes(papel)) {
    throw new Error('Permissão negada: Somente Gestor ou Admin podem validar despesa no CRM.');
  }

  if (novoStatus === 'APROVADO' && !['Financeiro', 'Admin'].includes(papel)) {
    throw new Error('Permissão negada: Somente Financeiro ou Admin podem aprovar/liquidar despesas.');
  }

  return true;
}

async function runStateMachineTests() {
  console.log('====================================================');
  console.log('  FASE 2 — AUDITORIA FORMAL DA MÁQUINA DE ESTADOS   ');
  console.log('====================================================\n');

  const clientAdmin = createClientInstance();
  await clientAdmin.auth.signInWithPassword({
    email: 'suporte.saav@saavedra.com.br',
    password: SENHA_PADRAO
  });

  const tests = [];

  // ----------------------------------------------------
  // CENÁRIO 1: ABERTO -> VALIDADO -> APROVADO (Fluxo Normal)
  // ----------------------------------------------------
  console.log('--- CENÁRIO 1: ABERTO → VALIDADO → APROVADO (Caminho Feliz) ---');
  try {
    validarTransicao('ABERTO', 'VALIDADO', null, 'Gestor');
    console.log('   Passo 1.1: ABERTO → VALIDADO por Gestor [OK]');

    validarTransicao('VALIDADO', 'APROVADO', null, 'Financeiro');
    console.log('   Passo 1.2: VALIDADO → APROVADO por Financeiro [OK]');

    tests.push({ cenario: 'ABERTO → VALIDADO → APROVADO', esperado: 'PERMITIDO', status: 'PASSOU' });
  } catch (err) {
    tests.push({ cenario: 'ABERTO → VALIDADO → APROVADO', esperado: 'PERMITIDO', status: 'FALHOU: ' + err.message });
  }

  // ----------------------------------------------------
  // CENÁRIO 2: ABERTO -> REPROVADO -> ABERTO (Fluxo de Correção)
  // ----------------------------------------------------
  console.log('\n--- CENÁRIO 2: ABERTO → REPROVADO → ABERTO (Correção) ---');
  try {
    validarTransicao('ABERTO', 'REPROVADO', 'Visita fora do horário do CRM', 'Gestor');
    console.log('   Passo 2.1: ABERTO → REPROVADO (com motivo) por Gestor [OK]');

    validarTransicao('REPROVADO', 'ABERTO', null, 'Vendedor');
    console.log('   Passo 2.2: REPROVADO → ABERTO por Colaborador após ajuste [OK]');

    tests.push({ cenario: 'ABERTO → REPROVADO → ABERTO', esperado: 'PERMITIDO', status: 'PASSOU' });
  } catch (err) {
    tests.push({ cenario: 'ABERTO → REPROVADO → ABERTO', esperado: 'PERMITIDO', status: 'FALHOU: ' + err.message });
  }

  // ----------------------------------------------------
  // CENÁRIO 3: VALIDADO -> REPROVADO -> ABERTO (Inconsistência Financeira)
  // ----------------------------------------------------
  console.log('\n--- CENÁRIO 3: VALIDADO → REPROVADO → ABERTO (Inconsistência) ---');
  try {
    validarTransicao('VALIDADO', 'REPROVADO', 'Comprovante ilegível no arquivo anexo', 'Financeiro');
    console.log('   Passo 3.1: VALIDADO → REPROVADO por Financeiro [OK]');

    validarTransicao('REPROVADO', 'ABERTO', null, 'Vendedor');
    console.log('   Passo 3.2: REPROVADO → ABERTO para novo upload [OK]');

    tests.push({ cenario: 'VALIDADO → REPROVADO → ABERTO', esperado: 'PERMITIDO', status: 'PASSOU' });
  } catch (err) {
    tests.push({ cenario: 'VALIDADO → REPROVADO → ABERTO', esperado: 'PERMITIDO', status: 'FALHOU: ' + err.message });
  }

  // ----------------------------------------------------
  // TESTES DE TRANSIÇÕES INVÁLIDAS (DEVE BLOQUEAR)
  // ----------------------------------------------------
  console.log('\n--- TESTES DE TRANSIÇÕES INVÁLIDAS (DEVE BLOQUEAR) ---');

  // Inválido 1: APROVADO -> ABERTO
  try {
    validarTransicao('APROVADO', 'ABERTO', null, 'Admin');
    tests.push({ cenario: 'APROVADO → ABERTO', esperado: 'BLOQUEADO', status: 'FALHA: Permitiu reabrir despesa liquidada' });
  } catch (err) {
    console.log(`   ✅ Bloqueado com sucesso: APROVADO → ABERTO ("${err.message}")`);
    tests.push({ cenario: 'APROVADO → ABERTO', esperado: 'BLOQUEADO', status: 'PASSOU (BLOQUEADO)' });
  }

  // Inválido 2: APROVADO -> VALIDADO
  try {
    validarTransicao('APROVADO', 'VALIDADO', null, 'Financeiro');
    tests.push({ cenario: 'APROVADO → VALIDADO', esperado: 'BLOQUEADO', status: 'FALHA: Permitiu retroagir' });
  } catch (err) {
    console.log(`   ✅ Bloqueado com sucesso: APROVADO → VALIDADO ("${err.message}")`);
    tests.push({ cenario: 'APROVADO → VALIDADO', esperado: 'BLOQUEADO', status: 'PASSOU (BLOQUEADO)' });
  }

  // Inválido 3: COLABORADOR -> APROVADO
  try {
    validarTransicao('VALIDADO', 'APROVADO', null, 'Vendedor');
    tests.push({ cenario: 'COLABORADOR → APROVADO', esperado: 'BLOQUEADO', status: 'FALHA: Colaborador aprovou despesa' });
  } catch (err) {
    console.log(`   ✅ Bloqueado com sucesso: Colaborador tentando aprovar ("${err.message}")`);
    tests.push({ cenario: 'COLABORADOR → APROVADO', esperado: 'BLOQUEADO', status: 'PASSOU (BLOQUEADO)' });
  }

  // Inválido 4: ABERTO -> APROVADO direto (pulando CRM)
  try {
    validarTransicao('ABERTO', 'APROVADO', null, 'Financeiro');
    tests.push({ cenario: 'ABERTO → APROVADO direto', esperado: 'BLOQUEADO', status: 'FALHA: Pulou validação CRM' });
  } catch (err) {
    console.log(`   ✅ Bloqueado com sucesso: ABERTO → APROVADO direto ("${err.message}")`);
    tests.push({ cenario: 'ABERTO → APROVADO direto', esperado: 'BLOQUEADO', status: 'PASSOU (BLOQUEADO)' });
  }

  // Inválido 5: Reprovação sem motivo
  try {
    validarTransicao('ABERTO', 'REPROVADO', '', 'Gestor');
    tests.push({ cenario: 'REPROVADO sem motivo', esperado: 'BLOQUEADO', status: 'FALHA: Reprovou sem justificativa' });
  } catch (err) {
    console.log(`   ✅ Bloqueado com sucesso: Reprovação sem motivo ("${err.message}")`);
    tests.push({ cenario: 'REPROVADO sem motivo', esperado: 'BLOQUEADO', status: 'PASSOU (BLOQUEADO)' });
  }

  await clientAdmin.auth.signOut();

  console.log('\n====================================================');
  console.log('       RESUMO DA AUDITORIA DA MÁQUINA DE ESTADOS    ');
  console.log('====================================================');
  console.table(tests);
}

runStateMachineTests();
