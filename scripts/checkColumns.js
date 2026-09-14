import * as dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const columnsToTest = [
  'id', 'colaborador_id', 'descricao', 'amount', 'date', 'categoria', 
  'cliente', 'status', 'foto_url', 'motivo_reprovacao',
  'hora', 'categoria_codigo', 'categoria_grupo', 'validado_por', 'liquidado_por'
];

async function run() {
  console.log('Verificando colunas na tabela expenses...');
  for (const col of columnsToTest) {
    const { data, error } = await supabase.from('expenses').select(col).limit(1);
    if (error) {
      console.log(`Column ${col}: NÃO EXISTE (${error.message})`);
    } else {
      console.log(`Column ${col}: OK`);
    }
  }
}

run();
