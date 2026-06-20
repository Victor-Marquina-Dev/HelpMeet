const $ = (id) => document.getElementById(id);
let recording = false;

async function refreshInitiatives() {
  const list = await window.pywebview.api.list_initiatives();
  $("initiative").innerHTML = list
    .map((i) => `<option value="${i.id}">${i.name}</option>`)
    .join("");
}

// Llamada desde Python cuando llega una frase transcrita
function addUtterance(speaker, text) {
  const hint = document.querySelector(".hint");
  if (hint) hint.remove();
  const div = document.createElement("div");
  div.className = "row " + speaker;
  const label = speaker === "me" ? "Yo" : "Los demás";
  div.innerHTML = `<span class="who">${label}</span><span class="txt">${text}</span>`;
  $("transcript").appendChild(div);
  window.scrollTo(0, document.body.scrollHeight);
}

function addCaptureMark() {
  const div = document.createElement("div");
  div.innerHTML = `<span class="cap-mark">📷 Captura tomada</span>`;
  $("transcript").appendChild(div);
  window.scrollTo(0, document.body.scrollHeight);
}

window.addEventListener("pywebviewready", refreshInitiatives);

$("newIni").onclick = async () => {
  const name = prompt("Nombre de la nueva iniciativa:");
  if (name) {
    await window.pywebview.api.create_initiative(name);
    await refreshInitiatives();
  }
};

function addMeetingHeader(title, startedAt) {
  const hint = document.querySelector(".hint");
  if (hint) hint.remove();
  const h = document.createElement("div");
  h.className = "meeting-header";
  h.innerHTML = `<h2>${title}</h2><span class="meta">Inicio: ${startedAt}</span>`;
  $("transcript").appendChild(h);
}

function addMeetingFooter(duration) {
  const f = document.createElement("div");
  f.className = "meeting-footer";
  f.textContent = duration ? `■ Reunión finalizada · duración: ${duration}` : "■ Reunión finalizada";
  $("transcript").appendChild(f);
  window.scrollTo(0, document.body.scrollHeight);
}

async function stopRecording() {
  const r = await window.pywebview.api.stop_recording();
  recording = false;
  $("btnRec").textContent = "● Grabar";
  $("status").textContent = "";
  $("btnCap").disabled = true;
  addMeetingFooter(r && r.duration);
}

$("btnRec").onclick = async () => {
  if (!recording) {
    const id = $("initiative").value;
    if (!id) { alert("Crea o elige una iniciativa primero."); return; }
    const sugerido = "Reunión " + new Date().toLocaleDateString();
    const title = prompt("¿Cómo quieres llamar a esta reunión?", sugerido);
    if (title === null) return; // canceló
    const info = await window.pywebview.api.start_recording(id, title);
    recording = true;
    $("btnRec").textContent = "■ Parar";
    $("status").textContent = "● Grabando…";
    $("btnCap").disabled = false;
    $("btnExp").disabled = false;
    addMeetingHeader(info.title, info.started_at);
  } else {
    await stopRecording();
  }
};

$("btnCap").onclick = async () => {
  const r = await window.pywebview.api.take_capture();
  if (r.ok) addCaptureMark();
};

$("btnExp").onclick = async () => {
  if (recording) await stopRecording();
  const e = await window.pywebview.api.export();
  alert(e.path ? "Exportado en:\n" + e.path : "Nada que exportar todavía.");
};
