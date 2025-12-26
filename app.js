/*
Fix & Flip Rechner – app.js (komplett) – v5
Änderung: Bundesland-Auswahl -> setzt Grunderwerbsteuer (GrESt) automatisch.

Fixes (beibehalten):
1) Kein Fokus-Springen beim Tippen: Deal-Tab wird beim Input NICHT neu gerendert.
2) Live-Berechnung: Beim Input werden nur berechnete Tabs neu gerendert + Deal-Snippet per DOM aktualisiert.
3) Lesbarkeit: Keine dunklen Overrides, keine var(--text)-Abhängigkeit.
4) Professionelles UI: Cards, KPIs, Badges, Export.

Hinweis:
- Inputs sind type="text" mit inputmode="decimal", damit Mobile/Browser den Cursor nicht verlieren.
- Prozentfelder: Eingabe "1,5" => 1.5% => intern 0.015. Eingabe "0,015" bleibt 0.015.
*/

const LS_KEY = "ff_deals_v5";
const LS_ACTIVE = "ff_active_deal_v5";
const LS_COMPARE = "ff_compare_v5";

const DISCOUNTS = [0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45];

// ---------- GrESt nach Bundesland (Stand: 2025-08) ----------
const GREST_BY_STATE = {
  "Baden-Württemberg": 0.050,
  "Bayern": 0.035,
  "Berlin": 0.060,
  "Brandenburg": 0.065,
  "Bremen": 0.055,
  "Hamburg": 0.055,
  "Hessen": 0.060,
  "Mecklenburg-Vorpommern": 0.060,
  "Niedersachsen": 0.050,
  "Nordrhein-Westfalen": 0.065,
  "Rheinland-Pfalz": 0.050,
  "Saarland": 0.065,
  "Sachsen": 0.055,
  "Sachsen-Anhalt": 0.050,
  "Schleswig-Holstein": 0.065,
  "Thüringen": 0.050
};
const STATES = Object.keys(GREST_BY_STATE);
function grestForState(state){
  return GREST_BY_STATE[state] ?? 0.065; // Fallback
}

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);

