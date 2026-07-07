'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import { brl } from '@/lib/v2/formatters';

// Modal premium V2 para lançar despesa avulsa ou nova conta fixa (recorrente).
// Reusa as APIs de produção sem alterá-las:
//   POST /api/admin/despesas       (despesa avulsa / conta a pagar)
//   POST /api/admin/contas-fixas   (template recorrente mensal)
//   GET  /api/admin/categorias-despesa

type Categoria = { id: number; nome: string; tipo: string | null; ativo?: boolean };
type Modo = 'despesa' | 'fixa';

const FORMAS: [string, string][] = [
  ['', 'Não informar'], ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Cartão de débito'],
  ['credito', 'Cartão de crédito'], ['boleto', 'Boleto'], ['transferencia', 'Transferência'], ['outro', 'Outro'],
];

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const mesDe = (isoOrYm: string) => (isoOrYm || '').slice(0, 7);

/** Converte texto pt-BR ("1.234,56" ou "1234.56") em número; retorna NaN se vazio. */
function parseValor(txt: string): number {
  const t = txt.trim();
  if (!t) return NaN;
  const norm = t.replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  return Number(norm);
}

export default function DespesaModal({ mes, onClose, onDone }: {
  mes: string;                 // competência de referência (YYYY-MM) do mês aberto na tela
  onClose: () => void;
  onDone: () => void;          // fecha + recarrega o financeiro
}) {
  const [modo, setModo] = useState<Modo>('despesa');
  const [cats, setCats] = useState<Categoria[]>([]);

  // campos comuns
  const [descricao, setDescricao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [valor, setValor] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // despesa avulsa
  const [vencimento, setVencimento] = useState(hoje());
  const [competencia, setCompetencia] = useState(mes);
  const [forma, setForma] = useState('');
  const [status, setStatus] = useState<'pendente' | 'pago'>('pendente');
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [fornecedor, setFornecedor] = useState('');

  // conta fixa
  const [diaVencimento, setDiaVencimento] = useState('5');

  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  // categorias (opcional; se falhar, segue sem categoria)
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/admin/categorias-despesa', { cache: 'no-store' });
        const j = await r.json();
        if (vivo && r.ok) setCats((j.categorias || []).filter((c: Categoria) => c.ativo !== false));
      } catch { /* segue sem categorias */ }
    })();
    return () => { vivo = false; };
  }, []);

  // Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valorNum = useMemo(() => parseValor(valor), [valor]);

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (descricao.trim().length < 2) e.descricao = 'Informe uma descrição.';
    if (!Number.isFinite(valorNum) || valorNum <= 0) e.valor = 'Informe um valor maior que zero.';
    if (modo === 'despesa') {
      if (!vencimento) e.vencimento = 'Informe o vencimento.';
    } else {
      const dia = Number(diaVencimento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) e.diaVencimento = 'Dia entre 1 e 31.';
    }
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function salvar() {
    if (!validar()) return;
    setSalvando(true);
    try {
      if (modo === 'despesa') {
        const body: Record<string, unknown> = {
          descricao: descricao.trim(),
          categoria_id: categoriaId ? Number(categoriaId) : null,
          valor: valorNum,
          vencimento,
          competencia: `${competencia}-01`,
          status,
          forma_pagamento: forma || null,
          fornecedor: fornecedor.trim() || null,
          observacoes: observacoes.trim() || null,
        };
        if (status === 'pago') body.data_pagamento = dataPagamento || hoje();
        const r = await fetch('/api/admin/despesas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) { toast.error(j.error || 'Não foi possível salvar a despesa.'); return; }
        toast.success(`Despesa de ${brl(valorNum)} lançada.`);
      } else {
        const body = {
          descricao: descricao.trim(),
          categoria_id: categoriaId ? Number(categoriaId) : null,
          valor_estimado: valorNum,
          dia_vencimento: Number(diaVencimento),
          ativo: true,
        };
        const r = await fetch('/api/admin/contas-fixas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        const j = await r.json();
        if (!r.ok) { toast.error(j.error || 'Não foi possível salvar a conta fixa.'); return; }
        toast.success('Conta fixa cadastrada. Gere o mês para lançá-la.');
      }
      onDone();
    } catch { toast.error('Erro de conexão.'); }
    finally { setSalvando(false); }
  }

  const ehDespesa = modo === 'despesa';

  return (
    <div role="dialog" aria-modal="true" aria-label="Lançar despesa" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'color-mix(in srgb, var(--nb-ink) 34%, transparent)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card"
        style={{ width: '100%', maxWidth: 540, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <span aria-hidden style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-accent-deep)' }}>
            <Icon name="Receipt" size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Financeiro</div>
            <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)' }}>{ehDespesa ? 'Nova despesa' : 'Nova conta fixa'}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 15 }}>
          {/* toggle de modo */}
          <div className="v2-seg" role="tablist" style={{ width: '100%' }}>
            {([['despesa', 'Despesa avulsa'], ['fixa', 'Conta fixa']] as [Modo, string][]).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={modo === v} className={modo === v ? 'is-on' : ''}
                onClick={() => { setModo(v); setErros({}); }} style={{ flex: 1 }}>{l}</button>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>
            {ehDespesa
              ? 'Lança uma conta a pagar deste período (competência). Marque como paga se já foi quitada.'
              : 'Cadastra um gasto recorrente mensal. Ele passa a ser gerado como despesa a cada mês.'}
          </p>

          {/* descrição */}
          <Campo label="Descrição" erro={erros.descricao}>
            <input className="nb-input" value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder={ehDespesa ? 'Ex.: Conta de energia' : 'Ex.: Aluguel'} style={{ width: '100%' }} maxLength={120} autoFocus />
          </Campo>

          {/* categoria + valor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Campo label="Categoria">
              <select className="v2-select" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Sem categoria</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.tipo === 'fixa' ? ' (fixa)' : ''}</option>
                ))}
              </select>
            </Campo>
            <Campo label={ehDespesa ? 'Valor' : 'Valor estimado'} erro={erros.valor}>
              <div style={{ position: 'relative' }}>
                <span aria-hidden style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}>R$</span>
                <input className="nb-input nb-num" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00" style={{ width: '100%', paddingLeft: 32, textAlign: 'right' }} />
              </div>
            </Campo>
          </div>

          {ehDespesa ? (
            <>
              {/* vencimento + competência */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Campo label="Vencimento" erro={erros.vencimento}>
                  <input type="date" className="v2-select" value={vencimento} onChange={(e) => setVencimento(e.target.value)} style={{ width: '100%', paddingRight: 12 }} />
                </Campo>
                <Campo label="Competência">
                  <input type="month" className="v2-select" value={competencia} onChange={(e) => setCompetencia(e.target.value)} style={{ width: '100%', paddingRight: 12 }} />
                </Campo>
              </div>

              {/* status */}
              <Campo label="Situação">
                <div className="v2-seg" role="tablist" style={{ width: '100%' }}>
                  {([['pendente', 'Pendente'], ['pago', 'Pago']] as ['pendente' | 'pago', string][]).map(([v, l]) => (
                    <button key={v} role="tab" aria-selected={status === v} className={status === v ? 'is-on' : ''}
                      onClick={() => setStatus(v)} style={{ flex: 1 }}>{l}</button>
                  ))}
                </div>
              </Campo>

              {/* forma + (data pgto se pago) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Campo label="Forma de pagamento">
                  <select className="v2-select" value={forma} onChange={(e) => setForma(e.target.value)} style={{ width: '100%' }}>
                    {FORMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Campo>
                {status === 'pago' && (
                  <Campo label="Data do pagamento">
                    <input type="date" className="v2-select" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} style={{ width: '100%', paddingRight: 12 }} />
                  </Campo>
                )}
              </div>

              {/* fornecedor */}
              <Campo label="Fornecedor (opcional)">
                <input className="nb-input" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Companhia de energia" style={{ width: '100%' }} maxLength={120} />
              </Campo>
            </>
          ) : (
            <Campo label="Dia do vencimento" erro={erros.diaVencimento}>
              <input className="nb-input nb-num" inputMode="numeric" value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="5" style={{ width: 120 }} />
              <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 4 }}>Dia do mês (1 a 31) em que a conta costuma vencer.</span>
            </Campo>
          )}

          {/* observações */}
          <Campo label="Observações (opcional)">
            <textarea className="nb-input" value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Anotações internas" rows={2} style={{ width: '100%', resize: 'vertical', minHeight: 44 }} maxLength={280} />
          </Campo>
        </div>

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--nb-rule)' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Button>
          <Button icon="Check" onClick={salvar} disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
            {salvando ? 'Salvando…' : ehDespesa ? 'Lançar despesa' : 'Salvar conta fixa'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, erro, children }: { label: string; erro?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</span>
      {children}
      {erro && <span style={{ fontSize: 11.5, color: 'var(--nb-bad)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="CircleAlert" size={12} /> {erro}</span>}
    </label>
  );
}
