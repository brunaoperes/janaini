'use client';

import { useEffect, useState } from 'react';
import { Power } from 'lucide-react';
import Icon from '@/components/v2/ui/Icon';
import { brl, num } from '@/lib/v2/formatters';
import { LABEL_CAT } from './categoria';
import { CategoriaIcon, CatBadge, StatusBadge, ExclBadge, dataBR, type DetalheResp, type ServicoItem } from './_shared';

type Aba = 'geral' | 'profissionais' | 'historico';

function Linha({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--nb-rule-soft)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>{label}</span>
      <span className="nb-num" style={{ fontSize: 14, fontWeight: 560, color: tone || 'var(--nb-ink)', textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export default function ServicoDrawer({
  id, onClose, onEditar, onDuplicar, onToggle,
}: {
  id: number | null;
  onClose: () => void;
  onEditar: (s: ServicoItem) => void;
  onDuplicar: (s: ServicoItem) => void;
  onToggle: (s: ServicoItem) => void;
}) {
  const [d, setD] = useState<DetalheResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('geral');

  useEffect(() => {
    if (id == null) { setD(null); setErro(''); setAba('geral'); return; }
    let vivo = true;
    setLoading(true); setErro(''); setAba('geral');
    (async () => {
      try {
        const r = await fetch(`/api/v2/servicos?detalhe=${id}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        if (r.ok) setD(j); else setErro(j.error || 'Não foi possível carregar.');
      } catch { if (vivo) setErro('Erro de conexão.'); }
      finally { if (vivo) setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    if (id == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  const aberto = id != null;
  const S = d?.servico;

  const TABS: [Aba, string][] = [['geral', 'Geral'], ['profissionais', 'Profissionais'], ['historico', 'Histórico']];

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(33,28,25,.36)', backdropFilter: 'blur(2px)',
        opacity: aberto ? 1 : 0, pointerEvents: aberto ? 'auto' : 'none', transition: 'opacity .22s',
      }} />
      <aside role="dialog" aria-modal="true" aria-label="Detalhe do serviço" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 71, width: 'min(460px, 96vw)',
        background: 'var(--nb-surface)', borderLeft: '1px solid var(--nb-rule)', boxShadow: '-12px 0 40px -20px rgba(33,28,25,.4)',
        transform: aberto ? 'none' : 'translateX(102%)', transition: 'transform .28s cubic-bezier(.22,1,.36,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
            {S && (
              <span aria-hidden style={{ flex: '0 0 auto', width: 42, height: 42, borderRadius: 12, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
                <CategoriaIcon cat={S.categoria} size={20} />
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{S ? `Serviço #${S.id}` : 'Serviço'}</div>
              <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 18, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{S?.nome || 'Detalhe'}</div>
            </div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        {/* abas */}
        {S && !loading && (
          <div className="v2-seg" role="tablist" style={{ margin: '12px 18px 0' }}>
            {TABS.map(([v, l]) => (
              <button key={v} role="tab" aria-selected={aba === v} className={aba === v ? 'is-on' : ''} onClick={() => setAba(v)}>{l}</button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {loading && <div style={{ color: 'var(--nb-ink-faint)', textAlign: 'center', padding: 40 }}>Carregando…</div>}
          {erro && !loading && <div style={{ color: 'var(--nb-bad)', padding: 12 }}>{erro}</div>}

          {S && d && !loading && aba === 'geral' && (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <CatBadge cat={S.categoria} />
                <StatusBadge ativo={S.ativo} />
                <ExclBadge nome={S.dona_nome} />
              </div>
              {S.descricao && (
                <div style={{ background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 12, padding: '10px 12px', marginBottom: 14, fontSize: 13.5, color: 'var(--nb-ink)' }}>
                  {S.descricao}
                </div>
              )}
              <Linha label="Categoria (automática)">{LABEL_CAT[S.categoria]}</Linha>
              <Linha label="Duração">{num(S.duracao_minutos)} min</Linha>
              <Linha label="Valor">{brl(S.valor)}</Linha>
              <Linha label="Comissão">Por profissional</Linha>
              <Linha label="Exclusividade">{S.dona_nome ? `Exclusivo · ${S.dona_nome}` : 'Geral (todas)'}</Linha>
              <Linha label="Vendas (concluídas)">{num(d.vendas.qtd)}</Linha>
              <Linha label="Receita gerada" tone="var(--nb-ok)">{brl(d.vendas.receita)}</Linha>
              <Linha label="Ticket médio">{d.vendas.qtd ? brl(d.vendas.ticket) : '—'}</Linha>
              <Linha label="Última venda">{d.vendas.ultima ? dataBR(d.vendas.ultima) : '—'}</Linha>
              <Linha label="Criado em">{dataBR(S.created_at)}</Linha>
              <Linha label="Atualizado em">{dataBR(S.updated_at)}</Linha>
              <p style={{ marginTop: 14, fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>
                A comissão não é cadastrada por serviço — ela vem da profissional que realiza o atendimento.
              </p>
            </>
          )}

          {S && d && !loading && aba === 'profissionais' && (
            <>
              {S.dona_nome ? (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--nb-ink-soft)' }}>Serviço <strong>exclusivo</strong> — realizado apenas por:</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--nb-rule)', borderRadius: 12, background: 'var(--nb-surface-2)' }}>
                    <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 }}>
                      {(S.dona_nome || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 560, color: 'var(--nb-ink)' }}>{S.dona_nome}</span>
                  </div>
                </>
              ) : d.profissionais.length > 0 ? (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--nb-ink-soft)' }}>Profissionais vinculadas a este serviço:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {d.profissionais.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--nb-rule)', borderRadius: 12 }}>
                        <span aria-hidden style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 12 }}>
                          {(c.nome || '?').trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join('').toUpperCase()}
                        </span>
                        <span style={{ fontSize: 13.5, color: 'var(--nb-ink)' }}>{c.nome}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', color: 'var(--nb-ink-faint)', marginBottom: 10 }}>
                    <Icon name="Users" size={20} />
                  </span>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink-soft)' }}>Serviço geral do salão</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>Disponível para todas as profissionais — nenhuma vinculação exclusiva.</p>
                </div>
              )}
            </>
          )}

          {S && d && !loading && aba === 'historico' && (
            <>
              {d.recentes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                  <span aria-hidden style={{ display: 'inline-grid', placeItems: 'center', width: 44, height: 44, borderRadius: 12, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', color: 'var(--nb-ink-faint)', marginBottom: 10 }}>
                    <Icon name="Clock" size={20} />
                  </span>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink-soft)' }}>Sem histórico ainda</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>
                    Não há atendimentos concluídos com este serviço. O log de alterações do cadastro é uma pendência futura.
                  </p>
                </div>
              ) : (
                <>
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--nb-ink-faint)' }}>Últimos atendimentos concluídos com este serviço:</p>
                  {d.recentes.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--nb-rule-soft)' }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cliente_nome}</span>
                        <span className="nb-num" style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{dataBR(r.data)}</span>
                      </span>
                      <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)' }}>{brl(r.valor)}</span>
                    </div>
                  ))}
                  <p style={{ marginTop: 12, fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>
                    Mostrando até 8 atendimentos. O log de alterações do cadastro (quem editou o quê) é uma pendência futura.
                  </p>
                </>
              )}
            </>
          )}
        </div>

        {/* ações */}
        {S && !loading && (
          <div style={{ borderTop: '1px solid var(--nb-rule)', padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="nb-btn nb-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }} onClick={() => onEditar(S)}>
              <Icon name="SlidersHorizontal" size={15} /> Editar
            </button>
            <button className="nb-btn nb-btn-ghost" style={{ fontSize: 13 }} onClick={() => onDuplicar(S)} title="Duplicar serviço">
              <Icon name="Package" size={15} /> Duplicar
            </button>
            <button className="nb-btn nb-btn-ghost" style={{ fontSize: 13, color: S.ativo ? 'var(--nb-bad)' : 'var(--nb-ok)' }} onClick={() => onToggle(S)}>
              <Power size={15} strokeWidth={1.75} aria-hidden /> {S.ativo ? 'Inativar' : 'Ativar'}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
