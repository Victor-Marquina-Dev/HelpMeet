const $ = (id) => document.getElementById(id);
let recording = false;
let live = false;
let transTimer = null;
let activeInitiativeId = null;

function setStatus(text) {
  $("status").textContent = text || "";
}

function clearTranscript() {
  $("transcript").innerHTML = "";
}

// Tras exportar: abre la carpeta del resultado en el Explorador.
async function openExport(result, emptyMsg) {
  if (result && result.path) {
    setStatus("✓ Exportado · abriendo carpeta…");
    await window.pywebview.api.open_path(result.path);
    setTimeout(() => setStatus(""), 2500);
  } else {
    alert(emptyMsg || "Nada que exportar todavía.");
  }
}

/* ---------- Sidebar ---------- */
async function loadSidebar() {
  const list = await window.pywebview.api.list_initiatives();
  const cont = $("iniList");
  cont.innerHTML = "";
  for (const ini of list) {
    const box = document.createElement("div");
    box.className = "ini";

    const row = document.createElement("div");
    row.className = "ini-row";
    row.dataset.id = ini.id;
    const arrow = document.createElement("span");
    arrow.className = "arrow";
    arrow.textContent = "▸";
    const name = document.createElement("span");
    name.className = "ini-name";
    name.textContent = ini.name;
    row.append(arrow, name);

    const meetList = document.createElement("div");
    meetList.className = "meet-list";

    row.onclick = () => onInitiativeClick(box, row, arrow, meetList, ini.id);
    row.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, [
        { label: "📖 Ver glosario", onClick: () => showGlossary(ini.id, ini.name) },
        { label: "✏️ Renombrar iniciativa", onClick: () => renameInitiative(ini.id, ini.name) },
        { label: "⬆ Exportar iniciativa a otra carpeta…", onClick: () => exportInitiativeTo(ini.id) },
      ]);
    };
    box.append(row, meetList);
    cont.appendChild(box);
  }
}

async function onInitiativeClick(box, row, arrow, meetList, iniId) {
  // marcar como activa (para grabar)
  document.querySelectorAll(".ini-row.active").forEach((r) => r.classList.remove("active"));
  row.classList.add("active");
  activeInitiativeId = iniId;
  $("btnExp").disabled = false;  // ya se puede abrir la carpeta de esta iniciativa

  // expandir / colapsar reuniones
  const isOpen = box.classList.toggle("open");
  arrow.textContent = isOpen ? "▾" : "▸";
  if (isOpen) {
    const meetings = await window.pywebview.api.list_meetings(iniId);
    meetList.innerHTML = "";

    // Botón para exportar TODA la iniciativa (todas sus reuniones juntas).
    if (meetings.length > 0) {
      const expBtn = document.createElement("button");
      expBtn.className = "exp-ini";
      expBtn.textContent = "⬆ Exportar iniciativa completa";
      expBtn.onclick = async (e) => {
        e.stopPropagation();
        const r = await window.pywebview.api.export_initiative_by_id(iniId);
        await openExport(r, "No se pudo exportar.");
      };
      meetList.appendChild(expBtn);
    }

    if (meetings.length === 0) {
      const none = document.createElement("div");
      none.className = "meet";
      none.textContent = "(sin reuniones aún)";
      meetList.appendChild(none);
    }
    for (const m of meetings) {
      const item = document.createElement("div");
      item.className = "meet";
      item.dataset.mid = m.id;
      const mt = document.createElement("div");
      mt.className = "meet-title";
      mt.textContent = m.title;
      const mm = document.createElement("div");
      mm.className = "meet-meta";
      mm.textContent = m.date;
      item.append(mt, mm);
      item.onclick = (e) => { e.stopPropagation(); openMeeting(m.id, item); };
      item.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        showContextMenu(e.clientX, e.clientY, [
          { label: "✏️ Renombrar reunión", onClick: () => renameMeeting(m.id, m.title) },
          { label: "📁 Mover a otra iniciativa", onClick: () => moveMeeting(m.id) },
          { label: "⬆ Exportar a otra carpeta…", onClick: () => exportMeetingTo(m.id) },
        ]);
      };
      meetList.appendChild(item);
    }
  }
}

async function refreshActiveMeetings() {
  const row = document.querySelector(`.ini-row.active`);
  if (!row) return;
  const box = row.parentElement;
  if (!box.classList.contains("open")) return;
  const arrow = row.querySelector(".arrow");
  const meetList = box.querySelector(".meet-list");
  box.classList.remove("open");
  await onInitiativeClick(box, row, arrow, meetList, activeInitiativeId);
}

