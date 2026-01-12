'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LoadingSpinner from '@/components/LoadingSpinner';

interface AuditLog {
  id: number;
  user_id: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  usuario_role: string | null;
  acao: string;
  modulo: string;
  tabela: string | null;
  registro_id: number | null;
  metodo: string | null;
  endpoint: string | null;
  ip_origem: string | null;
  user_agent: string | null;
  plataforma: string | null;
  dados_anterior: Record<string, any> | null;
  dados_novo: Record<string, any> | null;
  campos_alterados: string[] | null;
  resultado: string;
  erro_codigo: string | null;
  erro_mensagem: string | null;
  created_at: string;
}

const ACOES = ['todos', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACCESS_DENIED'];
const MODULOS = ['todos', 'Agenda', 'Lancamentos', 'Usuarios', 'Servicos', 'Clientes', 'Comissoes', 'Auth', 'Sistema'];
const RESULTADOS = ['todos', 'success', 'error', 'denied'];

// Mapeamento de campos para nomes legíveis em português
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  status: 'Status',
  data_hora: 'Data e Hora',
  data: 'Data',
  cliente_id: 'Cliente',
  colaborador_id: 'Colaboradora',
  created_at: 'Criado em',
  updated_at: 'Atualizado em',
  observacoes: 'Observações',
  lancamento_id: 'Lançamento',
  valor_estimado: 'Valor Estimado',
  valor_total: 'Valor Total',
  valor_pago: 'Valor Pago',
  duracao_minutos: 'Duração',
  colaboradores_ids: 'Colaboradoras',
  descricao_servico: 'Serviço',
  servicos_nomes: 'Serviços',
  forma_pagamento: 'Forma de Pagamento',
  comissao_colaborador: 'Comissão Colaboradora',
  comissao_salao: 'Comissão Salão',
  taxa_pagamento: 'Taxa',
  is_fiado: 'Fiado',
  is_troca_gratis: 'Troca/Grátis',
  valor_referencia: 'Valor de Referência',
  data_pagamento: 'Data Pagamento',
  hora_inicio: 'Hora Início',
  hora_fim: 'Hora Fim',
  nome: 'Nome',
  email: 'Email',
  telefone: 'Telefone',
  endereco: 'Endereço',
  porcentagem_comissao: 'Comissão (%)',
  ativo: 'Ativo',
  role: 'Função',
  valor: 'Valor',
  duracao: 'Duração',
  categoria: 'Categoria',
  periodo_inicio: 'Período Início',
  periodo_fim: 'Período Fim',
  valor_bruto: 'Valor Bruto',
  valor_liquido: 'Valor Líquido',
  total_descontos: 'Total Descontos',
  pago_por: 'Pago por',
  lancamentos_ids: 'Lançamentos',
};

// Mapeamento de status para português
const STATUS_LABELS: Record<string, string> = {
  pendente: '🟡 Pendente',
  concluido: '✅ Concluído',
  cancelado: '❌ Cancelado',
  executando: '🔄 Em Execução',
};

// Mapeamento de formas de pagamento
const PAYMENT_LABELS: Record<string, string> = {
  pix: '📱 PIX',
  dinheiro: '💵 Dinheiro',
  cartao_debito: '💳 Cartão Débito',
  cartao_credito: '💳 Cartão Crédito',
  fiado: '📝 Fiado',
  troca_gratis: '🎁 Troca/Grátis',
};

