/* ============================================================
   Helpmeet — app.js
   Lógica de interfaz para pywebview.
   ------------------------------------------------------------
   ESTRUCTURA
   1. Iconos SVG (Lucide)
   2. Capa de API  ........ api.*  (pywebview con fallback MOCK)
   3. Estado central ...... STATE  + setAppState()
   4. Render de vistas .... renderMain(), renderActionBar()
   5. Sidebar / búsqueda / glosario / archivo / papelera
   6. Modales, toasts, menús contextuales (reemplazan prompt/alert)
   7. Grabación / pantalla / procesamiento / recuperación
   8. Atajos de teclado
   9. Globals que Python llama: addUtterance, setStatus, setProgress
      + adaptadores V2: onAppStateChanged, onJobProgress,
        onAudioLevels, onRecoveryDetected, setScreenPreview

   CONVENCIÓN: cada función que necesita un endpoint de backend que
   AÚN NO EXISTE está marcada con  // @pending-python  y el método
   propuesto. Ver PYTHON_API.md para el contrato completo.
   ============================================================ */

'use strict';

/* ============================================================
   1. ICONOS (Lucide, subconjunto usado)
   ============================================================ */
const ICONS = {
  panel: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  dots: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  monitorDot: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 3v12M8 7l4-4 4 4M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  note: '<path d="M12 5v14M5 12h14"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
  micOff: '<path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7"/><path d="M19 10v2a7 7 0 0 1-.6 2.8M12 19v3M5 10v2a7 7 0 0 0 11 5.7"/>',
  star: '<path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  fitContain: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  fitFill: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 5v14M16 5v14"/>',
  fitStretch: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2"/>',
};
function svg(name, size) {
  size = size || 15;
  const stroke = (name === 'dots') ? '' : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"${stroke}>${ICONS[name] || ''}</svg>`;
}
function ico(name, size) { return `<span class="ico">${svg(name, size)}</span>`; }

/* ============================================================
   2. CAPA DE API
   Usa window.pywebview.api en producción; cae a MOCK en el navegador.
   Esto NO inventa endpoints: el set "real" coincide 1:1 con el
   contrato de la sección 7 del brief. Lo V2 vive en api.v2.* y está
   claramente separado + marcado @pending-python.
   ============================================================ */
const HAS_PYWEBVIEW = () => !!(window.pywebview && window.pywebview.api);

async function call(method, ...args) {
  // Dentro de pywebview usamos SIEMPRE el backend real, nunca el MOCK (así no
  // se cuelan datos falsos si un método aún no estuviera listo).
  if (window.pywebview && window.pywebview.api) {
    const fn = window.pywebview.api[method];
    if (typeof fn === 'function') return await fn(...args);
    console.warn('[api] método no disponible:', method);
    return null;
  }
  return MOCK[method] ? MOCK[method](...args) : (console.warn('[api] sin método', method), null);
}

const api = {
  // ---- Contrato ACTUAL (sección 7) ----
  listInitiatives: () => call('list_initiatives'),
  toggleInitiativePin: (id) => call('toggle_initiative_pin', id),
  createInitiative: (name) => call('create_initiative', name),
  renameInitiative: (id, name) => call('rename_initiative', id, name),
  renameMeeting: (id, title) => call('rename_meeting', id, title),
  moveMeeting: (mid, iid) => call('move_meeting', mid, iid),
  getGlossary: (iid) => call('get_glossary', iid),
  listMeetings: (iid) => call('list_meetings', iid),
  search: (q) => call('search', q),
  getTranscript: (mid) => call('get_transcript', mid),
  startRecording: (iid, title) => call('start_recording', iid, title),
  stopRecording: () => call('stop_recording'),
  listMonitors: () => call('list_monitors'),
  takeCapture: (idx) => call('take_capture', idx),
  addNote: (text) => call('add_note', text),
  toggleMeetingMicMute: (muted) => call('toggle_meeting_mic_mute', muted),
  importMedia: (iid) => call('import_media', iid),
  exportMeetingById: (mid) => call('export_meeting_by_id', mid),
  exportTranscriptTxt: (mid) => call('export_transcript_txt', mid),
  exportTranscriptPackage: (mid) => call('export_transcript_package', mid),
  exportTranscript: (mid) => call('export_transcript', mid),
  exportInitiativeById: (iid) => call('export_initiative_by_id', iid),
  exportMeetingTo: (mid) => call('export_meeting_to', mid),
  exportInitiativeTo: (iid) => call('export_initiative_to', iid),
  setInitiativeDescription: (iid, d) => call('set_initiative_description', iid, d),
  copyInitiativeContext: (iid) => call('copy_initiative_context', iid),
  copyMeetingContext: (mid) => call('copy_meeting_context', mid),
  getCaptureImage: (cid) => call('get_capture_image', cid),
  getBackgroundJobs: () => call('get_background_jobs'),
  setAiInstructions: (t) => call('set_ai_instructions', t),
  openMeetingFolder: (mid) => call('open_meeting_folder', mid),
  openPath: (p) => call('open_path', p),
  getSettings: () => call('get_settings'),
  getDiagnostics: () => call('get_diagnostics'),
  getRecordingPreflight: (kind, monitor) => call('get_recording_preflight', kind, monitor),
  backupDatabase: () => call('backup_database'),
  wipeAllData: () => call('wipe_all_data'),
  markConsentSeen: () => call('mark_consent_seen'),
  setApiToken: (t) => call('set_api_token', t),
  chooseExportDir: () => call('choose_export_dir'),

  // ---- Grabación de pantalla + biblioteca (backend REAL, ya implementado) ----
  startScreenRecording: (iid, idx) => call('start_screen_recording', iid, idx),
  stopScreenRecording: () => call('stop_screen_recording'),
  transcribeMeetingVideo: (mid, force) => call('transcribe_meeting_video', mid, !!force),
  toggleScreenMicMute: (m) => call('toggle_screen_mic_mute', m),
  setScreenMonitor: (idx) => call('set_screen_monitor', idx),
  setScreenScaleMode: (mode) => call('set_screen_scale_mode', mode),
  revealPath: (p) => call('reveal_path', p),
  listLibrary: (view) => call('list_library', view),
  archiveItem: (kind, id) => call('archive_item', kind, id),
  trashItem: (kind, id) => call('trash_item', kind, id),
  restoreItem: (kind, id) => call('restore_item', kind, id),
  permanentlyDeleteItem: (kind, id) => call('permanently_delete_item', kind, id),

  // ---- V2: requieren backend nuevo (ver PYTHON_API.md). ----
  // Cada uno hace fallback a un comportamiento de UI honesto (no finge éxito de datos).
  v2: {
    getAppState: () => call('get_app_state'),                       // @pending-python
    cancelCurrentJob: () => call('cancel_current_job'),             // @pending-python
    listRecoverable: () => call('list_recoverable_recordings'),     // @pending-python
    recoverRecording: (id) => call('recover_recording', id),        // @pending-python
    discardRecoverable: (id) => call('discard_recoverable_recording', id), // @pending-python
    getAudioDevices: () => call('get_audio_devices'),               // @pending-python
    testAudioDevices: (cfg) => call('test_audio_devices', cfg),     // @pending-python
    startScreenRecording: (iid, idx) => call('start_screen_recording', iid, idx), // @pending-python
    stopScreenRecording: () => call('stop_screen_recording'),       // @pending-python
    updateUtterance: (id, ch) => call('update_utterance', id, ch),  // @pending-python
    splitUtterance: (id, pos) => call('split_utterance', id, pos),  // @pending-python
    mergeUtterances: (a, b) => call('merge_utterances', a, b),      // @pending-python
    deleteUtterance: (id) => call('delete_utterance', id),          // @pending-python
    toggleHighlight: (id) => call('toggle_utterance_highlight', id),// @pending-python
    listMeetingAssets: (mid) => call('list_meeting_assets', mid),   // @pending-python
    updateNote: (id, t) => call('update_note', id, t),              // @pending-python
    deleteCapture: (id) => call('delete_capture', id),              // @pending-python
    generateSummary: (mid) => call('generate_meeting_summary', mid),// @pending-python
    getInsights: (mid) => call('get_meeting_insights', mid),        // @pending-python
    updateInsights: (mid, d) => call('update_meeting_insights', mid, d), // @pending-python
    deleteMeeting: (id) => call('delete_meeting', id),              // @pending-python
    archiveInitiative: (id) => call('archive_initiative', id),      // @pending-python
    searchAdvanced: (q, f) => call('search_advanced', q, f),        // @pending-python
    getTranscriptionSettings: () => call('get_transcription_settings'),   // @pending-python
    setTranscriptionSettings: (d) => call('set_transcription_settings', d), // @pending-python
    listParticipants: (iid) => call('list_participants', iid),
    addParticipants: (iid, names) => call('add_participants', iid, names),
    renameParticipant: (id, name) => call('rename_participant', id, name),
    deleteParticipant: (id) => call('delete_participant', id),
    setMeParticipant: (iid, pid) => call('set_me_participant', iid, pid),
    assignUtteranceParticipant: (uid, pid) => call('assign_utterance_participant', uid, pid),
  },
};

// ¿Está disponible un método V2 en el backend real?
function v2Available(pyMethod) {
  return HAS_PYWEBVIEW() && typeof window.pywebview.api[pyMethod] === 'function';
}

/* ============================================================
   2b. DATOS MOCK — solo para el navegador (sin pywebview).
   Permiten ver/probar el rediseño sin backend. Nunca se usan
   cuando window.pywebview.api existe.
   ============================================================ */
const MOCK = (() => {
  const inits = [];
  const meetings = {};
  const transcripts = {};
  const glossary = {};
  const wait = (v, ms) => new Promise(r => setTimeout(() => r(v), ms || 220));
  let mctr = 100;
  return {
    list_initiatives: () => wait(inits.slice()),
    create_initiative: (name) => { const it = { id: 'i' + (++mctr), name }; inits.push(it); meetings[it.id] = []; return wait(it); },
    rename_initiative: (id, name) => { const it = inits.find(x => x.id === id); if (it) it.name = name; return wait({ ok: true }); },
    rename_meeting: (id, title) => { for (const k in meetings) { const m = meetings[k].find(x => x.id === id); if (m) m.title = title; } return wait({ ok: true }); },
    move_meeting: () => wait({ ok: true }),
    get_glossary: (iid) => wait(glossary[iid] || []),
    list_meetings: (iid) => wait((meetings[iid] || []).slice()),
    search: () => wait([]),
    get_transcript: (mid) => wait(transcripts[mid] || { title: 'Reunión', started_at: '', utterances: [] }),
    start_recording: (iid, title) => wait({ id: 'm' + (++mctr), title: title || 'Reunión sin título', initiative_id: iid, live: true }),
    stop_recording: () => wait({ status: 'ok', duration: '12:48', utterances: 24 }, 400),
    list_monitors: () => wait([{ index: 0, width: 2560, height: 1440 }, { index: 1, width: 1920, height: 1080 }]),
    take_capture: () => wait({ ok: true }),
    add_note: () => wait({ ok: true }),
    import_media: (iid) => wait({ id: 'm' + (++mctr), title: 'Vídeo importado', initiative_id: iid, utterances: 30 }, 600),
    export_meeting_by_id: () => wait({ path: 'C:\\Helpmeet\\export' }, 500),
    export_transcript_txt: () => wait({ ok: true, path: 'C:\\Helpmeet\\transcripcion.txt' }, 500),
    export_transcript_package: () => wait({ ok: true, path: 'C:\\Helpmeet\\transcripcion.zip', captures: 2, files: 1 }, 500),
    export_transcript: () => wait({ ok: true, format: 'txt', path: 'C:\\Helpmeet\\transcripcion.txt', captures: 0, files: 0 }, 500),
    export_initiative_by_id: () => wait({ path: 'C:\\Helpmeet\\export' }, 500),
    export_meeting_to: () => wait({ ok: true, path: 'D:\\Backups\\reunion' }, 500),
    export_initiative_to: () => wait({ ok: true, path: 'D:\\Backups\\alpha' }, 500),
    open_meeting_folder: () => wait({ ok: true, path: 'C:\\Helpmeet\\export' }),
    open_path: () => wait({ ok: true }),
    get_settings: () => wait({ export_dir: 'C:\\Helpmeet\\export', token_set: true }),
    set_api_token: () => wait({ ok: true }),
    choose_export_dir: () => wait({ ok: true, path: 'C:\\Helpmeet\\export' }),
    // V2 mock (para previsualizar la UI en navegador)
    get_app_state: () => wait({ state: 'idle', job: null, recoverable: [] }),
    cancel_current_job: () => wait({ ok: true }),
    list_recoverable_recordings: () => wait([]),
    get_audio_devices: () => wait({ inputs: [{ id: 'mic1', name: 'Realtek HD Audio' }], outputs: [{ id: 'spk1', name: 'Altavoces (loopback)' }] }),
    get_recording_preflight: (kind) => wait({ kind, title: kind === 'screen' ? 'Antes de grabar la pantalla' : 'Antes de grabar la reunión', action: 'Continuar', can_start: true, checks: [] }),
    list_meeting_assets: () => wait({ captures: [
      { id: 'c1', time: '00:48', note: 'arquitectura' }, { id: 'c2', time: '14:02', note: 'esquema BD' }, { id: 'c3', time: '22:31', note: 'flujo auth' },
    ], audio: [{ id: 'a1', name: 'mezcla.wav', dur: '34:12', size: '58 MB', kept: true }] }),
    start_screen_recording: () => wait({ ok: true }),
    stop_screen_recording: () => wait({ ok: true, path: 'C:\\Helpmeet\\export\\grabacion.mp4', tracks: ['mic', 'system'] }, 700),
    generate_meeting_summary: () => wait({ summary: 'Resumen generado de ejemplo.', decisions: [], tasks: [] }, 900),
  };
})();

/* ============================================================
   3. ESTADO CENTRAL
   ============================================================ */
const STATE = {
  appState: 'idle',     // idle | recording | recording-local | recording-cloud | screen-recording | processing
  screen: 'welcome',    // welcome | initiative | meeting | search | glossary | archive | trash
  sidebarOpen: load('hm.sidebar', '1') === '1',
  initiatives: [],
  meetingsByInit: {},    // cache
  openInits: {},         // id -> bool expandido
  selInit: null,
  selMeeting: null,
  transcript: null,
  activeTab: 'transcript',
  provider: 'auto',      // auto | local | replicate (V2)
  monitors: [],
  monitorIdx: 0,
  screenScaleMode: load('hm.screenScaleMode', 'fit'),
  recElapsed: 0,
  recStartedAt: 0,
  recTimer: null,
  jobProgress: 0,
  jobStage: '',
  jobDeterminate: false,
  jobStartedAt: 0,
  jobClock: null,
  micMuted: false,
  meetingMicMuted: false,
  settings: { export_dir: '', token_set: false },
  archiveCount: 0,
  trashCount: 0,
};

