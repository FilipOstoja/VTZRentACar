"use client";

import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from "@react-pdf/renderer";

// ─── Company constants — edit these to match real details ─────────────────────
export const COMPANY = {
  name:    "VTZ Rent-a-Car d.o.o.",
  address: "Bulevar Meše Selimovića 16, 71000 Sarajevo",
  phone:   "+387 33 123 456",
  mobile:  "+387 61 987 654",
  email:   "info@vtz-rentacar.ba",
  web:     "www.vtz-rentacar.ba",
  oib:     "4201234567890",
  iban:    "BA39 1011 0050 0000 1234",
  bank:    "UniCredit Bank d.d.",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1a2e",
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 44,
    backgroundColor: "#ffffff",
  },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  logoBlock: { flexDirection: "column" },
  logoMain: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#003580", letterSpacing: 0.5 },
  logoSub: { fontSize: 8, color: "#64748b", marginTop: 2, letterSpacing: 1 },
  companyInfo: { alignItems: "flex-end", fontSize: 8, color: "#475569", lineHeight: 1.6 },
  companyInfoBold: { fontFamily: "Helvetica-Bold", color: "#1e293b" },
  headerDivider: { borderBottomWidth: 2, borderBottomColor: "#003580", marginBottom: 16 },
  accentLine: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0", marginBottom: 12 },

  // Title
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  contractTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#003580", letterSpacing: 0.3 },
  contractMeta: { alignItems: "flex-end", fontSize: 8, color: "#64748b", lineHeight: 1.7 },
  contractMetaBold: { fontFamily: "Helvetica-Bold", color: "#1e293b", fontSize: 9 },

  // Sections
  sectionsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  sectionBox: {
    flex: 1,
    border: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#f8fafc",
  },
  sectionBoxHighlight: {
    flex: 1,
    border: 1,
    borderColor: "#bfdbfe",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#eff6ff",
  },
  sectionTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#003580",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 7,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  row: { flexDirection: "row", marginBottom: 3.5 },
  label: { width: 110, fontSize: 8, color: "#64748b", fontFamily: "Helvetica" },
  value: { flex: 1, fontSize: 8.5, color: "#1e293b", fontFamily: "Helvetica-Bold" },
  valueNormal: { flex: 1, fontSize: 8.5, color: "#1e293b" },

  // Financial summary
  financialBox: {
    border: 1,
    borderColor: "#bfdbfe",
    borderRadius: 4,
    padding: 12,
    backgroundColor: "#eff6ff",
    marginBottom: 12,
  },
  financialRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  financialLabel: { fontSize: 8.5, color: "#475569" },
  financialValue: { fontSize: 8.5, color: "#1e293b", fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#93c5fd",
    paddingTop: 7,
    marginTop: 5,
  },
  totalLabel: { fontSize: 10, color: "#003580", fontFamily: "Helvetica-Bold" },
  totalValue: { fontSize: 12, color: "#003580", fontFamily: "Helvetica-Bold" },

  // Damages
  damagesBox: {
    border: 1,
    borderColor: "#fde68a",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#fffbeb",
    marginBottom: 12,
  },
  damageItem: { flexDirection: "row", marginBottom: 3 },
  damageNum: { width: 16, height: 16, backgroundColor: "#f97316", borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 6 },
  damageNumText: { fontSize: 7, color: "white", fontFamily: "Helvetica-Bold" },
  damageText: { flex: 1, fontSize: 8, color: "#78350f" },
  noDamage: { fontSize: 8, color: "#15803d", fontFamily: "Helvetica-Bold" },

  // Terms
  termsBox: {
    border: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#f8fafc",
    marginBottom: 16,
  },
  termItem: { flexDirection: "row", marginBottom: 3 },
  termBullet: { width: 12, fontSize: 8, color: "#003580" },
  termText: { flex: 1, fontSize: 7.5, color: "#475569", lineHeight: 1.5 },

  // Signatures
  signaturesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  signatureBlock: { width: "44%", alignItems: "center" },
  signatureLabel: { fontSize: 8, color: "#64748b", marginBottom: 32, textAlign: "center" },
  signatureLine: { borderBottomWidth: 1, borderBottomColor: "#94a3b8", width: "100%", marginBottom: 4 },
  signatureCaption: { fontSize: 7.5, color: "#94a3b8", textAlign: "center" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: "#94a3b8" },
  footerPage: { fontSize: 7, color: "#94a3b8" },
});

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ContractData {
  contractNumber: string;
  date: string;
  // Vehicle
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleColor?: string;
  vehicleYear?: number;
  // Client
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientIdNumber?: string;
  clientDriversLicense?: string;
  // Rental terms
  startDate: string;
  endDate: string;
  pickupKm: number;
  dailyRate: number;
  totalDays: number;
  totalAmount: number;
  depositAmount: number;
  // Damages
  damages?: Array<{ zone?: string; note: string }>;
  // Digital signatures (base64 PNG data URLs)
  signatureLessor?: string;
  signatureLessee?: string;
}

