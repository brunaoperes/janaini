'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, iniciais, mesExtenso } from '@/lib/v2/formatters';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

export default function ComissoesV2() {
  const [mes, setMes] = useState(mesAtual());
  const [comissoes, setComissoes] = useState<any[]>([]);
  const [totais, setTotais] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v2/comissoes?mes=${m}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setComissoes(j.comissoes || []); setTotais(j.totais); }
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const actions = <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 170 }} />;

  return (
    <PageShell title="Comissões" subtitle={`A pagar — ${mesExtenso(mes)}`} actions={actions}>
      <div className="v2-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Total a pagar" value={brl(totais?.aPagar ?? 0)} icon="HandCoins" tone="accent" />
        <Kpi label="Faturamento gerado" value={brl(totais?.faturamento ?? 0)} icon="Wallet" />
        <Kpi label="Taxas de cartão" value={brl(totais?.taxa ?? 0)} icon="CreditCard" />
        <Kpi label="Atendimentos" value={num(totais?.atendimentos ?? 0)} icon="ReceiptText" />
      </div>

      <Card pad={false}>
        <div style={{ padding: '18px 20px 0' }}><CardHead title="Comissão por profissional" right={<span className="nb-eyebrow">realizado no mês</span>} /></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="nb-table" style={{ minWidth: 640 }}>
            <thead><tr><th>Profissional</th><th style={{ textAlign: 'right' }}>Atend.</th><th style={{ textAlign: 'right' }}>Faturamento gerado</th><th style={{ textAlign: 'right' }}>A pagar</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
                : comissoes.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Nenhuma comissão neste mês.</td></tr>
                : comissoes.map((c) => (
                  <tr key={c.colaborador_id}>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                        <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                        <span style={{ fontWeight: 560 }}>{c.nome}</span>
                      </span>
                    </td>
                    <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{num(c.atendimentos)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{brl(c.faturamento)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', fontWeight: 640, color: 'var(--nb-ink)' }}>{brl(c.aPagar)}</td>
                  </tr>
                ))}
            </tbody>
            {comissoes.length > 0 && totais && (
              <tfoot><tr style={{ borderTop: '2px solid var(--nb-rule)' }}>
                <td style={{ fontWeight: 680, paddingTop: 12 }}>Total</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12 }}>{num(totais.atendimentos)}</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12 }}>{brl(totais.faturamento)}</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12, fontWeight: 700, color: 'var(--nb-accent-deep)' }}>{brl(totais.aPagar)}</td>
              </tr></tfoot>
            )}
          </table>
        </div>
      </Card>
      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 14 }}>“A pagar” é a comissão da profissional já líquida da taxa de cartão, sobre atendimentos concluídos. O registro do pagamento (com histórico), recalculado no servidor, entra no acabamento desta tela.</p>
    </PageShell>
  );
}

function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'accent' }) {
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
      <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div><div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color: tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)', lineHeight: 1.1 }}>{value}</div></div>
    </div>
  );
}
