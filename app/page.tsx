import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import FaturamentoChart from '@/components/FaturamentoChart';

// Função para buscar métricas do dashboard
async function getDashboardData() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);

  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

  // Faturamento do dia
  const { data: faturamentoDia } = await supabase
    .from('lancamentos')
    .select('valor_total')
    .gte('data', hoje.toISOString())
    .lt('data', amanha.toISOString());

  const totalDia = faturamentoDia?.reduce((sum, l) => sum + (l.valor_total || 0), 0) || 0;

  // Faturamento do mês
  const { data: faturamentoMes } = await supabase
    .from('lancamentos')
    .select('valor_total')
    .gte('data', inicioMes.toISOString())
    .lte('data', fimMes.toISOString());

  const totalMes = faturamentoMes?.reduce((sum, l) => sum + (l.valor_total || 0), 0) || 0;

  // Total de clientes
  const { count: totalClientes } = await supabase
    .from('clientes')
    .select('*', { count: 'exact', head: true });

  // Agendamentos de hoje
  const { count: agendamentosHoje } = await supabase
    .from('agendamentos')
    .select('*', { count: 'exact', head: true })
    .gte('data_hora', hoje.toISOString())
    .lt('data_hora', amanha.toISOString());

  // Top 5 Colaboradoras (por valor total)
  const { data: topColaboradoras } = await supabase
    .from('lancamentos')
    .select(`
      colaborador_id,
      valor_total,
      colaboradores(nome)
    `)
    .gte('data', inicioMes.toISOString())
    .lte('data', fimMes.toISOString());

  const colaboradorasMap = new Map();
  topColaboradoras?.forEach((lanc: any) => {
    const id = lanc.colaborador_id;
    const nome = lanc.colaboradores?.nome || 'Desconhecida';
    const valor = lanc.valor_total || 0;

    if (!colaboradorasMap.has(id)) {
      colaboradorasMap.set(id, { nome, total: 0 });
    }
    colaboradorasMap.get(id).total += valor;
  });

  const topColab = Array.from(colaboradorasMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // Top 5 Clientes (por número de visitas)
  const { data: topClientesData } = await supabase
    .from('lancamentos')
    .select(`
      cliente_id,
      valor_total,
      clientes(nome)
    `)
    .gte('data', inicioMes.toISOString())
    .lte('data', fimMes.toISOString())
    .not('cliente_id', 'is', null);

  const clientesMap = new Map();
  topClientesData?.forEach((lanc: any) => {
    const id = lanc.cliente_id;
    const nome = lanc.clientes?.nome || 'Desconhecido';
    const valor = lanc.valor_total || 0;

    if (!clientesMap.has(id)) {
      clientesMap.set(id, { nome, visitas: 0, total: 0 });
    }
    clientesMap.get(id).visitas += 1;
    clientesMap.get(id).total += valor;
  });

  const topClientes = Array.from(clientesMap.values())
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, 5);

  // Próximos agendamentos de hoje
  const { data: proximosAgendamentos } = await supabase
    .from('agendamentos')
    .select(`
      id,
      data_hora,
      duracao_minutos,
      clientes(nome),
      colaboradores(nome)
    `)
    .gte('data_hora', new Date().toISOString())
    .lt('data_hora', amanha.toISOString())
    .order('data_hora', { ascending: true })
    .limit(5);

  // Faturamento dos últimos 30 dias (para o gráfico)
  const ultimos30Dias = new Date();
  ultimos30Dias.setDate(ultimos30Dias.getDate() - 30);
  ultimos30Dias.setHours(0, 0, 0, 0);

  const { data: faturamento30Dias } = await supabase
    .from('lancamentos')
    .select('data, valor_total')
    .gte('data', ultimos30Dias.toISOString())
    .order('data', { ascending: true });

  // Agrupar por dia
  const faturamentoPorDia = new Map();
  faturamento30Dias?.forEach((lanc: any) => {
    const data = new Date(lanc.data).toLocaleDateString('pt-BR');
    if (!faturamentoPorDia.has(data)) {
      faturamentoPorDia.set(data, 0);
    }
    faturamentoPorDia.set(data, faturamentoPorDia.get(data) + (lanc.valor_total || 0));
  });

  const chartData = Array.from(faturamentoPorDia.entries()).map(([data, valor]) => ({
    data,
    valor,
  }));

  return {
    totalDia,
    totalMes,
    totalClientes: totalClientes || 0,
    agendamentosHoje: agendamentosHoje || 0,
    topColaboradoras: topColab,
    topClientes,
    proximosAgendamentos: proximosAgendamentos || [],
    chartData,
  };
}

