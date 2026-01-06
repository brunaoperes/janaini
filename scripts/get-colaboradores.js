const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('colaboradores')
    .select('id, nome')
    .order('nome');
  
  if (error) {
    console.error('Erro:', error);
    return;
  }
  
  console.log('Colaboradores:');
  data.forEach(c => console.log(`  ID ${c.id}: ${c.nome}`));
}

main();
