import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Colaboradores do salão
const colaboradores = [
  { nome: 'Franciele Sumaio', porcentagem_comissao: 50 },
  { nome: 'Talita Beatriz', porcentagem_comissao: 50 },
  { nome: 'Janaini Freitas', porcentagem_comissao: 50 },
  { nome: 'Everson Constantino', porcentagem_comissao: 50 },
  { nome: 'Daiane Guerreiro', porcentagem_comissao: 50 },
];

// Serviços do salão
const servicos = [
  // Franciele - Sobrancelha & Cílios
  { nome: 'Design de Sobrancelha', valor: 55, duracao_minutos: 30, descricao: 'Franciele - Sobrancelha' },
  { nome: 'Design com Henna', valor: 60, duracao_minutos: 45, descricao: 'Franciele - Sobrancelha' },
  { nome: 'Design com Coloração', valor: 65, duracao_minutos: 45, descricao: 'Franciele - Sobrancelha' },
  { nome: 'Brow Lamination', valor: 150, duracao_minutos: 60, descricao: 'Franciele - Sobrancelha' },
  { nome: 'Nanopigmentação', valor: 550, duracao_minutos: 120, descricao: 'Franciele - Sobrancelha' },
  { nome: 'Tratamento de Reconstrução', valor: 100, duracao_minutos: 60, descricao: 'Franciele - Sobrancelha' },
  { nome: 'Lash Lifting', valor: 160, duracao_minutos: 60, descricao: 'Franciele - Cílios' },

  // Franciele - Buço & Lábios
  { nome: 'Depilação de Buço', valor: 15, duracao_minutos: 15, descricao: 'Franciele - Buço' },
  { nome: 'Hidra Gloss', valor: 50, duracao_minutos: 30, descricao: 'Franciele - Lábios' },

  // Franciele - Pacotes
  { nome: 'Pacote 2 Designs de Sobrancelha', valor: 95, duracao_minutos: 30, descricao: 'Franciele - Pacote (intervalo máx 20 dias)' },
  { nome: 'Pacote 2 Designs + 2 Buços', valor: 120, duracao_minutos: 45, descricao: 'Franciele - Pacote (intervalo máx 20 dias)' },
  { nome: 'Pacote 3 Hidra Gloss', valor: 135, duracao_minutos: 30, descricao: 'Franciele - Pacote (intervalo 15 dias)' },
  { nome: 'Lash Lifting + Brow Lamination', valor: 300, duracao_minutos: 120, descricao: 'Franciele - Pacote' },

  // Talita - Manicure e Pedicure
  { nome: 'Pedicure (Talita)', valor: 40, duracao_minutos: 45, descricao: 'Talita - Pedicure' },
  { nome: 'Manicure (Talita)', valor: 40, duracao_minutos: 45, descricao: 'Talita - Manicure' },

  // Janaini & Everson - Cabelo
  { nome: 'Maquiagem', valor: 200, duracao_minutos: 60, descricao: 'Janaini & Everson' },
  { nome: 'Penteado', valor: 200, duracao_minutos: 90, descricao: 'Janaini & Everson' },
  { nome: 'Coloração', valor: 150, duracao_minutos: 120, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Corte', valor: 120, duracao_minutos: 60, descricao: 'Janaini & Everson' },
  { nome: 'Manutenção de Aplique', valor: 100, duracao_minutos: 90, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Babyliss', valor: 120, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Escova', valor: 70, duracao_minutos: 45, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Hidratação', valor: 120, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Ozônio', valor: 130, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Progressiva', valor: 260, duracao_minutos: 180, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Botox Capilar', valor: 120, duracao_minutos: 90, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Acidificação', valor: 100, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de' },
  { nome: 'Luzes', valor: 250, duracao_minutos: 150, descricao: 'Janaini & Everson - a partir de' },

  // Daiane - Manicure
  { nome: 'Pé e Mão (Daiane)', valor: 65, duracao_minutos: 90, descricao: 'Daiane - Manicure' },
  { nome: 'Pedicure (Daiane)', valor: 35, duracao_minutos: 45, descricao: 'Daiane - Pedicure' },
  { nome: 'Manicure (Daiane)', valor: 30, duracao_minutos: 45, descricao: 'Daiane - Manicure' },
  { nome: 'Banho de Gel/Esmaltação Gel Mãos', valor: 80, duracao_minutos: 60, descricao: 'Daiane - Gel' },
  { nome: 'Esmaltação em Gel Pés', valor: 85, duracao_minutos: 60, descricao: 'Daiane - Gel' },
  { nome: 'Alongamento Aplicação Decorada', valor: 180, duracao_minutos: 120, descricao: 'Daiane - Alongamento' },
  { nome: 'Alongamento Aplicação Natural', valor: 150, duracao_minutos: 120, descricao: 'Daiane - Alongamento' },
  { nome: 'Alongamento Manutenção Decorada', valor: 150, duracao_minutos: 90, descricao: 'Daiane - Alongamento' },
  { nome: 'Alongamento Manutenção Natural', valor: 130, duracao_minutos: 90, descricao: 'Daiane - Alongamento' },
  { nome: 'Remoção em Gel', valor: 50, duracao_minutos: 30, descricao: 'Daiane - Remoção' },
];

async function seedColaboradoresServicos() {
  console.log('🌱 Iniciando cadastro de colaboradores e serviços...\n');

  // 1. Limpar dados existentes (opcional - descomente se necessário)
  // console.log('🗑️  Limpando dados existentes...');
  // await supabase.from('servicos').delete().neq('id', 0);
  // await supabase.from('colaboradores').delete().neq('id', 0);

  // 2. Inserir colaboradores
  console.log('👥 Cadastrando colaboradores...');

  for (const colab of colaboradores) {
    const { data, error } = await supabase
      .from('colaboradores')
      .upsert(colab, { onConflict: 'nome' })
      .select();

    if (error) {
      console.error(`❌ Erro ao cadastrar ${colab.nome}:`, error.message);
    } else {
      console.log(`✅ ${colab.nome} cadastrada`);
    }
  }

  // 3. Inserir serviços
  console.log('\n💅 Cadastrando serviços...');

  for (const servico of servicos) {
    const { data, error } = await supabase
      .from('servicos')
      .upsert({ ...servico, ativo: true }, { onConflict: 'nome' })
      .select();

    if (error) {
      console.error(`❌ Erro ao cadastrar ${servico.nome}:`, error.message);
    } else {
      console.log(`✅ ${servico.nome} - R$ ${servico.valor.toFixed(2)}`);
    }
  }

  // 4. Resumo
  console.log('\n📊 RESUMO:');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ Colaboradores: ${colaboradores.length}`);
  console.log(`✅ Serviços: ${servicos.length}`);
  console.log('═══════════════════════════════════════════');

  // Verificar contagem no banco
  const { count: countColab } = await supabase
    .from('colaboradores')
    .select('*', { count: 'exact', head: true });

  const { count: countServ } = await supabase
    .from('servicos')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📦 Total no banco:`);
  console.log(`   Colaboradores: ${countColab}`);
  console.log(`   Serviços: ${countServ}`);

  console.log('\n✨ Cadastro concluído!\n');
}

// Executar
seedColaboradoresServicos().catch(console.error);