/* ---------- Menú contextual (clic derecho) ---------- */
function showContextMenu(x, y, items) {
  const menu = $("ctxmenu");
  menu.innerHTML = "";
  for (const it of items) {
    const b = document.createElement("button");
    b.textContent = it.label;
    b.onclick = () => { hideContextMenu(); it.onClick(); };
    menu.appendChild(b);
  }
  menu.classList.remove("hidden");
  // ajustar para que no se salga de la ventana
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - w - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - h - 8) + "px";
}
function hideContextMenu() { $("ctxmenu").classList.add("hidden"); }
document.addEventListener("click", hideContextMenu);
window.addEventListener("blur", hideContextMenu);

/* ---------- Renombrar / mover ---------- */
async function renameInitiative(id, currentName) {
  const nuevo = prompt("Nuevo nombre de la iniciativa:", currentName);
  if (nuevo && nuevo.trim()) {
    await window.pywebview.api.rename_initiative(id, nuevo.trim());
    await loadSidebar();
  }
}

async function renameMeeting(id, currentTitle) {
  const nuevo = prompt("Nuevo nombre de la reunión:", currentTitle);
  if (nuevo && nuevo.trim()) {
    await window.pywebview.api.rename_meeting(id, nuevo.trim());
    await loadSidebar();
    openMeeting(id, null);
  }
}

async function showGlossary(iniId, iniName) {
  const glos = await window.pywebview.api.get_glossary(iniId);
  clearTranscript();
  const head = document.createElement("div");
  head.className = "meeting-header";
  const h = document.createElement("h2");
  h.textContent = `📖 Glosario — ${iniName}`;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = "Términos más frecuentes del proyecto (con nº de apariciones)";
  head.append(h, meta);
  $("transcript").appendChild(head);

  if (glos.length === 0) {
    const none = document.createElement("div");
    none.className = "empty";
    none.innerHTML = "<p>Aún no hay términos repetidos. Graba más reuniones.</p>";
    $("transcript").appendChild(none);
    return;
  }
  const wrap = document.createElement("div");
  wrap.className = "glossary";
  for (const g of glos) {
    const chip = document.createElement("span");
    chip.className = "term-chip";
    chip.innerHTML = `${g.term} <b>${g.count}</b>`;
    wrap.appendChild(chip);
  }
  $("transcript").appendChild(wrap);
}

async function exportMeetingTo(mid) {
  const r = await window.pywebview.api.export_meeting_to(mid);
  if (r.ok) {
    setStatus("✓ Exportado · abriendo carpeta…");
    setTimeout(() => setStatus(""), 2500);
  }
}

async function exportInitiativeTo(id) {
  const r = await window.pywebview.api.export_initiative_to(id);
  if (r.ok) {
    setStatus("✓ Iniciativa exportada · abriendo carpeta…");
    setTimeout(() => setStatus(""), 2500);
  }
}

async function moveMeeting(mid) {
  const inis = await window.pywebview.api.list_initiatives();
  let msg = "¿A qué iniciativa mover la reunión? Escribe el número:\n\n";
  inis.forEach((i, idx) => { msg += `${idx + 1}. ${i.name}\n`; });
  msg += "\n0. (Crear una iniciativa nueva)";
  const ans = prompt(msg);
  if (ans === null) return;
  const n = parseInt(ans.trim(), 10);
  let targetId = null;
  if (n === 0) {
    const nombre = prompt("Nombre de la nueva iniciativa:");
    if (!nombre || !nombre.trim()) return;
    const creada = await window.pywebview.api.create_initiative(nombre.trim());
    targetId = creada.id;
  } else if (n >= 1 && n <= inis.length) {
    targetId = inis[n - 1].id;
  } else {
    return;
  }
  await window.pywebview.api.move_meeting(mid, targetId);
  await loadSidebar();
  alert("✓ Reunión movida.");
}

async function openMeeting(mid, el) {
  document.querySelectorAll(".meet.active").forEach((m) => m.classList.remove("active"));
  if (el) el.classList.add("active");
  const data = await window.pywebview.api.get_transcript(mid);
  clearTranscript();
  addMeetingHeader(data.title, data.started_at, mid);
  for (const u of data.utterances) addUtterance(u.speaker, u.text);
}

/* ---------- Búsqueda global ---------- */
async function runSearch() {
  const q = $("search").value.trim();
  if (!q) return;
  const results = await window.pywebview.api.search(q);
  renderSearchResults(q, results);
}

