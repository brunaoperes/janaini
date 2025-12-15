import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Função para criar cliente Supabase (lazy initialization)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables not configured');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

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
  { nome: 'Design de Sobrancelha', valor: 55, duracao_minutos: 30, descricao: 'Franciele - Sobrancelha', ativo: true },
  { nome: 'Design com Henna', valor: 60, duracao_minutos: 45, descricao: 'Franciele - Sobrancelha', ativo: true },
  { nome: 'Design com Coloração', valor: 65, duracao_minutos: 45, descricao: 'Franciele - Sobrancelha', ativo: true },
  { nome: 'Brow Lamination', valor: 150, duracao_minutos: 60, descricao: 'Franciele - Sobrancelha', ativo: true },
  { nome: 'Nanopigmentação', valor: 550, duracao_minutos: 120, descricao: 'Franciele - Sobrancelha', ativo: true },
  { nome: 'Tratamento de Reconstrução', valor: 100, duracao_minutos: 60, descricao: 'Franciele - Sobrancelha', ativo: true },
  { nome: 'Lash Lifting', valor: 160, duracao_minutos: 60, descricao: 'Franciele - Cílios', ativo: true },

  // Franciele - Buço & Lábios
  { nome: 'Depilação de Buço', valor: 15, duracao_minutos: 15, descricao: 'Franciele - Buço', ativo: true },
  { nome: 'Hidra Gloss', valor: 50, duracao_minutos: 30, descricao: 'Franciele - Lábios', ativo: true },

  // Franciele - Pacotes
  { nome: 'Pacote 2 Designs de Sobrancelha', valor: 95, duracao_minutos: 30, descricao: 'Franciele - Pacote (intervalo máx 20 dias)', ativo: true },
  { nome: 'Pacote 2 Designs + 2 Buços', valor: 120, duracao_minutos: 45, descricao: 'Franciele - Pacote (intervalo máx 20 dias)', ativo: true },
  { nome: 'Pacote 3 Hidra Gloss', valor: 135, duracao_minutos: 30, descricao: 'Franciele - Pacote (intervalo 15 dias)', ativo: true },
  { nome: 'Lash Lifting + Brow Lamination', valor: 300, duracao_minutos: 120, descricao: 'Franciele - Pacote', ativo: true },

  // Talita - Manicure e Pedicure
  { nome: 'Pedicure (Talita)', valor: 40, duracao_minutos: 45, descricao: 'Talita - Pedicure', ativo: true },
  { nome: 'Manicure (Talita)', valor: 40, duracao_minutos: 45, descricao: 'Talita - Manicure', ativo: true },

  // Janaini & Everson - Cabelo
  { nome: 'Maquiagem', valor: 200, duracao_minutos: 60, descricao: 'Janaini & Everson', ativo: true },
  { nome: 'Penteado', valor: 200, duracao_minutos: 90, descricao: 'Janaini & Everson', ativo: true },
  { nome: 'Coloração', valor: 150, duracao_minutos: 120, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Corte', valor: 120, duracao_minutos: 60, descricao: 'Janaini & Everson', ativo: true },
  { nome: 'Manutenção de Aplique', valor: 100, duracao_minutos: 90, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Babyliss', valor: 120, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Escova', valor: 70, duracao_minutos: 45, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Hidratação', valor: 120, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Ozônio', valor: 130, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Progressiva', valor: 260, duracao_minutos: 180, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Botox Capilar', valor: 120, duracao_minutos: 90, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Acidificação', valor: 100, duracao_minutos: 60, descricao: 'Janaini & Everson - a partir de', ativo: true },
  { nome: 'Luzes', valor: 250, duracao_minutos: 150, descricao: 'Janaini & Everson - a partir de', ativo: true },

  // Daiane - Manicure
  { nome: 'Pé e Mão (Daiane)', valor: 65, duracao_minutos: 90, descricao: 'Daiane - Manicure', ativo: true },
  { nome: 'Pedicure (Daiane)', valor: 35, duracao_minutos: 45, descricao: 'Daiane - Pedicure', ativo: true },
  { nome: 'Manicure (Daiane)', valor: 30, duracao_minutos: 45, descricao: 'Daiane - Manicure', ativo: true },
  { nome: 'Banho de Gel/Esmaltação Gel Mãos', valor: 80, duracao_minutos: 60, descricao: 'Daiane - Gel', ativo: true },
  { nome: 'Esmaltação em Gel Pés', valor: 85, duracao_minutos: 60, descricao: 'Daiane - Gel', ativo: true },
  { nome: 'Alongamento Aplicação Decorada', valor: 180, duracao_minutos: 120, descricao: 'Daiane - Alongamento', ativo: true },
  { nome: 'Alongamento Aplicação Natural', valor: 150, duracao_minutos: 120, descricao: 'Daiane - Alongamento', ativo: true },
  { nome: 'Alongamento Manutenção Decorada', valor: 150, duracao_minutos: 90, descricao: 'Daiane - Alongamento', ativo: true },
  { nome: 'Alongamento Manutenção Natural', valor: 130, duracao_minutos: 90, descricao: 'Daiane - Alongamento', ativo: true },
  { nome: 'Remoção em Gel', valor: 50, duracao_minutos: 30, descricao: 'Daiane - Remoção', ativo: true },
];

export async function GET() {
  const supabase = getSupabaseClient();

  const results = {
    colaboradores: { success: 0, errors: [] as string[] },
    servicos: { success: 0, errors: [] as string[] },
  };

  // Inserir colaboradores
  for (const colab of colaboradores) {
    const { error } = await supabase
      .from('colaboradores')
      .upsert(colab, { onConflict: 'nome' });

    if (error) {
      results.colaboradores.errors.push(`${colab.nome}: ${error.message}`);
    } else {
      results.colaboradores.success++;
    }
  }

  // Inserir serviços
  for (const servico of servicos) {
    const { error } = await supabase
      .from('servicos')
      .upsert(servico, { onConflict: 'nome' });

    if (error) {
      results.servicos.errors.push(`${servico.nome}: ${error.message}`);
    } else {
      results.servicos.success++;
    }
  }

  // Contar totais no banco
  const { count: totalColab } = await supabase
    .from('colaboradores')
    .select('*', { count: 'exact', head: true });

  const { count: totalServ } = await supabase
    .from('servicos')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({
    message: 'Seed concluído!',
    results,
    totais: {
      colaboradores: totalColab,
      servicos: totalServ,
    },
  });
}