function deEUR(n){
  if (!isFinite(n)) return "–";
  return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n);
}
function dePct(n){
  if (!isFinite(n)) return "–";
  return new Intl.NumberFormat("de-DE",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
}
function clamp0(x){
  const v = Number(String(x ?? "").replace(",", "."));
  return isFinite(v) ? Math.max(0, v) : 0;
}
function uid(){
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function safeFileName(s){
  return String(s || "deal")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "deal";
}
function downloadText(filename, content, mime="text/plain;charset=utf-8"){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Defaults ----------
function defaultDeal(){
  const defaultState = "Nordrhein-Westfalen";
  return {
    id: uid(),
    name: "Blanko Deal",
    city: "",
    createdAt: new Date().toISOString(),

    // Objekt & Markt
    kaufpreis: 0,
    wohnflaeche: 0,
    marktpreis_g: 0,
    marktpreis_h: 0,

    // Bundesland (GrESt automatisch)
    bundesland: defaultState,

    // Ankauf-NK
    notar_pct: 0.015,
    makler_ankauf_pct: 0.036,
    grest_pct: grestForState(defaultState),

    // Renovierung
    entruempelung: 0,
    renovierung: 0,
    puffer_pct: 0.10,
    kueche: 0,
    sonstiges: 0,

    // Finanzierung
    projektdauer_monate: 8,
    finanzierungsquote: 1.0,
    zins_pa: 0.055,
    bearb_pct: 0.01,
    fin_sonst_pct: 0,

    // Laufende Kosten
    hausgeld_monat: 0,
    strom_heizung_monat: 0,

    // Verkauf
    verkauf_makler_fix: 0,
    coinvestor_pct: 0,
    homestaging_fix: 0,

    // Vermietung
    pot_miete_qm: 0,
    kaeufer_zins_tilg_pa: 0.054
  };
}

// ---------- Storage ----------
function loadDeals(){
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) || []; } catch { return []; }
}
function saveDeals(deals){ localStorage.setItem(LS_KEY, JSON.stringify(deals)); }
function getActiveId(){ return localStorage.getItem(LS_ACTIVE); }
function setActiveId(id){ localStorage.setItem(LS_ACTIVE, id); }
function getCompareIds(){
  try { return JSON.parse(localStorage.getItem(LS_COMPARE) || "[]"); } catch { return []; }
}
function setCompareIds(ids){ localStorage.setItem(LS_COMPARE, JSON.stringify(ids.slice(0,3))); }

// ---------- Excel-Logik (wie bisher, template-nah) ----------
function compute(deal){
  const kaufpreis = clamp0(deal.kaufpreis);
  const wf = Math.max(1e-9, clamp0(deal.wohnflaeche));
  const markt_g = clamp0(deal.marktpreis_g);
  const markt_h = clamp0(deal.marktpreis_h);

  const notar_pct = clamp0(deal.notar_pct);
  const makler_pct = clamp0(deal.makler_ankauf_pct);
  const grest_pct = clamp0(deal.grest_pct);

  const entruempelung = clamp0(deal.entruempelung);
  const renovierung = clamp0(deal.renovierung);
  const puffer_pct = clamp0(deal.puffer_pct);
  const kueche = clamp0(deal.kueche);
  const sonstiges = clamp0(deal.sonstiges);

  const monate = clamp0(deal.projektdauer_monate);
  const finquote = clamp0(deal.finanzierungsquote);
  const zins_pa = clamp0(deal.zins_pa);
  const bearb_pct = clamp0(deal.bearb_pct);
  const fin_sonst_pct = clamp0(deal.fin_sonst_pct);

  const hausgeld = clamp0(deal.hausgeld_monat);
  const strom = clamp0(deal.strom_heizung_monat);

  const verkauf_makler_fix = clamp0(deal.verkauf_makler_fix);
  const coinvestor_pct = clamp0(deal.coinvestor_pct);
  const homestaging_fix = clamp0(deal.homestaging_fix);

  const pot_miete_qm = clamp0(deal.pot_miete_qm);
  const kaeufer_zins_tilg_pa = clamp0(deal.kaeufer_zins_tilg_pa);

  // Verkaufspreise
  const VK_g = markt_g * wf;
  const VK_h = markt_h * wf;

  // Ankauf
  const Notar = kaufpreis * notar_pct;
  const MaklerAnkauf = kaufpreis * makler_pct;
  const GrESt = kaufpreis * grest_pct;
  const AnkaufGesamt = kaufpreis + Notar + MaklerAnkauf + GrESt;

  // Renovierung
  const Puffer = renovierung * puffer_pct;
  const RenoGesamt = entruempelung + renovierung + Puffer + kueche + sonstiges;

  // Finanzierung
  const Finanzbetrag = kaufpreis * finquote;
  const Zinsen = Finanzbetrag * (zins_pa/12) * monate;
  const Bearb = Finanzbetrag * bearb_pct;
  const FinSonst = Finanzbetrag * fin_sonst_pct;
  const FinGesamt = Zinsen + Bearb + FinSonst;

  // Laufende Kosten
  const MonatlicheKosten = hausgeld + strom;
  const LaufendeKosten = MonatlicheKosten * monate;

  // Gesamtinvest
  const INV = AnkaufGesamt + RenoGesamt + FinGesamt + LaufendeKosten;

  // Gewinn / Marge
  const Gewinn_g = VK_g - INV - (coinvestor_pct * VK_g) - homestaging_fix - verkauf_makler_fix;
  const Gewinn_h = VK_h - INV - (coinvestor_pct * VK_h) - homestaging_fix - verkauf_makler_fix;

  // Marge wie in deiner bisherigen Implementierung
  const baseDen = (INV + verkauf_makler_fix + coinvestor_pct + homestaging_fix);
  const Marge_g = baseDen > 0 ? (VK_g - baseDen) / baseDen : NaN;
  const Marge_h = baseDen > 0 ? (VK_h - baseDen) / baseDen : NaN;

  // Vermietung
  const Jahresmiete = pot_miete_qm * wf * 12;
  const BruttoRendite_g = (VK_g > 0) ? Jahresmiete / (VK_g * 1.10) : NaN;
  const BruttoRendite_h = (VK_h > 0) ? Jahresmiete / (VK_h * 1.10) : NaN;
  const KaeuferRate_g = (VK_g * kaeufer_zins_tilg_pa) / 12;
  const KaeuferRate_h = (VK_h * kaeufer_zins_tilg_pa) / 12;

  // Verhandlungstabelle
  const negotiation = DISCOUNTS.map(r => {
    const Kaufpreis_r = kaufpreis * (1 - r);

    const INVEST_r =
      (Kaufpreis_r + ((grest_pct + makler_pct + notar_pct) * Kaufpreis_r))
      + ((fin_sonst_pct * Kaufpreis_r) + (bearb_pct * Kaufpreis_r) + ((zins_pa * Kaufpreis_r / 12) * monate))
      + RenoGesamt
      + (MonatlicheKosten * monate);

    const Gewinn_g_r = VK_g - INVEST_r - (coinvestor_pct * VK_g) - homestaging_fix;

    const den_r = (INVEST_r + verkauf_makler_fix + coinvestor_pct + homestaging_fix);
    const Marge_g_r = den_r > 0 ? (VK_g - den_r) / den_r : NaN;

    const Gewinn_h_r = VK_h - INVEST_r - (coinvestor_pct * VK_g) - homestaging_fix;
    const Marge_h_r = den_r > 0 ? (VK_h - den_r) / den_r : NaN;

    return { r, Kaufpreis_r, INVEST_r, Gewinn_g_r, Marge_g_r, Gewinn_h_r, Marge_h_r };
  });

  let bestIdx = 0;
  let bestVal = -Infinity;
  negotiation.forEach((x,i)=>{
    if (isFinite(x.Marge_g_r) && x.Marge_g_r > bestVal) { bestVal = x.Marge_g_r; bestIdx = i; }
  });

  return {
    VK_g, VK_h,
    Notar, MaklerAnkauf, GrESt, AnkaufGesamt,
    Puffer, RenoGesamt,
    Finanzbetrag, Zinsen, Bearb, FinSonst, FinGesamt,
    MonatlicheKosten, LaufendeKosten,
    INV,
    Gewinn_g, Gewinn_h,
    Marge_g, Marge_h,
    Jahresmiete, BruttoRendite_g, BruttoRendite_h, KaeuferRate_g, KaeuferRate_h,
    negotiation, bestIdx
  };
}

// ---------- UI building blocks ----------
function ampBadge(marge){
  if (!isFinite(marge)) return `<span class="badge">–</span>`;
  if (marge > 0.20) return `<span class="badge badge--ok">OK</span>`;
  if (marge >= 0.10) return `<span class="badge badge--warn">Grenze</span>`;
  return `<span class="badge badge--bad">No-Go</span>`;
}
function card(title, inner){
  return `<div class="card"><div class="card__title">${title}</div>${inner}</div>`;
}
function row(label, value){
  return `<div class="row"><div class="l">${label}</div><div class="r">${value}</div></div>`;
}
function inputField(label, key, value, hint, opts={}){
  const { isPct=false } = opts;
  const display = (isPct ? (Number(value)*100) : value);
  return `
    <div class="field">
      <label><span>${label}</span><small>${hint || ""}</small></label>
      <input class="ff-input" type="text" inputmode="decimal" value="${display ?? ""}"
             data-key="${key}" data-pct="${isPct ? "1" : "0"}" autocomplete="off" />
    </div>`;
}
function textField(label, key, value, hint){
  return `
    <div class="field">
      <label><span>${label}</span><small>${hint || ""}</small></label>
      <input class="ff-input" type="text" value="${value || ""}" data-tkey="${key}" autocomplete="off" />
    </div>`;
}
function selectField(label, key, value, options, hint){
  return `
    <div class="field">
      <label><span>${label}</span><small>${hint || ""}</small></label>
      <select class="ff-input" data-skey="${key}">
        ${options.map(o => `<option value="${o}" ${String(o)===String(value) ? "selected" : ""}>${o}</option>`).join("")}
      </select>
    </div>`;
}

// ---------- Export ----------
function exportCsvForDeal(deal){
  const c = compute(deal);

  const rows = [
    ["Deal", deal.name],
    ["Ort", deal.city],
    ["Bundesland", deal.bundesland || ""],
    ["Zeitpunkt", new Date().toLocaleString("de-DE")],
    ["", ""],

    ["INPUT kaufpreis", deal.kaufpreis],
    ["INPUT wohnflaeche", deal.wohnflaeche],
    ["INPUT marktpreis_g", deal.marktpreis_g],
    ["INPUT marktpreis_h", deal.marktpreis_h],

    ["INPUT notar_pct", deal.notar_pct],
    ["INPUT makler_ankauf_pct", deal.makler_ankauf_pct],
    ["INPUT grest_pct", deal.grest_pct],

    ["INPUT entruempelung", deal.entruempelung],
    ["INPUT renovierung", deal.renovierung],
    ["INPUT puffer_pct", deal.puffer_pct],
    ["INPUT kueche", deal.kueche],
    ["INPUT sonstiges", deal.sonstiges],

    ["INPUT projektdauer_monate", deal.projektdauer_monate],
    ["INPUT finanzierungsquote", deal.finanzierungsquote],
    ["INPUT zins_pa", deal.zins_pa],
    ["INPUT bearb_pct", deal.bearb_pct],
    ["INPUT fin_sonst_pct", deal.fin_sonst_pct],

    ["INPUT hausgeld_monat", deal.hausgeld_monat],
    ["INPUT strom_heizung_monat", deal.strom_heizung_monat],

    ["INPUT verkauf_makler_fix", deal.verkauf_makler_fix],
    ["INPUT coinvestor_pct", deal.coinvestor_pct],
    ["INPUT homestaging_fix", deal.homestaging_fix],

    ["INPUT pot_miete_qm", deal.pot_miete_qm],
    ["INPUT kaeufer_zins_tilg_pa", deal.kaeufer_zins_tilg_pa],

    ["", ""],
    ["OUTPUT VK_g", c.VK_g],
    ["OUTPUT VK_h", c.VK_h],
    ["OUTPUT INV", c.INV],
    ["OUTPUT Gewinn_g", c.Gewinn_g],
    ["OUTPUT Gewinn_h", c.Gewinn_h],
    ["OUTPUT Marge_g", c.Marge_g],
    ["OUTPUT Marge_h", c.Marge_h],
    ["OUTPUT Jahresmiete", c.Jahresmiete],
    ["OUTPUT BruttoRendite_g", c.BruttoRendite_g],
    ["OUTPUT BruttoRendite_h", c.BruttoRendite_h],
    ["OUTPUT KäuferRate_g", c.KaeuferRate_g],
    ["OUTPUT KäuferRate_h", c.KaeuferRate_h],
  ];

  rows.push(["", ""], ["VERHANDLUNG", ""], ["Rabatt", "INVEST_r", "Gewinn_g_r", "Marge_g_r", "Gewinn_h_r", "Marge_h_r"]);
  c.negotiation.forEach(x=>{
    rows.push([x.r, x.INVEST_r, x.Gewinn_g_r, x.Marge_g_r, x.Gewinn_h_r, x.Marge_h_r]);
  });

  const csv = rows
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(";"))
    .join("\n");

  downloadText(`${safeFileName(deal.name)}-fixflip-export.csv`, csv, "text/csv;charset=utf-8");
}

