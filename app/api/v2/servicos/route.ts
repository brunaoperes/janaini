import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { requireAdmin, isAuthError } from '@/lib/v2/auth';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';
import { derivarCategoria, CATEGORIAS, LABEL_CAT, type CategoriaId } from '@/components/v2/servicos/categoria';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Serviços — visão ADMIN (acesso total): vê TODOS os serviços e pode atribuir exclusividade
// a qualquer colaboradora. A /api/servicos original é escopada por colaboradora e exige
// colaborador_id no perfil, então não serve para o admin — por isso esta rota v2 própria.
//
// GET faz filtro/busca/ordenação/PAGINAÇÃO no servidor. A tabela `servicos` é enxuta
// (dezenas/centenas de linhas), então é carregada uma vez e a categoria (derivada), a
// filtragem e a paginação acontecem em memória — a página devolve só a fatia pedida.
// Categoria = heurística do nome (ver components/v2/servicos/categoria.ts).
// Comissão NÃO é por serviço: vem da colaboradora (colaboradores.porcentagem_comissao).

const n = (v: unknown) => Number(v) || 0;
const round2 = (v: number) => Math.round(v * 100) / 100;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function valida(body: any): { ok: true; dados: any } | { ok: false; erro: string } {
  const nome = String(body?.nome || '').trim();
  if (nome.length < 3) return { ok: false, erro: 'Nome deve ter pelo menos 3 caracteres.' };
  const duracao = n(body?.duracao_minutos);
  if (duracao < 1 || duracao > 480) return { ok: false, erro: 'Duração deve ficar entre 1 e 480 minutos.' };
  const valor = n(body?.valor);
  if (valor < 0) return { ok: false, erro: 'Valor inválido.' };
  const dono = body?.dono_colaborador_id ? Number(body.dono_colaborador_id) : null;
  return {
    ok: true,
    dados: {
      nome,
      duracao_minutos: duracao,
      valor,
      descricao: body?.descricao ? String(body.descricao).slice(0, 500) : null,
      ativo: body?.ativo !== false,
      dono_colaborador_id: dono,
      colaboradores_ids: dono ? [dono] : [],
    },
  };
}

