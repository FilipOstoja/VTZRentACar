// Currency convention for VTZ:
// - Stored numeric values represent EUR.
// - EUR is the primary display unit.
// - KM (Bosnian Convertible Mark) is shown as an approximation, computed
//   from the fixed peg of 1 EUR = 1.9583 KM.

export const EUR_TO_KM = 1.9583;

const eurFmt = new Intl.NumberFormat("hr-HR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const kmFmt = new Intl.NumberFormat("hr-HR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format an EUR value as "€60.00". */
export function fmtEUR(eur: number | null | undefined): string {
  const v = typeof eur === "number" && isFinite(eur) ? eur : 0;
  return `€${eurFmt.format(v)}`;
}

/** Format the KM equivalent of an EUR value as "117.50 KM". */
export function fmtKM(eur: number | null | undefined): string {
  const v = typeof eur === "number" && isFinite(eur) ? eur : 0;
  return `${kmFmt.format(v * EUR_TO_KM)} KM`;
}

/** "€60.00 ≈ 117.50 KM" */
export function fmtEURwithKM(eur: number | null | undefined): string {
  return `${fmtEUR(eur)} ≈ ${fmtKM(eur)}`;
}

/** Round-to-integer EUR for compact axis labels: "€60". */
export function fmtEURcompact(eur: number | null | undefined): string {
  const v = typeof eur === "number" && isFinite(eur) ? eur : 0;
  return `€${Math.round(v).toLocaleString("hr-HR")}`;
}