function load(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

function setAppState(s) {
  STATE.appState = s;
  document.body.setAttribute('data-app-state', s);
  renderActionBar();
  renderTopStatus();
  renderMain();
  // adaptador opcional para el backend (no obligatorio)
}

/* ============================================================
   4. RENDER
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderTopStatus() {
  const root = $('#topbarStatus');
  const s = STATE.appState;
  if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') {
    root.innerHTML = `<div class="status-rec"><span class="rdot"></span>Grabando reunión · <span class="mono">${fmt(STATE.recElapsed)}</span></div>`;
  } else if (s === 'screen-recording') {
    root.innerHTML = `<div class="status-rec"><span class="rdot"></span>REC pantalla · <span class="mono">${fmt(STATE.recElapsed)}</span></div>`;
  } else if (s === 'processing') {
    const progressText = STATE.jobDeterminate ? Math.round(STATE.jobProgress) + '%' : processingElapsed();
    root.innerHTML = `<div class="status-proc"><span class="spinner"></span>${esc(STATE.jobStage)} · ${progressText}</div>`;
  } else {
    // Reposo: pastilla de contexto (dónde estás: iniciativa › reunión)
    const it = STATE.initiatives.find(x => x.id === STATE.selInit);
    let ctx;
    if (STATE.screen === 'meeting' && STATE.transcript) {
      ctx = `<span class="ctx-init">${esc(it ? it.name : '')}</span>${svg('chevron', 12)}<span class="ctx-meet">${esc(STATE.transcript.title)}</span>`;
    } else if (it) {
      ctx = `<span class="ctx-meet">${esc(it.name)}</span>`;
    } else {
      ctx = null;   // sin iniciativa seleccionada: no se muestra la miga de pan
    }
    root.innerHTML = ctx ? `<div class="context-pill"><span class="dot-ok"></span>${ctx}</div>` : '';
  }
  updateMicChip();
}

/* Chip de micrófono del header: silenciar/activar mi audio.
   - Durante una grabación: silencia en vivo (reunión o pantalla).
   - En reposo: queda como preferencia para la próxima grabación. */
async function toggleMic() {
  STATE.micMuted = !STATE.micMuted;
  updateMicChip();
  const s = STATE.appState;
  try {
    if (s === 'screen-recording') await api.toggleScreenMicMute(STATE.micMuted);
    else if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') await api.toggleMeetingMicMute(STATE.micMuted);
    else if (api.v2 && api.v2.setTranscriptionSettings) await api.v2.setTranscriptionSettings({ default_mic_muted: STATE.micMuted });
  } catch (e) { /* no romper la UI por el guardado */ }
  toast('info', STATE.micMuted ? 'Micrófono silenciado' : 'Micrófono activo');
}
function updateMicChip() {
  const b = $('#btnMic'); if (!b) return;
  b.classList.toggle('muted', !!STATE.micMuted);
  b.setAttribute('aria-pressed', STATE.micMuted ? 'true' : 'false');
  b.setAttribute('aria-label', STATE.micMuted ? 'Activar micrófono' : 'Silenciar micrófono');
  b.setAttribute('title', STATE.micMuted ? 'Activar micrófono' : 'Silenciar micrófono');
  const i = b.querySelector('.mic-ico'); if (i) i.innerHTML = svg(STATE.micMuted ? 'micOff' : 'mic', 15);
}
function openSearch() { const s = $('#search'); if (!s) return; s.classList.add('expanded'); $('#searchInput').focus(); }

function renderMain() {
  const main = $('#main');
  document.body.setAttribute('data-screen', STATE.screen);
  switch (STATE.screen) {
    case 'welcome': return main.replaceChildren(viewWelcome());
    case 'initiative': return main.replaceChildren(viewInitiative());
    case 'meeting': return main.replaceChildren(viewMeeting());
    case 'search': return main.replaceChildren(viewSearch());
    case 'glossary': return main.replaceChildren(viewGlossary());
    case 'archive':
    case 'trash': return main.replaceChildren(viewArchiveTrash(STATE.screen));
    default: return main.replaceChildren(viewWelcome());
  }
}

/* ---- Vistas ---- */
function viewWelcome() {
  const w = el('div', 'empty');
  w.innerHTML = `
    <div class="empty-ico">${svg('plus', 24)}</div>
    <h2>Empieza creando una iniciativa</h2>
    <p>Selecciona una iniciativa → graba o importa → revisa la transcripción → exporta el contexto.</p>
    <div class="row">
      <button class="btn btn-primary btn-lg" id="wNew">Nueva iniciativa</button>
      <button class="btn btn-lg" id="wExisting">Ver existentes</button>
      <button class="btn btn-lg" id="wDiag">${svg('check', 15)} Diagnóstico</button>
    </div>`;
  w.querySelector('#wNew').onclick = promptNewInitiative;
  w.querySelector('#wExisting').onclick = () => { STATE.sidebarOpen = true; applySidebar(); $('#sidebarTree').focus?.(); };
  w.querySelector('#wDiag').onclick = openDiagnostics;
  return w;
}

function viewInitiative() {
  const it = STATE.initiatives.find(x => x.id === STATE.selInit);
  const ms = STATE.meetingsByInit[STATE.selInit] || [];
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  const last = ms[0];
  head.innerHTML = `
    <div class="mhead-row">
      <h1 class="mtitle-h title-lg">${esc(it ? it.name : '')}</h1>
      <div class="spacer"></div>
      <button class="btn btn-primary ${ms.length ? '' : 'is-disabled'}" id="initCopy" title="${ms.length ? 'Copiar el contexto al portapapeles' : 'Aún no hay reuniones que copiar'}">${svg('copy', 14)} Copiar contexto</button>
      <button class="btn ${ms.length ? '' : 'is-disabled'}" id="initExport" title="${ms.length ? 'Exportar el contexto' : 'Aún no hay reuniones que exportar'}">${svg('download', 14)} Exportar</button>
      <button class="icon-btn" id="initMenu" aria-label="Más acciones de la iniciativa">${svg('dots', 16)}</button>
    </div>
    <div class="meta-line">${ms.length} reuniones${last ? ' · última el ' + esc(last.date) : ''}</div>`;

  const scroll = el('div', 'content');

  // Objetivo / contexto: se exporta como cabecera del contexto.md para la IA.
  const objBox = el('div', 'obj-box');
  objBox.innerHTML = `
    <label class="section-label" for="initObjetivo">OBJETIVO / CONTEXTO PARA LA IA</label>
    <textarea id="initObjetivo" class="obj-text" rows="2"
      placeholder="¿De qué va esta iniciativa y qué quieres que la IA tenga en cuenta? Se añade al principio del contexto que envías a Claude."></textarea>
    <div class="obj-hint">Se guarda solo al salir del campo y se incluye al principio del contexto exportado.</div>`;
  const ta = objBox.querySelector('#initObjetivo');
  ta.value = (it && it.description) || '';
  ta.onblur = async () => {
    const val = ta.value.trim();
    if (it && val === ((it.description) || '')) return;     // sin cambios, no molestar
    await api.setInitiativeDescription(STATE.selInit, val);
    if (it) it.description = val;                            // reflejar en memoria
    toast('ok', 'Objetivo guardado');
  };
  scroll.appendChild(objBox);

  const recents = el('div');
  recents.appendChild(el('div', 'section-label', 'REUNIONES RECIENTES'));

  // Buscador de TODA la iniciativa: busca frases y notas en todas sus reuniones.
  const searchBar = el('div', 'tx-search');
  searchBar.style.margin = '0 0 12px';
  searchBar.innerHTML = `<span class="tx-search-ico" aria-hidden="true">${svg('search', 14)}</span>
    <input id="initSearch" type="search" placeholder="Buscar en toda la iniciativa…" aria-label="Buscar en la iniciativa" autocomplete="off">
    <span class="tx-count" id="initSearchCount"></span>
    <button class="icon-btn sm" id="initSearchClear" title="Limpiar búsqueda" aria-label="Limpiar" hidden>${svg('x', 13)}</button>`;
  if (ms.length) recents.appendChild(searchBar);

  const list = el('div', 'list');
  if (!ms.length) {
    list.appendChild(el('p', null, '<span style="color:var(--text-muted);font-size:13px">Aún no hay reuniones. Pulsa <b>Grabar reunión</b> o <b>Subir archivo</b> para empezar.</span>'));
  } else {
    ms.forEach(m => {
      const c = el('div', 'row-card' + (m.status === 'pending' ? ' warn' : ''));
      const pill = m.status === 'done' ? '<span class="pill pill-done"><span class="pd"></span>Finalizada</span>'
        : m.status === 'processing' ? '<span class="pill pill-proc"><span class="spinner sm"></span>Transcribiendo…</span>'
        : m.status === 'error' ? '<span class="pill pill-error"><span class="pd"></span>Error</span>'
        : '<span class="pill pill-pending"><span class="pd"></span>Pendiente</span>';
      c.innerHTML = `<div class="rc-body"><div class="rc-title">${esc(m.title)}</div><div class="rc-meta">${esc(m.date)} · ${esc(m.dur || '—')}${m.frases ? ' · ' + m.frases + ' frases' : ''}</div></div>${pill}`;
      c.onclick = () => openMeeting(m.id);
      list.appendChild(c);
    });
  }
  recents.appendChild(list);

  // Resultados de la búsqueda (oculto hasta que se escribe algo).
  const results = el('div', 'list'); results.hidden = true;
  recents.appendChild(results);
  scroll.appendChild(recents);

  if (ms.length) wireInitiativeSearch(searchBar, list, results, ms);

  head.querySelector('#initMenu').onclick = (e) => openInitiativeMenu(e, STATE.selInit);
  head.querySelector('#initCopy').onclick = (e) => ms.length && copyInitiativeContext(STATE.selInit, e.currentTarget);
  head.querySelector('#initExport').onclick = (e) => ms.length && exportInitiativeNow(STATE.selInit, e.currentTarget);
  wrap.replaceChildren(head, scroll);
  return wrap;
}

/* Conecta el buscador de una iniciativa: busca frases y notas en TODAS sus
   reuniones (reusa el backend de búsqueda global, filtrado a esta iniciativa).
   Con texto: muestra resultados y oculta la lista de reuniones. Sin texto:
   vuelve a mostrar la lista normal. */
function wireInitiativeSearch(bar, list, results, ms) {
  const input = bar.querySelector('#initSearch');
  const countEl = bar.querySelector('#initSearchCount');
  const clearBtn = bar.querySelector('#initSearchClear');
  const ids = new Set(ms.map(m => m.id));
  let deb, token = 0;

  const reset = () => {
    results.hidden = true; results.replaceChildren();
    list.hidden = false; countEl.textContent = ''; clearBtn.hidden = true;
  };

  async function doSearch(q) {
    q = (q || '').trim();
    clearBtn.hidden = !q;
    if (q.length < 2) { reset(); return; }
    const mine = ++token;                       // ignora respuestas viejas
    const all = await api.search(q) || [];
    if (mine !== token) return;                 // llegó otra búsqueda después
    const hits = all.filter(r => ids.has(r.meeting_id));
    list.hidden = true; results.hidden = false; results.replaceChildren();
    countEl.textContent = hits.length ? `${hits.length} resultado${hits.length > 1 ? 's' : ''}` : 'Sin resultados';
    if (!hits.length) {
      results.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin resultados en esta iniciativa.</p>';
      return;
    }
    hits.forEach(r => {
      const kind = r.kind || 'frase';
      const speaker = kind === 'nota' ? 'NOTA' : (r.speaker === 'me' ? 'YO' : 'LOS DEMÁS');
      const c = el('div', 'result');
      c.innerHTML = `<div class="res-meta">${esc(r.meeting_title || r.meeting || '')} · ${esc(r.date)} · ${esc(kind)} · ${speaker}</div><div class="res-text">${highlight(r.text, q)}</div>`;
      c.onclick = () => { if (r.meeting_id) openMeeting(r.meeting_id); };
      results.appendChild(c);
    });
  }

  input.addEventListener('input', (e) => { clearTimeout(deb); const v = e.target.value; deb = setTimeout(() => doSearch(v), 300); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(deb); doSearch(e.target.value); } });
  clearBtn.onclick = () => { input.value = ''; reset(); input.focus(); };
}

/* Copia el contexto.md completo de la iniciativa al portapapeles (para pegarlo
   directo en Claude Code). Refresca antes el export para llevar lo último. */
async function copyInitiativeContext(iid, btn) {
  if (btn) btn.classList.add('is-loading');
  try {
    const r = await api.copyInitiativeContext(iid);
    if (!r || !r.text || !r.text.trim()) {
      toast('info', 'Aún no hay nada que copiar en esta iniciativa.');
      return;
    }
    const ok = await copyText(r.text);
    const kb = Math.max(1, Math.round(r.text.length / 1024));
    toast(ok ? 'ok' : 'err', ok ? `Contexto copiado (~${kb} KB) · pégalo en Claude` : 'No se pudo copiar al portapapeles');
  } catch (e) {
    toast('err', 'No se pudo preparar el contexto');
  } finally {
    if (btn) btn.classList.remove('is-loading');
  }
}

/* Copia el contexto de UNA reunión (con cabecera para la IA) al portapapeles. */
async function copyMeetingContext(mid, btn) {
  if (btn) btn.classList.add('is-loading');
  try {
    const r = await api.copyMeetingContext(mid);
    if (!r || !r.text || !r.text.trim()) {
      toast('info', 'Esta reunión aún no tiene contenido que copiar.');
      return;
    }
    const ok = await copyText(r.text);
    const kb = Math.max(1, Math.round(r.text.length / 1024));
    toast(ok ? 'ok' : 'err', ok ? `Transcripción .md copiada (~${kb} KB) · pégala en Claude` : 'No se pudo copiar al portapapeles');
  } catch (e) {
    toast('err', 'No se pudo preparar el contexto');
  } finally {
    if (btn) btn.classList.remove('is-loading');
  }
}

async function exportInitiativeNow(iid, btn) {
  if (btn) btn.classList.add('is-loading');
  try {
    const r = await api.exportInitiativeById(iid);
    if (r && r.path) { await api.openPath(r.path); toast('ok', 'Contexto exportado · carpeta abierta'); }
    else toast('err', 'La exportación no devolvió una carpeta.');
  } catch (e) { toast('err', 'No se pudo exportar la iniciativa'); }
  finally { if (btn) btn.classList.remove('is-loading'); }
}

/* Copia texto al portapapeles con respaldo para WebView (file://, sin HTTPS). */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  try {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(t);
    t.focus(); t.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(t);
    return ok;
  } catch (e) { return false; }
}

