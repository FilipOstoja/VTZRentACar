/**
 * Leasing Calculator — mirrors the Excel Kalkulator exactly
 */

export interface LeasingInputs {
  vehiclePrice: number;        // Cijena auta
  downPaymentPct: number;      // Učešće % (e.g. 0.15 for 15%)
  annualInterestRate: number;  // Kamata godišnja (e.g. 0.07 for 7%)
  periodMonths: number;        // Period (mjeseci)
  kaskoYearly: number;         // Kasko (godišnje)
  aoYearly: number;            // AO Kasko (godišnje)
  tyresTotal: number;          // Gume (ukupno za period)
  serviceTotal: number;        // Servis (ukupno za period)
  adminTotal: number;          // Administracija i neplanirano
  marginPct: number;           // Marža posto (e.g. 0.17 for 17%)
  vatPct: number;              // PDV (e.g. 0.17 for 17%)
  residualValue: number;       // Vrijednost vozila nakon isteka najma
}

export interface LeasingResults {
  downPaymentAmount: number;       // Učešće iznos
  leasingPrincipal: number;        // Leasing glavnica
  monthlyFinancingRate: number;    // Mjesečna rata financiranja
  totalRepayment: number;          // Ukupno otplata
  totalInterest: number;           // Ukupna kamata
  totalFinancing: number;          // Ukupno financiranje auta
  totalKasko: number;              // Ukupno kasko
  totalAO: number;                 // Ukupno AO
  yearsOfLease: number;            // Godina najma
  totalCost: number;               // Ukupan trošak
  monthlyCost: number;             // Mjesečni trošak
  marginAmount: number;            // Marža iznos
  monthlyRentNoVat: number;        // Najamnina (bez PDV)
  monthlyRentWithVat: number;      // Ukupno s PDV najam
  vtzProfit: number;               // VTZ profit (najam)
  possibleProfit: number;          // Mogući profit
}

/**
 * Standard PMT function (Excel-equivalent annuity formula)
 * Returns monthly payment for a loan.
 */
function pmt(annualRate: number, nper: number, pv: number): number {
  const r = annualRate / 12;
  if (r === 0) return pv / nper;
  return (pv * r * Math.pow(1 + r, nper)) / (Math.pow(1 + r, nper) - 1);
}

export function calculateLeasing(inputs: LeasingInputs): LeasingResults {
  const {
    vehiclePrice,
    downPaymentPct,
    annualInterestRate,
    periodMonths,
    kaskoYearly,
    aoYearly,
    tyresTotal,
    serviceTotal,
    adminTotal,
    marginPct,
    vatPct,
    residualValue,
  } = inputs;

  // Core financing
  const downPaymentAmount = vehiclePrice * downPaymentPct;
  const leasingPrincipal = vehiclePrice - downPaymentAmount;
  const monthlyFinancingRate = pmt(annualInterestRate, periodMonths, leasingPrincipal);
  const totalRepayment = monthlyFinancingRate * periodMonths;
  const totalInterest = totalRepayment - leasingPrincipal;
  const totalFinancing = vehiclePrice + totalInterest;

  // Insurance & maintenance
  const yearsOfLease = periodMonths / 12;
  const totalKasko = kaskoYearly * yearsOfLease;
  const totalAO = aoYearly * yearsOfLease;

  // Total cost
  const totalCost =
    totalFinancing + totalKasko + totalAO + tyresTotal + serviceTotal + adminTotal;

  // Monthly pricing
  const monthlyCost = totalCost / periodMonths;
  const marginAmount = monthlyCost * marginPct;
  const monthlyRentNoVat = monthlyCost + marginAmount;
  const monthlyRentWithVat = monthlyRentNoVat * (1 + vatPct);

  // Profit
  const vtzProfit = (monthlyRentNoVat - monthlyFinancingRate) * periodMonths;
  const possibleProfit = vtzProfit + residualValue;

  return {
    downPaymentAmount,
    leasingPrincipal,
    monthlyFinancingRate,
    totalRepayment,
    totalInterest,
    totalFinancing,
    totalKasko,
    totalAO,
    yearsOfLease,
    totalCost,
    monthlyCost,
    marginAmount,
    monthlyRentNoVat,
    monthlyRentWithVat,
    vtzProfit,
    possibleProfit,
  };
}

export function formatCurrency(value: number, _currency = "KM"): string {
  return `${new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} KM`;
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