function exportPdfForDeal(deal){
  const c = compute(deal);

  const html = `
  <html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${deal.name} – Fix&Flip Report</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:24px;color:#111}
      h1{margin:0 0 6px;font-size:20px}
      .muted{color:#555;margin:0 0 18px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .card{border:1px solid #ddd;border-radius:12px;padding:12px}
      .row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #eee}
      .row:last-child{border-bottom:none}
      .l{color:#555;font-weight:600}
      .r{font-weight:800}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:right}
      th:first-child,td:first-child{text-align:left}
      @media print { button{display:none} }
    </style>
  </head>
  <body>
    <button onclick="window.print()">Als PDF drucken / speichern</button>
    <h1>${deal.name}</h1>
    <p class="muted">${deal.city || ""} • ${deal.bundesland || ""} • ${new Date().toLocaleString("de-DE")}</p>

    <div class="grid">
      <div class="card">
        <h3>Ergebnisse</h3>
        <div class="row"><div class="l">INV</div><div class="r">${deEUR(c.INV)}</div></div>
        <div class="row"><div class="l">VK gering</div><div class="r">${deEUR(c.VK_g)}</div></div>
        <div class="row"><div class="l">Gewinn gering</div><div class="r">${deEUR(c.Gewinn_g)}</div></div>
        <div class="row"><div class="l">Marge gering</div><div class="r">${dePct(c.Marge_g)}</div></div>
        <div class="row"><div class="l">VK hoch</div><div class="r">${deEUR(c.VK_h)}</div></div>
        <div class="row"><div class="l">Gewinn hoch</div><div class="r">${deEUR(c.Gewinn_h)}</div></div>
        <div class="row"><div class="l">Marge hoch</div><div class="r">${dePct(c.Marge_h)}</div></div>
      </div>

      <div class="card">
        <h3>Inputs (Kurz)</h3>
        <div class="row"><div class="l">Kaufpreis</div><div class="r">${deEUR(clamp0(deal.kaufpreis))}</div></div>
        <div class="row"><div class="l">Wohnfläche</div><div class="r">${clamp0(deal.wohnflaeche)} m²</div></div>
        <div class="row"><div class="l">Bundesland</div><div class="r">${deal.bundesland || ""}</div></div>
        <div class="row"><div class="l">GrESt-Satz</div><div class="r">${dePct(clamp0(deal.grest_pct))}</div></div>
        <div class="row"><div class="l">Markt €/m² (g/h)</div><div class="r">${clamp0(deal.marktpreis_g)} / ${clamp0(deal.marktpreis_h)}</div></div>
        <div class="row"><div class="l">Reno gesamt</div><div class="r">${deEUR(c.RenoGesamt)}</div></div>
        <div class="row"><div class="l">Finanzierung gesamt</div><div class="r">${deEUR(c.FinGesamt)}</div></div>
        <div class="row"><div class="l">Laufende Kosten</div><div class="r">${deEUR(c.LaufendeKosten)}</div></div>
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h3>Verhandlung (10–45%)</h3>
      <table>
        <thead>
          <tr>
            <th>Rabatt</th><th>INVEST</th><th>Gewinn g</th><th>Marge g</th><th>Gewinn h</th><th>Marge h</th>
          </tr>
        </thead>
        <tbody>
          ${c.negotiation.map(x=>`
            <tr>
              <td>${dePct(x.r)}</td>
              <td>${deEUR(x.INVEST_r)}</td>
              <td>${deEUR(x.Gewinn_g_r)}</td>
              <td>${dePct(x.Marge_g_r)}</td>
              <td>${deEUR(x.Gewinn_h_r)}</td>
              <td>${dePct(x.Marge_h_r)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Popup-Blocker aktiv. Bitte Popups für diese Seite erlauben und erneut versuchen.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ---------- App State ----------
let deals = loadDeals();
if (!deals || deals.length === 0) {
  const d = defaultDeal();
  deals = [d];
  saveDeals(deals);
  setActiveId(d.id);
} else {
  // Migration: Bundesland ergänzen, falls alte Deals existieren
  let changed = false;
  deals.forEach(d=>{
    if (!d.bundesland) { d.bundesland = "Nordrhein-Westfalen"; changed = true; }
    if (!isFinite(d.grest_pct) || d.grest_pct === 0) { d.grest_pct = grestForState(d.bundesland); changed = true; }
  });
  if (changed) saveDeals(deals);

  if (!getActiveId()) setActiveId(deals[0].id);
}

function activeDeal(){
  const id = getActiveId();
  return deals.find(d => d.id === id) || deals[0];
}
function persist(){ saveDeals(deals); }

// Prozentfelder (Eingabe als % oder Dezimal)
const pctFields = new Set([
  "notar_pct","makler_ankauf_pct","grest_pct","puffer_pct",
  "finanzierungsquote","zins_pa","bearb_pct","fin_sonst_pct",
  "coinvestor_pct","kaeufer_zins_tilg_pa"
]);

function parseNumericInput(raw){
  const s = String(raw ?? "").trim().replace(/\s/g,"");
  if (!s) return 0;
  const normalized = s.includes(",") ? s.replace(/\./g,"").replace(",", ".") : s;
  const n = Number(normalized);
  return isFinite(n) ? Math.max(0, n) : 0;
}

function applyField(key, rawValue, isPct){
  const d = activeDeal();
  if (!d) return;

  let num = parseNumericInput(rawValue);

  if (isPct || pctFields.has(key)) {
    if (num > 1) num = num / 100;
  }

  d[key] = num;
  persist();
}

// ---------- Rendering strategy (anti-focus-jump) ----------
let dealTabMounted = false;

function renderDealTab(){
  const d = activeDeal();
  if (!d) return;

  const el = $("#deal");
  const currentId = el?.dataset?.dealId;

  if (dealTabMounted && currentId === d.id) {
    updateDealSnippet();
    return;
  }

  dealTabMounted = true;
  el.dataset.dealId = d.id;

  const c = compute(d);

  el.innerHTML = [
    card("Eingabe", `
      <div class="grid grid--2">
        ${textField("Deal-Name", "name", d.name)}
        ${textField("Stadt/Ort", "city", d.city)}
      </div>

      <div class="hr"></div>
      <div class="grid grid--2">
        ${inputField("Kaufpreis", "kaufpreis", d.kaufpreis, "EUR")}
        ${inputField("Wohnfläche", "wohnflaeche", d.wohnflaeche, "m²")}
        ${inputField('Marktpreis "gering"', "marktpreis_g", d.marktpreis_g, "€/m²")}
        ${inputField('Marktpreis "hoch"', "marktpreis_h", d.marktpreis_h, "€/m²")}
      </div>

      <div class="hr"></div>
      <div class="grid grid--2">
        ${inputField("Notar+Grundbuch", "notar_pct", d.notar_pct, "%", {isPct:true})}
        ${inputField("Makler Ankauf", "makler_ankauf_pct", d.makler_ankauf_pct, "%", {isPct:true})}
        ${selectField("Bundesland (GrESt)", "bundesland", d.bundesland || "Nordrhein-Westfalen", STATES, "setzt GrESt automatisch")}
        ${inputField("GrESt", "grest_pct", d.grest_pct, "% (auto)", {isPct:true})}
      </div>

      <div class="hr"></div>
      <div class="grid grid--2">
        ${inputField("Entrümpelung", "entruempelung", d.entruempelung, "EUR")}
        ${inputField("Renovierung", "renovierung", d.renovierung, "EUR")}
        ${inputField("Sicherheitspuffer", "puffer_pct", d.puffer_pct, "%", {isPct:true})}
        ${inputField("Küche", "kueche", d.kueche, "EUR")}
        ${inputField("Sonstiges", "sonstiges", d.sonstiges, "EUR")}
      </div>

      <div class="hr"></div>
      <div class="grid grid--2">
        ${inputField("Projektdauer", "projektdauer_monate", d.projektdauer_monate, "Monate")}
        ${inputField("Finanzierungsquote", "finanzierungsquote", d.finanzierungsquote, "%", {isPct:true})}
        ${inputField("Zins p.a.", "zins_pa", d.zins_pa, "%", {isPct:true})}
        ${inputField("Bearbeitungsgebühr", "bearb_pct", d.bearb_pct, "%", {isPct:true})}
        ${inputField("Provision/Sonst", "fin_sonst_pct", d.fin_sonst_pct, "%", {isPct:true})}
      </div>

      <div class="hr"></div>
      <div class="grid grid--2">
        ${inputField("Hausgeld / Monat", "hausgeld_monat", d.hausgeld_monat, "EUR")}
        ${inputField("Strom+Heizung / Monat", "strom_heizung_monat", d.strom_heizung_monat, "EUR")}
      </div>

      <div class="hr"></div>
      <div class="grid grid--2">
        ${inputField("Verkauf Makler (fix)", "verkauf_makler_fix", d.verkauf_makler_fix, "EUR")}
        ${inputField("Co-Investor Anteil", "coinvestor_pct", d.coinvestor_pct, "% vom VK", {isPct:true})}
        ${inputField("Homestaging (fix)", "homestaging_fix", d.homestaging_fix, "EUR")}
      </div>
    `),

    card("Read-only Auszüge (berechnet)", `
      <div class="miniGrid">
        <div class="mini">
          <div class="mini__label">VK gering</div>
          <div class="mini__value" id="deal_vk_g">${deEUR(c.VK_g)}</div>
        </div>
        <div class="mini">
          <div class="mini__label">VK hoch</div>
          <div class="mini__value" id="deal_vk_h">${deEUR(c.VK_h)}</div>
        </div>
        <div class="mini">
          <div class="mini__label">INV</div>
          <div class="mini__value" id="deal_inv">${deEUR(c.INV)}</div>
        </div>
        <div class="mini">
          <div class="mini__label">Marge (g)</div>
          <div class="mini__value" id="deal_marge_g">${dePct(c.Marge_g)}</div>
        </div>
      </div>

      <div class="hr"></div>
      <div class="btnRow">
        <button class="btn" id="btnDup">Duplizieren</button>
        <button class="btn btn--danger" id="btnDel">Löschen</button>
      </div>
    `),

    card("Deal-Liste", `
      <div class="grid">
        ${deals.map(x=>`
          <button class="btn btn--ghost" data-switch="${x.id}" style="text-align:left">
            <div class="btnTitle">${x.name}</div>
            <div class="btnSub">${x.city || ""}</div>
          </button>
        `).join("")}
      </div>
    `),

    card("Ziel / Hinweis", `
      <div class="hint">
        Ziel: <b>mind. 20% Marge</b> und <b>ca. 50.000 € Gewinn</b> als Orientierungswert.
      </div>
    `)
  ].join("");

  // Delegate input handling
  el.addEventListener("input", onDealTabInput);
  el.addEventListener("change", onDealTabInput);

  // Deal switching
  el.querySelectorAll("button[data-switch]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      setActiveId(btn.dataset.switch);
      dealTabMounted = false;
      renderAll(false);
    });
  });

  $("#btnDup").onclick = ()=> duplicateDeal(d.id);
  $("#btnDel").onclick = ()=> { if (confirm("Deal wirklich löschen?")) deleteDeal(d.id); };

  updateDealSnippet();
}

