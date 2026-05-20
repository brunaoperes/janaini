// Utilitários compartilhados para múltiplas formas de pagamento
// Usado em Lançamentos e Agenda (telas espelhadas para recebimento)

export interface PagamentoForm {
  forma_pagamento: string;
  valor: string;
}

export interface FormaPagamentoDB {
  id: number;
  nome: string;
  codigo: string;
  icone: string;
  taxa_percentual: number;
  ativo: boolean;
}

export interface PagamentoDetalhado {
  forma_pagamento: string;
  valor: number;
  taxa_percentual: number;
  valor_taxa: number;
  comissao_colaborador: number;
  comissao_salao: number;
}

export interface PagamentosCalculo {
  detalhados: PagamentoDetalhado[];
  valorTaxa: number;
  comissaoColaborador: number;
  comissaoSalao: number;
  formaPrincipal: string; // código único, ou 'multiplo' se >1
}

// Calcula comissão e taxa ponderadas por forma de pagamento
export function calcularPagamentos(
  pagamentos: PagamentoForm[],
  porcentagemComissao: number,
  formasPagamentoDB: FormaPagamentoDB[]
): PagamentosCalculo {
  const detalhados: PagamentoDetalhado[] = pagamentos.map(p => {
    const valor = parseFloat(p.valor) || 0;
    const forma = formasPagamentoDB.find(f => f.codigo === p.forma_pagamento);
    const taxaPct = forma?.taxa_percentual || 0;
    const valorTaxa = (valor * taxaPct) / 100;
    const comissaoBruta = (valor * porcentagemComissao) / 100;
    return {
      forma_pagamento: p.forma_pagamento,
      valor,
      taxa_percentual: taxaPct,
      valor_taxa: valorTaxa,
      comissao_colaborador: comissaoBruta - valorTaxa,
      comissao_salao: valor - comissaoBruta,
    };
  });

  return {
    detalhados,
    valorTaxa: detalhados.reduce((a, d) => a + d.valor_taxa, 0),
    comissaoColaborador: detalhados.reduce((a, d) => a + d.comissao_colaborador, 0),
    comissaoSalao: detalhados.reduce((a, d) => a + d.comissao_salao, 0),
    formaPrincipal: pagamentos.length === 1 ? pagamentos[0].forma_pagamento : 'multiplo',
  };
}

// Valida o array de pagamentos contra o valor total esperado
// Retorna string de erro, ou null se válido
export function validarPagamentos(
  pagamentos: PagamentoForm[],
  valorTotal: number
): string | null {
  if (pagamentos.length === 0) {
    return 'Adicione pelo menos uma forma de pagamento';
  }
  if (pagamentos.some(p => !p.forma_pagamento)) {
    return 'Selecione a forma de pagamento em todas as linhas';
  }
  if (pagamentos.some(p => !p.valor || parseFloat(p.valor) <= 0)) {
    return 'Informe um valor maior que zero em cada forma de pagamento';
  }
  const duplicadas = pagamentos.some((p, i) =>
    pagamentos.findIndex(x => x.forma_pagamento === p.forma_pagamento) !== i
  );
  if (duplicadas) {
    return 'Não repita a mesma forma de pagamento — some os valores em uma única linha';
  }
  const soma = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  if (Math.abs(soma - valorTotal) > 0.01) {
    return `Soma dos pagamentos (R$ ${soma.toFixed(2)}) deve ser igual ao valor total (R$ ${valorTotal.toFixed(2)})`;
  }
  return null;
}