type VendaAgg = { qtd: number; receita: number; ultima: string | null };
const novaVenda = (): VendaAgg => ({ qtd: 0, receita: 0, ultima: null });
const maisRecente = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Agrega vendas (atendimentos válidos) por id de serviço e por nome (fallback). */
function agregaVendas(lancs: any[]) {
  const byId = new Map<number, VendaAgg>();
  const byNome = new Map<string, VendaAgg>();
  for (const l of lancs) {
    const data = (l.data || '').slice(0, 10) || null;
    const ids = (l.servicos_ids || []) as number[];
    if (ids.length) {
      const share = n(l.valor_total) / ids.length;
      for (const id of ids) {
        const e = byId.get(id) || novaVenda();
        e.qtd += 1; e.receita += share; e.ultima = maisRecente(e.ultima, data);
        byId.set(id, e);
      }
    } else {
      const nomes = String(l.servicos_nomes || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
      if (!nomes.length) continue;
      const share = n(l.valor_total) / nomes.length;
      for (const nm of nomes) {
        const k = norm(nm);
        const e = byNome.get(k) || novaVenda();
        e.qtd += 1; e.receita += share; e.ultima = maisRecente(e.ultima, data);
        byNome.set(k, e);
      }
    }
  }
  return { byId, byNome };
}

const vendasDe = (s: any, byId: Map<number, VendaAgg>, byNome: Map<string, VendaAgg>): VendaAgg => {
  const a = byId.get(s.id) || novaVenda();
  const b = byNome.get(norm(s.nome || '')) || novaVenda();
  return { qtd: a.qtd + b.qtd, receita: round2(a.receita + b.receita), ultima: maisRecente(a.ultima, b.ultima) };
};

// ============================================================================
// GET
// ============================================================================
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;

  const p = new URL(request.url).searchParams;
  const detalheId = p.get('detalhe');
  if (detalheId) return detalhe(Number(detalheId));

  // --------- parâmetros ---------
  const categoria = (p.get('categoria') || 'todos') as CategoriaId | 'todos';
  const status = p.get('status') || 'todos';                 // todos | ativos | inativos
  const exclusividade = p.get('exclusividade') || 'todos';   // todos | geral | exclusivo
  const busca = norm((p.get('busca') || '').trim()).slice(0, 60);
  const precoMin = p.get('precoMin') ? n(p.get('precoMin')) : null;
  const precoMax = p.get('precoMax') ? n(p.get('precoMax')) : null;
  const duracaoMin = p.get('duracaoMin') ? n(p.get('duracaoMin')) : null;
  const duracaoMax = p.get('duracaoMax') ? n(p.get('duracaoMax')) : null;
  const ordenar = p.get('ordenar') || 'nome_asc';
  const page = Math.max(1, Number(p.get('page') || 1));
  const limit = [10, 12, 25, 50].includes(Number(p.get('limit'))) ? Number(p.get('limit')) : 12;

  // --------- dados ---------
  const [servRes, colabRes, lancRes] = await Promise.all([
    supabase.from('servicos').select('*').order('nome'),
    supabase.from('colaboradores').select('id, nome').order('nome'),
    supabase.from('lancamentos')
      .select('valor_total, servicos_ids, servicos_nomes, data')
      .eq('status', 'concluido').eq('is_fiado', false).eq('is_troca_gratis', false),
  ]);
  if (servRes.error) return errorResponse(servRes.error.message, 500);

  const colaboradoras = colabRes.data || [];
  const mapaColab = new Map(colaboradoras.map((c) => [c.id, c.nome]));
  const { byId, byNome } = agregaVendas(lancRes.data || []);
  const semHistorico = byId.size === 0 && byNome.size === 0;

  // enriquece cada serviço com categoria (derivada), dona e vendas
  const todos = (servRes.data || []).map((s) => ({
    ...s,
    dona_nome: s.dono_colaborador_id ? mapaColab.get(s.dono_colaborador_id) || null : null,
    categoria: derivarCategoria(s.nome, s.descricao) as CategoriaId,
    vendas: vendasDe(s, byId, byNome),
  }));

  // --------- KPIs (catálogo inteiro, independentes dos filtros) ---------
  const ativosArr = todos.filter((s) => s.ativo);
  const total = todos.length;
  const ativos = ativosArr.length;
  const ticketMedioAtivos = ativos ? round2(ativosArr.reduce((a, s) => a + n(s.valor), 0) / ativos) : 0;
  const duracaoMediaAtivos = ativos ? Math.round(ativosArr.reduce((a, s) => a + n(s.duracao_minutos), 0) / ativos) : 0;
  const pctAtivos = total ? Math.round((ativos / total) * 100) : 0;

  // --------- filtros comuns (tudo menos a categoria) ---------
  const passaComum = (s: (typeof todos)[number]) => {
    if (status === 'ativos' && !s.ativo) return false;
    if (status === 'inativos' && s.ativo) return false;
    if (exclusividade === 'geral' && s.dono_colaborador_id != null) return false;
    if (exclusividade === 'exclusivo' && s.dono_colaborador_id == null) return false;
    if (precoMin != null && n(s.valor) < precoMin) return false;
    if (precoMax != null && n(s.valor) > precoMax) return false;
    if (duracaoMin != null && n(s.duracao_minutos) < duracaoMin) return false;
    if (duracaoMax != null && n(s.duracao_minutos) > duracaoMax) return false;
    if (busca && !norm(`${s.nome} ${s.descricao || ''}`).includes(busca)) return false;
    return true;
  };
  const baseSemCat = todos.filter(passaComum);

  // contagem por categoria (respeita os outros filtros, ignora a própria categoria)
  const contagem = new Map<CategoriaId, number>();
  for (const s of baseSemCat) contagem.set(s.categoria, (contagem.get(s.categoria) || 0) + 1);
  const categorias: { id: CategoriaId | 'todos'; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: baseSemCat.length },
    ...CATEGORIAS.map((c) => ({ id: c.id, label: c.label, count: contagem.get(c.id) || 0 })),
  ];

  // aplica categoria
  const filtrados = categoria === 'todos' ? baseSemCat : baseSemCat.filter((s) => s.categoria === categoria);

  // ordenação
  const cmpNome = (a: any, b: any) => norm(a.nome).localeCompare(norm(b.nome), 'pt');
  filtrados.sort((a, b) => {
    switch (ordenar) {
      case 'nome_desc': return -cmpNome(a, b);
      case 'preco_desc': return n(b.valor) - n(a.valor) || cmpNome(a, b);
      case 'preco_asc': return n(a.valor) - n(b.valor) || cmpNome(a, b);
      case 'duracao_desc': return n(b.duracao_minutos) - n(a.duracao_minutos) || cmpNome(a, b);
      case 'duracao_asc': return n(a.duracao_minutos) - n(b.duracao_minutos) || cmpNome(a, b);
      case 'vendas_desc': return b.vendas.qtd - a.vendas.qtd || b.vendas.receita - a.vendas.receita || cmpNome(a, b);
      case 'atualizado_desc': return String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')) || cmpNome(a, b);
      default: return cmpNome(a, b); // nome_asc
    }
  });

  // paginação
  const totalFiltrado = filtrados.length;
  const paginas = Math.max(1, Math.ceil(totalFiltrado / limit));
  const pageSafe = Math.min(page, paginas);
  const from = (pageSafe - 1) * limit;
  const itens = filtrados.slice(from, from + limit);

  // mais vendidos (dados reais; top 5 por quantidade)
  const maisVendidos = todos
    .filter((s) => s.vendas.qtd > 0)
    .sort((a, b) => b.vendas.qtd - a.vendas.qtd || b.vendas.receita - a.vendas.receita)
    .slice(0, 5)
    .map((s) => ({ id: s.id, nome: s.nome, categoria: s.categoria, quantidade: s.vendas.qtd, receita: s.vendas.receita }));

  return jsonResponse({
    itens,
    paginacao: { page: pageSafe, limit, total: totalFiltrado, paginas },
    kpis: { total, ticketMedioAtivos, duracaoMediaAtivos, ativos, pctAtivos },
    categorias,
    maisVendidos,
    colaboradoras,
    nomesTodos: todos.map((s) => ({ id: s.id, nome: s.nome })),
    semHistorico,
  });
}