function onDealTabInput(e){
  const t = e.target;
  if (!t) return;

  // Select (Bundesland)
  if (t.matches("select[data-skey]")) {
    const key = t.dataset.skey;
    if (key === "bundesland") {
      const d = activeDeal();
      if (!d) return;
      d.bundesland = String(t.value || "");
      d.grest_pct = grestForState(d.bundesland); // Auto-set
      persist();

      // Nur berechnete Tabs, kein Deal Re-Render -> Fokus bleibt stabil
      renderComputedOnly();
      updateDealSnippet();
      return;
    }
  }

  // Textfelder
  if (t.matches("input[data-tkey]")) {
    const key = t.dataset.tkey;
    const d = activeDeal();
    if (!d) return;
    d[key] = String(t.value ?? "");
    persist();
    renderComputedOnly();
    updateDealSnippet();
    return;
  }

  // Numeric Felder
  if (t.matches("input[data-key]")) {
    const key = t.dataset.key;
    const isPct = t.dataset.pct === "1";

    applyField(key, t.value, isPct);

    renderComputedOnly();
    updateDealSnippet();
  }
}

function updateDealSnippet(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  const vkG = $("#deal_vk_g");
  const vkH = $("#deal_vk_h");
  const inv = $("#deal_inv");
  const mg  = $("#deal_marge_g");

  if (vkG) vkG.textContent = deEUR(c.VK_g);
  if (vkH) vkH.textContent = deEUR(c.VK_h);
  if (inv) inv.textContent = deEUR(c.INV);
  if (mg)  mg.textContent  = dePct(c.Marge_g);
}