function viewMeeting() {
  const t = STATE.transcript;
  const it = STATE.initiatives.find(x => x.id === STATE.selInit);
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  // Sin transcripción (p. ej. vídeo aún sin transcribir) no hay nada que copiar,
  // exportar ni a quién asignar: esos botones se atenúan y desactivan.
  const fraseCount = t && t.utterances ? t.utterances.filter(u => !u.kind || u.kind === 'utterance').length : 0;
  const transcribed = fraseCount > 0;
  const txOff = transcribed ? '' : ' is-disabled';
  const txTip = transcribed ? '' : 'Disponible cuando transcribas el vídeo';
  head.innerHTML = `
    <div class="breadcrumb"><span>${esc(it ? it.name : '')}</span>${svg('chevron', 13)}<span>Reunión</span></div>
    <div class="mhead-row">
      <h1 class="mtitle-h">${esc(t ? t.title : 'Reunión')}</h1>
      <span class="pill pill-done"><span class="pd"></span>Finalizada</span>
    </div>
    <div class="meta-line">${esc(t ? t.started_at : '')}${t && t.utterances ? ' · ' + t.utterances.filter(u => !u.kind || u.kind === 'utterance').length + ' frases' : ''}${t && t.video_duration ? ` · <span style="vertical-align:-1px">${svg('play', 11)}</span> ${esc(t.video_duration)}` : ''}</div>
    <div class="mhead-row mhead-actions">
      <button class="btn btn-primary${txOff}" id="mCopy" title="${txTip || 'Copiar la transcripción en Markdown'}">${svg('copy', 14)} Copiar transcripción .md</button>
      <button class="btn${txOff}" id="mExport" title="${txTip || 'Exportar la reunión'}">${svg('download', 14)} Exportar</button>
      <button class="btn" id="mOpen" title="Abrir la carpeta de la reunión">${svg('folder', 14)} Carpeta</button>
      <button class="btn${txOff}" id="mParts" title="${txTip || 'Asignar participantes'}">${svg('users', 14)} Participantes</button>
      <button class="icon-btn" id="mMenu" aria-label="Más acciones de la reunión">${svg('dots', 16)}</button>
    </div>
    <div class="tabs" role="tablist">
      ${['transcript', 'resumen', 'decisiones', 'tareas', 'archivos'].map(tab => {
        const label = { transcript: 'Transcripción', resumen: 'Resumen', decisiones: 'Decisiones', tareas: 'Tareas', archivos: 'Archivos' }[tab];
        return `<button class="tab ${STATE.activeTab === tab ? 'active' : ''}" data-tab="${tab}" role="tab">${label}</button>`;
      }).join('')}
    </div>`;
  const content = el('div', 'content');
  content.appendChild(renderTab(STATE.activeTab, t));
  // eventos
  head.querySelector('#mCopy').onclick = (e) => copyMeetingContext(STATE.selMeeting, e.currentTarget);
  head.querySelector('#mExport').onclick = (e) => doExportMeeting(e.currentTarget);
  head.querySelector('#mOpen').onclick = (e) => doOpenFolder(e.currentTarget);
  head.querySelector('#mParts').onclick = () => { if (STATE.transcript) participantsModal(STATE.transcript); };
  head.querySelector('#mMenu').onclick = (e) => openMeetingMenu(e, STATE.selMeeting);
  head.querySelectorAll('.tab').forEach(b => b.onclick = () => { STATE.activeTab = b.dataset.tab; renderMain(); });
  wrap.replaceChildren(head, content);
  return wrap;
}

function renderTab(tab, t) {
  if (tab === 'transcript') return renderTranscript(t);
  if (tab === 'archivos') return renderFiles();
  if (tab === 'resumen') return renderSummary();
  if (tab === 'decisiones') return renderDecisions();
  if (tab === 'tareas') return renderTasks();
  return el('div');
}

