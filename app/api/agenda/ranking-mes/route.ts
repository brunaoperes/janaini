import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes'); // formato YYYY-MM

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return errorResponse('Parâmetro "mes" inválido (use YYYY-MM)', 400);
    }

    const [ano, mesNum] = mes.split('-').map(Number);
    const inicio = `${mes}-01T00:00:00`;
    const ultimoDia = new Date(ano, mesNum, 0).getDate();
    const fim = `${mes}-${String(ultimoDia).padStart(2, '0')}T23:59:59`;

    // Perfil do usuário (pra filtro de não-admin)
    let userProfile: { role?: string; colaborador_id?: number } | null = null;
    try {
      const cookieStore = await cookies();
      const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      });

      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, colaborador_id')
          .eq('id', user.id)
          .single();
        userProfile = profile;
      }
    } catch {
      // sem perfil → trata como não-admin
    }

    const isAdmin = userProfile?.role === 'admin';
    const userColaboradorId = userProfile?.colaborador_id;

    const [colaboradoresRes, agendamentosRes] = await Promise.all([
      supabase.from('colaboradores').select('id, nome').order('nome'),
      supabase
        .from('agendamentos')
        .select('colaborador_id, colaboradores_ids, data_hora, descricao_servico')
        .gte('data_hora', inicio)
        .lte('data_hora', fim),
    ]);

    const colaboradores = colaboradoresRes.data || [];
    let agendamentos = agendamentosRes.data || [];

    if (!isAdmin && userColaboradorId) {
      const cid = Number(userColaboradorId);
      agendamentos = agendamentos.filter((a: any) =>
        a.colaborador_id === cid ||
        (Array.isArray(a.colaboradores_ids) && a.colaboradores_ids.map((x: any) => Number(x)).includes(cid))
      );
    }

    // Ranking de colaboradoras
    const ranking = colaboradores.map((c: any) => {
      const quantidade = agendamentos.filter((a: any) =>
        a.colaborador_id === c.id ||
        (Array.isArray(a.colaboradores_ids) && a.colaboradores_ids.map((x: any) => Number(x)).includes(c.id))
      ).length;
      return { id: c.id, nome: c.nome, quantidade };
    });

    // Horário de pico (hora do dia com mais agendamentos no mês)
    let horarioPico: { hora: number; quantidade: number } | null = null;
    if (agendamentos.length > 0) {
      const contagem: Record<number, number> = {};
      agendamentos.forEach((a: any) => {
        // "2026-04-15T14:30:00" → hora 14 (usar substring pra evitar fuso)
        const match = typeof a.data_hora === 'string' ? a.data_hora.match(/T(\d{2}):/) : null;
        if (!match) return;
        const hora = parseInt(match[1], 10);
        contagem[hora] = (contagem[hora] || 0) + 1;
      });
      const entries = Object.entries(contagem);
      if (entries.length > 0) {
        const [hora, quantidade] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
        horarioPico = { hora: parseInt(hora, 10), quantidade };
      }
    }

    // Top serviços (por descricao_servico)
    const servicosMap: Record<string, number> = {};
    agendamentos.forEach((a: any) => {
      const nome = a.descricao_servico || 'Outros';
      servicosMap[nome] = (servicosMap[nome] || 0) + 1;
    });
    const topServicos = Object.entries(servicosMap)
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    return jsonResponse({ ranking, horarioPico, topServicos });
  } catch (error: any) {
    console.error('Erro no ranking-mes:', error);
    return errorResponse(error.message, 500);
  }
}
