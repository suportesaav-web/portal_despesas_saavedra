import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Carrega as variáveis do .env na raiz do projeto
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("ERRO: Certifique-se de ter SUPABASE_SERVICE_ROLE_KEY no seu .env");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const usuarios = [
  // Supervisores (Kyanne)
  { email: 'comercial.saav@saavedra.com.br', nome: 'Kyanne Reis', funcao: 'Kyanne' },
  { email: 'saulo.scherer@saavedra.com.br', nome: 'Saulo Scherer', funcao: 'Kyanne' },
  
  // Financeiro
  { email: 'financeiro.saav@saavedra.com.br', nome: 'Fernando Szklarczyk', funcao: 'Financeiro' },
  { email: 'katia.ribeiro@saavedra.com.br', nome: 'Kátia Ribeiro', funcao: 'Financeiro' },
  { email: 'financeiro2.saav@saavedra.com.br', nome: 'Marcos Silva', funcao: 'Financeiro' },
  
  // Vendedores
  { email: 'cristiana.gehm@saavedra.com.br', nome: 'Cristiana Gehm', funcao: 'Vendedor' },
  { email: 'fernando.bomfoco@saavedra.com.br', nome: 'Fernando Bomfoco', funcao: 'Vendedor' },
  { email: 'mariana.arrieche@saavedra.com.br', nome: 'Mariana Arrieche', funcao: 'Vendedor' },
  { email: 'miria.kruno@saavedra.com.br', nome: 'Miriã Kruno', funcao: 'Vendedor' },
  { email: 'priscila.scherer@saavedra.com.br', nome: 'Priscila Scherer', funcao: 'Vendedor' },
  
  // Admin
  { email: 'suporte.saav@saavedra.com.br', nome: 'Jonatan Severo', funcao: 'Admin' },
  { email: 'ti@saavedra.com.br', nome: 'Juliano Moraes', funcao: 'Admin' }
];

async function criarUsuarios() {
  console.log("Iniciando criação em lote de usuários...\n");
  const senhaPadrao = 'saavedra123'; // Senha padrão temporária

  for (const u of usuarios) {
    try {
      // 1. Cria a conta de autenticação
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: senhaPadrao,
        email_confirm: true // Pula a verificação de e-mail
      });

      if (authError) {
        console.error(`❌ Erro ao criar Auth para ${u.email}:`, authError.message);
        continue;
      }

      const uid = authData.user.id;

      // 2. Cria o perfil na tabela colaboradores
      const { error: dbError } = await supabaseAdmin
        .from('colaboradores')
        .insert([{
          id: uid,
          email: u.email,
          nome: u.nome,
          funcao: u.funcao
        }]);

      if (dbError) {
        console.error(`❌ Erro ao salvar Perfil para ${u.email}:`, dbError.message);
      } else {
        console.log(`✅ Sucesso: ${u.nome} (${u.funcao}) criado com sucesso!`);
      }

    } catch (e) {
      console.error(`❌ Exceção ao processar ${u.email}:`, e);
    }
  }
  console.log("\nProcesso finalizado!");
}

criarUsuarios();
