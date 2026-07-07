'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Button from '@/components/v2/ui/Button';
import Icon from '@/components/v2/ui/Icon';
import { brl } from '@/lib/v2/formatters';

type Forma = { id: number; nome: string; codigo: string; icone: string | null; taxa_percentual: number; ativo: boolean; ordem: number };
type Config = { meta_mensal: number | null; aliquota_imposto: number | null };

export default function ConfiguracoesV2() {
  const [formas, setFormas] = useState<Forma[]>([]);
  const [config, setConfig] = useState<Config>({ meta_mensal: null, aliquota_imposto: null });
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v2/config', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setFormas(j.formas || []); setConfig(j.config || { meta_mensal: null, aliquota_imposto: null }); }
      else toast.error(j.error || 'Erro ao carregar configurações.');
    } catch { toast.error('Falha de conexão.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <PageShell title="Configurações" subtitle="Formas de pagamento, metas e impostos">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }} className="v2-row3">
        <FormasCard formas={formas} loading={loading} onSaved={carregar} />
        <FinanceiroCard config={config} loading={loading} onSaved={carregar} />
      </div>
    </PageShell>
  );
}

/* ---------------- Formas de pagamento ---------------- */
function FormasCard({ formas, loading, onSaved }: { formas: Forma[]; loading: boolean; onSaved: () => void }) {
  const [edits, setEdits] = useState<Record<number, { taxa: string; ativo: boolean }>>({});
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    const m: Record<number, { taxa: string; ativo: boolean }> = {};
    for (const f of formas) m[f.id] = { taxa: String(f.taxa_percentual ?? 0), ativo: f.ativo };
    setEdits(m);
  }, [formas]);

  const salvar = async (f: Forma) => {
    const e = edits[f.id];
    if (!e) return;
    const taxa = Number(e.taxa.replace(',', '.'));
    if (!Number.isFinite(taxa) || taxa < 0 || taxa > 100) { toast.error('Taxa deve ser entre 0 e 100.'); return; }
    setSaving(f.id);
    try {
      const r = await fetch('/api/v2/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'forma', id: f.id, taxa_percentual: taxa, ativo: e.ativo }),
      });
      const j = await r.json();
      if (r.ok) { toast.success(`${f.nome} atualizada.`); onSaved(); }
      else toast.error(j.error || 'Erro ao salvar.');
    } catch { toast.error('Falha de conexão.'); } finally { setSaving(null); }
  };

  return (
    <Card pad={false}>
      <div style={{ padding: '18px 20px 0' }}>
        <CardHead title="Formas de pagamento" right={<span className="nb-eyebrow">{formas.length} forma{formas.length !== 1 ? 's' : ''}</span>} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="nb-table" style={{ minWidth: 520 }}>
          <thead><tr><th>Forma</th><th style={{ textAlign: 'right' }}>Taxa %</th><th style={{ textAlign: 'center' }}>Ativo</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              : formas.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Nenhuma forma cadastrada.</td></tr>
              : formas.map((f) => {
                const e = edits[f.id] ?? { taxa: String(f.taxa_percentual ?? 0), ativo: f.ativo };
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 560 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Icon name={f.icone || 'CreditCard'} size={16} /> {f.nome}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <input type="number" min={0} max={100} step="0.01" value={e.taxa} className="nb-input nb-num"
                        onChange={(ev) => setEdits((p) => ({ ...p, [f.id]: { ...e, taxa: ev.target.value } }))}
                        style={{ width: 96, textAlign: 'right', display: 'inline-block' }} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={e.ativo}
                        onChange={(ev) => setEdits((p) => ({ ...p, [f.id]: { ...e, ativo: ev.target.checked } }))}
                        style={{ width: 18, height: 18, accentColor: 'var(--nb-accent)', cursor: 'pointer' }} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button variant="ghost" icon="Check" onClick={() => salvar(f)} disabled={saving === f.id}>
                        {saving === f.id ? 'Salvando…' : 'Salvar'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', padding: '0 20px 18px', marginTop: 4, marginBottom: 0 }}>
        A taxa é descontada do valor recebido em cada atendimento com essa forma de pagamento.
      </p>
    </Card>
  );
}

/* ---------------- Financeiro ---------------- */
function FinanceiroCard({ config, loading, onSaved }: { config: Config; loading: boolean; onSaved: () => void }) {
  const [meta, setMeta] = useState('');
  const [aliquota, setAliquota] = useState('');
  const [saving, setSaving] = useState<'meta_mensal' | 'aliquota_imposto' | null>(null);

  useEffect(() => {
    setMeta(config.meta_mensal != null ? String(config.meta_mensal) : '');
    setAliquota(config.aliquota_imposto != null ? String(config.aliquota_imposto) : '');
  }, [config]);

  const salvar = async (chave: 'meta_mensal' | 'aliquota_imposto', raw: string) => {
    const val = Number(raw.replace(',', '.'));
    if (!Number.isFinite(val) || val < 0) { toast.error('Informe um valor válido.'); return; }
    if (chave === 'aliquota_imposto' && val > 100) { toast.error('Alíquota deve ser entre 0 e 100.'); return; }
    setSaving(chave);
    try {
      const r = await fetch('/api/v2/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'config', chave, valor: val }),
      });
      const j = await r.json();
      if (r.ok) { toast.success('Configuração salva.'); onSaved(); }
      else toast.error(j.error || 'Erro ao salvar.');
    } catch { toast.error('Falha de conexão.'); } finally { setSaving(null); }
  };

  return (
    <Card>
      <CardHead title="Financeiro" right={<Icon name="SlidersHorizontal" size={16} />} />
      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>Carregando…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Meta mensal */}
          <div>
            <label className="nb-eyebrow" style={{ display: 'block', marginBottom: 8 }}>Meta mensal (R$)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={0} step="0.01" value={meta} onChange={(e) => setMeta(e.target.value)}
                placeholder="0,00" className="nb-input nb-num" style={{ flex: 1 }} />
              <Button icon="Check" onClick={() => salvar('meta_mensal', meta)} disabled={saving === 'meta_mensal'}>
                {saving === 'meta_mensal' ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', margin: '6px 0 0' }}>
              Faturamento-alvo usado pelo dashboard. {config.meta_mensal != null && <>Atual: <span className="nb-num">{brl(config.meta_mensal)}</span>.</>}
            </p>
          </div>

          {/* Alíquota de imposto */}
          <div>
            <label className="nb-eyebrow" style={{ display: 'block', marginBottom: 8 }}>Alíquota de imposto ME (%)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={0} max={100} step="0.01" value={aliquota} onChange={(e) => setAliquota(e.target.value)}
                placeholder="0" className="nb-input nb-num" style={{ flex: 1 }} />
              <Button icon="Check" onClick={() => salvar('aliquota_imposto', aliquota)} disabled={saving === 'aliquota_imposto'}>
                {saving === 'aliquota_imposto' ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', margin: '6px 0 0' }}>
              Percentual aplicado sobre a receita bruta no DRE.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