function renderSearchResults(q, results) {
  clearTranscript();
  const head = document.createElement("div");
  head.className = "meeting-header";
  const h = document.createElement("h2");
  h.textContent = `🔎 Resultados de “${q}” (${results.length})`;
  head.appendChild(h);
  $("transcript").appendChild(head);

  if (results.length === 0) {
    const none = document.createElement("div");
    none.className = "empty";
    none.innerHTML = "<p>Sin resultados.</p>";
    $("transcript").appendChild(none);
    return;
  }
  for (const r of results) {
    const card = document.createElement("div");
    card.className = "search-result";
    const meta = document.createElement("div");
    meta.className = "sr-meta";
    const tag = r.kind === "nota" ? "📝 nota" : "💬 frase";
    meta.textContent = `${tag} · ${r.initiative} · ${r.meeting_title} · ${r.date}`;
    const txt = document.createElement("div");
    txt.className = "sr-text";
    txt.textContent = r.text;
    card.append(meta, txt);
    card.onclick = () => openMeeting(r.meeting_id, null);
    $("transcript").appendChild(card);
  }
}

/* ---------- Monitors ---------- */
async function refreshMonitors() {
  const list = await window.pywebview.api.list_monitors();
  $("monitor").innerHTML = list
    .map((m) => `<option value="${m.index}">Pantalla ${m.index} (${m.width}×${m.height})</option>`)
    .join("");
}

/* ---------- Transcript rendering ---------- */
function addUtterance(speaker, text) {
  const div = document.createElement("div");
  div.className = "row " + speaker;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = speaker === "me" ? "Yo" : "Los demás";
  const txt = document.createElement("span");
  txt.className = "txt";
  txt.textContent = text;
  div.append(who, txt);
  $("transcript").appendChild(div);
  window.scrollTo(0, document.body.scrollHeight);
}

function addCaptureMark() {
  const wrap = document.createElement("div");
  const mark = document.createElement("span");
  mark.className = "cap-mark";
  mark.textContent = "📷 Captura tomada";
  wrap.appendChild(mark);
  $("transcript").appendChild(wrap);
  window.scrollTo(0, document.body.scrollHeight);
}

function addNoteMark(text) {
  const wrap = document.createElement("div");
  const mark = document.createElement("span");
  mark.className = "note-mark";
  mark.textContent = "📝 " + text;
  wrap.appendChild(mark);
  $("transcript").appendChild(wrap);
  window.scrollTo(0, document.body.scrollHeight);
}

function addMeetingHeader(title, startedAt, meetingId) {
  const h = document.createElement("div");
  h.className = "meeting-header";
  const t = document.createElement("h2");
  t.textContent = title;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = "Inicio: " + startedAt;
  if (meetingId) {
    const btn = document.createElement("button");
    btn.className = "reexport";
    btn.textContent = "⬆ Re-exportar";
    btn.onclick = async () => {
      const e = await window.pywebview.api.export_meeting_by_id(meetingId);
      await openExport(e, "No se pudo exportar.");
    };
    const btnOpen = document.createElement("button");
    btnOpen.className = "openfolder";
    btnOpen.textContent = "📂 Abrir en explorador";
    btnOpen.onclick = async () => {
      setStatus("📂 Abriendo carpeta…");
      await window.pywebview.api.open_meeting_folder(meetingId);
      setTimeout(() => setStatus(""), 2000);
    };
    t.append(btn, btnOpen);
  }
  h.append(t, meta);
  $("transcript").appendChild(h);
}

function addMeetingFooter(duration) {
  const f = document.createElement("div");
  f.className = "meeting-footer";
  f.textContent = duration
    ? `■ Reunión finalizada · duración: ${duration}`
    : "■ Reunión finalizada";
  $("transcript").appendChild(f);
  window.scrollTo(0, document.body.scrollHeight);
}

/* ---------- Recording ---------- */
function showProgress(on) {
  $("progress").classList.toggle("hidden", !on);
}

async function stopRecording() {
  let secs = 0;
  showProgress(true);
  setStatus("⏳ Transcribiendo en la nube… 0s");
  transTimer = setInterval(() => {
    secs++;
    const extra = secs > 40 ? " (si el servidor estaba dormido, tarda más)" : "";
    setStatus(`⏳ Transcribiendo en la nube… ${secs}s${extra}`);
  }, 1000);

  const r = await window.pywebview.api.stop_recording();

  clearInterval(transTimer);
  showProgress(false);
  recording = false;
  $("btnRec").textContent = "● Grabar";
  $("btnCap").disabled = true;
  $("btnNote").disabled = true;
  if (!live && r?.utterances) {
    for (const u of r.utterances) addUtterance(u.speaker, u.text);
  }
  setStatus("");
  addMeetingFooter(r?.duration);
  refreshActiveMeetings();
}

