const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://owtupbpktcjgnekqjiso.supabase.co';
const supabaseKey = 'sb_publishable_TYA_Un3_h2pkIMbxfUMvQg_O6kY6H5o';

const supabase = createClient(supabaseUrl, supabaseKey);

// Ler os clientes extraídos
const clientesPath = path.join(__dirname, 'clientes-usalon.json');
const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));

async function importClients() {
  console.log(`Iniciando importação de ${clientes.length} clientes...`);
  console.log('');

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  // Buscar clientes existentes para evitar duplicação
  const { data: existingClients } = await supabase
    .from('clientes')
    .select('nome, telefone');

  const existingSet = new Set();
  if (existingClients) {
    existingClients.forEach(c => {
      existingSet.add(c.nome?.toLowerCase().trim());
      if (c.telefone) existingSet.add(c.telefone);
    });
  }
  console.log(`Clientes existentes no sistema: ${existingClients?.length || 0}`);
  console.log('');

  // Importar em lotes de 50
  const batchSize = 50;

  for (let i = 0; i < clientes.length; i += batchSize) {
    const batch = clientes.slice(i, i + batchSize);
    const toInsert = [];

    for (const cliente of batch) {
      // Verificar se já existe
      const nomeNormalizado = cliente.nome?.toLowerCase().trim();
      if (existingSet.has(nomeNormalizado) || (cliente.telefone && existingSet.has(cliente.telefone))) {
        skipped++;
        continue;
      }

      // Limpar e formatar dados
      let nome = cliente.nome?.trim() || 'Cliente sem nome';

      // Remover emojis e caracteres especiais do nome
      nome = nome.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '').trim();

      // Se nome ficou vazio após limpeza, usar original
      if (!nome) nome = cliente.nome?.trim() || 'Cliente sem nome';

      // Formatar telefone
      let telefone = cliente.telefone;
      if (telefone) {
        // Remover tudo que não é número
        telefone = telefone.replace(/\D/g, '');

        // Se começar com 55 e tiver mais de 11 dígitos (55 + DDD + número)
        if (telefone.startsWith('55') && telefone.length >= 12) {
          // Manter formato: 55 + DDD (2) + número (8-9)
          // Exemplo: 5517991234567
        } else if (telefone.length === 11) {
          // Adicionar 55 se tiver apenas DDD + número
          telefone = '55' + telefone;
        } else if (telefone.length === 10) {
          // Número antigo sem 9, adicionar 55
          telefone = '55' + telefone;
        }
      }

      toInsert.push({
        nome: nome,
        telefone: telefone || null,
        aniversario: null, // Deixar em branco para preencher depois
      });

      // Adicionar ao set para evitar duplicados no mesmo lote
      existingSet.add(nomeNormalizado);
      if (telefone) existingSet.add(telefone);
    }

    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from('clientes')
        .insert(toInsert)
        .select();

      if (error) {
        console.log(`Erro no lote ${Math.floor(i / batchSize) + 1}:`, error.message);
        errors += toInsert.length;
      } else {
        imported += data.length;
        console.log(`Lote ${Math.floor(i / batchSize) + 1}: ${data.length} clientes importados`);
      }
    }
  }

  console.log('');
  console.log('========================================');
  console.log(`Importação concluída!`);
  console.log(`- Importados: ${imported}`);
  console.log(`- Ignorados (duplicados): ${skipped}`);
  console.log(`- Erros: ${errors}`);
  console.log('========================================');
}

importClients().catch(console.error);
