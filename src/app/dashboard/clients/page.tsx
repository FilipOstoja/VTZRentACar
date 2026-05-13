"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import clsx from "clsx";
import {
  isFilled,
  isValidEmail,
  REQUIRED,
  INVALID_EMAIL,
  type ValidationErrors,
} from "@/lib/validation";

interface Client {
  id: string;
  client_type: "individual" | "company";
  full_name: string;
  company_name?: string;
  id_number?: string;
  email?: string;
  phone?: string;
  city?: string;
  is_blacklisted: boolean;
  blacklist_reason?: string;
  notes?: string;
}

const emptyClient: Partial<Client> = { client_type: "individual", full_name: "", is_blacklisted: false };

export default function ClientsPage() {
  const [clients, setClients]           = useState<Client[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client>>(emptyClient);
  const [isEditing, setIsEditing]       = useState(false);
  const [saving, setSaving]             = useState(false);
  const [search, setSearch]             = useState("");
  const [filterBlacklist, setFilterBlacklist] = useState(false);
  const [errors, setErrors]             = useState<ValidationErrors>({});
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("clients").select("*").order("full_name");
    setClients(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openAdd  = () => { setEditingClient({ ...emptyClient }); setIsEditing(false); setErrors({}); setShowModal(true); };
  const openEdit = (c: Client) => { setEditingClient({ ...c }); setIsEditing(true); setErrors({}); setShowModal(true); };

  const validateClient = (c: Partial<Client>): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!isFilled(c.full_name)) e.full_name = REQUIRED;
    if (c.client_type === "company" && !isFilled(c.company_name)) e.company_name = REQUIRED;
    if (c.email && !isValidEmail(c.email)) e.email = INVALID_EMAIL;
    if (c.is_blacklisted && !isFilled(c.blacklist_reason)) e.blacklist_reason = REQUIRED;
    return e;
  };

  const save = async () => {
    const errs = validateClient(editingClient);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    if (isEditing && editingClient.id) {
      await supabase.from("clients").update(editingClient).eq("id", editingClient.id);
    } else {
      const { id, ...newC } = editingClient as any;
      await supabase.from("clients").insert(newC);
    }
    setSaving(false); setShowModal(false); load();
  };

  const filtered = clients.filter((c) => {
    const matchSearch = !search ||
      `${c.full_name} ${c.company_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchBlacklist = !filterBlacklist || c.is_blacklisted;
    return matchSearch && matchBlacklist;
  });

  const set = (key: keyof Client, value: any) => {
    setEditingClient((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <div className="p-4 sm:p-6 max-w-[1440px] mx-auto space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#003580] tracking-tight">Baza klijenata</h1>
            <p className="text-sm text-slate-500 mt-0.5">{clients.length} klijenata ukupno</p>
          </div>
          <button onClick={openAdd} className="btn-primary self-start sm:self-auto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novi klijent
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="pl-9 pr-4 py-2 bg-white border border-[#E7E7E7] rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-all w-full shadow-sm"
              placeholder="Pretraži klijente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer bg-white border border-[#E7E7E7] rounded-lg px-3 py-2 shadow-sm hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={filterBlacklist}
              onChange={(e) => setFilterBlacklist(e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            Samo crna lista
          </label>
        </div>

        {/* Table */}
        <div className="bg-white border border-[#E7E7E7] rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Učitavanje...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-sm">Nema klijenata</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-[#E7E7E7]">
                <tr>
                  {["Ime / Kompanija", "Tip", "Telefon", "Email", "Grad", "Status", ""].map((h) => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className={clsx("hover:bg-slate-50 transition-colors", c.is_blacklisted && "bg-red-50/40")}>
                    <td className="table-cell">
                      <div className="font-semibold text-slate-800">{c.full_name}</div>
                      {c.company_name && <div className="text-xs text-slate-400">{c.company_name}</div>}
                    </td>
                    <td className="table-cell">
                      <span className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                        c.client_type === "company"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-sky-100 text-sky-700"
                      )}>
                        {c.client_type === "company" ? "Kompanija" : "Fizičko lice"}
                      </span>
                    </td>
                    <td className="table-cell text-slate-500">{c.phone || "—"}</td>
                    <td className="table-cell text-slate-500">{c.email || "—"}</td>
                    <td className="table-cell text-slate-500">{c.city || "—"}</td>
                    <td className="table-cell">
                      {c.is_blacklisted ? (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          Crna lista
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Aktivan
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <button onClick={() => openEdit(c)} className="btn-ghost text-xs py-1">Uredi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="px-5 py-3 bg-slate-50 border-t border-[#E7E7E7]">
            <span className="text-xs text-slate-500">Prikazano {filtered.length} od {clients.length} klijenata</span>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#E7E7E7] rounded-2xl shadow-2xl w-full max-w-xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800">
                {isEditing ? "Uredi klijenta" : "Novi klijent"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Client type toggle */}
              <div>
                <label className="label">Tip klijenta</label>
                <div className="flex gap-2">
                  {(["individual", "company"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => set("client_type", t)}
                      className={clsx(
                        "flex-1 py-2 rounded-lg text-sm font-semibold border transition-all",
                        editingClient.client_type === t
                          ? "bg-[#003580]/10 border-[#003580]/30 text-[#003580]"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {t === "individual" ? "Fizičko lice" : "Kompanija"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Ime i prezime <span className="text-red-400">*</span></label>
                  <input
                    className={clsx("input", errors.full_name && "border-red-300 focus:ring-red-200 focus:border-red-400")}
                    value={editingClient.full_name ?? ""}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="Ime Prezime"
                  />
                  {errors.full_name && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.full_name}</p>}
                </div>
                {editingClient.client_type === "company" && (
                  <div className="col-span-2">
                    <label className="label">Naziv kompanije <span className="text-red-400">*</span></label>
                    <input
                      className={clsx("input", errors.company_name && "border-red-300 focus:ring-red-200 focus:border-red-400")}
                      value={editingClient.company_name ?? ""}
                      onChange={(e) => set("company_name", e.target.value)}
                      placeholder="d.o.o."
                    />
                    {errors.company_name && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.company_name}</p>}
                  </div>
                )}
                <div>
                  <label className="label">Broj lične karte / putovnice</label>
                  <input className="input" value={editingClient.id_number ?? ""} onChange={(e) => set("id_number", e.target.value)} />
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input className="input" value={editingClient.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+387 61 ..." />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className={clsx("input", errors.email && "border-red-300 focus:ring-red-200 focus:border-red-400")}
                    value={editingClient.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                  />
                  {errors.email && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.email}</p>}
                </div>
                <div>
                  <label className="label">Grad</label>
                  <input className="input" value={editingClient.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                </div>
              </div>

              {/* Blacklist */}
              <div className={clsx("border rounded-xl p-4 transition-colors", editingClient.is_blacklisted ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50")}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingClient.is_blacklisted ?? false}
                    onChange={(e) => set("is_blacklisted", e.target.checked)}
                    className="w-4 h-4 accent-red-500"
                  />
                  <span className="text-sm font-semibold text-red-600">Dodaj na crnu listu (Ne iznajmljuj)</span>
                </label>
                {editingClient.is_blacklisted && (
                  <div className="mt-3">
                    <label className="label">Razlog <span className="text-red-400">*</span></label>
                    <input
                      className={clsx("input", errors.blacklist_reason && "border-red-300 focus:ring-red-200 focus:border-red-400")}
                      value={editingClient.blacklist_reason ?? ""}
                      onChange={(e) => set("blacklist_reason", e.target.value)}
                      placeholder="Razlog za zabranu..."
                    />
                    {errors.blacklist_reason && <p className="text-[11px] text-red-500 mt-1 font-medium">{errors.blacklist_reason}</p>}
                  </div>
                )}
              </div>

              <div>
                <label className="label">Napomene</label>
                <textarea className="input min-h-[60px] resize-none" value={editingClient.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Odustani</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? "Čuvanje..." : isEditing ? "Spremi" : "Dodaj klijenta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