/* ---------- Events ---------- */
window.addEventListener("pywebviewready", () => {
  loadSidebar();
  refreshMonitors();
});

$("toggleSidebar").onclick = () => document.body.classList.toggle("collapsed");

/* ---------- Ajustes ---------- */
async function openSettings() {
  const s = await window.pywebview.api.get_settings();
  $("exportDir").value = s.export_dir;
  $("apiToken").value = "";
  $("tokenStatus").textContent = s.has_token
    ? `✓ Configurada (termina en ${s.token_hint})`
    : "⚠ Sin configurar — la transcripción en la nube no funcionará.";
  $("settings").classList.remove("hidden");
}
$("btnSettings").onclick = openSettings;
$("closeSettings").onclick = () => $("settings").classList.add("hidden");
$("settings").onclick = (e) => { if (e.target.id === "settings") $("settings").classList.add("hidden"); };

$("saveToken").onclick = async () => {
  const token = $("apiToken").value.trim();
  if (!token) return;
  await window.pywebview.api.set_api_token(token);
  $("tokenStatus").textContent = `✓ Guardada (termina en …${token.slice(-4)})`;
  $("apiToken").value = "";
};

$("chooseDir").onclick = async () => {
  const r = await window.pywebview.api.choose_export_dir();
  if (r.ok) $("exportDir").value = r.path;
};

$("search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

$("newIni").onclick = async () => {
  const name = prompt("Nombre de la nueva iniciativa:");
  if (name) {
    await window.pywebview.api.create_initiative(name);
    await loadSidebar();
  }
};

$("btnRec").onclick = async () => {
  if (!recording) {
    if (!activeInitiativeId) { alert("Elige una iniciativa en el panel de la izquierda primero."); return; }
    const sugerido = "Reunión";
    const title = prompt("¿Cómo quieres llamar a esta reunión? (la fecha y hora se guardan solas)", sugerido);
    if (title === null) return;
    clearTranscript();
    const info = await window.pywebview.api.start_recording(activeInitiativeId, title);
    live = info.live;
    recording = true;
    $("btnRec").textContent = "■ Parar";
    setStatus(live ? "● Grabando…" : "● Grabando (el texto saldrá al parar)");
    $("btnCap").disabled = false;
    $("btnNote").disabled = false;
    $("btnExp").disabled = false;
    addMeetingHeader(info.title, info.started_at);
  } else {
    await stopRecording();
  }
};

$("btnImport").onclick = async () => {
  if (recording) { alert("Termina la grabación actual antes de subir un video."); return; }
  if (!activeInitiativeId) { alert("Elige una iniciativa en el panel primero."); return; }

  let secs = 0;
  showProgress(true);
  setStatus("📹 Procesando y transcribiendo el video… 0s");
  const timer = setInterval(() => {
    secs++;
    setStatus(`📹 Procesando y transcribiendo el video… ${secs}s`);
  }, 1000);

  const r = await window.pywebview.api.import_media(activeInitiativeId);

  clearInterval(timer);
  showProgress(false);
  setStatus("");
  if (!r || !r.ok) {
    if (r && r.error) alert("No se pudo transcribir el video:\n" + r.error);
    return;
  }
  clearTranscript();
  addMeetingHeader(r.title, r.started_at, r.meeting_id);
  for (const u of r.utterances) addUtterance(u.speaker, u.text);
  addMeetingFooter("");
  refreshActiveMeetings();
};

$("btnCap").onclick = async () => {
  const mon = $("monitor").value || 1;
  const r = await window.pywebview.api.take_capture(mon);
  if (r.ok) addCaptureMark();
};

$("btnNote").onclick = async () => {
  const text = prompt("Escribe una nota para este momento:");
  if (text && text.trim()) {
    const r = await window.pywebview.api.add_note(text.trim());
    if (r.ok) addNoteMark(text.trim());
  }
};

$("btnExp").onclick = async () => {
  if (recording) await stopRecording();
  if (!activeInitiativeId) {
    alert("Elige una iniciativa en el panel de la izquierda primero.");
    return;
  }
  // Refresca la carpeta de la iniciativa seleccionada y la abre en el Explorador.
  const e = await window.pywebview.api.export_initiative_by_id(activeInitiativeId);
  await openExport(e, "No se pudo abrir la carpeta.");
};
