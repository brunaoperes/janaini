import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { auditCreate, auditUpdate, auditDelete } from '@/lib/audit';
import { requireAdmin, isAuthError } from '@/lib/api-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

export const dynamic = 'force-dynamic';

// Estoque de produtos (uso interno; revenda preparada p/ futuro). SOMENTE admin.
// Foco: quantidade atual + alerta de reposição (quantidade_atual <= estoque_minimo).
const num = (v: any) => Number(v) || 0;
function audUser(p: { id: string; nome?: string; username?: string }) {
  return { userId: p.id, userName: p.nome || p.username || 'Admin', modulo: 'Sistema' as const };
}

// GET → lista produtos ativos + contadores. ?produto_id= → histórico de movimentações do produto.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const produtoId = new URL(request.url).searchParams.get('produto_id');

  if (produtoId) {
    const { data, error } = await supabase.from('movimentacoes_estoque').select('*').eq('produto_id', Number(produtoId)).order('created_at', { ascending: false });
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ movimentacoes: data || [] });
  }

  const { data, error } = await supabase.from('produtos').select('*').eq('ativo', true).order('nome');
  if (error) return errorResponse(error.message, 500);
  const produtos = data || [];
  const emReposicao = produtos.filter((p) => num(p.quantidade_atual) <= num(p.estoque_minimo));
  const valorEstoque = produtos.reduce((s, p) => s + num(p.quantidade_atual) * num(p.custo_unitario), 0);
  return jsonResponse({ produtos, contadores: { total: produtos.length, emReposicao: emReposicao.length, valorEstoque } });
}

// POST → cria produto; ou {acao:'movimentar', produto_id, tipo, quantidade, custo_unitario?, motivo?} registra e atualiza estoque
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const body = await request.json();

  if (body.acao === 'movimentar') {
    const { produto_id, tipo, quantidade, custo_unitario, motivo } = body;
    if (!produto_id || !['entrada', 'saida', 'ajuste'].includes(tipo)) return errorResponse('Movimentação inválida.', 400);
    const qtd = num(quantidade);
    if (qtd < 0 || (tipo !== 'ajuste' && qtd <= 0)) return errorResponse('Quantidade inválida.', 400);

    const { data: prod } = await supabase.from('produtos').select('*').eq('id', produto_id).single();
    if (!prod) return errorResponse('Produto não encontrado.', 404);

    const atual = num(prod.quantidade_atual);
    let novaQtd = atual;
    let novoCusto = num(prod.custo_unitario);
    if (tipo === 'entrada') {
      novaQtd = atual + qtd;
      // custo médio ponderado
      const custoEntrada = custo_unitario != null ? num(custo_unitario) : novoCusto;
      novoCusto = novaQtd > 0 ? (atual * num(prod.custo_unitario) + qtd * custoEntrada) / novaQtd : custoEntrada;
    } else if (tipo === 'saida') {
      novaQtd = Math.max(0, atual - qtd);
    } else { // ajuste: define a quantidade contada
      novaQtd = qtd;
    }

    await supabase.from('movimentacoes_estoque').insert({ produto_id, tipo, quantidade: qtd, custo_unitario: custo_unitario != null ? num(custo_unitario) : null, motivo: motivo || null, registrado_por: auth.profile.nome || auth.profile.username });
    const { data, error } = await supabase.from('produtos').update({ quantidade_atual: novaQtd, custo_unitario: Math.round(novoCusto * 100) / 100, updated_at: new Date().toISOString() }).eq('id', produto_id).select().single();
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ data, message: `Estoque atualizado: ${data.nome} agora tem ${novaQtd} ${data.unidade}.` });
  }

  // cria produto
  const { nome, categoria, unidade, tipo, quantidade_atual, estoque_minimo, custo_unitario, preco_venda } = body;
  if (!nome || nome.trim().length < 2) return errorResponse('Informe o nome do produto.', 400);
  const dados = {
    nome: nome.trim(), categoria: categoria || null, unidade: unidade || 'un',
    tipo: tipo === 'revenda' ? 'revenda' : 'uso_interno',
    quantidade_atual: num(quantidade_atual), estoque_minimo: num(estoque_minimo),
    custo_unitario: num(custo_unitario), preco_venda: preco_venda != null ? num(preco_venda) : null,
  };
  const { data, error } = await supabase.from('produtos').insert(dados).select().single();
  if (error) return errorResponse(error.message, 500);
  // registra o estoque inicial como movimentação de entrada (se houver)
  if (dados.quantidade_atual > 0) {
    await supabase.from('movimentacoes_estoque').insert({ produto_id: data.id, tipo: 'entrada', quantidade: dados.quantidade_atual, custo_unitario: dados.custo_unitario, motivo: 'Estoque inicial', registrado_por: auth.profile.nome || auth.profile.username });
  }
  try { await auditCreate({ ...audUser(auth.profile), tabela: 'produtos', registroId: data.id, dadosNovo: data, metodo: 'POST', endpoint: '/api/admin/produtos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// PUT ?id= → edita dados do produto (não mexe em quantidade — isso é via movimentação)
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  const { data: atual } = await supabase.from('produtos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Produto não encontrado.', 404);
  const body = await request.json();
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  for (const k of ['nome', 'categoria', 'unidade', 'tipo', 'estoque_minimo', 'custo_unitario', 'preco_venda', 'ativo']) if (body[k] !== undefined) patch[k] = body[k];
  const { data, error } = await supabase.from('produtos').update(patch).eq('id', id).select().single();
  if (error) return errorResponse(error.message, 500);
  try { await auditUpdate({ ...audUser(auth.profile), tabela: 'produtos', registroId: id, dadosAnterior: atual, dadosNovo: data, metodo: 'PUT', endpoint: '/api/admin/produtos' }); } catch { /* */ }
  return jsonResponse({ data });
}

// DELETE ?id= → se tem movimentações, desativa; senão exclui
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (isAuthError(auth)) return auth;
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return errorResponse('ID é obrigatório.', 400);
  const { data: atual } = await supabase.from('produtos').select('*').eq('id', id).single();
  if (!atual) return errorResponse('Produto não encontrado.', 404);
  const { data: movs } = await supabase.from('movimentacoes_estoque').select('id').eq('produto_id', id).limit(1);
  if (movs && movs.length > 0) {
    const { error } = await supabase.from('produtos').update({ ativo: false }).eq('id', id);
    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ desativado: true, message: 'Produto tem histórico — foi desativado.' });
  }
  const { error } = await supabase.from('produtos').delete().eq('id', id);
  if (error) return errorResponse(error.message, 500);
  try { await auditDelete({ ...audUser(auth.profile), tabela: 'produtos', registroId: id, dadosAnterior: atual, metodo: 'DELETE', endpoint: '/api/admin/produtos' }); } catch { /* */ }
  return jsonResponse({ deleted: true });
}
