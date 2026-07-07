'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import Button from '@/components/v2/ui/Button';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, pct, iniciais, mesExtenso } from '@/lib/v2/formatters';

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

type Colab = {
  id: string;
  nome: string;
  telefone: string | null;
  porcentagem_comissao: number;
  faturamento: number;
  comissao: number;
  atendimentos: number;
};

export default function ColaboradorasV2() {
  const [mes, setMes] = useState(mesAtual());
  const [colabs, setColabs] = useState<Colab[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ aberto: boolean; editando: Colab | null }>({ aberto: false, editando: null });

  const carregar = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v2/colaboradoras?mes=${m}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setColabs(j.colaboradoras || []);
      else toast.error(j.error || 'Erro ao carregar.');
    } catch { toast.error('Erro de conexão.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(mes); }, [mes, carregar]);

  const actions = (
    <>
      <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="nb-input" style={{ width: 170 }} />
      <Button icon="Plus" onClick={() => setForm({ aberto: true, editando: null })}>Nova colaboradora</Button>
    </>
  );

  return (
    <PageShell title="Colaboradoras" subtitle="Equipe, agenda e performance" actions={actions}>
      <p className="nb-eyebrow" style={{ marginBottom: 14 }}>Performance de {mesExtenso(mes)}</p>

      {loading ? (
        <div className="nb-card nb-card-pad" style={{ textAlign: 'center', padding: 48, color: 'var(--nb-ink-faint)' }}>Carregando…</div>
      ) : colabs.length === 0 ? (
        <div className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '56px 24px' }}>
          <span aria-hidden style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name="Users" size={24} /></span>
          <p style={{ margin: 0, fontFamily: 'var(--nb-serif)', fontSize: 19, color: 'var(--nb-ink)' }}>Nenhuma colaboradora cadastrada</p>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--nb-ink-soft)', maxWidth: '40ch' }}>Cadastre a equipe do salão para acompanhar faturamento, comissão e atendimentos de cada profissional.</p>
          <Button icon="Plus" onClick={() => setForm({ aberto: true, editando: null })}>Nova colaboradora</Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {colabs.map((c) => (
            <div key={c.id} className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span aria-hidden style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 640 }}>{iniciais(c.nome)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 620, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                  <div style={{ marginTop: 5 }}>
                    <span className="nb-badge" style={{ borderColor: 'var(--nb-accent)', color: 'var(--nb-accent-deep)', background: 'var(--nb-accent-wash)' }}>
                      <span className="nb-num">{pct(c.porcentagem_comissao, { casas: 0 })}</span> comissão
                    </span>
                  </div>
                  {c.telefone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>
                      <Icon name="MessageCircle" size={13} /><span className="nb-num">{c.telefone}</span>
                    </div>
                  )}
                </div>
                <button type="button" aria-label="Editar colaboradora" onClick={() => setForm({ aberto: true, editando: c })}
                  className="nb-btn nb-btn-ghost" style={{ flex: '0 0 auto', padding: 8 }}>
                  <Icon name="UserCog" size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 14, borderTop: '1px solid var(--nb-rule-soft)' }}>
                <Metrica label="Faturamento" value={brl(c.faturamento)} />
                <Metrica label="Comissão" value={brl(c.comissao)} tone="accent" />
                <Metrica label="Atend." value={num(c.atendimentos)} />
              </div>
            </div>
          ))}
        </div>
      )}

      {form.aberto && (
        <ColabForm
          editando={form.editando}
          onFechar={() => setForm({ aberto: false, editando: null })}
          onSalvo={() => { setForm({ aberto: false, editando: null }); carregar(mes); }}
        />
      )}
    </PageShell>
  );
}

function Metrica({ label, value, tone }: { label: string; value: string; tone?: 'accent' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 15, fontWeight: 660, lineHeight: 1.15, marginTop: 3, color: tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}

function ColabForm({ editando, onFechar, onSalvo }: { editando: Colab | null; onFechar: () => void; onSalvo: () => void }) {
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [telefone, setTelefone] = useState(editando?.telefone ?? '');
  const [porcentagem, setPorcentagem] = useState(editando ? String(editando.porcentagem_comissao) : '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Informe o nome da colaboradora.'); return; }
    const perc = parseFloat(porcentagem.replace(',', '.')) || 0;
    setSalvando(true);
    try {
      const url = editando ? `/api/v2/colaboradoras?id=${editando.id}` : '/api/v2/colaboradoras';
      const r = await fetch(url, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim(), porcentagem_comissao: perc }),
      });
      if (r.ok) { toast.success(editando ? 'Colaboradora atualizada!' : 'Colaboradora cadastrada!'); onSalvo(); }
      else toast.error((await r.json()).error || 'Erro ao salvar.');
    } catch { toast.error('Erro de conexão.'); } finally { setSalvando(false); }
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onFechar}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'color-mix(in srgb, var(--nb-ink) 32%, transparent)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card nb-card-pad" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 640, color: 'var(--nb-ink)' }}>{editando ? 'Editar colaboradora' : 'Nova colaboradora'}</h3>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="nb-btn nb-btn-ghost" style={{ padding: 7 }}><Icon name="X" size={16} /></button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="nb-eyebrow" style={{ fontSize: 10 }}>Nome</span>
          <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da profissional" className="nb-input" />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="nb-eyebrow" style={{ fontSize: 10 }}>Telefone</span>
          <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(00) 00000-0000" className="nb-input nb-num" />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="nb-eyebrow" style={{ fontSize: 10 }}>Comissão (%)</span>
          <div style={{ position: 'relative' }}>
            <input value={porcentagem} onChange={(e) => setPorcentagem(e.target.value)} inputMode="decimal" placeholder="40" className="nb-input nb-num" style={{ paddingRight: 34 }} onKeyDown={(e) => { if (e.key === 'Enter') salvar(); }} />
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', fontSize: 14 }}>%</span>
          </div>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onFechar} className="nb-btn nb-btn-quiet">Cancelar</button>
          <Button icon="Check" onClick={salvar} disabled={salvando}>{salvando ? '…' : 'Salvar'}</Button>
        </div>
      </div>
    </div>
  );
}
