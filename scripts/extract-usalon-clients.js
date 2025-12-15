const fs = require('fs');
const path = require('path');

// Ler o arquivo HAR
const harPath = path.join(__dirname, '../../pro.usalon.app.har');
const harContent = fs.readFileSync(harPath, 'utf8');
const har = JSON.parse(harContent);

// Extrair todos os dados de clientes
const allClients = [];
const seenIds = new Set();

har.log.entries.forEach(entry => {
  // Verificar se é uma requisição de clientes
  if (entry.request.url.includes('/clientes?page=')) {
    const response = entry.response;

    if (response.content && response.content.text) {
      let jsonData;

      // Verificar se está em base64
      if (response.content.encoding === 'base64') {
        const decoded = Buffer.from(response.content.text, 'base64').toString('utf8');
        try {
          jsonData = JSON.parse(decoded);
        } catch (e) {
          console.log('Erro ao parsear:', e.message);
          return;
        }
      } else {
        try {
          jsonData = JSON.parse(response.content.text);
        } catch (e) {
          console.log('Erro ao parsear:', e.message);
          return;
        }
      }

      if (jsonData && jsonData.data) {
        console.log(`Página ${jsonData.page}: ${jsonData.data.length} clientes`);

        jsonData.data.forEach(cliente => {
          // Evitar duplicados
          if (!seenIds.has(cliente._id)) {
            seenIds.add(cliente._id);
            allClients.push({
              id_usalon: cliente._id,
              nome: cliente.nomecompleto || `${cliente.nome} ${cliente.sobrenome}`.trim(),
              telefone: cliente.celular ? formatarTelefone(cliente.celular, cliente.countryCode) : null,
              email: cliente.email || null,
              data_nascimento: cliente.dataNascimento || null,
              ultima_visita: cliente.datapresente || null,
              bloqueado: cliente.isblock || false,
              favorito: cliente.isfavoritos || false,
            });
          }
        });
      }
    }
  }
});

function formatarTelefone(telefone, countryCode) {
  // Remover caracteres não numéricos
  let numero = telefone.replace(/\D/g, '');

  // Se já começar com 55 e tiver mais de 11 dígitos, pode estar duplicado
  if (numero.startsWith('55') && numero.length > 13) {
    numero = numero.substring(2);
  }

  // Se não começar com 55, adicionar
  if (!numero.startsWith('55') && countryCode === '55') {
    numero = '55' + numero;
  }

  return numero;
}

console.log(`\n========================================`);
console.log(`Total de clientes únicos extraídos: ${allClients.length}`);
console.log(`========================================\n`);

// Salvar em um arquivo JSON
const outputPath = path.join(__dirname, 'clientes-usalon.json');
fs.writeFileSync(outputPath, JSON.stringify(allClients, null, 2), 'utf8');
console.log(`Dados salvos em: ${outputPath}`);

// Mostrar alguns exemplos
console.log('\nPrimeiros 5 clientes:');
allClients.slice(0, 5).forEach((c, i) => {
  console.log(`${i + 1}. ${c.nome} - Tel: ${c.telefone}`);
});