function renderResultsTab(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  $("#results").innerHTML = [
    card("Ergebnisse (Live)", `
      <div class="headerLine">
        <div>
          <div class="titleStrong">${d.name}</div>
          <div class="subtle">${d.city || ""} ${d.bundesland ? "• " + d.bundesland : ""}</div>
        </div>
        <div>${ampBadge(c.Marge_g)}</div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="kpi__label">INV</div><div class="kpi__value">${deEUR(c.INV)}</div></div>
        <div class="kpi"><div class="kpi__label">VK gering</div><div class="kpi__value">${deEUR(c.VK_g)}</div></div>
        <div class="kpi"><div class="kpi__label">Gewinn gering</div><div class="kpi__value">${deEUR(c.Gewinn_g)}</div></div>
        <div class="kpi"><div class="kpi__label">Marge gering</div><div class="kpi__value">${dePct(c.Marge_g)}</div></div>
        <div class="kpi"><div class="kpi__label">VK hoch</div><div class="kpi__value">${deEUR(c.VK_h)}</div></div>
        <div class="kpi"><div class="kpi__label">Gewinn hoch</div><div class="kpi__value">${deEUR(c.Gewinn_h)}</div></div>
        <div class="kpi"><div class="kpi__label">Marge hoch</div><div class="kpi__value">${dePct(c.Marge_h)}</div></div>
      </div>

      <div class="hr"></div>
      ${row("Ankauf gesamt", deEUR(c.AnkaufGesamt))}
      ${row("Reno gesamt", deEUR(c.RenoGesamt))}
      ${row("Finanzierung gesamt", deEUR(c.FinGesamt))}
      ${row("Laufende Kosten", deEUR(c.LaufendeKosten))}
    `)
  ].join("");
}