function renderTranscript(t) {
  const r = el('div', 'reading');
  // Grabación de pantalla: reproductor del .mp4 + opción de transcribir.
  if (t && t.video_path) r.appendChild(videoPanel(t));
  if (STATE.appState === 'recording' || STATE.appState === 'recording-local' || STATE.appState === 'recording-cloud') {
    const cloud = STATE.appState === 'recording-cloud';
    const b = el('div', 'live-banner');
    const modeText = cloud ? 'El texto aparecerá al detener · Replicate' :
      (STATE.appState === 'recording-local' ? 'Se transcribirá al detener · Whisper local rápido' : 'Transcripción en vivo · Whisper local');
    b.innerHTML = `<span class="rdot"></span><div class="msg">${modeText}</div><div style="margin-left:auto;font-size:12px;color:var(--text-secondary)" class="mono" id="liveCount">${(t && t.utterances ? t.utterances.length : 0)} frases</div>`;
    r.appendChild(b);
  }
  const us = (t && t.utterances) || [];
  if (!us.length && !(t && t.video_path)) { r.appendChild(el('p', null, '<span style="color:var(--text-muted)">Sin transcripción todavía.</span>')); return r; }

  // Buscador DENTRO de esta transcripción: filtra las frases/notas/capturas
  // que contienen el texto y muestra cuántas coinciden. Sólo en reposo.
  const recording = STATE.appState === 'recording' || STATE.appState === 'recording-local' || STATE.appState === 'recording-cloud';
  const items = [];
  if (us.length && !recording) {
    const bar = el('div', 'tx-search');
    bar.innerHTML = `<span class="tx-search-ico" aria-hidden="true">${svg('search', 14)}</span>
      <input id="txSearch" type="search" placeholder="Buscar…" aria-label="Buscar en la transcripción" autocomplete="off">
      <span class="tx-count" id="txCount"></span>
      <button class="icon-btn sm" id="txClear" title="Limpiar búsqueda" aria-label="Limpiar" hidden>${svg('x', 13)}</button>`;
    r.appendChild(bar);
    const input = bar.querySelector('#txSearch');
    const countEl = bar.querySelector('#txCount');
    const clearBtn = bar.querySelector('#txClear');
    const apply = () => {
      const q = (input.value || '').trim().toLowerCase();
      clearBtn.hidden = !q;
      let n = 0, first = null;
      items.forEach(it => {
        const hit = !q || it.text.includes(q);
        it.node.style.display = hit ? '' : 'none';
        if (q && hit) { n++; if (!first) first = it.node; }
      });
      countEl.textContent = q ? (n ? `${n} resultado${n > 1 ? 's' : ''}` : 'Sin resultados') : '';
      if (first) first.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('input', apply);
    clearBtn.onclick = () => { input.value = ''; apply(); input.focus(); };
  }

  us.forEach(u => {
    let node, text;
    if (u.kind === 'capture') { node = captureEvent(u); text = (u.code || '') + ' ' + (u.note || ''); }
    else if (u.kind === 'note') { node = noteEvent(u); text = u.text || ''; }
    else { node = utterance(u); text = u.text || ''; }
    items.push({ node, text: String(text).toLowerCase() });
    r.appendChild(node);
  });
  return r;
}

// Panel del vídeo de una grabación de pantalla: reproductor + (si aún no hay
// texto) botón para transcribir el .mp4, y abrir su carpeta.
function videoPanel(t) {
  const hasTx = !!(t.utterances && t.utterances.some(u => !u.kind || u.kind === 'utterance'));
  const wrap = el('div', 'video-panel');
  const vid = document.createElement('video');
  vid.className = 'rec-video'; vid.controls = true;
  vid.src = 'file:///' + String(t.video_path).replace(/\\/g, '/');
  const actions = el('div', 'rec-actions');
  vid.onerror = () => {
    vid.remove();
    const open = el('button', 'btn'); open.innerHTML = svg('play', 14) + ' Abrir vídeo';
    open.onclick = () => api.openPath(t.video_path);
    actions.prepend(open);
  };
  wrap.appendChild(vid); wrap.appendChild(actions);
  const bt = el('button', hasTx ? 'btn' : 'btn btn-primary', hasTx ? 'Retranscribir' : 'Transcribir este vídeo');
  if (hasTx) bt.title = 'Volver a transcribir este vídeo';
  bt.onclick = () => {
    if (hasTx) {
      confirmModal('Retranscribir', 'Se reemplazará la transcripción actual usando el motor de mayor calidad disponible.', 'Retranscribir', () => transcribeScreenVideo(STATE.selMeeting, true));
    } else transcribeScreenVideo(STATE.selMeeting, false);
  };
  actions.appendChild(bt);
  return wrap;
}

async function transcribeScreenVideo(mid, force) {
  // La transcripción del vídeo va en SEGUNDO PLANO: puedes seguir grabando otro.
  let f = null;
  try { f = await api.transcribeMeetingVideo(mid, force); }
  catch (e) { f = { ok: false, error: e && e.message }; }
  if (f && f.already) { toast('info', 'Este vídeo ya está transcrito'); return; }
  if (f && f.ok) {
    await refreshMeetings(STATE.selInit);
    if (STATE.screen === 'meeting' && STATE.selMeeting === mid) await openMeeting(mid, true);
    toast('ok', 'Se transcribe en segundo plano · puedes seguir grabando');
  } else {
    toast('err', (f && f.error) || 'No se pudo transcribir el vídeo');
  }
}

function utterance(u) {
  const d = el('div', 'utterance' + (u.speaker === 'me' ? ' me' : '') + (u.highlighted ? ' highlighted' : ''));
  d.tabIndex = 0;
  d.dataset.id = u.id;
  d.innerHTML = `
    <div class="time mono">${esc(u.time)}</div>
    <div class="band"></div>
    <div class="body-u">
      <div class="who">${esc(u.display_name || (u.speaker === 'me' ? 'Yo' : 'Los demás'))}</div>
      <div class="text">${esc(u.text)}</div>
      <div class="uactions">
        <button class="u-act u-rest${u.highlighted ? ' on' : ''}" data-act="star" title="Marcar como importante" aria-label="Marcar como importante">${svg('star', 15)}</button>
        <button class="u-act" data-act="edit" title="Editar" aria-label="Editar">${svg('edit', 15)}</button>
        <button class="u-act" data-act="speaker" title="Cambiar hablante" aria-label="Cambiar hablante">${svg('users', 15)}</button>
        <button class="u-act danger" data-act="del" title="Eliminar" aria-label="Eliminar">${svg('trash', 15)}</button>
      </div>
    </div>`;
  d.querySelectorAll('.u-act').forEach(b => b.onclick = () => utteranceAction(b.dataset.act, u, d));
  return d;
}
function captureEvent(u) {
  const d = el('div', 'utterance');
  d.innerHTML = `<div class="time mono">${esc(u.time)}</div><div class="band" style="background:transparent"></div>
    <div class="event-capture"><span class="thumb"></span><div style="font-size:12.5px;color:var(--text-secondary)"><span style="color:#e6eaf2;font-weight:600">Captura</span>${u.code ? ' <span class="cap-code">' + esc(u.code) + '</span>' : ''}${u.clock ? ' · <span class="cap-clock">' + esc(u.clock) + '</span>' : ''}${u.note ? ' · ' + esc(u.note) : ''}</div></div>`;
  // Carga la imagen real en la miniatura; al hacer clic se amplía (lupa).
  const thumb = d.querySelector('.thumb');
  if (thumb && u.id != null) loadCaptureThumb(thumb, u.id);
  return d;
}
function noteEvent(u) {
  const d = el('div', 'utterance');
  d.innerHTML = `<div class="time mono">${esc(u.time)}</div><div class="band" style="background:var(--warning)"></div>
    <div class="event-note"><strong>Nota</strong><span>${esc(u.text || '')}</span></div>`;
  return d;
}

// V2 — edición de intervención
function utteranceAction(act, u, node) {
  const pyMap = { edit: 'update_utterance', speaker: 'update_utterance', split: 'split_utterance', merge: 'merge_utterances', star: 'toggle_utterance_highlight', del: 'delete_utterance' };
  if (!v2Available(pyMap[act])) {
    toast('info', 'Esta acción de edición requiere backend V2 (' + pyMap[act] + ').');
    return;
  }
  if (act === 'del') {
    confirmModal('Eliminar intervención', '¿Eliminar esta intervención? Esta acción no se puede deshacer.', 'Eliminar', async () => {
      const r = await api.v2.deleteUtterance(u.id);
      if (r && r.ok) { node.remove(); toast('ok', 'Intervención eliminada'); }
      else toast('err', 'No se pudo eliminar la intervención');
    });
  } else if (act === 'speaker') {
    speakerMenu(u, node);
  } else if (act === 'edit') {
    inlineEdit(u, node);
  } else if (act === 'star') {
    api.v2.toggleHighlight(u.id).then(r => {
      if (!r || !r.ok) { toast('err', 'No se pudo marcar la intervención'); return; }
      u.highlighted = r.highlighted;
      node.classList.toggle('highlighted', r.highlighted);
      const b = node.querySelector('[data-act="star"]');
      if (b) b.classList.toggle('on', r.highlighted);
      toast('ok', r.highlighted ? 'Marcada como importante' : 'Marca quitada');
    });
  }
}
function inlineEdit(u, node) {
  const body = node.querySelector('.body-u');
  const orig = u.text;
  body.innerHTML = `<div class="who">${esc(u.display_name || (u.speaker === 'me' ? 'Yo' : 'Los demás'))}</div>
    <textarea class="field" style="height:auto;min-height:60px;padding:9px;resize:vertical">${esc(orig)}</textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary" data-s>Guardar</button><button class="btn" data-c>Cancelar</button><span style="margin-left:auto;font-size:11px;color:var(--text-muted);align-self:center">tiempo original conservado</span></div>`;
  body.querySelector('[data-c]').onclick = () => openMeeting(STATE.selMeeting, true);
  body.querySelector('[data-s]').onclick = async () => {
    const v = body.querySelector('textarea').value.trim();
    await api.v2.updateUtterance(u.id, { text: v }); toast('ok', 'Cambios guardados'); openMeeting(STATE.selMeeting, true);
  };
  body.querySelector('textarea').focus();
}

/* Editor de participantes (lista por iniciativa): añadir/pegar varios, renombrar,
   marcar quién eres tú y eliminar. Al cerrar, refresca la transcripción. */
function participantsModal(t) {
  const iid = t.initiative_id;
  let dirty = false;
  const m = el('div', 'modal wide');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Participantes');
  m.innerHTML = `
    <div class="modal-head"><h3>Participantes</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <label>Añadir participantes</label>
      <textarea id="partAdd" class="field" style="height:auto;min-height:54px;padding:9px" placeholder="Un nombre completo por línea (ej. Víctor Marquina)"></textarea>
      <div class="row-inline" style="margin:8px 0 16px"><div class="help" style="flex:1">Escribe o pega varios, uno por línea. Usa nombre y apellido para no confundir a personas con el mismo nombre.</div><button class="btn btn-primary" id="partAddBtn">Añadir</button></div>
      <label>Lista · marca con el círculo quién eres tú</label>
      <div id="partList" style="display:flex;flex-direction:column;gap:6px;margin-top:8px"></div>
    </div>`;
  const listEl = m.querySelector('#partList');
  function draw(parts) {
    listEl.replaceChildren();
    if (!parts.length) { listEl.innerHTML = '<p style="font-size:13px;color:var(--text-muted);margin:4px 0">Aún no hay participantes.</p>'; return; }
    parts.forEach(p => {
      const row = el('div', 'part-row');
      row.innerHTML = `<label class="part-me" title="Soy yo (mi micrófono)"><input type="radio" name="me" ${p.is_me ? 'checked' : ''}><span>tú</span></label>
        <input class="field part-name" value="${esc(p.name)}">
        <button class="icon-btn sm part-del" title="Eliminar" aria-label="Eliminar">${svg('x', 13)}</button>`;
      row.querySelector('input[type=radio]').onclick = async () => { await api.v2.setMeParticipant(iid, p.id); dirty = true; reload(); };
      const nameInput = row.querySelector('.part-name');
      nameInput.onblur = async () => { const v = nameInput.value.trim(); if (v && v !== p.name) { await api.v2.renameParticipant(p.id, v); dirty = true; } };
      row.querySelector('.part-del').onclick = async () => { await api.v2.deleteParticipant(p.id); dirty = true; reload(); };
      listEl.appendChild(row);
    });
  }
  async function reload() { const res = await api.v2.listParticipants(iid); draw((res && res.participants) || []); }
  m.querySelector('#partAddBtn').onclick = async () => {
    const txt = m.querySelector('#partAdd').value;
    if (!txt.trim()) return;
    await api.v2.addParticipants(iid, txt);
    m.querySelector('#partAdd').value = '';
    dirty = true; reload();
  };
  const close = () => { closeModal(); if (dirty) openMeeting(STATE.selMeeting, true); };
  m.querySelector('[data-x]').onclick = close;
  draw((t && t.participants) || []);
  openModal(m);
  $('#overlayRoot').onclick = (e) => { if (e.target === $('#overlayRoot')) close(); };
}

/* Selector de hablante: lista los participantes de la iniciativa para asignar la
   frase a uno concreto (o dejarla "Sin asignar / Los demás"). */
function speakerMenu(u, node) {
  const parts = (STATE.transcript && STATE.transcript.participants) || [];
  const m = el('div', 'modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Asignar hablante');
  const rows = parts.map(p =>
    `<button class="btn part-pick ${u.participant_id === p.id ? 'is-current' : ''}" data-pid="${p.id}">${esc(p.name)}${p.is_me ? ' · tú' : ''}</button>`
  ).join('');
  m.innerHTML = `
    <div class="modal-head"><h3>Asignar hablante</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      ${parts.length ? '<div class="part-pick-list">' + rows + '</div>'
        : '<p style="font-size:13px;color:var(--text-secondary);margin:0 0 8px">Aún no hay participantes. Añádelos en el panel <b>Participantes</b>, arriba.</p>'}
      <button class="btn part-pick ${!u.participant_id ? 'is-current' : ''}" data-pid="" style="margin-top:8px;width:100%">Sin asignar (Los demás)</button>
    </div>`;
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelectorAll('.part-pick').forEach(b => b.onclick = async () => {
    const pid = b.dataset.pid === '' ? null : Number(b.dataset.pid);
    const r = await api.v2.assignUtteranceParticipant(u.id, pid);
    if (r && r.ok) { closeModal(); openMeeting(STATE.selMeeting, true); }
    else toast('err', 'No se pudo asignar el hablante');
  });
  openModal(m);
}

// V2 — pestañas de conocimiento
function pendingPanel(title, pyMethod, cta, onGenerate) {
  const d = el('div', 'reading');
  const has = v2Available(pyMethod);
  d.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px"><div style="font-size:14px;font-weight:700">${title}</div>${has ? '' : '<span class="pending-badge">PENDIENTE · PYTHON</span>'}</div>`;
  const box = el('div'); box.style.cssText = 'border:1px solid var(--border-subtle);border-radius:var(--r-lg);background:var(--bg-surface);padding:22px;text-align:center';
  box.innerHTML = `<p style="color:var(--text-secondary);font-size:13px;margin:0 0 14px">${has ? 'Genera el análisis de esta reunión.' : 'Esta vista se activará cuando exista el método <span class="mono">' + pyMethod + '()</span> en el backend.'}</p>`;
  const btn = el('button', 'btn btn-primary', cta);
  if (!has) btn.classList.add('is-disabled');
  btn.onclick = onGenerate;
  box.appendChild(btn);
  d.appendChild(box);
  return d;
}
function renderSummary() {
  return pendingPanel('Resumen', 'generate_meeting_summary', 'Generar resumen', async (e) => {
    const b = e.currentTarget; b.classList.add('is-loading');
    try { await api.v2.generateSummary(STATE.selMeeting); toast('ok', 'Resumen generado'); }
    catch (err) { toast('err', 'No se pudo generar el resumen'); }
    b.classList.remove('is-loading');
  });
}
function renderDecisions() { return pendingPanel('Decisiones', 'get_meeting_insights', 'Detectar decisiones', () => {}); }
function renderTasks() { return pendingPanel('Tareas', 'get_meeting_insights', 'Extraer tareas', () => {}); }

function renderFiles() {
  const d = el('div', 'reading');
  const assets = (STATE.transcript && STATE.transcript.assets) || {};
  const caps = assets.captures || [];
  const notes = assets.notes || [];
  d.innerHTML = '<div class="section-label" style="margin:0 0 12px">CAPTURAS</div>';
  const grid = el('div', 'grid3');
  caps.forEach(c => {
    const x = el('div', 'cap-card');
    const ph = el('div', 'ph');
    // WebView2 no carga file:// como sub-recurso → pedimos la imagen en base64.
    loadCaptureThumb(ph, c.id);
    x.appendChild(ph);
    x.appendChild(el('div', 'cap-meta', `${c.code ? '<span class="cap-code">' + esc(c.code) + '</span> ' : ''}<span class="mono">${esc(c.time)}</span>${c.note ? ' · ' + esc(c.note) : ''}`));
    grid.appendChild(x);
  });
  if (!caps.length) grid.appendChild(el('p', null, '<span style="color:var(--text-muted);font-size:13px">No hay capturas en esta reunión.</span>'));
  d.appendChild(grid);
  d.appendChild(el('div', 'section-label', 'NOTAS')).style.margin = '18px 0 8px';
  if (notes.length) notes.forEach(n => {
    const row = el('div', 'row-card'); row.style.cursor = 'default';
    row.innerHTML = `<div class="mono" style="color:var(--warning);font-size:12px">${esc(n.time)}</div><div class="rc-body"><div class="rc-title" style="font-size:13px">${esc(n.text)}</div></div>`;
    d.appendChild(row);
  });
  else d.appendChild(el('p', null, '<span style="color:var(--text-muted);font-size:13px">No hay notas en esta reunión.</span>'));
  if (assets.video) {
    d.appendChild(el('div', 'section-label', 'VIDEO')).style.margin = '18px 0 8px';
    const a = el('div', 'row-card'); a.style.cursor = 'default';
    a.innerHTML = `<span style="width:30px;height:30px;border-radius:7px;border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center">${svg('play', 13)}</span><div class="rc-body"><div class="rc-title" style="font-size:13px">${esc(String(assets.video).split(/[\\/]/).pop())}</div><div class="rc-meta">Grabación de pantalla asociada</div></div>`;
    a.onclick = () => api.openPath(assets.video); d.appendChild(a);
  }
  return d;
}

/* Pide la imagen en base64 y la pone de fondo; al hacer clic, la amplía. */
async function loadCaptureThumb(ph, captureId) {
  try {
    const r = await api.getCaptureImage(captureId);
    if (!r || !r.data_url) return;
    ph.style.backgroundImage = `url("${r.data_url}")`;
    ph.style.backgroundSize = 'cover';
    ph.style.backgroundPosition = 'center';
    ph.style.cursor = 'zoom-in';
    ph.onclick = () => openLightbox(r.data_url);
  } catch (e) { /* sin imagen: queda el marcador por defecto */ }
}

function openLightbox(dataUrl) {
  const m = el('div', 'lightbox');
  m.innerHTML = `<img src="${dataUrl}" alt="Captura ampliada">`;
  m.onclick = () => { m.remove(); };
  document.body.appendChild(m);
}

function viewSearch() {
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  const advanced = v2Available('search_advanced');
  head.innerHTML = `
    <div class="mhead-row"><h1 class="mtitle-h">Resultados</h1><div class="spacer"></div><button class="btn btn-ghost" id="clearSearch">Limpiar y volver al árbol</button></div>
    <div class="search-head"><span style="font-size:12px;color:var(--text-muted)"><b style="color:#e6eaf2" id="resCount">0</b> resultados para “<span id="resQuery"></span>”</span>${advanced ? '' : '<span class="pending-badge">FILTROS · PENDIENTE · PYTHON</span>'}</div>
    <div class="filters">
      <button class="chip">Iniciativa ▾</button><button class="chip">Fecha ▾</button><button class="chip">Hablante ▾</button>
      <span class="seg"><span class="on">Frase</span><span>Nota</span></span>
    </div>
    <div style="height:14px"></div>`;
  const content = el('div', 'content');
  const list = el('div'); list.id = 'searchResults';
  content.appendChild(list);
  head.querySelector('#clearSearch').onclick = () => { $('#searchInput').value = ''; backToTree(); };
  wrap.replaceChildren(head, content);
  return wrap;
}

function viewGlossary() {
  const it = STATE.initiatives.find(x => x.id === STATE.selInit);
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  head.innerHTML = `<div class="breadcrumb"><a href="#" id="gBack" style="color:var(--accent);text-decoration:none">‹ ${esc(it ? it.name : '')}</a></div><div class="mhead-row"><h1 class="mtitle-h">Glosario</h1></div><div style="height:14px"></div>`;
  const content = el('div', 'content'); const inner = el('div'); inner.style.maxWidth = '520px';
  const data = STATE.glossary || [];
  const max = Math.max(1, ...data.map(g => g.count));
  data.forEach(g => {
    const row = el('div', 'gloss-row'); row.style.marginBottom = '8px';
    row.innerHTML = `<span class="term">${esc(g.term)}</span><div class="gloss-bar"><i style="width:${Math.round(g.count / max * 100)}%"></i></div><span class="cnt">${g.count}</span>`;
    inner.appendChild(row);
  });
  content.appendChild(inner);
  head.querySelector('#gBack').onclick = (e) => { e.preventDefault(); STATE.screen = 'initiative'; renderMain(); };
  wrap.replaceChildren(head, content);
  return wrap;
}

function viewArchiveTrash(which) {
  const isTrash = which === 'trash';
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  head.innerHTML = `<div class="mhead-row"><h1 class="mtitle-h">${isTrash ? 'Papelera' : 'Archivo'}</h1></div>
    <div class="meta-line" style="font-family:inherit">${isTrash ? 'Elementos eliminados de forma reversible. La eliminación permanente ocurre solo aquí y pide confirmación.' : 'Iniciativas y reuniones archivadas. Se pueden restaurar en cualquier momento.'}</div><div style="height:6px"></div>`;
  const content = el('div', 'content');
  const list = el('div'); list.style.maxWidth = '640px';
  content.appendChild(list);

  api.listLibrary(isTrash ? 'trash' : 'archive').then(items => {
    items = items || [];
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(el('p', null, `<span style="color:var(--text-muted);font-size:13px">${isTrash ? 'La papelera está vacía.' : 'No hay nada archivado.'}</span>`));
      return;
    }
    items.forEach(x => {
      const type = x.kind === 'initiative' ? 'INICIATIVA' : 'REUNIÓN';
      const sub = x.kind === 'initiative' ? ((x.meeting_count || 0) + ' reuniones') : ('en ' + (x.initiative || '—'));
      const c = el('div', 'row-card'); c.style.cursor = 'default';
      c.innerHTML = `<span style="flex:none;font-size:10px;font-weight:700;letter-spacing:.4px;color:var(--text-secondary);border:1px solid var(--border-strong);border-radius:5px;padding:3px 7px">${type}</span>
        <div class="rc-body"><div class="rc-title">${esc(x.title)}</div><div class="rc-meta">${esc(sub)}${x.date ? ' · ' + esc(x.date) : ''}</div></div>
        <div style="display:flex;gap:7px"><button class="btn" data-restore>Restaurar</button>${isTrash ? '<button class="btn btn-danger" data-del>Eliminar</button>' : '<button class="btn" data-trash>A papelera</button>'}</div>`;
      c.querySelector('[data-restore]').onclick = async () => { await api.restoreItem(x.kind, x.id); toast('ok', 'Restaurado'); reloadLibrary(which); refreshAll(); };
      if (isTrash) {
        c.querySelector('[data-del]').onclick = () => confirmModal('Eliminar permanentemente', 'Esta acción no se puede deshacer. Se borrará «' + x.title + '»' + (x.kind === 'initiative' ? ' y todas sus reuniones.' : '.'), 'Eliminar para siempre', async () => { await api.permanentlyDeleteItem(x.kind, x.id); toast('ok', 'Eliminado permanentemente'); reloadLibrary(which); });
      } else {
        c.querySelector('[data-trash]').onclick = async () => { await api.trashItem(x.kind, x.id); toast('ok', 'Movido a la papelera'); reloadLibrary(which); };
      }
      list.appendChild(c);
    });
  });
  wrap.replaceChildren(head, content);
  return wrap;
}

// Recarga la vista de biblioteca actual y refresca los contadores del sidebar.
function reloadLibrary(which) { updateLibraryCounts(); if (STATE.screen === which) renderMain(); }
async function updateLibraryCounts() {
  try {
    const a = await api.listLibrary('archive') || [];
    const t = await api.listLibrary('trash') || [];
    STATE.archiveCount = a.length; STATE.trashCount = t.length;
    const ac = $('#archiveCount'), tc = $('#trashCount');
    if (ac) ac.textContent = a.length; if (tc) tc.textContent = t.length;
  } catch (e) { /* backend sin biblioteca: contadores en 0 */ }
}

