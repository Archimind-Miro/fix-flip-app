/*
README (Kurz)
- Diese App ist eine statische PWA (keine Build-Tools).
- Speicherung: localStorage (Deals & Einstellungen).
- Hosting kostenlos über GitHub Pages.
- Installation am Handy:
  Android/Chrome: Menü → „Zum Startbildschirm hinzufügen“
  iOS/Safari: Teilen → „Zum Home-Bildschirm“
*/

const LS_KEY = "ff_deals_v1";
const LS_ACTIVE = "ff_active_deal_v1";
const LS_COMPARE = "ff_compare_v1";

const DISCOUNTS = [0.10,0.15,0.20,0.25,0.30,0.35,0.40,0.45];

function deEUR(n){ return new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(n); }
function deNum(n){ return new Intl.NumberFormat("de-DE").format(n); }
function dePct(n){
  if (!isFinite(n)) return "–";
  return new Intl.NumberFormat("de-DE",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
}
function clamp0(x){
  const v = Number(String(x).replace(",", "."));
  return isFinite(v) ? Math.max(0, v) : 0;
}
function uid(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }

function defaultDeal(){
  return {
    id: uid(),
    name: "Dortmund Kurl – 66m²",
    city: "Dortmund-Kurl",
    createdAt: new Date().toISOString(),

    kaufpreis: 95000,
    wohnflaeche: 66,
    marktpreis_g: 2700,
    marktpreis_h: 2800,

    notar_pct: 0.015,
    makler_ankauf_pct: 0.036,
    grest_pct: 0.065,

    entruempelung: 2000,
    renovierung: 32000,
    puffer_pct: 0.10,
    kueche: 5000,
    sonstiges: 0,

    projektdauer_monate: 8,
    finanzierungsquote: 1.0,
    zins_pa: 0.055,
    bearb_pct: 0.01,
    fin_sonst_pct: 0,

    hausgeld_monat: 250,
    strom_heizung_monat: 140,

    verkauf_makler_fix: 0,
    coinvestor_pct: 0,
    homestaging_fix: 0,

    pot_miete_qm: 13,
    kaeufer_zins_tilg_pa: 0.054,
  };
}

function loadDeals(){
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) {
    const d1 = defaultDeal();
    const d2 = defaultDeal();
    d2.id = uid();
    d2.name = "Szenario – höherer VK & mehr Renovierung";
    d2.marktpreis_g = 2850;
    d2.marktpreis_h = 3000;
    d2.renovierung = 38000;
    const arr = [d1, d2];
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
    localStorage.setItem(LS_ACTIVE, d1.id);
    return arr;
  }
  try { return JSON.parse(raw) || []; } catch { return []; }
}

function saveDeals(deals){
  localStorage.setItem(LS_KEY, JSON.stringify(deals));
}

function getActiveId(){
  return localStorage.getItem(LS_ACTIVE);
}
function setActiveId(id){
  localStorage.setItem(LS_ACTIVE, id);
}

function getCompareIds(){
  try { return JSON.parse(localStorage.getItem(LS_COMPARE) || "[]"); } catch { return []; }
}
function setCompareIds(ids){
  localStorage.setItem(LS_COMPARE, JSON.stringify(ids.slice(0,3)));
}

