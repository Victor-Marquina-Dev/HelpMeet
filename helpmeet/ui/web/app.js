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
    name.textContent = ini.name;
    row.append(arrow, name);

    const meetList = document.createElement("div");
    meetList.className = "meet-list";

    row.onclick = () => onInitiativeClick(box, row, arrow, meetList, ini.id);
    box.append(row, meetList);
    cont.appendChild(box);
  }
}

async function onInitiativeClick(box, row, arrow, meetList, iniId) {
  // marcar como activa (para grabar)
  document.querySelectorAll(".ini-row.active").forEach((r) => r.classList.remove("active"));
  row.classList.add("active");
  activeInitiativeId = iniId;

  // expandir / colapsar reuniones
  const isOpen = box.classList.toggle("open");
  arrow.textContent = isOpen ? "▾" : "▸";
  if (isOpen) {
    const meetings = await window.pywebview.api.list_meetings(iniId);
    meetList.innerHTML = "";
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
      item.textContent = `${m.date} · ${m.title}`;
      item.onclick = (e) => { e.stopPropagation(); openMeeting(m.id, item); };
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

async function openMeeting(mid, el) {
  document.querySelectorAll(".meet.active").forEach((m) => m.classList.remove("active"));
  if (el) el.classList.add("active");
  const data = await window.pywebview.api.get_transcript(mid);
  clearTranscript();
  addMeetingHeader(data.title, data.started_at, mid);
  for (const u of data.utterances) addUtterance(u.speaker, u.text);
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
      alert(e.path ? "Exportado en:\n" + e.path : "No se pudo exportar.");
    };
    meta.append(" ");
    t.appendChild(btn);
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
async function stopRecording() {
  let secs = 0;
  setStatus("⏳ Transcribiendo… 0s");
  transTimer = setInterval(() => {
    secs++;
    setStatus(`⏳ Transcribiendo… ${secs}s`);
  }, 1000);

  const r = await window.pywebview.api.stop_recording();

  clearInterval(transTimer);
  recording = false;
  $("btnRec").textContent = "● Grabar";
  $("btnCap").disabled = true;
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
    const sugerido = "Reunión " + new Date().toLocaleDateString();
    const title = prompt("¿Cómo quieres llamar a esta reunión?", sugerido);
    if (title === null) return;
    clearTranscript();
    const info = await window.pywebview.api.start_recording(activeInitiativeId, title);
    live = info.live;
    recording = true;
    $("btnRec").textContent = "■ Parar";
    setStatus(live ? "● Grabando…" : "● Grabando (el texto saldrá al parar)");
    $("btnCap").disabled = false;
    $("btnExp").disabled = false;
    addMeetingHeader(info.title, info.started_at);
  } else {
    await stopRecording();
  }
};

$("btnCap").onclick = async () => {
  const mon = $("monitor").value || 1;
  const r = await window.pywebview.api.take_capture(mon);
  if (r.ok) addCaptureMark();
};

$("btnExp").onclick = async () => {
  if (recording) await stopRecording();
  const e = await window.pywebview.api.export();
  alert(e.path ? "Exportado en:\n" + e.path : "Nada que exportar todavía.");
};