function renderNegotiationTab(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  const cards = c.negotiation.map((x,i)=>{
    const best = (i === c.bestIdx);
    return `
      <div class="tableCard">
        <div class="headerLine">
          <div class="titleStrong">Rabatt ${dePct(x.r)}</div>
          ${best ? `<span class="badge badge--ok">Beste Marge</span>` : ``}
        </div>
        <div class="hr"></div>
        ${row("Kaufpreis nach Rabatt", deEUR(x.Kaufpreis_r))}
        ${row("INVEST (Verhandlung)", deEUR(x.INVEST_r))}
        <div class="hr"></div>
        ${row("Gewinn gering", deEUR(x.Gewinn_g_r))}
        ${row("Marge gering", dePct(x.Marge_g_r))}
        ${row("Gewinn hoch", deEUR(x.Gewinn_h_r))}
        ${row("Marge hoch", dePct(x.Marge_h_r))}
      </div>
    `;
  }).join("");

  $("#negotiation").innerHTML = [
    card("Verhandlungstabelle (10%–45%)", `<div class="table">${cards}</div>`)
  ].join("");
}

function renderRentTab(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  $("#rent").innerHTML = [
    card("Vermietung – Eingaben", `
      <div class="grid grid--2">
        ${inputField("Pot. Miete", "pot_miete_qm", d.pot_miete_qm, "€/m²")}
        ${inputField("Käufer Zins+Tilg p.a.", "kaeufer_zins_tilg_pa", d.kaeufer_zins_tilg_pa, "%", {isPct:true})}
      </div>
      <div class="subhint">Hinweis: Eingaben wirken live auf die Käuferperspektive.</div>
    `),
    card("Vermietung – Käuferperspektive", `
      <div class="kpis">
        <div class="kpi"><div class="kpi__label">Jahresmiete</div><div class="kpi__value">${deEUR(c.Jahresmiete)}</div></div>
        <div class="kpi"><div class="kpi__label">Brutto-Rendite (VK gering *1,10)</div><div class="kpi__value">${dePct(c.BruttoRendite_g)}</div></div>
        <div class="kpi"><div class="kpi__label">Brutto-Rendite (VK hoch *1,10)</div><div class="kpi__value">${dePct(c.BruttoRendite_h)}</div></div>
        <div class="kpi"><div class="kpi__label">Käufer Rate/Monat (VK gering)</div><div class="kpi__value">${deEUR(c.KaeuferRate_g)}</div></div>
        <div class="kpi"><div class="kpi__label">Käufer Rate/Monat (VK hoch)</div><div class="kpi__value">${deEUR(c.KaeuferRate_h)}</div></div>
      </div>
    `)
  ].join("");

  $("#rent").querySelectorAll("input[data-key]").forEach(inp=>{
    inp.addEventListener("input",(e)=>{
      const key = e.target.dataset.key;
      const isPct = e.target.dataset.pct === "1";
      applyField(key, e.target.value, isPct);
      renderComputedOnly();
      updateDealSnippet();
    });
  });
}

