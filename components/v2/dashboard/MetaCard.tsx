'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Button from '@/components/v2/ui/Button';
import { brl } from '@/lib/v2/formatters';
import { Stat, type DashResp } from './_shared';

export default function MetaCard({ meta, onSalvar }: { meta?: DashResp['meta']; onSalvar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const temMeta = !!meta && meta.valor != null && meta.valor > 0;
  const realizado = meta?.realizado ?? 0;
  const pct = temMeta ? Math.min(100, Math.round((realizado / meta!.valor!) * 100)) : 0;

  const salvar = async () => {
    const v = parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0;
    if (v <= 0) { toast.error('Informe uma meta maior que zero.'); return; }
    setSalvando(true);
    try {
      const r = await fetch('/api/v2/dashboard', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meta_mensal: v }) });
      if (r.ok) { toast.success('Meta salva!'); setEditando(false); onSalvar(); } else toast.error((await r.json()).error || 'Erro.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  if (!temMeta || editando) {
    return (
      <Card>
        <CardHead title="Meta do mês" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--nb-ink-soft)' }}>
            {editando ? 'Atualize a meta mensal de faturamento:' : 'Defina a meta mensal de faturamento do salão para acompanhar o progresso.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 14 }}>R$</span>
              <input autoFocus type="text" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="75.000" className="nb-input nb-num" style={{ paddingLeft: 34 }} onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }} />
            </div>
            <Button icon="Check" onClick={salvar} disabled={salvando}>{salvando ? '…' : 'Salvar'}</Button>
          </div>
          {editando && <button onClick={() => setEditando(false)} className="nb-btn nb-btn-quiet" style={{ alignSelf: 'flex-start', fontSize: 12.5 }}>Cancelar</button>}
        </div>
      </Card>
    );
  }

  const projecao = meta?.projecao ?? null;
  const falta = meta?.falta ?? Math.max(0, (meta!.valor! - realizado));
  const media = meta?.mediaDiariaNecessaria ?? null;
  const diasRest = meta?.diasRestantes ?? null;
  const projAtinge = projecao != null && projecao >= meta!.valor!;

  return (
    <Card>
      <CardHead title="Meta do mês" action={{ label: 'Editar', onClick: () => { setValor(String(meta!.valor)); setEditando(true); } }} />
      <div style={{ display: 'grid', placeItems: 'center', padding: '2px 0 8px' }}><Ring pct={pct} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid var(--nb-rule-soft)' }}>
        <Stat label="Realizado" value={brl(realizado)} />
        <Stat label="Meta" value={brl(meta!.valor!)} />
        <Stat label="Falta" value={brl(falta)} tone={falta > 0 ? 'bad' : 'ok'} />
        {projecao != null && (
          <Stat label="Projeção fim do mês" value={brl(projecao)} tone={projAtinge ? 'ok' : 'bad'}
            hint={projAtinge ? 'deve bater a meta' : 'abaixo da meta'} />
        )}
        {media != null && media > 0 && diasRest != null && (
          <Stat label="Média diária necessária" value={brl(media)} hint={`${diasRest} ${diasRest === 1 ? 'dia restante' : 'dias restantes'}`} />
        )}
      </div>
    </Card>
  );
}

function Ring({ pct: p }: { pct: number }) {
  const r = 52, c = 2 * Math.PI * r, filled = (p / 100) * c;
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--nb-rule)" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={p >= 100 ? 'var(--nb-ok)' : 'var(--nb-accent)'} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${filled} ${c}`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <div className="nb-num" style={{ fontSize: 26, fontWeight: 700, color: 'var(--nb-ink)', lineHeight: 1 }}>{p}%</div>
          <div style={{ fontSize: 11, color: 'var(--nb-ink-faint)', marginTop: 2 }}>da meta</div>
        </div>
      </div>
    </div>
  );
}