// --- Excel-Logik (nach deinem Template) ---
function compute(deal){
  // Inputs
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

  // Gewinn / Marge (Basisblock)
  const Gewinn_g = VK_g - INV - (coinvestor_pct * VK_g) - homestaging_fix - verkauf_makler_fix;
  const Gewinn_h = VK_h - INV - (coinvestor_pct * VK_h) - homestaging_fix - verkauf_makler_fix;

  // Marge-Formel aus Excel (inkl. coinvestor_pct als additiver Term wie im Template; bewusst 1:1)
  const baseDen = (INV + verkauf_makler_fix + coinvestor_pct + homestaging_fix);
  const Marge_g = baseDen > 0 ? (VK_g - baseDen) / baseDen : NaN;
  const Marge_h = baseDen > 0 ? (VK_h - baseDen) / baseDen : NaN;

  // Vermietung
  const Jahresmiete = pot_miete_qm * wf * 12;
  const BruttoRendite_g = (VK_g > 0) ? Jahresmiete / (VK_g * 1.10) : NaN;
  const BruttoRendite_h = (VK_h > 0) ? Jahresmiete / (VK_h * 1.10) : NaN;
  const KaeuferRate_g = (VK_g * kaeufer_zins_tilg_pa) / 12;
  const KaeuferRate_h = (VK_h * kaeufer_zins_tilg_pa) / 12;

  // Verhandlungstabelle (Excel-Sonderlogik)
  const negotiation = DISCOUNTS.map(r => {
    const Kaufpreis_r = kaufpreis * (1 - r);

    // INVEST_r rechnet Finanzierung auf Kaufpreis_r (nicht Finanzbetrag)
    const INVEST_r =
      (Kaufpreis_r + ((grest_pct + makler_pct + notar_pct) * Kaufpreis_r))
      + ((fin_sonst_pct * Kaufpreis_r) + (bearb_pct * Kaufpreis_r) + ((zins_pa * Kaufpreis_r / 12) * monate))
      + RenoGesamt
      + (MonatlicheKosten * monate);

    // Gewinn_g_r ohne Verkaufsmakler_fix (Excel E32)
    const Gewinn_g_r = VK_g - INVEST_r - (coinvestor_pct * VK_g) - homestaging_fix;

    // Marge_g_r (Excel G32)
    const den_r = (INVEST_r + verkauf_makler_fix + coinvestor_pct + homestaging_fix);
    const Marge_g_r = den_r > 0 ? (VK_g - den_r) / den_r : NaN;

    // Gewinn_h_r nutzt coinvestor_pct * VK_g (Excel L32)
    const Gewinn_h_r = VK_h - INVEST_r - (coinvestor_pct * VK_g) - homestaging_fix;

    // Marge_h_r (Excel N32)
    const Marge_h_r = den_r > 0 ? (VK_h - den_r) / den_r : NaN;

    return { r, Kaufpreis_r, INVEST_r, Gewinn_g_r, Marge_g_r, Gewinn_h_r, Marge_h_r };
  });

  // Beste Marge markieren
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

// --- UI ---
const $ = (sel) => document.querySelector(sel);

let deals = loadDeals();
let activeId = getActiveId() || (deals[0]?.id);
if (!activeId && deals[0]) activeId = deals[0].id;
if (activeId) setActiveId(activeId);

function activeDeal(){
  return deals.find(d => d.id === getActiveId()) || deals[0];
}

function setField(key, value){
  const d = activeDeal();
  if (!d) return;
  // Prozentfelder: erlauben Eingabe in % (z.B. 1,5) ODER als Dezimal (0,015)
  const pctFields = new Set(["notar_pct","makler_ankauf_pct","grest_pct","puffer_pct","finanzierungsquote","zins_pa","bearb_pct","fin_sonst_pct","coinvestor_pct","kaeufer_zins_tilg_pa"]);
  let v = String(value).trim();
  let num = clamp0(v);

  if (pctFields.has(key)) {
    // Heuristik: wenn user 1.5 eingibt -> 0.015; wenn 0.015 eingibt -> 0.015
    if (num > 1) num = num / 100;
  }

  d[key] = num;
  saveDeals(deals);
  renderAll();
}

function setTextField(key, value){
  const d = activeDeal();
  if (!d) return;
  d[key] = String(value);
  saveDeals(deals);
  renderAll(false);
}

function createDeal(){
  const d = defaultDeal();
  d.name = "Neuer Deal";
  deals.unshift(d);
  saveDeals(deals);
  setActiveId(d.id);
  renderAll();
}

function duplicateDeal(id){
  const src = deals.find(d=>d.id===id);
  if (!src) return;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.createdAt = new Date().toISOString();
  copy.name = `${src.name} (Kopie)`;
  deals.unshift(copy);
  saveDeals(deals);
  setActiveId(copy.id);
  renderAll();
}

function deleteDeal(id){
  const idx = deals.findIndex(d=>d.id===id);
  if (idx < 0) return;
  deals.splice(idx,1);
  if (deals[0]) setActiveId(deals[0].id);
  saveDeals(deals);
  renderAll();
}

function ampBadge(marge){
  if (!isFinite(marge)) return `<span class="badge">–</span>`;
  if (marge > 0.20) return `<span class="badge badge--ok">OK</span>`;
  if (marge >= 0.10) return `<span class="badge badge--warn">Grenze</span>`;
  return `<span class="badge badge--bad">No-Go</span>`;
}

function card(title, inner){
  return `<div class="card"><div class="card__title">${title}</div>${inner}</div>`;
}
function field(label, key, value, hint){
  return `
    <div class="field">
      <label>
        <span>${label}</span>
        <small>${hint || ""}</small>
      </label>
      <input type="number" inputmode="decimal" value="${value}" data-key="${key}" />
    </div>`;
}
function textField(label, key, value, hint){
  return `
    <div class="field">
      <label>
        <span>${label}</span>
        <small>${hint || ""}</small>
      </label>
      <input type="text" value="${value || ""}" data-tkey="${key}" />
    </div>`;
}

function renderDealTab(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  const el = $("#deal");
  el.innerHTML = [
    card("Deal auswählen", `
      <div class="grid grid--2">
        ${textField("Name", "name", d.name)}
        ${textField("Stadt/Ort", "city", d.city)}
      </div>
      <div class="hr"></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" id="btnDup">Duplizieren</button>
        <button class="btn btn--danger" id="btnDel">Löschen</button>
      </div>
      <div class="hr"></div>
      <div class="grid">
        ${deals.map(x=>`
          <button class="btn" data-switch="${x.id}" style="text-align:left">
            <div style="font-weight:950">${x.name}</div>
            <div style="color:var(--muted);font-size:12px">${x.city || ""}</div>
          </button>
        `).join("")}
      </div>
    `),

    card("Objekt & Markt", `
      <div class="grid grid--2">
        ${field("Kaufpreis", "kaufpreis", d.kaufpreis, "EUR")}
        ${field("Wohnfläche", "wohnflaeche", d.wohnflaeche, "m²")}
        ${field('Marktpreis "gering"', "marktpreis_g", d.marktpreis_g, "€/m²")}
        ${field('Marktpreis "hoch"', "marktpreis_h", d.marktpreis_h, "€/m²")}
      </div>
      <div class="hr"></div>
      <div class="row"><div class="l">VK gering</div><div class="r">${deEUR(c.VK_g)}</div></div>
      <div class="row"><div class="l">VK hoch</div><div class="r">${deEUR(c.VK_h)}</div></div>
    `),

    card("Ankauf-Nebenkosten (Eingabe als % oder Dezimal)", `
      <div class="grid grid--2">
        ${field("Notar + Grundbuch", "notar_pct", d.notar_pct*100, "%")}
        ${field("Makler Ankauf", "makler_ankauf_pct", d.makler_ankauf_pct*100, "%")}
        ${field("GrESt", "grest_pct", d.grest_pct*100, "%")}
      </div>
      <div class="hr"></div>
      <div class="row"><div class="l">Ankauf gesamt</div><div class="r">${deEUR(c.AnkaufGesamt)}</div></div>
    `),

    card("Renovierung", `
      <div class="grid grid--2">
        ${field("Entrümpelung", "entruempelung", d.entruempelung, "EUR")}
        ${field("Renovierung", "renovierung", d.renovierung, "EUR")}
        ${field("Sicherheitspuffer", "puffer_pct", d.puffer_pct*100, "%")}
        ${field("Küche", "kueche", d.kueche, "EUR")}
        ${field("Sonstiges", "sonstiges", d.sonstiges, "EUR")}
      </div>
      <div class="hr"></div>
      <div class="row"><div class="l">Reno gesamt</div><div class="r">${deEUR(c.RenoGesamt)}</div></div>
    `),

    card("Finanzierung", `
      <div class="grid grid--2">
        ${field("Projektdauer", "projektdauer_monate", d.projektdauer_monate, "Monate")}
        ${field("Finanzierungsquote", "finanzierungsquote", d.finanzierungsquote*100, "%")}
        ${field("Zins p.a.", "zins_pa", d.zins_pa*100, "%")}
        ${field("Bearbeitungsgebühr", "bearb_pct", d.bearb_pct*100, "%")}
        ${field("Provision/Sonst", "fin_sonst_pct", d.fin_sonst_pct*100, "%")}
      </div>
      <div class="hr"></div>
      <div class="row"><div class="l">Finanzierung gesamt</div><div class="r">${deEUR(c.FinGesamt)}</div></div>
    `),

    card("Laufende Kosten & Verkauf", `
      <div class="grid grid--2">
        ${field("Hausgeld / Monat", "hausgeld_monat", d.hausgeld_monat, "EUR")}
        ${field("Strom+Heizung / Monat", "strom_heizung_monat", d.strom_heizung_monat, "EUR")}
        ${field("Verkauf Makler (fix)", "verkauf_makler_fix", d.verkauf_makler_fix, "EUR")}
        ${field("Co-Investor Anteil", "coinvestor_pct", d.coinvestor_pct*100, "% vom VK")}
        ${field("Homestaging (fix)", "homestaging_fix", d.homestaging_fix, "EUR")}
      </div>
      <div class="hr"></div>
      <div class="row"><div class="l">INV (Gesamtinvest)</div><div class="r">${deEUR(c.INV)}</div></div>
    `),

    card("Ziel / Hinweis", `
      <div style="color:var(--muted);font-weight:700;line-height:1.45">
        Ziel (aus deinem Template): <b>mind. 20% Marge</b> und <b>ca. 50.000 € Gewinn</b> als Orientierungswert.
      </div>
    `),
  ].join("");

  // Events
  el.querySelectorAll("input[data-key]").forEach(inp=>{
    inp.addEventListener("input", (e)=> setField(e.target.dataset.key, e.target.value));
  });
  el.querySelectorAll("input[data-tkey]").forEach(inp=>{
    inp.addEventListener("input", (e)=> setTextField(e.target.dataset.tkey, e.target.value));
  });
  el.querySelectorAll("button[data-switch]").forEach(btn=>{
    btn.addEventListener("click", ()=>{ setActiveId(btn.dataset.switch); renderAll(); });
  });

  $("#btnDup").onclick = ()=> duplicateDeal(d.id);
  $("#btnDel").onclick = ()=> {
    if (confirm("Deal wirklich löschen?")) deleteDeal(d.id);
  };
}

function renderResultsTab(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  $("#results").innerHTML = [
    card("KPI Übersicht", `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px">
        <div style="font-weight:950">${d.name}</div>
        ${ampBadge(c.Marge_g)}
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
      <div class="row"><div class="l">Ankauf gesamt</div><div class="r">${deEUR(c.AnkaufGesamt)}</div></div>
      <div class="row"><div class="l">Reno gesamt</div><div class="r">${deEUR(c.RenoGesamt)}</div></div>
      <div class="row"><div class="l">Finanzierung gesamt</div><div class="r">${deEUR(c.FinGesamt)}</div></div>
      <div class="row"><div class="l">Laufende Kosten</div><div class="r">${deEUR(c.LaufendeKosten)}</div></div>
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
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="font-weight:950">Rabatt ${dePct(x.r)}</div>
          ${best ? `<span class="badge badge--ok">Beste Marge</span>` : ``}
        </div>
        <div class="hr"></div>
        <div class="row"><div class="l">Kaufpreis nach Rabatt</div><div class="r">${deEUR(x.Kaufpreis_r)}</div></div>
        <div class="row"><div class="l">INVEST (Excel-Verhandlung)</div><div class="r">${deEUR(x.INVEST_r)}</div></div>
        <div class="hr"></div>
        <div class="row"><div class="l">Gewinn gering</div><div class="r">${deEUR(x.Gewinn_g_r)}</div></div>
        <div class="row"><div class="l">Marge gering</div><div class="r">${dePct(x.Marge_g_r)}</div></div>
        <div class="row"><div class="l">Gewinn hoch</div><div class="r">${deEUR(x.Gewinn_h_r)}</div></div>
        <div class="row"><div class="l">Marge hoch</div><div class="r">${dePct(x.Marge_h_r)}</div></div>
        <div style="color:var(--muted);font-size:12px;margin-top:8px">
          Hinweis: Gewinn-Formeln entsprechen der Excel-Verhandlungstabelle (inkl. Sonderlogik).
        </div>
      </div>
    `;
  }).join("");

  $("#negotiation").innerHTML = [
    card("Verhandlungstabelle (10%–45%)", `
      <div class="table">${cards}</div>
    `)
  ].join("");
}

function renderRentTab(){
  const d = activeDeal();
  if (!d) return;
  const c = compute(d);

  $("#rent").innerHTML = [
    card("Eingaben Vermietung", `
      <div class="grid grid--2">
        ${field("Pot. Miete", "pot_miete_qm", d.pot_miete_qm, "€/m²")}
        ${field("Käufer Zins+Tilg p.a.", "kaeufer_zins_tilg_pa", d.kaeufer_zins_tilg_pa*100, "%")}
      </div>
    `),
    card("Käuferperspektive", `
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
    inp.addEventListener("input", (e)=> setField(e.target.dataset.key, e.target.value));
  });
}

function renderScenariosTab(){
  const act = activeDeal();
  const compIds = getCompareIds();

  const list = deals.map(d=>{
    const c = compute(d);
    const checked = compIds.includes(d.id);
    return `
      <div class="tableCard">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div>
            <div style="font-weight:950">${d.name}</div>
            <div style="color:var(--muted);font-size:12px">${d.city || ""}</div>
          </div>
          <label class="badge">
            <input type="checkbox" data-compare="${d.id}" ${checked ? "checked" : ""}/>
            <span>Vergleich</span>
          </label>
        </div>
        <div class="hr"></div>
        <div class="row"><div class="l">INV</div><div class="r">${deEUR(c.INV)}</div></div>
        <div class="row"><div class="l">Gewinn gering</div><div class="r">${deEUR(c.Gewinn_g)}</div></div>
        <div class="row"><div class="l">Marge gering</div><div class="r">${dePct(c.Marge_g)} ${ampBadge(c.Marge_g)}</div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          <button class="btn" data-activate="${d.id}">Öffnen</button>
          <button class="btn" data-dup="${d.id}">Duplizieren</button>
        </div>
      </div>
    `;
  }).join("");

  const compareDeals = deals.filter(d=>compIds.includes(d.id)).slice(0,3);
  const compareHtml = compareDeals.length ? `
    <div class="tableCard">
      <div style="font-weight:950;margin-bottom:8px">Vergleich (bis zu 3)</div>
      <div class="hr"></div>
      ${compareDeals.map(d=>{
        const c = compute(d);
        return `
          <div style="padding:10px 0;border-bottom:1px solid var(--line)">
            <div style="font-weight:950">${d.name}</div>
            <div class="row"><div class="l">INV</div><div class="r">${deEUR(c.INV)}</div></div>
            <div class="row"><div class="l">Gewinn g</div><div class="r">${deEUR(c.Gewinn_g)}</div></div>
            <div class="row"><div class="l">Marge g</div><div class="r">${dePct(c.Marge_g)}</div></div>
          </div>
        `;
      }).join("")}
    </div>
  ` : `<div class="tableCard" style="color:var(--muted);font-weight:700">Wähle 1–3 Deals zum Vergleich (Checkbox).</div>`;

  const exportJson = JSON.stringify(deals, null, 2);

  $("#scenarios").innerHTML = [
    card("Aktionen", `
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn--primary" id="btnCreate2">Neuer Deal</button>
        <button class="btn" id="btnExport">Export JSON (anzeigen)</button>
        <button class="btn" id="btnImport">Import JSON (einfügen)</button>
      </div>
      <div id="ioArea" style="display:none;margin-top:10px">
        <textarea id="ioText" style="width:100%;min-height:160px;padding:12px;border-radius:14px;border:1px solid var(--line);font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;"></textarea>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn--primary" id="btnApplyImport">Import anwenden</button>
          <button class="btn" id="btnCloseIO">Schließen</button>
        </div>
      </div>
    `),
    card("Deals", `<div class="table">${list}</div>`),
    card("Vergleich", compareHtml),
  ].join("");

  $("#btnCreate2").onclick = createDeal;

  $("#btnExport").onclick = ()=>{
    $("#ioArea").style.display = "block";
    $("#ioText").value = exportJson;
  };

  $("#btnImport").onclick = ()=>{
    $("#ioArea").style.display = "block";
    $("#ioText").value = "";
    $("#ioText").placeholder = "Hier JSON einfügen und dann „Import anwenden“ klicken.";
  };

  $("#btnCloseIO").onclick = ()=>{
    $("#ioArea").style.display = "none";
  };

  $("#btnApplyImport").onclick = ()=>{
    try{
      const parsed = JSON.parse($("#ioText").value);
      if (!Array.isArray(parsed)) throw new Error("JSON muss ein Array sein.");
      // Basic sanitize: ensure id
      parsed.forEach(x=>{ if (!x.id) x.id = uid(); });
      deals = parsed;
      saveDeals(deals);
      if (deals[0]) setActiveId(deals[0].id);
      renderAll();
      alert("Import erfolgreich.");
    }catch(e){
      alert("Import fehlgeschlagen: " + e.message);
    }
  };

  $("#scenarios").querySelectorAll("button[data-activate]").forEach(b=>{
    b.onclick = ()=>{ setActiveId(b.dataset.activate); renderAll(); };
  });
  $("#scenarios").querySelectorAll("button[data-dup]").forEach(b=>{
    b.onclick = ()=> duplicateDeal(b.dataset.dup);
  });
  $("#scenarios").querySelectorAll("input[data-compare]").forEach(cb=>{
    cb.onchange = ()=>{
      const ids = new Set(getCompareIds());
      if (cb.checked) ids.add(cb.dataset.compare);
      else ids.delete(cb.dataset.compare);
      setCompareIds(Array.from(ids));
      renderAll(false);
    };
  });
}

function renderAll(scrollTop=true){
  // refresh deals from storage (safe)
  deals = loadDeals();
  renderDealTab();
  renderResultsTab();
  renderNegotiationTab();
  renderRentTab();
  renderScenariosTab();
  if (scrollTop) window.scrollTo({top:0,behavior:"smooth"});
}

// Tabs
document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".tab").forEach(b=>b.classList.remove("tab--active"));
    btn.classList.add("tab--active");

    const t = btn.dataset.tab;
    document.querySelectorAll(".panel").forEach(p=>p.classList.remove("panel--active"));
    document.getElementById(t).classList.add("panel--active");
  });
});

// Global Buttons
$("#btnNewDeal").onclick = createDeal;

renderAll();

// PWA Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  });
}
