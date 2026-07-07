// Utilidades puras da timeline da Agenda V2. Mesma fórmula de posição da agenda atual
// (janela 06:00–22:00 = 960 min), para preservar o comportamento que a cliente já conhece.

export const INICIO_MIN = 6 * 60;   // 06:00
export const FIM_MIN = 22 * 60;     // 22:00
export const JANELA_MIN = FIM_MIN - INICIO_MIN; // 960

/** 'HH:MM' -> minutos desde meia-noite (null se inválido). */
export function horaParaMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Extrai HH:MM de um timestamp ISO sem depender de fuso (usa o horário "de parede"). */
export function minDeISO(iso?: string | null): number | null {
  if (!iso) return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export type Bloco = {
  id: number;
  colaboradorId: number | null;
  colaboradoresIds?: number[] | null;
  inicioMin: number;      // preferindo hora_inicio > data_hora
  fimMin: number;
  cliente: string;
  servico: string;
  status: string;         // pendente | concluido | executando | ...
  valor: number;          // do lançamento vinculado (0 se sem)
  conflito?: boolean;
};

/** Posição/tamanho da barra em % da janela. */
export function posBarra(b: Bloco) {
  const left = ((b.inicioMin - INICIO_MIN) / JANELA_MIN) * 100;
  const width = ((b.fimMin - b.inicioMin) / JANELA_MIN) * 100;
  return { left: Math.max(0, left), width: Math.max(1.2, width) };
}

/** Marca conflito quando dois blocos da mesma profissional se sobrepõem no tempo. */
export function marcarConflitos(blocos: Bloco[]): Bloco[] {
  const porColab: Record<number, Bloco[]> = {};
  for (const b of blocos) {
    const k = b.colaboradorId ?? -1;
    (porColab[k] ||= []).push(b);
  }
  for (const lista of Object.values(porColab)) {
    lista.sort((a, b) => a.inicioMin - b.inicioMin);
    for (let i = 1; i < lista.length; i++) {
      if (lista[i].inicioMin < lista[i - 1].fimMin) {
        lista[i].conflito = true;
        lista[i - 1].conflito = true;
      }
    }
  }
  return blocos;
}

/** Cores sóbrias por profissional (dentro da paleta V2), distinguíveis entre si. */
export const CORES_COLAB = ['#8C5A6B', '#A98953', '#5E6B4C', '#6E4453', '#7A8B99', '#B06C4E'];
export const corColab = (i: number) => CORES_COLAB[i % CORES_COLAB.length];

export const HORAS = Array.from({ length: FIM_MIN / 60 - INICIO_MIN / 60 + 1 }, (_, i) => INICIO_MIN / 60 + i); // 6..22
