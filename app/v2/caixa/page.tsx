'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import { brl } from '@/lib/v2/formatters';
import toast from 'react-hot-toast';

const FORMAS = [
  { id: 'dinheiro', label: 'Dinheiro' }, { id: 'pix', label: 'Pix' },
  { id: 'cartao_debito', label: 'Débito' }, { id: 'cartao_credito', label: 'Crédito' },
  { id: 'fiado', label: 'Fiado recebido' }, { id: 'outros', label: 'Outros' },
];
const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
function addDias(iso: string, n: number) { const [a, m, d] = iso.split('-').map(Number); const dt = new Date(a, m - 1, d + n); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; }
function rotulo(iso: string) { const [a, m, d] = iso.split('-').map(Number); const dt = new Date(a, m - 1, d); const s = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); return s.charAt(0).toUpperCase() + s.slice(1); }

export default function CaixaV2() {
  const [data, setData] = useState(hojeBRT());
  const [dados, setDados] = useState<any>(null);
  const [informado, setInformado] = useState<Record<string, number>>({});
  const [obs, setObs] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (dia: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v2/caixa?data=${dia}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) {
        setDados(j);
        const inf: Record<string, number> = {};
        FORMAS.forEach((f) => { inf[f.id] = j.caixa?.informado?.[f.id] ?? 0; });
        setInformado(inf);
        setObs(j.caixa?.observacoes || '');
      }
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(data); }, [data, carregar]);

  const previsto = dados?.previsto || {};
  const caixa = dados?.caixa;
  const totalPrev = FORMAS.reduce((s, f) => s + (previsto[f.id] || 0), 0);
  const totalInf = FORMAS.reduce((s, f) => s + (informado[f.id] || 0), 0);
  const dif = totalInf - totalPrev;
  const fechado = caixa?.status === 'fechado';

  const preencherComPrevisto = () => { const inf: Record<string, number> = {}; FORMAS.forEach((f) => { inf[f.id] = previsto[f.id] || 0; }); setInformado(inf); };

  const fechar = async () => {
    setSalvando(true);
    try {
      const r = await fetch('/api/v2/caixa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, informado, observacoes: obs }) });
      if (r.ok) { toast.success('Caixa fechado!'); carregar(data); } else toast.error((await r.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };
  const reabrir = async () => {
    try {
      const r = await fetch(`/api/v2/caixa?data=${data}`, { method: 'PUT' });
      if (r.ok) { toast.success('Caixa reaberto (registrado no log).'); carregar(data); } else toast.error((await r.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); }
  };

  const actions = (
    <div className="cx-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button className="nb-btn nb-btn-ghost" onClick={() => setData(addDias(data, -1))} style={{ padding: 9 }}><Icon name="ChevronLeft" size={17} /></button>
      <button className="nb-btn nb-btn-ghost" onClick={() => setData(hojeBRT())} disabled={data === hojeBRT()}>Hoje</button>
      <button className="nb-btn nb-btn-ghost" onClick={() => setData(addDias(data, 1))} style={{ padding: 9 }}><Icon name="ChevronRight" size={17} /></button>
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="nb-input cx-date" style={{ width: 150, maxWidth: '100%' }} />
    </div>
  );

  return (
    <PageShell title="Fechamento de caixa" subtitle={rotulo(data)} actions={actions}>
      <style dangerouslySetInnerHTML={{ __html: `
        .cx-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 640px) {
          .cx-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .cx-date { flex: 1 1 130px; width: auto !important; }
          .cx-actions { width: 100%; }
          .cx-foot { flex-wrap: wrap; justify-content: stretch !important; }
          .cx-foot > button, .cx-foot .nb-btn { flex: 1 1 auto; }
          .cx-foot-note { flex: 1 1 100%; text-align: center; }
        }
        @media (max-width: 420px) {
          .cx-kpis { grid-template-columns: 1fr !important; }
        }
      ` }} />
      <div className="v2-kpis cx-kpis" style={{ marginBottom: 16 }}>
        <Mini label="Previsto (sistema)" value={brl(totalPrev)} icon="Landmark" />
        <Mini label="Informado (contado)" value={brl(totalInf)} icon="Calculator" />
        <Mini label="Diferença" value={brl(dif)} icon={dif === 0 ? 'Check' : 'CircleAlert'} tone={Math.abs(dif) < 0.01 ? 'ok' : 'bad'} />
        <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>Situação</div><div style={{ marginTop: 6 }}><Badge status={caixa?.status === 'fechado' ? 'concluido' : caixa?.status === 'reaberto' ? 'pendente' : 'futuro'}>{caixa?.status === 'fechado' ? 'Fechado' : caixa?.status === 'reaberto' ? 'Reaberto' : 'Aberto'}</Badge></div></div>
        </div>
      </div>

      <Card>
        <CardHead title="Conferência por forma de pagamento" right={!fechado ? <button className="nb-btn nb-btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={preencherComPrevisto}>Copiar previsto</button> : undefined} />
        <div className="cx-table-wrap">
          <table className="nb-table" style={{ minWidth: 520 }}>
            <thead><tr><th>Forma</th><th style={{ textAlign: 'right' }}>Previsto</th><th style={{ textAlign: 'right' }}>Informado</th><th style={{ textAlign: 'right' }}>Diferença</th></tr></thead>
            <tbody>
              {FORMAS.map((f) => {
                const p = previsto[f.id] || 0, i = informado[f.id] || 0, d = i - p;
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 560 }}>{f.label}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{brl(p)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <input type="number" step="0.01" min={0} disabled={fechado} value={informado[f.id] ?? 0}
                        onChange={(e) => setInformado({ ...informado, [f.id]: parseFloat(e.target.value) || 0 })}
                        className="nb-input nb-num" style={{ width: 120, textAlign: 'right', display: 'inline-block' }} />
                    </td>
                    <td className="nb-num" style={{ textAlign: 'right', color: Math.abs(d) < 0.01 ? 'var(--nb-ink-faint)' : d < 0 ? 'var(--nb-bad)' : 'var(--nb-warn)', fontWeight: Math.abs(d) < 0.01 ? 400 : 600 }}>{Math.abs(d) < 0.01 ? '—' : brl(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 16 }}>
          <label className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Observações</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} disabled={fechado} rows={2} className="nb-input" placeholder="Ex.: sangria de R$100, troco inicial…" />
        </div>
        <div className="cx-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {fechado ? (
            <>
              <span className="cx-foot-note" style={{ alignSelf: 'center', fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>Fechado em {caixa?.fechado_em ? new Date(caixa.fechado_em).toLocaleString('pt-BR') : '—'} por {caixa?.responsavel_nome}</span>
              <Button variant="ghost" icon="Clock" onClick={reabrir}>Reabrir caixa</Button>
            </>
          ) : (
            <Button icon="Check" onClick={fechar} disabled={salvando || loading}>{salvando ? 'Fechando…' : 'Fechar caixa do dia'}</Button>
          )}
        </div>
      </Card>

      {caixa?.status === 'reaberto' && (
        <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: 'var(--nb-warn-bg)', border: '1px solid #E7D4B4', fontSize: 13, color: 'var(--nb-warn)', display: 'flex', gap: 9, alignItems: 'center' }}>
          <Icon name="CircleAlert" size={17} /> Este caixa foi reaberto — a reabertura ficou registrada no log de auditoria. Feche novamente após ajustar.
        </div>
      )}

      {dados?.historico?.length > 0 && (
        <Card style={{ marginTop: 16 }}>
          <CardHead title="Últimos fechamentos" />
          <div className="cx-table-wrap">
            <table className="nb-table" style={{ minWidth: 520 }}>
              <thead><tr><th>Data</th><th style={{ textAlign: 'right' }}>Previsto</th><th style={{ textAlign: 'right' }}>Informado</th><th style={{ textAlign: 'right' }}>Diferença</th><th>Situação</th></tr></thead>
              <tbody>
                {dados.historico.map((h: any) => (
                  <tr key={h.data} style={{ cursor: 'pointer' }} onClick={() => setData(h.data)}>
                    <td className="nb-num">{h.data.split('-').reverse().join('/')}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{brl(h.total_previsto)}</td>
                    <td className="nb-num" style={{ textAlign: 'right' }}>{brl(h.total_informado)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: Math.abs(h.diferenca) < 0.01 ? 'var(--nb-ink-faint)' : 'var(--nb-bad)' }}>{Math.abs(h.diferenca) < 0.01 ? '—' : brl(h.diferenca)}</td>
                    <td><Badge status={h.status === 'fechado' ? 'concluido' : 'pendente'}>{h.status === 'fechado' ? 'Fechado' : 'Reaberto'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 14 }}>“Previsto” vem dos lançamentos do dia por forma de pagamento (mesma regra da V2). Diferença negativa = falta no caixa; positiva = sobra. Reabrir fica registrado no log — nada é bloqueado sem aviso.</p>
    </PageShell>
  );
}

function Mini({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' | 'bad' }) {
  const cor = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-ink)';
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
      <div><div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div><div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color: cor, lineHeight: 1.1 }}>{value}</div></div>
    </div>
  );
}
