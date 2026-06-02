// Helpers puros de horário (sem dependências) — usados nas APIs para blindar
// contra horários inválidos (término <= início), que geram duração negativa.

/** Converte "HH:MM" (ou "HH:MM:SS") em minutos desde a meia-noite. Null se inválido. */
export function horaParaMinutos(v?: string | null): number | null {
  if (!v || !/^\d{2}:\d{2}/.test(v)) return null;
  const [h, m] = v.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

/**
 * True quando ambos os horários existem e o término é <= início.
 * Se algum estiver ausente/ inválido, NÃO bloqueia (retorna false).
 */
export function horarioInvalido(horaInicio?: string | null, horaFim?: string | null): boolean {
  const ini = horaParaMinutos(horaInicio);
  const fim = horaParaMinutos(horaFim);
  if (ini == null || fim == null) return false;
  return fim <= ini;
}