/* ---- Barra de acciones contextual ---- */
function renderActionBar() {
  const bar = $('#actionbar');
  const s = STATE.appState;
  const canRecord = !!STATE.selInit;
  if (s === 'idle') {
    bar.innerHTML = `
      <div class="monitor-select">${svg('monitor', 14)}<select id="monitorSel" aria-label="Seleccionar monitor">${monitorOptions()}</select></div>
      <div class="ab-divider"></div>
      <button class="btn btn-record ${canRecord ? '' : 'is-disabled'}" id="abRecord" title="${canRecord ? 'Grabar reunión' : 'Selecciona una iniciativa'}"><span class="dot"></span>Grabar reunión</button>
      <button class="btn btn-lg btn-screen ${canRecord ? '' : 'is-disabled'}" id="abScreen">${svg('monitorDot', 15)}Grabar pantalla</button>
      <button class="btn btn-lg ${canRecord ? '' : 'is-disabled'}" id="abUpload">${svg('upload', 15)}Subir archivo</button>
      <div class="ab-spacer"></div>
      <span class="btn-disabled-hint">${svg('camera', 14)}Captura</span>
      <span class="btn-disabled-hint">${svg('note', 14)}Nota</span>`;
    bar.querySelector('#abRecord').onclick = () => canRecord && withRecordingConsent(() => openRecordingPreflight('meeting', startMeetingRecording));
    bar.querySelector('#abScreen').onclick = () => canRecord && withRecordingConsent(() => openRecordingPreflight('screen', openScreenPanel));
    bar.querySelector('#abUpload').onclick = () => canRecord && doImport(bar.querySelector('#abUpload'));
    const ms = bar.querySelector('#monitorSel'); if (ms) ms.onchange = (e) => STATE.monitorIdx = +e.target.value;
  } else if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') {
    bar.innerHTML = `
      <button class="btn btn-stop" id="abStop"><span class="sq"></span>Detener grabación</button>
      <button class="btn btn-lg" id="abCapture">${svg('camera', 15)}Captura</button>
      ${STATE.monitors.length > 1 ? `<div class="monitor-select" title="Pantalla de la que se toma la captura">${svg('monitor', 14)}<select id="monitorSelRec" aria-label="Pantalla para la captura">${monitorOptions()}</select></div>` : ''}
      <button class="btn btn-lg" id="abNote">${svg('note', 15)}Añadir nota</button>
      <button class="btn btn-lg ${STATE.meetingMicMuted ? 'btn-danger' : ''}" id="abMic">${STATE.meetingMicMuted ? 'Activar mi audio' : 'Silenciar mi audio'}</button>
      <div class="ab-spacer"></div>
      <span class="btn-disabled-hint">Subir archivo · no disponible al grabar</span>`;
    bar.querySelector('#abStop').onclick = stopMeetingRecording;
    bar.querySelector('#abCapture').onclick = doCapture;
    bar.querySelector('#abNote').onclick = promptNote;
    bar.querySelector('#abMic').onclick = toggleMeetingMic;
    const msr = bar.querySelector('#monitorSelRec'); if (msr) msr.onchange = (e) => STATE.monitorIdx = +e.target.value;
  } else if (s === 'processing') {
    const canCancel = v2Available('cancel_current_job');
    bar.innerHTML = `<div class="proc-bar">
      <span class="spinner"></span>
      <div style="font-size:13px;font-weight:600">${esc(STATE.jobStage)}</div>
      <div class="proc-track"><i id="procFill" class="${STATE.jobDeterminate ? '' : 'indeterminate'}" style="width:${STATE.jobDeterminate ? STATE.jobProgress : 35}%"></i></div>
      <div class="mono" id="procPct" style="font-size:12px;color:var(--text-secondary)">${STATE.jobDeterminate ? Math.round(STATE.jobProgress) + '%' : processingElapsed()}</div>
      ${canCancel ? '<button class="btn" id="abCancel">Cancelar</button>' : ''}</div>`;
    const cancel = bar.querySelector('#abCancel'); if (cancel) cancel.onclick = cancelJob;
  } else if (s === 'screen-recording') {
    // El panel modal lleva los controles; la barra queda mínima.
    bar.innerHTML = `<div class="status-rec"><span class="rdot"></span>Grabando pantalla — usa el panel para detener</div>`;
  }
}
function monitorOptions() {
  if (!STATE.monitors.length) return '<option>Pantalla 1</option>';
  return STATE.monitors.map((m) => `<option value="${m.index}" ${m.index === STATE.monitorIdx ? 'selected' : ''}>Pantalla ${m.index} · ${m.width}×${m.height}</option>`).join('');
}

/* ============================================================
   5. SIDEBAR
   ============================================================ */
function renderSidebar() {
  const tree = $('#sidebarTree');
  tree.replaceChildren();
  STATE.initiatives.forEach(it => {
    const open = !!STATE.openInits[it.id];
    const ms = STATE.meetingsByInit[it.id] || [];
    const row = el('div', 'tree-initiative' + (open ? ' open' : '') + (STATE.selInit === it.id && STATE.screen === 'initiative' ? ' selected' : ''));
    row.innerHTML = `<span class="chev">${svg('chevron', 12)}</span><span class="name">${esc(it.name)}</span>${it.pinned ? '<span class="pin-ind" title="Anclada">' + svg('pin', 11) + '</span>' : ''}<span class="count">${ms.length || ''}</span>`;
    row.onclick = () => selectInitiative(it.id);
    row.oncontextmenu = (e) => { e.preventDefault(); openInitiativeMenu(e, it.id); };
    tree.appendChild(row);
    if (open) {
      const sub = el('div', 'tree-meetings');
      let currentMonth = null;
      ms.forEach(m => {
        const month = m.month_label || 'Sin fecha';
        if (month !== currentMonth) {
          currentMonth = month;
          sub.appendChild(el('div', 'tree-month', esc(month)));
        }
        const mr = el('div', 'tree-meeting' + (STATE.selMeeting === m.id ? ' selected' : ''));
        mr.innerHTML = `<span class="stat ${m.status || 'done'}"></span><span class="mtitle">${esc(m.title)}</span>${m.time ? '<span class="mtime">' + esc(m.time) + '</span>' : ''}`;
        mr.onclick = (e) => { e.stopPropagation(); openMeeting(m.id); };
        mr.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); openMeetingMenu(e, m.id); };
        sub.appendChild(mr);
      });
      if (!ms.length) sub.appendChild(el('div', 'tree-meeting', '<span style="color:var(--text-faint);font-size:12px">Sin reuniones</span>'));
      tree.appendChild(sub);
    }
  });
}

async function selectInitiative(id) {
  STATE.selInit = id;
  STATE.openInits[id] = !STATE.openInits[id];
  STATE.screen = 'initiative';
  if (!STATE.meetingsByInit[id]) STATE.meetingsByInit[id] = await api.listMeetings(id) || [];
  renderSidebar(); renderMain(); renderActionBar();
}

async function openMeeting(mid, keepTab) {
  STATE.selMeeting = mid;
  STATE.screen = 'meeting';
  if (!keepTab) STATE.activeTab = 'transcript';
  STATE.transcript = await api.getTranscript(mid);
  renderSidebar(); renderMain();
}

function backToTree() { STATE.screen = STATE.selMeeting ? 'meeting' : (STATE.selInit ? 'initiative' : 'welcome'); renderMain(); }

function applySidebar() {
  document.body.setAttribute('data-sidebar', STATE.sidebarOpen ? 'open' : 'collapsed');
  save('hm.sidebar', STATE.sidebarOpen ? '1' : '0');
}

/* ============================================================
   6. MODALES / TOASTS / MENÚS  (reemplazan prompt/alert)
   ============================================================ */
let _lastFocus = null;
function openModal(node) {
  _lastFocus = document.activeElement;
  const root = $('#overlayRoot');
  root.replaceChildren(node);
  root.hidden = false;
  root.onclick = (e) => { if (e.target === root) closeModal(); };
  const f = node.querySelector('input,textarea,button,select'); if (f) f.focus();
}
function closeModal() {
  const root = $('#overlayRoot');
  root.hidden = true; root.replaceChildren();
  if (_lastFocus && _lastFocus.focus) _lastFocus.focus();
  // Si se estaba grabando pantalla, restaurar su panel (un modal lo había tapado).
  if (STATE.screenPanelOpen) showScreenPanel();
}

function formModal(title, fieldLabel, value, okLabel, onOk, opts) {
  opts = opts || {};
  const m = el('div', 'modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', title);
  m.innerHTML = `
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div><label>${esc(fieldLabel)}</label>${opts.textarea ? `<textarea class="field" style="height:auto;min-height:70px;padding:9px"></textarea>` : `<input class="field" type="text" value="${esc(value || '')}">`}
      <div class="field-error"></div></div>
    </div>
    <div class="modal-foot"><button class="btn" data-c>Cancelar (Esc)</button><button class="btn btn-primary" data-ok>${esc(okLabel)} (⏎)</button></div>`;
  const input = m.querySelector('.field'); const err = m.querySelector('.field-error');
  const submit = async () => {
    const v = input.value.trim();
    if (!v) { input.classList.add('invalid'); err.textContent = 'Este campo no puede estar vacío.'; input.focus(); return; }
    const okBtn = m.querySelector('[data-ok]'); okBtn.classList.add('is-loading');
    try { await onOk(v); closeModal(); } catch (e) { okBtn.classList.remove('is-loading'); err.textContent = 'No se pudo completar. ' + (e && e.message || ''); }
  };
  m.querySelector('[data-ok]').onclick = submit;
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-x]').onclick = closeModal;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !opts.textarea) { e.preventDefault(); submit(); } });
  openModal(m);
}

function confirmModal(title, body, okLabel, onOk, danger) {
  const m = el('div', 'modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', title);
  m.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body"><p style="margin:0;font-size:13px;color:var(--text-secondary);line-height:1.5">${esc(body)}</p></div>
    <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn ${danger === false ? 'btn-primary' : 'btn-danger'}" data-ok>${esc(okLabel)}</button></div>`;
  m.querySelector('[data-ok]').onclick = async () => { await onOk(); closeModal(); };
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-x]').onclick = closeModal;
  openModal(m);
}

function toast(kind, msg, action) {
  const t = el('div', 'toast ' + (kind || 'info'));
  const i = kind === 'err' ? svg('x', 12) : kind === 'info' ? svg('check', 12) : svg('check', 12);
  t.innerHTML = `<span class="ti">${i}</span><span class="tmsg">${esc(msg)}</span>${action ? `<span class="taction">${esc(action)}</span>` : ''}`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 3600);
}

let _ctxOpen = null;
function openMenu(e, items) {
  closeMenu();
  const menu = el('div', 'ctx-menu');
  items.forEach(it => {
    if (it.sep) { menu.appendChild(el('div', 'ctx-sep')); return; }
    const mi = el('div', 'ctx-item' + (it.danger ? ' danger' : ''));
    mi.innerHTML = (it.icon ? svg(it.icon, 14) : '') + '<span>' + esc(it.label) + '</span>';
    if (it.pending) mi.innerHTML += '<span class="pending-badge" style="margin-left:auto">V2</span>';
    mi.onclick = () => { closeMenu(); it.onClick && it.onClick(); };
    menu.appendChild(mi);
  });
  document.body.appendChild(menu);
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  _ctxOpen = menu;
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}
function closeMenu() { if (_ctxOpen) { _ctxOpen.remove(); _ctxOpen = null; } }

function openInitiativeMenu(e, iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  const pinned = !!(it && it.pinned);
  openMenu(e, [
    { label: pinned ? 'Desanclar iniciativa' : 'Anclar iniciativa', icon: 'pin', onClick: () => toggleInitiativePin(iid) },
    { label: 'Ver glosario', icon: 'search', onClick: () => openGlossary(iid) },
    { label: 'Renombrar iniciativa', icon: 'edit', onClick: () => promptRenameInitiative(iid) },
    { label: 'Exportar a otra carpeta', icon: 'download', onClick: () => exportInitiativeTo(iid) },
    { sep: true },
    { label: 'Archivar iniciativa', icon: 'archive', onClick: () => archiveInitiative(iid) },
    { label: 'Enviar a la papelera', icon: 'trash', danger: true, onClick: () => deleteInitiative(iid) },
  ]);
}
function openMeetingMenu(e, mid) {
  openMenu(e, [
    { label: 'Renombrar reunión', icon: 'edit', onClick: () => promptRenameMeeting(mid) },
    { label: 'Mover a otra iniciativa', icon: 'folder', onClick: () => promptMoveMeeting(mid) },
    { label: 'Exportar a otra carpeta', icon: 'download', onClick: () => exportMeetingTo(mid) },
    { sep: true },
    { label: 'Archivar reunión', icon: 'archive', onClick: () => archiveMeeting(mid) },
    { label: 'Enviar a la papelera', icon: 'trash', danger: true, onClick: () => deleteMeeting(mid) },
  ]);
}

/* ============================================================
   7. ACCIONES (contrato actual)
   ============================================================ */
