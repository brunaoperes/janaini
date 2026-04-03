'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/Button';

interface WhatsAppTemplate {
  id: number;
  tipo: string;
  titulo: string;
  template: string;
  ativo: boolean;
  updated_at: string;
}

interface MensagemWhatsApp {
  id: number;
  agendamento_id: number;
  tipo: string;
  cliente_id: number;
  telefone_destino: string;
  mensagem: string;
  status: string;
  data_programada: string;
  data_envio: string | null;
  erro_mensagem: string | null;
  tentativas: number;
  created_at: string;
  clientes: { nome: string } | null;
}

const TIPO_LABELS: Record<string, string> = {
  confirmacao: 'Confirmacao',
  lembrete: 'Lembrete',
  pos_venda: 'Pos-Venda',
};

const TIPO_ICONS: Record<string, string> = {
  confirmacao: '✅',
  lembrete: '🔔',
  pos_venda: '💖',
};

const TIPO_GRADIENTS: Record<string, string> = {
  confirmacao: 'from-green-400 to-green-600',
  lembrete: 'from-blue-400 to-blue-600',
  pos_venda: 'from-pink-400 to-pink-600',
};

const STATUS_STYLES: Record<string, string> = {
  enviado: 'bg-green-100 text-green-700',
  pendente: 'bg-yellow-100 text-yellow-700',
  erro: 'bg-red-100 text-red-700',
};

const PLACEHOLDERS_PREVIEW: Record<string, string> = {
  '{nome}': 'Maria Silva',
  '{profissional}': 'Ana Paula',
  '{data}': '15/04/2026',
  '{horario}': '14:30',
};

function aplicarPreview(template: string): string {
  let resultado = template;
  for (const [placeholder, valor] of Object.entries(PLACEHOLDERS_PREVIEW)) {
    resultado = resultado.replaceAll(placeholder, valor);
  }
  return resultado;
}