function renderScenariosTab(){
  const compIds = getCompareIds();

  const list = deals.map(d=>{
    const c = compute(d);
    const checked = compIds.includes(d.id);
    return `
      <div class="tableCard">
        <div class="headerLine">
          <div>
            <div class="titleStrong">${d.name}</div>
            <div class="subtle">${d.city || ""} ${d.bundesland ? "• " + d.bundesland : ""}</div>
          </div>
          <label class="chip">
            <input type="checkbox" data-compare="${d.id}" ${checked ? "checked" : ""}/>
            <span>Vergleich</span>
          </label>
        </div>
        <div class="hr"></div>
        ${row("INV", deEUR(c.INV))}
        ${row("Gewinn gering", deEUR(c.Gewinn_g))}
        ${row("Marge gering", `${dePct(c.Marge_g)} ${ampBadge(c.Marge_g)}`)}
        <div class="btnRow">
          <button class="btn" data-activate="${d.id}">Öffnen</button>
          <button class="btn" data-dup="${d.id}">Duplizieren</button>
          <button class="btn btn--danger" data-del="${d.id}">Löschen</button>
        </div>
      </div>
    `;
  }).join("");

  const compareDeals = deals.filter(d=>compIds.includes(d.id)).slice(0,3);
  const compareHtml = compareDeals.length ? `
    <div class="tableCard">
      <div class="titleStrong" style="margin-bottom:8px">Vergleich (bis zu 3)</div>
      <div class="hr"></div>
      ${compareDeals.map(d=>{
        const c = compute(d);
        return `
          <div style="padding:10px 0;border-bottom:1px solid var(--line)">
            <div class="titleStrong">${d.name}</div>
            ${row("INV", deEUR(c.INV))}
            ${row("Gewinn g", deEUR(c.Gewinn_g))}
            ${row("Marge g", dePct(c.Marge_g))}
          </div>
        `;
      }).join("")}
    </div>
  ` : `<div class="tableCard subtle" style="font-weight:700">Wähle 1–3 Deals zum Vergleich (Checkbox).</div>`;

  const exportJson = JSON.stringify(deals, null, 2);

  $("#scenarios").innerHTML = [
    card("Aktionen", `
      <div class="btnRow">
        <button class="btn btn--primary" id="btnCreate2">Neuer Deal</button>
        <button class="btn" id="btnExportPdf">PDF Export</button>
        <button class="btn" id="btnExportCsv">Excel Export (CSV)</button>
        <button class="btn" id="btnExport">Export JSON</button>
        <button class="btn" id="btnImport">Import JSON</button>
      </div>
      <div id="ioArea" style="display:none;margin-top:10px">
        <textarea id="ioText" class="io"></textarea>
        <div class="btnRow" style="margin-top:10px">
          <button class="btn btn--primary" id="btnApplyImport">Import anwenden</button>
          <button class="btn" id="btnCloseIO">Schließen</button>
        </div>
      </div>
    `),
    card("Deals", `<div class="table">${list}</div>`),
    card("Vergleich", compareHtml),
  ].join("");

  $("#btnCreate2").onclick = createDeal;
  $("#btnExportPdf").onclick = ()=> exportPdfForDeal(activeDeal());
  $("#btnExportCsv").onclick = ()=> exportCsvForDeal(activeDeal());

  $("#btnExport").onclick = ()=>{
    $("#ioArea").style.display = "block";
    $("#ioText").value = exportJson;
  };
  $("#btnImport").onclick = ()=>{
    $("#ioArea").style.display = "block";
    $("#ioText").value = "";
    $("#ioText").placeholder = "Hier JSON einfügen und dann „Import anwenden“ klicken.";
  };
  $("#btnCloseIO").onclick = ()=>{ $("#ioArea").style.display = "none"; };

  $("#btnApplyImport").onclick = ()=>{
    try{
      const parsed = JSON.parse($("#ioText").value);
      if (!Array.isArray(parsed)) throw new Error("JSON muss ein Array sein.");
      parsed.forEach(x=>{
        if (!x.id) x.id = uid();
        if (!x.bundesland) x.bundesland = "Nordrhein-Westfalen";
        if (!isFinite(x.grest_pct) || x.grest_pct === 0) x.grest_pct = grestForState(x.bundesland);
      });
      deals = parsed;
      persist();
      setActiveId(deals[0]?.id || defaultDeal().id);
      dealTabMounted = false;
      renderAll(false);
      alert("Import erfolgreich.");
    }catch(e){
      alert("Import fehlgeschlagen: " + e.message);
    }
  };

  $("#scenarios").querySelectorAll("button[data-activate]").forEach(b=>{
    b.onclick = ()=>{
      setActiveId(b.dataset.activate);
      dealTabMounted = false;
      renderAll(false);
    };
  });
  $("#scenarios").querySelectorAll("button[data-dup]").forEach(b=>{
    b.onclick = ()=> duplicateDeal(b.dataset.dup);
  });
  $("#scenarios").querySelectorAll("button[data-del]").forEach(b=>{
    b.onclick = ()=> { if (confirm("Deal wirklich löschen?")) deleteDeal(b.dataset.del); };
  });

  $("#scenarios").querySelectorAll("input[data-compare]").forEach(cb=>{
    cb.onchange = ()=>{
      const ids = new Set(getCompareIds());
      if (cb.checked) ids.add(cb.dataset.compare);
      else ids.delete(cb.dataset.compare);
      setCompareIds(Array.from(ids));
      renderComputedOnly();
    };
  });
}

