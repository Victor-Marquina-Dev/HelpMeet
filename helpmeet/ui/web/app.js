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

$("btnRec").onclick = async () => {
  if (!recording) {
    const id = $("initiative").value;
    if (!id) { alert("Crea o elige una iniciativa primero."); return; }
    await window.pywebview.api.start_recording(id, "Reunión");
    recording = true;
    $("btnRec").textContent = "■ Parar";
    $("status").textContent = "● Grabando…";
    $("btnCap").disabled = false;
    $("btnExp").disabled = false;
  } else {
    await window.pywebview.api.stop_recording();
    recording = false;
    $("btnRec").textContent = "● Grabar";
    $("status").textContent = "";
    $("btnCap").disabled = true;
  }
};

$("btnCap").onclick = async () => {
  const r = await window.pywebview.api.take_capture();
  if (r.ok) addCaptureMark();
};

$("btnExp").onclick = async () => {
  if (recording) {
    await window.pywebview.api.stop_recording();
    recording = false;
    $("btnRec").textContent = "● Grabar";
    $("status").textContent = "";
    $("btnCap").disabled = true;
  }
  const e = await window.pywebview.api.export();
  alert(e.path ? "Exportado en:\n" + e.path : "Nada que exportar todavía.");
};