/** Detalhe de um serviço (drawer): dados + profissionais vinculadas + vendas + últimos atendimentos. */
async function detalhe(id: number) {
  if (!Number.isFinite(id) || id <= 0) return errorResponse('ID inválido.', 400);

  const { data: s, error } = await supabase.from('servicos').select('*').eq('id', id).maybeSingle();
  if (error) return errorResponse(error.message, 500);
  if (!s) return errorResponse('Serviço não encontrado.', 404);

  const { data: colabs } = await supabase.from('colaboradores').select('id, nome').order('nome');
  const mapaColab = new Map((colabs || []).map((c) => [c.id, c.nome]));

  // atendimentos válidos que usaram este serviço (por id no array OU por nome)
  const nomeSan = String(s.nome || '').replace(/[,()%*]/g, ' ').trim();
  let q = supabase.from('lancamentos')
    .select('valor_total, servicos_ids, servicos_nomes, data, clientes(nome)')
    .eq('status', 'concluido').eq('is_fiado', false).eq('is_troca_gratis', false)
    .or(`servicos_ids.cs.{${id}},servicos_nomes.ilike.*${nomeSan}*`)
    .order('data', { ascending: false })
    .limit(400);
  const { data: lancs } = await q;

  const { byId, byNome } = agregaVendas(lancs || []);
  const v = vendasDe(s, byId, byNome);
  const vendas = { ...v, ticket: v.qtd ? round2(v.receita / v.qtd) : 0 };

  const emb = (x: any) => (Array.isArray(x) ? x[0] : x);
  const recentes = (lancs || []).slice(0, 8).map((l: any) => ({
    data: (l.data || '').slice(0, 10),
    cliente_nome: emb(l.clientes)?.nome || '—',
    valor: n(l.valor_total),
  }));

  // profissionais vinculadas: exclusivo = a dona; geral = ids listados (se houver)
  const ids: number[] = Array.isArray(s.colaboradores_ids) ? s.colaboradores_ids : [];
  const profissionais = ids.map((cid) => ({ id: cid, nome: mapaColab.get(cid) || `#${cid}` }));

  return jsonResponse({
    servico: {
      ...s,
      dona_nome: s.dono_colaborador_id ? mapaColab.get(s.dono_colaborador_id) || null : null,
      categoria: derivarCategoria(s.nome, s.descricao),
      vendas: v,
    },
    profissionais,
    vendas,
    recentes,
    categoriaLabel: LABEL_CAT[derivarCategoria(s.nome, s.descricao)],
  });
}

// POST: cria serviço (geral ou exclusivo de qualquer colaboradora). Duplicar usa este POST
// com nome "<nome> (Cópia)" — o cliente monta o corpo.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const v = valida(await request.json());
  if (!v.ok) return errorResponse(v.erro, 400);

  const { data, error } = await supabase.from('servicos').insert(v.dados).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditCreate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/v2/servicos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// PUT (?id=): edita qualquer serviço, incluindo mudar/remover a exclusividade
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID do serviço é obrigatório.', 400);
  const { data: atual } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Serviço não encontrado.', 404);
  const v = valida(await request.json());
  if (!v.ok) return errorResponse(v.erro, 400);

  const { data, error } = await supabase.from('servicos').update(v.dados).eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditUpdate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/v2/servicos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// DELETE (?id=): exclui; se já tem histórico em lançamentos, apenas DESATIVA (não some do histórico)
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID do serviço é obrigatório.', 400);
  const { data: atual } = await supabase.from('servicos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Serviço não encontrado.', 404);

  const { data: usos } = await supabase.from('lancamentos').select('id').ilike('servicos_nomes', `%${atual.nome}%`).limit(1);
  if (usos && usos.length > 0) {
    const { error } = await supabase.from('servicos').update({ ativo: false }).eq('id', id);
    if (error) return errorResponse(error.message, 500);
    try { await auditUpdate({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: id, dadosAnterior: atual, dadosNovo: { ...atual, ativo: false }, metodo: 'DELETE', endpoint: '/api/v2/servicos' }); } catch { /* */ }
    return jsonResponse({ desativado: true, message: 'Serviço já usado em atendimentos — foi desativado (não some do histórico).' });
  }
  const { error } = await supabase.from('servicos').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  try { await auditDelete({ userId: auth.profile.id, userName: auth.profile.nome || 'Admin', modulo: 'Servicos', tabela: 'servicos', registroId: id, dadosAnterior: atual, metodo: 'DELETE', endpoint: '/api/v2/servicos' }); } catch { /* */ }
  return jsonResponse({ deleted: true });
}