export default function AdminWhatsAppPage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal de edição
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editText, setEditText] = useState('');

  // Filtros do histórico
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Tab ativa
  const [tabAtiva, setTabAtiva] = useState<'templates' | 'historico'>('templates');

  useEffect(() => {
    carregarTemplates();
  }, []);

  useEffect(() => {
    if (tabAtiva === 'historico') {
      carregarMensagens();
    }
  }, [tabAtiva, filtroTipo, filtroStatus, dataInicio, dataFim, page]);

  async function carregarTemplates() {
    try {
      const res = await fetch('/api/admin/whatsapp?secao=templates');
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function carregarMensagens() {
    setLoadingMensagens(true);
    try {
      const params = new URLSearchParams({ secao: 'historico', page: String(page) });
      if (filtroTipo !== 'todos') params.set('tipo', filtroTipo);
      if (filtroStatus !== 'todos') params.set('status', filtroStatus);
      if (dataInicio) params.set('dataInicio', dataInicio);
      if (dataFim) params.set('dataFim', dataFim);

      const res = await fetch(`/api/admin/whatsapp?${params}`);
      const data = await res.json();
      if (data.mensagens) setMensagens(data.mensagens);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      setLoadingMensagens(false);
    }
  }

  function abrirEditor(template: WhatsAppTemplate) {
    setEditingTemplate(template);
    setEditText(template.template);
  }

  async function salvarTemplate() {
    if (!editingTemplate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingTemplate.id, template: editText }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t =>
          t.id === editingTemplate.id ? { ...t, template: editText } : t
        ));
        setEditingTemplate(null);
      }
    } catch (err) {
      console.error('Erro ao salvar template:', err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(template: WhatsAppTemplate) {
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: template.id, ativo: !template.ativo }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t =>
          t.id === template.id ? { ...t, ativo: !t.ativo } : t
        ));
      }
    } catch (err) {
      console.error('Erro ao toggle ativo:', err);
    }
  }

  function formatarDataHora(iso: string) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <a href="/admin" className="text-white/70 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
          </div>
          <p className="text-white/80 ml-8">Gerencie templates de mensagens e acompanhe o historico de envios</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setTabAtiva('templates')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              tabAtiva === 'templates'
                ? 'bg-white shadow-lg text-purple-700 border border-purple-200'
                : 'bg-white/50 text-gray-500 hover:bg-white/80'
            }`}
          >
            Templates de Mensagem
          </button>
          <button
            onClick={() => setTabAtiva('historico')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              tabAtiva === 'historico'
                ? 'bg-white shadow-lg text-purple-700 border border-purple-200'
                : 'bg-white/50 text-gray-500 hover:bg-white/80'
            }`}
          >
            Historico de Envios
            {total > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">{total}</span>
            )}
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB: TEMPLATES */}
        {/* ============================================================ */}
        {tabAtiva === 'templates' && (
          <div className="space-y-6">
            {/* Legenda de placeholders */}
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-5 border border-purple-100 shadow-soft">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Placeholders disponiveis</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(PLACEHOLDERS_PREVIEW).map(([key, val]) => (
                  <span key={key} className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg text-sm">
                    <code className="font-mono text-purple-700 font-semibold">{key}</code>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-600">{val}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Cards de templates */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`bg-white rounded-2xl border shadow-soft overflow-hidden transition-all hover:shadow-lg ${
                    template.ativo ? 'border-purple-100' : 'border-gray-200 opacity-60'
                  }`}
                >
                  {/* Card header */}
                  <div className={`bg-gradient-to-r ${TIPO_GRADIENTS[template.tipo]} px-5 py-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{TIPO_ICONS[template.tipo]}</span>
                        <h3 className="text-lg font-bold text-white">{template.titulo}</h3>
                      </div>
                      <button
                        onClick={() => toggleAtivo(template)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          template.ativo ? 'bg-white/30' : 'bg-black/20'
                        }`}
                        title={template.ativo ? 'Desativar' : 'Ativar'}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            template.ativo ? 'left-6' : 'left-0.5'
                          }`}
                        />
                      </button>
                    </div>
                    <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                      template.ativo ? 'bg-white/20 text-white' : 'bg-black/20 text-white/70'
                    }`}>
                      {template.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Card body - preview */}
                  <div className="p-5">
                    <div className="bg-gray-50 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                        {aplicarPreview(template.template)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Atualizado: {formatarDataHora(template.updated_at)}
                      </span>
                      <Button variant="primary" size="sm" onClick={() => abrirEditor(template)}>
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: HISTÓRICO */}
        {/* ============================================================ */}
        {tabAtiva === 'historico' && (
          <div className="space-y-6">
            {/* Filtros */}
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-5 border border-purple-100 shadow-soft">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-300"
                  >
                    <option value="todos">Todos</option>
                    <option value="confirmacao">Confirmacao</option>
                    <option value="lembrete">Lembrete</option>
                    <option value="pos_venda">Pos-Venda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-300"
                  >
                    <option value="todos">Todos</option>
                    <option value="enviado">Enviado</option>
                    <option value="pendente">Pendente</option>
                    <option value="erro">Erro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Data Inicio</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-600 mb-1">Data Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-300 focus:border-purple-300"
                  />
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-purple-100 shadow-soft overflow-hidden">
              {loadingMensagens ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
                </div>
              ) : mensagens.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p>Nenhuma mensagem encontrada</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tentativas</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Envio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {mensagens.map((msg) => (
                          <tr key={msg.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatarDataHora(msg.created_at)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">
                              {msg.clientes?.nome || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1 text-sm">
                                {TIPO_ICONS[msg.tipo]} {TIPO_LABELS[msg.tipo] || msg.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                              {msg.telefone_destino}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[msg.status] || 'bg-gray-100 text-gray-600'}`}>
                                {msg.status}
                              </span>
                              {msg.erro_mensagem && (
                                <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={msg.erro_mensagem}>
                                  {msg.erro_mensagem}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 text-center">
                              {msg.tentativas}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {msg.data_envio ? formatarDataHora(msg.data_envio) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <span className="text-sm text-gray-500">
                        {total} mensagem(ns) - Pagina {page} de {totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Proxima
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL DE EDIÇÃO */}
      {/* ============================================================ */}
      {editingTemplate && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingTemplate(null);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-modal-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`bg-gradient-to-r ${TIPO_GRADIENTS[editingTemplate.tipo]} px-6 py-5 rounded-t-3xl`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {TIPO_ICONS[editingTemplate.tipo]} Editar {editingTemplate.titulo}
                </h3>
                <button
                  onClick={() => setEditingTemplate(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Template da Mensagem
                  </label>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={14}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono focus:ring-2 focus:ring-purple-300 focus:border-purple-300 resize-none"
                    placeholder="Digite o template aqui..."
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Use os placeholders: <code className="text-purple-600">{'{nome}'}</code>, <code className="text-purple-600">{'{profissional}'}</code>, <code className="text-purple-600">{'{data}'}</code>, <code className="text-purple-600">{'{horario}'}</code>
                  </p>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Preview
                  </label>
                  <div className="bg-[#e5ddd5] rounded-xl p-4 min-h-[280px]">
                    <div className="bg-white rounded-lg p-3 shadow-sm max-w-[85%]">
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {aplicarPreview(editText)}
                      </p>
                      <span className="text-[10px] text-gray-400 float-right mt-1">14:30</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={() => setEditingTemplate(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={salvarTemplate} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
