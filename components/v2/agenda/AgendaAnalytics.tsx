'use client';

import { useMemo } from 'react';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { EmptyState, Stat } from '@/components/v2/dashboard/_shared';
import { brl, num } from '@/lib/v2/formatters';
import { Bloco, contarConflitos } from './timeline-utils';
import { Avatar } from './_ui';

type Colab = { id: number; nome: string };

export default function AgendaAnalytics({
  blocos, colabs, corDe, receitaConfiavel,
}: {
  blocos: Bloco[];
  colabs: Colab[];
  corDe: (id: number | null) => string;
  receitaConfiavel: boolean;
}) {
  const dados = useMemo(() => {
    const ativos = blocos.filter((b) => b.status !== 'cancelado');

    // (1) Resumo
    const confirmados = blocos.filter((b) => b.status === 'confirmado').length;
    const concluidos = blocos.filter((b) => b.status === 'concluido').length;
    const pendentes = blocos.filter((b) => b.status === 'pendente').length;

    // (2) Top colaboradoras
    const porColab = new Map<number, { nome: string; qtd: number; receita: number }>();
    for (const b of ativos) {
      const id = b.colaboradorId;
      if (id == null) continue;
      const nome = b.colaboradorNome || colabs.find((c) => c.id === id)?.nome || 'Profissional';
      const cur = porColab.get(id) || { nome, qtd: 0, receita: 0 };
      cur.qtd += 1;
      cur.receita += b.valorEstimado;
      porColab.set(id, cur);
    }
    const top = [...porColab.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.qtd - a.qtd || b.receita - a.receita);

    // (3) Horários de pico (faixas de 1h)
    const porHora = new Map<number, number>();
    for (const b of ativos) {
      const h = Math.floor(b.inicioMin / 60);
      porHora.set(h, (porHora.get(h) || 0) + 1);
    }
    const picos = [...porHora.entries()]
      .map(([h, qtd]) => ({ h, qtd }))
      .sort((a, b) => b.qtd - a.qtd || a.h - b.h);
    const picoMax = picos.reduce((m, p) => Math.max(m, p.qtd), 0);

    // (4) Serviços do dia
    const porServ = new Map<string, { qtd: number; receita: number }>();
    for (const b of ativos) {
      const nome = (b.servico || '').trim() || 'Sem serviço';
      const cur = porServ.get(nome) || { qtd: 0, receita: 0 };
      cur.qtd += 1;
      cur.receita += b.valorEstimado;
      porServ.set(nome, cur);
    }
    const servicos = [...porServ.entries()]
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.qtd - a.qtd);

    // (5) Alertas
    const conflitos = contarConflitos(ativos);
    const semAgenda = colabs.filter((c) => !porColab.has(c.id));
    const minutosOcupados = ativos.reduce((s, b) => s + (b.fimMin - b.inicioMin), 0);
    const colabsComAgenda = porColab.size;
    const ocupacao = colabsComAgenda ? (minutosOcupados / (colabsComAgenda * 600)) * 100 : null;

    return { confirmados, concluidos, pendentes, top, picos, picoMax, servicos, conflitos, semAgenda, ocupacao };
  }, [blocos, colabs]);

  const totalAtivos = blocos.filter((b) => b.status !== 'cancelado').length;

  // Monta lista de alertas
  const alertas: { icon: string; tone: string; titulo: string; sub: string }[] = [];
  if (dados.conflitos > 0) alertas.push({ icon: 'TriangleAlert', tone: 'bad', titulo: `${dados.conflitos} conflito${dados.conflitos > 1 ? 's' : ''} de horário`, sub: 'Agendamentos sobrepostos na mesma profissional' });
  if (dados.pendentes > 0) alertas.push({ icon: 'Clock', tone: 'warn', titulo: `${dados.pendentes} pendente${dados.pendentes > 1 ? 's' : ''} de confirmação`, sub: 'Aguardando confirmação do cliente' });
  if (dados.ocupacao != null && dados.ocupacao < 40 && totalAtivos > 0) alertas.push({ icon: 'Gauge', tone: 'info', titulo: 'Baixa ocupação', sub: `Carga horária em ${dados.ocupacao.toFixed(0)}% — há espaço na agenda` });
  if (dados.semAgenda.length > 0) alertas.push({ icon: 'CalendarOff', tone: 'info', titulo: `${dados.semAgenda.length} sem agenda no dia`, sub: dados.semAgenda.slice(0, 3).map((c) => c.nome).join(', ') + (dados.semAgenda.length > 3 ? '…' : '') });

  const toneColor = (t: string) => t === 'bad' ? 'var(--nb-bad)' : t === 'warn' ? 'var(--nb-warn)' : 'var(--nb-info)';
  const toneBg = (t: string) => t === 'bad' ? 'var(--nb-bad-bg)' : t === 'warn' ? 'var(--nb-warn-bg)' : 'var(--nb-info-bg)';

  return (
    <div className="v2-agenda-analytics" style={{ display: 'grid', gap: 16, marginTop: 20 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .v2-ag-resumo{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
        @media(max-width:560px){.v2-ag-resumo{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
      ` }} />
      {/* Linha 1: Resumo (largo) + Top colaboradoras */}
      <div className="v2-2col">
        {/* (1) Resumo do dia */}
        <Card>
          <CardHead title="Resumo do dia" />
          <div className="v2-ag-resumo">
            <Stat label="Confirmados" value={<span className="nb-num">{num(dados.confirmados)}</span>} tone="ok" />
            <Stat label="Concluídos" value={<span className="nb-num">{num(dados.concluidos)}</span>} />
            <Stat label="Agendados" value={<span className="nb-num">{num(dados.pendentes)}</span>} />
            <Stat label="Total do dia" value={<span className="nb-num">{num(totalAtivos)}</span>} />
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--nb-rule-soft)', fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>
            Cancelados não entram nesta visão (a agenda do dia já os exclui).
          </div>
        </Card>

        {/* (2) Top colaboradoras */}
        <Card>
          <CardHead title="Top colaboradoras" />
          {dados.top.length === 0 ? (
            <EmptyState icon="Users" titulo="Sem dados no período" texto="Nenhum agendamento para ranquear." h={140} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {dados.top.slice(0, 5).map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderBottom: i < Math.min(5, dados.top.length) - 1 ? '1px solid var(--nb-rule-soft)' : 'none' }}>
                  <span className="nb-num" style={{ width: 16, fontSize: 12.5, fontWeight: 700, color: i === 0 ? 'var(--nb-gold)' : 'var(--nb-ink-faint)', flex: '0 0 auto' }}>{i + 1}</span>
                  <Avatar nome={c.nome} cor={corDe(c.id)} size={26} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{c.qtd} agend.</span>
                  </span>
                  {receitaConfiavel && (
                    <span className="nb-num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nb-ink-soft)' }}>{brl(c.receita)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Linha 2: Picos + Serviços + Alertas */}
      <div className="v2-3col">
        {/* (3) Horários de pico */}
        <Card>
          <CardHead title="Horários de pico" />
          {dados.picos.length === 0 ? (
            <EmptyState icon="Clock" titulo="Sem dados no período" texto="Nenhum horário com agendamentos." h={140} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {dados.picos.slice(0, 6).map((p) => (
                <div key={p.h} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="nb-num" style={{ width: 40, fontSize: 12, color: 'var(--nb-ink-soft)', fontFamily: 'var(--nb-mono)', flex: '0 0 auto' }}>{String(p.h).padStart(2, '0')}h</span>
                  <div className="v2-track" style={{ flex: 1 }}>
                    <span style={{ width: `${(p.qtd / dados.picoMax) * 100}%`, background: 'var(--nb-accent)' }} />
                  </div>
                  <span className="nb-num" style={{ width: 20, textAlign: 'right', fontSize: 12.5, fontWeight: 600, color: 'var(--nb-ink)', flex: '0 0 auto' }}>{p.qtd}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* (4) Serviços do dia */}
        <Card>
          <CardHead title="Serviços do dia" />
          {dados.servicos.length === 0 ? (
            <EmptyState icon="Scissors" titulo="Sem dados no período" texto="Nenhum serviço registrado." h={140} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {dados.servicos.slice(0, 6).map((s, i, arr) => (
                <div key={s.nome} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--nb-rule-soft)' : 'none' }}>
                  <span style={{ minWidth: 0, flex: 1, fontSize: 12.5, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                  {receitaConfiavel && <span className="nb-num" style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{brl(s.receita)}</span>}
                  <span className="nb-num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--nb-accent-deep)', minWidth: 22, textAlign: 'right' }}>{s.qtd}×</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* (5) Alertas */}
        <Card>
          <CardHead title="Alertas" />
          {alertas.length === 0 ? (
            <EmptyState icon="CircleCheck" titulo="Tudo em ordem" texto="Nenhum alerta para este período." h={140} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alertas.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span aria-hidden style={{ width: 30, height: 30, borderRadius: 9, background: toneBg(a.tone), color: toneColor(a.tone), display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                    <Icon name={a.icon} size={15} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--nb-ink)' }}>{a.titulo}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.4 }}>{a.sub}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