function promptNewInitiative() {
  formModal('Nueva iniciativa', 'Nombre de la iniciativa', '', 'Crear', async (name) => {
    const it = await api.createInitiative(name);
    if (it) { STATE.initiatives.push(it); STATE.meetingsByInit[it.id] = []; renderSidebar(); toast('ok', 'Iniciativa creada'); selectInitiative(it.id); }
  });
}
function promptRenameInitiative(iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  formModal('Renombrar iniciativa', 'Nuevo nombre', it ? it.name : '', 'Guardar', async (name) => {
    await api.renameInitiative(iid, name); if (it) it.name = name; renderSidebar(); renderMain(); toast('ok', 'Iniciativa renombrada');
  });
}
function promptRenameMeeting(mid) {
  formModal('Renombrar reunión', 'Nuevo título', '', 'Guardar', async (title) => {
    await api.renameMeeting(mid, title);
    for (const k in STATE.meetingsByInit) { const m = STATE.meetingsByInit[k].find(x => x.id === mid); if (m) m.title = title; }
    if (STATE.transcript) STATE.transcript.title = title;
    renderSidebar(); renderMain(); toast('ok', 'Reunión renombrada');
  });
}
function promptMoveMeeting(mid) {
  const m = el('div', 'modal'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Mover reunión');
  const opts = STATE.initiatives.map(i => `<option value="${i.id}">${esc(i.name)}</option>`).join('');
  m.innerHTML = `<div class="modal-head"><h3>Mover a otra iniciativa</h3><button class="icon-btn sm" data-x>${svg('x', 14)}</button></div>
    <div class="modal-body"><label>Iniciativa destino</label><select class="field" id="moveSel">${opts}</select></div>
    <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn btn-primary" data-ok>Mover</button></div>`;
  m.querySelector('[data-ok]').onclick = async () => { await api.moveMeeting(mid, m.querySelector('#moveSel').value); closeModal(); toast('ok', 'Reunión movida'); refreshAll(); };
  m.querySelector('[data-c]').onclick = closeModal; m.querySelector('[data-x]').onclick = closeModal;
  openModal(m);
}
function promptNote() {
  formModal('Añadir nota', 'Nota rápida (se vincula al momento actual)', '', 'Guardar', async (text) => {
    await api.addNote(text); toast('ok', 'Nota añadida');
  }, { textarea: true });
}

async function openGlossary(iid) {
  STATE.selInit = iid; STATE.glossary = await api.getGlossary(iid) || []; STATE.screen = 'glossary'; renderMain();
}

async function doExportMeeting(btn) {
  btn.classList.add('is-loading');
  try {
    const r = await api.exportTranscript(STATE.selMeeting);
    if (r && r.cancelled) return;
    if (!r || !r.ok || !r.path) throw new Error((r && r.error) || 'No se guardó el archivo.');
    if (r.format === 'zip') {
      const detail = `${r.captures || 0} imágenes · ${r.files || 0} archivos`;
      toast('ok', `ZIP guardado · ${detail}`);
    } else {
      toast('ok', 'Transcripción TXT guardada');
    }
  }
  catch (e) { toast('err', 'No se pudo guardar la transcripción'); }
  finally { btn.classList.remove('is-loading'); }
}
async function doOpenFolder(btn) {
  btn.classList.add('is-loading');
  try { await api.openMeetingFolder(STATE.selMeeting); }
  catch (e) { toast('err', 'No se pudo abrir la carpeta'); }
  btn.classList.remove('is-loading');
}
async function exportMeetingTo(mid) { const r = await api.exportMeetingTo(mid); if (r && r.ok) toast('ok', 'Exportado a ' + r.path); }
async function exportInitiativeTo(iid) { const r = await api.exportInitiativeTo(iid); if (r && r.ok) toast('ok', 'Exportado a ' + r.path); }

async function doImport(btn) {
  btn.classList.add('is-loading');
  beginProcessing('Seleccionando y procesando archivo');
  try {
    const r = await api.importMedia(STATE.selInit);
    endProcessing();
    if (r && r.error) { toast('err', 'No se pudo importar: ' + r.error); }
    else if (r && r.ok) {
      await refreshMeetings(STATE.selInit);
      if (r.meeting_id) await openMeeting(r.meeting_id);
      toast('ok', 'Archivo importado y transcrito');
    }
  } catch (e) { toast('err', 'Error al importar el archivo'); }
  if (STATE.appState === 'processing') endProcessing();
  btn.classList.remove('is-loading');
}

/* ============================================================
   7b. GRABACIÓN DE REUNIÓN
   ============================================================ */
/* Aviso de consentimiento antes de la PRIMERA grabación: grabar a otras personas
   puede requerir su permiso. Solo se muestra una vez (se guarda en ajustes). */
function withRecordingConsent(proceed) {
  if (STATE.consentSeen) return proceed();
  const run = (seen) => {
    if (seen) { STATE.consentSeen = true; return proceed(); }
    confirmModal('Antes de grabar',
      'Grabar a otras personas puede requerir su consentimiento según las leyes de tu país o región. Asegúrate de informarles y de tener su permiso antes de grabar. Eres responsable de obtenerlo.',
      'Entendido, continuar', async () => {
        await api.markConsentSeen(); STATE.consentSeen = true;
        setTimeout(proceed, 0);   // tras cerrarse este aviso, abre lo siguiente
      }, false);
  };
  if (STATE.settings && 'consent_seen' in STATE.settings) run(STATE.settings.consent_seen);
  else api.getSettings().then(s => { STATE.settings = s || {}; run(!!(s && s.consent_seen)); });
}

function startMeetingRecording() {
  if (STATE.appState !== 'idle') return;
  formModal('Nueva reunión', 'Título de la reunión', 'Reunión', 'Empezar a grabar', beginMeetingRecording);
}
async function beginMeetingRecording(title) {
  const r = await api.startRecording(STATE.selInit, title);
  if (!r || r.ok === false) throw new Error((r && r.error) || 'No se pudo iniciar la grabación');
  STATE.selMeeting = r.meeting_id;
  STATE.transcript = { title: r.title, started_at: r.started_at, utterances: [], assets: { captures: [], notes: [], video: null }, video_path: null };
  STATE.screen = 'meeting';
  STATE.meetingMicMuted = !!r.mic_muted;
  STATE.provider = STATE.provider || 'auto';
  startTimer();
  setAppState(r && r.provider === 'replicate' ? 'recording-cloud' :
    (r && r.live === false ? 'recording-local' : 'recording'));
}
async function toggleMeetingMic() {
  const next = !STATE.meetingMicMuted;
  const r = await api.toggleMeetingMicMute(next);
  if (!r || r.ok === false) { toast('err', (r && r.error) || 'No se pudo cambiar el micrófono'); return; }
  STATE.meetingMicMuted = next;
  renderActionBar();
  toast('info', next ? 'Tu micrófono está silenciado' : 'Tu micrófono está activo');
}
async function stopMeetingRecording() {
  stopTimer();
  try {
    const r = await api.stopRecording();
    // La transcripción va en segundo plano: volvemos a 'idle' al instante para
    // poder empezar otra grabación sin esperar.
    STATE.screen = STATE.selInit ? 'initiative' : 'welcome';
    setAppState('idle');
    await refreshMeetings(STATE.selInit);
    if (r && r.ok) toast('ok', 'Grabación detenida · se transcribe en segundo plano');
    else toast('err', (r && r.error) || 'No se pudo finalizar la reunión');
  } catch (e) {
    setAppState('idle');
    toast('err', 'No se pudo finalizar la reunión');
  }
}
function doCapture() {
  // Ctrl+Shift+S está reservado globalmente por la app.
  api.takeCapture(STATE.monitorIdx).then(() => toast('ok', 'Captura tomada'));
}

/* ============================================================
   7c. GRABACIÓN DE PANTALLA (V2)
   ============================================================ */
async function openScreenPanel() {
  if (STATE.appState !== 'idle') return;
  STATE.micMuted = false; STATE.recElapsed = 0;
  const r = await api.startScreenRecording(STATE.selInit, STATE.monitorIdx);
  if (!r || r.ok === false) { toast('err', (r && r.error) || 'No se pudo iniciar la grabación de pantalla'); return; }
  STATE.micMuted = !!r.mic_muted;
  STATE.screenMeetingId = r.meeting_id || null;
  startTimer();
  setAppState('screen-recording');
  showScreenPanel();
}
function showScreenPanel() {
  STATE.screenPanelOpen = true;
  const m = el('div', 'modal screen-panel');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Grabando pantalla');
  m.innerHTML = `
    <div class="modal-head">
      <span class="rec-badge"><span class="rdot"></span>REC</span>
      <span class="rec-clock" id="screenClock">${fmt(STATE.recElapsed)}</span>
      <div class="monitor-select" style="margin-left:auto">${svg('monitor', 14)}<select id="scMon" aria-label="Pantalla a grabar">${monitorOptions()}</select></div>
    </div>
    <div class="screen-setup">
      <input id="scName" class="field" placeholder="Nombre de la reunión" autocomplete="off">
      <div class="monitor-select screen-fit-select" title="Cómo encajar la pantalla en el vídeo">
        <span>Encuadre</span>
        <select id="scFit" aria-label="Encuadre de la pantalla">
          <option value="fit" ${STATE.screenScaleMode === 'fit' ? 'selected' : ''}>Ajustar</option>
          <option value="fill" ${STATE.screenScaleMode === 'fill' ? 'selected' : ''}>Rellenar</option>
          <option value="stretch" ${STATE.screenScaleMode === 'stretch' ? 'selected' : ''}>Estirar</option>
        </select>
      </div>
    </div>
    <div class="screen-preview"><span class="tag-tl">preview en vivo · ~3–4 fps</span><span class="tag-bottom">no representa el frame rate final (30 fps)</span></div>
    <div class="warn-note">${svg('warn', 15)}<span>Al cambiar a una pantalla de otro tamaño: Ajustar conserva todo; Rellenar recorta los bordes; Estirar puede deformar.</span></div>
    <div style="padding:14px 20px 18px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-stop" id="scStop"><span class="sq"></span>Detener vídeo</button>
      <button class="btn btn-lg ${STATE.micMuted ? 'btn-danger' : ''}" id="scMic">${STATE.micMuted ? 'Activar micro' : 'Silenciar micro'}</button>
      <button class="btn btn-lg" id="scCap">${svg('camera', 15)}Captura</button>
      <button class="btn btn-lg" id="scNote">${svg('note', 15)}Nota</button>
      <div style="flex:1"></div><span style="font-size:11px;color:var(--text-muted)">Crea reunión · transcripción opcional</span>
    </div>`;
  m.querySelector('#scStop').onclick = stopScreenRecording;
  m.querySelector('#scMic').onclick = (e) => {
    STATE.micMuted = !STATE.micMuted;
    api.toggleScreenMicMute(STATE.micMuted);
    e.currentTarget.textContent = STATE.micMuted ? 'Activar micro' : 'Silenciar micro';
    e.currentTarget.classList.toggle('btn-danger', STATE.micMuted);
  };
  m.querySelector('#scCap').onclick = () => api.takeCapture(STATE.monitorIdx).then(() => toast('ok', 'Captura guardada'));
  m.querySelector('#scNote').onclick = () => promptNote();
  m.querySelector('#scMon').onchange = (e) => { STATE.monitorIdx = +e.target.value; api.setScreenMonitor(STATE.monitorIdx); };
  m.querySelector('#scFit').onchange = (e) => {
    STATE.screenScaleMode = e.target.value;
    save('hm.screenScaleMode', STATE.screenScaleMode);
    api.setScreenScaleMode(STATE.screenScaleMode);
    applyScreenPreviewFit(m.querySelector('.screen-preview'));
  };
  api.setScreenScaleMode(STATE.screenScaleMode);
  applyScreenPreviewFit(m.querySelector('.screen-preview'));
  // Nombre de la reunión: se guarda al salir del campo (rename en caliente).
  m.querySelector('#scName').onblur = (e) => {
    const v = e.target.value.trim();
    if (v && STATE.screenMeetingId) api.renameMeeting(STATE.screenMeetingId, v);
  };
  const root = $('#overlayRoot'); root.replaceChildren(m); root.hidden = false; root.onclick = null;
}
async function stopScreenRecording() {
  STATE.screenPanelOpen = false;   // evitar que closeModal re-muestre el panel
  // Aplica el nombre escrito en el panel (si lo hay) antes de cerrar.
  const nameField = document.getElementById('scName');
  if (nameField && nameField.value.trim() && STATE.screenMeetingId) {
    api.renameMeeting(STATE.screenMeetingId, nameField.value.trim());
  }
  stopTimer();
  closeModal();
  setAppState('idle');
  let res = null;
  try { res = await api.stopScreenRecording(); } catch (e) {}
  STATE.screenMeetingId = null;
  if (res && res.ok) {
    // El muxeo va en segundo plano; no bloqueamos. Avisará onScreenVideoSaved.
    toast('info', 'Guardando el vídeo en segundo plano… puedes seguir usando la app');
    await refreshMeetings(STATE.selInit);
  } else {
    toast('err', (res && res.error) || 'No se pudo detener la grabación');
  }
}
// El vídeo terminó de guardarse/mezclarse en segundo plano.
window.onScreenVideoSaved = async function (meetingId, initiativeId, ok, audio) {
  if (initiativeId && STATE.meetingsByInit[initiativeId] !== undefined) {
    await refreshMeetings(initiativeId);
  } else if (STATE.selInit) {
    await refreshMeetings(STATE.selInit);
  }
  if (ok) toast(audio === false ? 'info' : 'ok', audio === false ? 'Vídeo guardado (sin sonido)' : 'Vídeo guardado');
  else toast('err', 'No se pudo guardar el vídeo');
};

/* ============================================================
   7d. PROCESAMIENTO (con barra; Cancelar es V2)
   ============================================================ */
let _proc = null;
function processingElapsed() {
  if (!STATE.jobStartedAt) return '0 s';
  return Math.max(0, Math.floor((Date.now() - STATE.jobStartedAt) / 1000)) + ' s';
}
function beginProcessing(stage) {
  clearInterval(STATE.jobClock);
  STATE.jobStage = stage;
  STATE.jobProgress = 0;
  STATE.jobDeterminate = false;
  STATE.jobStartedAt = Date.now();
  setAppState('processing');
  STATE.jobClock = setInterval(() => {
    if (STATE.appState !== 'processing') return;
    const pct = $('#procPct');
    if (pct && !STATE.jobDeterminate) pct.textContent = processingElapsed();
    renderTopStatus();
  }, 1000);
}
function endProcessing() {
  clearInterval(STATE.jobClock);
  STATE.jobClock = null;
  STATE.jobStartedAt = 0;
  setAppState('idle');
}
function runProcessing(stage, onDone) {
  beginProcessing(stage);
  STATE.jobDeterminate = true;
  clearInterval(_proc);
  _proc = setInterval(() => {
    STATE.jobProgress = Math.min(100, STATE.jobProgress + Math.random() * 12 + 6);
    const f = $('#procFill'), p = $('#procPct');
    if (f) f.style.width = STATE.jobProgress + '%';
    if (p) p.textContent = Math.round(STATE.jobProgress) + '%';
    renderTopStatus();
    if (STATE.jobProgress >= 100) {
      clearInterval(_proc);
      setTimeout(() => { endProcessing(); onDone && onDone(); }, 360);
    }
  }, 430);
}
function cancelJob() {
  if (!v2Available('cancel_current_job')) { toast('info', 'Cancelar requiere backend V2 (cancel_current_job).'); }
  clearInterval(_proc);
  api.v2.cancelCurrentJob().catch(() => {});
  endProcessing(); toast('info', 'Operación cancelada');
}

/* ---- Cronómetro ---- */
function tickTimer() {
  // El tiempo se calcula desde la hora de inicio real (no sumando ticks): si el
  // sistema ralentiza el temporizador al minimizar la ventana, al volver muestra
  // igualmente el tiempo correcto en vez de atrasarse.
  if (!STATE.recStartedAt) return;
  STATE.recElapsed = Math.floor((Date.now() - STATE.recStartedAt) / 1000);
  renderTopStatus();
  const c = $('#screenClock'); if (c) c.textContent = fmt(STATE.recElapsed);
}
function startTimer() { STATE.recStartedAt = Date.now(); STATE.recElapsed = 0; clearInterval(STATE.recTimer); STATE.recTimer = setInterval(tickTimer, 1000); }
function stopTimer() { clearInterval(STATE.recTimer); STATE.recStartedAt = 0; }
// Al volver a enfocar/mostrar la ventana, corrige el reloj al instante.
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTimer(); });
window.addEventListener('focus', tickTimer);
function fmt(s) { const m = Math.floor(s / 60); return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

/* ============================================================
   7e. Iniciativas/reuniones V2 (archivar/eliminar)
   ============================================================ */
function _afterRemoveFromTree(iid) {
  // Si la iniciativa abierta se archivó/eliminó, volver a la bienvenida.
  if (iid && STATE.selInit === iid) { STATE.selInit = null; STATE.selMeeting = null; STATE.screen = 'welcome'; }
}
async function toggleInitiativePin(iid) {
  const r = await api.toggleInitiativePin(iid);
  if (!r || !r.ok) { toast('err', 'No se pudo anclar la iniciativa'); return; }
  STATE.initiatives = await api.listInitiatives() || [];   // reordena: ancladas arriba
  renderSidebar();
  toast('ok', r.pinned ? 'Iniciativa anclada' : 'Iniciativa desanclada');
}
function archiveInitiative(iid) {
  confirmModal('Archivar iniciativa', 'Se moverá al Archivo. Podrás restaurarla cuando quieras.', 'Archivar', async () => {
    const r = await api.archiveItem('initiative', iid);
    if (r && r.ok === false) { toast('err', r.error || 'No se pudo archivar'); return; }
    toast('ok', 'Iniciativa archivada'); _afterRemoveFromTree(iid); STATE.initiatives = await api.listInitiatives() || []; renderSidebar(); renderMain(); updateLibraryCounts();
  }, false);
}
function deleteInitiative(iid) {
  confirmModal('Enviar a la papelera', 'Se moverá a la Papelera con sus reuniones. Podrás restaurarla.', 'Mover a papelera', async () => {
    const r = await api.trashItem('initiative', iid);
    if (r && r.ok === false) { toast('err', r.error || 'No se pudo mover'); return; }
    toast('ok', 'Iniciativa movida a la papelera'); _afterRemoveFromTree(iid); STATE.initiatives = await api.listInitiatives() || []; renderSidebar(); renderMain(); updateLibraryCounts();
  });
}
function archiveMeeting(mid) {
  confirmModal('Archivar reunión', 'Se moverá al Archivo. Podrás restaurarla.', 'Archivar', async () => {
    const r = await api.archiveItem('meeting', mid);
    if (r && r.ok === false) { toast('err', r.error || 'No se pudo archivar'); return; }
    toast('ok', 'Reunión archivada'); if (STATE.selMeeting === mid) backToTree(); refreshAll(); updateLibraryCounts();
  }, false);
}
function deleteMeeting(mid) {
  confirmModal('Enviar a la papelera', 'Se moverá a la Papelera. Podrás restaurarla.', 'Mover a papelera', async () => {
    const r = await api.trashItem('meeting', mid);
    if (r && r.ok === false) { toast('err', r.error || 'No se pudo mover'); return; }
    toast('ok', 'Reunión movida a la papelera'); if (STATE.selMeeting === mid) backToTree(); refreshAll(); updateLibraryCounts();
  });
}

/* ============================================================
   8. BÚSQUEDA
   ============================================================ */
async function runSearch(q) {
  if (!q || !q.trim()) { backToTree(); return; }
  STATE.screen = 'search'; renderMain();
  const results = await api.search(q.trim()) || [];
  $('#resCount').textContent = results.length;
  $('#resQuery').textContent = q.trim();
  const list = $('#searchResults'); list.replaceChildren();
  results.forEach(r => {
    const c = el('div', 'result');
    const kind = r.kind || r.type || 'frase';
    const speaker = kind === 'nota' ? 'NOTA' : (r.speaker === 'me' ? 'YO' : 'LOS DEMÁS');
    c.innerHTML = `<div class="res-meta">${esc(r.initiative)} › ${esc(r.meeting_title || r.meeting || '')} · ${esc(r.date)} · ${esc(kind)} · ${speaker}</div><div class="res-text">${highlight(r.text, q.trim())}</div>`;
    c.onclick = () => { if (r.meeting_id) openMeeting(r.meeting_id); };
    list.appendChild(c);
  });
  if (!results.length) list.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin resultados.</p>';
}
// Resaltado SEGURO: escapa primero, marca después (sin innerHTML del usuario).
function highlight(text, q) {
  const safe = esc(text);
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

/* ============================================================
   9. GLOBALS QUE PYTHON LLAMA  (deben existir con estos nombres)
   ============================================================ */
// Python inyecta intervenciones en vivo durante grabación local.
window.addUtterance = function (speaker, text) {
  if (!STATE.transcript) STATE.transcript = { title: '', started_at: '', utterances: [] };
  const u = { id: 'live' + Date.now(), speaker: speaker === 'me' || speaker === 'Yo' ? 'me' : 'others', time: fmt(STATE.recElapsed), text };
  STATE.transcript.utterances.push(u);
  if (STATE.screen === 'meeting' && STATE.activeTab === 'transcript') {
    const r = document.querySelector('.reading'); if (r) r.appendChild(utterance(u));
    const lc = $('#liveCount'); if (lc) lc.textContent = STATE.transcript.utterances.length + ' frases';
  }
};
// Texto de estado libre desde Python.
window.setStatus = function (text) {
  const root = $('#topbarStatus');
  if (STATE.appState === 'idle') root.innerHTML = `<div class="status-pill"><span class="dot-ok"></span>${esc(text || 'Listo')}</div>`;
  else if (STATE.appState === 'processing') { STATE.jobStage = text || STATE.jobStage; renderTopStatus(); }
};
// Progreso 0..1 desde Python.
window.setProgress = function (frac) {
  STATE.jobProgress = Math.max(0, Math.min(100, frac * 100));
  STATE.jobDeterminate = true;
  if (STATE.appState !== 'processing') beginProcessing(STATE.jobStage || 'Procesando');
  STATE.jobDeterminate = true;
  const f = $('#procFill'), p = $('#procPct'); if (f) f.style.width = STATE.jobProgress + '%'; if (p) p.textContent = Math.round(STATE.jobProgress) + '%';
  if (f) f.classList.remove('indeterminate');
  renderTopStatus();
};

/* ============================================================
   Transcripción en SEGUNDO PLANO (indicador flotante)
   ============================================================ */
function renderBgJobs(jobs) {
  STATE.bgJobs = Array.isArray(jobs) ? jobs : [];
  let host = document.getElementById('bgJobs');
  if (!STATE.bgJobs.length) { if (host) host.remove(); return; }
  if (!host) { host = el('div', 'bg-jobs'); host.id = 'bgJobs'; document.body.appendChild(host); }
  const active = STATE.bgJobs.filter(j => j.state === 'queued' || j.state === 'running').length;
  const rows = STATE.bgJobs.map(j => {
    const pct = Math.round((j.progress || 0) * 100);
    const icon = j.state === 'done' ? `<span class="bgj-ic ok">${svg('check', 13)}</span>`
      : j.state === 'error' ? `<span class="bgj-ic err">${svg('x', 13)}</span>`
      : `<span class="bgj-ic"><span class="spinner sm"></span></span>`;
    const stage = j.state === 'running' ? `${esc(j.stage || 'Transcribiendo…')} · ${pct}%` : esc(j.stage || '');
    const bar = j.state === 'running' ? `<div class="bgj-bar"><i style="width:${pct}%"></i></div>` : '';
    return `<div class="bgj-item"><div class="bgj-ic-wrap">${icon}</div><div class="bgj-body"><div class="bgj-name">${esc(j.title || 'Reunión')}</div><div class="bgj-stage">${stage}</div>${bar}</div></div>`;
  }).join('');
  const title = active ? `Transcribiendo en segundo plano${active > 1 ? ' (' + active + ')' : ''}` : 'Transcripción';
  host.innerHTML = `<div class="bgj-title">${esc(title)}</div>${rows}`;
}
window.onBackgroundJobs = renderBgJobs;
window.onJobFinished = async function (meetingId, initiativeId, ok) {
  try {
    if (initiativeId != null) await refreshMeetings(initiativeId);
    if (STATE.screen === 'meeting' && STATE.selMeeting === meetingId) await openMeeting(meetingId, true);
  } catch (e) { /* refresco best-effort */ }
  toast(ok ? 'ok' : 'err', ok ? 'Transcripción lista' : 'No se pudo transcribir una reunión');
};

/* ---- Adaptadores V2 opcionales (Python puede llamarlos; si no, no pasa nada) ---- */
window.onAppStateChanged = function (s) { if (s && s.state) setAppState(s.state); };
window.onJobProgress = function (job) { if (job && typeof job.progress === 'number') { STATE.jobStage = job.stage || STATE.jobStage; window.setProgress(job.progress / 100); } };
window.onAudioLevels = function (levels) { /* actualizar medidores en vivo cuando exista get_audio_levels */ };
window.onRecoveryDetected = function (rec) { showRecoveryBanner(rec); };
function applyScreenPreviewFit(p) {
  if (!p) return;
  p.style.backgroundSize = STATE.screenScaleMode === 'fit' ? 'contain' :
    (STATE.screenScaleMode === 'fill' ? 'cover' : '100% 100%');
  p.style.backgroundPosition = 'center';
  p.style.backgroundRepeat = 'no-repeat';
}
window.setScreenPreview = function (b64) {
  const p = document.querySelector('.screen-preview');
  if (p && b64) {
    p.style.backgroundImage = 'url(data:image/png;base64,' + b64 + ')';
    applyScreenPreviewFit(p);
  }
};
// Tu backend (grabación de pantalla) llama setPreview(); es el mismo destino.
window.setPreview = window.setScreenPreview;

/* Centro de recuperación (V2) */
function showRecoveryBanner(rec) {
  rec = rec || { title: 'Reunión sin título', date: '21 jun 2026 · 18:42', duration: '12:48', tracks: ['mic', 'system'] };
  const m = el('div', 'modal'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Recuperación');
  m.innerHTML = `<div class="modal-head"><h3>Grabación interrumpida encontrada</h3></div>
    <div class="modal-body">
      <p style="margin:0;font-size:13px;color:var(--text-secondary)">Se recuperó audio de una sesión que no terminó correctamente.</p>
      <div style="border:1px solid var(--border-subtle);border-radius:10px;padding:12px 14px;font-size:13px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Nombre</span><b>${esc(rec.title)}</b></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Fecha</span><span>${esc(rec.date)}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Audio recuperado</span><span class="mono">${esc(rec.duration)}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Pistas</span><span style="color:var(--success)">${(rec.tracks || []).join(' · ')}</span></div>
      </div>
      <button class="btn btn-primary btn-lg" data-rec style="justify-content:center">Recuperar y transcribir</button>
      <div style="display:flex;gap:8px"><button class="btn" data-keep style="flex:1;justify-content:center">Conservar para después</button><button class="btn btn-danger" data-disc style="flex:1;justify-content:center">Descartar…</button></div>
    </div>`;
  m.querySelector('[data-rec]').onclick = async () => { closeModal(); if (v2Available('recover_recording')) await api.v2.recoverRecording(rec.id); runProcessing('Recuperando y transcribiendo', () => toast('ok', 'Grabación recuperada')); };
  m.querySelector('[data-keep]').onclick = closeModal;
  m.querySelector('[data-disc]').onclick = () => confirmModal('Descartar grabación', 'Se eliminará el audio recuperado. Esta acción no se puede deshacer.', 'Descartar', async () => { if (v2Available('discard_recoverable_recording')) await api.v2.discardRecoverable(rec.id); toast('info', 'Grabación descartada'); });
  openModal(m);
}

/* ============================================================
   AJUSTES
   ============================================================ */
/* Pantalla de diagnóstico (primera ejecución): comprueba que el equipo está
   listo — disco, modelo de transcripción, micrófono, audio del sistema, carpeta
   de exportación y dónde se procesa el audio. */
async function openRecordingPreflight(kind, proceed) {
  if (STATE.appState !== 'idle') return;
  const isScreen = kind === 'screen';
  const m = el('div', 'modal wide preflight-modal');
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', isScreen ? 'Comprobar grabación de pantalla' : 'Comprobar grabación de reunión');
  m.innerHTML = `
    <div class="modal-head"><h3>${svg(isScreen ? 'monitorDot' : 'mic', 16)} <span id="preTitle">Comprobando…</span></h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div class="pre-cfg" id="preCfg">
        <div class="pre-cfg-row"><span class="pre-cfg-lbl">Idioma</span><div class="cfg-chips" id="cfgLang"></div></div>
        <div class="pre-cfg-row"><span class="pre-cfg-lbl">Modelo</span><div class="cfg-chips" id="cfgModel"></div></div>
      </div>
      <div id="preflightList" class="diag-list"><p style="color:var(--text-muted);font-size:13px">Comprobando equipo…</p></div>
      <div class="preflight-foot">
        <div class="help" id="preflightHelp"></div>
        ${isScreen ? '<button class="btn" id="preFolder">Cambiar carpeta</button>' : ''}
        <button class="btn" id="preReload">Recomprobar</button>
        <button class="btn btn-primary" id="preStart" disabled>Comprobando…</button>
      </div>
    </div>`;
  const list = m.querySelector('#preflightList');
  const title = m.querySelector('#preTitle');
  const start = m.querySelector('#preStart');
  let current = null;

  // Configuración de transcripción (idioma + modelo) tal como está en Ajustes,
  // editable aquí mismo en forma de chips. Lo que se elija queda guardado por
  // defecto y se usa para esta grabación.
  let cfg = await api.getSettings() || {};
  const byLang = cfg.models_by_lang || {};
  function renderCfgChips() {
    const langBox = m.querySelector('#cfgLang');
    const modelBox = m.querySelector('#cfgModel');
    if (!langBox || !modelBox) return;
    langBox.innerHTML = (cfg.languages || []).map(lg =>
      `<button class="cfg-chip ${lg.id === cfg.language ? 'on' : ''}" data-lang="${lg.id}">${esc(lg.label)}</button>`).join('');
    modelBox.innerHTML = (byLang[cfg.language] || cfg.models || []).map(mo =>
      `<button class="cfg-chip ${mo.tier === cfg.tier ? 'on' : ''}" data-tier="${mo.tier}" title="${esc(mo.label)} · ${esc(mo.download)}">${esc(mo.id)}</button>`).join('');
    langBox.querySelectorAll('[data-lang]').forEach(b => b.onclick = async () => {
      if (b.dataset.lang === cfg.language) return;
      cfg = await api.v2.setTranscriptionSettings({ language: b.dataset.lang }) || cfg;
      renderCfgChips(); toast('ok', `Idioma: ${cfg.language_label || b.dataset.lang}`);
    });
    modelBox.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
      if (b.dataset.tier === cfg.tier) return;
      cfg = await api.v2.setTranscriptionSettings({ tier: b.dataset.tier }) || cfg;
      renderCfgChips(); toast('ok', `Modelo: ${cfg.model || b.dataset.tier}`);
      load();  // refresca el chequeo del modelo (puede cambiar el estado de descarga)
    });
  }
  if (v2Available('set_transcription_settings')) renderCfgChips();
  else m.querySelector('#preCfg').hidden = true;

  async function load() {
    start.disabled = true; start.textContent = 'Comprobando…';
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Comprobando equipo…</p>';
    try {
      current = await api.getRecordingPreflight(kind, STATE.monitorIdx) || {};
      title.textContent = current.title || 'Comprobación previa';
      list.replaceChildren();
      (current.checks || []).forEach(info => {
        const status = info.status || 'warn';
        const ico = status === 'ok' ? svg('check', 14) : status === 'error' ? svg('x', 14) : svg('warn', 14);
        const row = el('div', 'diag-row ' + status);
        row.innerHTML = `<span class="diag-ico">${ico}</span><div class="diag-body"><div class="diag-label">${esc(info.title || '')}${info.required ? '' : '<span class="diag-opt">opcional</span>'}</div><div class="diag-detail" title="${esc(info.label || '')}">${esc(info.label || '')}</div></div>`;
        list.appendChild(row);
      });
      start.textContent = current.action || 'Continuar';
      start.disabled = !current.can_start;
      m.querySelector('#preflightHelp').textContent = current.can_start
        ? 'Todo listo.'
        : 'Corrige lo marcado en rojo.';
    } catch (e) {
      list.innerHTML = '<div class="error-box"><p>No se pudo comprobar el equipo.</p></div>';
      start.textContent = 'No disponible';
    }
  }
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelector('#preReload').onclick = load;
  const folder = m.querySelector('#preFolder');
  if (folder) folder.onclick = async () => { const r = await api.chooseExportDir(); if (r && r.ok) load(); };
  start.onclick = () => {
    if (!current || !current.can_start) return;
    closeModal();
    setTimeout(proceed, 0);
  };
  openModal(m);
  load();
}

async function openDiagnostics() {
  const m = el('div', 'modal wide');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Diagnóstico del sistema');
  m.innerHTML = `
    <div class="modal-head"><h3>${svg('check', 16)} Diagnóstico</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div id="diagList" class="diag-list"><p style="color:var(--text-muted);font-size:13px">Comprobando…</p></div>
      <div class="row-inline" style="margin-top:14px"><div class="help" style="flex:1">Comprueba que tu equipo está listo para grabar y transcribir.</div><button class="btn" id="diagFolder">Cambiar carpeta de exportación</button><button class="btn" id="diagReload">Volver a comprobar</button></div>
    </div>`;
  m.querySelector('[data-x]').onclick = closeModal;
  const listEl = m.querySelector('#diagList');
  async function loadDiag() {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Comprobando…</p>';
    const d = await api.getDiagnostics() || {};
    const rows = [
      ['Ventana (WebView2)', d.webview2],
      ['Espacio en disco', d.disk],
      ['Modelo de transcripción', d.whisper],
      ['Micrófono', d.mic],
      ['Audio del sistema', d.loopback],
      ['Carpeta de exportación', d.export_dir],
      ['Procesamiento del audio', d.processing],
    ];
    listEl.replaceChildren();
    rows.forEach(([label, info]) => {
      info = info || { status: 'warn', label: 'No disponible' };
      const ico = info.status === 'ok' ? svg('check', 14) : info.status === 'error' ? svg('x', 14) : svg('warn', 14);
      const row = el('div', 'diag-row ' + (info.status || 'warn'));
      row.innerHTML = `<span class="diag-ico">${ico}</span><div class="diag-body"><div class="diag-label">${esc(label)}</div><div class="diag-detail">${esc(info.label || '')}${info.detail ? ' · ' + esc(info.detail) : ''}</div></div>`;
      listEl.appendChild(row);
    });
  }
  m.querySelector('#diagReload').onclick = loadDiag;
  m.querySelector('#diagFolder').onclick = async () => { const r = await api.chooseExportDir(); if (r && r.ok) { toast('ok', 'Carpeta actualizada'); loadDiag(); } };
  openModal(m);
  loadDiag();
}

async function openSettings() {
  const s = await api.getSettings() || {};
  const tokenConfigured = !!(s.has_token || s.token_set);
  STATE.provider = s.provider || STATE.provider || 'auto';
  STATE.settings = s;
  const hasTx = v2Available('get_transcription_settings');
  const hasDev = v2Available('get_audio_devices');
  const m = el('div', 'modal settings-modal'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Ajustes');
  m.innerHTML = `
    <div class="modal-head settings-head">
      <div><h3>Ajustes</h3><p>Personaliza cómo graba, transcribe y exporta Helpmeet.</p></div>
      <button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button>
    </div>
    <div class="modal-body settings-body">
      <div class="settings-section settings-card settings-card-primary">
        <div class="settings-section-head">
          <span class="settings-section-icon">${svg('mic', 17)}</span>
          <div class="settings-section-copy"><h4>Transcripción</h4><p>Configura el idioma y el equilibrio entre velocidad y precisión.</p></div>
          ${hasTx ? '<span class="privacy-badge"><i></i>Local y privado</span>' : '<span class="pending-badge">PENDIENTE · PYTHON</span>'}
        </div>
        <div class="cfg-rows">
          <div class="pre-cfg-row"><span class="pre-cfg-lbl">Idioma</span><div class="cfg-chips" id="setLangChips"></div></div>
          <div class="pre-cfg-row"><span class="pre-cfg-lbl">Modelo</span><div class="cfg-chips" id="setModelChips"></div></div>
        </div>
        <div class="help" id="setModelHelp">Más calidad requiere más tiempo y espacio. El modelo se descarga (una sola vez) la primera vez que lo usas.</div>
        <label class="toggle-row" for="setDefaultMute">
          <span class="toggle-copy"><b>Iniciar con micrófono silenciado</b><small>Podrás activarlo durante cualquier grabación.</small></span>
          <input type="checkbox" id="setDefaultMute" ${s.default_mic_muted ? 'checked' : ''}>
          <span class="toggle-ui" aria-hidden="true"><i></i></span>
        </label>
      </div>
      <div class="settings-section settings-card">
        <label>INSTRUCCIONES PARA LA IA</label>
        <textarea id="setAiInstr" class="obj-text" rows="4" placeholder="Instrucciones que se ponen al principio de todo contexto que exportas…">${esc(s.ai_instructions || '')}</textarea>
        <div class="row-inline" style="margin-top:8px"><div class="help" style="flex:1">Cabecera que orienta a Claude en cada exportación. Déjala vacía para volver a la de por defecto.</div><button class="btn" id="setAiReset">Restablecer</button><button class="btn btn-primary" id="setAiSave">Guardar</button></div>
      </div>
      <div class="settings-section settings-card">
        <label>CARPETA DE EXPORTACIÓN</label>
        <div class="row-inline"><div class="field mono" style="display:flex;align-items:center;overflow:hidden;white-space:nowrap;color:var(--text-secondary)">${esc(s.export_dir || '—')}</div><button class="btn" id="setDir">Elegir…</button></div>
      </div>
      <div class="settings-section settings-card">
        <label>DIAGNÓSTICO</label>
        <div class="row-inline"><div class="help" style="flex:1">Comprueba disco, modelo de transcripción, micrófono, audio del sistema y carpeta de exportación.</div><button class="btn" id="setDiag">${svg('check', 14)} Abrir diagnóstico</button></div>
      </div>
      <div class="settings-section settings-card settings-danger-zone">
        <label>PRIVACIDAD Y DATOS</label>
        <div class="row-inline"><div class="help" style="flex:1">Copia de seguridad de tu contenido (iniciativas, reuniones, transcripciones). No incluye grabaciones ni capturas.</div><button class="btn" id="setBackup">${svg('download', 14)} Copia de seguridad</button></div>
        <div class="row-inline" style="margin-top:8px"><div class="help" style="flex:1">Borra <b>todos</b> tus datos locales y deja la app como recién instalada. No se puede deshacer. No toca tu carpeta de exportación.</div><button class="btn btn-danger" id="setWipe">${svg('trash', 14)} Borrar datos</button></div>
      </div>
    </div>`;
  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelectorAll('[data-prov]').forEach(b => b.onclick = async () => {
    STATE.provider = b.dataset.prov;
    await api.v2.setTranscriptionSettings({ provider: STATE.provider });
    toast('ok', 'Proveedor guardado por defecto'); closeModal(); openSettings();
  });
  m.querySelector('#setDefaultMute').onchange = async (e) => {
    await api.v2.setTranscriptionSettings({ default_mic_muted: e.target.checked });
    toast('ok', e.target.checked ? 'Tu audio empezará silenciado' : 'Tu audio empezará activo');
  };
  // Configuración de transcripción como chips (idioma + modelo), igual que en el
  // panel de grabar. Lo elegido se guarda como predeterminado.
  let scfg = s;
  const sByLang = scfg.models_by_lang || {};
  function renderSettingsChips() {
    const langBox = m.querySelector('#setLangChips');
    const modelBox = m.querySelector('#setModelChips');
    if (!langBox || !modelBox) return;
    langBox.innerHTML = (scfg.languages || []).map(lg =>
      `<button class="cfg-chip ${lg.id === scfg.language ? 'on' : ''}" data-lang="${lg.id}">${esc(lg.label)}</button>`).join('');
    modelBox.innerHTML = (sByLang[scfg.language] || scfg.models || []).map(mo =>
      `<button class="cfg-chip ${mo.tier === scfg.tier ? 'on' : ''}" data-tier="${mo.tier}" title="${esc(mo.label)} · ${esc(mo.download)}">${esc(mo.id)}</button>`).join('');
    langBox.querySelectorAll('[data-lang]').forEach(b => b.onclick = async () => {
      if (b.dataset.lang === scfg.language) return;
      scfg = await api.v2.setTranscriptionSettings({ language: b.dataset.lang }) || scfg;
      renderSettingsChips(); toast('ok', `Idioma: ${scfg.language_label || b.dataset.lang}`);
    });
    modelBox.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
      if (b.dataset.tier === scfg.tier) return;
      scfg = await api.v2.setTranscriptionSettings({ tier: b.dataset.tier }) || scfg;
      renderSettingsChips(); toast('ok', `Modelo: ${scfg.model || b.dataset.tier}`);
    });
  }
  if (hasTx) renderSettingsChips();
  m.querySelector('#setAiSave').onclick = async () => { await api.setAiInstructions(m.querySelector('#setAiInstr').value); toast('ok', 'Instrucciones guardadas'); };
  m.querySelector('#setAiReset').onclick = async () => { const r = await api.setAiInstructions(''); m.querySelector('#setAiInstr').value = (r && r.text) || ''; toast('ok', 'Instrucciones restablecidas'); };
  m.querySelector('#setDir').onclick = async () => { const r = await api.chooseExportDir(); if (r && r.ok) { toast('ok', 'Carpeta actualizada'); closeModal(); } };
  m.querySelector('#setDiag').onclick = () => { closeModal(); openDiagnostics(); };
  m.querySelector('#setBackup').onclick = async (e) => {
    e.currentTarget.classList.add('is-loading');
    try {
      const r = await api.backupDatabase();
      if (r && r.ok) toast('ok', 'Copia de seguridad guardada');
      else if (r && r.cancelled) { /* el usuario canceló */ }
      else toast('err', 'No se pudo crear la copia');
    } finally { e.currentTarget.classList.remove('is-loading'); }
  };
  m.querySelector('#setWipe').onclick = () => {
    confirmModal('Borrar todos los datos',
      'Se borrarán TODOS tus datos locales: iniciativas, reuniones, transcripciones, notas, capturas y ajustes. Tu carpeta de exportación NO se toca. Esta acción no se puede deshacer.',
      'Borrar todo', async () => {
        const r = await api.wipeAllData();
        if (r && r.ok) {
          toast('ok', 'Todos los datos se han borrado');
          closeModal();
          // Recarga el estado desde cero: todo queda vacío.
          STATE.selInit = null; STATE.selMeeting = null; STATE.screen = 'welcome';
          STATE.meetingsByInit = {}; STATE.openInits = {}; STATE.transcript = null;
          STATE.initiatives = await api.listInitiatives() || [];
          await refreshAll(); renderSidebar(); renderMain();
        } else {
          toast('err', 'No se pudieron borrar los datos');
        }
      });
  };
  openModal(m);
}

