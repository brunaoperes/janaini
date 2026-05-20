'use client';

import { PagamentoForm, FormaPagamentoDB } from '@/lib/pagamento-utils';

interface Props {
  pagamentos: PagamentoForm[];
  setPagamentos: (p: PagamentoForm[]) => void;
  valorTotal: number;
  formasPagamentoDB: FormaPagamentoDB[];
  porcentagemComissao?: number;
  canViewComissao?: boolean;
}

// Bloco reutilizável de múltiplas formas de pagamento (forma + valor por linha)
// Compartilhado entre Lançamentos e Agenda
export default function MultiPagamento({
  pagamentos,
  setPagamentos,
  valorTotal,
  formasPagamentoDB,
  porcentagemComissao,
  canViewComissao,
}: Props) {
  const formasDisponiveis = formasPagamentoDB.filter(
    f => f.codigo !== 'fiado' && f.codigo !== 'troca_gratis'
  );
  const somaPag = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  const restante = valorTotal - somaPag;
  const podeAdicionar = pagamentos.length < formasDisponiveis.length;

  const addPagamento = () => {
    const usadas = new Set(pagamentos.map(p => p.forma_pagamento));
    const proxima = formasDisponiveis.find(f => !usadas.has(f.codigo));
    if (!proxima) return;
    const novoValor =
      pagamentos.length === 0 && valorTotal > 0
        ? valorTotal.toFixed(2)
        : restante > 0
          ? restante.toFixed(2)
          : '';
    setPagamentos([...pagamentos, { forma_pagamento: proxima.codigo, valor: novoValor }]);
  };

  const updatePagamento = (idx: number, campo: keyof PagamentoForm, valor: string) => {
    setPagamentos(pagamentos.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)));
  };

  const removePagamento = (idx: number) => {
    setPagamentos(pagamentos.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
      {pagamentos.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          Nenhuma forma adicionada. Clique em &quot;+ Adicionar forma&quot;.
        </p>
      )}

      {pagamentos.map((pag, idx) => {
        const usadasOutras = new Set(
          pagamentos.filter((_, i) => i !== idx).map(p => p.forma_pagamento)
        );
        return (
          <div key={idx} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <select
              value={pag.forma_pagamento}
              onChange={e => updatePagamento(idx, 'forma_pagamento', e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Selecione...</option>
              {formasDisponiveis
                .filter(f => f.codigo === pag.forma_pagamento || !usadasOutras.has(f.codigo))
                .map(f => (
                  <option key={f.codigo} value={f.codigo}>
                    {f.icone} {f.nome}
                    {f.taxa_percentual > 0 ? ` (taxa ${f.taxa_percentual}%)` : ''}
                  </option>
                ))}
            </select>

            <div className="relative w-full sm:w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pag.valor}
                onChange={e => updatePagamento(idx, 'valor', e.target.value)}
                placeholder="0,00"
                className="w-full pl-9 pr-2 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              type="button"
              onClick={() => removePagamento(idx)}
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
              title="Remover"
            >
              ✕
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={addPagamento}
          disabled={!podeAdicionar}
          className="text-sm px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Adicionar forma
        </button>

        {pagamentos.length > 0 && (
          <div className="text-xs text-gray-600">
            Soma: <span className="font-semibold">R$ {somaPag.toFixed(2)}</span>
            {valorTotal > 0 && (
              <>
                {' '}/ Total: <span className="font-semibold">R$ {valorTotal.toFixed(2)}</span>
                {Math.abs(restante) > 0.01 && (
                  <span className={`ml-2 font-semibold ${restante > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                    {restante > 0
                      ? `Falta R$ ${restante.toFixed(2)}`
                      : `Excede R$ ${Math.abs(restante).toFixed(2)}`}
                  </span>
                )}
                {Math.abs(restante) <= 0.01 && (
                  <span className="ml-2 text-green-600 font-semibold">✓ OK</span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Resumo de comissão */}
      {canViewComissao && pagamentos.length > 0 && typeof porcentagemComissao === 'number' && (() => {
        const detalhes = pagamentos.map(p => {
          const valor = parseFloat(p.valor) || 0;
          const forma = formasPagamentoDB.find(f => f.codigo === p.forma_pagamento);
          const taxaPct = forma?.taxa_percentual || 0;
          const valorTaxa = (valor * taxaPct) / 100;
          const comissaoBruta = (valor * porcentagemComissao) / 100;
          return {
            nome: forma?.nome || p.forma_pagamento || '—',
            valor,
            taxaPct,
            valorTaxa,
            comissaoLiquida: comissaoBruta - valorTaxa,
          };
        });
        const totalTaxa = detalhes.reduce((a, d) => a + d.valorTaxa, 0);
        const totalComissao = detalhes.reduce((a, d) => a + d.comissaoLiquida, 0);
        if (totalTaxa <= 0 && pagamentos.length === 1) return null;
        return (
          <div className="mt-1 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
            <p className="text-yellow-800 font-medium mb-1">Resumo de comissão</p>
            <ul className="text-yellow-700 space-y-0.5">
              {detalhes.map((d, i) => (
                <li key={i}>
                  {d.nome}: R$ {d.valor.toFixed(2)}
                  {d.taxaPct > 0 && ` · taxa ${d.taxaPct}% (-R$ ${d.valorTaxa.toFixed(2)})`}
                </li>
              ))}
              {totalTaxa > 0 && (
                <li className="pt-1 border-t border-yellow-200">Total taxa: -R$ {totalTaxa.toFixed(2)}</li>
              )}
              <li className="font-bold">Comissão líquida total: R$ {totalComissao.toFixed(2)}</li>
            </ul>
          </div>
        );
      })()}
    </div>
  );
}
