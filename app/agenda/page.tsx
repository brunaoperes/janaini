'use client';

import { useState, useEffect } from 'react';
export const dynamic = 'force-dynamic';
import { supabase, Colaborador, Agendamento, Cliente, Servico } from '@/lib/supabase';
import { format, startOfDay, endOfDay, parseISO, differenceInMinutes, parse } from 'date-fns';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import ClienteAutocomplete from '@/components/ClienteAutocomplete';
import WhatsAppStatusBanner from '@/components/WhatsAppStatusBanner';
import toast from 'react-hot-toast';

// Paleta de cores para colaboradores
const COLABORADOR_COLORS = [
  { gradient: 'from-pink-400 to-pink-600', bg: 'bg-pink-50', border: 'border-pink-300', text: 'text-pink-700', shadow: 'shadow-pink-500/20' },
  { gradient: 'from-purple-400 to-purple-600', bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', shadow: 'shadow-purple-500/20' },
  { gradient: 'from-lilac-400 to-lilac-600', bg: 'bg-lilac-50', border: 'border-lilac-300', text: 'text-lilac-700', shadow: 'shadow-lilac-500/20' },
  { gradient: 'from-rose-400 to-rose-600', bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', shadow: 'shadow-rose-500/20' },
  { gradient: 'from-fuchsia-400 to-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', text: 'text-fuchsia-700', shadow: 'shadow-fuchsia-500/20' },
  { gradient: 'from-violet-400 to-violet-600', bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', shadow: 'shadow-violet-500/20' },
];

// Helper para parsear data como horário LOCAL, ignorando timezone do PostgreSQL
// PostgreSQL retorna: "2025-11-19T18:30:00+00:00"
// Queremos interpretar: 18:30 como horário local (não UTC)
const parseAsLocalTime = (dataHora: string): Date => {
  // Remover timezone (+00:00, Z, etc) da string
  const semTimezone = dataHora.replace(/([+-]\d{2}:\d{2}|Z)$/, '');

  // Parsear como local (formato: YYYY-MM-DDTHH:MM:SS ou YYYY-MM-DD HH:MM:SS)
  const partes = semTimezone.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);

  if (partes) {
    const [_, ano, mes, dia, hora, minuto, segundo] = partes;
    return new Date(
      parseInt(ano),
      parseInt(mes) - 1, // Mês é 0-indexed
      parseInt(dia),
      parseInt(hora),
      parseInt(minuto),
      parseInt(segundo)
    );
  }

  // Fallback: usar parseISO (vai fazer conversão UTC)
  return parseISO(dataHora);
};

export default function AgendaPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedAgendamento, setSelectedAgendamento] = useState<Agendamento | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredAgendamento, setHoveredAgendamento] = useState<number | null>(null);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [userProfile, setUserProfile] = useState<{ isAdmin: boolean; colaboradorId: number | null }>({ isAdmin: true, colaboradorId: null });

  // Estados para Drag & Drop
  const [draggedAgendamento, setDraggedAgendamento] = useState<Agendamento | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    novoHorario: string; // Horário onde o card vai começar (para salvar)
    horarioMouse: string; // Horário onde o mouse está (para mostrar)
    novoColaboradorId: number;
    posicaoX: number;
    linhaIndex: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState<number>(0); // Offset entre mouse e início do card

  // Estados para Resize
  const [resizingAgendamento, setResizingAgendamento] = useState<Agendamento | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    novaDuracao: number; // em minutos
    larguraPercent: number;
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Estados para Drawer de Edição
  const [isEditMode, setIsEditMode] = useState(false);
  const [isFinalizando, setIsFinalizando] = useState(false);
  const [finalizarData, setFinalizarData] = useState({
    forma_pagamento: 'pix',
    valor_pago: '',
    is_fiado: false,
    is_troca_gratis: false,
    valor_referencia: '',
  });

  // Estados para serviço compartilhado na finalização
  const [compartilhadoFinal, setCompartilhadoFinal] = useState(false);
  const [divisoesFinal, setDivisoesFinal] = useState<{ colaborador_id: number; valor: string }[]>([]);

  // Estados para edição de forma de pagamento (atendimentos concluídos)
  const [formasPagamentoDB, setFormasPagamentoDB] = useState<{ id: number; nome: string; codigo: string; icone: string; taxa_percentual: number; ativo: boolean }[]>([]);
  const [selectedColaboradorEdit, setSelectedColaboradorEdit] = useState<Colaborador | null>(null);
  const [editIsCompleted, setEditIsCompleted] = useState(false);

  const [editData, setEditData] = useState({
    colaborador_id: '',
    cliente_id: '',
    data: selectedDate,
    hora_inicio: '',
    hora_fim: '',
    descricao_servico: '',
    observacoes: '',
    valor_total: '',
    forma_pagamento: '',
    is_fiado: false,
    is_troca_gratis: false,
    valor_referencia: '',
  });

  // Estado do formulário de novo agendamento
  const [formData, setFormData] = useState({
    colaborador_id: '',
    cliente_id: '',
    data: selectedDate,
    hora_inicio: '',
    hora_fim: '',
    descricao_servico: '',
    valor_servico: '',
    observacoes: '',
  });

  // Estado para seleção múltipla de serviços (novo agendamento)
  const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);

  // Estado para cliente selecionado no formulário (novo agendamento)
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  // Estado para seleção múltipla de serviços (edição)
  const [servicosSelecionadosEdit, setServicosSelecionadosEdit] = useState<string[]>([]);

  // Estado para filtro de pesquisa de serviços
  const [filtroServico, setFiltroServico] = useState('');

  // Serviços agora são carregados dinamicamente do banco de dados
  // Ver tabela 'servicos' e página /admin/servicos para gerenciamento

  // Atualizar hora atual a cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Atualiza a cada 1 minuto

    return () => clearInterval(timer);
  }, []);

  // Atualizar status dos agendamentos automaticamente
  // Quando o horário chegar, muda de "pendente" para "executando"
  useEffect(() => {
    const atualizarStatusAgendamentos = async () => {
      const agora = new Date();
      const hoje = format(agora, 'yyyy-MM-dd');

      // Só atualiza se estiver vendo o dia de hoje
      if (selectedDate !== hoje) return;

      // Filtrar agendamentos pendentes cujo horário já passou
      const agendamentosParaAtualizar = agendamentos.filter(ag => {
        if (ag.status !== 'pendente') return false;

        const dataHoraAgendamento = parseAsLocalTime(ag.data_hora);
        return dataHoraAgendamento <= agora;
      });

      // Atualizar status para "executando"
      for (const ag of agendamentosParaAtualizar) {
        await supabase
          .from('agendamentos')
          .update({ status: 'executando' })
          .eq('id', ag.id);
      }

      // Se atualizou algum, recarregar dados
      if (agendamentosParaAtualizar.length > 0) {
        loadData();
      }
    };

    // Executar imediatamente e a cada minuto
    atualizarStatusAgendamentos();
    const timer = setInterval(atualizarStatusAgendamentos, 60000);

    return () => clearInterval(timer);
  }, [agendamentos, selectedDate]);

  useEffect(() => {
    loadData();
    // Atualizar data do formulário quando a data selecionada mudar
    setFormData(prev => ({ ...prev, data: selectedDate }));
  }, [selectedDate]);

  const loadData = async () => {
    setLoading(true);

    try {
      // Usar API para buscar dados (bypass RLS)
      const response = await fetch(`/api/agenda?data=${selectedDate}`);
      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }
      const data = await response.json();

      const colaboradoresData = data.colaboradores || [];
      const servicosData = data.servicos || [];

      const isAdmin = data._userProfile?.isAdmin ?? true;
      const colaboradorId = data._userProfile?.colaboradorId || null;
      setUserProfile({ isAdmin, colaboradorId });

      // Colaborador não-admin: filtrar lista de colaboradores para mostrar só o dele
      if (!isAdmin && colaboradorId) {
        setColaboradores(colaboradoresData.filter((c: any) => c.id === Number(colaboradorId)));
      } else {
        setColaboradores(colaboradoresData);
      }

      setClientes(data.clientes || []);
      setServicos(servicosData);
      setAgendamentos(data.agendamentos || []);
      setFormasPagamentoDB(data.formasPagamento || []);

      // Pré-selecionar colaborador do usuário logado (se tiver colaboradorId)
      if (colaboradorId) {
        setFormData(prev => ({
          ...prev,
          colaborador_id: colaboradorId.toString(),
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gera horários de 06:00 às 22:00 (apenas horários inteiros)
  // Para o HEADER (texto visível)
  // Retorna array com horários formatados: ['06:00', '07:00', '08:00', ...]
  const gerarHorarios = () => {
    const horarios = [];
    for (let hora = 6; hora <= 22; hora++) {
      horarios.push(`${hora.toString().padStart(2, '0')}:00`);
    }
    return horarios;
  };

  // Gera horários a cada 30 minutos de 06:00 às 22:00
  // Para o GRID (linhas verticais de referência)
  // Retorna array: ['06:00', '06:30', '07:00', '07:30', ...]
  const gerarHorariosGrid = () => {
    const horarios = [];
    for (let hora = 6; hora <= 22; hora++) {
      horarios.push(`${hora.toString().padStart(2, '0')}:00`);
      if (hora < 22) {
        horarios.push(`${hora.toString().padStart(2, '0')}:30`);
      }
    }
    return horarios;
  };

  // ⚡ FÓRMULA ÚNICA - Calcula posição baseado em MINUTOS
  // Timeline: 06:00 às 22:00 = 16 horas = 960 minutos
  const calcularPosicaoBarra = (dataHora: string, duracao: number = 60) => {
    const hora = parseAsLocalTime(dataHora);

    // Constantes da timeline (em minutos)
    const INICIO_TIMELINE = 6 * 60; // 06:00 = 360 minutos
    const FIM_TIMELINE = 22 * 60;   // 22:00 = 1320 minutos
    const TOTAL_MINUTOS = FIM_TIMELINE - INICIO_TIMELINE; // 960 minutos

    // Converter horário do agendamento para minutos desde meia-noite
    const minutosDesdeMeiaNoite = hora.getHours() * 60 + hora.getMinutes();

    // Calcular minutos desde o início da timeline (06:00)
    const minutosDesdeInicio = minutosDesdeMeiaNoite - INICIO_TIMELINE;

    // Calcular posição percentual
    const left = (minutosDesdeInicio / TOTAL_MINUTOS) * 100;
    const width = (duracao / TOTAL_MINUTOS) * 100;

    return { left: `${left}%`, width: `${width}%` };
  };

  // Calcula o progresso da barra baseado no horário atual
  const calcularProgresso = (dataHora: string, duracao: number = 60) => {
    const dataAgendamento = parseAsLocalTime(dataHora);
    const inicio = dataAgendamento;
    const fim = new Date(inicio.getTime() + duracao * 60000);

    // Se ainda não começou
    if (currentTime < inicio) return 0;

    // Se já terminou
    if (currentTime > fim) return 100;

    // Calcular progresso
    const totalMinutos = differenceInMinutes(fim, inicio);
    const minutosDecorridos = differenceInMinutes(currentTime, inicio);

    return (minutosDecorridos / totalMinutos) * 100;
  };

  // Pega cor do colaborador
  const getColaboradorColor = (index: number) => {
    return COLABORADOR_COLORS[index % COLABORADOR_COLORS.length];
  };

  // Formatar horário
  const formatarHorario = (dataHora: string) => {
    return format(parseAsLocalTime(dataHora), 'HH:mm');
  };

  // Obter ícone do serviço
  const getServicoIcon = (servico: string) => {
    const servicoLower = servico.toLowerCase();
    if (servicoLower.includes('corte') || servicoLower.includes('cabelo')) {
      return '✂️';
    } else if (servicoLower.includes('escova') || servicoLower.includes('penteado')) {
      return '💇';
    } else if (servicoLower.includes('unha') || servicoLower.includes('manicure') || servicoLower.includes('pedicure')) {
      return '💅';
    } else if (servicoLower.includes('maquiagem')) {
      return '💄';
    } else if (servicoLower.includes('sobrancelha')) {
      return '👁️';
    } else if (servicoLower.includes('depilação')) {
      return '🪒';
    } else if (servicoLower.includes('coloração') || servicoLower.includes('luzes') || servicoLower.includes('progressiva') || servicoLower.includes('hidratação')) {
      return '🎨';
    }
    return '✨';
  };

  // ============== FUNÇÕES DE DRAG & DROP ==============

  // ⚡ FÓRMULA ÚNICA - Calcular novo horário baseado na posição X do mouse
  // USA A MESMA BASE DE MINUTOS que os cards, header e linha "Agora"
  const calcularNovoHorario = (clientX: number, timelineRect: DOMRect) => {
    // Constantes da timeline (em minutos) - MESMA BASE DE TUDO
    const INICIO_TIMELINE = 6 * 60;  // 06:00 = 360 minutos
    const FIM_TIMELINE = 22 * 60;     // 22:00 = 1320 minutos
    const TOTAL_MINUTOS = FIM_TIMELINE - INICIO_TIMELINE; // 960 minutos

    // Calcular posição relativa na timeline (0 a 1)
    const posicaoRelativa = (clientX - timelineRect.left) / timelineRect.width;

    // Converter para minutos desde o início da timeline
    const minutosDesdeInicio = posicaoRelativa * TOTAL_MINUTOS;

    // Snap para intervalos de 30 minutos
    const minutosSnap = Math.round(minutosDesdeInicio / 30) * 30;

    // Converter de volta para minutos desde meia-noite
    let minutosDesdeMeiaNoite = INICIO_TIMELINE + minutosSnap;

    // Garantir que está dentro dos limites
    minutosDesdeMeiaNoite = Math.max(INICIO_TIMELINE, Math.min(FIM_TIMELINE, minutosDesdeMeiaNoite));

    // Converter para horas e minutos
    const hora = Math.floor(minutosDesdeMeiaNoite / 60);
    const minutos = minutosDesdeMeiaNoite % 60;

    const resultado = `${String(hora).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:00`;
    return resultado;
  };

  // Detectar em qual linha de colaborador o mouse está
  const detectarLinhaColaborador = (clientY: number, timelineContainer: HTMLElement) => {
    const linhas = timelineContainer.querySelectorAll('[data-colaborador-id]');
    let linhaIndex = -1;
    let colaboradorId = -1;

    linhas.forEach((linha, index) => {
      const rect = linha.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        linhaIndex = index;
        colaboradorId = Number((linha as HTMLElement).dataset.colaboradorId);
      }
    });

    return { linhaIndex, colaboradorId };
  };

  // Iniciar drag
  const handleDragStart = (e: React.DragEvent, agendamento: Agendamento) => {
    e.dataTransfer.effectAllowed = 'move';
    // Criar uma imagem de drag transparente (escondida)
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);

    // ⚡ Calcular offset entre mouse e início do card
    const cardElement = e.currentTarget as HTMLElement;
    const cardRect = cardElement.getBoundingClientRect();
    const offsetX = e.clientX - cardRect.left;

    setDragOffsetX(offsetX);
    setDraggedAgendamento(agendamento);
    setIsDragging(true);
  };

  // Durante o drag
  const handleDrag = (e: React.DragEvent) => {
    if (!draggedAgendamento || e.clientX === 0) return;

    const timelineContainer = document.querySelector('[data-timeline-container]');
    if (!timelineContainer) return;

    const timelineRect = timelineContainer.getBoundingClientRect();

    // ⚡ CORREÇÃO: Precisamos calcular relativo à ÁREA DE TIMELINE, não ao container inteiro
    // A coluna de nomes tem 12rem (192px), então a timeline começa 192px à direita
    const LARGURA_COLUNA_NOMES = 192; // 12rem = 192px
    const timelineAreaLeft = timelineRect.left + LARGURA_COLUNA_NOMES;
    const timelineAreaWidth = timelineRect.width - LARGURA_COLUNA_NOMES;

    // Criar um DOMRect virtual para a área de timeline (excluindo coluna de nomes)
    const timelineAreaRect = {
      left: timelineAreaLeft,
      width: timelineAreaWidth,
    } as DOMRect;

    // ⚡ LINHA, HORÁRIO E SALVAMENTO seguem EXATAMENTE O MOUSE
    // O card sempre vai para onde o mouse está (ignorando onde foi clicado)
    const horarioMouse = calcularNovoHorario(e.clientX, timelineAreaRect);
    const horarioCard = horarioMouse; // Mesmo horário para mostrar e salvar

    const { linhaIndex, colaboradorId } = detectarLinhaColaborador(e.clientY, timelineContainer as HTMLElement);

    if (colaboradorId !== -1) {
      const posicaoX = ((e.clientX - timelineAreaLeft) / timelineAreaWidth) * 100;

      setDragPreview({
        novoHorario: horarioCard, // Salva o horário do início do card
        horarioMouse: horarioMouse, // Mostra o horário do mouse
        novoColaboradorId: colaboradorId,
        posicaoX,
        linhaIndex,
      });
    }
  };

  // Finalizar drag
  const handleDragEnd = async (e: React.DragEvent) => {
    if (!draggedAgendamento || !dragPreview) {
      setIsDragging(false);
      setDraggedAgendamento(null);
      setDragPreview(null);
      setDragOffsetX(0);
      return;
    }

    // Atualizar no banco de dados - salvar sem timezone (PostgreSQL vai armazenar como TIMESTAMP)
    // Formato: 2025-11-19 17:00:00 (sem T e sem timezone)
    const novoDataHora = `${selectedDate} ${dragPreview.novoHorario}`;

    const { error } = await supabase
      .from('agendamentos')
      .update({
        data_hora: novoDataHora,
        colaborador_id: dragPreview.novoColaboradorId,
      })
      .eq('id', draggedAgendamento.id)
      .select('*, clientes!fk_agendamentos_cliente(*), colaboradores!fk_agendamentos_colaborador(*)');

    if (error) {
      console.error('Erro ao atualizar agendamento:', error);
      toast.error('Erro ao mover agendamento: ' + error.message);
    } else {
      toast.success(`Movido para ${dragPreview.novoHorario.substring(0, 5)}!`);
      // Recarregar dados
      await loadData();
    }

    // Limpar estados
    setIsDragging(false);
    setDraggedAgendamento(null);
    setDragPreview(null);
    setDragOffsetX(0);
  };

  // ============== FUNÇÕES DE RESIZE ==============

  // Calcular nova duração baseada na posição do mouse na timeline
  const calcularNovaDuracao = (clientX: number, agendamento: Agendamento, cardElement: HTMLElement) => {
    const timelineContainer = document.querySelector('[data-timeline-container]');
    if (!timelineContainer) return null;

    const timelineRect = timelineContainer.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    // Timeline tem 16 horas (06:00 às 22:00) = 960 minutos
    const totalMinutosTimeline = 16 * 60;

    // Calcular posição do início do card em relação à timeline (em porcentagem)
    const cardStartPercent = ((cardRect.left - timelineRect.left) / timelineRect.width) * 100;

    // Calcular posição do mouse em relação à timeline (em porcentagem)
    const mousePercent = ((clientX - timelineRect.left) / timelineRect.width) * 100;

    // A largura do card é a diferença entre a posição do mouse e o início do card
    const larguraPercent = Math.max(mousePercent - cardStartPercent, 1.56); // Mínimo ~15min

    // Converter porcentagem para minutos
    const novaDuracaoMinutos = (larguraPercent / 100) * totalMinutosTimeline;

    // Snap para intervalos de 15 minutos (só para o valor final, não para o preview)
    const duracaoSnap = Math.max(15, Math.round(novaDuracaoMinutos / 15) * 15);

    return {
      novaDuracao: duracaoSnap,
      // IMPORTANTE: usar larguraPercent do mouse para preview seguir o cursor!
      larguraPercent: larguraPercent,
    };
  };

  // Iniciar resize
  const handleResizeStart = (e: React.MouseEvent, agendamento: Agendamento) => {
    e.preventDefault();
    e.stopPropagation();

    setResizingAgendamento(agendamento);
    setIsResizing(true);

    const timelineContainer = document.querySelector('[data-timeline-container]');
    const cardElement = document.querySelector(`[data-agendamento-id="${agendamento.id}"]`) as HTMLElement;

    if (!timelineContainer || !cardElement) {
      setIsResizing(false);
      setResizingAgendamento(null);
      return;
    }

    const timelineRect = timelineContainer.getBoundingClientRect();
    const cardRect = cardElement.getBoundingClientRect();

    // Timeline tem 16 horas (06:00 às 22:00) = 960 minutos
    const totalMinutosTimeline = 16 * 60;
    const INICIO_TIMELINE = 6 * 60; // 06:00 = 360 minutos

    // Duração atual do agendamento
    const duracaoMinutos = agendamento.duracao_minutos || 60;

    // Extrair hora de início do agendamento
    const dataHoraStr = agendamento.data_hora;
    let horaInicio = 9;
    let minutoInicio = 0;
    if (dataHoraStr.includes('T')) {
      const [h, m] = dataHoraStr.split('T')[1].substring(0, 5).split(':');
      horaInicio = parseInt(h);
      minutoInicio = parseInt(m);
    } else if (dataHoraStr.includes(' ')) {
      const [h, m] = dataHoraStr.split(' ')[1].substring(0, 5).split(':');
      horaInicio = parseInt(h);
      minutoInicio = parseInt(m);
    }

    // Minutos desde 06:00 onde o card COMEÇA
    const minutosInicioAgendamento = (horaInicio * 60 + minutoInicio) - INICIO_TIMELINE;

    // Posição LEFT do card em porcentagem (calculada pela mesma fórmula que renderiza)
    const cardLeftPercent = (minutosInicioAgendamento / totalMinutosTimeline) * 100;
    const cardStartX = (cardLeftPercent / 100) * timelineRect.width;

    // Posição inicial do mouse (para calcular delta)
    const initialMouseX = e.clientX;

    // Variável para armazenar o último resultado
    let ultimoResultado: { novaDuracao: number; larguraPercent: number } | null = null;
    let moveCount = 0;

    // Largura inicial do card em pixels (baseado na duração atual)
    const duracaoPercentInicial = (duracaoMinutos / totalMinutosTimeline) * 100;
    const larguraInicialPx = (duracaoPercentInicial / 100) * timelineRect.width;

    // Event listener para mousemove
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveCount++;

      // ABORDAGEM DELTA: quanto o mouse se moveu desde o início
      const deltaX = moveEvent.clientX - initialMouseX;

      // Nova largura = largura inicial (baseada na duração) + delta
      const newCardWidthPx = Math.max(larguraInicialPx + deltaX, 15);

      // Converter largura para porcentagem da timeline
      const larguraPercent = (newCardWidthPx / timelineRect.width) * 100;

      // Converter porcentagem para minutos
      const novaDuracaoMinutos = (larguraPercent / 100) * totalMinutosTimeline;

      // Snap para intervalos de 15 minutos (só para salvar)
      const duracaoSnap = Math.max(15, Math.round(novaDuracaoMinutos / 15) * 15);

      const resultado = {
        novaDuracao: duracaoSnap,
        larguraPercent: larguraPercent,
      };

      ultimoResultado = resultado;
      setResizePreview(resultado);
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (!ultimoResultado) {
        setIsResizing(false);
        setResizingAgendamento(null);
        setResizePreview(null);
        return;
      }

      // ⚡ Snap para múltiplos de 15 minutos
      const duracaoSnap = Math.max(15, Math.round(ultimoResultado.novaDuracao / 15) * 15);

      // Salvar no banco de dados - agendamento
      const { error } = await supabase
        .from('agendamentos')
        .update({ duracao_minutos: duracaoSnap })
        .eq('id', agendamento.id);

      if (error) {
        console.error('Erro ao atualizar duração:', error);
        toast.error('Erro ao ajustar duração: ' + error.message);
      } else {
        // Calcular hora_fim baseado na duração
        // Extrair hora diretamente da string (evitar problemas de timezone)
        const dataHoraStr = agendamento.data_hora;
        let horaInicio = '09:00';

        // Tentar extrair hora da string (pode ser "2025-12-01 09:00:00" ou "2025-12-01T09:00:00")
        if (dataHoraStr.includes('T')) {
          horaInicio = dataHoraStr.split('T')[1].substring(0, 5);
        } else if (dataHoraStr.includes(' ')) {
          horaInicio = dataHoraStr.split(' ')[1].substring(0, 5);
        }

        const [hInicio, mInicio] = horaInicio.split(':').map(Number);
        const minutosFim = hInicio * 60 + mInicio + duracaoSnap;
        const horaFim = `${Math.floor(minutosFim / 60).toString().padStart(2, '0')}:${(minutosFim % 60).toString().padStart(2, '0')}`;

        // Atualizar lançamento vinculado (se existir)
        if (agendamento.lancamento_id) {
          const { error: lancError } = await supabase
            .from('lancamentos')
            .update({ hora_fim: horaFim })
            .eq('id', agendamento.lancamento_id);

          if (lancError) {
            console.error('Erro ao atualizar lançamento:', lancError);
          }
        }

        toast.success(`Duração ajustada para ${duracaoSnap} minutos (${horaInicio} - ${horaFim})`);
        // Recarregar dados para atualizar o card
        await loadData();
      }

      // Limpar estados
      setIsResizing(false);
      setResizingAgendamento(null);
      setResizePreview(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ============== FUNÇÕES DO DRAWER ==============

  // Ativar modo edição
  const ativarEdicao = async () => {
    if (!selectedAgendamento) return;

    const dataHora = parseAsLocalTime(selectedAgendamento.data_hora);
    const horaInicio = format(dataHora, 'HH:mm');
    const data = format(dataHora, 'yyyy-MM-dd');

    // Calcular hora fim baseado na duração
    const duracao = selectedAgendamento.duracao_minutos || 60;
    const dataFim = new Date(dataHora.getTime() + duracao * 60000);
    const horaFim = format(dataFim, 'HH:mm');

    // Parsear serviços do formato "Corte + Escova + Manicure"
    const servicosExistentes = selectedAgendamento.descricao_servico
      ? selectedAgendamento.descricao_servico.split(' + ').map(s => s.trim())
      : [];

    const isConcluido = selectedAgendamento.status === 'concluido';
    let valorTotal = '';
    let formaPagamento = '';
    let isFiado = false;
    let isTrocaGratis = false;
    let valorReferencia = '';

    // Buscar dados financeiros do lançamento (via API para bypass RLS)
    if (selectedAgendamento.lancamento_id) {
      try {
        const lancRes = await fetch(`/api/lancamentos/${selectedAgendamento.lancamento_id}`);
        if (lancRes.ok) {
          const lancResult = await lancRes.json();
          const lancFresh = lancResult.data || lancResult;
          if (lancFresh) {
            valorTotal = lancFresh.valor_total?.toFixed(2) || '';
            formaPagamento = lancFresh.forma_pagamento || '';
            isFiado = lancFresh.is_fiado || false;
            isTrocaGratis = lancFresh.is_troca_gratis || false;
            valorReferencia = lancFresh.valor_referencia ? lancFresh.valor_referencia.toString() : '';
          }
        }
      } catch {}
    } else if ((selectedAgendamento as any).lancamento?.valor_total) {
      valorTotal = (selectedAgendamento as any).lancamento.valor_total.toFixed(2);
    } else if (selectedAgendamento.valor_estimado) {
      valorTotal = selectedAgendamento.valor_estimado.toFixed(2);
    }

    // Setar colaborador selecionado para cálculo de comissão
    const colaboradorAtual = colaboradores.find(c => c.id === selectedAgendamento.colaborador_id);
    setSelectedColaboradorEdit(colaboradorAtual || null);
    setEditIsCompleted(isConcluido);

    setEditData({
      colaborador_id: selectedAgendamento.colaborador_id.toString(),
      cliente_id: selectedAgendamento.cliente_id.toString(),
      data: data,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      descricao_servico: selectedAgendamento.descricao_servico || '',
      observacoes: (selectedAgendamento as any).observacoes || '',
      valor_total: valorTotal,
      forma_pagamento: formaPagamento,
      is_fiado: isFiado,
      is_troca_gratis: isTrocaGratis,
      valor_referencia: valorReferencia,
    });
    setServicosSelecionadosEdit(servicosExistentes);
    setIsEditMode(true);
  };

  // Salvar alterações do drawer (agendamento + lançamento)
  const salvarEdicao = async () => {
    if (!selectedAgendamento) return;

    // Validar que pelo menos um serviço foi selecionado
    if (servicosSelecionadosEdit.length === 0) {
      toast.error('Selecione pelo menos um serviço!');
      return;
    }

    // Combinar serviços selecionados em uma string
    const descricaoServicos = servicosSelecionadosEdit.join(' + ');

    // Salvar sem timezone (formato: 2025-11-19 17:00:00)
    const novoDataHora = `${editData.data} ${editData.hora_inicio}:00`;

    // Calcular duração baseada em (hora_fim - hora_inicio)
    const [horaIni, minIni] = editData.hora_inicio.split(':').map(Number);
    const [horaFim, minFim] = editData.hora_fim.split(':').map(Number);
    const minutosInicio = horaIni * 60 + minIni;
    const minutosFim = horaFim * 60 + minFim;
    const duracaoMinutos = minutosFim - minutosInicio;

    // Validar duração
    if (duracaoMinutos <= 0) {
      toast.error('O horário de fim deve ser maior que o horário de início!');
      return;
    }

    // 1. Atualizar agendamento
    const { error } = await supabase
      .from('agendamentos')
      .update({
        colaborador_id: Number(editData.colaborador_id),
        cliente_id: Number(editData.cliente_id),
        data_hora: novoDataHora,
        descricao_servico: descricaoServicos,
        duracao_minutos: duracaoMinutos,
        observacoes: editData.observacoes || null,
      })
      .eq('id', selectedAgendamento.id)
      .select();

    if (error) {
      console.error('Erro ao atualizar agendamento:', error);
      toast.error('Erro ao atualizar: ' + error.message);
      return;
    }

    // 2. Atualizar lançamento vinculado (se existir)
    if (selectedAgendamento.lancamento_id) {
      const lancamentoUpdate: Record<string, any> = {
        colaborador_id: Number(editData.colaborador_id),
        cliente_id: Number(editData.cliente_id),
        data: novoDataHora,
        hora_inicio: editData.hora_inicio,
        hora_fim: editData.hora_fim,
        servicos_nomes: descricaoServicos,
      };

      // Atualizar valor total sempre que preenchido
      if (editData.valor_total) {
        const valorAtualizado = parseFloat(editData.valor_total) || 0;
        lancamentoUpdate.valor_total = valorAtualizado;

        // Recalcular comissões com o novo valor
        const porcentagem = selectedColaboradorEdit?.porcentagem_comissao || 50;
        const comissaoBruta = (valorAtualizado * porcentagem) / 100;
        lancamentoUpdate.comissao_colaborador = comissaoBruta;
        lancamentoUpdate.comissao_salao = valorAtualizado - comissaoBruta;
      }

      // Se é atendimento concluído, atualizar também dados de pagamento
      if (editIsCompleted) {
        // Validar forma de pagamento
        if (!editData.forma_pagamento && !editData.is_fiado && !editData.is_troca_gratis) {
          toast.error('Selecione uma forma de pagamento!');
          return;
        }

        const valorTotal = editData.is_troca_gratis ? 0 : parseFloat(editData.valor_total) || 0;

        if (!editData.is_fiado && !editData.is_troca_gratis && valorTotal <= 0) {
          toast.error('O valor total deve ser maior que zero!');
          return;
        }

        // Buscar taxa da forma de pagamento
        let taxaPercentual = 0;
        let valorTaxa = 0;
        if (!editData.is_fiado && !editData.is_troca_gratis && editData.forma_pagamento) {
          const { data: formaPagamento } = await supabase
            .from('formas_pagamento')
            .select('taxa_percentual')
            .eq('codigo', editData.forma_pagamento)
            .single();

          taxaPercentual = formaPagamento?.taxa_percentual || 0;
          valorTaxa = (valorTotal * taxaPercentual) / 100;
        }

        // Calcular comissões
        let comissaoColaborador = 0;
        let comissaoSalao = 0;

        if (editData.is_troca_gratis) {
          comissaoColaborador = 0;
          comissaoSalao = 0;
        } else if (editData.is_fiado) {
          const porcentagem = selectedColaboradorEdit?.porcentagem_comissao || 50;
          const comissaoBruta = (valorTotal * porcentagem) / 100;
          comissaoColaborador = comissaoBruta;
          comissaoSalao = valorTotal - comissaoBruta;
        } else {
          const porcentagem = selectedColaboradorEdit?.porcentagem_comissao || 50;
          const comissaoBruta = (valorTotal * porcentagem) / 100;
          comissaoColaborador = comissaoBruta - valorTaxa;
          comissaoSalao = valorTotal - comissaoBruta;
        }

        // Determinar forma_pagamento_final, data_pagamento, status
        let formaPagamentoFinal = null;
        let dataPagamentoFinal = null;
        let statusFinal = 'concluido';

        if (editData.is_fiado) {
          formaPagamentoFinal = 'fiado';
          dataPagamentoFinal = null;
          statusFinal = 'pendente';
        } else if (editData.is_troca_gratis) {
          formaPagamentoFinal = 'troca_gratis';
          dataPagamentoFinal = new Date().toISOString();
          statusFinal = 'concluido';
        } else {
          formaPagamentoFinal = editData.forma_pagamento;
          dataPagamentoFinal = new Date().toISOString();
          statusFinal = 'concluido';
        }

        lancamentoUpdate.valor_total = valorTotal;
        lancamentoUpdate.comissao_colaborador = comissaoColaborador;
        lancamentoUpdate.comissao_salao = comissaoSalao;
        lancamentoUpdate.taxa_pagamento = valorTaxa;
        lancamentoUpdate.forma_pagamento = formaPagamentoFinal;
        lancamentoUpdate.data_pagamento = dataPagamentoFinal;
        lancamentoUpdate.status = statusFinal;
        lancamentoUpdate.is_fiado = editData.is_fiado || false;
        lancamentoUpdate.is_troca_gratis = editData.is_troca_gratis || false;
        lancamentoUpdate.valor_referencia = editData.is_troca_gratis && editData.valor_referencia
          ? parseFloat(editData.valor_referencia)
          : null;

        // Atualizar status do agendamento se mudou (ex: fiado → pendente)
        if (editData.is_fiado) {
          await supabase
            .from('agendamentos')
            .update({ status: 'pendente' })
            .eq('id', selectedAgendamento.id);
        } else {
          await supabase
            .from('agendamentos')
            .update({ status: 'concluido' })
            .eq('id', selectedAgendamento.id);
        }
      }

      const { error: lancError } = await supabase
        .from('lancamentos')
        .update(lancamentoUpdate)
        .eq('id', selectedAgendamento.lancamento_id);

      if (lancError) {
        console.error('Erro ao atualizar lançamento:', lancError);
      }
    }

    toast.success('Agendamento atualizado com sucesso!');
    setIsEditMode(false);
    setEditIsCompleted(false);
    setSelectedColaboradorEdit(null);
    setSelectedAgendamento(null);
    setFiltroServico('');
    // Se mudou a data, atualizar selectedDate
    if (editData.data !== selectedDate) {
      setSelectedDate(editData.data);
    }
    await loadData();
  };

  // Excluir agendamento (e lançamento vinculado)
  const excluirAgendamento = async () => {
    if (!selectedAgendamento) return;

    if (!confirm('⚠️ Tem certeza que deseja excluir este agendamento e o lançamento vinculado?')) {
      return;
    }

    // 1. Deletar lançamento vinculado (se existir)
    if (selectedAgendamento.lancamento_id) {
      await supabase
        .from('lancamentos')
        .delete()
        .eq('id', selectedAgendamento.lancamento_id);
    }

    // 2. Deletar agendamento
    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', selectedAgendamento.id);

    if (error) {
      console.error('Erro ao excluir agendamento:', error);
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Agendamento e lançamento excluídos com sucesso!');
      setSelectedAgendamento(null);
      await loadData();
    }
  };

  // Finalizar agendamento (marcar como concluído)
  const finalizarAgendamento = async () => {
    if (!selectedAgendamento) {
      toast.error('Nenhum agendamento selecionado');
      return;
    }

    // Validação: se não é fiado nem troca/grátis, precisa de forma de pagamento e valor
    if (!finalizarData.is_fiado && !finalizarData.is_troca_gratis) {
      if (!finalizarData.forma_pagamento || !finalizarData.valor_pago) {
        toast.error('Preencha a forma de pagamento e o valor');
        return;
      }
    }

    // Validação: se é serviço compartilhado
    if (compartilhadoFinal && !finalizarData.is_troca_gratis) {
      const colaboradoresValidos = divisoesFinal.filter(d => d.colaborador_id > 0);
      if (colaboradoresValidos.length < 2) {
        toast.error('Serviço compartilhado precisa de pelo menos 2 colaboradores');
        return;
      }
      const valorTotal = parseFloat(finalizarData.valor_pago) || 0;
      const somaDivisoes = divisoesFinal.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
      if (Math.abs(valorTotal - somaDivisoes) > 0.01) {
        toast.error('A soma das divisões deve ser igual ao valor total');
        return;
      }
    }

    try {
      // Determinar valor pago
      let valorPago = finalizarData.is_troca_gratis ? 0 : parseFloat(finalizarData.valor_pago);
      let lancamentoId = selectedAgendamento.lancamento_id;

      // Determinar status final
      // Fiado = pendente, Troca/Grátis = concluido, Normal = concluido
      const statusFinal = finalizarData.is_fiado ? 'pendente' : 'concluido';

      // Buscar taxa da forma de pagamento (apenas para pagamentos normais)
      let taxaPercentual = 0;
      let valorTaxa = 0;
      if (!finalizarData.is_fiado && !finalizarData.is_troca_gratis) {
        const { data: formaPagamento } = await supabase
          .from('formas_pagamento')
          .select('taxa_percentual')
          .eq('codigo', finalizarData.forma_pagamento)
          .single();

        taxaPercentual = formaPagamento?.taxa_percentual || 0;
        valorTaxa = (valorPago * taxaPercentual) / 100;
      }

      // Calcular comissões
      let comissaoColaborador = 0;
      let comissaoSalao = 0;

      if (finalizarData.is_troca_gratis) {
        // Troca/Grátis: comissões são zero
        comissaoColaborador = 0;
        comissaoSalao = 0;
      } else {
        // Buscar porcentagem do colaborador
        const { data: colaborador } = await supabase
          .from('colaboradores')
          .select('porcentagem_comissao')
          .eq('id', selectedAgendamento.colaborador_id)
          .single();

        const porcentagem = colaborador?.porcentagem_comissao || 50;
        const comissaoBruta = (valorPago * porcentagem) / 100;

        if (finalizarData.is_fiado) {
          // Fiado: comissões são calculadas mas não confirmadas até pagar
          comissaoColaborador = comissaoBruta;
          comissaoSalao = valorPago - comissaoBruta;
        } else {
          // Normal: taxa é descontada da comissão do colaborador
          comissaoColaborador = comissaoBruta - valorTaxa;
          comissaoSalao = valorPago - comissaoBruta;
        }
      }

      // Determinar forma de pagamento e data de pagamento
      let formaPagamentoFinal = finalizarData.forma_pagamento;
      let dataPagamentoFinal: string | null = new Date().toISOString();

      if (finalizarData.is_fiado) {
        formaPagamentoFinal = 'fiado';
        dataPagamentoFinal = null;
      } else if (finalizarData.is_troca_gratis) {
        formaPagamentoFinal = 'troca_gratis';
      }

      // Se o agendamento já tem lançamento vinculado, atualizar
      if (lancamentoId) {
        const { error: lancError } = await supabase
          .from('lancamentos')
          .update({
            status: statusFinal,
            forma_pagamento: formaPagamentoFinal,
            valor_total: valorPago,
            comissao_colaborador: comissaoColaborador,
            comissao_salao: comissaoSalao,
            taxa_pagamento: valorTaxa,
            data_pagamento: dataPagamentoFinal,
            is_fiado: finalizarData.is_fiado || false,
            is_troca_gratis: finalizarData.is_troca_gratis || false,
            valor_referencia: finalizarData.is_troca_gratis && finalizarData.valor_referencia
              ? parseFloat(finalizarData.valor_referencia)
              : null,
          })
          .eq('id', lancamentoId);

        if (lancError) throw lancError;
      } else {
        // Se não tem lançamento, criar um novo
        const dataAgendamento = selectedAgendamento.data_hora.split('T')[0];
        const horaAgendamento = selectedAgendamento.data_hora.split('T')[1]?.substring(0, 5) || '00:00';
        const dataLancamento = `${dataAgendamento}T${horaAgendamento}:00`;

        const { data: novoLancamento, error: lancError } = await supabase
          .from('lancamentos')
          .insert({
            colaborador_id: selectedAgendamento.colaborador_id,
            cliente_id: selectedAgendamento.cliente_id,
            servicos_nomes: selectedAgendamento.descricao_servico,
            valor_total: valorPago,
            forma_pagamento: formaPagamentoFinal,
            status: statusFinal,
            comissao_colaborador: comissaoColaborador,
            comissao_salao: comissaoSalao,
            taxa_pagamento: valorTaxa,
            data: dataLancamento,
            hora_inicio: horaAgendamento,
            data_pagamento: dataPagamentoFinal,
            is_fiado: finalizarData.is_fiado || false,
            is_troca_gratis: finalizarData.is_troca_gratis || false,
            valor_referencia: finalizarData.is_troca_gratis && finalizarData.valor_referencia
              ? parseFloat(finalizarData.valor_referencia)
              : null,
          })
          .select()
          .single();

        if (lancError) throw lancError;
        lancamentoId = novoLancamento.id;
      }

      // Salvar divisões se for serviço compartilhado
      if (compartilhadoFinal && !finalizarData.is_troca_gratis && lancamentoId) {
        // Primeiro, deletar divisões antigas
        await supabase
          .from('lancamento_divisoes')
          .delete()
          .eq('lancamento_id', lancamentoId);

        // Inserir novas divisões
        const divisoesParaSalvar = divisoesFinal.map(d => {
          const colab = colaboradores.find(c => c.id === d.colaborador_id);
          const porcentagemColab = colab?.porcentagem_comissao || 50;
          const valorDivisao = parseFloat(d.valor) || 0;
          const comissaoCalculada = (valorDivisao * porcentagemColab) / 100;

          return {
            lancamento_id: lancamentoId,
            colaborador_id: d.colaborador_id,
            valor: valorDivisao,
            comissao_calculada: comissaoCalculada,
          };
        });

        const { error: divError } = await supabase
          .from('lancamento_divisoes')
          .insert(divisoesParaSalvar);

        if (divError) {
          console.error('Erro ao salvar divisões:', divError);
        }
      }

      // Atualizar agendamento com status e vincular ao lançamento
      // Se é fiado, o status do agendamento também fica pendente (ainda não foi finalizado de fato)
      const { error: agendError } = await supabase
        .from('agendamentos')
        .update({
          status: finalizarData.is_fiado ? 'pendente' : 'concluido',
          lancamento_id: lancamentoId
        })
        .eq('id', selectedAgendamento.id);

      if (agendError) throw agendError;

      // Disparar mensagem pós-venda (só se não é fiado - fiado ainda não finalizou)
      if (!finalizarData.is_fiado) {
        try {
          await fetch('/api/agendamentos/pos-venda', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agendamentoId: selectedAgendamento.id }),
          });
        } catch (whatsappErr) {
          console.error('[WhatsApp] Erro ao disparar pós-venda:', whatsappErr);
        }
      }

      // Mensagem de sucesso
      let msg = '✅ ';
      if (finalizarData.is_fiado) {
        msg += 'Serviço marcado como FIADO! Aguardando pagamento.';
      } else if (finalizarData.is_troca_gratis) {
        msg += 'Troca/Grátis registrado com sucesso!';
      } else {
        const msgTaxa = taxaPercentual > 0 ? ` (Taxa ${taxaPercentual}%: -R$ ${valorTaxa.toFixed(2)})` : '';
        msg += `Serviço concluído com sucesso!${msgTaxa}`;
      }

      toast.success(msg);
      setSelectedAgendamento(null);
      setIsFinalizando(false);
      setFinalizarData({ forma_pagamento: 'pix', valor_pago: '', is_fiado: false, is_troca_gratis: false, valor_referencia: '' });
      setCompartilhadoFinal(false);
      setDivisoesFinal([]);
      await loadData();

    } catch (error: any) {
      console.error('Erro ao finalizar:', error);
      toast.error('Erro ao finalizar: ' + error.message);
    }
  };

  // ============== INDICADORES AVANÇADOS ==============

  // Calcular duração média dos serviços
  const calcularDuracaoMedia = () => {
    if (agendamentos.length === 0) return 0;

    const duracoes = agendamentos.map(agendamento => {
      const servico = servicos.find(s => s.nome === agendamento.descricao_servico);
      return servico?.duracao_minutos || 60;
    });

    const soma = duracoes.reduce((acc, dur) => acc + dur, 0);
    return Math.round(soma / duracoes.length);
  };

  // Encontrar horário de pico
  const encontrarHorarioPico = () => {
    if (agendamentos.length === 0) return 'N/A';

    const contagemPorHora: { [key: number]: number } = {};

    agendamentos.forEach(agendamento => {
      const hora = parseAsLocalTime(agendamento.data_hora).getHours();
      contagemPorHora[hora] = (contagemPorHora[hora] || 0) + 1;
    });

    const horaMaisAgendada = Object.entries(contagemPorHora).reduce((a, b) =>
      b[1] > a[1] ? b : a
    );

    return `${String(horaMaisAgendada[0]).padStart(2, '0')}:00 (${horaMaisAgendada[1]} agend.)`;
  };

  // Calcular taxa de ocupação
  const calcularTaxaOcupacao = () => {
    if (colaboradores.length === 0) return 0;

    // Horário de trabalho: 6h às 22h = 16 horas por colaborador
    const horasDisponiveis = 16 * colaboradores.length;

    // Calcular horas ocupadas
    const horasOcupadas = agendamentos.reduce((acc, agendamento) => {
      const servico = servicos.find(s => s.nome === agendamento.descricao_servico);
      const duracao = servico?.duracao_minutos || 60;
      return acc + (duracao / 60);
    }, 0);

    return Math.round((horasOcupadas / horasDisponiveis) * 100);
  };

  // Ranking de colaboradoras
  const getRankingColaboradoras = () => {
    const ranking = colaboradores.map(colaborador => {
      const agendamentosColab = agendamentos.filter(a =>
        a.colaborador_id === colaborador.id ||
        (a.colaboradores_ids && a.colaboradores_ids.includes(colaborador.id))
      );
      return {
        nome: colaborador.nome,
        quantidade: agendamentosColab.length,
      };
    }).sort((a, b) => b.quantidade - a.quantidade);

    return ranking.slice(0, 3); // Top 3
  };

  // Calcular receita estimada (baseado em valores médios)
  const calcularReceitaEstimada = () => {
    // Valores médios por tipo de serviço (você pode ajustar)
    const valoresMedios: { [key: string]: number } = {
      'Corte de Cabelo': 50,
      'Escova': 40,
      'Hidratação': 80,
      'Coloração': 150,
      'Progressiva': 300,
      'Luzes': 200,
      'Manicure': 35,
      'Pedicure': 45,
      'Sobrancelha': 25,
      'Maquiagem': 100,
      'Penteado': 120,
      'Depilação': 60,
    };

    const receita = agendamentos.reduce((acc, agendamento) => {
      const valor = valoresMedios[agendamento.descricao_servico || ''] || 50;
      return acc + valor;
    }, 0);

    return receita;
  };

  // Distribuição por tipo de serviço
  const getDistribuicaoServicos = () => {
    const distribuicao: { [key: string]: number } = {};

    agendamentos.forEach(agendamento => {
      const servico = agendamento.descricao_servico || 'Outros';
      distribuicao[servico] = (distribuicao[servico] || 0) + 1;
    });

    return Object.entries(distribuicao)
      .map(([nome, quantidade]) => ({ nome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5); // Top 5
  };

  // Salvar novo agendamento
  async function handleSalvarAgendamento(e: React.FormEvent) {
    e.preventDefault();

    // Validar serviços selecionados
    if (servicosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um serviço!');
      return;
    }

    // Validar cliente selecionado
    if (!clienteSelecionado) {
      toast.error('Selecione um cliente!');
      return;
    }

    if (!formData.colaborador_id || !formData.data || !formData.hora_inicio) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    // Combinar serviços selecionados em uma string
    const descricaoServicos = servicosSelecionados.join(' + ');

    // Calcular duração baseada nos horários definidos pelo usuário (não na média do serviço)
    const [hInicio, mInicio] = formData.hora_inicio.split(':').map(Number);
    const [hFim, mFim] = (formData.hora_fim || formData.hora_inicio).split(':').map(Number);
    const duracaoTotal = Math.max(15, (hFim * 60 + mFim) - (hInicio * 60 + mInicio));

    // Combinar data e hora sem timezone (formato: 2025-11-19 17:00:00)
    const dataHoraInicio = `${formData.data} ${formData.hora_inicio}:00`;

    // Valor estimado dos serviços (editável pelo usuário)
    const valorEstimado = formData.valor_servico ? parseFloat(formData.valor_servico) : 0;

    // Buscar colaborador para calcular comissão
    const colaborador = colaboradores.find(c => c.id === Number(formData.colaborador_id));
    const porcentagemComissao = colaborador?.porcentagem_comissao || 50;
    const comissaoColaborador = (valorEstimado * porcentagemComissao) / 100;
    const comissaoSalao = valorEstimado - comissaoColaborador;

    // Usar API para criar (bypass RLS)
    try {
      const response = await fetch('/api/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: Number(formData.colaborador_id),
          cliente_id: clienteSelecionado.id,
          data_hora: dataHoraInicio,
          descricao_servico: descricaoServicos,
          duracao_minutos: duracaoTotal,
          valor_estimado: valorEstimado,
          hora_inicio: formData.hora_inicio,
          hora_fim: formData.hora_fim || formData.hora_inicio,
          observacoes: formData.observacoes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[Agenda] Erro da API:', result.error);
        toast.error(`Erro ao criar agendamento: ${result.error}`);
        return;
      }

      toast.success('Agendamento criado com sucesso!');
      setShowNovoAgendamento(false);
      setFormData({
        colaborador_id: '',
        cliente_id: '',
        data: selectedDate,
        hora_inicio: '',
        hora_fim: '',
        descricao_servico: '',
        valor_servico: '',
        observacoes: '',
      });
      setServicosSelecionados([]); // Limpar serviços selecionados
      setClienteSelecionado(null); // Limpar cliente selecionado
      setFiltroServico(''); // Limpar filtro de pesquisa
      // Atualizar a data selecionada para a data do agendamento
      setSelectedDate(formData.data);
      // Esperar um pouco antes de recarregar para garantir que o banco salvou
      setTimeout(() => loadData(), 500);
    } catch (err: any) {
      console.error('[Agenda] Erro de conexão:', err);
      toast.error(`Erro de conexão: ${err.message}`);
    }
  }

  // Calcular hora fim automaticamente baseado no serviço selecionado
  function calcularHoraFim(horaInicio: string, servicoNome: string) {
    if (!horaInicio) return;

    const servico = servicos.find(s => s.nome === servicoNome);
    if (!servico) return;

    const [hora, minuto] = horaInicio.split(':').map(Number);
    const dataInicio = new Date();
    dataInicio.setHours(hora, minuto, 0);

    const dataFim = new Date(dataInicio.getTime() + servico.duracao_minutos * 60000);
    const horaFim = String(dataFim.getHours()).padStart(2, '0');
    const minutoFim = String(dataFim.getMinutes()).padStart(2, '0');

    setFormData(prev => ({ ...prev, hora_fim: `${horaFim}:${minutoFim}` }));
  }

  if (loading) return <LoadingSpinner />;

  const horarios = gerarHorarios(); // Apenas horas cheias para o header
  const horariosGrid = gerarHorariosGrid(); // Todas as meias-horas para o grid

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FCEBFB] via-[#EAD5FF] to-white">
      {/* Banner WhatsApp */}
      <WhatsAppStatusBanner />
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4">
              <Link
                href="/"
                className="flex items-center gap-1 md:gap-2 text-purple-600 hover:text-purple-800 transition-colors"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm md:text-base font-medium hidden sm:inline">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200 hidden sm:block" />
              <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Naví Belle - Agenda
              </h1>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <div className="text-xs md:text-sm text-gray-600">
                {format(currentTime, 'HH:mm')}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2 md:px-4 py-2 border border-purple-200 rounded-lg md:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/50 backdrop-blur text-xs md:text-sm font-medium transition-all hover:border-purple-300"
              />
              <Link
                href="/admin/servicos"
                className="px-3 md:px-4 py-2 bg-white border-2 border-purple-300 text-purple-600 rounded-xl font-semibold shadow-md hover:shadow-lg hover:border-purple-400 transform hover:scale-105 transition-all duration-200 text-xs md:text-sm flex items-center gap-1 md:gap-2"
              >
                <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">Serviços</span>
              </Link>
              <button
                onClick={() => setShowNovoAgendamento(true)}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? '⏳ Carregando...' : '✨ Novo'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">

        {/* ============================================================ */}
        {/* MOBILE: Toggle de Layout + Vista Mobile */}
        {/* ============================================================ */}
        <div className="md:hidden mb-4">
          {/* Mobile: Cards por Colaborador */}
          {(
            <div className="space-y-4">
              {colaboradores.map((colaborador, colabIndex) => {
                const color = getColaboradorColor(colabIndex);
                const agendamentosColab = agendamentos
                  .filter(a => a.colaborador_id === colaborador.id || (a.colaboradores_ids && a.colaboradores_ids.includes(colaborador.id)))
                  .sort((a, b) => a.data_hora.localeCompare(b.data_hora));

                return (
                  <div key={colaborador.id} className="bg-white/80 backdrop-blur rounded-2xl border border-purple-100 overflow-hidden shadow-sm">
                    {/* Header do Colaborador */}
                    <div className={`bg-gradient-to-r ${color.gradient} px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                          {colaborador.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-semibold text-sm">{colaborador.nome}</p>
                          <p className="text-white/70 text-xs">{agendamentosColab.length} agendamento(s)</p>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Agendamentos */}
                    {agendamentosColab.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-gray-400 text-sm">Sem agendamentos</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-purple-50">
                        {agendamentosColab.map((ag) => {
                          const horMatch = ag.data_hora.match(/[T ](\d{2}):(\d{2})/);
                          const horario = horMatch ? `${horMatch[1]}:${horMatch[2]}` : '--:--';
                          const duracao = ag.duracao_minutos || 60;
                          const horaFim = (() => {
                            const [h, m] = horario.split(':').map(Number);
                            const totalMin = h * 60 + m + duracao;
                            return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
                          })();
                          const clienteNome = clientes.find(c => c.id === ag.cliente_id)?.nome || 'Cliente';
                          const isPendente = ag.status === 'pendente';
                          const isConcluido = ag.status === 'concluido';

                          return (
                            <button
                              key={ag.id}
                              onClick={() => setSelectedAgendamento(ag)}
                              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-50/50 transition-colors text-left"
                            >
                              {/* Horário */}
                              <div className="flex-shrink-0 text-center">
                                <p className="text-sm font-bold text-purple-700">{horario}</p>
                                <p className="text-[10px] text-gray-400">{horaFim}</p>
                              </div>
                              {/* Divisor */}
                              <div className={`w-1 h-10 rounded-full ${isConcluido ? 'bg-green-400' : isPendente ? 'bg-amber-400' : 'bg-gray-300'}`} />
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{clienteNome}</p>
                                <p className="text-xs text-gray-500 truncate">{ag.descricao_servico || 'Serviço'}</p>
                              </div>
                              {/* Status */}
                              <div className="flex-shrink-0">
                                {isConcluido ? (
                                  <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</span>
                                ) : (
                                  <span className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs">●</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* DESKTOP: Timeline horizontal (mantida intacta) */}
        {/* ============================================================ */}
        <div className="hidden md:block bg-white/60 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-soft-xl border border-purple-100/50 overflow-x-auto relative">
          {/* Linhas verticais GLOBAIS removidas - agora usamos grid dentro de cada seção */}

          {/* Header da Timeline (Horários) - largura fixa por hora */}
          <div className="flex border-b border-purple-100 relative z-10">
            {/* Espaço para os nomes dos colaboradores - sticky para scroll horizontal */}
            <div className="w-[120px] md:w-[160px] flex-shrink-0 flex-grow-0 bg-gradient-to-br from-purple-50 to-pink-50 border-r border-purple-100 px-2 md:px-4 py-4 sticky left-0 z-20 overflow-hidden">
              <div className="text-xs md:text-sm font-semibold text-purple-700 truncate">Colaboradores</div>
            </div>

            {/* Horários - largura fixa: 16 horas * 80px mobile / 120px desktop */}
            <div className="relative h-16 md:h-20 bg-gradient-to-b from-purple-50/40 to-transparent" style={{ width: '1920px' }}>
              <div className="absolute inset-0">
                {horarios.map((horario) => {
                  // Calcular posição usando a MESMA FÓRMULA dos cards
                  const [hora, minuto] = horario.split(':').map(Number);
                  const minutosDesdeMeiaNoite = hora * 60 + minuto;
                  const INICIO_TIMELINE = 6 * 60;
                  const TOTAL_MINUTOS = 16 * 60;
                  const minutosDesdeInicio = minutosDesdeMeiaNoite - INICIO_TIMELINE;
                  const posicao = (minutosDesdeInicio / TOTAL_MINUTOS) * 100;

                  const isHoraCheia = minuto === 0;

                  return (
                    <div
                      key={horario}
                      className="absolute top-0 bottom-0"
                      style={{ left: `${posicao}%` }}
                    >
                      {/* Label do horário - alinhado à ESQUERDA da linha vertical */}
                      <div className="absolute top-5 md:top-6">
                        <div className={`px-2 py-1 rounded-md transition-all ${
                          isHoraCheia
                            ? 'bg-white/60 backdrop-blur-sm'
                            : ''
                        }`}>
                          <span className={`font-mono whitespace-nowrap ${
                            isHoraCheia
                              ? 'text-sm md:text-base font-bold text-purple-800'
                              : 'text-xs md:text-sm font-semibold text-purple-600'
                          }`}>
                            {horario}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Linhas dos Colaboradores */}
          <div className="relative" data-timeline-container>

            {colaboradores.map((colaborador, colabIndex) => {
              const color = getColaboradorColor(colabIndex);
              const agendamentosColaborador = agendamentos.filter(
                (a) => a.colaborador_id === colaborador.id ||
                  (a.colaboradores_ids && a.colaboradores_ids.includes(colaborador.id))
              );

              return (
                <div
                  key={colaborador.id}
                  className="flex border-b border-purple-50 last:border-b-0 hover:bg-purple-50/30 transition-colors group"
                  data-colaborador-id={colaborador.id}
                >
                  {/* Card do Colaborador - sticky para scroll horizontal, centralizado verticalmente */}
                  <div className="w-[120px] md:w-[160px] flex-shrink-0 flex-grow-0 border-r border-purple-100 p-2 md:p-3 sticky left-0 z-10 bg-white/95 backdrop-blur-sm flex items-center overflow-hidden">
                    <div className="flex items-center gap-2 w-full min-w-0">
                      {/* Avatar */}
                      <div className={`w-8 h-8 md:w-9 md:h-9 flex-shrink-0 rounded-lg bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white font-bold text-xs shadow-lg ${color.shadow}`}>
                        {colaborador.nome.charAt(0).toUpperCase()}
                      </div>
                      {/* Nome */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="text-[10px] md:text-xs font-semibold text-gray-800 truncate" title={colaborador.nome}>
                          {colaborador.nome}
                        </div>
                        <div className="text-[9px] md:text-[10px] text-gray-500">
                          {agendamentosColaborador.length} agend.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timeline do Colaborador - largura fixa igual ao header */}
                  <div className="relative h-20 md:h-24 py-2" style={{ width: '1920px' }}>
                    {/* Grid de horários */}
                    <div className="absolute inset-0 flex">
                      {horarios.map((horario) => {
                        const isHoraCheia = horario.endsWith(':00');
                        return (
                          <div
                            key={`grid-linha-${horario}`}
                            className={`flex-1 border-r ${
                              isHoraCheia ? 'border-purple-50/50' : 'border-purple-50/30'
                            } last:border-r-0`}
                          />
                        );
                      })}
                    </div>

                    {/* Barras de Agendamento */}
                    <div className="absolute inset-0 px-1">
                      {agendamentosColaborador.map((agendamento) => {
                        // Usar duracao_minutos do banco, ou 60 como padrão
                        const duracao = agendamento.duracao_minutos || 60;
                        const posicao = calcularPosicaoBarra(agendamento.data_hora, duracao);
                        const progresso = calcularProgresso(agendamento.data_hora, duracao);
                        const isHovered = hoveredAgendamento === agendamento.id;

                        const isBeingResized = isResizing && resizingAgendamento?.id === agendamento.id;
                        const currentWidth = isBeingResized && resizePreview
                          ? `${resizePreview.larguraPercent}%`
                          : posicao.width;

                        // Cores baseadas no status
                        const statusColors = {
                          concluido: { gradient: 'from-green-400 to-green-600', shadow: 'shadow-green-500/20' },
                          executando: { gradient: 'from-blue-400 to-blue-600', shadow: 'shadow-blue-500/20' },
                          pendente: color, // Usa a cor do colaborador
                        };
                        const cardColor = statusColors[agendamento.status as keyof typeof statusColors] || color;

                        return (
                          <div
                            key={agendamento.id}
                            data-agendamento-id={agendamento.id}
                            className={`absolute top-2 bottom-2 ${isResizing ? 'cursor-default' : 'cursor-move'} animate-fade-in-up ${
                              isDragging && draggedAgendamento?.id === agendamento.id ? 'opacity-50' : ''
                            } ${isBeingResized ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
                            style={{
                              left: posicao.left,
                              width: currentWidth,
                            }}
                            draggable={!isResizing}
                            onDragStart={(e) => !isResizing && handleDragStart(e, agendamento)}
                            onDrag={!isResizing ? handleDrag : undefined}
                            onDragEnd={!isResizing ? handleDragEnd : undefined}
                            onClick={() => !isResizing && setSelectedAgendamento(agendamento)}
                            onMouseEnter={() => setHoveredAgendamento(agendamento.id)}
                            onMouseLeave={() => setHoveredAgendamento(null)}
                          >
                            {/* Barra Principal */}
                            <div
                              className={`
                                relative h-full rounded-xl overflow-hidden
                                bg-gradient-to-r ${cardColor.gradient}
                                shadow-xl ${cardColor.shadow}
                                transition-all duration-300
                                ${isHovered ? 'scale-105 shadow-2xl z-20 ring-2 ring-white/50' : 'scale-100 shadow-lg'}
                              `}
                              style={{
                                opacity: isHovered ? 1 : 0.95,
                              }}
                            >
                              {/* Barra de Progresso Visual */}
                              <div
                                className="absolute bottom-0 left-0 h-1 bg-white/40 transition-all duration-500"
                                style={{
                                  width: `${progresso}%`,
                                }}
                              />

                              {/* Overlay de Progresso */}
                              <div
                                className="absolute inset-0 bg-black/10 transition-all duration-500"
                                style={{
                                  width: `${progresso}%`,
                                }}
                              />

                              {/* Conteúdo da Barra */}
                              <div className="relative h-full px-2 md:px-3 py-1 flex flex-col justify-center text-white">
                                {/* Linha 1: Nome do Cliente */}
                                <div className="text-[10px] md:text-xs font-bold truncate leading-tight flex items-center gap-1">
                                  {agendamento.cliente?.nome}
                                  {agendamento.colaboradores_ids && agendamento.colaboradores_ids.length > 1 && (
                                    <span className="bg-white/30 text-[7px] md:text-[8px] px-1 rounded font-normal" title="Serviço compartilhado">
                                      👥{agendamento.colaboradores_ids.length}
                                    </span>
                                  )}
                                </div>

                                {/* Linha 2: Serviço com ícone */}
                                <div className="text-[8px] md:text-[10px] opacity-90 truncate leading-tight mt-0.5 flex items-center gap-1">
                                  <span>{getServicoIcon(agendamento.descricao_servico || '')}</span>
                                  <span className="truncate">{agendamento.descricao_servico}</span>
                                </div>

                                {/* Linha 3: Horário */}
                                <div className="text-[8px] md:text-[9px] opacity-80 font-medium mt-0.5">
                                  {formatarHorario(agendamento.data_hora)}
                                </div>
                              </div>

                              {/* Brilho no hover */}
                              {isHovered && (
                                <div className="absolute inset-0 bg-white/10 animate-pulse-soft" />
                              )}

                              {/* Handle de Resize - AUMENTADO para facilitar o arraste */}
                              <div
                                className="absolute right-0 top-0 bottom-0 w-6 cursor-ew-resize z-30 group/resize hover:bg-white/20 transition-all"
                                onMouseDown={(e) => handleResizeStart(e, agendamento)}
                                title="⬅️ ➡️ Arraste para ajustar duração"
                              >
                                {/* Indicador visual do handle - Mais visível */}
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 w-1.5 h-10 bg-white/50 rounded-full group-hover/resize:bg-white/80 group-hover/resize:h-16 transition-all shadow-lg" />

                                {/* Ícone de resize (aparece no hover) */}
                                <div className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/resize:opacity-100 transition-opacity">
                                  <svg className="w-4 h-4 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5h2v14H8zm6 0h2v14h-2z"/>
                                  </svg>
                                </div>
                              </div>
                            </div>

                            {/* Label da Nova Duração (durante resize) */}
                            {isBeingResized && resizePreview && (
                              <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
                                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl shadow-blue-500/40 whitespace-nowrap animate-bounce-soft">
                                  ⏱️ {resizePreview.novaDuracao} min
                                </div>
                              </div>
                            )}

                            {/* Tooltip Melhorado */}
                            {isHovered && (
                              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 animate-slide-up pointer-events-none">
                                <div className="bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-xl px-4 py-3 shadow-2xl min-w-max border border-white/10">
                                  {/* Cliente */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{getServicoIcon(agendamento.descricao_servico || '')}</span>
                                    <span className="font-bold text-sm">{agendamento.cliente?.nome}</span>
                                  </div>

                                  {/* Serviço */}
                                  <div className="text-purple-300 mt-2 font-medium">
                                    {agendamento.descricao_servico}
                                  </div>

                                  {/* Horário */}
                                  <div className="text-gray-300 mt-2 flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{formatarHorario(agendamento.data_hora)}</span>
                                  </div>

                                  {/* Valor (lançamento real ou estimado) */}
                                  {(() => {
                                    const vReal = (agendamento as any).lancamento?.valor_total;
                                    const v = vReal ?? agendamento.valor_estimado;
                                    return v && v > 0 ? (
                                      <div className="text-green-400 mt-2 flex items-center gap-2 font-semibold">
                                        <span>R$</span>
                                        <span>{v.toFixed(2)}</span>
                                      </div>
                                    ) : null;
                                  })()}

                                  {/* Progresso */}
                                  {progresso > 0 && progresso < 100 && (
                                    <div className="mt-2 pt-2 border-t border-white/10">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] text-gray-400">Progresso</span>
                                        <span className="text-[10px] text-pink-400 font-bold">{Math.round(progresso)}%</span>
                                      </div>
                                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-300"
                                          style={{ width: `${progresso}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Seta do tooltip */}
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900/95 rotate-45 border-l border-t border-white/10" />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Indicador Visual de Drag & Drop */}
            {isDragging && dragPreview && (
              <>
                {/* Linha Guia Vertical - segue exatamente o MOUSE */}
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{ left: `calc(12rem * ${1 - dragPreview.posicaoX/100} + ${dragPreview.posicaoX}%)` }}
                >
                  {/* Linha vertical azul/roxa */}
                  <div className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-purple-500 to-blue-500 shadow-xl shadow-blue-500/50 animate-pulse-soft" />

                  {/* Label do novo horário - Mostra onde o MOUSE está */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl shadow-blue-500/40 whitespace-nowrap animate-bounce-soft">
                      📍 {dragPreview.horarioMouse.substring(0, 5)}
                    </div>
                  </div>

                  {/* Indicador circular no topo */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50 animate-ping absolute" />
                    <div className="w-4 h-4 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
                  </div>
                </div>

                {/* Highlight da linha do colaborador de destino */}
                <div
                  className="absolute left-0 right-0 bg-blue-100/40 border-2 border-blue-300 border-dashed pointer-events-none z-10 animate-pulse-soft"
                  style={{
                    top: `${dragPreview.linhaIndex * 96}px`, // altura da linha (h-24 = 96px)
                    height: '96px',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 via-purple-200/20 to-blue-200/20" />
                </div>
              </>
            )}

            {/* Linha do Horário Atual "Agora" - USA EXATAMENTE A MESMA ESTRUTURA DA RÉGUA DO TOPO */}
            {(() => {
              const isHoje = selectedDate === format(new Date(), 'yyyy-MM-dd');
              if (!isHoje) return null;

              // MESMA FÓRMULA EXATA da régua do topo (linhas 1144-1150)
              const INICIO_TIMELINE = 6 * 60;  // 06:00 = 360 minutos
              const TOTAL_MINUTOS = 16 * 60;   // 16 horas = 960 minutos
              const minutosDesdeMeiaNoite = currentTime.getHours() * 60 + currentTime.getMinutes();

              // Verificar se está dentro do horário de funcionamento
              if (minutosDesdeMeiaNoite < INICIO_TIMELINE || minutosDesdeMeiaNoite > INICIO_TIMELINE + TOTAL_MINUTOS) {
                return null;
              }

              const minutosDesdeInicio = minutosDesdeMeiaNoite - INICIO_TIMELINE;
              const posicao = (minutosDesdeInicio / TOTAL_MINUTOS) * 100; // MESMA FÓRMULA

              return (
                <div className="absolute top-0 bottom-0 left-0 right-0 z-30 pointer-events-none flex">
                  {/* Coluna de colaboradores - MESMA LARGURA do header */}
                  <div className="w-[120px] md:w-[160px] flex-shrink-0" />

                  {/* Container da timeline - MESMA LARGURA do header (1920px) */}
                  <div className="relative" style={{ width: '1920px' }}>
                    {/* Linha posicionada com left em % - IGUAL à régua do topo */}
                    <div
                      className="absolute top-0 bottom-0"
                      style={{ left: `${posicao}%` }}
                    >
                      {/* Linha vertical vermelha */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-lg shadow-red-500/50" />

                      {/* Label do horário atual - no topo */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full">
                        <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-t-md shadow-md whitespace-nowrap">
                          {format(currentTime, 'HH:mm')}
                        </div>
                      </div>

                      {/* Indicador circular */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                        <div className="w-3 h-3 bg-red-500 rounded-full shadow-md shadow-red-500/50" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Mensagem se não houver colaboradores */}
          {colaboradores.length === 0 && (
            <div className="py-16 text-center">
              <div className="text-gray-400 text-sm">
                Nenhum colaborador cadastrado
              </div>
            </div>
          )}
        </div>

        {/* Indicadores Avançados */}
        <div className="mt-8 space-y-6">
          {/* Título da Seção */}
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              📊 Analytics do Dia
            </h2>
          </div>

          {/* Grid Principal de Indicadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total de Agendamentos */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-100 shadow-soft-lg hover:shadow-soft-xl transition-all hover:scale-105 animate-fade-in-up">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="text-4xl font-bold text-gray-800 mb-1">{agendamentos.length}</div>
              <div className="text-sm font-semibold text-purple-600">Total de Agendamentos</div>
            </div>

            {/* Receita Estimada */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border-2 border-green-100 shadow-soft-lg hover:shadow-soft-xl transition-all hover:scale-105 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-4xl font-bold text-gray-800 mb-1">
                R$ {calcularReceitaEstimada().toLocaleString('pt-BR')}
              </div>
              <div className="text-sm font-semibold text-green-600">Receita Estimada</div>
            </div>

            {/* Taxa de Ocupação */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 border-2 border-blue-100 shadow-soft-lg hover:shadow-soft-xl transition-all hover:scale-105 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="text-4xl font-bold text-gray-800 mb-1">{calcularTaxaOcupacao()}%</div>
              <div className="text-sm font-semibold text-blue-600">Taxa de Ocupação</div>
              <div className="mt-3 h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-1000"
                  style={{ width: `${calcularTaxaOcupacao()}%` }}
                />
              </div>
            </div>

            {/* Duração Média */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border-2 border-orange-100 shadow-soft-lg hover:shadow-soft-xl transition-all hover:scale-105 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-4xl font-bold text-gray-800 mb-1">{calcularDuracaoMedia()}min</div>
              <div className="text-sm font-semibold text-orange-600">Duração Média</div>
            </div>
          </div>

          {/* Grid Secundário - Ranking e Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ranking de Colaboradoras */}
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft-lg animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">🏆 Top Colaboradoras</h3>
              </div>

              <div className="space-y-3">
                {getRankingColaboradoras().map((colab, index) => {
                  const color = getColaboradorColor(index);
                  const medals = ['🥇', '🥈', '🥉'];

                  return (
                    <div key={index} className={`flex items-center gap-3 p-3 rounded-xl ${color.bg} border ${color.border} transition-all hover:scale-105`}>
                      <div className="text-2xl">{medals[index]}</div>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${color.gradient} flex items-center justify-center text-white font-bold shadow-md`}>
                        {colab.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">{colab.nome}</div>
                        <div className="text-xs text-gray-600">{colab.quantidade} agendamentos</div>
                      </div>
                      <div className={`text-2xl font-bold ${color.text}`}>{colab.quantidade}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Insights e Horário de Pico */}
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft-lg animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">💡 Insights</h3>
              </div>

              <div className="space-y-4">
                {/* Horário de Pico */}
                <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border-2 border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <span className="font-bold text-yellow-900">Horário de Pico</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-900">{encontrarHorarioPico()}</div>
                  <div className="text-xs text-yellow-700 mt-1">Momento com mais agendamentos</div>
                </div>

                {/* Serviços Mais Procurados */}
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-400 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <span className="font-bold text-purple-900">Top Serviços</span>
                  </div>
                  <div className="space-y-2">
                    {getDistribuicaoServicos().slice(0, 3).map((servico, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getServicoIcon(servico.nome)}</span>
                          <span className="text-sm font-medium text-gray-700">{servico.nome}</span>
                        </div>
                        <span className="text-sm font-bold text-purple-600">{servico.quantidade}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Novo Agendamento */}
      {showNovoAgendamento && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowNovoAgendamento(false);
              setClienteSelecionado(null);
              setFiltroServico('');
            }
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full animate-modal-in max-h-[90vh] overflow-y-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">✨ Novo Agendamento</h3>
                <button
                  onClick={() => {
                    setShowNovoAgendamento(false);
                    setClienteSelecionado(null);
                    setFiltroServico('');
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSalvarAgendamento} className="p-6 space-y-6">
              {/* Colaboradora */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  👩‍💼 Colaboradora *
                </label>
                <select
                  value={formData.colaborador_id}
                  onChange={(e) => setFormData({ ...formData, colaborador_id: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  required
                >
                  <option value="">Selecione uma colaboradora</option>
                  {colaboradores.map((colab) => (
                    <option key={colab.id} value={colab.id}>
                      {colab.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Cliente */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  👤 Cliente *
                </label>
                <ClienteAutocomplete
                  onSelect={(cliente) => setClienteSelecionado(cliente)}
                  selectedCliente={clienteSelecionado}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite para buscar ou cadastrar novo cliente
                </p>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📅 Data *
                </label>
                <input
                  type="date"
                  value={formData.data}
                  onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  required
                />
              </div>

              {/* Serviços (Seleção Múltipla) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Serviços * <span className="text-xs text-gray-500">(selecione um ou mais)</span>
                </label>
                <input
                  type="text"
                  placeholder="Pesquisar serviço..."
                  value={filtroServico}
                  onChange={(e) => setFiltroServico(e.target.value)}
                  className="w-full px-4 py-2 mb-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                  {servicos
                    .filter(s => s.nome.toLowerCase().includes(filtroServico.toLowerCase()))
                    .map((servico) => {
                      const isSelected = servicosSelecionados.includes(servico.nome);
                      return (
                        <label
                          key={servico.id}
                          className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              let novosServicos: string[];
                              if (e.target.checked) {
                                novosServicos = [...servicosSelecionados, servico.nome];
                              } else {
                                novosServicos = servicosSelecionados.filter(s => s !== servico.nome);
                              }
                              setServicosSelecionados(novosServicos);
                              // Calcular valor total dos serviços selecionados
                              const valorTotal = novosServicos.reduce((total, nomeServico) => {
                                const s = servicos.find(srv => srv.nome === nomeServico);
                                return total + (s?.valor || 0);
                              }, 0);
                              setFormData(prev => ({ ...prev, valor_servico: valorTotal.toFixed(2) }));
                            }}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">{servico.nome}</div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">{servico.duracao_minutos} min</span>
                              <span className="text-green-600 font-semibold">R$ {servico.valor.toFixed(2)}</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
                {servicos.filter(s => s.nome.toLowerCase().includes(filtroServico.toLowerCase())).length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">Nenhum serviço encontrado</p>
                )}
                {/* Preview da duração e valor total */}
                {servicosSelecionados.length > 0 && (
                  <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Serviços:</span>
                        <span className="ml-1 font-semibold text-purple-600">{servicosSelecionados.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duração:</span>
                        <span className="ml-1 font-bold text-purple-700">
                          {servicosSelecionados.reduce((total, nomeServico) => {
                            const servico = servicos.find(s => s.nome === nomeServico);
                            return total + (servico?.duracao_minutos || 0);
                          }, 0)} min
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Valor:</span>
                        <span className="ml-1 font-bold text-green-600">
                          R$ {servicosSelecionados.reduce((total, nomeServico) => {
                            const servico = servicos.find(s => s.nome === nomeServico);
                            return total + (servico?.valor || 0);
                          }, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Valor do Serviço (editável) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  💰 Valor do Serviço <span className="text-xs text-gray-500">(editável para descontos)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_servico}
                    onChange={(e) => setFormData({ ...formData, valor_servico: e.target.value })}
                    placeholder="0.00"
                    className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                  />
                </div>
                {formData.valor_servico && servicosSelecionados.length > 0 && (() => {
                  const valorOriginal = servicosSelecionados.reduce((total, nomeServico) => {
                    const servico = servicos.find(s => s.nome === nomeServico);
                    return total + (servico?.valor || 0);
                  }, 0);
                  const valorAtual = parseFloat(formData.valor_servico) || 0;
                  const desconto = valorOriginal - valorAtual;
                  if (desconto > 0) {
                    return (
                      <p className="text-xs text-orange-600 mt-1">
                        Desconto aplicado: R$ {desconto.toFixed(2)} ({((desconto / valorOriginal) * 100).toFixed(0)}% off)
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Horários */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ⏰ Hora Início *
                  </label>
                  <input
                    type="time"
                    value={formData.hora_inicio}
                    onChange={(e) => {
                      setFormData({ ...formData, hora_inicio: e.target.value });
                      if (formData.descricao_servico) {
                        calcularHoraFim(e.target.value, formData.descricao_servico);
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ⏱️ Hora Fim
                  </label>
                  <input
                    type="time"
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="Calculado automaticamente"
                  />
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Observações <span className="text-xs text-gray-500">(opcional)</span>
                </label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Anotações sobre o atendimento..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowNovoAgendamento(false); setFiltroServico(''); }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  ✨ Criar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer Lateral de Detalhes/Edição */}
      {selectedAgendamento && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
            onClick={() => {
              setSelectedAgendamento(null);
              setIsEditMode(false);
              setEditIsCompleted(false);
              setSelectedColaboradorEdit(null);
              setFiltroServico('');
            }}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in-right">
            {/* Header do Drawer */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {isEditMode ? '✏️ Editar Agendamento' : '📋 Detalhes do Agendamento'}
                  </h3>
                  <p className="text-white/80 text-sm mt-1">
                    {getServicoIcon(selectedAgendamento.descricao_servico || '')} {selectedAgendamento.descricao_servico}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedAgendamento(null);
                    setIsEditMode(false);
                    setEditIsCompleted(false);
                    setSelectedColaboradorEdit(null);
                    setFiltroServico('');
                  }}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:scale-110"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo do Drawer */}
            <div className="p-6 space-y-6">
              {!isEditMode ? (
                <>
                  {/* Modo Visualização */}
                  {/* Card do Cliente */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-100">
                    <label className="text-xs font-bold text-purple-600 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Cliente
                    </label>
                    <div className="mt-2 text-2xl font-bold text-gray-800">{selectedAgendamento.cliente?.nome}</div>
                    <div className="mt-1 text-sm text-gray-600">{selectedAgendamento.cliente?.telefone}</div>
                  </div>

                  {/* Card da Colaboradora */}
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-100">
                    <label className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Colaboradora
                    </label>
                    <div className="mt-2 text-2xl font-bold text-gray-800">{selectedAgendamento.colaborador?.nome}</div>
                  </div>

                  {/* Grid de Informações */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Horário */}
                    <div className="bg-white rounded-xl p-4 border-2 border-purple-100 hover:border-purple-300 transition-colors col-span-1 md:col-span-2">
                      <label className="text-xs font-bold text-purple-600 uppercase tracking-wide flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Horário
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Início</div>
                          <div className="text-xl font-bold text-gray-800">{formatarHorario(selectedAgendamento.data_hora)}</div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Fim</div>
                          <div className="text-xl font-bold text-gray-800">
                            {(() => {
                              const inicio = parseAsLocalTime(selectedAgendamento.data_hora);
                              const duracao = selectedAgendamento.duracao_minutos || 60;
                              const fim = new Date(inicio.getTime() + duracao * 60000);
                              return format(fim, 'HH:mm');
                            })()}
                          </div>
                        </div>
                        <div className="ml-auto">
                          <div className="text-xs text-gray-500 mb-1">Duração</div>
                          <div className="text-sm font-semibold text-purple-600">{selectedAgendamento.duracao_minutos || 60} min</div>
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className={`bg-white rounded-xl p-4 border-2 transition-colors col-span-2 ${
                      selectedAgendamento.status === 'concluido'
                        ? 'border-green-300 bg-green-50'
                        : selectedAgendamento.status === 'executando'
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-yellow-200 bg-yellow-50'
                    }`}>
                      <label className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${
                        selectedAgendamento.status === 'concluido'
                          ? 'text-green-600'
                          : selectedAgendamento.status === 'executando'
                            ? 'text-blue-600'
                            : 'text-yellow-600'
                      }`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Status
                      </label>
                      <div className={`mt-2 text-sm font-semibold ${
                        selectedAgendamento.status === 'concluido'
                          ? 'text-green-600'
                          : selectedAgendamento.status === 'executando'
                            ? 'text-blue-600'
                            : 'text-yellow-600'
                      }`}>
                        {selectedAgendamento.status === 'concluido'
                          ? '✅ Concluído'
                          : selectedAgendamento.status === 'executando'
                            ? '🔄 Executando'
                            : '⏳ Pendente'}
                      </div>
                    </div>
                  </div>

                  {/* Serviço */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-5 border border-yellow-100">
                    <label className="text-xs font-bold text-orange-600 uppercase tracking-wide flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Serviço
                    </label>
                    <div className="mt-2 text-lg font-semibold text-gray-800">
                      {getServicoIcon(selectedAgendamento.descricao_servico || '')} {selectedAgendamento.descricao_servico}
                    </div>
                    {/* Valor (usa lançamento se existir, senão valor_estimado) */}
                    {(() => {
                      const valorReal = (selectedAgendamento as any).lancamento?.valor_total;
                      const valor = valorReal ?? selectedAgendamento.valor_estimado;
                      return valor && valor > 0 ? (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-sm text-gray-500">Valor:</span>
                          <span className="text-lg font-bold text-green-600">
                            R$ {valor.toFixed(2)}
                          </span>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  {/* Observações */}
                  {(selectedAgendamento as any).observacoes && (
                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-5 border border-gray-200">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Observações
                      </label>
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {(selectedAgendamento as any).observacoes}
                      </div>
                    </div>
                  )}

                  {/* Bloco Finalizar Serviço - disponível para TODOS os agendamentos pendentes */}
                  {selectedAgendamento.status !== 'concluido' && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border-2 border-green-200">
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-bold text-green-700 flex items-center gap-2">
                          ✅ Finalizar Serviço
                        </label>
                        <button
                          onClick={() => {
                            if (!isFinalizando) {
                              // Pré-preencher com o valor real do lançamento ou estimado
                              const valorPreench = (selectedAgendamento as any).lancamento?.valor_total ?? selectedAgendamento?.valor_estimado;
                              if (valorPreench) {
                                setFinalizarData(prev => ({
                                  ...prev,
                                  valor_pago: valorPreench.toFixed(2)
                                }));
                              }
                            }
                            setIsFinalizando(!isFinalizando);
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            isFinalizando
                              ? 'bg-gray-200 text-gray-600'
                              : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          {isFinalizando ? 'Cancelar' : 'Concluir'}
                        </button>
                      </div>

                      {isFinalizando && (
                        <div className="space-y-4 mt-4 pt-4 border-t border-green-200">
                          {/* Forma de Pagamento */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Forma de Pagamento
                            </label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {/* Formas de pagamento normais */}
                              {[
                                { value: 'pix', label: 'PIX', icon: '📱' },
                                { value: 'dinheiro', label: 'Dinheiro', icon: '💵' },
                                { value: 'cartao_debito', label: 'Débito', icon: '💳' },
                                { value: 'cartao_credito', label: 'Crédito', icon: '💳' },
                              ].map(forma => (
                                <button
                                  key={forma.value}
                                  onClick={() => setFinalizarData(prev => ({
                                    ...prev,
                                    forma_pagamento: forma.value,
                                    is_fiado: false,
                                    is_troca_gratis: false,
                                    valor_referencia: '',
                                  }))}
                                  className={`px-4 py-3 md:px-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                                    finalizarData.forma_pagamento === forma.value && !finalizarData.is_fiado && !finalizarData.is_troca_gratis
                                      ? 'bg-green-500 text-white'
                                      : 'bg-white border border-gray-200 hover:border-green-300'
                                  }`}
                                >
                                  {forma.icon} {forma.label}
                                </button>
                              ))}

                              {/* Botão FIADO */}
                              <button
                                onClick={() => setFinalizarData(prev => ({
                                  ...prev,
                                  forma_pagamento: 'fiado',
                                  is_fiado: true,
                                  is_troca_gratis: false,
                                  valor_referencia: '',
                                }))}
                                className={`px-4 py-3 md:px-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                                  finalizarData.is_fiado
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-white border border-gray-200 hover:border-orange-300'
                                }`}
                              >
                                📝 Fiado
                              </button>

                              {/* Botão TROCA/GRÁTIS */}
                              <button
                                onClick={() => setFinalizarData(prev => ({
                                  ...prev,
                                  forma_pagamento: 'troca_gratis',
                                  is_fiado: false,
                                  is_troca_gratis: true,
                                  valor_pago: '0',
                                }))}
                                className={`px-4 py-3 md:px-3 md:py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                                  finalizarData.is_troca_gratis
                                    ? 'bg-purple-500 text-white'
                                    : 'bg-white border border-gray-200 hover:border-purple-300'
                                }`}
                              >
                                🎁 Troca/Grátis
                              </button>
                            </div>
                          </div>

                          {/* Info sobre FIADO */}
                          {finalizarData.is_fiado && (
                            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                              <p className="text-orange-800 font-medium flex items-center gap-2">
                                <span>📝</span> Fiado selecionado
                              </p>
                              <ul className="text-orange-700 mt-2 space-y-1 list-disc list-inside">
                                <li>O serviço ficará <strong>pendente</strong></li>
                                <li>Não entra no faturamento até ser pago</li>
                                <li>Receba em Controle de Fiados</li>
                              </ul>
                            </div>
                          )}

                          {/* Campo de valor de referência para TROCA/GRÁTIS */}
                          {finalizarData.is_troca_gratis && (
                            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <p className="text-purple-800 font-medium flex items-center gap-2 mb-2">
                                <span>🎁</span> Troca / Grátis
                              </p>
                              <p className="text-purple-700 text-sm mb-3">
                                Valor será R$ 0,00 (sem faturamento/comissão).
                              </p>
                              <div>
                                <label className="block text-sm font-medium text-purple-700 mb-1">
                                  Valor de referência (opcional)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={finalizarData.valor_referencia}
                                    onChange={(e) => setFinalizarData(prev => ({ ...prev, valor_referencia: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                                    placeholder="0.00"
                                  />
                                </div>
                                <p className="text-xs text-purple-600 mt-1">
                                  Apenas para referência/histórico.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Valor Pago - Oculto para troca/grátis */}
                          {!finalizarData.is_troca_gratis && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                {finalizarData.is_fiado ? 'Valor do Serviço' : 'Valor Pago'}
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={finalizarData.valor_pago}
                                  onChange={(e) => setFinalizarData(prev => ({ ...prev, valor_pago: e.target.value }))}
                                  placeholder="0.00"
                                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                />
                              </div>
                            </div>
                          )}

                          {/* Serviço Compartilhado - Oculto para troca/grátis */}
                          {!finalizarData.is_troca_gratis && (
                            <div className="bg-blue-50 rounded-xl p-4">
                              <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={compartilhadoFinal}
                                  onChange={(e) => {
                                    setCompartilhadoFinal(e.target.checked);
                                    if (e.target.checked && divisoesFinal.length === 0) {
                                      const valorTotal = parseFloat(finalizarData.valor_pago) || 0;
                                      const valorMetade = valorTotal / 2;
                                      setDivisoesFinal([
                                        { colaborador_id: selectedAgendamento?.colaborador_id || 0, valor: valorMetade.toFixed(2) },
                                        { colaborador_id: 0, valor: valorMetade.toFixed(2) },
                                      ]);
                                    }
                                  }}
                                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="font-medium text-gray-700">Serviço compartilhado</span>
                              </label>

                              {compartilhadoFinal && (
                                <div className="mt-4 space-y-4">
                                  <p className="text-sm text-gray-600">Divida o valor entre os colaboradores:</p>

                                  {/* Lista de divisões */}
                                  <div className="space-y-3">
                                    {divisoesFinal.map((div, index) => {
                                      const colab = colaboradores.find(c => c.id === div.colaborador_id);
                                      const valorTotal = parseFloat(finalizarData.valor_pago) || 0;
                                      const valorDiv = parseFloat(div.valor) || 0;
                                      const percentual = valorTotal > 0 ? ((valorDiv / valorTotal) * 100).toFixed(0) : '0';

                                      return (
                                        <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-blue-200">
                                          <select
                                            value={div.colaborador_id}
                                            onChange={(e) => {
                                              const newDivisoes = [...divisoesFinal];
                                              newDivisoes[index].colaborador_id = parseInt(e.target.value);
                                              setDivisoesFinal(newDivisoes);
                                            }}
                                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500"
                                          >
                                            <option value={0}>Selecione...</option>
                                            {colaboradores.map(c => (
                                              <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                          </select>

                                          <div className="flex items-center gap-1">
                                            <span className="text-gray-500 text-sm">R$</span>
                                            <input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              value={div.valor}
                                              onChange={(e) => {
                                                const newDivisoes = [...divisoesFinal];
                                                newDivisoes[index].valor = e.target.value;
                                                setDivisoesFinal(newDivisoes);
                                              }}
                                              className="w-20 px-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 text-right"
                                              placeholder="0.00"
                                            />
                                          </div>

                                          <span className="text-sm text-blue-600 font-medium w-10 text-right">
                                            {percentual}%
                                          </span>

                                          {divisoesFinal.length > 2 && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const newDivisoes = divisoesFinal.filter((_, i) => i !== index);
                                                setDivisoesFinal(newDivisoes);
                                              }}
                                              className="text-red-500 hover:text-red-700 p-1"
                                            >
                                              ✕
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Adicionar colaborador */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDivisoesFinal([...divisoesFinal, { colaborador_id: 0, valor: '0' }]);
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  >
                                    + Adicionar colaborador
                                  </button>

                                  {/* Resumo da divisão */}
                                  {(() => {
                                    const valorTotal = parseFloat(finalizarData.valor_pago) || 0;
                                    const somaDivisoes = divisoesFinal.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
                                    const diferenca = valorTotal - somaDivisoes;
                                    const isValid = Math.abs(diferenca) < 0.01 && somaDivisoes > 0;

                                    return (
                                      <div className={`p-2 rounded-lg text-sm ${isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex justify-between items-center">
                                          <span className={isValid ? 'text-green-700' : 'text-red-700'}>
                                            Total: R$ {somaDivisoes.toFixed(2)} / R$ {valorTotal.toFixed(2)}
                                          </span>
                                          {Math.abs(diferenca) >= 0.01 && (
                                            <span className={diferenca > 0 ? 'text-orange-600' : 'text-red-600'}>
                                              {diferenca > 0 ? `Restam R$ ${diferenca.toFixed(2)}` : `Excede R$ ${Math.abs(diferenca).toFixed(2)}`}
                                            </span>
                                          )}
                                          {isValid && (
                                            <span className="text-green-600 font-medium">✓ OK</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Botão Confirmar */}
                          <button
                            onClick={finalizarAgendamento}
                            className={`w-full px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 ${
                              finalizarData.is_fiado
                                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                                : finalizarData.is_troca_gratis
                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                                : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            }`}
                          >
                            {finalizarData.is_fiado ? '📝 Marcar como Fiado' :
                             finalizarData.is_troca_gratis ? '🎁 Registrar Troca/Grátis' :
                             '✅ Confirmar Conclusão'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="pt-4 space-y-3">
                    <button
                      onClick={ativarEdicao}
                      className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar Agendamento
                    </button>

                    <button
                      onClick={excluirAgendamento}
                      className="w-full px-6 py-4 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-semibold hover:bg-red-100 hover:border-red-300 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Excluir Agendamento
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Modo Edição */}
                  <div className="space-y-5">
                    {/* Data */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Data *
                      </label>
                      <input
                        type="date"
                        value={editData.data}
                        onChange={(e) => setEditData({ ...editData, data: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>

                    {/* Colaboradora */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Colaboradora *
                      </label>
                      <select
                        value={editData.colaborador_id}
                        onChange={(e) => {
                          setEditData({ ...editData, colaborador_id: e.target.value });
                          const colab = colaboradores.find(c => c.id === Number(e.target.value));
                          setSelectedColaboradorEdit(colab || null);
                        }}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors bg-white"
                        required
                      >
                        <option value="">Selecione</option>
                        {colaboradores.map((colab) => (
                          <option key={colab.id} value={colab.id}>
                            {colab.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Cliente */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Cliente *
                      </label>
                      <select
                        value={editData.cliente_id}
                        onChange={(e) => setEditData({ ...editData, cliente_id: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors bg-white"
                        required
                      >
                        <option value="">Selecione</option>
                        {clientes.map((cliente) => (
                          <option key={cliente.id} value={cliente.id}>
                            {cliente.nome} - {cliente.telefone}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Serviços */}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        Serviços * <span className="text-xs text-gray-500 font-normal">(selecione um ou mais)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Pesquisar serviço..."
                        value={filtroServico}
                        onChange={(e) => setFiltroServico(e.target.value)}
                        className="w-full px-4 py-2 mb-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                        {servicos
                          .filter(s => s.nome.toLowerCase().includes(filtroServico.toLowerCase()))
                          .map((servico) => {
                          const isSelected = servicosSelecionadosEdit.includes(servico.nome);
                          return (
                            <label
                              key={servico.id}
                              className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50'
                                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const novosServicos = [...servicosSelecionadosEdit, servico.nome];
                                    setServicosSelecionadosEdit(novosServicos);
                                    // Atualizar hora_fim automaticamente baseado na duração total
                                    const duracaoTotal = novosServicos.reduce((total, nomeServico) => {
                                      const s = servicos.find(sv => sv.nome === nomeServico);
                                      return total + (s?.duracao_minutos || 0);
                                    }, 0);
                                    if (editData.hora_inicio) {
                                      const [hora, minuto] = editData.hora_inicio.split(':').map(Number);
                                      const dataInicio = new Date();
                                      dataInicio.setHours(hora, minuto, 0);
                                      const dataFim = new Date(dataInicio.getTime() + duracaoTotal * 60000);
                                      const horaFim = String(dataFim.getHours()).padStart(2, '0');
                                      const minutoFim = String(dataFim.getMinutes()).padStart(2, '0');
                                      setEditData(prev => ({ ...prev, hora_fim: `${horaFim}:${minutoFim}` }));
                                    }
                                  } else {
                                    const novosServicos = servicosSelecionadosEdit.filter(s => s !== servico.nome);
                                    setServicosSelecionadosEdit(novosServicos);
                                    // Atualizar hora_fim automaticamente baseado na duração total
                                    const duracaoTotal = novosServicos.reduce((total, nomeServico) => {
                                      const s = servicos.find(sv => sv.nome === nomeServico);
                                      return total + (s?.duracao_minutos || 0);
                                    }, 0);
                                    if (editData.hora_inicio && duracaoTotal > 0) {
                                      const [hora, minuto] = editData.hora_inicio.split(':').map(Number);
                                      const dataInicio = new Date();
                                      dataInicio.setHours(hora, minuto, 0);
                                      const dataFim = new Date(dataInicio.getTime() + duracaoTotal * 60000);
                                      const horaFim = String(dataFim.getHours()).padStart(2, '0');
                                      const minutoFim = String(dataFim.getMinutes()).padStart(2, '0');
                                      setEditData(prev => ({ ...prev, hora_fim: `${horaFim}:${minutoFim}` }));
                                    }
                                  }
                                }}
                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-800">{servico.nome}</div>
                                <div className="text-xs text-gray-500">{servico.duracao_minutos} minutos</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      {/* Preview da duração total dos serviços */}
                      {servicosSelecionadosEdit.length > 0 && (
                        <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="text-gray-600">Serviços selecionados:</span>
                              <span className="ml-2 font-semibold text-purple-600">{servicosSelecionadosEdit.length}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Duração total:</span>
                              <span className="ml-2 font-bold text-purple-700">
                                {servicosSelecionadosEdit.reduce((total, nomeServico) => {
                                  const servico = servicos.find(s => s.nome === nomeServico);
                                  return total + (servico?.duracao_minutos || 0);
                                }, 0)} minutos
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Horários */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Horário Início */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Início *
                        </label>
                        <input
                          type="time"
                          value={editData.hora_inicio}
                          onChange={(e) => setEditData({ ...editData, hora_inicio: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                          required
                        />
                      </div>

                      {/* Horário Fim */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Fim *
                        </label>
                        <input
                          type="time"
                          value={editData.hora_fim}
                          onChange={(e) => setEditData({ ...editData, hora_fim: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors"
                          required
                        />
                      </div>
                    </div>

                    {/* Preview da duração */}
                    {editData.hora_inicio && editData.hora_fim && (
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <span className="text-gray-600">Duração calculada:</span>
                          <span className="font-bold text-purple-700">
                            {(() => {
                              const [horaIni, minIni] = editData.hora_inicio.split(':').map(Number);
                              const [horaFim, minFim] = editData.hora_fim.split(':').map(Number);
                              const minutosInicio = horaIni * 60 + minIni;
                              const minutosFim = horaFim * 60 + minFim;
                              const duracao = minutosFim - minutosInicio;
                              return duracao > 0 ? `${duracao} minutos` : '⚠️ Inválido';
                            })()}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Observações */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        📝 Observações
                      </label>
                      <textarea
                        value={editData.observacoes}
                        onChange={(e) => setEditData({ ...editData, observacoes: e.target.value })}
                        placeholder="Anotações sobre o atendimento..."
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-purple-500 focus:outline-none transition-colors resize-none"
                      />
                    </div>

                    {/* Seção de Valor e Pagamento */}
                    {selectedAgendamento?.lancamento_id && (
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Pagamento
                        </h4>

                        {/* Valor Total */}
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Valor Total</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={editData.valor_total}
                              onChange={(e) => setEditData(prev => ({ ...prev, valor_total: e.target.value }))}
                              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        {/* Formas de Pagamento */}
                        <p className="text-sm text-gray-600 mb-2">Forma de pagamento:</p>
                        <div className="flex flex-wrap gap-2">
                          {formasPagamentoDB
                            .filter(f => f.codigo !== 'fiado' && f.codigo !== 'troca_gratis')
                            .map(forma => (
                              <button
                                key={forma.codigo}
                                type="button"
                                onClick={() => setEditData(prev => ({
                                  ...prev,
                                  forma_pagamento: forma.codigo,
                                  is_fiado: false,
                                  is_troca_gratis: false,
                                  valor_referencia: '',
                                }))}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                                  editData.forma_pagamento === forma.codigo && !editData.is_fiado && !editData.is_troca_gratis
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white border border-gray-200 text-gray-700 hover:border-green-300'
                                }`}
                              >
                                <span>{forma.icone}</span>
                                <span>{forma.nome}</span>
                                {forma.taxa_percentual > 0 && (
                                  <span className={`text-xs ${editData.forma_pagamento === forma.codigo ? 'text-green-200' : 'text-red-500'}`}>
                                    ({forma.taxa_percentual}%)
                                  </span>
                                )}
                              </button>
                            ))
                          }

                          <button
                            type="button"
                            onClick={() => setEditData(prev => ({
                              ...prev,
                              forma_pagamento: 'fiado',
                              is_fiado: true,
                              is_troca_gratis: false,
                              valor_referencia: '',
                            }))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                              editData.is_fiado
                                ? 'bg-orange-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-300'
                            }`}
                          >
                            <span>📝</span>
                            <span>Fiado</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditData(prev => ({
                              ...prev,
                              forma_pagamento: 'troca_gratis',
                              is_fiado: false,
                              is_troca_gratis: true,
                              valor_total: '0',
                            }))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                              editData.is_troca_gratis
                                ? 'bg-purple-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'
                            }`}
                          >
                            <span>🎁</span>
                            <span>Troca / Grátis</span>
                          </button>
                        </div>

                        {editData.is_fiado && (
                          <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                            <p className="text-orange-800 font-medium flex items-center gap-2">
                              <span>📝</span> Fiado selecionado
                            </p>
                            <ul className="text-orange-700 mt-2 space-y-1 list-disc list-inside">
                              <li>O serviço será marcado como <strong>pendente</strong></li>
                              <li>Não entrará no faturamento até ser pago</li>
                              <li>Você poderá receber o pagamento em Controle de Fiados</li>
                            </ul>
                          </div>
                        )}

                        {editData.is_troca_gratis && (
                          <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                            <p className="text-purple-800 font-medium flex items-center gap-2 mb-2">
                              <span>🎁</span> Troca / Grátis selecionado
                            </p>
                            <p className="text-purple-700 text-sm mb-3">
                              O valor será R$ 0,00 (sem faturamento e sem comissão).
                            </p>
                            <div>
                              <label className="block text-sm font-medium text-purple-700 mb-1">
                                Valor de referência (opcional)
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editData.valor_referencia}
                                  onChange={(e) => setEditData(prev => ({ ...prev, valor_referencia: e.target.value }))}
                                  className="w-full pl-10 pr-4 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  placeholder="0.00"
                                />
                              </div>
                              <p className="text-xs text-purple-600 mt-1">
                                Apenas para referência/histórico. Não entra em relatórios.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Preview de comissão em tempo real */}
                        {editData.forma_pagamento && editData.valor_total && selectedColaboradorEdit &&
                         !editData.is_fiado && !editData.is_troca_gratis && (() => {
                          const formaSelecionada = formasPagamentoDB.find(f => f.codigo === editData.forma_pagamento);
                          const taxa = formaSelecionada?.taxa_percentual || 0;
                          if (taxa <= 0) return null;
                          const valorTotal = parseFloat(editData.valor_total);
                          const valorTaxa = (valorTotal * taxa) / 100;
                          const comissaoBruta = (valorTotal * selectedColaboradorEdit.porcentagem_comissao) / 100;
                          const comissaoLiquida = comissaoBruta - valorTaxa;
                          return (
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                              <p className="text-yellow-800 font-medium">Taxa de {formaSelecionada?.nome}: {taxa}%</p>
                              <ul className="text-yellow-700 mt-1 space-y-1">
                                <li>Comissão bruta: R$ {comissaoBruta.toFixed(2)}</li>
                                <li>Taxa descontada: -R$ {valorTaxa.toFixed(2)}</li>
                                <li className="font-bold">Comissão líquida: R$ {comissaoLiquida.toFixed(2)}</li>
                              </ul>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Botões de Edição */}
                  <div className="pt-4 space-y-3">
                    <button
                      onClick={salvarEdicao}
                      className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Salvar Alterações
                    </button>

                    <button
                      onClick={() => { setIsEditMode(false); setEditIsCompleted(false); setSelectedColaboradorEdit(null); setFiltroServico(''); }}
                      className="w-full px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