/* ============================================================
   ATAJOS DE TECLADO
   ============================================================ */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#overlayRoot').hidden) closeModal(); closeMenu(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); promptNewInitiative(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); STATE.sidebarOpen = !STATE.sidebarOpen; applySidebar(); }
});

/* Prevención de cierre durante grabación */
window.addEventListener('beforeunload', (e) => {
  if (STATE.appState === 'recording' || STATE.appState === 'recording-local' || STATE.appState === 'recording-cloud' || STATE.appState === 'screen-recording') {
    e.preventDefault(); e.returnValue = '';
  }
});

/* ============================================================
   REFRESCOS / INIT
   ============================================================ */
async function refreshMeetings(iid) { if (!iid) return; STATE.meetingsByInit[iid] = await api.listMeetings(iid) || []; renderSidebar(); if (STATE.screen === 'initiative') renderMain(); }
async function refreshAll() { for (const it of STATE.initiatives) STATE.meetingsByInit[it.id] = await api.listMeetings(it.id) || []; renderSidebar(); }

function wireTopbar() {
  $('#btnToggleSidebar').innerHTML = svg('panel', 16);
  $('#btnNewInitiative').innerHTML = svg('plus', 14);
  $('#btnNewInitiativeRail').innerHTML = svg('plus', 16);
  $('.search-ico').innerHTML = svg('search', 14);
  $('#btnSettings').innerHTML = svg('settings', 15);
  $('#btnMic .mic-ico').innerHTML = svg('mic', 15);
  $('#btnArchive').querySelector('.ico-archive')?.replaceWith(elFromHTML('<span class="ico">' + svg('archive', 14) + '</span>'));
  $('#btnTrash').querySelector('.ico-trash')?.replaceWith(elFromHTML('<span class="ico">' + svg('trash', 14) + '</span>'));

  $('#btnToggleSidebar').onclick = () => { STATE.sidebarOpen = !STATE.sidebarOpen; applySidebar(); };
  $('#btnNewInitiative').onclick = promptNewInitiative;
  $('#btnNewInitiativeRail').onclick = promptNewInitiative;
  $('#btnSettings').onclick = openSettings;
  $('#btnArchive').onclick = () => { STATE.screen = 'archive'; renderMain(); };
  $('#btnTrash').onclick = () => { STATE.screen = 'trash'; renderMain(); };
  $('#btnMic').onclick = toggleMic;
  // Buscador compacto que se expande al enfocar
  $('#search').addEventListener('click', openSearch);
  $('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(e.target.value); } });
  $('#searchInput').addEventListener('blur', () => { if (!$('#searchInput').value) $('#search').classList.remove('expanded'); });
  let deb; $('#searchInput').addEventListener('input', (e) => { clearTimeout(deb); const v = e.target.value; deb = setTimeout(() => { if (v.length >= 2) runSearch(v); else if (!v) backToTree(); }, 350); });
}
function elFromHTML(h) { const t = el('div'); t.innerHTML = h; return t.firstChild; }

async function init() {
  applySidebar();
  wireTopbar();
  setAppState('idle');
  try {
    STATE.initiatives = await api.listInitiatives() || [];
    STATE.monitors = await api.listMonitors() || [];
    if (STATE.monitors.length) STATE.monitorIdx = STATE.monitors[0].index;  // índice real (1 = principal)
    // precargar reuniones del primero para el árbol
    for (const it of STATE.initiatives) STATE.meetingsByInit[it.id] = await api.listMeetings(it.id) || [];
  } catch (e) { console.warn('init', e); }
  renderSidebar(); renderActionBar(); renderMain();
  updateLibraryCounts();
  try { renderBgJobs(await api.getBackgroundJobs()); } catch (e) { /* sin jobs */ }

  // Recuperación al arrancar (V2). Si no hay backend, no molesta.
  if (v2Available('list_recoverable_recordings')) {
    const recs = await api.v2.listRecoverable();
    if (recs && recs.length) showRecoveryBanner(recs[0]);
  }
}

// pywebview expone la API de forma ASÍNCRONA: el objeto window.pywebview.api
// puede existir antes de que sus métodos estén listos. Si arrancáramos antes,
// call() caería al MOCK y cargaría datos falsos (ids 'i1','i2'…) que luego el
// backend real rechaza. Por eso esperamos a que un método REAL sea invocable.
(function boot() {
  let started = false;
  const start = () => { if (started) return; started = true; init(); };
  const apiReady = () => !!(window.pywebview && window.pywebview.api &&
    typeof window.pywebview.api.list_initiatives === 'function');
  window.addEventListener('pywebviewready', () => { if (apiReady()) start(); });
  let waited = 0;
  (function poll() {
    if (apiReady()) return start();                           // pywebview listo
    if (!window.pywebview && waited >= 1500) return start();   // navegador (MOCK)
    waited += 60;
    setTimeout(poll, 60);
  })();
})();
