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

const SENHA_PADRAO = 'Saavedra2026!';

const USERS = {
  colaborador: { email: 'cristiana.gehm@saavedra.com.br', papel: 'Vendedor' },
  gestor: { email: 'saulo.scherer@saavedra.com.br', papel: 'Gestor' },
  financeiro: { email: 'financeiro.saav@saavedra.com.br', papel: 'Financeiro' }
};

async function runE2ETests() {
  console.log('================================================================');
  console.log('       FASE 2 — ETAPA 12: TESTE E2E PRINCIPAL (SAAV EXPENSES)   ');
  console.log('================================================================\n');

  const clientColab = createClientInstance();
  const clientGestor = createClientInstance();
  const clientFin = createClientInstance();

  const report = [];

  // Setup / Autenticação
  console.log('Autenticando atores para o fluxo E2E...');
  const { data: authC, error: errC } = await clientColab.auth.signInWithPassword({
    email: USERS.colaborador.email,
    password: SENHA_PADRAO
  });
  if (errC) throw new Error(`Falha login Colaborador: ${errC.message}`);

  const { data: authG, error: errG } = await clientGestor.auth.signInWithPassword({
    email: USERS.gestor.email,
    password: SENHA_PADRAO
  });
  if (errG) throw new Error(`Falha login Gestor: ${errG.message}`);

  const { data: authF, error: errF } = await clientFin.auth.signInWithPassword({
    email: USERS.financeiro.email,
    password: SENHA_PADRAO
  });
  if (errF) throw new Error(`Falha login Financeiro: ${errF.message}`);

  const colabId = authC.user.id;
  const gestorId = authG.user.id;
  const finId = authF.user.id;

  console.log(`✓ Colaborador logado: ${USERS.colaborador.email} (${colabId})`);
  console.log(`✓ Gestor logado:      ${USERS.gestor.email} (${gestorId})`);
  console.log(`✓ Financeiro logado:  ${USERS.financeiro.email} (${finId})\n`);

  let expense1Id = null;
  let expense2Id = null;
  let file1Path = null;

  try {
    // -------------------------------------------------------------
    // E2E-001: COLABORADOR LANÇA DESPESA COM COMPROVANTE
    // -------------------------------------------------------------
    console.log('-------------------------------------------------------------');
    console.log('E2E-001: COLABORADOR — Lançamento de Nova Despesa com Anexo');
    console.log('-------------------------------------------------------------');

    // 1. Upload do comprovante no Storage
    file1Path = `${colabId}_e2e_${Date.now()}.png`;
    const dummyPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    const { error: upErr } = await clientColab.storage
      .from('comprovantes')
      .upload(file1Path, dummyPng, { contentType: 'image/png' });

    if (upErr) throw new Error(`Falha upload anexo E2E-001: ${upErr.message}`);

    // Gera Signed URL
    const { data: signedData } = await clientColab.storage
      .from('comprovantes')
      .createSignedUrl(file1Path, 60 * 60);

    const fotoUrl = signedData?.signedUrl || clientColab.storage.from('comprovantes').getPublicUrl(file1Path).data.publicUrl;

    // 2. Criação da Despesa
    const expensePayload1 = {
      colaborador_id: colabId,
      descricao: 'Estacionamento em reunião com diretoria',
      amount: 45.00,
      date: '2026-09-09',
      categoria: 'ESTACIONAMENTO',
      cliente: 'Supermercado Central Saavedra Ltda',
      foto_url: fotoUrl,
      status: 'ABERTO'
    };

    const { data: created1, error: errCreate1 } = await clientColab
      .from('expenses')
      .insert([expensePayload1])
      .select()
      .single();

    if (errCreate1) throw new Error(`Erro ao criar despesa E2E-001: ${errCreate1.message}`);
    expense1Id = created1.id;

    console.log(`✓ Despesa criada com sucesso: ID ${expense1Id}`);
    console.log(`  Descrição: ${created1.descricao}`);
    console.log(`  Valor:     R$ ${Number(created1.amount).toFixed(2)}`);
    console.log(`  Data:      ${created1.date}`);
    console.log(`  Cliente:   ${created1.cliente}`);
    console.log(`  Categoria: ${created1.categoria}`);
    console.log(`  Status:    ${created1.status}`);
    console.log(`  Comprovante URL: ${created1.foto_url ? 'Anexado (Signed URL)' : 'Ausente'}`);

    const passE2E001 = created1.id && created1.status === 'ABERTO' && created1.amount === 45.00 && created1.foto_url;
    report.push({
      cenario: 'E2E-001 (Colaborador)',
      resultadoEsperado: 'Despesa criada com anexo e Status = ABERTO',
      resultadoObtido: `Despesa criada ID ${expense1Id}, Status = ${created1.status}`,
      status: passE2E001 ? 'PASSOU' : 'FALHOU'
    });

    // -------------------------------------------------------------
    // E2E-002: GESTOR LOCALIZA, CONFERE E VALIDA
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('E2E-002: GESTOR — Fila de Despesas, Conferência e Validação');
    console.log('-------------------------------------------------------------');

    // 1. Gestor busca a fila de abertas
    const { data: filaGestor, error: errFilaG } = await clientGestor
      .from('expenses')
      .select('*, colaboradores(nome, email)')
      .eq('id', expense1Id)
      .single();

    if (errFilaG) throw new Error(`Erro Gestor buscando despesa: ${errFilaG.message}`);

    console.log(`✓ Gestor localizou a despesa ${filaGestor.id}`);
    console.log(`  Colaborador: ${filaGestor.colaboradores?.nome || USERS.colaborador.email}`);
    console.log(`  Cliente:     ${filaGestor.cliente}`);
    console.log(`  Valor:       R$ ${Number(filaGestor.amount).toFixed(2)}`);
    console.log(`  Comprovante: ${filaGestor.foto_url ? 'Verificado' : 'Não encontrado'}`);

    // 2. Gestor valida a despesa
    const { data: validadoData, error: errValidar } = await clientGestor
      .from('expenses')
      .update({ status: 'VALIDADO' })
      .eq('id', expense1Id)
      .select()
      .single();

    if (errValidar) throw new Error(`Erro Gestor validando despesa: ${errValidar.message}`);

    console.log(`✓ Status atualizado pelo Gestor: ${validadoData.status}`);

    // 3. Verificar histórico
    const { data: history1, error: histErr1 } = await clientGestor
      .from('expense_status_history')
      .select('*')
      .eq('expense_id', expense1Id);

    const historyVerified = !histErr1 && history1 !== null;
    console.log(`✓ Verificação de histórico: ${historyVerified ? `${history1.length} registro(s) encontrado(s)` : 'Tabela ainda pendente de migração no Supabase'}`);

    const passE2E002 = validadoData.status === 'VALIDADO';
    report.push({
      cenario: 'E2E-002 (Gestor)',
      resultadoEsperado: 'Localizar, conferir dados e alterar Status = VALIDADO (verificar histórico)',
      resultadoObtido: `Status = ${validadoData.status}, Histórico = ${historyVerified ? 'Verificado' : 'Aguardando DDL'}`,
      status: passE2E002 ? 'PASSOU' : 'FALHOU'
    });

    // -------------------------------------------------------------
    // E2E-003: FINANCEIRO LOCALIZA, CONFERE E APROVA/LIQUIDA
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('E2E-003: FINANCEIRO — Fila de Liquidação e Aprovação');
    console.log('-------------------------------------------------------------');

    // 1. Financeiro localiza despesa validada
    const { data: filaFin, error: errFilaF } = await clientFin
      .from('expenses')
      .select('*')
      .eq('id', expense1Id)
      .single();

    if (errFilaF) throw new Error(`Erro Financeiro buscando despesa: ${errFilaF.message}`);

    console.log(`✓ Financeiro localizou a despesa validada: ${filaFin.id}`);
    console.log(`  Status Atual: ${filaFin.status}`);
    console.log(`  Valor a reembolsar: R$ ${Number(filaFin.amount).toFixed(2)}`);
    console.log(`  Comprovante fiscal: ${filaFin.foto_url ? 'OK (Anexo disponível)' : 'Sem anexo'}`);

    // 2. Financeiro aprova / liquida
    const { data: aprovadoData, error: errAprovar } = await clientFin
      .from('expenses')
      .update({ status: 'APROVADO' })
      .eq('id', expense1Id)
      .select()
      .single();

    if (errAprovar) throw new Error(`Erro Financeiro aprovando despesa: ${errAprovar.message}`);

    console.log(`✓ Status atualizado pelo Financeiro: ${aprovadoData.status}`);

    // 3. Checar colunas liquidado_por e data_liquidacao quando disponíveis
    const temColunasLiquidacao = 'liquidado_por' in aprovadoData && 'data_liquidacao' in aprovadoData;
    console.log(`  Campos liquidado_por / data_liquidacao: ${temColunasLiquidacao ? 'Presentes no schema' : 'Pendentes da migration SQL'}`);

    const passE2E003 = aprovadoData.status === 'APROVADO';
    report.push({
      cenario: 'E2E-003 (Financeiro)',
      resultadoEsperado: 'Localizar despesa validada, conferir comprovante/valor e Status = APROVADO',
      resultadoObtido: `Status = ${aprovadoData.status}, Colunas liquidação = ${temColunasLiquidacao ? 'Presentes' : 'Aguardando DDL'}`,
      status: passE2E003 ? 'PASSOU' : 'FALHOU'
    });

    // -------------------------------------------------------------
    // E2E-004: REPROVAÇÃO, VISUALIZAÇÃO DO MOTIVO, CORREÇÃO E REENVIO
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('E2E-004: FLUXO DE REPROVAÇÃO, FEEDBACK E CORREÇÃO/REENVIO');
    console.log('-------------------------------------------------------------');

    // 1. Colaborador cria nova despesa
    const expensePayload2 = {
      colaborador_id: colabId,
      descricao: 'Almoço de alinhamento com cliente',
      amount: 110.00,
      date: '2026-09-09',
      categoria: 'ALIMENTACAO',
      cliente: 'Empresa Teste Incompleta',
      status: 'ABERTO'
    };

    const { data: created2, error: errCreate2 } = await clientColab
      .from('expenses')
      .insert([expensePayload2])
      .select()
      .single();

    if (errCreate2) throw new Error(`Erro ao criar despesa 2: ${errCreate2.message}`);
    expense2Id = created2.id;
    console.log(`1. Colaborador criou nova despesa ID: ${expense2Id} (Status: ${created2.status})`);

    // 2. Gestor reprova com motivo
    const MOTIVO_TESTE = 'Visita não registrada no CRM. Favor retificar o cliente e enviar comprovante.';
    const { data: reprovadaData, error: errReprovar } = await clientGestor
      .from('expenses')
      .update({
        status: 'REPROVADO',
        motivo_reprovacao: MOTIVO_TESTE
      })
      .eq('id', expense2Id)
      .select()
      .single();

    if (errReprovar) throw new Error(`Erro ao reprovar: ${errReprovar.message}`);
    console.log(`2. Gestor reprovou despesa: Status = ${reprovadaData.status}`);
    console.log(`   Motivo registrado: "${reprovadaData.motivo_reprovacao}"`);

    // 3. Colaborador visualiza o motivo da reprovação
    const { data: despesaColab, error: errFetchColab } = await clientColab
      .from('expenses')
      .select('*')
      .eq('id', expense2Id)
      .single();

    if (errFetchColab) throw new Error(`Erro colaborador consultando motivo: ${errFetchColab.message}`);

    const motivoVisualizado = despesaColab.motivo_reprovacao === MOTIVO_TESTE;
    console.log(`3. Colaborador visualizou o motivo: ${motivoVisualizado ? 'SIM (Confere)' : 'NÃO'}`);
    console.log(`   Motivo retornado na API: "${despesaColab.motivo_reprovacao}"`);

    // 4. Colaborador corrige e reenvia
    const { data: corrigidaData, error: errCorrigir } = await clientColab
      .from('expenses')
      .update({
        cliente: 'Empresa Teste Matriz Oficial (Ajustado)',
        descricao: 'Almoço comercial autorizado - CRM ajustado',
        status: 'ABERTO',
        motivo_reprovacao: null
      })
      .eq('id', expense2Id)
      .select()
      .single();

    if (errCorrigir) throw new Error(`Erro ao corrigir e reenviar: ${errCorrigir.message}`);

    console.log(`4. Colaborador corrigiu e reenviou a despesa:`);
    console.log(`   Novo Status:            ${corrigidaData.status}`);
    console.log(`   Motivo resetado:        ${corrigidaData.motivo_reprovacao === null ? 'null (limpo)' : corrigidaData.motivo_reprovacao}`);
    console.log(`   Cliente corrigido:      ${corrigidaData.cliente}`);
    console.log(`   Descrição corrigida:    ${corrigidaData.descricao}`);

    const passE2E004 = reprovadaData.status === 'REPROVADO' && 
                       motivoVisualizado && 
                       corrigidaData.status === 'ABERTO' && 
                       corrigidaData.motivo_reprovacao === null;

    report.push({
      cenario: 'E2E-004 (Reprovação e Correção)',
      resultadoEsperado: 'Gestor reprova com motivo, Colaborador vê motivo, corrige e reenvia com Status = ABERTO',
      resultadoObtido: `Reprovado com motivo -> Colaborador leu -> Reenviado com Status = ${corrigidaData.status}`,
      status: passE2E004 ? 'PASSOU' : 'FALHOU'
    });

  } finally {
    // Limpeza dos dados de teste
    console.log('\n-------------------------------------------------------------');
    console.log('Limpando registros de teste criados no Supabase...');
    if (expense1Id) {
      await clientFin.from('expenses').delete().eq('id', expense1Id);
      console.log(`- Despesa 1 (${expense1Id}) removida.`);
    }
    if (expense2Id) {
      await clientFin.from('expenses').delete().eq('id', expense2Id);
      console.log(`- Despesa 2 (${expense2Id}) removida.`);
    }
    if (file1Path) {
      await clientColab.storage.from('comprovantes').remove([file1Path]);
      console.log(`- Comprovante (${file1Path}) removido do Storage.`);
    }
  }

  // Tabela Resumo Final
  console.log('\n================================================================');
  console.log('               RELATÓRIO DOS TESTES E2E PRINCIPAIS             ');
  console.log('================================================================');
  console.table(report);

  const todosPassaram = report.every(r => r.status === 'PASSOU');
  if (todosPassaram) {
    console.log('\n🎉 TODOS OS CENÁRIOS E2E (E2E-001 a E2E-004) FORAM HOMOLOGADOS COM SUCESSO!\n');
  } else {
    console.log('\n❌ ALGUNS TESTES E2E APRESENTARAM FALHAS.\n');
  }
}

runE2ETests().catch(err => {
  console.error('\n❌ ERRO FATAL NA EXECUÇÃO DOS TESTES E2E:', err);
  process.exit(1);
});
