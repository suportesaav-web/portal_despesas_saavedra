import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ERRO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados no .env");
  process.exit(1);
}

const SENHA_ATUAL = 'Saavedra2026!';
const NOVA_SENHA = 'saavedra123';

async function atualizarSenhas() {
  console.log(`====================================================`);
  console.log(` ATUALIZAÇÃO DE SENHA PARA: ${NOVA_SENHA}`);
  console.log(`====================================================\n`);

  // Cliente para ler a lista de colaboradores
  const clientPublic = createClient(supabaseUrl, supabaseAnonKey);

  const { data: colaboradores, error: dbError } = await clientPublic
    .from('colaboradores')
    .select('id, nome, email, funcao')
    .order('nome');

  if (dbError) {
    console.error("Erro ao listar colaboradores:", dbError.message);
    process.exit(1);
  }

  console.log(`Encontrados ${colaboradores.length} colaboradores.\nIniciando atualização de senhas...`);

  let sucessos = 0;
  let jaEstavam = 0;
  let falhas = 0;

  for (const c of colaboradores) {
    try {
      // Cria uma instância limpa de cliente Supabase para o usuário
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // 1. Tenta autenticar com a senha atual (Saavedra2026!)
      let { error: authError } = await userClient.auth.signInWithPassword({
        email: c.email,
        password: SENHA_ATUAL
      });

      // Se falhou, verifica se já estava com a nova senha
      if (authError) {
        const { error: testNovaError } = await userClient.auth.signInWithPassword({
          email: c.email,
          password: NOVA_SENHA
        });

        if (!testNovaError) {
          console.log(`ℹ️ [${c.funcao}] ${c.nome} (${c.email}) -> Já estava com a senha "${NOVA_SENHA}"`);
          jaEstavam++;
          continue;
        } else {
          console.error(`❌ Não foi possível autenticar ${c.email}: ${authError.message}`);
          falhas++;
          continue;
        }
      }

      // 2. Atualiza a senha para a nova senha
      const { error: updateError } = await userClient.auth.updateUser({
        password: NOVA_SENHA
      });

      if (updateError) {
        console.error(`❌ Erro ao atualizar senha de ${c.email}:`, updateError.message);
        falhas++;
      } else {
        console.log(`✅ [${c.funcao}] ${c.nome} (${c.email}) -> Atualizado com sucesso para "${NOVA_SENHA}"`);
        sucessos++;
      }

    } catch (err) {
      console.error(`❌ Exceção ao atualizar ${c.email}:`, err.message);
      falhas++;
    }
  }

  console.log(`\n----------------------------------------------------`);
  console.log(`Resultado: ${sucessos} alterados com sucesso, ${jaEstavam} já atualizados, ${falhas} falhas.`);

  // Validação final de login com um usuário
  console.log(`\nValidando login com novo padrão (saavedra123)...`);
  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data: testAuth, error: testError } = await verifyClient.auth.signInWithPassword({
    email: colaboradores[0].email,
    password: NOVA_SENHA
  });

  if (testError) {
    console.error(`❌ Teste de login falhou para ${colaboradores[0].email}:`, testError.message);
  } else {
    console.log(`🎉 Login 100% OK para ${testAuth.user.email} com a senha "${NOVA_SENHA}"!`);
  }
  console.log(`====================================================\n`);
}

atualizarSenhas();