export default async function Dashboard() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen">
      <div className="container-main">
        {/* Header */}
        <div className="page-header">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-gray-600 text-lg">
                Visão geral do seu negócio
              </p>
            </div>
            <div className="text-6xl animate-float">📊</div>
          </div>
          <div className="divider-gradient"></div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card Faturamento do Dia */}
          <div className="card-elevated bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium mb-1">Hoje</p>
                <p className="text-3xl font-bold text-green-700">
                  R$ {data.totalDia.toFixed(2)}
                </p>
              </div>
              <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                💰
              </div>
            </div>
          </div>

          {/* Card Faturamento do Mês */}
          <div className="card-elevated bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium mb-1">Este Mês</p>
                <p className="text-3xl font-bold text-purple-700">
                  R$ {data.totalMes.toFixed(2)}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                📈
              </div>
            </div>
          </div>

          {/* Card Total de Clientes */}
          <div className="card-elevated bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium mb-1">Clientes</p>
                <p className="text-3xl font-bold text-blue-700">
                  {data.totalClientes}
                </p>
              </div>
              <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                👥
              </div>
            </div>
          </div>

          {/* Card Agendamentos Hoje */}
          <div className="card-elevated bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium mb-1">Agendamentos Hoje</p>
                <p className="text-3xl font-bold text-orange-700">
                  {data.agendamentosHoje}
                </p>
              </div>
              <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                📅
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico de Faturamento */}
        <div className="card-elevated mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <span className="text-3xl">📊</span>
            Faturamento - Últimos 30 Dias
          </h2>
          <FaturamentoChart data={data.chartData} />
        </div>

        {/* Grid com Rankings e Agendamentos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Top 5 Colaboradoras */}
          <div className="card-elevated">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              Top Colaboradoras
            </h3>
            <div className="space-y-3">
              {data.topColaboradoras.length > 0 ? (
                data.topColaboradoras.map((colab, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm
                        ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-purple-400'}
                      `}>
                        {index + 1}
                      </div>
                      <span className="font-medium text-gray-800">{colab.nome}</span>
                    </div>
                    <span className="font-bold text-purple-600">
                      R$ {colab.total.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
              )}
            </div>
          </div>

          {/* Top 5 Clientes */}
          <div className="card-elevated">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">💎</span>
              Top Clientes
            </h3>
            <div className="space-y-3">
              {data.topClientes.length > 0 ? (
                data.topClientes.map((cliente, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm
                        ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-400'}
                      `}>
                        {index + 1}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800 block">{cliente.nome}</span>
                        <span className="text-xs text-gray-500">{cliente.visitas} visitas</span>
                      </div>
                    </div>
                    <span className="font-bold text-blue-600">
                      R$ {cliente.total.toFixed(2)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
              )}
            </div>
          </div>

          {/* Próximos Agendamentos */}
          <div className="card-elevated">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              Próximos Agendamentos
            </h3>
            <div className="space-y-3">
              {data.proximosAgendamentos.length > 0 ? (
                data.proximosAgendamentos.map((agend: any) => {
                  const dataHora = new Date(agend.data_hora);
                  const hora = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={agend.id}
                      className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-orange-600">{hora}</span>
                        <span className="text-xs text-gray-500">{agend.duracao_minutos}min</span>
                      </div>
                      <p className="font-medium text-gray-800">{agend.clientes?.nome}</p>
                      <p className="text-sm text-gray-600">{agend.colaboradores?.nome}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum agendamento hoje</p>
              )}
            </div>
          </div>
        </div>

        {/* Links Rápidos */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link
            href="/lancamentos"
            className="card-elevated card-highlight text-center group hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gradient">
              Lançamentos
            </h3>
            <p className="text-gray-600 text-sm">Ver todos os lançamentos</p>
          </Link>

          <Link
            href="/admin"
            className="card-elevated card-highlight text-center group hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-3">⚙️</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gradient">
              Administração
            </h3>
            <p className="text-gray-600 text-sm">Gerenciar sistema</p>
          </Link>

          <Link
            href="/agendamentos"
            className="card-elevated card-highlight text-center group hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gradient">
              Agendamentos
            </h3>
            <p className="text-gray-600 text-sm">Ver agenda completa</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
