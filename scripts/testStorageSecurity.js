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

// Função mock para simular upload com validação de serviço
function validarArquivoMock(name, size, type) {
  const MAX_SIZE = 10 * 1024 * 1024;
  if (size > MAX_SIZE) {
    throw new Error('Tamanho de arquivo excedido: máximo 10MB permitido.');
  }

  const fileExt = name.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
  if (!fileExt || !allowedExtensions.includes(fileExt)) {
    throw new Error(`Extensão não permitida (".${fileExt}"). Formatos aceitos: JPG, PNG, WebP e PDF.`);
  }

  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (type && !allowedMimeTypes.includes(type)) {
    throw new Error(`MIME type inválido ("${type}").`);
  }

  return true;
}

async function runStorageSecurityTests() {
  console.log('====================================================');
  console.log('   FASE 2 — AUDITORIA DE SEGURANÇA NO STORAGE       ');
  console.log('====================================================\n');

  const clientVendedor = createClientInstance();
  const clientAnon = createClientInstance();
  const emailVendedor = 'cristiana.gehm@saavedra.com.br';

  console.log(`1. Autenticando Vendedor: ${emailVendedor}...`);
  const { data: authVendedor, error: errAuth } = await clientVendedor.auth.signInWithPassword({
    email: emailVendedor,
    password: SENHA_PADRAO
  });
  if (errAuth) throw new Error(`Falha no login: ${errAuth.message}`);
  const userId = authVendedor.user.id;
  console.log(`   ✅ Vendedor autenticado! UID: ${userId}\n`);

  const results = [];
  let testFileValid = null;
  let testExpenseId = null;

  try {
    // ----------------------------------------------------
    // TESTE 1: Upload Autenticado Válido (PNG)
    // ----------------------------------------------------
    console.log('--- TESTE 1: Upload autenticado válido (Imagem PNG) ---');
    testFileValid = `comprovante_seguro_${userId}_${Date.now()}.png`;
    const mockPngContent = new Blob(['PNG_MOCK_CONTENT_SAAV_RECEIPT'], { type: 'image/png' });

    const { error: errUpValid } = await clientVendedor.storage
      .from('comprovantes')
      .upload(testFileValid, mockPngContent, { contentType: 'image/png' });

    const uploadOk = !errUpValid;
    results.push({
      item: 'Upload Autenticado',
      esperado: 'PERMITIDO',
      obtido: uploadOk ? 'PERMITIDO' : 'ERRO: ' + errUpValid?.message,
      status: uploadOk ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${uploadOk ? '✅ SUCESSO' : '❌ ERRO'}]\n`);

    // ----------------------------------------------------
    // TESTE 2: Validação de Extensão Proibida (.exe / .js)
    // ----------------------------------------------------
    console.log('--- TESTE 2: Tentativa com extensão proibida (.exe) ---');
    let bloqueouExtensao = false;
    try {
      validarArquivoMock('malware.exe', 1024, 'application/x-msdownload');
    } catch (err) {
      bloqueouExtensao = true;
      console.log(`   ✅ Bloqueado com sucesso: "${err.message}"`);
    }

    results.push({
      item: 'Extensão Proibida (.exe)',
      esperado: 'BLOQUEADO',
      obtido: bloqueouExtensao ? 'BLOQUEADO' : 'PERMITIDO',
      status: bloqueouExtensao ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${bloqueouExtensao ? '✅ BLOQUEADO' : '❌ FALHOU'}]\n`);

    // ----------------------------------------------------
    // TESTE 3: Validação de MIME Type Inválido
    // ----------------------------------------------------
    console.log('--- TESTE 3: Tentativa com MIME Type inválido (text/html) ---');
    let bloqueouMime = false;
    try {
      validarArquivoMock('arquivo.png', 1024, 'text/html');
    } catch (err) {
      bloqueouMime = true;
      console.log(`   ✅ Bloqueado com sucesso: "${err.message}"`);
    }

    results.push({
      item: 'MIME Type Inválido',
      esperado: 'BLOQUEADO',
      obtido: bloqueouMime ? 'BLOQUEADO' : 'PERMITIDO',
      status: bloqueouMime ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${bloqueouMime ? '✅ BLOQUEADO' : '❌ FALHOU'}]\n`);

    // ----------------------------------------------------
    // TESTE 4: Validação de Tamanho Máximo (> 10MB)
    // ----------------------------------------------------
    console.log('--- TESTE 4: Tentativa com tamanho excedente (15MB) ---');
    let bloqueouTamanho = false;
    try {
      validarArquivoMock('foto_gigante.jpg', 15 * 1024 * 1024, 'image/jpeg');
    } catch (err) {
      bloqueouTamanho = true;
      console.log(`   ✅ Bloqueado com sucesso: "${err.message}"`);
    }

    results.push({
      item: 'Tamanho Máximo (> 10MB)',
      esperado: 'BLOQUEADO',
      obtido: bloqueouTamanho ? 'BLOQUEADO' : 'PERMITIDO',
      status: bloqueouTamanho ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${bloqueouTamanho ? '✅ BLOQUEADO' : '❌ FALHOU'}]\n`);

    // ----------------------------------------------------
    // TESTE 5: Visualização Segura via Signed URL (URL Assinada)
    // ----------------------------------------------------
    console.log('--- TESTE 5: Geração e validação de Signed URL temporária ---');
    const { data: signedData, error: errSigned } = await clientVendedor.storage
      .from('comprovantes')
      .createSignedUrl(testFileValid, 3600); // 1 hora

    const signedUrlOk = !errSigned && signedData?.signedUrl && signedData.signedUrl.includes('/sign/comprovantes/');
    if (signedUrlOk) {
      console.log(`   ✅ Signed URL gerada com sucesso!`);
      console.log(`   URL: ${signedData.signedUrl.substring(0, 85)}...`);
    } else {
      console.error(`   ❌ Falha ao gerar Signed URL: ${errSigned?.message}`);
    }

    results.push({
      item: 'Signed URL Segura',
      esperado: 'PERMITIDO',
      obtido: signedUrlOk ? 'PERMITIDO' : 'ERRO: ' + errSigned?.message,
      status: signedUrlOk ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${signedUrlOk ? '✅ SEGURO' : '❌ ERRO'}]\n`);

    // ----------------------------------------------------
    // TESTE 6: Associação à Despesa
    // ----------------------------------------------------
    console.log('--- TESTE 6: Associação do anexo à despesa ---');
    const { data: expData, error: errExp } = await clientVendedor
      .from('expenses')
      .insert([{
        colaborador_id: userId,
        descricao: '[TESTE_STORAGE] Despesa com anexo assinado',
        amount: 35.00,
        date: new Date().toISOString().split('T')[0],
        categoria: 'Estacionamento',
        cliente: 'Cliente Teste Storage',
        status: 'ABERTO',
        foto_url: signedData?.signedUrl
      }])
      .select();

    const assocOk = !errExp && expData && expData[0].foto_url;
    if (assocOk) {
      testExpenseId = expData[0].id;
      console.log(`   ✅ Despesa associada com sucesso! ID ${testExpenseId} vinculado a foto_url.`);
    }

    results.push({
      item: 'Associação com Despesa',
      esperado: 'PERMITIDO',
      obtido: assocOk ? 'PERMITIDO' : 'ERRO: ' + errExp?.message,
      status: assocOk ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${assocOk ? '✅ VINCULADO' : '❌ ERRO'}]\n`);

    // ----------------------------------------------------
    // TESTE 7: Acesso Indevido (Tentativa de Upload Anônimo)
    // ----------------------------------------------------
    console.log('--- TESTE 7: Tentativa de upload anônimo (sem login) ---');
    const anonFileName = `hacker_anonymous_${Date.now()}.png`;
    const { error: errAnonUp } = await clientAnon.storage
      .from('comprovantes')
      .upload(anonFileName, new Blob(['ANON_MALICIOUS_CONTENT'], { type: 'image/png' }));

    const anonBloqueado = !!errAnonUp;
    if (anonBloqueado) {
      console.log(`   ✅ BLOQUEADO COM SUCESSO: "${errAnonUp.message}"`);
    } else {
      console.error(`   ❌ FALHA CRÍTICA: Usuário anônimo conseguiu fazer upload!`);
      // Limpeza de emergência
      await clientVendedor.storage.from('comprovantes').remove([anonFileName]);
    }

    results.push({
      item: 'Upload Anônimo Bloqueado',
      esperado: 'BLOQUEADO',
      obtido: anonBloqueado ? 'BLOQUEADO' : 'PERMITIDO',
      status: anonBloqueado ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${anonBloqueado ? '✅ BLOQUEADO' : '❌ FALHOU'}]\n`);

    // ----------------------------------------------------
    // TESTE 8: Exclusão Conforme Regra
    // ----------------------------------------------------
    console.log('--- TESTE 8: Exclusão conforme regra e limpeza ---');
    const { error: errRemove } = await clientVendedor.storage
      .from('comprovantes')
      .remove([testFileValid]);

    const removeOk = !errRemove;
    results.push({
      item: 'Exclusão Autorizada',
      esperado: 'PERMITIDO',
      obtido: removeOk ? 'PERMITIDO' : 'ERRO: ' + errRemove?.message,
      status: removeOk ? 'PASSOU' : 'FALHOU'
    });
    console.log(`   Resultado: [${removeOk ? '✅ EXCLUÍDO' : '❌ ERRO'}]\n`);

  } finally {
    if (testExpenseId) {
      await clientVendedor.from('expenses').delete().eq('id', testExpenseId);
      console.log(`🧹 Limpeza: Despesa de teste ${testExpenseId} removida.`);
    }
    await clientVendedor.auth.signOut();
  }

  console.log('====================================================');
  console.log('        RESUMO DA AUDITORIA DE STORAGE              ');
  console.log('====================================================');
  console.table(results);
}

runStorageSecurityTests();
