'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import PageShell from '@/components/v2/layout/PageShell';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import Button from '@/components/v2/ui/Button';
import Icon from '@/components/v2/ui/Icon';

type Config = {
  waha_url: string;
  waha_session: string;
  waha_configurado: boolean;
  waha_connected: boolean;
  waha_status: string;
  waha_status_error?: string | null;
  waha_numero: string;
  envio_ativo: boolean;
  limite_diario: number;
  hora_inicio: number;
  hora_fim: number;
  janela_horario: string;
  throttle: string;
  cron_schedule: string;
  tempo_pos_venda: string;
  max_tentativas: number;
};

type Stats = { enviados: number; pendentes: number; erros: number; total: number };

function fmtNumero(num: string) {
  if (!num) return '';
  // 5511999998888 -> +55 (11) 99999-8888 (best effort; mantém cru se não bater)
  const m = num.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  if (m) return `+55 (${m[1]}) ${m[2]}-${m[3]}`;
  return `+${num}`;
}

export default function WhatsappV2() {
  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // envio de teste (usa o POST da API existente)
  const [tel, setTel] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const [cfgR, stR] = await Promise.all([
        fetch('/api/admin/whatsapp?secao=config', { cache: 'no-store' }),
        fetch('/api/admin/whatsapp?secao=stats', { cache: 'no-store' }),
      ]);
      if (!cfgR.ok) {
        const j = await cfgR.json().catch(() => ({}));
        throw new Error(j.error || `Falha ao consultar o status (HTTP ${cfgR.status})`);
      }
      const cj = await cfgR.json();
      setConfig(cj.config ?? null);
      if (stR.ok) {
        const sj = await stR.json();
        setStats(sj.stats ?? null);
      }
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível consultar a integração.');
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const enviarTeste = async () => {
    if (!tel.trim() || !msg.trim()) { toast.error('Informe telefone e mensagem.'); return; }
    setEnviando(true);
    try {
      const r = await fetch('/api/admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: tel.trim(), mensagem: msg.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Falha ao enviar a mensagem de teste.');
      toast.success('Mensagem de teste enviada!');
      setMsg('');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const conectado = !!config?.waha_connected;
  const configurado = !!config?.waha_configurado;

  return (
    <PageShell
      title="WhatsApp"
      subtitle="Conexão e envio automático"
      actions={
        <Button variant="ghost" icon="ArrowUpRight" onClick={carregar} disabled={loading}>
          {loading ? 'Atualizando…' : 'Atualizar status'}
        </Button>
      }
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px){
          .v2-root .wa-detalhes{grid-template-columns:repeat(2,minmax(0,1fr))}
        }
        @media (max-width: 430px){
          .v2-root .wa-detalhes{grid-template-columns:minmax(0,1fr)}
        }
      ` }} />

      {/* ERRO / INTEGRAÇÃO INDISPONÍVEL */}
      {erro && !loading && (
        <Card style={{ marginBottom: 16 }}>
          <CardHead title="Integração via WAHA" right={<Badge status="atrasado">Indisponível</Badge>} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 12, borderRadius: 10, background: 'var(--nb-bad-bg)', border: '1px solid #E7CFC9' }}>
            <span aria-hidden style={{ color: 'var(--nb-bad)', marginTop: 1 }}><Icon name="CircleAlert" size={18} /></span>
            <div>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--nb-ink)', fontWeight: 560 }}>Não foi possível consultar o status agora.</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--nb-ink-soft)' }}>{erro}</p>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', marginTop: 14, marginBottom: 0 }}>
            O WhatsApp da NaviBelle roda sobre o WAHA em servidor próprio e é usado para lembretes e confirmações de agendamento. Toque em “Atualizar status” para tentar novamente.
          </p>
        </Card>
      )}

      {/* STATUS PRINCIPAL */}
      {!erro && (
        <Card style={{ marginBottom: 16 }}>
          <CardHead
            title="Status da conexão"
            right={
              loading ? (
                <span className="nb-eyebrow">Carregando…</span>
              ) : (
                <Badge status={conectado ? 'confirmado' : 'cancelado'}>
                  {conectado ? 'Conectado' : 'Desconectado'}
                </Badge>
              )
            }
          />

          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>Consultando a sessão WAHA…</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0 20px' }}>
                <span
                  aria-hidden
                  style={{
                    width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', flexShrink: 0,
                    background: conectado ? 'var(--nb-ok-bg)' : 'var(--nb-bad-bg)',
                    color: conectado ? 'var(--nb-ok)' : 'var(--nb-bad)',
                    border: `1px solid ${conectado ? '#CFE1D5' : '#E7CFC9'}`,
                  }}
                >
                  <Icon name="MessageCircle" size={26} />
                </span>
                <div>
                  <div className="nb-eyebrow" style={{ fontSize: 10 }}>Número conectado</div>
                  <div className="nb-num" style={{ fontSize: 22, fontWeight: 680, color: 'var(--nb-ink)', lineHeight: 1.15 }}>
                    {config?.waha_numero ? fmtNumero(config.waha_numero) : conectado ? 'Conectado (número não identificado)' : '—'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--nb-ink-soft)', marginTop: 2 }}>
                    {conectado
                      ? 'A sessão está online e pronta para enviar mensagens.'
                      : (config?.waha_status_error || 'Sessão desconectada — reconecte escaneando o QR Code no servidor WAHA.')}
                  </div>
                </div>
              </div>

              {/* detalhes da sessão */}
              <div className="wa-detalhes" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 1, background: 'var(--nb-rule-soft)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--nb-rule)' }}>
                <Detalhe rotulo="Sessão WAHA" valor={config?.waha_session || '—'} sub={config?.waha_status ? `status: ${config.waha_status}` : undefined} />
                <Detalhe rotulo="Servidor" valor={configurado ? 'Configurado' : 'Não configurado'} tone={configurado ? 'ok' : 'bad'} />
                <Detalhe rotulo="Envio automático" valor={config?.envio_ativo ? 'Ativo' : 'Pausado'} tone={config?.envio_ativo ? 'ok' : 'warn'} />
              </div>

              <p style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', marginTop: 14, marginBottom: 0, display: 'flex', gap: 6, alignItems: 'center' }}>
                <Icon name="Bell" size={14} /> O WhatsApp é usado para enviar lembretes e confirmações de agendamento às clientes.
              </p>
            </>
          )}
        </Card>
      )}

      {/* PARÂMETROS DE ENVIO + ESTATÍSTICAS */}
      {!erro && !loading && config && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, marginBottom: 16 }} className="v2-row3">
          {/* Parâmetros */}
          <Card>
            <CardHead title="Regras de envio" right={<span className="nb-eyebrow">Automação</span>} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <ParamRow icon="Clock" rotulo="Janela de horário" valor={config.janela_horario} />
              <ParamRow icon="Gauge" rotulo="Limite diário" valor={`${config.limite_diario} mensagens/dia`} />
              <ParamRow icon="CalendarDays" rotulo="Agenda do worker" valor={config.cron_schedule} />
              <ParamRow icon="Sparkles" rotulo="Pós-venda" valor={config.tempo_pos_venda} />
              <ParamRow icon="TrendingUp" rotulo="Ritmo de disparo" valor={config.throttle} />
              <ParamRow icon="ShieldCheck" rotulo="Tentativas por mensagem" valor={String(config.max_tentativas)} last />
            </div>
          </Card>

          {/* Estatísticas */}
          <Card>
            <CardHead title="Mensagens" right={<span className="nb-eyebrow">Histórico</span>} />
            {stats ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                <MiniStat label="Enviadas" value={stats.enviados} icon="Check" tone="ok" />
                <MiniStat label="Pendentes" value={stats.pendentes} icon="Clock" tone={stats.pendentes > 0 ? 'warn' : undefined} />
                <MiniStat label="Erros (7 dias)" value={stats.erros} icon="CircleAlert" tone={stats.erros > 0 ? 'bad' : undefined} />
                <MiniStat label="Total geral" value={stats.total} icon="ReceiptText" />
              </div>
            ) : (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>Sem dados de histórico.</div>
            )}
          </Card>
        </div>
      )}

      {/* ENVIO DE TESTE */}
      {!erro && !loading && config && (
        <Card>
          <CardHead title="Enviar mensagem de teste" right={<span className="nb-eyebrow">Diagnóstico</span>} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
            <div>
              <label className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Telefone (com DDD)</label>
              <input className="nb-input" placeholder="Ex.: 11999998888" value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" />
            </div>
            <div>
              <label className="nb-eyebrow" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>Mensagem</label>
              <textarea className="nb-input" rows={3} placeholder="Escreva a mensagem de teste…" value={msg} onChange={(e) => setMsg(e.target.value)} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="primary" icon="MessageCircle" onClick={enviarTeste} disabled={enviando || !conectado}>
                {enviando ? 'Enviando…' : 'Enviar teste'}
              </Button>
              {!conectado && <span style={{ fontSize: 12.5, color: 'var(--nb-bad)' }}>Conecte a sessão antes de enviar.</span>}
            </div>
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 14, marginBottom: 0 }}>
            O envio de teste usa a mesma sessão dos lembretes automáticos — ideal para validar rapidamente se a conexão está entregando mensagens.
          </p>
        </Card>
      )}
    </PageShell>
  );
}

function Detalhe({ rotulo, valor, sub, tone }: { rotulo: string; valor: string; sub?: string; tone?: 'ok' | 'bad' | 'warn' }) {
  const cor = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)';
  return (
    <div style={{ background: 'var(--nb-surface)', padding: '14px 16px' }}>
      <div className="nb-eyebrow" style={{ fontSize: 10 }}>{rotulo}</div>
      <div style={{ fontSize: 15, fontWeight: 620, color: cor, marginTop: 3 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 2, fontFamily: 'var(--nb-mono)' }}>{sub}</div>}
    </div>
  );
}

function ParamRow({ icon, rotulo, valor, last }: { icon: string; rotulo: string; valor: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: last ? 'none' : '1px solid var(--nb-rule-soft)' }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={16} />
      </span>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, color: 'var(--nb-ink-soft)', flexShrink: 0 }}>{rotulo}</span>
        <span style={{ fontSize: 13.5, color: 'var(--nb-ink)', fontWeight: 560, textAlign: 'right' }}>{valor}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, tone }: { label: string; value: number; icon: string; tone?: 'ok' | 'bad' | 'warn' }) {
  const cor = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)';
  return (
    <div style={{ border: '1px solid var(--nb-rule)', borderRadius: 12, padding: 14, background: 'var(--nb-surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cor }}>
        <Icon name={icon} size={15} />
        <span className="nb-eyebrow" style={{ fontSize: 10, color: 'var(--nb-ink-faint)' }}>{label}</span>
      </div>
      <div className="nb-num" style={{ fontSize: 24, fontWeight: 700, color: cor, marginTop: 6, lineHeight: 1 }}>{value}</div>
    </div>
  );
}