// ─── Document ─────────────────────────────────────────────────────────────────
export function RentalContractPDF({ data }: { data: ContractData }) {
  const hasDamages = (data.damages ?? []).length > 0;

  return (
    <Document
      title={`Ugovor o najmu — ${data.contractNumber}`}
      author={COMPANY.name}
      subject="Ugovor o kratkoročnom najmu vozila"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View style={S.logoBlock}>
            <Text style={S.logoMain}>VTZ</Text>
            <Text style={S.logoSub}>RENT-A-CAR</Text>
          </View>
          <View style={S.companyInfo}>
            <Text style={S.companyInfoBold}>{COMPANY.name}</Text>
            <Text>{COMPANY.address}</Text>
            <Text>Tel: {COMPANY.phone}  |  Mob: {COMPANY.mobile}</Text>
            <Text>{COMPANY.email}  |  {COMPANY.web}</Text>
            <Text>ID: {COMPANY.oib}</Text>
          </View>
        </View>
        <View style={S.headerDivider} />

        {/* ── Title ── */}
        <View style={S.titleRow}>
          <View>
            <Text style={S.contractTitle}>UGOVOR O KRATKOROČNOM NAJMU VOZILA</Text>
            <Text style={{ fontSize: 8, color: "#64748b", marginTop: 2 }}>
              Ovim ugovorom regulišu se prava i obaveze između iznajmljivača i najmoprimca.
            </Text>
          </View>
          <View style={S.contractMeta}>
            <Text>Broj ugovora: <Text style={S.contractMetaBold}>{data.contractNumber}</Text></Text>
            <Text>Datum: <Text style={S.contractMetaBold}>{data.date}</Text></Text>
          </View>
        </View>

        {/* ── Parties ── */}
        <View style={S.sectionsRow}>
          {/* Lessor */}
          <View style={S.sectionBox}>
            <Text style={S.sectionTitle}>Iznajmljivač</Text>
            <View style={S.row}><Text style={S.label}>Naziv:</Text><Text style={S.value}>{COMPANY.name}</Text></View>
            <View style={S.row}><Text style={S.label}>Adresa:</Text><Text style={S.valueNormal}>{COMPANY.address}</Text></View>
            <View style={S.row}><Text style={S.label}>Telefon:</Text><Text style={S.valueNormal}>{COMPANY.phone}</Text></View>
            <View style={S.row}><Text style={S.label}>Email:</Text><Text style={S.valueNormal}>{COMPANY.email}</Text></View>
            <View style={S.row}><Text style={S.label}>ID broj:</Text><Text style={S.valueNormal}>{COMPANY.oib}</Text></View>
            <View style={S.row}><Text style={S.label}>IBAN:</Text><Text style={S.valueNormal}>{COMPANY.iban}</Text></View>
          </View>

          {/* Lessee */}
          <View style={S.sectionBoxHighlight}>
            <Text style={S.sectionTitle}>Najmoprimac</Text>
            <View style={S.row}><Text style={S.label}>Ime i prezime:</Text><Text style={S.value}>{data.clientName}</Text></View>
            {data.clientPhone && <View style={S.row}><Text style={S.label}>Telefon:</Text><Text style={S.valueNormal}>{data.clientPhone}</Text></View>}
            {data.clientEmail && <View style={S.row}><Text style={S.label}>Email:</Text><Text style={S.valueNormal}>{data.clientEmail}</Text></View>}
            {data.clientIdNumber && <View style={S.row}><Text style={S.label}>Br. lične karte:</Text><Text style={S.valueNormal}>{data.clientIdNumber}</Text></View>}
            {data.clientDriversLicense && <View style={S.row}><Text style={S.label}>Br. vozačke:</Text><Text style={S.valueNormal}>{data.clientDriversLicense}</Text></View>}
          </View>
        </View>

        {/* ── Vehicle ── */}
        <View style={{ ...S.sectionBox, marginBottom: 12 }}>
          <Text style={S.sectionTitle}>Podaci o vozilu</Text>
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View style={{ flex: 1 }}>
              <View style={S.row}><Text style={S.label}>Vozilo:</Text><Text style={S.value}>{data.vehicleMake} {data.vehicleModel}</Text></View>
              <View style={S.row}><Text style={S.label}>Reg. oznaka:</Text><Text style={S.value}>{data.vehicleRegistration}</Text></View>
            </View>
            <View style={{ flex: 1 }}>
              {data.vehicleColor && <View style={S.row}><Text style={S.label}>Boja:</Text><Text style={S.valueNormal}>{data.vehicleColor}</Text></View>}
              {data.vehicleYear && <View style={S.row}><Text style={S.label}>Godište:</Text><Text style={S.valueNormal}>{data.vehicleYear}</Text></View>}
              <View style={S.row}><Text style={S.label}>Km pri preuzimanju:</Text><Text style={S.value}>{data.pickupKm.toLocaleString()} km</Text></View>
            </View>
          </View>
        </View>

        {/* ── Financial summary ── */}
        <View style={S.financialBox}>
          <Text style={{ ...S.sectionTitle, borderBottomColor: "#93c5fd", marginBottom: 10 }}>Uvjeti najma</Text>
          <View style={{ flexDirection: "row", gap: 20 }}>
            <View style={{ flex: 1 }}>
              <View style={S.financialRow}>
                <Text style={S.financialLabel}>Datum preuzimanja:</Text>
                <Text style={S.financialValue}>{data.startDate}</Text>
              </View>
              <View style={S.financialRow}>
                <Text style={S.financialLabel}>Datum povratka:</Text>
                <Text style={S.financialValue}>{data.endDate}</Text>
              </View>
              <View style={S.financialRow}>
                <Text style={S.financialLabel}>Broj dana:</Text>
                <Text style={S.financialValue}>{data.totalDays} {data.totalDays === 1 ? "dan" : "dana"}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={S.financialRow}>
                <Text style={S.financialLabel}>Dnevna tarifa:</Text>
                <Text style={S.financialValue}>{(data.dailyRate * 1.9583).toFixed(2)} KM  (≈ €{data.dailyRate.toFixed(2)})</Text>
              </View>
              <View style={S.financialRow}>
                <Text style={S.financialLabel}>Depozit:</Text>
                <Text style={S.financialValue}>{(data.depositAmount * 1.9583).toFixed(2)} KM</Text>
              </View>
            </View>
          </View>
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>UKUPAN IZNOS NAJMA:</Text>
            <Text style={S.totalValue}>{(data.totalAmount * 1.9583).toFixed(2)} KM  (≈ €{data.totalAmount.toFixed(2)})</Text>
          </View>
        </View>

        {/* ── Vehicle condition ── */}
        <View style={S.damagesBox}>
          <Text style={{ ...S.sectionTitle, borderBottomColor: "#fde68a", color: "#92400e" }}>
            Stanje vozila pri preuzimanju
          </Text>
          {hasDamages ? (
            (data.damages ?? []).map((d, i) => (
              <View key={i} style={S.damageItem}>
                <View style={S.damageNum}><Text style={S.damageNumText}>{i + 1}</Text></View>
                <Text style={S.damageText}>{d.note}</Text>
              </View>
            ))
          ) : (
            <Text style={S.noDamage}>✓  Vozilo preuzeto bez vidljivih oštećenja</Text>
          )}
        </View>

        {/* ── Terms ── */}
        <View style={S.termsBox}>
          <Text style={S.sectionTitle}>Uvjeti i odredbe</Text>
          {[
            "Najmoprimac je obavezan vratiti vozilo u istom stanju kakvo je preuzeo, s punim rezervoarom goriva.",
            "Vozilo se smije koristiti isključivo na cestama predviđenim za javni promet. Vožnja po terenu nije dozvoljena.",
            "Najmoprimac snosi punu odgovornost za saobraćajne prekršaje i kazne nastale za vrijeme trajanja najma.",
            "U slučaju saobraćajne nesreće ili kvara, najmoprimac je dužan odmah obavijestiti iznajmljivača.",
            "Depozit se vraća po povratku vozila, nakon provjere stanja vozila i podmirenja svih troškova.",
            "Vozilo nije dozvoljeno iznajmiti ili posuditi trećim licima.",
            "Minimalna starost vozača je 21 godina uz najmanje 2 godine posjedovanja vozačke dozvole.",
            "Iznajmljivač zadržava pravo naplate dodatnih troškova za oštećenja nastala tokom najma.",
          ].map((term, i) => (
            <View key={i} style={S.termItem}>
              <Text style={S.termBullet}>{i + 1}.</Text>
              <Text style={S.termText}>{term}</Text>
            </View>
          ))}
        </View>

        {/* ── Signatures ── */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 8, color: "#475569", marginBottom: 12, textAlign: "center" }}>
            Potpisivanjem ovog ugovora obje strane potvrđuju da su upoznate s uvjetima najma i slažu se s njima.
          </Text>
          <View style={S.signaturesRow}>
            <View style={S.signatureBlock}>
              <Text style={S.signatureLabel}>Potpis iznajmljivača:</Text>
              {data.signatureLessor ? (
                <Image src={data.signatureLessor} style={{ width: 140, height: 44, marginBottom: 4 }} />
              ) : (
                <View style={{ height: 36 }} />
              )}
              <View style={S.signatureLine} />
              <Text style={S.signatureCaption}>{COMPANY.name}</Text>
              <Text style={{ ...S.signatureCaption, marginTop: 2 }}>Datum: ________________________</Text>
            </View>
            <View style={S.signatureBlock}>
              <Text style={S.signatureLabel}>Potpis najmoprimca:</Text>
              {data.signatureLessee ? (
                <Image src={data.signatureLessee} style={{ width: 140, height: 44, marginBottom: 4 }} />
              ) : (
                <View style={{ height: 36 }} />
              )}
              <View style={S.signatureLine} />
              <Text style={S.signatureCaption}>{data.clientName}</Text>
              <Text style={{ ...S.signatureCaption, marginTop: 2 }}>Datum: ________________________</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{COMPANY.name}  •  {COMPANY.address}  •  {COMPANY.web}</Text>
          <Text style={S.footerPage}>Ugovor br. {data.contractNumber}</Text>
        </View>

      </Page>
    </Document>
  );
}
