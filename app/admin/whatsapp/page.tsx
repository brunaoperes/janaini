'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

interface Stats {
  enviados: number;
  pendentes: number;
  erros: number;
  total: number;
}

interface Config {
  zapi_instance_id: string;
  zapi_token: string;
  zapi_configurado: boolean;
  cron_schedule: string;
  tempo_lembrete: string;
  tempo_pos_venda: string;
  max_tentativas: number;
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
  confirmacao: 'from-emerald-400 to-emerald-600',
  lembrete: 'from-sky-400 to-sky-600',
  pos_venda: 'from-pink-400 to-rose-500',
};

const STATUS_STYLES: Record<string, { bg: string; dot: string }> = {
  enviado: { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500' },
  pendente: { bg: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500' },
  erro: { bg: 'bg-red-50 text-red-700 border border-red-200', dot: 'bg-red-500' },
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

type TabType = 'painel' | 'templates' | 'historico' | 'teste';

export default function AdminWhatsAppPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([]);
  const [stats, setStats] = useState<Stats>({ enviados: 0, pendentes: 0, erros: 0, total: 0 });
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal de edicao
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editText, setEditText] = useState('');

  // Filtros do historico
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Tab ativa
  const [tabAtiva, setTabAtiva] = useState<TabType>('painel');

  // Mensagem de teste
  const [testeTelefone, setTesteTelefone] = useState('');
  const [testeMensagem, setTesteMensagem] = useState('Ola! Esta e uma mensagem de teste do sistema NaviBelle. Se voce recebeu, o WhatsApp esta funcionando corretamente! ✅');
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [testeResultado, setTesteResultado] = useState<{ success: boolean; message: string } | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (tabAtiva === 'historico') {
      carregarMensagens();
    }
  }, [tabAtiva, filtroTipo, filtroStatus, dataInicio, dataFim, page]);

  async function carregarDados() {
    try {
      const [templatesRes, statsRes, configRes] = await Promise.all([
        fetch('/api/admin/whatsapp?secao=templates'),
        fetch('/api/admin/whatsapp?secao=stats'),
        fetch('/api/admin/whatsapp?secao=config'),
      ]);

      const templatesData = await templatesRes.json();
      const statsData = await statsRes.json();
      const configData = await configRes.json();

      if (templatesData.templates) setTemplates(templatesData.templates);
      if (statsData.stats) setStats(statsData.stats);
      if (configData.config) setConfig(configData.config);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
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
        showToast('Template salvo com sucesso!', 'success');
      }
    } catch (err) {
      showToast('Erro ao salvar template', 'error');
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
        showToast(template.ativo ? 'Template desativado' : 'Template ativado', 'success');
      }
    } catch (err) {
      showToast('Erro ao alterar status', 'error');
    }
  }

  async function enviarTeste() {
    if (!testeTelefone.trim()) {
      setTesteResultado({ success: false, message: 'Digite um numero de telefone' });
      return;
    }
    setEnviandoTeste(true);
    setTesteResultado(null);
    try {
      const res = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: testeTelefone, mensagem: testeMensagem }),
      });
      const data = await res.json();
      if (res.ok) {
        setTesteResultado({ success: true, message: 'Mensagem enviada com sucesso! Verifique o WhatsApp.' });
        showToast('Mensagem de teste enviada!', 'success');
      } else {
        setTesteResultado({ success: false, message: data.error || 'Erro ao enviar' });
        showToast('Erro ao enviar teste', 'error');
      }
    } catch (err) {
      setTesteResultado({ success: false, message: 'Erro de conexao' });
    } finally {
      setEnviandoTeste(false);
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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'painel', label: 'Painel', icon: '📊' },
    { id: 'templates', label: 'Templates', icon: '📝' },
    { id: 'historico', label: 'Historico', icon: '📋' },
    { id: 'teste', label: 'Testar Envio', icon: '🧪' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-green-50/30 to-white">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-fade-in ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 px-4 sm:px-6 py-6 sm:py-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.push('/admin')} className="text-white/70 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.71-1.398A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.24 0-4.326-.665-6.073-1.803l-.424-.27-2.79.827.757-2.675-.294-.44A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">WhatsApp Automatico</h1>
              <p className="text-white/70 text-sm">Mensagens automaticas para seus clientes</p>
            </div>
          </div>

          {/* Stats rapidos no header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/60 text-xs font-medium">Total Enviadas</p>
              <p className="text-2xl font-bold text-white">{stats.enviados}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/60 text-xs font-medium">Pendentes</p>
              <p className="text-2xl font-bold text-amber-300">{stats.pendentes}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/60 text-xs font-medium">Com Erro</p>
              <p className="text-2xl font-bold text-red-300">{stats.erros}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3">
              <p className="text-white/60 text-xs font-medium">Total Geral</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/60 backdrop-blur-sm rounded-2xl p-1.5 border border-gray-200/50 shadow-sm overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTabAtiva(tab.id)}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-medium text-sm transition-all whitespace-nowrap ${
                tabAtiva === tab.id
                  ? 'bg-white shadow-md text-green-700 border border-green-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* TAB: PAINEL */}
        {/* ============================================================ */}
        {tabAtiva === 'painel' && (
          <div className="space-y-6">
            {/* Status da Integracao */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Status da Integracao</h2>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-4 h-4 rounded-full ${config?.zapi_configurado ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <div>
                    <p className="font-semibold text-gray-800">
                      Z-API {config?.zapi_configurado ? 'Conectado' : 'Nao Configurado'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {config?.zapi_configurado ? 'Pronto para enviar mensagens' : 'Configure as credenciais no Vercel'}
                    </p>
                  </div>
                </div>

                {config && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-medium mb-1">Instance ID</p>
                      <p className="text-sm font-mono text-gray-700">{config.zapi_instance_id}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-500 font-medium mb-1">Token</p>
                      <p className="text-sm font-mono text-gray-700">{config.zapi_token}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Fluxo de Automacao */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Fluxo de Automacao</h2>
              </div>
              <div className="p-6">
                <div className="space-y-0">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg">✅</div>
                      <div className="w-0.5 h-8 bg-gray-200 my-1" />
                    </div>
                    <div className="pb-6">
                      <h3 className="font-semibold text-gray-800">Confirmacao de Agendamento</h3>
                      <p className="text-sm text-gray-500">Enviada <span className="font-medium text-emerald-600">imediatamente</span> ao criar um agendamento</p>
                      <span className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        templates.find(t => t.tipo === 'confirmacao')?.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${templates.find(t => t.tipo === 'confirmacao')?.ativo ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {templates.find(t => t.tipo === 'confirmacao')?.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-lg">🔔</div>
                      <div className="w-0.5 h-8 bg-gray-200 my-1" />
                    </div>
                    <div className="pb-6">
                      <h3 className="font-semibold text-gray-800">Lembrete</h3>
                      <p className="text-sm text-gray-500">Enviado <span className="font-medium text-sky-600">{config?.tempo_lembrete || '24 horas antes'}</span> do horario agendado</p>
                      <span className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        templates.find(t => t.tipo === 'lembrete')?.ativo ? 'bg-sky-50 text-sky-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${templates.find(t => t.tipo === 'lembrete')?.ativo ? 'bg-sky-500' : 'bg-gray-400'}`} />
                        {templates.find(t => t.tipo === 'lembrete')?.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-lg">💖</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">Pos-Venda</h3>
                      <p className="text-sm text-gray-500">Enviado <span className="font-medium text-pink-600">{config?.tempo_pos_venda || '15 min apos conclusao'}</span> do atendimento</p>
                      <span className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        templates.find(t => t.tipo === 'pos_venda')?.ativo ? 'bg-pink-50 text-pink-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${templates.find(t => t.tipo === 'pos_venda')?.ativo ? 'bg-pink-500' : 'bg-gray-400'}`} />
                        {templates.find(t => t.tipo === 'pos_venda')?.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Configuracoes */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Configuracoes</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">⏰</span>
                      <p className="text-xs text-gray-500 font-medium">Cron de Processamento</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{config?.cron_schedule || '1x por dia (08:00)'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">🔄</span>
                      <p className="text-xs text-gray-500 font-medium">Max. Tentativas (erro)</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{config?.max_tentativas || 3} tentativas</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">📱</span>
                      <p className="text-xs text-gray-500 font-medium">Provedor</p>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">Z-API</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB: TEMPLATES */}
        {/* ============================================================ */}
        {tabAtiva === 'templates' && (
          <div className="space-y-6">
            {/* Placeholders */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Placeholders disponiveis</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PLACEHOLDERS_PREVIEW).map(([key, val]) => (
                  <span key={key} className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-100 rounded-lg text-sm">
                    <code className="font-mono text-green-700 font-bold">{key}</code>
                    <span className="text-gray-300">→</span>
                    <span className="text-gray-500 text-xs">{val}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Cards de templates */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                    template.ativo ? 'border-gray-200/60' : 'border-gray-200 opacity-50'
                  }`}
                >
                  <div className={`bg-gradient-to-r ${TIPO_GRADIENTS[template.tipo]} px-5 py-4`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{TIPO_ICONS[template.tipo]}</span>
                        <div>
                          <h3 className="font-bold text-white">{template.titulo}</h3>
                          <span className="text-white/70 text-xs">{TIPO_LABELS[template.tipo]}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleAtivo(template)}
                        className={`relative w-11 h-6 rounded-full transition-all ${
                          template.ativo ? 'bg-white/30' : 'bg-black/20'
                        }`}
                        title={template.ativo ? 'Desativar' : 'Ativar'}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                          template.ativo ? 'left-[22px]' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    {/* Preview estilo WhatsApp */}
                    <div className="bg-[#e8e0d8] rounded-xl p-3 mb-4">
                      <div className="bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                          {aplicarPreview(template.template)}
                        </p>
                        <span className="text-[9px] text-gray-400 float-right mt-1">14:30 ✓✓</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        {formatarDataHora(template.updated_at)}
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
        {/* TAB: HISTORICO */}
        {/* ============================================================ */}
        {tabAtiva === 'historico' && (
          <div className="space-y-5">
            {/* Filtros */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => { setFiltroTipo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-green-200 focus:border-green-300"
                  >
                    <option value="todos">Todos</option>
                    <option value="confirmacao">Confirmacao</option>
                    <option value="lembrete">Lembrete</option>
                    <option value="pos_venda">Pos-Venda</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => { setFiltroStatus(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-green-200 focus:border-green-300"
                  >
                    <option value="todos">Todos</option>
                    <option value="enviado">Enviado</option>
                    <option value="pendente">Pendente</option>
                    <option value="erro">Erro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Inicio</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => { setDataInicio(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-green-200 focus:border-green-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => { setDataFim(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-green-200 focus:border-green-300"
                  />
                </div>
              </div>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              {loadingMensagens ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent"></div>
                </div>
              ) : mensagens.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 font-medium">Nenhuma mensagem encontrada</p>
                  <p className="text-gray-300 text-sm mt-1">As mensagens aparecerao aqui apos os envios</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Data</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Telefone</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tent.</th>
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Enviado em</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {mensagens.map((msg) => (
                          <tr key={msg.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {formatarDataHora(msg.created_at)}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-800">
                              {msg.clientes?.nome || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-sm">
                                <span className="text-base">{TIPO_ICONS[msg.tipo]}</span>
                                <span className="text-gray-600">{TIPO_LABELS[msg.tipo] || msg.tipo}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 font-mono text-xs">
                              {msg.telefone_destino}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[msg.status]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[msg.status]?.dot || 'bg-gray-400'}`} />
                                {msg.status}
                              </span>
                              {msg.erro_mensagem && (
                                <p className="text-[11px] text-red-400 mt-1 max-w-[180px] truncate" title={msg.erro_mensagem}>
                                  {msg.erro_mensagem}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-center">
                              {msg.tentativas}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {msg.data_envio ? formatarDataHora(msg.data_envio) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {total} mensagem(ns) · Pagina {page}/{totalPages}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          Anterior
                        </button>
                        <button
                          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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

        {/* ============================================================ */}
        {/* TAB: TESTE */}
        {/* ============================================================ */}
        {tabAtiva === 'teste' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Enviar Mensagem de Teste</h2>
                <p className="text-sm text-gray-500 mt-0.5">Envie uma mensagem para verificar se a integracao Z-API esta funcionando</p>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Numero do WhatsApp</label>
                  <input
                    type="text"
                    value={testeTelefone}
                    onChange={(e) => setTesteTelefone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-300 focus:bg-white transition-colors"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Digite com DDD, ex: (11) 98765-4321</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mensagem</label>
                  <textarea
                    value={testeMensagem}
                    onChange={(e) => setTesteMensagem(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-300 focus:bg-white resize-none transition-colors"
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Preview</label>
                  <div className="bg-[#e8e0d8] rounded-xl p-4">
                    <div className="bg-white rounded-lg p-3 shadow-sm max-w-[80%]">
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {testeMensagem}
                      </p>
                      <span className="text-[9px] text-gray-400 float-right mt-1">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={enviarTeste}
                  disabled={enviandoTeste}
                  className="w-full !bg-green-600 hover:!bg-green-700"
                >
                  {enviandoTeste ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Enviando...
                    </span>
                  ) : (
                    '📤 Enviar Mensagem de Teste'
                  )}
                </Button>

                {testeResultado && (
                  <div className={`rounded-xl p-4 text-sm font-medium ${
                    testeResultado.success
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {testeResultado.success ? '✅' : '❌'} {testeResultado.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL DE EDICAO */}
      {/* ============================================================ */}
      {editingTemplate && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingTemplate(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto animate-modal-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${TIPO_GRADIENTS[editingTemplate.tipo]} px-6 py-5 rounded-t-2xl`}>
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Template da Mensagem</label>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={16}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-mono focus:ring-2 focus:ring-green-200 focus:border-green-300 resize-none focus:bg-white transition-colors"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Placeholders: <code className="text-green-600">{'{nome}'}</code> <code className="text-green-600">{'{profissional}'}</code> <code className="text-green-600">{'{data}'}</code> <code className="text-green-600">{'{horario}'}</code>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Preview no WhatsApp</label>
                  <div className="bg-[#e8e0d8] rounded-xl p-4 min-h-[340px]">
                    <div className="bg-white rounded-lg p-3 shadow-sm max-w-[90%]">
                      <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                        {aplicarPreview(editText)}
                      </p>
                      <span className="text-[9px] text-gray-400 float-right mt-1">14:30 ✓✓</span>
                    </div>
                  </div>
                </div>
              </div>

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