// Formatar valor para exibição
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '-';
  if (value === true) return '✅ Sim';
  if (value === false) return '❌ Não';

  // Arrays vazios
  if (Array.isArray(value)) {
    if (value.length === 0) return '-';
    return value.join(', ');
  }

  // Campos de valor monetário
  if (['valor_estimado', 'valor_total', 'valor_pago', 'comissao_colaborador', 'comissao_salao',
       'taxa_pagamento', 'valor_referencia', 'valor_bruto', 'valor_liquido', 'total_descontos', 'valor'].includes(key)) {
    return `R$ ${Number(value).toFixed(2)}`;
  }

  // Campos de duração
  if (key === 'duracao_minutos' || key === 'duracao') {
    const mins = Number(value);
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    }
    return `${mins} min`;
  }

  // Campos de porcentagem
  if (key === 'porcentagem_comissao') {
    return `${value}%`;
  }

  // Status
  if (key === 'status') {
    return STATUS_LABELS[value] || value;
  }

  // Forma de pagamento
  if (key === 'forma_pagamento') {
    return PAYMENT_LABELS[value] || value;
  }

  // Datas ISO
  if (key.includes('data') || key === 'created_at' || key === 'updated_at') {
    try {
      const date = parseISO(String(value));
      if (key === 'data_hora') {
        return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
      if (key === 'created_at' || key === 'updated_at') {
        return format(date, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
      }
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return String(value);
    }
  }

  // Role
  if (key === 'role') {
    return value === 'admin' ? '👑 Administrador' : value === 'colaborador' ? '👤 Colaborador' : value;
  }

  return String(value);
};

// Campos a ignorar na exibição (metadados técnicos)
const IGNORE_FIELDS = ['user_id', 'id', 'created_at', 'updated_at', 'lancamento_id', 'cliente_id', 'colaborador_id', 'colaboradores_ids', 'lancamentos_ids', 'pago_por'];

// Componente para renderizar dados de forma legível
const ReadableData = ({ data, title, colorClass }: { data: Record<string, any>; title: string; colorClass: string }) => {
  if (!data) return null;

  // Filtrar campos relevantes
  const entries = Object.entries(data).filter(([key]) => !IGNORE_FIELDS.includes(key));

  if (entries.length === 0) return null;

  return (
    <div className={`${colorClass} p-4 rounded-xl`}>
      <label className={`text-xs font-semibold uppercase ${colorClass.includes('green') ? 'text-green-600' : colorClass.includes('red') ? 'text-red-600' : 'text-gray-600'}`}>
        {title}
      </label>
      <div className="mt-3 space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 py-2 border-b border-white/50 last:border-0">
            <span className="text-sm font-medium text-gray-600 min-w-[140px]">
              {FIELD_LABELS[key] || key}:
            </span>
            <span className="text-sm text-gray-900 flex-1">
              {formatValue(key, value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function LogsAuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  // Filtros
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return format(d, 'yyyy-MM-dd');
  });
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [modulo, setModulo] = useState('todos');
  const [acao, setAcao] = useState('todos');
  const [resultado, setResultado] = useState('todos');

  // Paginação
  const [page, setPage] = useState(1);
  const limit = 50;

  // Log selecionado para detalhes
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [dataInicio, dataFim, modulo, acao, resultado, page]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        modulo,
        acao,
        resultado,
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString(),
      });

      const response = await fetch(`/api/audit?${params}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao carregar logs');
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getAcaoColor = (acao: string) => {
    switch (acao) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-blue-100 text-blue-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'LOGIN': return 'bg-purple-100 text-purple-800';
      case 'LOGOUT': return 'bg-gray-100 text-gray-800';
      case 'ACCESS_DENIED': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getResultadoColor = (resultado: string) => {
    switch (resultado) {
      case 'success': return 'bg-green-50 text-green-700';
      case 'error': return 'bg-red-50 text-red-700';
      case 'denied': return 'bg-orange-50 text-orange-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FCEBFB] via-[#EAD5FF] to-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={loadLogs}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FCEBFB] via-[#EAD5FF] to-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200" />
              <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Logs de Auditoria
              </h1>
            </div>
            <div className="text-sm text-gray-600">
              {total} registro{total !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Filtros</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Módulo</label>
              <select
                value={modulo}
                onChange={(e) => { setModulo(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {MODULOS.map(m => (
                  <option key={m} value={m}>{m === 'todos' ? 'Todos' : m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ação</label>
              <select
                value={acao}
                onChange={(e) => { setAcao(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {ACOES.map(a => (
                  <option key={a} value={a}>{a === 'todos' ? 'Todas' : a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label>
              <select
                value={resultado}
                onChange={(e) => { setResultado(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {RESULTADOS.map(r => (
                  <option key={r} value={r}>{r === 'todos' ? 'Todos' : r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabela de Logs */}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data/Hora</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ação</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Módulo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tabela</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Resultado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        Nenhum log encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{log.usuario_nome || 'Sistema'}</div>
                          <div className="text-xs text-gray-500">{log.usuario_email || '-'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAcaoColor(log.acao)}`}>
                            {log.acao}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{log.modulo}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{log.tabela || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{log.registro_id || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getResultadoColor(log.resultado)}`}>
                            {log.resultado}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                          >
                            Ver
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <div className="text-sm text-gray-600">
                  Página {page} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedLog && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={() => setSelectedLog(null)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">Detalhes do Log #{selectedLog.id}</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info Básica */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Data/Hora</label>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {format(parseISO(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Plataforma</label>
                  <p className="text-sm font-medium text-gray-800 mt-1">{selectedLog.plataforma || 'N/A'}</p>
                </div>
              </div>

              {/* Usuário */}
              <div className="bg-purple-50 p-4 rounded-xl">
                <label className="text-xs font-semibold text-purple-600 uppercase">Usuário</label>
                <p className="text-sm font-medium text-gray-800 mt-1">{selectedLog.usuario_nome || 'Sistema'}</p>
                <p className="text-xs text-gray-600">{selectedLog.usuario_email || '-'}</p>
                <p className="text-xs text-gray-500 mt-1">Role: {selectedLog.usuario_role || 'N/A'}</p>
              </div>

              {/* Ação */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Ação</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAcaoColor(selectedLog.acao)}`}>
                      {selectedLog.acao}
                    </span>
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Resultado</label>
                  <p className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getResultadoColor(selectedLog.resultado)}`}>
                      {selectedLog.resultado}
                    </span>
                  </p>
                </div>
              </div>

              {/* Módulo/Tabela */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Módulo</label>
                  <p className="text-sm font-medium text-gray-800 mt-1">{selectedLog.modulo}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Tabela</label>
                  <p className="text-sm font-medium text-gray-800 mt-1">{selectedLog.tabela || '-'}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-gray-500 uppercase">ID Registro</label>
                  <p className="text-sm font-medium text-gray-800 mt-1">{selectedLog.registro_id || '-'}</p>
                </div>
              </div>

              {/* IP e User Agent */}
              <div className="bg-gray-50 p-4 rounded-xl">
                <label className="text-xs font-semibold text-gray-500 uppercase">Contexto</label>
                <p className="text-sm text-gray-800 mt-1">IP: {selectedLog.ip_origem || 'N/A'}</p>
                <p className="text-xs text-gray-500 mt-1 break-all">{selectedLog.user_agent || 'N/A'}</p>
              </div>

              {/* Campos Alterados */}
              {selectedLog.campos_alterados && selectedLog.campos_alterados.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-blue-600 uppercase">Campos Alterados</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedLog.campos_alterados.map((campo, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {campo}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Dados Anteriores */}
              {selectedLog.dados_anterior && (
                <ReadableData
                  data={selectedLog.dados_anterior}
                  title="Dados Anteriores"
                  colorClass="bg-red-50"
                />
              )}

              {/* Dados Novos */}
              {selectedLog.dados_novo && (
                <ReadableData
                  data={selectedLog.dados_novo}
                  title={selectedLog.acao === 'CREATE' ? 'Dados do Registro' : 'Dados Novos'}
                  colorClass="bg-green-50"
                />
              )}

              {/* Erro */}
              {selectedLog.erro_mensagem && (
                <div className="bg-orange-50 p-4 rounded-xl">
                  <label className="text-xs font-semibold text-orange-600 uppercase">Erro</label>
                  <p className="text-sm text-gray-800 mt-1">{selectedLog.erro_codigo}: {selectedLog.erro_mensagem}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
