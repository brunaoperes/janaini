import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { addDays, subDays, setHours, setMinutes, startOfDay } from 'date-fns';

// Carregar variáveis de ambiente
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Serviços disponíveis com valores típicos
const servicos = [
  { nome: 'Corte de Cabelo', valor: 80, duracao: 60 },
  { nome: 'Escova', valor: 60, duracao: 45 },
  { nome: 'Hidratação', valor: 120, duracao: 90 },
  { nome: 'Coloração', valor: 200, duracao: 120 },
  { nome: 'Progressiva', valor: 350, duracao: 180 },
  { nome: 'Luzes', valor: 250, duracao: 150 },
  { nome: 'Manicure', valor: 40, duracao: 45 },
  { nome: 'Pedicure', valor: 50, duracao: 60 },
  { nome: 'Sobrancelha', valor: 30, duracao: 30 },
  { nome: 'Maquiagem', valor: 150, duracao: 60 },
  { nome: 'Penteado', valor: 120, duracao: 90 },
  { nome: 'Depilação', valor: 80, duracao: 60 },
];

const formasPagamento = ['dinheiro', 'credito', 'debito', 'pix'];

// Função para gerar horário aleatório dentro do horário comercial
function gerarHorarioAleatorio(data: Date): Date {
  const hora = 9 + Math.floor(Math.random() * 11); // 9h às 19h
  const minuto = Math.random() < 0.5 ? 0 : 30; // :00 ou :30
  return setMinutes(setHours(data, hora), minuto);
}

// Função para calcular comissões
function calcularComissoes(valorTotal: number, porcentagemColaborador: number) {
  const comissaoColaborador = (valorTotal * porcentagemColaborador) / 100;
  const comissaoSalao = valorTotal - comissaoColaborador;
  return { comissaoColaborador, comissaoSalao };
}

async function seedLancamentos() {
  console.log('🌱 Iniciando seed de lançamentos...\n');

  // 1. Buscar colaboradores
  const { data: colaboradores, error: errorColab } = await supabase
    .from('colaboradores')
    .select('*');

  if (errorColab || !colaboradores || colaboradores.length === 0) {
    console.error('❌ Erro ao buscar colaboradores ou nenhum colaborador encontrado');
    console.log('💡 Execute o script supabase-setup.sql primeiro para criar os colaboradores');
    return;
  }

  console.log(`✅ Encontrados ${colaboradores.length} colaboradores`);

  // 2. Buscar clientes
  const { data: clientes, error: errorClientes } = await supabase
    .from('clientes')
    .select('*');

  if (errorClientes || !clientes || clientes.length === 0) {
    console.error('❌ Erro ao buscar clientes ou nenhum cliente encontrado');
    console.log('💡 Execute o script supabase-setup.sql primeiro para criar os clientes');
    return;
  }

  console.log(`✅ Encontrados ${clientes.length} clientes`);

  // 3. Verificar lançamentos existentes
  const { data: lancamentosExistentes, error: errorLanc } = await supabase
    .from('lancamentos')
    .select('id');

  if (errorLanc) {
    console.error('❌ Erro ao verificar lançamentos existentes:', errorLanc);
    return;
  }

  if (lancamentosExistentes && lancamentosExistentes.length > 0) {
    console.log(`\n⚠️  Já existem ${lancamentosExistentes.length} lançamentos no banco`);
    console.log('💡 Deseja criar mais dados? Execute o script novamente ou limpe a tabela primeiro');
    return;
  }

  console.log('✅ Nenhum lançamento encontrado, criando dados de teste...\n');

  // 4. Criar lançamentos dos últimos 30 dias
  const hoje = new Date();
  const lancamentos: any[] = [];
  const agendamentos: any[] = [];
  let totalLancamentos = 0;

  // Criar 3-5 lançamentos por dia nos últimos 30 dias
  for (let i = 30; i >= 0; i--) {
    const data = subDays(hoje, i);
    const numLancamentosDia = 3 + Math.floor(Math.random() * 3); // 3 a 5 por dia

    for (let j = 0; j < numLancamentosDia; j++) {
      const colaborador = colaboradores[Math.floor(Math.random() * colaboradores.length)];
      const cliente = clientes[Math.floor(Math.random() * clientes.length)];
      const servico = servicos[Math.floor(Math.random() * servicos.length)];
      const formaPagamento = formasPagamento[Math.floor(Math.random() * formasPagamento.length)];

      const dataHora = gerarHorarioAleatorio(data);
      const { comissaoColaborador, comissaoSalao } = calcularComissoes(
        servico.valor,
        colaborador.porcentagem_comissao
      );

      lancamentos.push({
        colaborador_id: colaborador.id,
        cliente_id: cliente.id,
        valor_total: servico.valor,
        forma_pagamento: formaPagamento,
        comissao_colaborador: comissaoColaborador,
        comissao_salao: comissaoSalao,
        data: dataHora.toISOString(),
      });

      totalLancamentos++;
    }
  }

  // 5. Criar agendamentos futuros (próximos 7 dias) para a agenda
  console.log('📅 Criando agendamentos futuros...\n');

  for (let i = 1; i <= 7; i++) {
    const data = addDays(hoje, i);
    const numAgendamentos = 4 + Math.floor(Math.random() * 4); // 4 a 7 por dia

    for (let j = 0; j < numAgendamentos; j++) {
      const colaborador = colaboradores[Math.floor(Math.random() * colaboradores.length)];
      const cliente = clientes[Math.floor(Math.random() * clientes.length)];
      const servico = servicos[Math.floor(Math.random() * servicos.length)];

      const dataHora = gerarHorarioAleatorio(data);

      agendamentos.push({
        colaborador_id: colaborador.id,
        cliente_id: cliente.id,
        data_hora: dataHora.toISOString(),
        descricao_servico: servico.nome,
      });
    }
  }

  // 6. Inserir lançamentos no banco
  console.log(`💾 Inserindo ${lancamentos.length} lançamentos...`);

  const { error: errorInsertLanc } = await supabase
    .from('lancamentos')
    .insert(lancamentos);

  if (errorInsertLanc) {
    console.error('❌ Erro ao inserir lançamentos:', errorInsertLanc);
    return;
  }

  console.log(`✅ ${lancamentos.length} lançamentos criados com sucesso!`);

  // 7. Inserir agendamentos no banco
  console.log(`\n💾 Inserindo ${agendamentos.length} agendamentos futuros...`);

  const { error: errorInsertAgend } = await supabase
    .from('agendamentos')
    .insert(agendamentos);

  if (errorInsertAgend) {
    console.error('❌ Erro ao inserir agendamentos:', errorInsertAgend);
    return;
  }

  console.log(`✅ ${agendamentos.length} agendamentos futuros criados com sucesso!`);

  // 8. Resumo
  console.log('\n📊 RESUMO:');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ Lançamentos criados: ${lancamentos.length}`);
  console.log(`✅ Agendamentos futuros: ${agendamentos.length}`);
  console.log(`📅 Período dos lançamentos: últimos 30 dias`);
  console.log(`📅 Período dos agendamentos: próximos 7 dias`);
  console.log('═══════════════════════════════════════════');

  const totalFaturamento = lancamentos.reduce((acc, l) => acc + l.valor_total, 0);
  console.log(`💰 Faturamento total simulado: R$ ${totalFaturamento.toFixed(2)}`);
  console.log('\n✨ Seed concluído! Agora você pode testar a agenda e os relatórios.\n');
}

// Executar
seedLancamentos().catch(console.error);
