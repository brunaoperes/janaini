/**
 * Dados de DEMONSTRAÇÃO do Dashboard V2 (Fase 0).
 * Servem só para validar o desenho da tela. A fonte real e correta é conectada
 * na FASE 1 (camada financeira centralizada em lib/v2/financial). Números espelham
 * o mockup aprovado.
 */
export const DEMO = {
  kpis: {
    faturamentoHoje: { value: 2450, delta: 18, label: 'vs ontem (R$ 2.076,00)' },
    faturamentoMes: { value: 58760.3, delta: 22, label: 'vs mês anterior (R$ 48.118,20)' },
    caixaHoje: { value: 2210, delta: 0, label: 'vs ontem (R$ 2.210,00)' },
    agendamentosHoje: { value: 16, delta: 23, label: 'vs ontem (13)' },
    comissaoRealizada: { value: 6342.1, delta: 19, label: 'vs mês anterior (R$ 5.322,40)' },
    faturamentoLiquido: { value: 52418.2, delta: 21, label: 'vs mês anterior (R$ 43.355,60)' },
    fiadosAberto: { value: 3842.6, delta: 0, label: 'em 12 clientes' },
    ocupacao: { value: 78, delta: 8, label: 'p.p. vs ontem (70%)' },
  },
  performance: [
    { dia: '2026-07-01', atual: 1842, anterior: 1620 },
    { dia: '2026-07-02', atual: 4120, anterior: 2980 },
    { dia: '2026-07-03', atual: 5240, anterior: 3980 },
    { dia: '2026-07-04', atual: 5480, anterior: 4160 },
    { dia: '2026-07-05', atual: 3320, anterior: 3540 },
    { dia: '2026-07-06', atual: 3760, anterior: 3620 },
    { dia: '2026-07-07', atual: 5080, anterior: 4020 },
  ],
  periodo: { atual: 15842.7, anterior: 12781.3, variacao: 23.95 },
  pagamentos: [
    { forma: 'Dinheiro', valor: 780, pct: 31.8 },
    { forma: 'Pix', valor: 1080, pct: 44.1 },
    { forma: 'Débito', valor: 320, pct: 13.1 },
    { forma: 'Crédito', valor: 270, pct: 11.0 },
  ],
  topColaboradoras: [
    { nome: 'Daiane Silva', cargo: 'Designer de Unhas', valor: 12850.3 },
    { nome: 'Marien Dias', cargo: 'Cabeleireira', valor: 9420.6 },
    { nome: 'Franciele Souza', cargo: 'Design de Sobrancelhas', valor: 7380.2 },
    { nome: 'Jonas Henrique', cargo: 'Manicure', valor: 5210.1 },
    { nome: 'Talita Martins', cargo: 'Manicure', valor: 4980.5 },
  ],
  topServicos: [
    { nome: 'Banho de Gel', qtd: 520, valor: 15600 },
    { nome: 'Esmaltação em Gel', qtd: 410, valor: 8200 },
    { nome: 'Corte Feminino', qtd: 280, valor: 7000 },
    { nome: 'Coloração', qtd: 195, valor: 6825 },
    { nome: 'Escova', qtd: 160, valor: 4800 },
  ],
  proximos: [
    { hora: '10:00', cliente: 'Daiane (Nail Designer)', servico: 'Esmaltação em Gel', quando: 'Hoje · 07/07' },
    { hora: '11:00', cliente: 'Marien Dias', servico: 'Corte + Escova', quando: 'Hoje · 07/07' },
    { hora: '14:00', cliente: 'Franciele Souza', servico: 'Design de Sobrancelhas', quando: 'Hoje · 07/07' },
    { hora: '15:30', cliente: 'Ana Paula', servico: 'Unhas de Fibra', quando: 'Hoje · 07/07' },
    { hora: '16:00', cliente: 'Juliana Costa', servico: 'Banho de Gel', quando: 'Hoje · 07/07' },
  ],
  alertas: [
    { tone: 'bad', titulo: 'Fiados pendentes', nota: 'R$ 3.842,60 em 12 clientes', acao: 'Ver detalhes', icon: 'CircleAlert' },
    { tone: 'warn', titulo: 'Contas a vencer', nota: '3 contas a vencer nos próximos 7 dias', acao: 'Ver contas', icon: 'Clock' },
    { tone: 'info', titulo: 'Baixa ocupação', nota: 'Quarta-feira com taxa prevista de 42%', acao: 'Ver agenda', icon: 'Gauge' },
  ],
  meta: { atingidoPct: 78, atual: 58760.3, meta: 75000 },
} as const;
