const fs = require('fs');
const path = require('path');

// Ler os clientes extraídos
const clientesPath = path.join(__dirname, 'clientes-usalon.json');
const clientes = JSON.parse(fs.readFileSync(clientesPath, 'utf8'));

console.log(`Gerando SQL para ${clientes.length} clientes...`);

// Função para escapar strings SQL
function escapeSQL(str) {
  if (!str) return 'NULL';
  // Remover emojis
  str = str.replace(/[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{1F1E0}-\u{1F1FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu, '').trim();
  // Escapar aspas simples
  str = str.replace(/'/g, "''");
  return `'${str}'`;
}

// Função para formatar telefone
function formatarTelefone(telefone) {
  if (!telefone) return 'NULL';

  let numero = telefone.replace(/\D/g, '');

  // Se começar com 55 e tiver duplicado
  if (numero.startsWith('5555')) {
    numero = numero.substring(2);
  }

  // Se não começar com 55, adicionar
  if (!numero.startsWith('55') && numero.length >= 10) {
    numero = '55' + numero;
  }

  return `'${numero}'`;
}

// Gerar SQL
let sql = `-- Importação de clientes do USalon para Naví Belle
-- Total: ${clientes.length} clientes
-- Gerado em: ${new Date().toLocaleString('pt-BR')}

-- Desabilitar temporariamente RLS para importação
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- Inserir clientes
INSERT INTO clientes (nome, telefone, aniversario) VALUES
`;

const values = clientes.map(cliente => {
  const nome = escapeSQL(cliente.nome);
  const telefone = formatarTelefone(cliente.telefone);
  return `  (${nome}, ${telefone}, NULL)`;
});

sql += values.join(',\n');
sql += '\nON CONFLICT DO NOTHING;\n\n';

sql += `-- Reabilitar RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Verificar total importado
SELECT COUNT(*) as total_clientes FROM clientes;
`;

// Salvar arquivo SQL
const outputPath = path.join(__dirname, 'import-clientes-usalon.sql');
fs.writeFileSync(outputPath, sql, 'utf8');

console.log(`\n========================================`);
console.log(`Arquivo SQL gerado: ${outputPath}`);
console.log(`========================================`);
console.log(`\nPara importar:`);
console.log(`1. Acesse o Supabase Dashboard`);
console.log(`2. Vá em SQL Editor`);
console.log(`3. Cole o conteúdo do arquivo SQL`);
console.log(`4. Execute`);