// ---------- Actions ----------
function createDeal(){
  const d = defaultDeal();
  deals.unshift(d);
  persist();
  setActiveId(d.id);
  dealTabMounted = false;
  renderAll(false);
}
function duplicateDeal(id){
  const src = deals.find(x => x.id === id);
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.createdAt = new Date().toISOString();
  copy.name = `${src.name} (Kopie)`;
  deals.unshift(copy);
  persist();
  setActiveId(copy.id);
  dealTabMounted = false;
  renderAll(false);
}
function deleteDeal(id){
  const idx = deals.findIndex(x => x.id === id);
  if (idx < 0) return;
  deals.splice(idx, 1);
  if (!deals.length) {
    const d = defaultDeal();
    deals = [d];
  }
  persist();
  setActiveId(deals[0].id);
  dealTabMounted = false;
  renderAll(false);
}

// ---------- Render orchestration ----------
function renderAll(scrollTop=false){
  renderDealTab();
  renderResultsTab();
  renderNegotiationTab();
  renderRentTab();
  renderScenariosTab();
  if (scrollTop) window.scrollTo({top:0,behavior:"smooth"});
}
function renderComputedOnly(){
  renderResultsTab();
  renderNegotiationTab();
  renderRentTab();
  renderScenariosTab();
}

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("tab--active"));
    btn.classList.add("tab--active");

    const t = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("panel--active"));
    document.getElementById(t).classList.add("panel--active");
  });
});

// Global button (falls vorhanden)
const btnNew = $("#btnNewDeal");
if (btnNew) btnNew.onclick = createDeal;

// Initial render
renderAll(false);

// PWA SW
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}
