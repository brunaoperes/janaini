import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface LancamentoExport {
  data: string;
  colaboradora: string;
  cliente: string;
  valor_total: number;
  forma_pagamento: string;
  comissao_colaborador: number;
  comissao_salao: number;
}

export interface AgendamentoExport {
  data_hora: string;
  colaboradora: string;
  cliente: string;
  duracao_minutos: number;
}

/**
 * Exporta lançamentos para Excel
 */
export function exportarLancamentosParaExcel(lancamentos: LancamentoExport[], nomeArquivo: string = 'lancamentos') {
  // Formatar dados para exportação
  const dadosFormatados = lancamentos.map((lanc) => ({
    Data: lanc.data,
    Colaboradora: lanc.colaboradora,
    Cliente: lanc.cliente || 'N/A',
    'Valor Total': `R$ ${lanc.valor_total.toFixed(2)}`,
    'Forma Pagamento': lanc.forma_pagamento,
    'Comissão Colaboradora': `R$ ${lanc.comissao_colaborador.toFixed(2)}`,
    'Comissão Salão': `R$ ${lanc.comissao_salao.toFixed(2)}`,
  }));

  // Calcular totais
  const totalGeral = lancamentos.reduce((sum, l) => sum + l.valor_total, 0);
  const totalComissaoColab = lancamentos.reduce((sum, l) => sum + l.comissao_colaborador, 0);
  const totalComissaoSalao = lancamentos.reduce((sum, l) => sum + l.comissao_salao, 0);

  // Adicionar linha de totais
  dadosFormatados.push({
    Data: '',
    Colaboradora: '',
    Cliente: 'TOTAL',
    'Valor Total': `R$ ${totalGeral.toFixed(2)}`,
    'Forma Pagamento': '',
    'Comissão Colaboradora': `R$ ${totalComissaoColab.toFixed(2)}`,
    'Comissão Salão': `R$ ${totalComissaoSalao.toFixed(2)}`,
  });

  // Criar planilha
  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos');

  // Ajustar largura das colunas
  const columnWidths = [
    { wch: 12 }, // Data
    { wch: 20 }, // Colaboradora
    { wch: 20 }, // Cliente
    { wch: 15 }, // Valor Total
    { wch: 15 }, // Forma Pagamento
    { wch: 20 }, // Comissão Colaboradora
    { wch: 20 }, // Comissão Salão
  ];
  worksheet['!cols'] = columnWidths;

  // Download
  XLSX.writeFile(workbook, `${nomeArquivo}.xlsx`);
}

/**
 * Exporta lançamentos para PDF
 */
export function exportarLancamentosParaPDF(lancamentos: LancamentoExport[], nomeArquivo: string = 'lancamentos') {
  const doc = new jsPDF();

  // Título
  doc.setFontSize(18);
  doc.setTextColor(147, 51, 234); // roxo
  doc.text('Relatório de Lançamentos', 14, 20);

  // Data do relatório
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

  // Preparar dados da tabela
  const tableData = lancamentos.map((lanc) => [
    lanc.data,
    lanc.colaboradora,
    lanc.cliente || 'N/A',
    `R$ ${lanc.valor_total.toFixed(2)}`,
    lanc.forma_pagamento,
    `R$ ${lanc.comissao_colaborador.toFixed(2)}`,
    `R$ ${lanc.comissao_salao.toFixed(2)}`,
  ]);

  // Calcular totais
  const totalGeral = lancamentos.reduce((sum, l) => sum + l.valor_total, 0);
  const totalComissaoColab = lancamentos.reduce((sum, l) => sum + l.comissao_colaborador, 0);
  const totalComissaoSalao = lancamentos.reduce((sum, l) => sum + l.comissao_salao, 0);

  // Adicionar linha de totais
  tableData.push([
    '',
    '',
    'TOTAL',
    `R$ ${totalGeral.toFixed(2)}`,
    '',
    `R$ ${totalComissaoColab.toFixed(2)}`,
    `R$ ${totalComissaoSalao.toFixed(2)}`,
  ]);

  // Criar tabela
  autoTable(doc, {
    head: [['Data', 'Colaboradora', 'Cliente', 'Valor', 'Pagamento', 'Comissão Colab.', 'Comissão Salão']],
    body: tableData,
    startY: 35,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [147, 51, 234], // roxo
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    footStyles: {
      fillColor: [220, 220, 220],
      textColor: 0,
      fontStyle: 'bold',
    },
  });

  // Download
  doc.save(`${nomeArquivo}.pdf`);
}

/**
 * Exporta agendamentos para Excel
 */
export function exportarAgendamentosParaExcel(agendamentos: AgendamentoExport[], nomeArquivo: string = 'agendamentos') {
  const dadosFormatados = agendamentos.map((agend) => ({
    'Data/Hora': agend.data_hora,
    Colaboradora: agend.colaboradora,
    Cliente: agend.cliente,
    'Duração (min)': agend.duracao_minutos,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dadosFormatados);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Agendamentos');

  const columnWidths = [
    { wch: 18 }, // Data/Hora
    { wch: 20 }, // Colaboradora
    { wch: 20 }, // Cliente
    { wch: 15 }, // Duração
  ];
  worksheet['!cols'] = columnWidths;

  XLSX.writeFile(workbook, `${nomeArquivo}.xlsx`);
}

/**
 * Exporta agendamentos para PDF
 */
export function exportarAgendamentosParaPDF(agendamentos: AgendamentoExport[], nomeArquivo: string = 'agendamentos') {
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(147, 51, 234);
  doc.text('Relatório de Agendamentos', 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);

  const tableData = agendamentos.map((agend) => [
    agend.data_hora,
    agend.colaboradora,
    agend.cliente,
    `${agend.duracao_minutos} min`,
  ]);

  autoTable(doc, {
    head: [['Data/Hora', 'Colaboradora', 'Cliente', 'Duração']],
    body: tableData,
    startY: 35,
    styles: {
      fontSize: 9,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [147, 51, 234],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  doc.save(`${nomeArquivo}.pdf`);
}
