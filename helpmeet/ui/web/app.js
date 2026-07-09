/* ============================================================
   Helpmeet — app.js
   Lógica de interfaz para pywebview.
   ------------------------------------------------------------
   ESTRUCTURA
   1. Iconos SVG internos
   2. Capa de API  ........ api.*  (pywebview con fallback MOCK)
   3. Estado central ...... STATE  + setAppState()
   4. Render de vistas .... renderMain(), renderActionBar()
   5. Sidebar / búsqueda / glosario / archivados
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
   1. ICONOS (SVG internos, estilo lineal/redondeado)
   ============================================================ */
const ICONS = {
  panel: '<rect x="4" y="4" width="6" height="16" rx="2.2"/><rect x="14" y="4" width="6" height="7" rx="2.2"/><rect x="14" y="15" width="6" height="5" rx="2.2"/>',
  search: '<circle cx="10.7" cy="10.7" r="5.7"/><path d="M15.2 15.2 20 20"/>',
  headerSearch: '<circle cx="10.6" cy="10.6" r="5.4" stroke-width="2.35"/><path d="M15.1 15.1 20 20" stroke-width="2.55"/>',
  settings: '<path d="M4 7h7"/><path d="M15 7h5"/><circle cx="13" cy="7" r="2"/><path d="M4 17h5"/><path d="M13 17h7"/><circle cx="11" cy="17" r="2"/>',
  headerSettings: '<path d="M4 7h8" stroke-width="2.25"/><path d="M16 7h4" stroke-width="2.25"/><circle cx="14" cy="7" r="2.15" fill="currentColor" stroke="none"/><path d="M4 17h4" stroke-width="2.25"/><path d="M12 17h8" stroke-width="2.25"/><circle cx="10" cy="17" r="2.15" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  archive: '<rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9M10 13h4"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
  dots: '<circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="13.5" r="1.5" fill="currentColor"/><circle cx="10.5" cy="9" r="1.5" fill="currentColor"/><circle cx="14.5" cy="9" r="1.5" fill="currentColor"/><circle cx="16" cy="13.5" r="1.5" fill="currentColor"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  monitorDot: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 3v12M8 7l4-4 4 4M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  note: '<path d="M12 5v14M5 12h14"/>',
  warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  rewind: '<path d="m11 19-9-7 9-7v14z"/><path d="m22 19-9-7 9-7v14z"/>',
  fastForward: '<path d="m13 19 9-7-9-7v14z"/><path d="m2 19 9-7-9-7v14z"/>',
  markIn: '<path d="M3 19V5"/><path d="m13 6-6 6 6 6"/><path d="M7 12h14"/>',
  markOut: '<path d="M21 5v14"/><path d="M3 12h14"/><path d="m11 18 6-6-6-6"/>',
  expand: '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  shrink: '<path d="M4 14h6v6"/><path d="m10 14-7 7"/><path d="m21 3-7 7"/><path d="M20 10h-6V4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkSquare: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  pin: '<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/><path d="M9 21h6"/>',
  micOff: '<path d="M4 4 20 20"/><path d="M9 8.5V6a3 3 0 0 1 5.7-1.3"/><path d="M15 9v2.5a3 3 0 0 1-.7 1.9"/><path d="M5.5 11.5a6.5 6.5 0 0 0 9.4 5.8"/><path d="M18.5 11.5a6.5 6.5 0 0 1-.8 3.1"/><path d="M12 18v3"/><path d="M9 21h6"/>',
  headerMic: '<rect x="8.4" y="3" width="7.2" height="11.8" rx="3.6" fill="currentColor" stroke="none"/><path d="M5.7 11.6a6.3 6.3 0 0 0 12.6 0" stroke-width="2.2"/><path d="M12 18.1v2.7" stroke-width="2.2"/><path d="M9.2 21h5.6" stroke-width="2.2"/>',
  headerMicOff: '<rect x="8.4" y="3" width="7.2" height="11.8" rx="3.6" fill="currentColor" opacity=".35" stroke="none"/><path d="M4 4 20 20" stroke-width="2.35"/><path d="M5.7 11.6a6.3 6.3 0 0 0 9.7 5.3" stroke-width="2.2"/><path d="M18.3 11.6c0 .9-.18 1.75-.52 2.5" stroke-width="2.2"/><path d="M12 18.1v2.7" stroke-width="2.2"/><path d="M9.2 21h5.6" stroke-width="2.2"/>',
  star: '<path d="M12 2 15.09 8.26 22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  fitContain: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><rect x="7" y="9" width="10" height="6" rx="1"/>',
  fitFill: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 5v14M16 5v14"/>',
  fitStretch: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M3 16l3-3 3 3M21 12a9 9 0 0 1-15 6.7L3 16"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
  eye: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 21"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  md: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 17v-4l2 2.5 2-2.5v4"/>',
};
function svg(name, size) {
  size = size || 15;
  const stroke = (name === 'dots') ? '' : ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"${stroke}>${ICONS[name] || ''}</svg>`;
}
function ico(name, size) { return `<span class="ico">${svg(name, size)}</span>`; }

// Iniciales de 2 letras a partir del nombre del proyecto (para el avatar).
// Dos palabras → primera letra de cada una; una palabra → sus 2 primeras;
// vacío → "·".
function initialsFor(name) {
  const s = (name || '').trim();
  if (!s) return '·';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// Icono del origen de una reunión (audio grabado, pantalla grabada o
// vídeo importado) para la línea de metadatos de su tarjeta.
function _kindIcon(m) {
  // Mismos iconos que la barra de acciones (Grabar reunión / Grabar
  // pantalla / Importar video) para que se reconozcan al instante.
  const k = m && m.source;
  if (k === 'audio')  return `<span class="rc-kind" title="Audio de reunión">${svg('mic', 12)}</span>`;
  if (k === 'screen') return `<span class="rc-kind" title="Grabación de pantalla">${svg('monitorDot', 12)}</span>`;
  if (k === 'import') return `<span class="rc-kind" title="Vídeo importado">${svg('upload', 12)}</span>`;
  return '';
}

// Color estable derivado del nombre (paleta tipo Google Material).
// El mismo nombre da siempre el mismo color.
function avatarColorFor(name) {
  const palette = ['#1a73e8', '#188038', '#a142f4', '#e8710a', '#12a4af', '#d93025', '#9334e6', '#1e8e3e'];
  const s = (name || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

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
  syncInitiativesWithFolders: () => call('sync_initiatives_with_folders'),
  toggleInitiativePin: (id) => call('toggle_initiative_pin', id),
  createInitiative: (name, color) => call('create_initiative', name, color),
  renameInitiative: (id, name) => call('rename_initiative', id, name),
  setInitiativeColor: (id, color) => call('set_initiative_color', id, color),
  renameMeeting: (id, title) => call('rename_meeting', id, title),
  setMeetingDate: (id, date) => call('set_meeting_date', id, date),
  setMeetingContext: (id, text) => call('set_meeting_context', id, text),
  addMeetingNote: (id, text) => call('add_meeting_note', id, text),
  addNotePost: (mid, text) => call('add_note_post', mid, text),
  moveMeeting: (mid, iid) => call('move_meeting', mid, iid),
  getGlossary: (iid) => call('get_glossary', iid),
  listMeetings: (iid) => call('list_meetings', iid),
  getBootstrapState: () => call('get_bootstrap_state'),
  checkLicense: () => call('check_license'),
  activateLicense: (key) => call('activate_license', key),
  getLicenseInfo: () => call('get_license_info'),
  deactivateLicense: () => call('deactivate_license'),
  search: (q) => call('search', q),
  getTranscript: (mid) => call('get_transcript', mid),
  startRecording: (iid, title) => call('start_recording', iid, title),
  stopRecording: () => call('stop_recording'),
  listMonitors: () => call('list_monitors'),
  getMonitorThumbnails: () => call('get_monitor_thumbnails'),
  takeCapture: (idx) => call('take_capture', idx),
  addNote: (text) => call('add_note', text),
  toggleMeetingMicMute: (muted) => call('toggle_meeting_mic_mute', muted),
  importMedia: (iid) => call('import_media', iid),
  importMediaMultiple: (iid) => call('import_media_multiple', iid),
  importVideoForMeeting: (mid) => call('import_video_for_meeting', mid),
  exportMeetingById: (mid) => call('export_meeting_by_id', mid),
  exportTranscriptTxt: (mid) => call('export_transcript_txt', mid),
  exportTranscriptPackage: (mid) => call('export_transcript_package', mid),
  exportTranscript: (mid) => call('export_transcript', mid),
  exportInitiativeById: (iid) => call('export_initiative_by_id', iid),
  openInitiativeFolder: (iid) => call('open_initiative_folder', iid),
  exportMeetingTo: (mid) => call('export_meeting_to', mid),
  exportInitiativeTo: (iid) => call('export_initiative_to', iid),
  setInitiativeDescription: (iid, d) => call('set_initiative_description', iid, d),
  copyInitiativeContext: (iid) => call('copy_initiative_context', iid),
  copyMeetingContext: (mid) => call('copy_meeting_context', mid),
  getCaptureImage: (cid) => call('get_capture_image', cid),
  getCaptureThumbnail: (cid) => call('get_capture_thumbnail', cid),
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

  // ---- Documentos → Markdown ----
  listDocumentInitiatives: () => call('list_document_initiatives'),
  pickAndConvertDocuments: (iid, ocr, imgs) => call('pick_and_convert_documents', iid, ocr, !!imgs),
  listDocuments: (iid) => call('list_documents', iid),
  openDocument: (iid, name) => call('open_document', iid, name),
  openDocumentOriginal: (iid, name) => call('open_document_original', iid, name),
  openDocumentsFolder: (iid) => call('open_documents_folder', iid),
  openDocumentImages: (iid, name) => call('open_document_images', iid, name),
  deleteDocument: (iid, name) => call('delete_document', iid, name),
  listAllDocuments: () => call('list_all_documents'),
  readDocument: (iid, name) => call('read_document', iid, name),
  saveUploadedDocument: (iid, name, b64, ocr, imgs) => call('save_uploaded_document', iid, name, b64, ocr, !!imgs),

  // ---- Grabación de pantalla + biblioteca (backend REAL, ya implementado) ----
  startScreenRecording: (iid, idx) => call('start_screen_recording', iid, idx),
  stopScreenRecording: () => call('stop_screen_recording'),
  transcribeMeetingVideo: (mid, force, clipSegments) => call('transcribe_meeting_video', mid, !!force, clipSegments || null),
  getVideoThumbnails: (mid, count) => call('get_video_thumbnails', mid, count || 12),
  getMediaVideoUrl: (mid) => call('get_media_video_url', mid),
  checkForUpdate: () => call('check_for_update'),
  openUrl: (u) => call('open_url', u),
  toggleScreenMicMute: (m) => call('toggle_screen_mic_mute', m),
  setScreenMonitor: (idx) => call('set_screen_monitor', idx),
  setScreenScaleMode: (mode) => call('set_screen_scale_mode', mode),
  startScreenPreview: (idx) => call('start_screen_preview', idx),
  stopScreenPreview: () => call('stop_screen_preview'),
  setScreenPreviewMonitor: (idx) => call('set_screen_preview_monitor', idx),
  setScreenTransform: (x, y, w, h) => call('set_screen_transform', x, y, w, h),
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
    cancelMeetingJob: (mid) => call('cancel_meeting_job', mid),
    runSetup: () => call('run_setup'),                               // @pending-python
    clearWhisperCache: () => call('clear_whisper_cache'),            // @pending-python
  },
  // Controles de ventana frameless
  winMinimize: () => call('win_minimize'),
  winMaximize: () => call('win_maximize'),
  winClose: () => call('win_close'),
  winIsMaximized: () => call('win_is_maximized'),
  winStartResize: (dir) => call('win_start_resize', dir),
  winStartMove: () => call('win_start_move'),
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
  // ── Datos de ejemplo para previsualizar la UI en el navegador ──
  const inits = [
    { id: 'i1', name: 'Rediseño App Móvil', pinned: true, created_at: '2026-05-10T09:00:00', color: '#aacfbf' },
    { id: 'i2', name: 'Integración con Salesforce', created_at: '2026-04-03T11:30:00', color: '#86b5e0' },
    { id: 'i3', name: 'Onboarding Nuevos Clientes', created_at: '2026-06-01T08:00:00', color: '#e8c17b' },
  ];
  const meetings = {
    i1: [
      { id: 'm1', title: 'Kick-off con diseño', initiative_id: 'i1', started_at: '2026-06-20T10:00:00', dur: '45:12', size: '78 MB', utterances: 38, has_transcript: true, status: 'done' },
      { id: 'm2', title: 'Revisión de wireframes', initiative_id: 'i1', started_at: '2026-06-22T16:30:00', dur: '28:05', size: '47 MB', utterances: 21, has_transcript: true, status: 'done' },
      { id: 'm3', title: 'Demo con stakeholders', initiative_id: 'i1', started_at: '2026-06-24T11:00:00', dur: '1:02:44', size: '108 MB', utterances: 57, has_transcript: false, status: 'pending' },
    ],
    i2: [
      { id: 'm4', title: 'Reunión técnica API', initiative_id: 'i2', started_at: '2026-06-18T09:00:00', dur: '52:30', size: '91 MB', utterances: 44, has_transcript: true, status: 'done' },
      { id: 'm5', title: 'Mapeo de datos', initiative_id: 'i2', started_at: '2026-06-21T14:00:00', dur: '35:18', size: '61 MB', utterances: 29, has_transcript: false, status: 'pending' },
    ],
    i3: [
      { id: 'm6', title: 'Plan de contenidos', initiative_id: 'i3', started_at: '2026-06-23T10:30:00', dur: '22:47', size: '38 MB', utterances: 18, has_transcript: true, status: 'done' },
    ],
  };
  const transcripts = {
    m1: {
      id: 'm1', title: 'Kick-off con diseño', started_at: '2026-06-20T10:00:00', duration: '45:12',
      context: 'Reunión inicial para alinear al equipo de diseño con los objetivos del rediseño. Se revisaron los pain points del flujo actual y se definieron los primeros entregables.',
      notes: [
        { id: 'n1', text: 'Revisar paleta de colores con marketing antes del viernes', created_at: '2026-06-20T10:32:00' },
        { id: 'n2', text: 'Ana se encarga del prototipo en Figma para la semana que viene', created_at: '2026-06-20T10:48:00' },
      ],
      utterances: [
        { id: 'u1', speaker: 'Víctor', text: 'Bien, creo que ya estamos todos. ¿Empezamos? El objetivo de hoy es alinear visión y definir los primeros entregables del rediseño.', ts: '00:00:12', ts_end: '00:00:22' },
        { id: 'u2', speaker: 'Ana', text: 'Perfecto. Yo vengo con algunas referencias visuales que quería compartir. Básicamente encontré tres tendencias interesantes en apps de productividad.', ts: '00:00:24', ts_end: '00:00:34' },
        { id: 'u3', speaker: 'Carlos', text: 'Antes de entrar en eso, ¿podemos aclarar el alcance? Porque en el brief dice "rediseño completo" pero entiendo que la navegación principal no se toca.', ts: '00:00:37', ts_end: '00:00:50' },
        { id: 'u4', speaker: 'Víctor', text: 'Correcto, la navegación se queda como está. El foco es la pantalla de detalle y el flujo de creación de registros, que es donde tenemos más abandono.', ts: '00:00:52', ts_end: '00:01:08', highlighted: true },
        { id: 'u5', speaker: 'Ana', text: 'Entendido. Entonces el prototipo que prepare en Figma va a cubrir esas dos vistas principalmente, y dejo el resto como referencia.', ts: '00:01:10', ts_end: '00:01:22' },
        { id: 'u6', speaker: 'Carlos', text: 'Para los componentes reutilizables, ¿usamos el sistema de diseño actual o lo renovamos también?', ts: '00:01:25', ts_end: '00:01:34' },
        { id: 'u7', speaker: 'Víctor', text: 'Lo renovamos parcialmente: tipografía y espaciados sí, iconografía y color scheme no hasta que marketing apruebe la nueva paleta.', ts: '00:01:36', ts_end: '00:01:52' },
        { id: 'u8', speaker: 'Ana', text: 'Ok, eso lo necesito antes del viernes para poder avanzar con el prototipo. ¿Puedes hablar con marketing esta semana?', ts: '00:01:54', ts_end: '00:02:04' },
        { id: 'u9', speaker: 'Víctor', text: 'Sí, lo agendo para el miércoles. Os paso la paleta validada el jueves como muy tarde.', ts: '00:02:06', ts_end: '00:02:18' },
      ],
    },
    m3: {
      id: 'm3', title: 'Demo con stakeholders', started_at: '2026-06-24T11:00:00', duration: '1:02:44',
      context: 'Demo del prototipo navegable ante el comité de producto. Se recibió feedback positivo general con algunos ajustes menores.',
      notes: [],
      utterances: [
        { id: 'u10', speaker: 'Víctor', text: 'Gracias a todos por venir. Vamos a ver el prototipo que el equipo ha preparado estas dos semanas.', ts: '00:00:08', ts_end: '00:00:18' },
        { id: 'u11', speaker: 'Laura (Producto)', text: 'Se ve muy bien el flujo de creación. Me preocupa un poco el número de pasos, pero el diseño está mucho más limpio.', ts: '00:04:32', ts_end: '00:04:48' },
        { id: 'u12', speaker: 'Ana', text: 'Puedo comprimir los pasos 3 y 4 en uno solo sin perder información. Sería cuestión de un día de trabajo.', ts: '00:04:51', ts_end: '00:05:04' },
        { id: 'u13', speaker: 'Laura (Producto)', text: 'Perfecto, hagamos eso. El resto me parece bien para pasar a desarrollo.', ts: '00:05:06', ts_end: '00:05:14' },
      ],
    },
  };
  const glossary = {
    i1: [
      { id: 'g1', term: 'Design System', definition: 'Biblioteca de componentes y tokens de diseño compartida entre diseño y desarrollo.' },
      { id: 'g2', term: 'Pain point', definition: 'Punto de fricción del usuario en el flujo actual que se quiere mejorar.' },
      { id: 'g3', term: 'Wireframe', definition: 'Boceto de baja fidelidad que define estructura y navegación sin estilos visuales.' },
    ],
    i2: [
      { id: 'g4', term: 'Endpoint', definition: 'URL de la API de Salesforce que expone un recurso o acción específica.' },
      { id: 'g5', term: 'Webhook', definition: 'Notificación HTTP que Salesforce envía al sistema cuando ocurre un evento.' },
    ],
  };
  const wait = (v, ms) => new Promise(r => setTimeout(() => r(v), ms || 220));
  let mctr = 100;
  return {
    list_initiatives: () => wait(inits.slice()),
    create_initiative: (name, color) => { const it = { id: 'i' + (++mctr), name, color: color || '#aacfbf', created_at: new Date().toISOString() }; inits.push(it); meetings[it.id] = []; return wait(it); },
    rename_initiative: (id, name) => { const it = inits.find(x => x.id === id); if (it) it.name = name; return wait({ ok: true }); },
    rename_meeting: (id, title) => { for (const k in meetings) { const m = meetings[k].find(x => x.id === id); if (m) m.title = title; } return wait({ ok: true }); },
    set_meeting_context: (id, context) => { if (transcripts[id]) transcripts[id].context = context; return wait({ ok: true, context }); },
    add_meeting_note: (id, text) => {
      const note = { id: 'ctx' + (++mctr), kind: 'context', text, time: '' };
      if (transcripts[id]) { transcripts[id].utterances = transcripts[id].utterances || []; transcripts[id].utterances.unshift(note); }
      return wait({ ok: true, note });
    },
    add_note_post: (id, text) => {
      const note = { id: 'n' + (++mctr), kind: 'note', text, time: '00:00' };
      if (transcripts[id]) { transcripts[id].assets = transcripts[id].assets || {}; transcripts[id].assets.notes = transcripts[id].assets.notes || []; transcripts[id].assets.notes.push(note); }
      return wait({ ok: true, note });
    },
    move_meeting: () => wait({ ok: true }),
    run_setup: () => {
      // Simulación de progreso para pruebas en el navegador
      const steps = [
        { stage: 'downloading', pct: 0.15, model: 'small', size_label: '~480 MB' },
        { stage: 'downloading', pct: 0.45, model: 'small' },
        { stage: 'downloading', pct: 0.78, model: 'small' },
        { stage: 'loading',     pct: 0.82, model: 'small' },
        { stage: 'done',        pct: 1.0 },
      ];
      steps.forEach((s, i) => setTimeout(() => window.onSetupProgress && window.onSetupProgress(s), 800 * (i + 1)));
      return wait({ ok: true });
    },
    get_glossary: (iid) => wait(glossary[iid] || []),
    list_meetings: (iid) => wait((meetings[iid] || []).slice()),
    get_bootstrap_state: () => {
      const mbi = {};
      for (const it of inits) mbi[it.id] = (meetings[it.id] || []).slice();
      return wait({
        version: '1.1.0',
        initiatives: inits.slice(), meetings_by_initiative: mbi,
        monitors: [{ index: 0, width: 2560, height: 1440 }, { index: 1, width: 1920, height: 1080 }],
        library_counts: { archive: 2, trash: 1 }, background_jobs: [],
        setup_done: true,
      });
    },
    search: () => wait([]),
    get_transcript: (mid) => {
      const t = transcripts[mid];
      if (!t) return wait({ id: mid, title: 'Reunión sin transcripción', started_at: '', duration: '0:00', context: '', notes: [], utterances: [] });
      // Normaliza al formato que espera la UI (display_name / time / speaker 'me').
      const ut = (t.utterances || []).map(u => u.kind ? u : ({
        ...u,
        display_name: u.speaker,
        speaker: u.speaker === 'Víctor' ? 'me' : 'others',
        time: (u.ts || '').length > 5 ? u.ts.slice(3) : (u.ts || ''),
      }));
      return wait({ ...t, utterances: ut });
    },
    start_recording: (iid, title) => wait({ id: 'm' + (++mctr), title: title || 'Reunión sin título', initiative_id: iid, live: true }),
    stop_recording: () => wait({ status: 'ok', duration: '12:48', utterances: 24 }, 400),
    list_monitors: () => wait([{ index: 1, width: 2560, height: 1440 }, { index: 2, width: 1920, height: 1080 }]),
    get_monitor_thumbnails: () => wait([{ index: 1, left: 0, top: 0, width: 2560, height: 1440, thumbnail: '' }, { index: 2, left: 2560, top: 0, width: 1920, height: 1080, thumbnail: '' }]),
    take_capture: () => wait({ ok: true }),
    add_note: () => wait({ ok: true }),
    import_media: (iid) => wait({ id: 'm' + (++mctr), title: 'Vídeo importado', initiative_id: iid, utterances: 30 }, 600),
    import_video_for_meeting: (mid) => wait({ ok: true, queued: true, meeting_id: mid, filename: 'grabacion.mp4' }, 400),
    export_meeting_by_id: () => wait({ path: 'C:\\Helpmeet\\export' }, 500),
    export_transcript_txt: () => wait({ ok: true, path: 'C:\\Helpmeet\\transcripcion.txt' }, 500),
    export_transcript_package: () => wait({ ok: true, path: 'C:\\Helpmeet\\transcripcion.zip', captures: 2, files: 1 }, 500),
    export_transcript: () => wait({ ok: true, format: 'txt', path: 'C:\\Helpmeet\\transcripcion.txt', captures: 0, files: 0 }, 500),
    export_initiative_by_id: () => wait({ path: 'C:\\Helpmeet\\export' }, 500),
    open_initiative_folder: () => wait({ ok: true, path: 'C:\\Helpmeet\\export' }, 500),
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
    start_screen_preview: () => wait({ ok: true }),
    stop_screen_preview: () => wait({ ok: true }),
    set_screen_preview_monitor: () => wait({ ok: true }),
    set_screen_transform: () => wait({ ok: true }),
    stop_screen_recording: () => wait({ ok: true, path: 'C:\\Helpmeet\\export\\grabacion.mp4', tracks: ['mic', 'system'] }, 700),
    generate_meeting_summary: () => wait({ summary: 'Resumen generado de ejemplo.', decisions: [], tasks: [] }, 900),
  };
})();

const TIER_LABEL = { fast: 'Mínimo', balanced: 'Pequeño', accurate: 'Mediano', max: 'Grande' };

/* ============================================================
   3. ESTADO CENTRAL
   ============================================================ */
const STATE = {
  appState: 'idle',     // idle | recording | recording-local | recording-cloud | screen-recording | processing
  screen: 'welcome',    // welcome | initiative | meeting | search | glossary | archive | trash | meetings | docs
  sidebarOpen: load('hm.sidebar', '1') === '1',
  cal: { y: null, m: null, view: 'week', filter: 'all', weekStart: null },  // estado del calendario de Reuniones
  docsDest: null,        // iniciativa destino para subir/convertir documentos (rediseño v2)
  docsFilter: 'all',     // filtro de proyecto en la lista global ('all' o id de iniciativa)
  docsQuery: '',         // texto de búsqueda en la lista global de documentos
  docsOcr: 'auto',       // modo OCR al convertir: 'auto' | 'force' | 'off'
  docsExtractImages: false, // extraer imágenes embebidas al convertir documentos
  initiatives: [],
  meetingsByInit: {},    // cache
  openInits: {},         // id -> bool expandido
  selInit: null,
  selMeeting: null,
  transcript: null,
  activeTab: 'transcript',
  provider: 'auto',      // auto | local | replicate (V2)
  monitors: [],
  monitorIdx: 1,
  monitorThumbnails: {},
  screenScaleMode: load('hm.screenScaleMode', 'fit'),
  recElapsed: 0,
  recStartedAt: 0,
  recTimer: null,
  jobProgress: 0,
  jobStage: '',
  jobDeterminate: false,
  jobStartedAt: 0,
  jobClock: null,
  micMuted: true,
  meetingMicMuted: false,
  screenPanelCollapsed: false,
  settings: { export_dir: '', token_set: false },
  archiveCount: 0,
  trashCount: 0,
};

function load(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// Migración única: sidebar abierto por defecto desde v74
if (!load('hm.sidebar-default-v74', '')) { save('hm.sidebar', '1'); save('hm.sidebar-default-v74', '1'); }
// Tema: claro por defecto; 'dark' activa el modo oscuro cálido (Ajustes → Apariencia)
if (load('hm.theme', 'light') === 'dark') document.body.dataset.theme = 'dark';

function setAppState(s) {
  STATE.appState = s;
  document.body.setAttribute('data-app-state', s);
  renderActionBar();
  renderTopStatus();
  renderMain();
  refreshSidebarJobs();   // refleja grabación/transcripción en el árbol al cambiar de estado
  // adaptador opcional para el backend (no obligatorio)
}

/* ============================================================
   4. RENDER
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
function btnEl({ label = '', icon, variant = '', size = '', disabled = false, onClick } = {}) {
  const cls = ['btn', variant ? `btn-${variant}` : '', size ? `btn-${size}` : ''].filter(Boolean).join(' ');
  const b = el('button', cls);
  if (icon) b.appendChild(elFromHTML(`<span class="ico">${svg(icon, 14)}</span>`));
  b.appendChild(document.createTextNode(label));
  if (disabled) b.disabled = true;
  if (onClick) b.onclick = onClick;
  return b;
}
function emptyState({ icon = 'info', title = '', text = '', action } = {}) {
  const w = el('div', 'empty');
  let inner = `
    <div class="empty-watermark" aria-hidden="true">
      <span class="wm-square"></span><span class="wm-diamond"></span>
    </div>
    <div class="empty-inner">
      <div class="empty-logo">${svg(icon, 24)}</div>
      <h2 class="empty-title">${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ''}
    </div>`;
  w.innerHTML = inner;
  if (action) {
    const btn = btnEl({ label: action.label, variant: 'primary', onClick: action.onClick });
    btn.classList.add('btn-welcome');
    w.querySelector('.empty-inner').appendChild(btn);
  }
  return w;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function renderTopStatus() {
  const root = $('#topbarStatus');
  const s = STATE.appState;
  if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') {
    // Icono de origen: micrófono = solo audio
    root.innerHTML = `<div class="status-rec"><span class="rdot"></span><span class="rec-kind">${svg('mic', 12)}</span>Grabando reunión · <span class="mono">${fmt(STATE.recElapsed)}</span></div>`;
  } else if (s === 'screen-recording') {
    // Icono de origen: pantalla
    root.innerHTML = `<div class="status-rec"><span class="rdot"></span><span class="rec-kind">${svg('monitorDot', 12)}</span>REC pantalla · <span class="mono">${fmt(STATE.recElapsed)}</span></div>`;
  } else if (s === 'processing') {
    const progressText = STATE.jobDeterminate ? Math.round(STATE.jobProgress) + '%' : processingElapsed();
    root.innerHTML = `<div class="status-proc"><span class="spinner"></span>${esc(STATE.jobStage)} · ${progressText}</div>`;
  } else {
    // Reposo: pastilla de contexto (dónde estás: iniciativa › reunión)
    const it = STATE.initiatives.find(x => x.id === STATE.selInit);
    let ctx;
    if (STATE.screen === 'meeting' && STATE.transcript) {
      ctx = `<span class="ctx-init">${esc(it ? it.name : '')}</span>${svg('chevron', 12)}<span class="ctx-meet">${esc(_fmtMeetingLabel(STATE.transcript))}</span>`;
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
  const i = b.querySelector('.mic-ico'); if (i) i.innerHTML = svg(STATE.micMuted ? 'headerMicOff' : 'headerMic', 16);
}
function openSearch() { const s = $('#search'); if (!s) return; s.classList.add('expanded'); $('#searchInput').focus(); }

function renderMain() {
  const main = $('#main');
  document.body.setAttribute('data-screen', STATE.screen);
  // Estado activo del nav lateral (Calendario vs. Proyectos)
  const onMeetings  = STATE.screen === 'meetings';
  const onFavorites = STATE.screen === 'favorites';
  const onArchive = STATE.screen === 'archive';
  const onHome = STATE.screen === 'welcome';
  const onDocs = STATE.screen === 'docs';
  $('#navHome')?.classList.toggle('active', onHome);
  $('#navMeetings')?.classList.toggle('active', onMeetings);
  $('#navFavorites')?.classList.toggle('active', onFavorites);
  $('#navDocs')?.classList.toggle('active', onDocs);
  $('#btnArchive')?.classList.toggle('active', onArchive);
  $('#navInitiatives')?.classList.toggle('active', !onMeetings && !onFavorites && !onArchive && !onHome && !onDocs);
  switch (STATE.screen) {
    case 'welcome': return main.replaceChildren(viewWelcome());
    case 'meetings': return main.replaceChildren(viewMeetings());
    case 'favorites': return main.replaceChildren(viewFavorites());
    case 'docs': return main.replaceChildren(viewDocs());
    case 'initiatives-list': return main.replaceChildren(viewAllInitiatives());
    case 'initiative': return main.replaceChildren(viewInitiative());
    case 'meeting': return main.replaceChildren(viewMeeting());
    case 'search': return main.replaceChildren(viewSearch());
    case 'glossary': return main.replaceChildren(viewGlossary());
    case 'archive':
    case 'trash': return main.replaceChildren(viewArchiveTrash(STATE.screen));
    case 'settings': return main.replaceChildren(viewSettings());
    default: return main.replaceChildren(viewWelcome());
  }
}

/* ---- Vistas ---- */
function viewWelcome() {
  // Con proyectos ya creados, Inicio muestra la actividad reciente
  // (estilo Gmail); la bienvenida solo aparece recién instalado.
  if ((STATE.initiatives || []).length) return viewHomeFeed();
  const w = el('div', 'empty');
  w.innerHTML = `
    <div class="empty-watermark" aria-hidden="true">
      <span class="wm-square"></span>
      <span class="wm-diamond"></span>
    </div>
    <div class="empty-inner">
      <div class="empty-logo"><img src="assets/helpmeet-symbol.svg" alt=""></div>
      <h2 class="empty-title">Helpmeet</h2>
      <p>Listo para capturar contexto. Crea un nuevo proyecto o usa la barra de acciones de abajo para empezar a grabar.</p>
      <button class="btn btn-welcome" id="wNew">${svg('plus', 18)} Nuevo proyecto</button>
      <button class="empty-diag" id="wDiag">Diagnóstico del sistema</button>
    </div>`;
  w.querySelector('#wNew').onclick = promptNewInitiative;
  w.querySelector('#wDiag').onclick = openDiagnostics;
  return w;
}

// Inicio con actividad reciente: reuniones de todos los proyectos
// agrupadas por día (Hoy / Ayer / fecha), con acción rápida.
function viewHomeFeed() {
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  head.style.cssText = 'border-bottom:none';
  head.innerHTML = `<div class="mhead-row mhead-row--mid" style="max-width:640px"><h1 class="page-title">Inicio</h1></div>`;
  const content = el('div', 'content');

  const items = [];
  for (const [iid, ms] of Object.entries(STATE.meetingsByInit || {})) {
    const it = (STATE.initiatives || []).find(x => x.id === Number(iid));
    for (const m of (ms || [])) items.push({ m, it });
  }
  items.sort((a, b) => String(b.m.started_at || '').localeCompare(String(a.m.started_at || '')));
  const recent = items.slice(0, 12);

  if (!recent.length) {
    content.appendChild(emptyState({
      icon: 'calendar',
      title: 'Sin actividad todavía',
      text: 'Graba una reunión, graba la pantalla o importa un video desde la barra de abajo.',
    }));
  } else {
    const feed = el('div', 'home-feed');
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const dayLabel = (iso) => {
      const d = new Date(iso);
      if (isNaN(d)) return 'Sin fecha';
      if (d.toDateString() === today.toDateString()) return 'Hoy';
      if (d.toDateString() === yest.toDateString()) return 'Ayer';
      return `${d.getDate()} ${CAL_MONTHS_SHORT[d.getMonth()]}`;
    };
    let lastDay = null;
    recent.forEach(({ m, it }) => {
      const dl = dayLabel(m.started_at);
      if (dl !== lastDay) { feed.appendChild(el('div', 'home-day', esc(dl))); lastDay = dl; }
      const done = m.status === 'done';
      const proc = m.status === 'processing';
      const sub = proc ? 'Transcribiendo…'
        : done ? `Transcripción lista${m.dur && m.dur !== '—' ? ' · ' + m.dur : ''}`
        : m.has_video ? `Grabación${m.dur && m.dur !== '—' ? ' ' + m.dur : ''} · sin transcribir`
        : 'Pendiente';
      const icon = m.source === 'audio' ? 'mic' : m.source === 'import' ? 'upload' : m.source === 'screen' ? 'monitorDot' : 'calendar';
      const avColor = it ? (it.color || avatarColorFor(it.name)) : 'var(--text-faint)';
      // Hora de la reunión junto al título, igual que en las listas por proyecto
      const _hd = new Date(m.started_at);
      const hhmm = isNaN(_hd) ? '' : `${String(_hd.getHours()).padStart(2, '0')}:${String(_hd.getMinutes()).padStart(2, '0')}`;
      const card = el('div', 'home-card');
      card.innerHTML = `
        <span class="proj-av hc-av" style="--av:${avColor}">${it ? esc(initialsFor(it.name)) : '·'}</span>
        <div class="hc-info">
          <div class="hc-title">${esc(_fmtMeetingLabel(m))}${hhmm ? `<span class="rc-hour">${hhmm}</span>` : ''}<span class="hc-kind" title="${m.source === 'audio' ? 'Audio de reunión' : m.source === 'import' ? 'Vídeo importado' : 'Grabación de pantalla'}">${svg(icon, 13)}</span></div>
          <div class="hc-sub"><span class="hc-proj">${it ? esc(it.name) : 'Sin proyecto'}</span> · ${esc(sub)}</div>
        </div>
        <button class="hc-chip${done || proc ? '' : ' primary'}">${done ? 'Ver notas' : proc ? 'Ver progreso' : 'Transcribir'}</button>`;
      const go = (tab) => {
        if (it) STATE.selInit = it.id;
        if (tab) { STATE.activeTab = tab; openMeeting(m.id, true); }
        else openMeeting(m.id);
      };
      card.onclick = () => go();
      card.querySelector('.hc-chip').onclick = (e) => { e.stopPropagation(); go(done ? 'notas' : null); };
      feed.appendChild(card);
    });
    content.appendChild(feed);
  }
  wrap.replaceChildren(head, content);
  return wrap;
}

/* ============================================================
   Vista de Calendario (estilo Stitch)
   ============================================================ */
const CAL_MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAL_MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const CAL_DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function _dkey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function _startOfWeek(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; }

// Paleta de colores para iniciativas (tonos suaves que encajan con el tema oscuro).
const INIT_COLORS = ['#aacfbf', '#e8c17b', '#e0857b', '#86b5e0', '#a98fd6', '#8fc99b', '#e093c0', '#7fcdd0'];
function _initColor(it) { return (it && it.color) || '#aacfbf'; }
// '#rrggbb' -> 'rgba(r,g,b,a)' para fondos translúcidos del color de el proyecto.
function _hexA(hex, a) {
  let h = String(hex || '#aacfbf').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function openMeetingsView() {
  if (STATE.cal.y == null) {
    const now = new Date();
    STATE.cal.y = now.getFullYear();
    STATE.cal.m = now.getMonth();
    STATE.cal.weekStart = _dkey(_startOfWeek(now));
  }
  STATE.screen = 'meetings';
  STATE.selInit = null; STATE.selMeeting = null;
  renderSidebar(); renderMain();
}

function openDocsView() {
  STATE.screen = 'docs';
  STATE.selInit = null; STATE.selMeeting = null;
  renderSidebar(); renderMain(); renderTopStatus();
}

// Todas las reuniones (de todas las iniciativas) como lista plana, aplicando el filtro activo.
function _calMeetings() {
  const out = [];
  for (const it of STATE.initiatives) {
    if (STATE.cal.filter !== 'all' && it.id !== STATE.cal.filter) continue;
    for (const m of (STATE.meetingsByInit[it.id] || [])) out.push({ m, it });
  }
  return out;
}

function _calOpenMeeting(m, it) {
  STATE.selInit = it.id;
  if (!STATE.openInits[it.id]) { STATE.openInits = {}; STATE.openInits[it.id] = true; }
  openMeeting(m.id);
}

// 'HH:MM' -> '9:45 AM' / '4 PM' (sin minutos cuando son :00), estilo Notion.
function _calFmtTime(hhmm) {
  if (!hhmm) return '';
  const [hs, ms] = hhmm.split(':');
  let h = parseInt(hs, 10); const mm = parseInt(ms, 10) || 0;
  const ap = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return mm ? `${hh}:${String(mm).padStart(2, '0')} ${ap}` : `${hh} ${ap}`;
}
// Etiqueta del eje horario: '1PM', '12AM' (sin espacio, como Notion).
function _calFmtHourAxis(h) {
  const ap = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}${ap}`;
}
// Duración ('MM:SS' o 'H:MM:SS') -> minutos (para la altura del bloque en la rejilla horaria).
function _calDurMin(dur) {
  if (!dur) return 45;
  const p = dur.split(':').map(Number);
  if (p.length === 3) return p[0] * 60 + p[1] + p[2] / 60;
  if (p.length === 2) return p[0] + p[1] / 60;
  return 45;
}

// Evento dentro de una celda del MES (estilo Notion: punto + hora + título).
// El punto toma el color de el proyecto; pendiente = punto hueco.
function _calEvent(m, it) {
  const time = _calFmtTime((m.started_at || '').substring(11, 16));
  const color = _initColor(it);
  const pending = m.status === 'pending';
  const ev = el('div', 'cal-ev' + (pending ? ' pending' : ''));
  ev.title = `${esc(m.title)} · ${esc(it.name)}`;
  const dotStyle = pending ? `border:1.5px solid ${color};background:transparent` : `background:${color}`;
  ev.innerHTML = `<span class="cal-ev-dot" style="${dotStyle}"></span>${time ? `<span class="cal-ev-time">${esc(time)}</span>` : ''}<span class="cal-ev-title">${esc(m.title)}</span>`;
  ev.onclick = (e) => { e.stopPropagation(); _calOpenMeeting(m, it); };
  return ev;
}

function viewFavorites() {
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden';
  // Contar favoritas para mostrar en el header
  const favIds = _getMeetingFavs();
  const favList = [];
  for (const [iid, ms] of Object.entries(STATE.meetingsByInit || {})) {
    for (const m of (ms || [])) {
      if (favIds.has(m.id)) {
        const it = (STATE.initiatives || []).find(x => x.id === Number(iid));
        favList.push({ m, it });
      }
    }
  }

  const head = el('div', 'mhead');
  head.style.cssText = 'border-bottom:none';
  head.innerHTML = `<div class="mhead-row"><h1 class="page-title">Favoritos</h1><span class="spacer"></span>${favList.length ? `<button class="btn sm" id="favClearAll" title="Quitar todas las reuniones de favoritos">${svg('star', 13)}<span>Quitar todos</span></button>` : ''}</div>`;
  const clearBtn = head.querySelector('#favClearAll');
  if (clearBtn) clearBtn.onclick = () => {
    const n = favList.length;
    localStorage.setItem('hm.favMeetings', '[]');
    toast('ok', `Se quitaron ${n} de favoritos`);
    renderSidebar(); renderMain();
  };
  const content = el('div', 'content');

  if (!favList.length) {
    content.appendChild(emptyState({
      icon: 'star',
      title: 'Sin favoritas aún',
      text: 'Usa el botón ☆ en cada reunión o el menú ⋯ para marcarla como favorita.',
    }));
  } else {
    const list = el('div', 'fav-list');
    // Agrupar por iniciativa
    const byInit = new Map();
    favList.forEach(({ m, it }) => {
      const key = it ? it.id : 'none';
      if (!byInit.has(key)) byInit.set(key, { it, meetings: [] });
      byInit.get(key).meetings.push(m);
    });
    // Solo inicializar una vez (no reiniciar en cada re-render)
    if (!STATE._favOpen) {
      STATE._favOpen = new Set();
      if (byInit.size > 0) STATE._favOpen.add(byInit.keys().next().value);
    }

    byInit.forEach(({ it, meetings }, key) => {
      const mColor = it ? _initColor(it) : 'var(--text-muted)';
      const initName = it ? it.name : 'Sin proyecto';
      const isOpen = STATE._favOpen.has(key);
      // Cabecera de iniciativa (colapsable)
      const ihdr = el('div', 'fav-init-hdr' + (isOpen ? ' open' : ''));
      ihdr.innerHTML = `<span class="fav-chev">${svg('chevron', 10)}</span><span class="fav-init-dot" style="background:${mColor}"></span><span class="fav-init-name">${esc(initName)}</span><span class="fav-init-cnt">${meetings.length}</span><button class="icon-btn sm fav-grp-clear" title="Quitar este proyecto de favoritos">${svg('x', 12)}</button>`;
      ihdr.onclick = () => {
        STATE._favOpen.has(key) ? STATE._favOpen.delete(key) : STATE._favOpen.add(key);
        renderMain();
      };
      const grpClear = ihdr.querySelector('.fav-grp-clear');
      if (grpClear) grpClear.onclick = (e) => {
        e.stopPropagation();
        const s = _getMeetingFavs();
        meetings.forEach(m => s.delete(m.id));
        localStorage.setItem('hm.favMeetings', JSON.stringify([...s]));
        toast('ok', `Se quitaron ${meetings.length} de favoritos`);
        renderSidebar(); renderMain();
      };
      list.appendChild(ihdr);
      if (!isOpen) return; // colapsado: no renderizar cards
      // Cards de reunión
      meetings.forEach(m => {
        const { day, mon } = parseMeetingDate(m.date || m.started_at);
        const _hd = new Date(m.date || m.started_at);
        const hhmm = isNaN(_hd) ? '' : `${String(_hd.getHours()).padStart(2, '0')}:${String(_hd.getMinutes()).padStart(2, '0')}`;
        const c = el('div', 'row-card done fav-card');
        c.innerHTML = `
          <div class="rc-date"><span class="rc-mon">${mon}</span><span class="rc-day">${day}</span></div>
          <div class="rc-body">
            <div class="rc-title">${esc(_fmtMeetingLabel(m))}${hhmm ? `<span class="rc-hour">${hhmm}</span>` : ''}</div>
            <div class="rc-meta">${m.dur ? esc(m.dur) : ''}${m.time ? '<span class="rc-size">' + esc(m.time) + '</span>' : ''}</div>
          </div>
          <div class="rc-right">
            <div class="rc-actions">
              <button class="icon-btn sm rc-act-btn fav-on" data-act="unfav" title="Quitar de favoritas">${svg('star',13)}</button>
            </div>
            <span class="pill pill-done"><span class="pd"></span>Finalizada</span>
          </div>`;
        c.onclick = () => { if (it) STATE.selInit = it.id; openMeeting(m.id); };
        c.oncontextmenu = (e) => { e.preventDefault(); openMeetingMenu(e, m.id); };
        c.querySelector('[data-act="unfav"]').onclick = (e) => {
          e.stopPropagation();
          _toggleMeetingFav(m.id);
          c.remove();
          if (!list.querySelector('.fav-card')) renderMain();
        };
        list.appendChild(c);
      });
    });
    content.appendChild(list);
  }
  wrap.replaceChildren(head, content);
  return wrap;
}

function viewMeetings() {
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const C = STATE.cal;
  const today = new Date(); const todayKey = _dkey(today);

  // Agrupa reuniones por día (YYYY-MM-DD).
  const byDay = {};
  for (const { m, it } of _calMeetings()) {
    const k = (m.started_at || '').substring(0, 10);
    if (!k) continue;
    (byDay[k] = byDay[k] || []).push({ m, it });
  }
  for (const k in byDay) byDay[k].sort((a, b) => (a.m.started_at || '').localeCompare(b.m.started_at || ''));

  // ---- Cabecera ----
  const head = el('div', 'mhead cal-head');
  let titleMain, titleSub;
  if (C.view === 'week') {
    const ws = new Date(C.weekStart + 'T00:00:00');
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    const sameMonth = ws.getMonth() === we.getMonth();
    titleMain = sameMonth
      ? `${ws.getDate()} – ${we.getDate()} ${CAL_MONTHS_SHORT[ws.getMonth()]}`
      : `${ws.getDate()} ${CAL_MONTHS_SHORT[ws.getMonth()]} – ${we.getDate()} ${CAL_MONTHS_SHORT[we.getMonth()]}`;
    titleSub = `${we.getFullYear()}`;
  } else {
    titleMain = CAL_MONTHS[C.m];
    titleSub = `${C.y}`;
  }

  head.innerHTML = `
    <h1 class="page-title cal-page-title">Calendario</h1>
    <div class="cal-controls">
      <div class="cal-controls-left">
        <h2 class="cal-title"><span class="cal-title-main">${esc(titleMain)}</span><span class="cal-title-sep"> </span><span class="cal-title-sub">${esc(titleSub)}</span></h2>
        <div class="cal-nav">
          <button class="cal-nav-today" id="calToday">Hoy</button>
          <button class="cal-nav-btn" id="calPrev" title="Anterior" aria-label="Anterior">${svg('chevron', 15)}</button>
          <button class="cal-nav-btn" id="calNext" title="Siguiente" aria-label="Siguiente">${svg('chevron', 15)}</button>
        </div>
      </div>
      <div class="cal-controls-right">
        <span id="calFilterMount"></span>
        <div class="cal-toggle">
          <button class="${C.view === 'month' ? 'active' : ''}" id="calViewMonth">Mes</button>
          <button class="${C.view === 'week' ? 'active' : ''}" id="calViewWeek">Semana</button>
        </div>
      </div>
    </div>`;

  // Filtro por iniciativa con dropdown personalizado (tema oscuro)
  const filterItems = [{ value: 'all', label: 'Todos los proyectos' }]
    .concat(STATE.initiatives.map(it => ({ value: it.id, label: it.name, color: _initColor(it) })));
  const filterEl = customSelect({
    value: C.filter, items: filterItems, icon: 'filter', className: 'cal-filter', minWidth: 200,
    onChange: (v) => { C.filter = v; renderMain(); },
  });
  head.querySelector('#calFilterMount').replaceWith(filterEl);

  // ---- Cuerpo ----
  const body = el('div', 'cal-body');

  if (C.view === 'week') {
    body.appendChild(_calWeekGrid(C.weekStart, byDay, todayKey));
  } else {
    body.appendChild(_calMonth(C.y, C.m, byDay, todayKey));
  }

  // ---- Estado vacío sutil (solo en mes; en semana la rejilla habla por sí sola) ----
  if (!Object.keys(byDay).length && C.view === 'month') {
    const hint = el('div', 'cal-empty');
    hint.innerHTML = `${svg('calendar', 18)} <span>No hay reuniones${C.filter !== 'all' ? ' en este proyecto' : ''} en este periodo.</span>`;
    body.appendChild(hint);
  }

  // ---- Handlers ----
  head.querySelector('#calPrev').onclick = () => { _calShift(-1); renderMain(); };
  head.querySelector('#calNext').onclick = () => { _calShift(1); renderMain(); };
  head.querySelector('#calToday').onclick = () => {
    const n = new Date();
    C.y = n.getFullYear(); C.m = n.getMonth(); C.weekStart = _dkey(_startOfWeek(n));
    renderMain();
  };
  head.querySelector('#calViewMonth').onclick = () => { C.view = 'month'; renderMain(); };
  head.querySelector('#calViewWeek').onclick = () => { C.view = 'week'; renderMain(); };

  wrap.append(head, body);
  return wrap;
}

// Avanza/retrocede según la vista activa.
function _calShift(dir) {
  const C = STATE.cal;
  if (C.view === 'week') {
    const ws = new Date(C.weekStart + 'T00:00:00');
    ws.setDate(ws.getDate() + dir * 7);
    C.weekStart = _dkey(ws);
    C.y = ws.getFullYear(); C.m = ws.getMonth();
  } else {
    let m = C.m + dir, y = C.y;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    C.m = m; C.y = y;
  }
}

// Rejilla mensual estilo Notion: número a la derecha, badge rojo de hoy,
// prefijo del mes el día 1, eventos como punto + hora + título.
function _calMonth(y, m, byDay, todayKey) {
  const grid = el('div', 'cal-grid');
  const first = new Date(y, m, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const rows = Math.ceil((firstDow + daysInMonth) / 7);
  grid.style.gridTemplateRows = `auto repeat(${rows}, minmax(0, 1fr))`;

  const todayDow = new Date().getDay();
  CAL_DOW.forEach((d, i) => {
    grid.appendChild(el('div', 'cal-dow' + (i === todayDow ? ' today' : ''), d));
  });

  const start = new Date(y, m, 1 - firstDow);
  for (let i = 0; i < rows * 7; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const inMonth = date.getMonth() === m;
    const key = _dkey(date);
    const isToday = key === todayKey;
    const dn = date.getDate();
    const cell = el('div', 'cal-cell' + (inMonth ? '' : ' other') + (isToday ? ' today' : ''));
    const monPrefix = dn === 1 ? `<span class="cal-mon">${CAL_MONTHS[date.getMonth()]}</span> ` : '';
    const evs = byDay[key] || [];
    const countBadge = evs.length ? `<span class="cal-day-count">${evs.length}</span>` : '';
    cell.innerHTML = `<div class="cal-daynum">${monPrefix}<span class="cal-dnum">${dn}</span>${countBadge}</div>`;
    if (evs.length) {
      const list = el('div', 'cal-events');
      const max = 3;
      evs.slice(0, max).forEach(({ m: mm, it }) => list.appendChild(_calEvent(mm, it)));
      if (evs.length > max) list.appendChild(el('div', 'cal-more', `+${evs.length - max}`));
      cell.appendChild(list);
    }
    // Click fuera de un evento → ir a vista semana de ese día
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.cal-event, .cal-tg-more')) return;
      const C = STATE.cal;
      const dow = date.getDay();
      const ws = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow);
      C.weekStart = _dkey(ws);
      C.view = 'week';
      renderMain();
    });
    grid.appendChild(cell);
  }
  return grid;
}

const CAL_HOUR_PX = 48;   // alto de cada hora en la rejilla semanal

// Vista semanal estilo Notion: eje de horas, fila "Todo el día", columnas
// iguales y línea roja de la hora actual.
function _calWeekGrid(weekStartKey, byDay, todayKey) {
  const ws = new Date(weekStartKey + 'T00:00:00');
  const days = [];
  for (let i = 0; i < 7; i++) days.push(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
  const todayIdx = days.findIndex(d => _dkey(d) === todayKey);

  const tg = el('div', 'cal-tg');

  // Cabecera con los 7 días
  const head = el('div', 'cal-tg-head');
  head.appendChild(el('div', 'cal-tg-corner', `<span class="cal-tg-tz">${_calTzAbbr()}</span>`));
  days.forEach((d, i) => {
    const isToday = i === todayIdx;
    const dh = el('div', 'cal-tg-dh' + (isToday ? ' today' : ''));
    dh.innerHTML = `<span class="cal-tg-dow">${CAL_DOW[i]}</span> <span class="cal-tg-dnum">${d.getDate()}</span>`;
    head.appendChild(dh);
  });
  tg.appendChild(head);

  // Zona horaria con scroll
  const scroll = el('div', 'cal-tg-scroll');
  const cols = el('div', 'cal-tg-cols');

  // Columna de horas (eje)
  const times = el('div', 'cal-tg-times');
  times.style.height = `${24 * CAL_HOUR_PX}px`;
  for (let h = 0; h < 24; h++) {
    const hl = el('div', 'cal-tg-hl');
    hl.style.top = `${h * CAL_HOUR_PX}px`;
    if (h > 0) hl.textContent = _calFmtHourAxis(h);
    times.appendChild(hl);
  }
  cols.appendChild(times);

  // 7 columnas de día con sus eventos posicionados por hora
  days.forEach((d, i) => {
    const col = el('div', 'cal-tg-col' + (i === todayIdx ? ' today' : '') + (i === 0 || i === 6 ? ' weekend' : ''));
    col.style.height = `${24 * CAL_HOUR_PX}px`;
    const evs = byDay[_dkey(d)] || [];
    _calRenderColEvents(col, evs);
    cols.appendChild(col);
  });

  // Línea de hora actual (solo si hoy está en la semana)
  if (todayIdx >= 0) {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const top = (mins / 60) * CAL_HOUR_PX;
    const nowLine = el('div', 'cal-tg-now');
    nowLine.style.top = `${top}px`;
    const badge = el('div', 'cal-tg-now-badge', _calFmtTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`).replace(' ', ''));
    badge.style.top = `${top}px`;
    cols.appendChild(badge);
    cols.appendChild(nowLine);
  }

  scroll.appendChild(cols);
  tg.appendChild(scroll);

  // Auto-scroll: a la hora actual si es esta semana, o a las 7AM si no.
  setTimeout(() => {
    const target = todayIdx >= 0
      ? Math.max(0, ((new Date().getHours() * 60 + new Date().getMinutes()) / 60) * CAL_HOUR_PX - 140)
      : 7 * CAL_HOUR_PX;
    scroll.scrollTop = target;
  }, 0);

  return tg;
}

// Agrupa eventos solapados y los renderiza en columna: máx. 2 visibles + badge "+N".
function _calRenderColEvents(col, evs) {
  if (!evs.length) return;
  const getStart = m => { const hm = (m.started_at || '').substring(11, 16); const [h, mn] = hm.split(':'); return (parseInt(h, 10) || 0) * 60 + (parseInt(mn, 10) || 0); };
  const getEnd   = m => getStart(m) + Math.max(_calDurMin(m.dur) || 30, 30);
  const sorted = [...evs].sort((a, b) => getStart(a.m) - getStart(b.m));
  // Construye grupos de solapamiento
  const groups = [];
  for (const ev of sorted) {
    const s = getStart(ev.m), e = getEnd(ev.m);
    let placed = false;
    for (const g of groups) { if (s < g.end) { g.items.push(ev); g.end = Math.max(g.end, e); placed = true; break; } }
    if (!placed) groups.push({ items: [ev], end: e });
  }
  for (const g of groups) {
    const n = g.items.length;
    const show = g.items.slice(0, 2);
    const extra = n - 2;
    show.forEach((ev, idx) => {
      const node = _calTgEvent(ev.m, ev.it);
      if (n > 1) {
        node.style.left = idx === 0 ? '4px' : '51%';
        node.style.right = idx === 0 ? '51%' : '4px';
        // Apiladas: el clic muestra el panel pequeño con todas las del grupo
        node.onclick = (e) => { e.stopPropagation(); _calShowGroupPicker(e, g.items); };
      }
      col.appendChild(node);
    });
    if (extra > 0) {
      const topPx = (getStart(g.items[2].m) / 60) * CAL_HOUR_PX;
      const badge = el('div', 'cal-tg-more');
      badge.style.top = `${topPx}px`;
      badge.textContent = `+${extra}`;
      badge.title = 'Ver las ' + n + ' reuniones';
      // Clic: mini-panel con TODAS las reuniones del grupo para elegir cuál abrir
      badge.onclick = (e) => { e.stopPropagation(); _calShowGroupPicker(e, g.items); };
      col.appendChild(badge);
    }
  }
}

// Panel flotante con las reuniones solapadas de un grupo del calendario:
// se elige una y se abre (antes el "+N" no dejaba llegar a las ocultas).
function _calShowGroupPicker(e, items) {
  closeMenu();
  const panel = el('div', 'cdrop-panel cal-pick-panel');
  items.forEach(({ m, it }) => {
    const hhmm = (m.started_at || '').substring(11, 16);
    const o = el('div', 'cdrop-opt');
    o.innerHTML = `<span class="cdrop-dot" style="background:${_initColor(it)}"></span>`
      + `<span class="cdrop-opt-label">${esc(_fmtMeetingLabel(m))}</span>`
      + `<span class="cal-pick-time">${esc(_calFmtTime(hhmm))}</span>`;
    o.onclick = (ev2) => { ev2.stopPropagation(); closeMenu(); _calOpenMeeting(m, it); };
    panel.appendChild(o);
  });
  document.body.appendChild(panel);
  let left = e.clientX + 4, top = e.clientY + 4;
  if (left + panel.offsetWidth > window.innerWidth - 10) left = window.innerWidth - panel.offsetWidth - 10;
  if (top + panel.offsetHeight > window.innerHeight - 10) top = e.clientY - panel.offsetHeight - 4;
  panel.style.left = Math.max(10, left) + 'px';
  panel.style.top = Math.max(10, top) + 'px';
  _ctxOpen = panel;
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}

// Bloque de evento en la rejilla horaria (posicionado por hora de inicio y duración).
function _calTgEvent(m, it) {
  const hhmm = (m.started_at || '').substring(11, 16);
  const [hs, ms] = hhmm.split(':');
  const startMin = (parseInt(hs, 10) || 0) * 60 + (parseInt(ms, 10) || 0);
  const durMin = _calDurMin(m.dur);
  const warn = m.status === 'pending';
  const color = _initColor(it);
  const ev = el('div', 'cal-tg-ev' + (warn ? ' pending' : ''));
  ev.style.top = `${(startMin / 60) * CAL_HOUR_PX}px`;
  ev.style.height = `${Math.max((durMin / 60) * CAL_HOUR_PX, 30)}px`;
  ev.style.background = _hexA(color, warn ? 0.1 : 0.18);
  ev.style.boxShadow = `inset 3px 0 0 ${color}`;
  ev.title = `${esc(m.title)} · ${esc(it.name)}`;
  ev.innerHTML = `<span class="cal-tg-ev-title">${esc(m.title)}</span><span class="cal-tg-ev-time" style="color:${color}">${esc(_calFmtTime(hhmm))}</span>`;
  ev.onclick = (e) => { e.stopPropagation(); _calOpenMeeting(m, it); };
  return ev;
}

// Abreviatura de zona horaria local (p. ej. "GMT-5"), para la esquina de la rejilla.
function _calTzAbbr() {
  const off = -new Date().getTimezoneOffset() / 60;
  return 'GMT' + (off >= 0 ? '+' : '') + off;
}

function viewInitiative() {
  const it = STATE.initiatives.find(x => x.id === STATE.selInit);
  const ms = STATE.meetingsByInit[STATE.selInit] || [];
  const wrap = el('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';

  let selectMode = false;
  const selected = new Set();
  let row = null;

  const head = el('div', 'mhead init-head');
  const last = ms[0];

  const initCreatedStr = it && it.created_at
    ? formatDateShort(it.created_at)
    : '';

  const doneCount = ms.filter(m => m.status === 'done').length;
  const initMeta = ms.length
    ? `${ms.length} ${ms.length === 1 ? 'reunión' : 'reuniones'}${doneCount ? ' · ' + doneCount + (doneCount === 1 ? ' transcrita' : ' transcritas') : ''}`
    : 'Sin reuniones todavía';
  head.innerHTML = `
    <div class="init-status-row">
      <div class="init-title-group">
        <span class="proj-av init-av" style="--av:${(it && it.color) || avatarColorFor(it ? it.name : '')}">${esc(initialsFor(it ? it.name : ''))}</span>
        <div class="init-title-col">
          <h1 class="mtitle-h title-lg">${esc(it ? it.name : '')}</h1>
          <span class="init-meta">${esc(initMeta)}</span>
        </div>
        ${initCreatedStr ? `<span class="init-created">${esc(initCreatedStr)}</span>` : ''}
      </div>
      <div class="init-actions" id="initActions">
        <button class="init-copy-md init-actions-rest ${ms.length ? '' : 'is-disabled'}" id="initCopyMd" title="${ms.length ? 'Copiar transcripción en Markdown' : 'Aún no hay reuniones que copiar'}">${svg('copy', 14)}<span>Copiar transcripción .md</span></button>
        <span class="init-actions-sep init-actions-rest"></span>
        <button class="icon-btn ${ms.length ? '' : 'is-disabled'}" id="initSearchBtn" title="Buscar en este proyecto">${svg('search', 15)}</button>
        <div class="init-actions-searchbox" id="initActionsSearchbox" hidden>
          <input id="initSearch" type="search" class="init-inline-input" placeholder="Buscar en este proyecto…" aria-label="Buscar en este proyecto" autocomplete="off">
          <span class="tx-count" id="initSearchCount"></span>
          <button class="icon-btn sm" id="initSearchClear" title="Limpiar" aria-label="Limpiar" hidden>${svg('x', 13)}</button>
        </div>
        <span class="init-actions-sep init-actions-rest"></span>
        <button class="icon-btn init-actions-rest ${ms.length ? '' : 'is-disabled'}" id="initSelectBtn" title="Seleccionar reuniones para eliminar">${svg('checkSquare', 15)}</button>
        <button class="icon-btn init-actions-rest" id="initOpenFolder" title="Abrir la carpeta completa del proyecto">${svg('folder', 15)}</button>
        <button class="icon-btn init-actions-rest" id="initMenu" aria-label="Más acciones del proyecto">${svg('dots', 16)}</button>
      </div>
    </div>`;

  // Objetivo / contexto: editable, estilo bloque descripción (sin etiqueta ni pista).
  const objBox = el('div', 'obj-box');
  objBox.innerHTML = `<textarea id="initObjetivo" class="obj-text" rows="2"
    placeholder="Contexto del proyecto"></textarea>`;
  const ta = objBox.querySelector('#initObjetivo');
  ta.value = (it && it.description) || '';
  const _resizeObj = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', _resizeObj);
  setTimeout(_resizeObj, 0);
  ta.onblur = async () => {
    const val = ta.value.trim();
    if (it && val === ((it.description) || '')) return;
    await api.setInitiativeDescription(STATE.selInit, val);
    if (it) it.description = val;
    toast('ok', 'Objetivo guardado');
  };
  head.appendChild(objBox);

  const scroll = el('div', 'content');
  const recents = el('div');
  // El buscador vive en la barra de acciones del header (ver initActionsSearchbox)

  const listWrapper = el('div');
  if (!ms.length) {
    const p = el('p');
    p.innerHTML = '<span style="color:var(--text-muted);font-size:13px">Aún no hay reuniones. Pulsa <b>Grabar reunión</b> o <b>Importar video</b> para empezar.</span>';
    listWrapper.appendChild(p);
  } else {
    row = el('div', 'list');

    // Función que crea y añade una card de reunión al contenedor dado
    const _appendCard = (m, container) => {
      const c = el('div', 'row-card' + (m.status === 'pending' ? ' warn' : m.status === 'done' ? ' done' : ''));
      const { day, mon } = parseMeetingDate(m.date || m.started_at);
      // Hora de la reunión (p. ej. "18:32") para distinguir varias del mismo día
      const _hd = new Date(m.date || m.started_at);
      const hhmm = isNaN(_hd) ? '' : `${String(_hd.getHours()).padStart(2, '0')}:${String(_hd.getMinutes()).padStart(2, '0')}`;
      // Estado como etiqueta pequeña en la meta (modelo de fila unificado)
      const stTag = m.status === 'done'
        ? '<span class="hm-tag ok"><span class="dt"></span>Finalizada</span>'
        : m.status === 'processing'
        ? '<span class="hm-tag proc"><span class="spinner sm"></span>Transcribiendo…</span>'
        : m.status === 'error'
        ? '<span class="hm-tag err"><span class="dt"></span>Error</span>'
        : '<span class="hm-tag warn"><span class="dt"></span>Pendiente</span>';
      const viewLabel = m.status === 'done' ? 'Ver notas'
        : m.status === 'processing' ? 'Ver progreso' : 'Transcribir';
      const isFav = _isMeetingFav(m.id);
      c.innerHTML = `
        <div class="rc-sel"><span class="rc-cb"></span></div>
        <div class="rc-date"><span class="rc-mon">${mon}</span><span class="rc-day">${day}</span></div>
        <div class="rc-body"><div class="rc-title">${esc(_fmtMeetingLabel(m))}${hhmm ? `<span class="rc-hour">${hhmm}</span>` : ''}</div><div class="rc-meta">${_kindIcon(m)}${m.dur ? esc(m.dur) : ''}${m.size ? '<span class="rc-size">' + esc(m.size) + '</span>' : ''}${stTag}</div></div>
        <div class="rc-right">
          <div class="rc-actions">
            <button class="icon-btn sm rc-act-btn${isFav ? ' fav-on' : ''}" data-act="fav" title="${isFav ? 'Quitar de favoritas' : 'Marcar como favorita'}">${svg('star', 13)}</button>
            <button class="icon-btn sm rc-act-btn" data-act="rename" title="Renombrar">${svg('edit', 13)}</button>
            <button class="icon-btn sm rc-act-btn" data-act="archive" title="Archivar reunión">${svg('archive', 13)}</button>
          </div>
          <button class="hm-view" data-act="open">${viewLabel}</button>
        </div>`;
      // Botón principal: mismo comportamiento que las tarjetas de Inicio
      c.querySelector('.hm-view').onclick = (e) => {
        e.stopPropagation();
        if (m.status === 'done') { STATE.activeTab = 'notas'; openMeeting(m.id, true); }
        else openMeeting(m.id);
      };
      c.onclick = () => {
        if (selectMode) {
          if (selected.has(m.id)) { selected.delete(m.id); c.classList.remove('sel'); }
          else { selected.add(m.id); c.classList.add('sel'); }
          updateBar();
        } else openMeeting(m.id);
      };
      c.querySelectorAll('.rc-act-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          if (btn.dataset.act === 'rename') {
            const titleEl = c.querySelector('.rc-title');
            const input = document.createElement('input');
            input.type = 'text'; input.value = m.title; input.className = 'rc-title-input';
            titleEl.replaceWith(input); input.focus(); input.select();
            input.addEventListener('click', ev => ev.stopPropagation());
            let done = false;
            const commit = async (save) => {
              if (done) return; done = true;
              const val = input.value.trim();
              if (save && val && val !== m.title) {
                await api.renameMeeting(m.id, val);
                for (const k in STATE.meetingsByInit) { const x = STATE.meetingsByInit[k].find(x => x.id === m.id); if (x) x.title = val; }
                m.title = val;
                if (STATE.transcript && STATE.transcript.id === m.id) STATE.transcript.title = val;
                toast('ok', 'Reunión renombrada');
              }
              input.replaceWith(el('div', 'rc-title', esc(m.title) + (hhmm ? `<span class="rc-hour">${hhmm}</span>` : '')));
            };
            input.addEventListener('keydown', e => {
              if (e.key === 'Enter') { e.preventDefault(); commit(true); }
              if (e.key === 'Escape') { e.preventDefault(); commit(false); }
            });
            input.addEventListener('blur', () => commit(true));
          } else if (btn.dataset.act === 'archive') archiveMeeting(m.id);
          else if (btn.dataset.act === 'fav') {
            _toggleMeetingFav(m.id);
            const nowFav = _isMeetingFav(m.id);
            btn.classList.toggle('fav-on', nowFav);
            btn.title = nowFav ? 'Quitar de favoritas' : 'Marcar como favorita';
            renderSidebar();
          } else if (btn.dataset.act === 'trash') archiveMeeting(m.id);
        });
      });
      container.appendChild(c);
    };

    // Agrupar por mes → semana y renderizar con headers colapsables
    const _IV_MS  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const _IV_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const _ivWeekOf = (iso) => {
      if (!iso) return null;
      const d = new Date(iso); if (isNaN(d)) return null;
      const day = d.getDay();
      const mon2 = new Date(d); mon2.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      mon2.setHours(0, 0, 0, 0);
      const sun2 = new Date(mon2); sun2.setDate(mon2.getDate() + 6);
      // La semana pertenece al mes de su JUEVES (convención ISO): así una
      // semana a caballo entre dos meses no se duplica en ambos.
      const thu = new Date(mon2); thu.setDate(mon2.getDate() + 3);
      const fmt = dt => `${dt.getDate()} ${_IV_MS[dt.getMonth()]}`;
      const wKey = `${mon2.getFullYear()}-${String(mon2.getMonth()+1).padStart(2,'0')}-${String(mon2.getDate()).padStart(2,'0')}`;
      return { mKey:`${thu.getFullYear()}-${String(thu.getMonth()+1).padStart(2,'0')}`, wKey, wLabel:`${fmt(mon2)} – ${fmt(sun2)}`, mLabel:`${_IV_MES[thu.getMonth()]} ${thu.getFullYear()}` };
    };
    const _ivMOrder=[], _ivMMap=new Map(), _ivWMap=new Map();
    ms.forEach(m => {
      const g = _ivWeekOf(m.started_at) || {mKey:'none',wKey:'none',wLabel:'—',mLabel:'Sin fecha'};
      if (!_ivMMap.has(g.mKey)) { _ivMMap.set(g.mKey,{mLabel:g.mLabel,wkKeys:[]}); _ivMOrder.push(g.mKey); }
      const mk=`${g.mKey}|${g.wKey}`;
      if (!_ivWMap.has(mk)) { _ivWMap.set(mk,{wLabel:g.wLabel,items:[]}); _ivMMap.get(g.mKey).wkKeys.push(mk); }
      _ivWMap.get(mk).items.push(m);
    });
    if (!STATE._ivWeeks) STATE._ivWeeks = {};
    if (!STATE._ivWeeks[STATE.selInit]) {
      const fw = _ivMOrder.length ? _ivMMap.get(_ivMOrder[0]).wkKeys[0] : null;
      STATE._ivWeeks[STATE.selInit] = new Set(fw ? [fw] : []);
    }
    const _ivOpen = STATE._ivWeeks[STATE.selInit];

    // Meses desplegables (por defecto abiertos; se guarda lo cerrado)
    if (!STATE._ivMonths) STATE._ivMonths = {};
    if (!STATE._ivMonths[STATE.selInit]) STATE._ivMonths[STATE.selInit] = new Set();
    const _ivClosed = STATE._ivMonths[STATE.selInit];

    _ivMOrder.forEach(mKey => {
      const {mLabel, wkKeys} = _ivMMap.get(mKey);
      const mOpen = !_ivClosed.has(mKey);
      const mhdr = el('div', 'list-month-hdr' + (mOpen ? ' open' : ''));
      mhdr.innerHTML = `<span class="tw-chev">${svg('chevron', 9)}</span><span>${esc(mLabel)}</span>`;
      mhdr.onclick = () => { _ivClosed.has(mKey) ? _ivClosed.delete(mKey) : _ivClosed.add(mKey); renderMain(); };
      row.appendChild(mhdr);
      if (!mOpen) return;
      wkKeys.forEach(mk => {
        const {wLabel, items} = _ivWMap.get(mk);
        const isOpen = _ivOpen.has(mk);
        const whdr = el('div', 'list-week-hdr' + (isOpen ? ' open' : ''));
        whdr.innerHTML = `<span class="tw-chev">${svg('chevron',10)}</span><span class="lw-label">${esc(wLabel)}</span><span class="lw-cnt">${items.length}</span>`;
        whdr.onclick = () => { _ivOpen.has(mk) ? _ivOpen.delete(mk) : _ivOpen.add(mk); renderMain(); };
        row.appendChild(whdr);
        if (isOpen) items.forEach(m => _appendCard(m, row));
      });
    });

    listWrapper.appendChild(row);
  }
  recents.appendChild(listWrapper);

  const results = el('div', 'list'); results.hidden = true;
  recents.appendChild(results);
  scroll.appendChild(recents);

  // Barra de selección múltiple (sticky arriba de la lista, animada)
  const selBar = el('div', 'sel-bar');
  selBar.innerHTML = `<span class="sel-info" id="selBarCount">0 seleccionadas</span><div class="spacer"></div><button class="btn btn-ghost" id="selCancel">Cancelar</button><button class="btn btn-danger" id="selDelete" disabled>Eliminar</button>`;
  scroll.insertBefore(selBar, recents);

  const updateBar = () => {
    const n = selected.size;
    selBar.querySelector('#selBarCount').textContent = n === 1 ? '1 seleccionada' : `${n} seleccionadas`;
    selBar.querySelector('#selDelete').disabled = n === 0;
  };
  const enterSelectMode = () => {
    selectMode = true;
    if (row) row.classList.add('selecting');
    selBar.classList.add('open');
    head.querySelector('#initSelectBtn')?.classList.add('active');
    updateBar();
  };
  const exitSelectMode = () => {
    selectMode = false;
    selected.clear();
    if (row) { row.classList.remove('selecting'); row.querySelectorAll('.row-card.sel').forEach(c => c.classList.remove('sel')); }
    selBar.classList.remove('open');
    head.querySelector('#initSelectBtn')?.classList.remove('active');
  };

  if (ms.length) {
    const searchbox = head.querySelector('#initActionsSearchbox');
    const actionsEl = head.querySelector('#initActions');
    const restEls = head.querySelectorAll('.init-actions-rest');
    let _initOutside = null;
    const closeSearch = () => {
      searchbox.hidden = true;
      actionsEl.classList.remove('searching');
      restEls.forEach(e => { e.style.display = ''; });
      head.querySelector('#initSearchBtn').classList.remove('active');
      const input = head.querySelector('#initSearch');
      if (input.value) { input.value = ''; head.querySelector('#initSearchClear').click(); }
      if (_initOutside) { document.removeEventListener('mousedown', _initOutside, true); _initOutside = null; }
    };

    wireInitiativeSearch(searchbox, listWrapper, results, ms);

    const initSearchBtn = head.querySelector('#initSearchBtn');
    initSearchBtn.onclick = () => {
      const willOpen = searchbox.hidden;
      searchbox.hidden = !willOpen;
      actionsEl.classList.toggle('searching', willOpen);
      restEls.forEach(e => { e.style.display = willOpen ? 'none' : ''; });
      initSearchBtn.classList.toggle('active', willOpen);
      if (willOpen) {
        head.querySelector('#initSearch').focus();
        _initOutside = (e) => { if (!searchbox.contains(e.target) && e.target !== initSearchBtn) closeSearch(); };
        document.addEventListener('mousedown', _initOutside, true);
      } else closeSearch();
    };
    head.querySelector('#initSearchClear').addEventListener('click', closeSearch);

    const selectBtn = head.querySelector('#initSelectBtn');
    if (selectBtn) selectBtn.onclick = () => selectMode ? exitSelectMode() : enterSelectMode();
    selBar.querySelector('#selCancel').onclick = exitSelectMode;
    selBar.querySelector('#selDelete').onclick = () => {
      const n = selected.size; if (!n) return;
      confirmModal(
        `Archivar ${n} reunión${n > 1 ? 'es' : ''}`,
        'Se moverán a Archivados. Podrás restaurarlas cuando quieras.',
        'Archivar',
        async () => {
          for (const mid of [...selected]) await api.archiveItem('meeting', mid);
          toast('ok', `${n} reunión${n > 1 ? 'es' : ''} archivada${n > 1 ? 's' : ''}`);
          exitSelectMode(); refreshAll(); updateLibraryCounts();
        }
      );
    };
  }

  head.querySelector('#initMenu').onclick = (e) => openInitiativeMenu(e, STATE.selInit);
  head.querySelector('#initCopyMd').onclick = (e) => ms.length && copyInitiativeContext(STATE.selInit, e.currentTarget);
  head.querySelector('#initOpenFolder').onclick = (e) => openInitiativeFolder(STATE.selInit, e.currentTarget);
  wrap.replaceChildren(head, scroll);
  return wrap;
}

// Formatea un ISO timestamp a "dd/mm/aa" para mostrar en la UI.
function formatDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

// Extrae { day, mon } de cadenas de fecha como "24 jun 2026", "Jun 24", "2026-06-24"
function parseMeetingDate(dateStr) {
  if (!dateStr) return { day: '—', mon: '—' };
  const MES = { ene:'ENE', feb:'FEB', mar:'MAR', abr:'ABR', may:'MAY', jun:'JUN', jul:'JUL', ago:'AGO', sep:'SEP', oct:'OCT', nov:'NOV', dic:'DIC', jan:'ENE', apr:'ABR', aug:'AGO', dec:'DIC' };
  const s = dateStr.toLowerCase();
  let m;
  m = s.match(/(\d{1,2})\s+([a-z]{3})/);
  if (m) return { day: m[1], mon: MES[m[2]] || m[2].toUpperCase() };
  m = s.match(/([a-z]{3})\s+(\d{1,2})/);
  if (m) return { day: m[2], mon: MES[m[1]] || m[1].toUpperCase() };
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) { const MM = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']; return { day: String(+m[1]), mon: MM[+m[2]-1] || '—' }; }
  m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const MM = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']; return { day: String(+m[3]), mon: MM[+m[2]-1] || '—' }; }
  return { day: dateStr.substring(0, 2), mon: '—' };
}

// Agrupa un array de reuniones por mes, preservando el orden
function groupByMonth(ms) {
  const FULL_TEXT = { ene:'Enero', feb:'Febrero', mar:'Marzo', abr:'Abril', may:'Mayo', jun:'Junio', jul:'Julio', ago:'Agosto', sep:'Septiembre', oct:'Octubre', nov:'Noviembre', dic:'Diciembre', jan:'Enero', apr:'Abril', aug:'Agosto', dec:'Diciembre' };
  const FULL_NUM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const groups = [], seen = new Map();
  ms.forEach(m => {
    const s = (m.date || m.started_at || '').toLowerCase();
    let label = '—';
    // ISO: 2026-06-20T…
    const iso = s.match(/(\d{4})-(\d{2})-\d{2}/);
    if (iso) {
      const full = FULL_NUM[+iso[2] - 1];
      label = full ? full + ' ' + iso[1] : '—';
    } else {
      const yr = (s.match(/(\d{4})/) || [])[1] || '';
      const mo = (s.match(/([a-z]{3})/) || [])[1] || '';
      const full = FULL_TEXT[mo];
      label = full ? full + (yr ? ' ' + yr : '') : '—';
    }
    if (!seen.has(label)) { const g = { label, items: [] }; groups.push(g); seen.set(label, g); }
    seen.get(label).items.push(m);
  });
  return groups;
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
    const mine = ++token;
    // Primero: reuniones cuyo título coincide (búsqueda local inmediata)
    const ql = q.toLowerCase();
    const titleMatches = ms.filter(m => (m.title || '').toLowerCase().includes(ql));
    // Segundo: búsqueda FTS en frases/notas del backend
    const all = await api.search(q) || [];
    if (mine !== token) return;
    const hits = all.filter(r => ids.has(r.meeting_id));
    const titleMatchIds = new Set(titleMatches.map(m => m.id));
    // Hits de contenido que no son ya reuniones con título coincidente van después
    const contentHits = hits.filter(r => !titleMatchIds.has(r.meeting_id));
    const total = titleMatches.length + contentHits.length;
    list.hidden = true; results.hidden = false; results.replaceChildren();
    countEl.textContent = total ? `${total} resultado${total > 1 ? 's' : ''}` : 'Sin resultados';
    if (!total) {
      results.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Sin resultados en este proyecto.</p>';
      return;
    }
    // — Sección: reuniones por nombre —
    if (titleMatches.length) {
      const sec = el('div', 'res-section-label', 'Por nombre de reunión');
      results.appendChild(sec);
      titleMatches.forEach(m => {
        const c = el('div', 'result result--meeting');
        c.innerHTML = `<div class="res-meta res-meta--title">${highlight(m.title || 'Sin título', q)}</div>`;
        c.onclick = () => openMeeting(m.id);
        results.appendChild(c);
      });
    }
    // — Sección: coincidencias en el contenido —
    if (contentHits.length) {
      if (titleMatches.length) results.appendChild(el('div', 'res-section-label', 'En el contenido'));
      contentHits.forEach(r => {
        const kind = r.kind || 'frase';
        const speaker = kind === 'nota' ? 'NOTA' : (r.speaker === 'me' ? 'YO' : 'LOS DEMÁS');
        const c = el('div', 'result');
        c.innerHTML = `<div class="res-meta">${esc(r.meeting_title || r.meeting || '')} · ${esc(r.date)} · ${esc(kind)} · ${speaker}</div><div class="res-text">${highlight(r.text, q)}</div>`;
        c.onclick = () => { if (r.meeting_id) openMeeting(r.meeting_id); };
        results.appendChild(c);
      });
    }
  }

  input.addEventListener('input', (e) => { clearTimeout(deb); const v = e.target.value; deb = setTimeout(() => doSearch(v), 300); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(deb); doSearch(e.target.value); } });
  clearBtn.onclick = () => { input.value = ''; reset(); input.focus(); };
}

/* Copia el contexto.md completo de el proyecto al portapapeles (para pegarlo
   directo en Claude Code). Refresca antes el export para llevar lo último. */
async function copyInitiativeContext(iid, btn) {
  if (btn) btn.classList.add('is-loading');
  try {
    const r = await api.copyInitiativeContext(iid);
    if (!r || !r.text || !r.text.trim()) {
      toast('info', 'Aún no hay nada que copiar en este proyecto.');
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
  } catch (e) { toast('err', 'No se pudo exportar el proyecto'); }
  finally { if (btn) btn.classList.remove('is-loading'); }
}

async function openInitiativeFolder(iid, btn) {
  if (btn) btn.classList.add('is-loading');
  try {
    const r = await api.openInitiativeFolder(iid);
    if (r && r.ok) toast('ok', 'Carpeta del proyecto abierta');
    else toast('err', 'No se pudo abrir la carpeta de el proyecto');
  } catch (e) {
    toast('err', 'No se pudo abrir la carpeta de el proyecto');
  } finally {
    if (btn) btn.classList.remove('is-loading');
  }
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

function currentMeetingJob() {
  const mid = STATE.selMeeting == null ? null : String(STATE.selMeeting);
  if (!mid) return null;
  return (STATE.bgJobs || []).find(j =>
    String(j.meeting_id) === mid && (j.state === 'queued' || j.state === 'running')
  ) || null;
}

// ¿Esta reunión se está transcribiendo ahora mismo? (progreso en vivo de bgJobs)
function meetingIsTranscribing(mid) {
  return (STATE.bgJobs || []).some(j =>
    String(j.meeting_id) === String(mid) && (j.state === 'queued' || j.state === 'running')
  );
}

// Id de la reunión que se está grabando ahora mismo (reunión o pantalla), o null.
function recordingMeetingId() {
  const s = STATE.appState;
  if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') return STATE.selMeeting;
  if (s === 'screen-recording') return STATE.screenMeetingId;
  return null;
}
function meetingIsRecording(mid) {
  const rid = recordingMeetingId();
  return rid != null && String(rid) === String(mid);
}

function meetingJobMarkup(job) {
  if (!job) return '';
  const pct = Math.max(0, Math.min(100, Math.round((job.progress || 0) * 100)));
  const canCancel = job.state === 'running' || job.state === 'queued';
  return `<div class="meeting-title-job" data-meeting-job data-job-mid="${job.meeting_id}">
      <span class="meeting-title-pct">${pct}%</span>
      <span class="meeting-title-track"><i style="width:${pct}%"></i></span>
      ${canCancel ? `<button class="mtj-cancel" data-cancel-job title="Cancelar transcripción" aria-label="Cancelar transcripción">${svg('x', 11)}</button>` : ''}
    </div>`;
}

function refreshMeetingTitleJob() {
  if (STATE.screen !== 'meeting') return;
  const group = document.querySelector('.meeting-title-group');
  if (!group) return;
  const job = currentMeetingJob();
  group.classList.toggle('is-processing', !!job);
  let spin = group.querySelector('.meeting-title-spinner');
  if (job && !spin) {
    spin = el('span', 'spinner sm meeting-title-spinner');
    group.prepend(spin);
  } else if (!job && spin) {
    spin.remove();
  }
  // La barra de progreso vive bajo los tabs (#meetingJobRow), no en el título.
  const row = document.querySelector('#meetingJobRow');
  if (!row) return;
  const old = row.querySelector('[data-meeting-job]');
  if (job) {
    const tmp = el('div');
    tmp.innerHTML = meetingJobMarkup(job);
    const fresh = tmp.firstElementChild;
    _wireJobCancel(fresh);
    if (old) old.replaceWith(fresh); else row.appendChild(fresh);
  } else if (old) old.remove();
}

function _wireJobCancel(el) {
  const btn = el && el.querySelector('[data-cancel-job]');
  if (!btn) return;
  const mid = el.dataset.jobMid;
  btn.onclick = async (e) => {
    e.stopPropagation();
    btn.disabled = true;
    await api.v2.cancelMeetingJob(mid).catch(() => {});
    toast('info', 'Cancelando transcripción…');
  };
}

function viewMeeting() {
  const t = STATE.transcript;
  const it = STATE.initiatives.find(x => x.id === STATE.selInit);
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead init-head meeting-head');
  // Sin transcripción (p. ej. vídeo aún sin transcribir) no hay nada que copiar,
  // exportar ni a quién asignar: esos botones se atenúan y desactivan.
  const fraseCount = t && t.utterances ? t.utterances.filter(u => !u.kind || u.kind === 'utterance').length : 0;
  const transcribed = fraseCount > 0;
  const txOff = transcribed ? '' : ' is-disabled';
  const txTip = transcribed ? '' : 'Disponible cuando transcribas el vídeo';
  const meetingDateStr = t && t.started_at ? formatDateShort(t.started_at) : '';
  const meetingJob = currentMeetingJob();
  // Duración del vídeo: va junto a la fecha, en la línea del título.
  // Ya no mostramos "Sin transcripción" ni el recuento de frases.
  const videoDur = t && t.video_duration
    ? `<span class="meeting-video-dur"><span class="mvd-ico">${svg('play', 11)}</span>${esc(t.video_duration)}</span>`
    : t && t.duration && !t.video_path
    ? `<span class="meeting-video-dur"><span class="mvd-ico">${svg('mic', 11)}</span>${esc(t.duration)}</span>`
    : '';
  head.innerHTML = `
    <div class="init-status-row meeting-status-row">
      <div class="init-title-group meeting-title-group ${meetingJob ? 'is-processing' : ''}">
        ${meetingJob ? '<span class="spinner sm meeting-title-spinner"></span>' : ''}
        <div class="meeting-title-copy">
          <div class="meeting-title-line">
            <h1 class="mtitle-h title-lg">${esc(t ? _fmtMeetingLabel(t) : 'Reunión')}</h1>
            ${meetingDateStr ? `<span class="init-created">${esc(meetingDateStr)}</span>` : ''}
            ${videoDur}
          </div>
        </div>
      </div>
      <div class="init-actions meeting-actions" id="meetingActions">
        <button class="init-copy-md${txOff} mact-rest" id="mCopy" title="${txTip || 'Copiar la transcripción en Markdown'}">${svg('copy', 14)}<span>Copiar transcripción .md</span></button>
        <span class="init-actions-sep mact-rest" id="mSearchSep"></span>
        <button class="icon-btn${txOff}" id="mSearch" title="${txTip || 'Buscar en la transcripción'}">${svg('search', 15)}</button>
        <div class="init-actions-searchbox" id="mSearchBox" hidden>
          <input id="mSearchInput" type="search" class="init-inline-input" placeholder="Buscar en la transcripción…" autocomplete="off">
          <span class="tx-count" id="mSearchCount"></span>
          <button class="icon-btn sm" id="mSearchClear" hidden>${svg('x', 13)}</button>
        </div>
        <span class="init-actions-sep mact-rest"></span>
        <button class="icon-btn mact-rest${_isMeetingFav(t ? t.id : 0) ? ' fav-on' : ''}" id="mFav" title="${_isMeetingFav(t ? t.id : 0) ? 'Quitar de favoritos' : 'Añadir a favoritos'}">${svg('star', 15)}</button>
        <button class="icon-btn mact-rest" id="mOpen" title="Abrir la carpeta de la reunión">${svg('folder', 15)}</button>
        <button class="icon-btn mact-rest" id="mMenu" aria-label="Más acciones de la reunión">${svg('dots', 16)}</button>
      </div>
    </div>
    <div class="tabs" role="tablist">
      ${['transcript', 'notas', 'archivos'].map(tab => {
        const label = { transcript: 'Transcripción', notas: 'Notas', archivos: 'Archivos' }[tab];
        return `<button class="tab ${STATE.activeTab === tab ? 'active' : ''}" data-tab="${tab}" role="tab">${label}</button>`;
      }).join('')}
    </div>
    <div class="meeting-job-row" id="meetingJobRow">${meetingJobMarkup(meetingJob)}</div>`;
  const content = el('div', 'content');
  if (STATE.activeTab === 'notas') content.classList.add('notes-mode');
  content.appendChild(renderTab(STATE.activeTab, t));
  // Wire botón cancelar si hay trabajo activo al renderizar la vista
  _wireJobCancel(head.querySelector('[data-meeting-job]'));
  // eventos
  head.querySelector('#mCopy').onclick = (e) => copyMeetingContext(STATE.selMeeting, e.currentTarget);
  head.querySelector('#mOpen').onclick = (e) => doOpenFolder(e.currentTarget);
  head.querySelector('#mMenu').onclick = (e) => openMeetingMenu(e, STATE.selMeeting);
  const mFavBtn = head.querySelector('#mFav');
  if (mFavBtn && t) {
    mFavBtn.onclick = () => {
      _toggleMeetingFav(t.id);
      const nowFav = _isMeetingFav(t.id);
      mFavBtn.classList.toggle('fav-on', nowFav);
      mFavBtn.title = nowFav ? 'Quitar de favoritos' : 'Añadir a favoritos';
      renderSidebar();
      toast(nowFav ? 'ok' : 'info', nowFav ? 'Añadida a favoritos' : 'Quitada de favoritos');
    };
  }
  {
    const mSearchBtn = head.querySelector('#mSearch');
    const mSearchBox = head.querySelector('#mSearchBox');
    const mSearchInput = head.querySelector('#mSearchInput');
    const mSearchCount = head.querySelector('#mSearchCount');
    const mSearchClear = head.querySelector('#mSearchClear');
    const restEls = head.querySelectorAll('.mact-rest');
    let _mOutside = null;
    const close = () => {
      mSearchBox.hidden = true; mSearchBtn.classList.remove('active');
      restEls.forEach(e => { e.style.display = ''; });
      head.querySelector('#meetingActions').classList.remove('searching');
      mSearchInput.value = ''; mSearchCount.textContent = '';
      if (STATE._txApply) STATE._txApply('');
      if (_mOutside) { document.removeEventListener('mousedown', _mOutside, true); _mOutside = null; }
    };
    const openMSearch = () => {
      mSearchBox.hidden = false; mSearchBtn.classList.add('active');
      restEls.forEach(e => { e.style.display = 'none'; });
      head.querySelector('#meetingActions').classList.add('searching');
      setTimeout(() => mSearchInput.focus(), 0);
      _mOutside = (e) => { if (!mSearchBox.contains(e.target) && e.target !== mSearchBtn) close(); };
      document.addEventListener('mousedown', _mOutside, true);
    };
    mSearchBtn.onclick = () => {
      if (!transcribed) return;
      if (STATE.activeTab !== 'transcript') { STATE.activeTab = 'transcript'; renderMain(); return; }
      mSearchBox.hidden ? openMSearch() : close();
    };
    let deb;
    mSearchInput.addEventListener('input', () => {
      clearTimeout(deb); deb = setTimeout(() => {
        const q = mSearchInput.value.trim();
        mSearchClear.hidden = !q;
        const n = STATE._txApply ? STATE._txApply(q) : 0;
        mSearchCount.textContent = q ? (n ? `${n} resultado${n > 1 ? 's' : ''}` : 'Sin resultados') : '';
      }, 180);
    });
    mSearchInput.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    mSearchClear.onclick = () => close();
  }
  head.querySelectorAll('.tab').forEach(b => b.onclick = () => { STATE.activeTab = b.dataset.tab; renderMain(); });
  wrap.replaceChildren(head, content);
  return wrap;
}

function renderTab(tab, t) {
  if (tab === 'archivos') return renderFiles();
  if (tab === 'notas') return renderNotes();
  return renderTranscript(t);  // por defecto, la transcripción
}

function renderTranscript(t) {
  const r = el('div', 'reading');
  // Grabación de pantalla: agrupa panel + input de contexto en un bloque visual.
  const videoSection = (t && t.video_path) ? el('div', 'video-section') : null;
  if (videoSection) { videoSection.appendChild(videoPanel(t)); r.appendChild(videoSection); }
  const us = (t && t.utterances) || [];
  const fraseCount = us.filter(u => !u.kind || u.kind === 'utterance').length;
  const transcribed = fraseCount > 0;

  const recording = STATE.appState === 'recording' || STATE.appState === 'recording-local' || STATE.appState === 'recording-cloud';
  const items = [];

  // ── Selección múltiple ──────────────────────────────────────
  let txMode = false;
  let txCount = 0;

  const exitTxSelect = () => {
    txMode = false; txCount = 0;
    r.classList.remove('selecting');
    r.querySelectorAll('.utterance.sel').forEach(n => n.classList.remove('sel'));
    bulkBar.classList.remove('active');
  };

  const _updateBar = () => {
    bulkBar.classList.toggle('active', txCount > 0);
    bulkBar.querySelector('.tx-bulk-count').textContent =
      `${txCount} seleccionada${txCount !== 1 ? 's' : ''}`;
  };

  const toggleTxSelect = (node) => {
    const isSel = node.classList.contains('sel');
    node.classList.toggle('sel', !isSel);
    txCount += isSel ? -1 : 1;
    if (txCount <= 0) { exitTxSelect(); return; }
    if (!txMode) { txMode = true; r.classList.add('selecting'); }
    _updateBar();
  };

  // Construye el nodo (frase/captura/nota) y su texto en minúsculas para buscar.
  const buildItem = (u) => {
    let node, text;
    if (u.kind === 'capture') { node = captureEvent(u); text = (u.code || '') + ' ' + (u.note || ''); }
    else if (u.kind === 'context') { node = contextEvent(u); text = u.text || ''; }
    else if (u.kind === 'note') { node = noteEvent(u); text = u.text || ''; }
    else {
      node = utterance(u); text = u.text || '';
      // Un único handler en el nodo: el checkbox activa select, el cuerpo también en txMode
      node.addEventListener('click', (e) => {
        const onCheck = e.target.closest('.u-check');
        if (!onCheck && !txMode) return;      // fuera de modo selección y no es checkbox → ignorar
        if (e.target.closest('.u-act')) return; // acciones individuales → no seleccionar
        e.stopPropagation();
        toggleTxSelect(node);
      });
    }
    return { node, text: String(text).toLowerCase() };
  };

  // Barra flotante de acciones en lote (visible solo con clase .active)
  const bulkBar = el('div', 'tx-bulk-bar');
  bulkBar.innerHTML = `
    <span class="tx-bulk-count">0 seleccionadas</span>
    <div class="tx-bulk-acts">
      <button class="btn sm tx-bulk-btn" id="txBulkStar">${svg('star', 13)}<span>Favorito</span></button>
      <button class="btn sm tx-bulk-btn" id="txBulkPart">${svg('users', 13)}<span>Participante</span></button>
    </div>
    <button class="icon-btn sm" id="txBulkClose" title="Cancelar selección">${svg('x', 13)}</button>`;

  bulkBar.querySelector('#txBulkClose').onclick = exitTxSelect;

  bulkBar.querySelector('#txBulkStar').onclick = () => {
    // DOM como fuente de verdad: captura los nodos seleccionados ANTES de limpiar
    const selNodes = [...r.querySelectorAll('.utterance.sel')];
    // 1. Aplica highlight inmediatamente (mientras .sel todavía está presente)
    selNodes.forEach(node => {
      node.classList.add('highlighted');
      const btn = node.querySelector('[data-act="star"]');
      if (btn) btn.classList.add('on');
    });
    // 2. Limpia la selección (quita .sel pero highlighted permanece)
    exitTxSelect();
    // 3. Llama API en background
    selNodes.forEach(node => {
      if (node.dataset.id) api.v2.toggleUtteranceHighlight(node.dataset.id).catch(() => null);
    });
    toast('ok', `${selNodes.length} frase${selNodes.length !== 1 ? 's' : ''} marcadas como favorito`);
  };

  bulkBar.querySelector('#txBulkPart').onclick = (e) => {
    const parts = (STATE.transcript && STATE.transcript.participants) || [];
    if (!parts.length) { toast('info', 'No hay participantes — añádelos en la pestaña de Participantes'); return; }
    const selNodes = [...r.querySelectorAll('.utterance.sel')];
    openMenu(e, parts.map(p => ({
      label: p.name,
      icon: 'users',
      onClick: () => {
        selNodes.forEach(node => {
          const who = node.querySelector('.u-who');
          if (who) who.textContent = p.name;
          if (node.dataset.id) api.v2.assignUtteranceParticipant(node.dataset.id, p.id).catch(() => null);
        });
        exitTxSelect();
        toast('ok', `«${p.name}» asignado a ${selNodes.length} frase${selNodes.length !== 1 ? 's' : ''}`);
      },
    })));
  };
  // ────────────────────────────────────────────────────────────

  // P-10: en reposo se paginan las frases para no crear miles de nodos de golpe
  // al abrir una reunión muy larga. Se muestran PAGE y "Mostrar más" carga el resto.
  const PAGE = 150;
  let drawn = 0;
  const moreBtn = el('button', 'btn tx-more');
  const drawBatch = (count) => {
    const end = Math.min(drawn + count, us.length);
    for (let i = drawn; i < end; i++) {
      const it = buildItem(us[i]);
      items.push(it);
      r.insertBefore(it.node, moreBtn);
    }
    drawn = end;
    const left = us.length - drawn;
    moreBtn.hidden = left <= 0;
    moreBtn.textContent = `Mostrar ${Math.min(PAGE, left)} más · quedan ${left}`;
  };
  const drawAll = () => { if (drawn < us.length) drawBatch(us.length - drawn); };

  if (!recording && t && transcribed) {
    const tools = el('div', 'meeting-tools');
    const context = el('div', 'meeting-context');
    context.innerHTML = `<textarea id="meetingContext" rows="1" maxlength="2000" placeholder="Añadir contexto" aria-label="Añadir contexto"></textarea>
      <span class="meeting-context-state" id="meetingContextState"></span>`;
    const contextInput = context.querySelector('#meetingContext');
    const contextState = context.querySelector('#meetingContextState');
    const resizeContext = () => {
      contextInput.style.height = 'auto';
      contextInput.style.height = Math.min(92, contextInput.scrollHeight) + 'px';
    };
    const addToTranscript = async () => {
      const text = contextInput.value.trim();
      if (!text) return;
      contextState.textContent = 'Añadiendo…';
      const r = await api.addMeetingNote(STATE.selMeeting, text);
      if (r && r.ok && r.note) {
        contextInput.value = ''; resizeContext(); contextState.textContent = '';
        // Reflejar en memoria (al principio) para que persista al cambiar de pestaña.
        if (STATE.transcript) {
          STATE.transcript.utterances = STATE.transcript.utterances || [];
          STATE.transcript.utterances.unshift(r.note);
        }
        // Insertar el nodo ARRIBA del todo (antes de la primera entrada).
        const reading = document.querySelector('.reading');
        if (reading) {
          const node = contextEvent(r.note);
          const firstItem = reading.querySelector('.utterance');
          if (firstItem) reading.insertBefore(node, firstItem); else reading.appendChild(node);
          node.scrollIntoView({ block: 'nearest' });
        }
        toast('ok', 'Añadido como contexto');
      } else { contextState.textContent = 'Error'; }
    };
    contextInput.addEventListener('input', resizeContext);
    // Enter = añadir a la transcripción. Shift+Enter = línea nueva.
    contextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addToTranscript(); }
    });
    resizeContext();
    tools.appendChild(context);

    if (us.length) {
      STATE._txApply = (q) => {
        q = (q || '').trim().toLowerCase();
        if (q) drawAll();
        let n = 0, first = null;
        items.forEach(it => {
          const hit = !q || it.text.includes(q);
          it.node.style.display = hit ? '' : 'none';
          if (q && hit) { n++; if (!first) first = it.node; }
        });
        if (first) first.scrollIntoView({ block: 'nearest' });
        return n;
      };
    } else {
      STATE._txApply = null;
    }
    (videoSection || r).appendChild(tools);
  }


  if (!us.length && !(t && t.video_path)) {
    r.appendChild(el('p', null, '<span style="color:var(--text-muted)">Sin transcripción todavía.</span>'));
    return r;
  }

  if (recording) {
    // En grabación las frases llegan en vivo (window.addUtterance): se pintan todas.
    us.forEach(u => { const it = buildItem(u); items.push(it); r.appendChild(it.node); });
  } else {
    r.appendChild(bulkBar);   // sticky arriba, antes de las frases
    r.appendChild(moreBtn);
    moreBtn.onclick = () => drawBatch(PAGE);
    drawBatch(PAGE);
  }
  return r;
}

// Barra compacta del vídeo. No incrusta el reproductor al cambiar de reunión:
// el usuario decide cuándo abrirlo en su reproductor habitual.
function videoPanel(t) {
  const hasTx = !!(t.utterances && t.utterances.some(u => !u.kind || u.kind === 'utterance'));
  const wrap = el('div', 'video-panel');
  const name = String(t.video_path || '').split(/[\\/]/).pop() || 'grabacion.mp4';
  wrap.innerHTML = `<div class="video-file">
    <button class="video-file-icon" title="Reproducir vídeo">${svg('play', 15)}</button>
    <div class="video-file-copy"><b>Grabación de pantalla</b><small>${esc(name)}</small></div>
    <div class="rec-actions"></div>
  </div>`;
  wrap.querySelector('.video-file-icon').onclick = () => api.openPath(t.video_path);
  const actions = el('div', 'rec-actions');
  const folderPath = String(t.video_path).replace(/[/\\][^/\\]*$/, '');
  const open = el('button', 'icon-btn');
  open.innerHTML = svg('folder', 14);
  open.title = 'Abrir carpeta';
  open.onclick = () => api.openPath(folderPath);
  actions.appendChild(open);
  const bt = el('button', hasTx ? 'btn' : 'btn btn-primary', hasTx ? 'Retranscribir' : 'Recortar y transcribir');
  bt.onclick = () => openClipEditor(wrap, t, hasTx);
  actions.appendChild(bt);
  // Transcribir directo, sin pasar por el recortador (vídeo completo)
  const btNow = el('button', 'btn', hasTx ? 'Retranscribir todo' : 'Transcribir ahora');
  btNow.onclick = () => transcribeScreenVideo(t.meeting_id || STATE.selMeeting, hasTx, null);
  actions.appendChild(btNow);
  wrap.querySelector('.rec-actions').replaceWith(actions);
  return wrap;
}

// Recortador estilo CapCut: reproductor + línea de tiempo con miniaturas + manijas.
async function openClipEditor(wrap, t, isRetx) {
  const existing = wrap.querySelector('.clip-editor');
  if (existing) {
    existing.remove();
    document.querySelectorAll('.clip-backdrop').forEach(b => b.remove());
    return;
  }
  const mid = t.meeting_id || STATE.selMeeting;
  const url = await api.getMediaVideoUrl(mid);
  const ed = el('div', 'clip-editor');
  ed.innerHTML = `
    <video class="clip-video" src="${esc(url || '')}" preload="metadata"></video>
    <div class="clip-ctrl">
      <button class="clip-cbtn clip-skip" data-d="-10" title="Retroceder 10 segundos">${svg('rewind', 14)}<span class="clip-cnum">10</span></button>
      <button class="clip-cbtn clip-play" title="Reproducir la sección seleccionada">${svg('play', 16)}</button>
      <button class="clip-cbtn clip-skip" data-d="10" title="Avanzar 10 segundos"><span class="clip-cnum">10</span>${svg('fastForward', 14)}</button>
      <span class="clip-ctrl-sep"></span>
      <button class="clip-cbtn clip-mark-a" title="La sección empieza aquí (posición actual del vídeo)">${svg('markIn', 14)}</button>
      <button class="clip-cbtn clip-mark-b" title="La sección termina aquí (posición actual del vídeo)">${svg('markOut', 14)}</button>
      <span class="clip-time">0:00 / 0:00</span>
      <button class="clip-cbtn clip-max" title="Ampliar en ventana grande">${svg('expand', 14)}</button>
    </div>
    <div class="clip-tl">
      <div class="clip-thumbs"></div>
      <div class="clip-section-marks"></div>
      <div class="clip-sel"><span class="clip-h l"></span><span class="clip-h r"></span></div>
      <div class="clip-cursor"></div>
    </div>
    <div class="clip-scale"><span>0:00</span><span class="clip-dur">--:--</span></div>
    <div class="clip-segs"></div>
    <div class="clip-foot">
      <div class="clip-total">Carga el video para crear la primera sección</div>
      <div class="clip-actions">
        <button class="btn clip-cancel">Cancelar</button>
        <button class="btn btn-primary clip-go" disabled>Transcribir selección →</button>
      </div>
    </div>`;
  wrap.appendChild(ed);
  if (!url) {
    ed.querySelector('.clip-total').textContent = 'No se pudo cargar el vídeo';
    return;
  }

  const video = ed.querySelector('.clip-video');
  const tl = ed.querySelector('.clip-tl');
  const sel = ed.querySelector('.clip-sel');
  const cursor = ed.querySelector('.clip-cursor');
  const segsBox = ed.querySelector('.clip-segs');
  const marksBox = ed.querySelector('.clip-section-marks');
  const totalEl = ed.querySelector('.clip-total');
  const goBtn = ed.querySelector('.clip-go');
  const state = { dur: 0, a: 0, b: 0, segs: [], active: 0 };
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

  api.getVideoThumbnails(mid, 12).then(thumbs => {
    ed.querySelector('.clip-thumbs').innerHTML = (thumbs || []).map(th =>
      `<i style="background-image:url(data:image/jpeg;base64,${th.thumb})"></i>`).join('');
  });

  function sortedSegs() {
    return state.segs.map((s, i) => ({ ...s, i })).sort((a, b) => a.start - b.start || a.end - b.end);
  }
  function currentSeg() {
    return state.segs[state.active] || null;
  }
  function syncActiveSection() {
    const seg = currentSeg();
    if (!seg) return;
    seg.start = state.a;
    seg.end = state.b;
  }
  function totalSelected() {
    let total = 0;
    let cursor = null;
    for (const s of sortedSegs()) {
      if (cursor === null || s.start > cursor) {
        total += Math.max(0, s.end - s.start);
        cursor = s.end;
      } else if (s.end > cursor) {
        total += s.end - cursor;
        cursor = s.end;
      }
    }
    return Math.min(state.dur || total, total);
  }
  function isFullyCovered() {
    if (!state.dur || !state.segs.length) return false;
    let cursor = 0;
    for (const s of sortedSegs()) {
      if (s.start > cursor + 0.15) return false;
      cursor = Math.max(cursor, s.end);
      if (cursor >= state.dur - 0.15) return true;
    }
    return false;
  }
  function spaceNextToActive() {
    const cur = currentSeg();
    if (!cur || !state.dur) return null;
    const sorted = sortedSegs();
    const pos = sorted.findIndex(s => s.i === state.active);
    const rightLimit = pos >= 0 && sorted[pos + 1] ? sorted[pos + 1].start : state.dur;
    if (rightLimit - cur.end >= 0.5) {
      return { start: cur.end, end: Math.min(rightLimit, cur.end + Math.min(5, rightLimit - cur.end)) };
    }
    const leftLimit = pos > 0 ? sorted[pos - 1].end : 0;
    if (cur.start - leftLimit >= 0.5) {
      return { start: Math.max(leftLimit, cur.start - Math.min(5, cur.start - leftLimit)), end: cur.start };
    }
    return null;
  }
  function activateSection(index) {
    const seg = state.segs[index];
    if (!seg) return;
    state.active = index;
    state.a = seg.start;
    state.b = seg.end;
    paintSel();
    paintSegs();
  }
  function paintSel() {
    if (!state.dur) return;
    sel.style.left = (state.a / state.dur * 100) + '%';
    sel.style.width = ((state.b - state.a) / state.dur * 100) + '%';
    syncActiveSection();
    const secs = totalSelected();
    totalEl.innerHTML = `Se transcribirá <b>${fmt(secs)}</b> de ${fmt(state.dur)} <span class="clip-range">· Sección ${state.active + 1}: ${fmt(state.a)} – ${fmt(state.b)}</span>`;
    updateGo();
  }
  function paintSegs() {
    const canAdd = !!spaceNextToActive() && !isFullyCovered();
    marksBox.innerHTML = state.segs.map((s, i) => {
      if (!state.dur || i === state.active) return '';
      const left = s.start / state.dur * 100;
      const width = (s.end - s.start) / state.dur * 100;
      return `<button type="button" class="clip-section-mark" data-i="${i}" style="left:${left}%;width:${width}%" title="Sección ${i + 1}"></button>`;
    }).join('');
    marksBox.querySelectorAll('.clip-section-mark').forEach(mark => mark.onclick = e => {
      e.stopPropagation();
      activateSection(+mark.dataset.i);
    });
    const addLabel = canAdd ? '+ añadir sección'
      : (isFullyCovered() ? 'Todo el video está cubierto' : 'Sin espacio junto a la sección activa');
    segsBox.innerHTML = state.segs.map((s, i) =>
      `<button type="button" class="clip-pill${i === state.active ? ' is-active' : ''}" data-i="${i}">Sección ${i+1} · ${fmt(s.start)}–${fmt(s.end)} <span class="x" title="Eliminar sección">×</span></button>`
    ).join('') + `<button type="button" class="clip-add" ${canAdd ? '' : 'disabled'}>${addLabel}</button>`;
    segsBox.querySelectorAll('.clip-pill').forEach(p => p.onclick = e => {
      if (e.target.closest('.x')) return;
      activateSection(+p.dataset.i);
    });
    segsBox.querySelectorAll('.x').forEach(x => x.onclick = e => {
      const idx = +e.target.closest('.clip-pill').dataset.i;
      state.segs.splice(idx, 1);
      if (!state.segs.length) {
        state.segs.push({ start: 0, end: state.dur });
        state.active = 0;
      } else {
        state.active = Math.max(0, Math.min(state.active > idx ? state.active - 1 : state.active, state.segs.length - 1));
      }
      const seg = currentSeg();
      state.a = seg.start; state.b = seg.end;
      paintSel(); paintSegs(); updateGo();
    });
    segsBox.querySelector('.clip-add').onclick = () => {
      const next = spaceNextToActive();
      if (!next || isFullyCovered()) return;
      const insertAt = state.active + 1;
      state.segs.splice(insertAt, 0, next);
      activateSection(insertAt);
    };
  }
  function updateGo() {
    goBtn.disabled = !state.segs.some(s => (s.end - s.start) >= 0.5);
  }

  // Controles de reproducción: play/pausa y saltos de ±10 s.
  const playBtn = ed.querySelector('.clip-play');
  const timeEl = ed.querySelector('.clip-time');
  let playingClip = false;   // reproduciendo la sección → pausa al llegar a su fin
  playBtn.onclick = () => {
    if (video.paused) {
      // Play arranca en el INICIO de la sección si el cursor está fuera de ella;
      // si pausaste a mitad de la sección, reanuda donde ibas.
      if (state.dur && (video.currentTime < state.a - 0.05 || video.currentTime >= state.b - 0.05)) {
        video.currentTime = state.a;
      }
      playingClip = true;
      video.play();
    } else {
      video.pause();
    }
  };
  video.addEventListener('click', () => playBtn.onclick());
  video.addEventListener('play', () => { playBtn.innerHTML = svg('pause', 16); playBtn.title = 'Pausa'; });
  video.addEventListener('pause', () => { playBtn.innerHTML = svg('play', 16); playBtn.title = 'Reproducir la sección seleccionada'; });
  ed.querySelectorAll('.clip-skip').forEach(b => b.onclick = () => {
    if (!state.dur) return;
    playingClip = false;   // navegación libre: no auto-pausar en el fin de la sección
    video.currentTime = Math.min(state.dur, Math.max(0, video.currentTime + Number(b.dataset.d)));
  });

  // Marcar la sección viendo el vídeo: fija inicio/fin en la posición actual.
  ed.querySelector('.clip-mark-a').onclick = () => {
    if (!state.dur) return;
    state.a = Math.max(0, Math.min(video.currentTime, state.b - 0.2));
    paintSel(); paintSegs();
  };
  ed.querySelector('.clip-mark-b').onclick = () => {
    if (!state.dur) return;
    state.b = Math.min(state.dur, Math.max(video.currentTime, state.a + 0.2));
    paintSel(); paintSegs();
  };

  // Modo ventana grande: el editor pasa a un modal amplio dentro de la app
  // (no pantalla completa del sistema). Conserva el estado: vídeo y selección.
  const maxBtn = ed.querySelector('.clip-max');
  const backdrop = el('div', 'clip-backdrop');
  let maximized = false;
  const onKey = e => { if (e.key === 'Escape' && maximized) maxBtn.onclick(); };
  maxBtn.onclick = () => {
    maximized = !maximized;
    ed.classList.toggle('clip-editor--max', maximized);
    if (maximized) {
      document.body.appendChild(backdrop);
      backdrop.onclick = () => maxBtn.onclick();
      document.addEventListener('keydown', onKey);
    } else {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
    maxBtn.innerHTML = svg(maximized ? 'shrink' : 'expand', 14);
    maxBtn.title = maximized ? 'Volver al panel (Esc)' : 'Ampliar en ventana grande';
  };

  function closeEditor() {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    ed.remove();
  }

  video.addEventListener('loadedmetadata', () => {
    state.dur = video.duration || 0;
    state.a = 0; state.b = state.dur;
    state.segs = [{ start: 0, end: state.dur }];
    state.active = 0;
    ed.querySelector('.clip-dur').textContent = fmt(state.dur);
    timeEl.textContent = `0:00 / ${fmt(state.dur)}`;
    paintSel(); paintSegs();
  });
  video.addEventListener('timeupdate', () => {
    if (!state.dur) return;
    cursor.style.left = (video.currentTime / state.dur * 100) + '%';
    timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(state.dur)}`;
    // Vista previa de la sección: al llegar a su fin, pausa (queda listo para replay).
    if (playingClip && !video.paused && video.currentTime >= state.b - 0.03) {
      video.pause(); playingClip = false;
    }
  });

  // Arrastre con eventos de RATÓN a nivel de documento — el mismo patrón del
  // redimensionado del sidebar, que funciona de forma fiable en este WebView2.
  // Bordes → mover esa manija (GRAB_PX de tolerancia); interior → mover el
  // bloque entero de la selección; fuera → clic para posicionar el vídeo.
  const GRAB_PX = 16;
  let clickSuppressed = false;

  function sideAt(ev) {
    if (!state.dur) return null;
    const rect = tl.getBoundingClientRect();
    const xA = rect.left + (state.a / state.dur) * rect.width;
    const xB = rect.left + (state.b / state.dur) * rect.width;
    const dA = Math.abs(ev.clientX - xA), dB = Math.abs(ev.clientX - xB);
    if (Math.min(dA, dB) > GRAB_PX) return null;
    return dA <= dB ? 'a' : 'b';
  }
  function insideSel(ev) {
    if (!state.dur) return false;
    const rect = tl.getBoundingClientRect();
    const t2 = (ev.clientX - rect.left) / rect.width * state.dur;
    return t2 > state.a && t2 < state.b;
  }

  // Evita que un arrastre nativo (drag & drop del navegador) robe el ratón.
  ed.addEventListener('dragstart', e => e.preventDefault());

  tl.addEventListener('mousedown', e => {
    if (e.button !== 0 || !state.dur) return;
    const h = e.target.closest('.clip-h');
    let mode = h ? (h.classList.contains('l') ? 'a' : 'b') : sideAt(e);
    if (!mode && insideSel(e)) mode = 'move';
    if (!mode) return;                  // clic normal → lo maneja el click (seek)
    e.preventDefault();
    const startX = e.clientX;
    const a0 = state.a, b0 = state.b;
    const onMove = ev => {
      clickSuppressed = true;           // hubo arrastre → el click posterior no busca
      const rect = tl.getBoundingClientRect();
      if (mode === 'move') {
        // Desplaza el bloque completo manteniendo su duración.
        const dt = (ev.clientX - startX) / rect.width * state.dur;
        const len = b0 - a0;
        const na = Math.max(0, Math.min(a0 + dt, state.dur - len));
        state.a = na; state.b = na + len;
      } else {
        const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
        const t2 = frac * state.dur;
        if (mode === 'a') state.a = Math.max(0, Math.min(t2, state.b - 0.2));
        else state.b = Math.min(state.dur, Math.max(t2, state.a + 0.2));
      }
      paintSel();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      paintSegs();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Feedback del cursor: ↔ en las manijas, "agarrar" dentro del bloque.
  tl.addEventListener('mousemove', e => {
    if (e.buttons & 1) return;   // durante un arrastre lo gestiona document
    tl.style.cursor = sideAt(e) ? 'ew-resize' : (insideSel(e) ? 'grab' : 'pointer');
  });

  tl.addEventListener('click', e => {
    if (clickSuppressed) { clickSuppressed = false; return; }
    playingClip = false;
    const rect = tl.getBoundingClientRect();
    video.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * state.dur;
  });

  ed.querySelector('.clip-cancel').onclick = () => closeEditor();
  goBtn.onclick = async () => {
    syncActiveSection();
    const all = state.segs.filter(s => (s.end - s.start) >= 0.5);
    if (!all.length) return;
    goBtn.disabled = true; goBtn.textContent = 'Transcribiendo…';
    closeEditor();
    await transcribeScreenVideo(mid, isRetx, all);
  };
}

async function transcribeScreenVideo(mid, force, clipSegments) {
  // La transcripción del vídeo va en SEGUNDO PLANO: puedes seguir grabando otro.
  let f = null;
  try { f = await api.transcribeMeetingVideo(mid, force, clipSegments || null); }
  catch (e) { f = { ok: false, error: e && e.message }; }
  if (f && f.already) { toast('info', 'Este vídeo ya está transcrito'); return; }
  if (f && f.ok) {
    await refreshMeetings(STATE.selInit);
    if (STATE.screen === 'meeting' && STATE.selMeeting === mid) await openMeeting(mid, true);
    toast('ok', 'Se transcribe en segundo plano · puedes seguir grabando');
  } else {
    toast('err', errMsg(f && f.error, 'No se pudo transcribir el vídeo'));
  }
}

function utterance(u) {
  const d = el('div', 'utterance turn' + (u.speaker === 'me' ? ' me' : '') + (u.highlighted ? ' highlighted' : ''));
  d.tabIndex = 0;
  d.dataset.id = u.id;
  const who = esc(u.display_name || (u.speaker === 'me' ? 'Yo' : 'Los demás'));
  d.innerHTML = `
    <div class="u-check" aria-hidden="true"><span class="u-cb"></span></div>
    <div class="u-side">
      <span class="u-who">${who}</span>
      <span class="u-time mono">${esc(u.time)}</span>
    </div>
    <div class="u-body">
      <p class="u-text">${esc(u.text)}</p>
    </div>
    <div class="u-actions">
      <button class="u-act${u.highlighted ? ' on' : ''}" data-act="star" title="Marcar como importante" aria-label="Marcar como importante">${svg('star', 14)}</button>
      <button class="u-act" data-act="edit" title="Editar" aria-label="Editar">${svg('edit', 14)}</button>
      <button class="u-act danger" data-act="del" title="Eliminar" aria-label="Eliminar">${svg('trash', 14)}</button>
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
  const d = el('div', 'utterance turn note-entry');
  d.dataset.id = u.id;
  d.innerHTML = `
    <div class="u-side"><span class="u-tag">Nota</span>${u.time ? `<span class="u-time mono">${esc(u.time)}</span>` : ''}</div>
    <div class="u-body"><p class="u-text">${esc(u.text || '')}</p></div>`;
  return d;
}
function contextEvent(u) {
  const d = el('div', 'utterance turn ctx-entry');
  d.dataset.id = u.id;
  d.innerHTML = `
    <div class="u-side"><span class="u-tag">Contexto</span>${u.time ? `<span class="u-time mono">${esc(u.time)}</span>` : ''}</div>
    <div class="u-body"><p class="u-text">${esc(u.text || '')}</p></div>`;
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
  const body = node.querySelector('.u-body');
  const orig = u.text;
  body.innerHTML = `<textarea class="field" style="height:auto;min-height:60px;padding:9px;resize:vertical">${esc(orig)}</textarea>
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

/* Selector de hablante: lista los participantes de el proyecto para asignar la
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

  d.appendChild(el('div', 'section-label', 'Capturas'));
  const grid = el('div', 'grid3');
  caps.forEach(c => {
    const x = el('div', 'cap-card');
    const ph = el('div', 'ph');
    loadCaptureThumb(ph, c.id);
    x.appendChild(ph);
    x.appendChild(el('div', 'cap-meta', `${c.code ? '<span class="cap-code">' + esc(c.code) + '</span> ' : ''}<span class="mono">${esc(c.time)}</span>${c.note ? ' · ' + esc(c.note) : ''}`));
    grid.appendChild(x);
  });
  if (!caps.length) grid.appendChild(el('p', 'files-empty', 'No hay capturas en esta reunión.'));
  d.appendChild(grid);

  const notasOnly = notes.filter(n => n.kind === 'note');
  const notasHead = el('div', 'section-label-row');
  notasHead.innerHTML = `<span class="section-label" style="margin:0;border:0;padding:0">Notas</span>`;
  const notasCopyBtn = el('button', 'icon-btn');
  notasCopyBtn.innerHTML = svg('copy', 13);
  notasCopyBtn.title = 'Copiar notas al portapapeles';
  notasCopyBtn.onclick = () => {
    if (!notasOnly.length) { toast('info', 'No hay notas que copiar'); return; }
    const txt = notasOnly.map(n => n.text).join('\n\n');
    navigator.clipboard.writeText(txt).then(
      () => toast('ok', 'Notas copiadas'),
      () => toast('err', 'No se pudo copiar')
    );
  };
  notasHead.appendChild(notasCopyBtn);
  d.appendChild(notasHead);
  const notasList = el('div', 'files-notes-list');
  if (notasOnly.length) {
    notasOnly.forEach(n => {
      const row = el('div', 'files-note-row');
      row.innerHTML = `<p class="files-note-text">${esc(n.text)}</p>`;
      notasList.appendChild(row);
    });
  } else {
    notasList.appendChild(el('p', 'files-empty', 'No hay notas en esta reunión.'));
  }
  d.appendChild(notasList);

  if (assets.audio) {
    d.appendChild(el('div', 'section-label', 'Audio'));
    const dur = (STATE.transcript && STATE.transcript.audio_duration) || '';
    const aa = el('div', 'row-card');
    aa.innerHTML = `<span class="file-ico">${svg('mic', 14)}</span><div class="rc-body"><div class="rc-title">${esc(String(assets.audio).split(/[\\/]/).pop())}</div><div class="rc-meta">Grabación de audio${dur ? ' · ' + dur : ''}</div></div>`;
    aa.onclick = () => api.openPath(assets.audio); d.appendChild(aa);
  }
  if (assets.video) {
    d.appendChild(el('div', 'section-label', 'Video'));
    const a = el('div', 'row-card');
    a.innerHTML = `<span class="file-ico">${svg('play', 14)}</span><div class="rc-body"><div class="rc-title">${esc(String(assets.video).split(/[\\/]/).pop())}</div><div class="rc-meta">Grabación de pantalla</div></div>`;
    a.onclick = () => api.openPath(assets.video); d.appendChild(a);
  }
  return d;
}

function renderNotes() {
  const wrap = el('div', 'notes-tab');
  const assets = (STATE.transcript && STATE.transcript.assets) || {};
  const existing = (assets.notes || []).filter(n => n.kind === 'note');

  /* ── Área de escritura (arriba de la lista) ── */
  const compose = el('div', 'notes-compose');
  compose.innerHTML = `
    <textarea class="notes-ta" id="notesInput" rows="1" maxlength="4000"
      placeholder="Pega aquí tu resumen"
      aria-label="Pega aquí tu resumen"></textarea>
    <button class="icon-btn notes-copy-all" title="Copiar todas las notas">${svg('copy', 14)}</button>`;
  compose.querySelector('.notes-copy-all').onclick = () => {
    const all = (((STATE.transcript && STATE.transcript.assets) || {}).notes || [])
      .filter(n => n.kind === 'note');
    if (!all.length) { toast('info', 'No hay notas que copiar'); return; }
    const txt = all.map(n => n.time ? `[${n.time}]  ${n.text}` : n.text).join('\n\n');
    navigator.clipboard.writeText(txt).then(
      () => toast('ok', 'Notas copiadas al portapapeles'),
      () => toast('err', 'No se pudo copiar')
    );
  };
  wrap.appendChild(compose);

  /* ── Lista de notas ── */
  const list = el('div', 'notes-list');

  function _appendNoteItem(n) {
    const item = el('div', 'note-item');
    const displayTime = n.wall_time || n.time;
    item.innerHTML = `
      <div class="note-item-body">
        <p class="note-item-text">${esc(n.text)}</p>
        ${displayTime ? `<span class="note-item-time">${esc(displayTime)}</span>` : ''}
      </div>`;
    list.appendChild(item);
    return item;
  }

  if (!existing.length) {
    list.innerHTML = `<div class="notes-empty">${svg('note', 20)}<p>Aún no hay notas.</p></div>`;
  } else {
    existing.forEach(_appendNoteItem);
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 0);
  }
  wrap.appendChild(list);

  const ta = compose.querySelector('#notesInput');

  const resize = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
  };

  const addNote = async () => {
    const text = ta.value.trim();
    if (!text) return;
    ta.disabled = true;
    const r = await api.addNotePost(STATE.selMeeting, text).catch(() => null);
    ta.disabled = false;
    ta.focus();
    if (r && r.ok && r.note) {
      ta.value = ''; resize();
      if (STATE.transcript && STATE.transcript.assets) {
        STATE.transcript.assets.notes = STATE.transcript.assets.notes || [];
        STATE.transcript.assets.notes.push(r.note);
      }
      const emptyEl = list.querySelector('.notes-empty');
      if (emptyEl) emptyEl.remove();
      const item = _appendNoteItem(r.note);
      item.classList.add('note-item--new');
      list.scrollTop = list.scrollHeight;
    } else {
      toast('err', 'No se pudo añadir la nota');
    }
  };

  ta.addEventListener('input', resize);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(); }
  });
  resize();
  return wrap;
}

/* P-09: la tarjeta usa una MINIATURA ligera; el original (pesado) solo se pide
   al ampliar con la lupa. Si el backend no tiene thumbnails, cae al original. */
async function loadCaptureThumb(ph, captureId) {
  try {
    const useThumb = !HAS_PYWEBVIEW() || typeof window.pywebview.api.get_capture_thumbnail === 'function';
    const r = useThumb ? await api.getCaptureThumbnail(captureId) : await api.getCaptureImage(captureId);
    if (!r || !r.data_url) return;
    ph.style.backgroundImage = `url("${r.data_url}")`;
    ph.style.backgroundSize = 'cover';
    ph.style.backgroundPosition = 'center';
    ph.style.cursor = 'zoom-in';
    ph.onclick = async () => {
      // Cargar el original a tamaño completo solo cuando se amplía.
      let full = useThumb ? null : r.data_url;
      if (!full) { try { const o = await api.getCaptureImage(captureId); full = o && o.data_url; } catch (e) { /* usa thumb */ } }
      openLightbox(full || r.data_url);
    };
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
      <button class="chip">Proyecto ▾</button><button class="chip">Fecha ▾</button><button class="chip">Hablante ▾</button>
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
  head.style.cssText = 'border-bottom:none';
  head.innerHTML = `<div class="mhead-row mhead-row--mid" style="max-width:640px"><h1 class="page-title">Archivados</h1></div>`;
  if (isTrash) {
    const emptyBtn = el('button', 'btn btn-danger sm');
    emptyBtn.id = 'emptyTrash';
    emptyBtn.style.marginLeft = 'auto';
    emptyBtn.innerHTML = svg('trash', 13) + ' Vaciar';
    head.querySelector('.mhead-row').appendChild(emptyBtn);
  }
  const content = el('div', 'content');
  const list = el('div'); list.style.cssText = 'max-width:640px;margin:0 auto';
  content.appendChild(list);

  api.listLibrary(isTrash ? 'trash' : 'archive').then(items => {
    items = items || [];
    list.replaceChildren();
    if (!items.length) {
      list.appendChild(el('p', null, `<span style="color:var(--text-muted);font-size:13px">No hay nada archivado.</span>`));
      return;
    }
    items.forEach(x => {
      const type = x.kind === 'initiative' ? 'PROYECTO' : 'REUNIÓN';
      const sub = x.kind === 'initiative' ? ((x.meeting_count || 0) + ' reuniones') : ('en ' + (x.initiative || '—'));
      const c = el('div', 'row-card'); c.style.cursor = 'default';
      c.innerHTML = `<span style="flex:none;font-size:10px;font-weight:700;letter-spacing:.4px;color:var(--text-secondary);border:1px solid var(--border-strong);border-radius:5px;padding:3px 7px">${type}</span>
        <div class="rc-body"><div class="rc-title">${esc(x.title)}</div><div class="rc-meta">${esc(sub)}${x.date ? ' · ' + esc(x.date) : ''}</div></div>
        <div style="display:flex;gap:7px"><button class="btn" data-restore>Restaurar</button><button class="btn btn-danger" data-del>Eliminar</button></div>`;
      c.querySelector('[data-restore]').onclick = async () => {
        const r = await api.restoreItem(x.kind, x.id);
        if (r && r.ok === false) { toast('err', errMsg(r.error, 'No se pudo restaurar')); return; }
        toast('ok', 'Restaurado'); reloadLibrary(which); refreshAll(); updateLibraryCounts();
      };
      c.querySelector('[data-del]').onclick = () => confirmModal(
        'Eliminar permanentemente',
        'Esta acción no se puede deshacer. Se borrará «' + x.title + '»' + (x.kind === 'initiative' ? ' y toda su carpeta archivada.' : ' y su carpeta archivada.'),
        'Eliminar para siempre',
        async () => {
          const r = await api.permanentlyDeleteItem(x.kind, x.id);
          if (r && r.ok === false) { toast('err', errMsg(r.error, 'No se pudo eliminar')); return; }
          toast('ok', 'Eliminado permanentemente'); reloadLibrary(which); refreshAll(); updateLibraryCounts();
        }
      );
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
  bar.classList.toggle('actionbar--dock', s === 'idle');
  if (s === 'idle') {
    const dis = canRecord ? '' : 'is-disabled';
    const recTitle = canRecord ? 'Grabar reunión' : 'Selecciona un proyecto';
    bar.innerHTML = `
      <div class="dock">
        <button class="audio-chip dock-mic${STATE.micMuted ? ' muted' : ''}" id="btnMic" aria-pressed="${STATE.micMuted}" aria-label="${STATE.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}" title="${STATE.micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}">
          <span class="mic-ico">${svg(STATE.micMuted ? 'headerMicOff' : 'headerMic', 16)}</span>
          <span class="eq mini" aria-hidden="true"><i></i><i></i><i></i></span>
        </button>
        <span class="dock-sep"></span>
        <button class="dock-btn ${dis}" id="abRecord" title="${recTitle}"><span class="dock-ico dock-ico--rec">${svg('mic', 18)}</span>Grabar reunión</button>
        <span class="dock-sep"></span>
        <button class="dock-btn ${dis}" id="abScreen" title="${canRecord ? 'Grabar pantalla' : 'Selecciona un proyecto'}"><span class="dock-ico dock-ico--screen">${svg('monitorDot', 18)}</span>Grabar pantalla</button>
        <span class="dock-sep"></span>
        <button class="dock-btn ${dis}" id="abUpload" title="${canRecord ? 'Importar video' : 'Selecciona un proyecto'}"><span class="dock-ico">${svg('upload', 18)}</span>Importar video</button>
      </div>`;
    // Sin proyecto seleccionado: modal para elegir/crear uno y seguir con la acción
    const needProject = (cont) => pickInitiativeModal((iid) => { selectInitiative(iid); cont(); });
    const _rec = () => withRecordingConsent(() => startMeetingRecording());
    const _scr = () => withRecordingConsent(() => openScreenPanel());
    const _imp = () => doImport(document.getElementById('abUpload'));
    bar.querySelector('#btnMic').onclick = toggleMic;
    bar.querySelector('#abRecord').onclick = () => canRecord ? _rec() : needProject(_rec);
    bar.querySelector('#abScreen').onclick = () => canRecord ? _scr() : needProject(_scr);
    bar.querySelector('#abUpload').onclick = () => canRecord ? _imp() : needProject(_imp);
  } else if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') {
    // Grabación de solo audio: sin botón "Captura" (capturar pantalla
    // solo tiene sentido cuando se está grabando la pantalla).
    bar.innerHTML = `
      <button class="btn btn-stop" id="abStop"><span class="sq"></span>Detener grabación</button>
      <button class="btn btn-lg ab-appear" id="abNote" style="animation-delay:.04s">${svg('note', 15)}Añadir nota</button>
      <button class="btn btn-lg ${STATE.meetingMicMuted ? 'btn-danger' : ''}" id="abMic">${STATE.meetingMicMuted ? 'Activar mi audio' : 'Silenciar mi audio'}</button>`;
    bar.querySelector('#abStop').onclick = stopMeetingRecording;
    bar.querySelector('#abNote').onclick = promptNote;
    bar.querySelector('#abMic').onclick = toggleMeetingMic;
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
    bar.innerHTML = `
      <button class="btn btn-stop" id="abScStop"><span class="sq"></span>Detener vídeo</button>
      <button class="btn btn-lg ${STATE.micMuted ? 'btn-danger' : ''}" id="abScMic">${svg(STATE.micMuted ? 'headerMicOff' : 'headerMic', 15)}${STATE.micMuted ? 'Activar micro' : 'Silenciar micro'}</button>
      <button class="btn btn-lg" id="abScCap">${svg('camera', 15)}Captura</button>
      <button class="btn btn-lg" id="abScNote">${svg('note', 15)}Nota</button>
      ${STATE.screenPanelCollapsed ? '<div class="ab-spacer"></div><button class="btn btn-lg" id="abScExpand">' + svg('monitor', 15) + 'Ver panel</button>' : ''}`;
    bar.querySelector('#abScStop').onclick = stopScreenRecording;
    bar.querySelector('#abScMic').onclick = () => { STATE.micMuted = !STATE.micMuted; api.toggleScreenMicMute(STATE.micMuted); renderActionBar(); };
    bar.querySelector('#abScCap').onclick = () => api.takeCapture(STATE.monitorIdx).then(() => toast('ok', 'Captura guardada'));
    bar.querySelector('#abScNote').onclick = () => promptNote();
    const exp = bar.querySelector('#abScExpand'); if (exp) exp.onclick = () => { STATE.screenPanelCollapsed = false; showScreenPanel(); };
  }
}
// Dropdown personalizado de selección de pantalla (reemplaza el <select> nativo).
function monitorSelectEl() {
  const items = STATE.monitors.length
    ? STATE.monitors.map((m) => ({ value: m.index, label: `Pantalla ${m.index} · ${m.width}×${m.height}` }))
    : [{ value: 0, label: 'Pantalla 1' }];
  return customSelect({
    value: STATE.monitorIdx, items, icon: 'monitor', className: 'cdrop-mon', minWidth: 210,
    onChange: (v) => { STATE.monitorIdx = +v; },
  });
}

/* ============================================================
   4a-bis. VISTA: DOCUMENTOS → MARKDOWN
   ============================================================ */
// Icono + etiqueta de tipo de archivo a partir del nombre original.
function fileKind(name) {
  const e = (name || '').toLowerCase().split('.').pop();
  if (e === 'pdf') return { cls: 'pdf', lbl: 'PDF' };
  if (e === 'docx' || e === 'doc') return { cls: 'doc', lbl: 'DOCX' };
  if (e === 'pptx' || e === 'ppt') return { cls: 'ppt', lbl: 'PPTX' };
  if (e === 'html' || e === 'htm') return { cls: 'html', lbl: 'HTML' };
  return { cls: 'txt', lbl: (e || 'TXT').toUpperCase().slice(0, 4) };
}

// Tamaño en bytes → texto corto (B / KB / MB) para las tarjetas de documento.
function fmtKB(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  const kb = n / 1024;
  if (kb < 1024) return Math.round(kb) + ' KB';
  return (kb / 1024).toFixed(1) + ' MB';
}

// Copia el Markdown CRUDO (sin renderizar) de un documento al portapapeles.
async function copyDocMd(d) {
  const res = await api.readDocument(d.initiative_id, d.name);
  if (res && res.ok) { await copyText(res.text); toast('ok', 'Markdown copiado'); }
  else toast('err', 'No se pudo leer el documento');
}

// Conversor Markdown → HTML minimalista para el modal "Ver" (encabezados #/##/###,
// listas -/*, **negrita**, *cursiva*, `código`, --- y párrafos). Escapa SIEMPRE el
// texto de origen antes de aplicar el formato, así que el resultado es seguro para innerHTML.
function mdToHtml(src) {
  const esc2 = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = esc2(src).split(/\r?\n/); let html = ''; let inList = false;
  const inline = s => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
  for (let ln of lines) {
    if (/^\s*---\s*$/.test(ln)) { if (inList) { html += '</ul>'; inList = false; } html += '<hr>'; continue; }
    const h = ln.match(/^(#{1,3})\s+(.*)$/);
    if (h) { if (inList) { html += '</ul>'; inList = false; } const n = h[1].length; html += '<h' + n + '>' + inline(h[2]) + '</h' + n + '>'; continue; }
    const li = ln.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(li[1]) + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (ln.trim() === '') continue;
    html += '<p>' + inline(ln) + '</p>';
  }
  if (inList) html += '</ul>';
  return html;
}

// Modal "Ver": primero la carpeta del documento (original/.md/imágenes), luego el .md ya convertido a HTML.
async function openDocModal(d) {
  const res = await api.readDocument(d.initiative_id, d.name);
  const text = (res && res.ok) ? res.text : '';
  const k = fileKind(d.original_name);
  const hasImages = (d.images || 0) > 0;
  const m = el('div', 'modal docs-modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', d.name);
  m.innerHTML = `
    <div class="docs-mhead">
      <span class="docs-mftype ${k.cls}">${k.lbl}</span>
      <span class="docs-mtitle">${esc(d.name)}</span>
      <button class="btn sm" data-copy>${svg('copy', 14)} Copiar .md</button>
      <button class="btn sm" data-open>${svg('external', 14)} Abrir .md</button>
      <button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button>
    </div>
    <div class="docs-mbody">
      <div class="docs-files">
        <div class="docs-files-h">Carpeta del documento</div>
        <div class="docs-frow">${svg('file', 15)}<span>${esc(d.original_name || '')}</span><span class="fsub">· original</span></div>
        <div class="docs-frow">${svg('md', 15)}<span>${esc(d.name)}</span><span class="fsub">· texto para la IA${d.ocr ? ' (OCR)' : ''}</span></div>
        ${hasImages ? `<div class="docs-frow">${svg('folder', 15)}<span>imagenes/</span><span class="fsub">· ${d.images} imagen${d.images === 1 ? '' : 'es'}</span><button type="button" class="fopen" data-open-imgs>Abrir</button></div>` : ''}
      </div>
      <div class="md"></div>
    </div>
    <div class="docs-mfoot">Original: ${esc(d.original_name || '')} · ${formatDateShort(d.created_at)} · ${fmtKB(d.size)}</div>`;
  m.querySelector('.md').innerHTML = (res && res.ok) ? mdToHtml(text) : 'No se pudo leer el documento.';
  m.querySelector('[data-copy]').onclick = async () => {
    if (!(res && res.ok)) { toast('err', 'No se pudo leer el documento'); return; }
    await copyText(text); toast('ok', 'Markdown copiado');
  };
  m.querySelector('[data-open]').onclick = () => api.openDocument(d.initiative_id, d.name);
  const openImgsBtn = m.querySelector('[data-open-imgs]');
  if (openImgsBtn) openImgsBtn.onclick = () => api.openDocumentImages(d.initiative_id, d.name);
  m.querySelector('[data-x]').onclick = closeModal;
  openModal(m);
}

// Tarjeta de un documento en la lista global de "Documentos → .md".
function buildDocCard(d, onChanged) {
  const k = fileKind(d.original_name);
  const card = el('div', 'docs-card');
  const tags = [];
  if (d.ocr) tags.push(`<span class="docs-tag ocr">${svg('scan', 12)}OCR</span>`);
  if ((d.images || 0) > 0) tags.push(`<span class="docs-tag img">${svg('image', 12)}${d.images}</span>`);
  card.innerHTML = `
    <span class="docs-ftype ${k.cls}">${k.lbl}</span>
    <div class="docs-cbody">
      <div class="docs-cname">${esc(d.name)}</div>
      <div class="docs-cmeta">
        <span class="docs-badge"><span class="dot" style="background:${esc(d.color || '#aacfbf')}"></span>${esc(d.initiative_name || '')}</span>
        ${tags.join('')}
        <span>${esc(d.original_name || '')}</span>
        <span>${formatDateShort(d.created_at)}</span>
        <span>${fmtKB(d.size)}</span>
      </div>
    </div>
    <div class="docs-cactions">
      <button class="docs-view" data-act="view">${svg('eye', 14)} Ver</button>
      <button class="docs-ico" data-act="copy" aria-label="Copiar .md" title="Copiar .md">${svg('copy', 15)}</button>
      <button class="docs-ico" data-act="orig" aria-label="Original" title="Original">${svg('folder', 15)}</button>
      <button class="docs-ico danger" data-act="del" aria-label="Eliminar" title="Eliminar">${svg('trash', 15)}</button>
    </div>`;
  card.querySelector('[data-act="view"]').onclick = () => openDocModal(d);
  card.querySelector('[data-act="copy"]').onclick = () => copyDocMd(d);
  card.querySelector('[data-act="orig"]').onclick = () => api.openDocumentOriginal(d.initiative_id, d.name);
  card.querySelector('[data-act="del"]').onclick = () => confirmModal(
    'Eliminar documento',
    `Se borrarán el .md, el original y las imágenes de "${d.name}". ¿Seguro?`,
    'Eliminar',
    async () => {
      const r = await api.deleteDocument(d.initiative_id, d.name);
      if (r && r.ok === false) { toast('err', errMsg(r.error, 'No se pudo eliminar')); return; }
      toast('ok', 'Documento eliminado');
      await onChanged();
    },
    true
  );
  return card;
}

// Lee un File del navegador como base64 puro (sin el prefijo data:...;base64,).
function _readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const i = result.indexOf(',');
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// Recarga en curso de la lista global (la fija viewDocs para que handleDrop pueda refrescar tras soltar archivos).
let _docsRefreshList = null;

// Maneja el drop de archivos sobre la lista (zona de arrastre): sube y convierte cada uno al proyecto destino.
async function handleDrop(ev) {
  const files = Array.from((ev.dataTransfer && ev.dataTransfer.files) || []);
  if (!files.length) return;
  if (STATE.docsDest == null) { toast('err', 'Elige antes un proyecto de destino'); return; }
  let okN = 0; const failedNames = [];
  for (const file of files) {
    try {
      const b64 = await _readFileAsBase64(file);
      const r = await api.saveUploadedDocument(STATE.docsDest, file.name, b64, STATE.docsOcr, STATE.docsExtractImages);
      if (r && r.ok) okN++; else failedNames.push((r && r.name) || file.name);
    } catch (e) {
      failedNames.push(file.name);
    }
  }
  let msg = `${okN} convertido${okN === 1 ? '' : 's'}`;
  if (failedNames.length) msg += ` · ${failedNames.length} sin convertir (${failedNames.join(', ')})`;
  toast(failedNames.length && !okN ? 'err' : 'ok', msg);
  if (_docsRefreshList) await _docsRefreshList();
}

function viewDocs() {
  const wrap = el('div', 'docs-screen');
  wrap.style.cssText = 'flex:1;min-height:0;overflow-y:auto';

  const head = el('div', 'docs-head');
  head.innerHTML = `<h1>Documentos <span class="arrow">→</span> .md</h1>`;

  const toolbar = el('div', 'docs-toolbar');
  toolbar.innerHTML = `
    <span id="docsDestMount"></span>
    <button class="btn btn-primary" id="docsPickBtn" disabled>${svg('upload', 13)} Elegir archivos</button>
    <span class="docs-div"></span>
    <button type="button" class="docs-chip" id="docsOcrChip"></button>
    <button type="button" class="docs-chip" id="docsImgChip"></button>
    <span class="docs-help" tabindex="0" title="El OCR reconstruye el texto de documentos escaneados. En Automático solo actúa cuando el documento no tiene texto copiable.">?<span class="docs-tip">El OCR reconstruye el texto de documentos escaneados. En Automático solo actúa cuando el documento no tiene texto copiable.</span></span>`;

  const listbar = el('div', 'docs-listbar');
  listbar.innerHTML = `
    <div class="docs-listtitle">Todos los documentos <span class="count">(0)</span></div>
    <div class="docs-spacer"></div>
    <div class="docs-search">${svg('search', 13)}<input type="text" placeholder="Buscar documento…" id="docsSearchInput"></div>
    <span id="docsFilterMount"></span>`;

  const rows = el('div', 'docs-rows');
  rows.appendChild(el('div', 'docs-empty', 'Cargando documentos…'));

  // Cada bloque en su recuadro (como la vista Proyectos)
  const toolbarBox = el('div', 'docs-box docs-box--tools');
  toolbarBox.appendChild(toolbar);
  const listBox = el('div', 'docs-box');
  listBox.appendChild(listbar);
  listBox.appendChild(rows);
  wrap.replaceChildren(head, toolbarBox, listBox);

  const pickBtn = toolbar.querySelector('#docsPickBtn');
  const ocrChip = toolbar.querySelector('#docsOcrChip');
  const imgChip = toolbar.querySelector('#docsImgChip');
  const searchInput = listbar.querySelector('#docsSearchInput');
  const countEl = listbar.querySelector('.docs-listtitle .count');

  searchInput.value = STATE.docsQuery || '';
  searchInput.addEventListener('input', (e) => { STATE.docsQuery = e.target.value; renderRows(); });

  // Chip OCR: ciclo auto → force → off, guardado en STATE.docsOcr.
  const OCR_LABELS = { auto: 'Automático', force: 'Forzar', off: 'Desactivado' };
  function paintOcrChip() {
    ocrChip.classList.toggle('on', STATE.docsOcr !== 'off');
    ocrChip.innerHTML = `${svg('scan', 14)}<span>OCR: ${OCR_LABELS[STATE.docsOcr] || 'Automático'}</span>`;
  }
  ocrChip.onclick = () => {
    STATE.docsOcr = STATE.docsOcr === 'auto' ? 'force' : (STATE.docsOcr === 'force' ? 'off' : 'auto');
    paintOcrChip();
  };
  paintOcrChip();

  // Chip "Extraer imágenes": checkbox simple guardado en STATE.docsExtractImages.
  function paintImgChip() {
    imgChip.classList.toggle('on', !!STATE.docsExtractImages);
    imgChip.innerHTML = `<span class="cbx">${STATE.docsExtractImages ? svg('check', 12) : ''}</span>${svg('image', 14)}<span>Extraer imágenes</span>`;
  }
  imgChip.onclick = () => { STATE.docsExtractImages = !STATE.docsExtractImages; paintImgChip(); };
  paintImgChip();

  // La propia lista es la zona de arrastre (solo resalta mientras se arrastra encima).
  rows.addEventListener('dragenter', (e) => { e.preventDefault(); rows.classList.add('drag'); });
  rows.addEventListener('dragover', (e) => { e.preventDefault(); rows.classList.add('drag'); });
  rows.addEventListener('dragleave', () => rows.classList.remove('drag'));
  rows.addEventListener('drop', (e) => { e.preventDefault(); rows.classList.remove('drag'); handleDrop(e); });

  let _inits = [];
  let _docs = [];

  function renderRows() {
    let list = _docs;
    if (STATE.docsFilter && STATE.docsFilter !== 'all') list = list.filter(d => d.initiative_id === STATE.docsFilter);
    const q = (STATE.docsQuery || '').trim().toLowerCase();
    if (q) list = list.filter(d => (d.name || '').toLowerCase().includes(q));
    if (countEl) countEl.textContent = `(${list.length})`;
    if (!_inits.length) {
      rows.replaceChildren(emptyState({
        icon: 'folder',
        title: 'Crea un proyecto para guardar sus documentos',
        text: '',
      }));
      return;
    }
    if (!list.length) {
      rows.replaceChildren(emptyState({
        icon: 'folder',
        title: 'Aún no hay documentos convertidos',
        text: '',
      }));
      return;
    }
    rows.replaceChildren();
    list.forEach(d => rows.appendChild(buildDocCard(d, refreshAll)));
  }

  async function refreshAll() {
    try { _docs = await api.listAllDocuments() || []; } catch (e) { _docs = []; }
    renderRows();
  }
  _docsRefreshList = refreshAll;

  (async () => {
    try { _inits = await api.listDocumentInitiatives() || []; } catch (e) { _inits = []; }

    if (!_inits.length) {
      pickBtn.disabled = true;
      toolbar.querySelector('#docsDestMount').replaceWith(el('span', 'docs-hint', 'Crea un proyecto primero'));
    } else {
      if (STATE.docsDest == null || !_inits.some(i => i.id === STATE.docsDest)) STATE.docsDest = _inits[0].id;
      if (STATE.docsFilter !== 'all' && !_inits.some(i => i.id === STATE.docsFilter)) STATE.docsFilter = 'all';

      const destItems = _inits.map(i => ({ value: i.id, label: i.name, color: _initColor(i) }));
      const destSel = customSelect({
        value: STATE.docsDest, items: destItems, icon: 'folder', minWidth: 200,
        onChange: (v) => { STATE.docsDest = v; },
      });
      toolbar.querySelector('#docsDestMount').replaceWith(destSel);
      pickBtn.disabled = false;
      pickBtn.onclick = async () => {
        pickBtn.disabled = true;
        try {
          const res = await api.pickAndConvertDocuments(STATE.docsDest, STATE.docsOcr, STATE.docsExtractImages);
          if (res && res.cancelled) return;
          const okN = (res.converted || []).length;
          const failN = (res.failed || []).length;
          let msg = `${okN} convertido${okN === 1 ? '' : 's'}`;
          if (failN) msg += ` · ${failN} sin convertir (${res.failed.map(f => f.name).join(', ')})`;
          toast(failN && !okN ? 'err' : 'ok', msg);
          await refreshAll();
        } catch (e) {
          toast('err', 'Hubo un error al convertir.');
        } finally {
          pickBtn.disabled = false;
        }
      };

      const filterItems = [{ value: 'all', label: 'Todas' }].concat(destItems);
      const filterSel = customSelect({
        value: STATE.docsFilter, items: filterItems, icon: 'filter', minWidth: 180,
        onChange: (v) => { STATE.docsFilter = v; renderRows(); },
      });
      listbar.querySelector('#docsFilterMount').replaceWith(filterSel);
    }

    await refreshAll();
  })();

  return wrap;
}

/* ============================================================
   4b. VISTA: TODAS LAS INICIATIVAS
   ============================================================ */
const _initNotesKey = id => `hm.initNote.${id}`;
function _getInitNote(id) { return localStorage.getItem(_initNotesKey(id)) || ''; }
function _setInitNote(id, val) { val ? localStorage.setItem(_initNotesKey(id), val) : localStorage.removeItem(_initNotesKey(id)); }

function viewAllInitiatives() {
  let _filter = 'all'; // all | pinned | active | paused | closed
  let _search = '';
  let _sortBy = 'activity'; // activity | name | meetings
  let _selId = null;
  const _expandedInits = new Set();

  const wrap = el('div', 'init-hub-wrap');

  // ── Toolbar ───────────────────────────────────────────────
  const toolbar = el('div', 'init-hub-toolbar');

  // Fila 1: título + nº de activos (el botón "Nuevo proyecto" vive en el sidebar)
  const topRow = el('div', 'init-hub-top-row');
  const _nAct = STATE.initiatives.length;
  topRow.innerHTML = `<h1 class="page-title">Proyectos</h1>`
    + `<span class="init-hub-count">${_nAct} activo${_nAct === 1 ? '' : 's'}</span>`;
  toolbar.appendChild(topRow);
  wrap.appendChild(toolbar);

  // ── Cuerpo: tabla + panel ─────────────────────────────────
  const body = el('div', 'init-hub-body');

  // Anchos de columna redimensionables (px). fixed=true = no se pueden cambiar.
  const _cols = [
    { fixed: true,  w: 20,  min: 20  },  // chevron
    { fixed: true,  w: 22,  min: 22  },  // pin
    { fixed: false, w: 200, min: 110 },  // nombre
    { fixed: false, w: 110, min: 80  },  // actividad
    { fixed: false, w: 62,  min: 50  },  // reuniones
    { fixed: false, w: 78,  min: 58  },  // horas grabadas
    { fixed: false, w: 115, min: 80  },  // pendientes
    { fixed: false, w: 160, min: 80  },  // notas
    { fixed: true,  w: 34,  min: 34  },  // menú
  ];
  // Duración total grabada del proyecto ("2 h 15 m") a partir de m.dur (MM:SS)
  const _durSecs = (d) => {
    if (!d || typeof d !== 'string') return 0;
    const p = d.split(':').map(Number);
    if (p.some(isNaN)) return 0;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0;
  };
  const _fmtHours = (ms) => {
    if (ms === undefined) return '…';
    const total = (ms || []).reduce((a, m) => a + _durSecs(m.dur), 0);
    if (!total) return '—';
    const h = Math.floor(total / 3600), mn = Math.round((total % 3600) / 60);
    return h ? `${h} h${mn ? ' ' + mn + ' m' : ''}` : `${Math.max(1, mn)} m`;
  };
  const _gridTpl = () => _cols.map(c => c.w + 'px').join(' ');
  const _applyWidths = () => {
    const tpl = _gridTpl();
    thead.style.gridTemplateColumns = tpl;
    tbody.querySelectorAll('.init-hub-row, .init-hub-meeting-row')
         .forEach(r => { r.style.gridTemplateColumns = tpl; });
  };

  const tableWrap = el('div', 'init-hub-table');
  const thead = el('div', 'init-hub-thead');

  const colLabels = ['', '', 'Proyecto', 'Actividad', 'Reuniones', 'Horas', 'Pendientes', 'Notas', ''];
  const _centeredCols = new Set([3, 4, 5, 6, 7]); // Actividad, Reuniones, Horas, Pendientes, Notas
  _cols.forEach((col, i) => {
    const cell = el('div', 'iht' + (_centeredCols.has(i) ? ' iht--center' : ''));
    cell.textContent = colLabels[i];
    if (i === 2) { // solo columna "Proyecto" es redimensionable
      const handle = el('span', 'col-resizer');
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault(); e.stopPropagation();
        handle.classList.add('is-dragging');
        const startX = e.clientX, startW = col.w;
        const onMove = (e) => {
          col.w = Math.max(col.min, startW + e.clientX - startX);
          _applyWidths();
        };
        const onUp = () => {
          handle.classList.remove('is-dragging');
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
      cell.appendChild(handle);
    }
    thead.appendChild(cell);
  });
  tableWrap.appendChild(thead);

  const tbody = el('div', 'init-hub-tbody');
  tableWrap.appendChild(tbody);

  // Recuadro que contiene la tabla (el encabezado va arriba, sin buscador)
  const box = el('div', 'init-hub-box');
  box.appendChild(tableWrap);
  body.appendChild(box);

  const panel = el('div', 'init-hub-panel');
  panel.hidden = true;
  body.appendChild(panel);
  wrap.appendChild(body);

  // ── Helpers ───────────────────────────────────────────────
  function _fmtActivity(it) {
    const ms = STATE.meetingsByInit[it.id];
    if (!ms) return '…';
    if (!ms.length) return '—';
    const m = ms[0];
    if (!m.started_at) return m.time || m.month_label || '—';
    const d = new Date(m.started_at), now = new Date();
    const t = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return `Hoy · ${t}`;
    if (d.toDateString() === new Date(now - 86400000).toDateString()) return `Ayer · ${t}`;
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
  }

  function _pendingCount(it) {
    const ms = STATE.meetingsByInit[it.id];
    return ms ? ms.filter(m => m.status === 'pending' || m.status === 'processing').length : null;
  }

  function _getFiltered() {
    let list = [...STATE.initiatives];
    if (_search) list = list.filter(it =>
      it.name.toLowerCase().includes(_search) ||
      (it.description || '').toLowerCase().includes(_search));
    if (_filter === 'pinned') list = list.filter(it => it.pinned);
    if (_filter === 'fav') list = list.filter(it => it.pinned);
    if (_sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    else if (_sortBy === 'meetings') {
      list.sort((a, b) => (STATE.meetingsByInit[b.id] || []).length - (STATE.meetingsByInit[a.id] || []).length);
    } else { // activity: pinned first, then newest
      list.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        const aD = STATE.meetingsByInit[a.id]?.[0]?.started_at;
        const bD = STATE.meetingsByInit[b.id]?.[0]?.started_at;
        return (bD ? new Date(bD) : 0) - (aD ? new Date(aD) : 0);
      });
    }
    return list;
  }

  function redrawList() {
    tbody.replaceChildren();
    const list = _getFiltered();
    if (!list.length) {
      tbody.appendChild(el('p', 'files-empty', _search ? 'Sin proyectos que coincidan.' : 'Aún no hay proyectos.'));
    } else {
      list.forEach(it => tbody.appendChild(renderRow(it)));
    }
    if (!_search) {
      const addRow = el('button', 'init-hub-addrow');
      addRow.innerHTML = `<span class="iha-plus">${svg('plus', 13)}</span><span>Nuevo proyecto</span>`;
      addRow.onclick = promptNewInitiative;
      tbody.appendChild(addRow);
    }
    _applyWidths();
  }

  function renderRow(it) {
    const isExpanded = _expandedInits.has(it.id);
    const ms = STATE.meetingsByInit[it.id];
    const pending = _pendingCount(it);
    const wrapper = el('div', 'init-hub-item');

    const row = el('div', 'init-hub-row' + (_selId === it.id ? ' is-selected' : '') + (isExpanded ? ' is-expanded' : ''));
    row.innerHTML = `
      <span class="ihr-chev">${svg('chevron', 10)}</span>
      <span class="ihr-pin${it.pinned ? ' is-pinned' : ''}" title="${it.pinned ? 'Desfijar' : 'Fijar'}">${svg('pin', 11)}</span>
      <div class="ihr-name-cell">
        <span class="ihr-dot" style="background:${_initColor(it)}"></span>
        <div class="ihr-info">
          <span class="ihr-name">${esc(it.name)}</span>
          ${it.description ? `<span class="ihr-desc">${esc(it.description.slice(0,55))}${it.description.length > 55 ? '…' : ''}</span>` : ''}
        </div>
      </div>
      <span class="ihr-activity">${_fmtActivity(it)}</span>
      <span class="ihr-meetings">${ms === undefined ? '…' : ms.length}</span>
      <span class="ihr-hours" title="Tiempo total grabado">${_fmtHours(ms)}</span>
      <span class="ihr-pending${pending > 0 ? ' has-pending' : ''}">${pending === null ? '…' : pending > 0 ? `${pending} por transcribir` : ''}</span>`;

    // Celda de notas editable inline
    const noteCell = el('div', 'ihr-note-cell');
    const noteVal = _getInitNote(it.id);
    noteCell.title = noteVal || 'Clic para agregar nota…';
    noteCell.innerHTML = noteVal
      ? `<span class="ihr-note-text">${esc(noteVal)}</span>`
      : `<span class="ihr-note-placeholder">Agregar nota…</span>`;
    noteCell.addEventListener('click', e => {
      e.stopPropagation();
      if (noteCell.querySelector('textarea')) return;
      const cur = _getInitNote(it.id);
      const ta = document.createElement('textarea');
      ta.className = 'ihr-note-input';
      ta.value = cur;
      ta.placeholder = 'Escribe una nota…';
      noteCell.replaceChildren(ta);
      ta.focus();
      const save = () => {
        const v = ta.value.trim();
        _setInitNote(it.id, v);
        noteCell.title = v || 'Clic para agregar nota…';
        noteCell.replaceChildren();
        noteCell.innerHTML = v
          ? `<span class="ihr-note-text">${esc(v)}</span>`
          : `<span class="ihr-note-placeholder">Agregar nota…</span>`;
      };
      ta.addEventListener('blur', save);
      ta.addEventListener('keydown', e => { if (e.key === 'Escape') { ta.value = _getInitNote(it.id); ta.blur(); } if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.blur(); } });
    });
    row.appendChild(noteCell);

    const menuBtn = el('button', 'icon-btn ihr-menu-btn');
    menuBtn.innerHTML = svg('dots', 14);
    menuBtn.onclick = (e) => { e.stopPropagation(); openInitiativeMenu(e, it.id); };
    row.appendChild(menuBtn);
    row.oncontextmenu = (e) => { e.preventDefault(); openInitiativeMenu(e, it.id); };

    row.onclick = (e) => {
      if (e.target.closest('.ihr-menu-btn') || e.target.closest('.ihr-pin')) return;
      const alreadyOpen = _selId === it.id && _expandedInits.has(it.id);
      if (alreadyOpen) {
        // 2.º click: cierra panel y colapsa
        _selId = null;
        _expandedInits.delete(it.id);
      } else {
        // 1.er click: abre panel y despliega reuniones
        _selId = it.id;
        _expandedInits.add(it.id);
        if (!STATE.meetingsByInit[it.id]) {
          api.listMeetings(it.id).then(r => { STATE.meetingsByInit[it.id] = r || []; redrawList(); });
        }
      }
      redrawList();
      redrawPanel();
    };

    row.querySelector('.ihr-pin').onclick = async (e) => {
      e.stopPropagation();
      await api.toggleInitiativePin(it.id).catch(() => {});
      it.pinned = !it.pinned;
      redrawList();
    };
    wrapper.appendChild(row);

    if (isExpanded) {
      const sub = el('div', 'init-hub-sub');
      const msList = ms || [];
      if (!msList.length) {
        sub.appendChild(el('p', 'files-empty', STATE.meetingsByInit[it.id] ? 'Sin reuniones aún.' : 'Cargando…'));
      } else {
        const MS2 = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const MES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        // Calcula lunes de la semana a partir de una fecha ISO (fuente de verdad = started_at)
        const _weekOf = (iso) => {
          if (!iso) return { mKey: 'none', wKey: 'none', wLabel: '—', mLabel: 'Sin fecha' };
          const d = new Date(iso); if (isNaN(d)) return { mKey: 'none', wKey: 'none', wLabel: '—', mLabel: 'Sin fecha' };
          const day = d.getDay();
          const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
          mon.setHours(0, 0, 0, 0);
          const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
          const thu = new Date(mon); thu.setDate(mon.getDate() + 3); // mes = jueves de la semana (ISO)
          const fmt = dt => `${dt.getDate()} ${MS2[dt.getMonth()]}`;
          return {
            mKey:   `${thu.getFullYear()}-${String(thu.getMonth()+1).padStart(2,'0')}`,
            wKey:   `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`,
            wLabel: `${fmt(mon)} – ${fmt(sun)}`,
            mLabel: `${MES[thu.getMonth()]} ${thu.getFullYear()}`,
          };
        };

        // Pre-agrupar por mes → semana usando started_at como única fuente de verdad
        const monthOrder = []; // mantiene orden de inserción
        const monthMap2  = new Map(); // mKey → { mLabel, wkKeys[] }
        const weekMap2   = new Map(); // mKey|wKey → { wLabel, ms[] }
        msList.forEach(m => {
          const { mKey, wKey, wLabel, mLabel } = _weekOf(m.started_at);
          if (!monthMap2.has(mKey)) { monthMap2.set(mKey, { mLabel, wkKeys: [] }); monthOrder.push(mKey); }
          const mapKey = `${mKey}|${wKey}`;
          if (!weekMap2.has(mapKey)) { weekMap2.set(mapKey, { wLabel, ms: [] }); monthMap2.get(mKey).wkKeys.push(mapKey); }
          weekMap2.get(mapKey).ms.push(m);
        });

        // Estado de semanas abiertas (solo la primera por defecto)
        if (!STATE._hubWeeks) STATE._hubWeeks = {};
        if (!STATE._hubWeeks[it.id]) {
          const firstWk = monthOrder.length ? monthMap2.get(monthOrder[0]).wkKeys[0] : null;
          STATE._hubWeeks[it.id] = new Set(firstWk ? [firstWk] : []);
        }
        const openHubWeeks = STATE._hubWeeks[it.id];
        const mc = _initColor(it);

        monthOrder.forEach(mKey => {
          const { mLabel, wkKeys } = monthMap2.get(mKey);
          // Mes
          const mhdr = el('div', 'ihm-month-hdr');
          mhdr.innerHTML = `<span></span><span class="ihm-month-label">${esc(mLabel)}</span>`;
          sub.appendChild(mhdr);
          // Semanas
          wkKeys.forEach(mapKey => {
            const { wLabel, ms: wms } = weekMap2.get(mapKey);
            const isOpen = openHubWeeks.has(mapKey);
            const whdr = el('div', 'ihm-week-hdr' + (isOpen ? ' open' : ''));
            whdr.innerHTML = `<span class="tw-chev">${svg('chevron', 9)}</span><span class="ihm-week-label">${esc(wLabel)}</span><span class="ihm-week-cnt">${wms.length}</span>`;
            whdr.onclick = (e) => { e.stopPropagation(); openHubWeeks.has(mapKey) ? openHubWeeks.delete(mapKey) : openHubWeeks.add(mapKey); redrawList(); };
            sub.appendChild(whdr);
            if (isOpen) {
              wms.forEach(m => {
                const mr = el('div', 'init-hub-meeting-row');
                mr.dataset.mid = m.id;
                const st = m.status || 'done';
                const ds = st === 'pending' ? `border:1.5px solid ${mc};background:transparent` : `background:${mc}`;
                const isFav = _isMeetingFav(m.id);
                // Origen de la reunión: audio, video importado o pantalla grabada
                const srcIcon = m.source === 'audio' ? 'mic' : m.source === 'import' ? 'upload' : m.source === 'screen' ? 'monitorDot' : 'calendar';
                const srcTitle = m.source === 'audio' ? 'Audio de reunión' : m.source === 'import' ? 'Vídeo importado' : m.source === 'screen' ? 'Grabación de pantalla' : 'Reunión';
                const detail = [m.dur && m.dur !== '—' ? m.dur : '', m.size || ''].filter(Boolean).join(' · ');
                mr.innerHTML = `<div class="ihm-info"><span class="stat ${st}" style="${ds}"></span><span class="ihm-kind" title="${srcTitle}">${svg(srcIcon, 12)}</span><span class="ihm-title">${esc(_fmtMeetingLabel(m))}</span></div>
                  <span class="ihm-detail">${esc(detail)}</span>
                  <span class="ihm-date">${m.time || ''}</span>
                  <button class="icon-btn sm ihm-fav-btn${isFav ? ' fav-on' : ''}" title="${isFav ? 'Quitar de favoritos' : 'Marcar como favorito'}">${svg('star', 12)}</button>`;
                mr.querySelector('.ihm-fav-btn').onclick = (e) => {
                  e.stopPropagation();
                  _toggleMeetingFav(m.id);
                  const nowFav = _isMeetingFav(m.id);
                  const btn = mr.querySelector('.ihm-fav-btn');
                  btn.classList.toggle('fav-on', nowFav);
                  btn.title = nowFav ? 'Quitar de favoritos' : 'Marcar como favorito';
                  renderSidebar();
                };
                mr.onclick = (e) => { if (e.target.closest('.ihm-fav-btn')) return; e.stopPropagation(); STATE.selInit = it.id; openMeeting(m.id); };
                mr.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); openMeetingMenu(e, m.id); };
                sub.appendChild(mr);
              });
            }
          });
        });
      }
      wrapper.appendChild(sub);
    }
    return wrapper;
  }

  function redrawPanel() {
    if (!_selId) { panel.classList.remove('is-visible'); return; }
    const it = STATE.initiatives.find(x => x.id === _selId);
    if (!it) { panel.classList.add('is-visible'); panel.innerHTML = ''; return; }
    panel.classList.add('is-visible');
    const ms = STATE.meetingsByInit[it.id] || [];
    const pending = ms.filter(m => m.status === 'pending' || m.status === 'processing').length;

    panel.innerHTML = `
      <div class="ihp-head">
        <span class="ihp-dot" style="background:${_initColor(it)}"></span>
        <span class="ihp-name">${esc(it.name)}</span>
        <button class="icon-btn ihp-pin${it.pinned ? ' is-pinned' : ''}" title="${it.pinned ? 'Desfijar' : 'Fijar'}">${svg('pin', 13)}</button>
        <button class="icon-btn ihp-more" title="Más acciones">${svg('dots', 14)}</button>
        <button class="icon-btn ihp-close" title="Cerrar">${svg('x', 14)}</button>
      </div>
      ${it.description ? `<p class="ihp-desc">${esc(it.description)}</p>` : ''}
      <div class="ihp-stats">
        <div class="ihp-stat">${svg('calendar', 12)}<span>${ms.length} reuniones</span></div>
        ${pending > 0 ? `<div class="ihp-stat is-pending">${svg('warn', 12)}<span>${pending} pendientes por transcribir</span></div>` : ''}
        <div class="ihp-stat">${svg('clock', 12)}<span>Última actividad: ${_fmtActivity(it)}</span></div>
        ${it.created_at ? `<div class="ihp-stat">${svg('info', 12)}<span>Creada el ${new Date(it.created_at).toLocaleDateString('es')}</span></div>` : ''}
      </div>
      <div class="ihp-actions-title">Acciones rápidas</div>
      <div class="ihp-actions">
        <button class="ihp-act ihp-open">${svg('folder', 13)}<span>Abrir proyecto</span></button>
        <button class="ihp-act ihp-pin-act">${svg('pin', 13)}<span>${it.pinned ? 'Desfijar' : 'Fijar'}</span></button>
        <button class="ihp-act ihp-edit">${svg('edit', 13)}<span>Editar</span></button>
        <button class="ihp-act ihp-export">${svg('download', 13)}<span>Exportar contexto</span></button>
        <button class="ihp-act ihp-archive is-danger">${svg('archive', 13)}<span>Archivar</span></button>
      </div>`;

    const closePanel = () => { _selId = null; panel.classList.remove('is-visible'); redrawList(); };
    panel.querySelector('.ihp-close').onclick = closePanel;
    panel.querySelector('.ihp-open').onclick = () => selectInitiative(it.id);
    panel.querySelector('.ihp-pin').onclick = () => panel.querySelector('.ihp-pin-act').click();
    panel.querySelector('.ihp-pin-act').onclick = async () => {
      await api.toggleInitiativePin(it.id).catch(() => {});
      it.pinned = !it.pinned;
      redrawList(); redrawPanel();
    };
    panel.querySelector('.ihp-more').onclick = (e) => openInitiativeMenu(e, it.id);
    panel.querySelector('.ihp-edit').onclick = (e) => openInitiativeMenu(e, it.id);
    panel.querySelector('.ihp-export').onclick = () => exportInitiativeTo(it.id);
    panel.querySelector('.ihp-archive').onclick = (e) => openInitiativeMenu(e, it.id);
  }

  // Cerrar panel al hacer click fuera de filas y del panel
  body.addEventListener('click', (e) => {
    if (_selId && !e.target.closest('.init-hub-row') && !e.target.closest('.init-hub-meeting-row') && !e.target.closest('.init-hub-panel')) {
      _selId = null; panel.classList.remove('is-visible'); redrawList();
    }
  });

  // Render inicial + carga de reuniones en 2.º plano
  redrawList();
  STATE.initiatives.forEach(async it => {
    if (!STATE.meetingsByInit[it.id]) {
      STATE.meetingsByInit[it.id] = await api.listMeetings(it.id) || [];
      redrawList();
      if (_selId === it.id) redrawPanel();
    }
  });

  return wrap;
}

/* ============================================================
   5. SIDEBAR
   ============================================================ */
let _sidebarSearch = '';

// Etiqueta de reunión estilo "vie 04 Jul" (día en minúscula, mes con mayúscula inicial).
// Solo reformatea los títulos autogenerados por fecha (empiezan por DD/MM/YY);
// respeta los nombres que el usuario haya puesto a mano.
function _fmtMeetingLabel(m) {
  const t = (m && m.title) || '';
  const d = m && m.started_at ? new Date(m.started_at) : null;
  if (!/^\d{2}\/\d{2}\/\d{2}/.test(t.trim()) || !d || isNaN(d)) return t;
  const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MO[d.getMonth()]}`;
}

function _renderInitRow(tree, it) {
  const open = !!STATE.openInits[it.id];
  const ms = STATE.meetingsByInit[it.id] || [];
  const isSelected = STATE.selInit === it.id && STATE.screen === 'initiative';
  const row = el('div', 'tree-initiative' + (open ? ' open' : '') + (isSelected ? ' selected' : ''));
  row.dataset.iid = it.id;
  row.title = it.name || '';
  const av = `<span class="proj-av" style="--av:${it.color || avatarColorFor(it.name)}">${esc(initialsFor(it.name))}</span>`;
  // Pin al pasar el mouse (fijados: siempre visible); reemplaza al indicador fijo
  row.innerHTML = `<span class="chev">${svg('chevron', 14)}</span>${av}<span class="name">${esc(it.name)}</span><button class="tree-pin${it.pinned ? ' on' : ''}" title="${it.pinned ? 'Desfijar' : 'Fijar arriba'}" aria-label="${it.pinned ? 'Desfijar proyecto' : 'Fijar proyecto arriba'}">${svg('pin', 12)}</button><span class="count">${ms.length || ''}</span>`;
  row.querySelector('.tree-pin').onclick = async (e) => {
    e.stopPropagation();
    await api.toggleInitiativePin(it.id).catch(() => {});
    it.pinned = !it.pinned;
    renderSidebar();
  };
  row.onclick = () => selectInitiative(it.id);
  row.oncontextmenu = (e) => { e.preventDefault(); openInitiativeMenu(e, it.id); };
  tree.appendChild(row);
  if (open) {
    const sub = el('div', 'tree-meetings');
    const MS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const MESF = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const _monKey = (iso) => {
      const d = new Date(iso); if (isNaN(d)) return null;
      const day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      mon.setHours(0, 0, 0, 0); // normaliza al lunes 00:00 local
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      const thu = new Date(mon); thu.setDate(mon.getDate() + 3); // mes de la semana = su jueves (ISO)
      const fmt = dt => `${dt.getDate()} ${MS[dt.getMonth()]}`;
      // Clave con fecha LOCAL (no UTC): coincide con la etiqueta y no duplica semanas.
      const key = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
      return { key, label: `${fmt(mon)} – ${fmt(sun)}`, monthLabel: `${MESF[thu.getMonth()]} ${thu.getFullYear()}` };
    };

    // Pre-agrupar: mes → semana → reuniones (sin duplicados)
    const monthMap = new Map();   // month_label → [{weekKey,weekLabel,ms:[]}]
    const weekMap  = new Map();   // month|weekKey → weekGroup
    ms.forEach(m => {
      const wk = m.started_at ? _monKey(m.started_at) : null;
      const month = wk ? wk.monthLabel : (m.month_label || 'Sin fecha');
      const wkKey = wk ? wk.key : 'none';
      const wkLabel = wk ? wk.label : '—';
      if (!monthMap.has(month)) monthMap.set(month, []);
      const mapKey = `${month}|${wkKey}`;
      if (!weekMap.has(mapKey)) {
        const g = { weekKey: wkKey, weekLabel: wkLabel, ms: [] };
        weekMap.set(mapKey, g);
        monthMap.get(month).push(g);
      }
      weekMap.get(mapKey).ms.push(m);
    });

    // Estado de semanas abiertas persistido en STATE (solo la más reciente por defecto)
    if (!STATE._openWeeks) STATE._openWeeks = {};
    if (!STATE._openWeeks[it.id]) {
      // Abrir la primera semana (más reciente) por defecto
      const firstMonth = monthMap.keys().next().value;
      const firstWeek = firstMonth && monthMap.get(firstMonth)[0];
      STATE._openWeeks[it.id] = new Set(firstWeek ? [`${firstMonth}|${firstWeek.weekKey}`] : []);
    }
    const openWeeks = STATE._openWeeks[it.id];

    const mColor = _initColor(it);
    monthMap.forEach((weeks, month) => {
      sub.appendChild(el('div', 'tree-month', esc(month)));
      weeks.forEach(({ weekKey, weekLabel, ms: wms }) => {
        const wkId = `${month}|${weekKey}`;
        const isWkOpen = openWeeks.has(wkId);

        // Encabezado de semana colapsable
        const wkHdr = el('div', 'tree-week' + (isWkOpen ? ' open' : ''));
        wkHdr.innerHTML = `<span class="tw-chev">${svg('chevron', 9)}</span><span class="tw-label">${esc(weekLabel)}</span><span class="tw-cnt">${wms.length}</span>`;
        wkHdr.onclick = (e) => {
          e.stopPropagation();
          openWeeks.has(wkId) ? openWeeks.delete(wkId) : openWeeks.add(wkId);
          renderSidebar();
        };
        sub.appendChild(wkHdr);

        if (isWkOpen) {
          wms.forEach(m => {
            const st = m.status || 'done';
            const recording = meetingIsRecording(m.id);
            const transcribing = !recording && (st === 'processing' || meetingIsTranscribing(m.id));
            const mr = el('div', 'tree-meeting' + (STATE.selMeeting === m.id ? ' selected' : '') + (recording ? ' recording' : '') + (transcribing ? ' transcribing' : ''));
            mr.dataset.mid = m.id;
            mr.title = m.title || '';
            const dotStyle = st === 'pending' ? ` style="border:1.5px solid ${mColor};background:transparent"` : st === 'done' ? ` style="background:${mColor}"` : '';
            mr.innerHTML = `<span class="stat ${st}"${dotStyle}></span><span class="mtitle">${esc(_fmtMeetingLabel(m))}</span>${m.time ? '<span class="mtime">' + esc(m.time) + '</span>' : ''}`;
            mr.onclick = (e) => { e.stopPropagation(); openMeeting(m.id); };
            mr.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); openMeetingMenu(e, m.id); };
            sub.appendChild(mr);
          });
        }
      });
    });
    if (!ms.length) sub.appendChild(el('div', 'tree-meeting', '<span style="color:var(--text-faint);font-size:12px">Sin reuniones</span>'));
    tree.appendChild(sub);
  }
}

function renderSidebar() {
  const tree = $('#sidebarTree');
  tree.replaceChildren();

  // Contador de favoritos junto al acceso directo (vacío si no hay)
  const favEl = $('#favCount');
  if (favEl) { const n = _getMeetingFavs().size; favEl.textContent = n || ''; }

  // Contador de proyectos junto a la cabecera "Proyectos"
  const initCountEl = $('#initCount');
  if (initCountEl) initCountEl.textContent = STATE.initiatives.length || '';

  const all = STATE.initiatives;
  const pinned = all.filter(it => it.pinned);
  const rest = all.filter(it => !it.pinned);

  // ── Fijados primero, sin encabezado (el pin de cada fila ya lo indica) ──
  pinned.forEach(it => _renderInitRow(tree, it));

  // ── Activas (no fijadas) — con corte "Mostrar todo" ───────
  const VISIBLE_LIMIT = 8;
  const showAll = !!STATE.showAllProjects;
  const visible = showAll ? rest : rest.slice(0, VISIBLE_LIMIT);
  // El proyecto seleccionado nunca debe quedar oculto por el corte
  // (los nuevos se crean al final de la lista y se seleccionan al crearse).
  if (!showAll) {
    const sel = rest.find(it => it.id === STATE.selInit);
    if (sel && !visible.includes(sel)) visible.push(sel);
  }
  visible.forEach(it => _renderInitRow(tree, it));
  if (!showAll && rest.length > VISIBLE_LIMIT) {
    const more = el('div', 'sb-show-more');
    more.innerHTML = `<span class="sm-ico">${svg('chevronDown', 16)}</span><span>Mostrar todo</span>`;
    more.onclick = () => { STATE.showAllProjects = true; renderSidebar(); };
    tree.appendChild(more);
  }

  if (!all.length) tree.appendChild(el('div', 'tree-meeting', `<span style="color:var(--text-faint);font-size:11px">Sin proyectos</span>`));
}

async function selectInitiative(id) {
  STATE.selInit = id;
  const wasOpen = !!STATE.openInits[id];
  STATE.openInits = {};
  STATE.openInits[id] = !wasOpen;
  // Al abrir una iniciativa: enrollar sus semanas y dejar solo la más reciente.
  if (STATE._openWeeks) delete STATE._openWeeks[id];
  STATE.screen = 'initiative';
  if (!STATE.meetingsByInit[id]) STATE.meetingsByInit[id] = await api.listMeetings(id) || [];
  renderSidebar(); renderMain(); renderActionBar(); renderTopStatus();
}

async function openMeeting(mid, keepTab) {
  STATE.selMeeting = mid;
  STATE.screen = 'meeting';
  if (!keepTab) STATE.activeTab = 'transcript';
  try {
    STATE.transcript = await api.getTranscript(mid);
    renderSidebar(); renderMain(); renderTopStatus();
  } catch (err) {
    STATE.screen = STATE.selInit ? 'initiative' : 'welcome';
    toast('err', errMsg(err, 'No se pudo abrir la reunión'));
    renderSidebar(); renderMain();
  }
}

function backToTree() { STATE.screen = STATE.selMeeting ? 'meeting' : (STATE.selInit ? 'initiative' : 'welcome'); renderMain(); renderTopStatus(); }

function applySidebar() {
  document.body.setAttribute('data-sidebar', STATE.sidebarOpen ? 'open' : 'collapsed');
  save('hm.sidebar', STATE.sidebarOpen ? '1' : '0');
}

// ---- Sidebar redimensionable ----
(function initSidebarResize() {
  const SIDEBAR_MIN = 160, SIDEBAR_MAX = 480, SNAP_THRESHOLD = 130;
  const saved = parseInt(load('hm.sidebar-w', ''), 10);
  if (saved && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
    document.documentElement.style.setProperty('--sidebar-w', saved + 'px');
  }

  let startX, startW, dragging = false;

  function stopDrag() {
    dragging = false;
    document.body.classList.remove('sidebar-dragging');
    document.body.style.userSelect = '';
  }

  document.addEventListener('mousedown', e => {
    const handle = e.target.closest('#sidebarResizeHandle');
    if (!handle || !STATE.sidebarOpen) return;
    e.preventDefault();
    startX = e.clientX;
    startW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10) || 320;
    dragging = true;
    document.body.classList.add('sidebar-dragging');
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newW = Math.min(SIDEBAR_MAX, startW + (e.clientX - startX));
    if (newW < SNAP_THRESHOLD) {
      // Snap inmediato al rail durante el arrastre
      stopDrag();
      STATE.sidebarOpen = false; applySidebar();
      document.documentElement.style.setProperty('--sidebar-w', SIDEBAR_MIN + 'px');
    } else {
      document.documentElement.style.setProperty('--sidebar-w', Math.max(SIDEBAR_MIN, newW) + 'px');
    }
  });

  document.addEventListener('mouseup', e => {
    if (!dragging) return;
    const finalW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
    stopDrag();
    save('hm.sidebar-w', String(finalW));
  });
})();

// ---- Expansión desde el rail ----
(function initRailExpand() {
  const SIDEBAR_MIN = 160, SIDEBAR_MAX = 480;
  let dragging = false, startX = 0;

  document.addEventListener('mousedown', e => {
    if (!e.target.closest('#railResizeHandle')) return;
    e.preventDefault();
    dragging = true;
    startX = e.clientX;
    document.body.classList.add('rail-expanding');
    document.body.style.userSelect = 'none';
    // Expandir el sidebar inmediatamente con ancho mínimo para que aparezca
    STATE.sidebarOpen = true; applySidebar();
    document.documentElement.style.setProperty('--sidebar-w', SIDEBAR_MIN + 'px');
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newW = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, SIDEBAR_MIN + (e.clientX - startX)));
    document.documentElement.style.setProperty('--sidebar-w', newW + 'px');
  });

  document.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('rail-expanding');
    document.body.style.userSelect = '';
    const finalW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
    save('hm.sidebar-w', String(finalW));
  });
})();

// ---- Resize de ventana frameless ----
document.querySelectorAll('.wr[data-dir]').forEach(h => {
  h.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    api.winStartResize(h.dataset.dir);
  });
});

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
  if (STATE.screenPanelOpen && !STATE.screenPanelCollapsed) showScreenPanel();
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
    <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn btn-primary" data-ok>${esc(okLabel)}</button></div>`;
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

// Traduce errores del backend a mensajes cortos en español.
// Códigos conocidos → texto fijo; frases ya en español → tal cual;
// tecnicismos (códigos snake_case, excepciones en inglés) → el mensaje genérico.
const ERR_ES = {
  'no_license':                    'No hay licencia activa.',
  'license_not_found':             'Key no encontrada. Revísala e inténtalo de nuevo.',
  'invalid_key':                   'Key inválida. Revísala e inténtalo de nuevo.',
  'license_already_activated':     'Esta key ya está en uso en otro equipo.',
  'already_activated_this_device': 'Este equipo ya está activado con esta licencia.',
  'license_revoked':               'Esta licencia fue revocada.',
  'license_expired':               'Esta licencia expiró.',
  'license_device_limit':          'Esta licencia ya no admite más equipos.',
  'device_limit_reached':          'Esta licencia ya no admite más equipos.',
  'license_server_requires_https': 'No se pudo conectar de forma segura al servidor.',
  'offline_expired':               'Sin conexión con el servidor de licencias.',
  'new_version':                   'Nueva versión instalada: vuelve a activar tu licencia.',
};
function errMsg(raw, fallback) {
  let s = String(raw == null ? '' : (raw.message || raw)).trim();
  s = s.replace(/^error[:\s]+/i, '').trim();
  if (!s) return fallback;
  const code = s.toLowerCase();
  if (ERR_ES[code]) return ERR_ES[code];
  // Un código técnico o una excepción en inglés no se enseñan tal cual
  if (/^[a-z0-9_.\-]+$/i.test(s)) return fallback;
  if (/(traceback|exception|errno|winerror|timed? ?out|failed|cannot|unable|refused|denied|argument|nonetype|keyerror|typeerror)/i.test(s)) return fallback;
  if (s.length > 140) return fallback;
  return s;
}

function toast(kind, msg, action, onAction) {
  const t = el('div', 'toast ' + (kind || 'info'));
  const i = kind === 'err' ? svg('x', 12) : svg('check', 12);
  t.innerHTML = `<span class="ti">${i}</span><span class="tmsg">${esc(msg)}</span>${action ? `<button class="taction">${esc(action)}</button>` : ''}`;
  if (action && onAction) {
    t.querySelector('.taction').onclick = (e) => { e.stopPropagation(); t.remove(); onAction(); };
  }
  $('#toasts').appendChild(t);
  const ms = kind === 'err' ? 4500 : kind === 'info' ? 3000 : 2500;
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = `opacity .3s`;
    setTimeout(() => t.remove(), 320);
  }, ms);
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
function closeMenu() { if (_ctxOpen) { if (_ctxOpen._owner) _ctxOpen._owner.setAttribute('aria-expanded', 'false'); _ctxOpen.remove(); _ctxOpen = null; } }

/* ---- Dropdown personalizado (reemplaza <select> nativos para respetar el tema) ----
   opts: { value, items:[{value,label,color?}], onChange, icon?, className?, minWidth? } */
function customSelect(opts) {
  const items = opts.items || [];
  let curVal = opts.value;
  const trig = el('button', 'cdrop' + (opts.className ? ' ' + opts.className : ''));
  trig.type = 'button';
  trig.setAttribute('aria-haspopup', 'listbox');
  trig.setAttribute('aria-expanded', 'false');
  const cur = () => items.find(i => i.value === curVal) || items[0] || { label: '' };
  const paint = () => {
    const it = cur();
    trig.innerHTML =
      (opts.icon ? `<span class="cdrop-ico">${svg(opts.icon, 13)}</span>` : '') +
      (it.color ? `<span class="cdrop-dot" style="background:${it.color}"></span>` : '') +
      `<span class="cdrop-label">${esc(it.label)}</span>` +
      `<span class="cdrop-chev">${svg('chevronDown', 14)}</span>`;
  };
  paint();
  trig.onclick = (e) => {
    e.stopPropagation();
    if (_ctxOpen && _ctxOpen._owner === trig) { closeMenu(); return; }
    openCustomSelectPanel(trig, items, curVal, opts.minWidth, (it) => {
      curVal = it.value; paint(); opts.onChange && opts.onChange(it.value);
    });
  };
  return trig;
}
function openCustomSelectPanel(anchor, items, curVal, minWidth, onPick) {
  closeMenu();
  const panel = el('div', 'cdrop-panel');
  panel._owner = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  items.forEach(it => {
    const o = el('div', 'cdrop-opt' + (it.value === curVal ? ' on' : ''));
    o.innerHTML =
      (it.color ? `<span class="cdrop-dot" style="background:${it.color}"></span>` : '') +
      `<span class="cdrop-opt-label">${esc(it.label)}</span>` +
      (it.value === curVal ? `<span class="cdrop-check">${svg('check', 13)}</span>` : '');
    o.onclick = (e) => { e.stopPropagation(); closeMenu(); onPick(it); };
    panel.appendChild(o);
  });
  document.body.appendChild(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.minWidth = Math.max(r.width, minWidth || 180) + 'px';
  let left = r.left;
  let top = r.bottom + 6;
  if (left + panel.offsetWidth > window.innerWidth - 10) left = window.innerWidth - panel.offsetWidth - 10;
  if (top + panel.offsetHeight > window.innerHeight - 10) top = r.top - panel.offsetHeight - 6;
  panel.style.left = Math.max(10, left) + 'px';
  panel.style.top = Math.max(10, top) + 'px';
  _ctxOpen = panel;
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
}

// ── Carpetas de iniciativa (almacenadas localmente) ──────────
function _getFolders(iid) { try { return JSON.parse(localStorage.getItem('hm.folders.' + iid) || '[]'); } catch { return []; } }
function _saveFolders(iid, folders) { localStorage.setItem('hm.folders.' + iid, JSON.stringify(folders)); }
function promptCreateFolder(iid) {
  formModal('Nueva carpeta', 'Nombre de la carpeta', '', 'Crear', (name) => {
    if (!name.trim()) return;
    const folders = _getFolders(iid);
    folders.push({ id: Date.now(), name: name.trim() });
    _saveFolders(iid, folders);
    toast('ok', `Carpeta «${name.trim()}» creada`);
    if (STATE.screen === 'initiative' && STATE.selInit === iid) renderMain();
  });
}

async function _importVideosToInit(iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  const name = it ? it.name : 'el proyecto';
  const r = await api.importMediaMultiple(iid).catch(() => null);
  if (!r || r.cancelled) return;
  if (r.error) { toast('err', errMsg(r.error, 'No se pudieron importar los vídeos')); return; }
  if (r.ok) {
    toast('info', `Registrando ${r.count} video${r.count !== 1 ? 's' : ''}…`);
    await refreshMeetings(iid);
    toast('ok', `${r.count} video${r.count !== 1 ? 's' : ''} importado${r.count !== 1 ? 's' : ''} en «${name}» · transcribiendo en 2.º plano`);
  }
}

function _initAllFav(iid) {
  const ms = STATE.meetingsByInit[iid] || [];
  const favs = _getMeetingFavs();
  const allFav = ms.length > 0 && ms.every(m => favs.has(m.id));
  if (allFav) {
    ms.forEach(m => favs.delete(m.id));
    localStorage.setItem('hm.favMeetings', JSON.stringify([...favs]));
    toast('ok', `${ms.length} reuniones quitadas de favoritas`);
  } else {
    ms.forEach(m => favs.add(m.id));
    localStorage.setItem('hm.favMeetings', JSON.stringify([...favs]));
    toast('ok', `${ms.length} reuniones añadidas a favoritas`);
  }
  renderSidebar(); if (STATE.screen === 'favorites') renderMain();
}

function openInitiativeMenu(e, iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  const pinned = !!(it && it.pinned);
  const ms = STATE.meetingsByInit[iid] || [];
  const favs = _getMeetingFavs();
  const allFav = ms.length > 0 && ms.every(m => favs.has(m.id));
  openMenu(e, [
    { label: pinned ? 'Desanclar proyecto' : 'Anclar proyecto', icon: 'pin', onClick: () => toggleInitiativePin(iid) },
    { label: allFav ? 'Quitar de favoritas' : 'Añadir todas a favoritas', icon: 'star', onClick: () => _initAllFav(iid) },
    { label: 'Ver glosario', icon: 'search', onClick: () => openGlossary(iid) },
    { label: 'Renombrar proyecto', icon: 'edit', onClick: () => promptRenameInitiative(iid) },
    { label: 'Cambiar color', icon: 'palette', onClick: () => pickInitiativeColor(iid) },
    { sep: true },
    { label: 'Importar videos', icon: 'upload', onClick: () => _importVideosToInit(iid) },
    { sep: true },
    { label: 'Exportar a otra carpeta', icon: 'download', onClick: () => exportInitiativeTo(iid) },
    { sep: true },
    { label: 'Archivar proyecto', icon: 'archive', onClick: () => archiveInitiative(iid) },
  ]);
}

function pickInitiativeColor(iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  const current = _initColor(it);
  const m = el('div', 'modal-card color-picker-modal');
  m.innerHTML = `
    <div class="modal-head"><span class="modal-title">Color del proyecto</span><button class="icon-btn" data-x>✕</button></div>
    <div class="modal-body">
      <div class="color-swatches" id="colorSwatches"></div>
    </div>`;
  const swatches = m.querySelector('#colorSwatches');
  INIT_COLORS.forEach(c => {
    const s = el('button', 'color-sw' + (c === current ? ' on' : ''));
    s.style.setProperty('--sw', c);
    s.title = c;
    s.onclick = async () => {
      await api.setInitiativeColor(iid, c);
      if (it) it.color = c;
      renderSidebar();
      if (STATE.screen === 'initiative' && STATE.selInit === iid) renderMain();
      closeModal();
    };
    swatches.appendChild(s);
  });
  m.querySelector('[data-x]').onclick = closeModal;
  openModal(m);
}
function _getMeetingFavs() { try { return new Set(JSON.parse(localStorage.getItem('hm.favMeetings') || '[]')); } catch { return new Set(); } }
function _toggleMeetingFav(mid) { const s = _getMeetingFavs(); s.has(mid) ? s.delete(mid) : s.add(mid); localStorage.setItem('hm.favMeetings', JSON.stringify([...s])); }
function _isMeetingFav(mid) { return _getMeetingFavs().has(mid); }

function openMeetingMenu(e, mid) {
  const isFav = _isMeetingFav(mid);
  openMenu(e, [
    { label: isFav ? 'Quitar de favoritos' : 'Marcar como favorita', icon: 'star', onClick: () => { _toggleMeetingFav(mid); renderSidebar(); renderMain(); } },
    { sep: true },
    { label: 'Participantes', icon: 'users', onClick: () => { if (STATE.transcript) participantsModal(STATE.transcript); } },
    { label: 'Importar video y transcribir…', icon: 'upload', onClick: () => doImportVideoForMeeting(mid) },
    { sep: true },
    { label: 'Renombrar reunión', icon: 'edit', onClick: () => promptRenameMeeting(mid) },
    { label: 'Cambiar fecha', icon: 'calendar', onClick: () => promptChangeMeetingDate(mid) },
    { label: 'Mover a otro proyecto', icon: 'folder', onClick: () => promptMoveMeeting(mid) },
    { sep: true },
    { label: 'Archivar reunión', icon: 'archive', onClick: () => archiveMeeting(mid) },
  ]);
}

async function doImportVideoForMeeting(mid) {
  const r = await api.importVideoForMeeting(mid);
  if (!r || r.cancelled) return;
  if (r.error) { toast('err', errMsg(r.error, 'No se pudo importar el archivo')); return; }
  if (r.ok) {
    toast('ok', `«${r.filename || 'video'}» importado · transcribiendo en segundo plano`);
    try { renderBgJobs(await api.getBackgroundJobs()); } catch (e) {}
    await refreshMeetings(STATE.selInit);
    renderMain();
  }
}

/* ============================================================
   7. ACCIONES (contrato actual)
   ============================================================ */
// Modal "Elige un proyecto": lista los existentes y permite crear uno nuevo.
// Al elegir o crear, llama a onPick(iid) para continuar la acción pendiente
// (p. ej. iniciar una grabación). El modal ya se cierra solo antes de onPick.
function pickInitiativeModal(onPick) {
  const items = STATE.initiatives || [];
  const m = el('div', 'modal pick-init-modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Elegir proyecto');
  m.innerHTML = `
    <div class="modal-head"><h3>¿En qué proyecto?</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      ${items.length ? `<div class="pick-init-list">${items.map(it => `
        <button type="button" class="pick-init-row" data-iid="${it.id}">
          <span class="proj-av" style="--av:${it.color || avatarColorFor(it.name)}">${esc(initialsFor(it.name))}</span>
          <span class="pick-init-name">${esc(it.name)}</span>
        </button>`).join('')}</div>` : ''}
      <button type="button" class="btn pick-init-new">${svg('plus', 13)} Nuevo proyecto</button>
    </div>`;
  m.querySelectorAll('.pick-init-row').forEach(b => b.onclick = () => {
    const iid = Number(b.dataset.iid);
    closeModal();
    onPick(iid);
  });
  m.querySelector('.pick-init-new').onclick = () => { closeModal(); promptNewInitiative(onPick); };
  m.querySelector('[data-x]').onclick = closeModal;
  openModal(m);
}

function promptNewInitiative(onCreated) {
  // Color aleatorio por defecto; se puede cambiar en el selector emergente.
  let color = INIT_COLORS[Math.floor(Math.random() * INIT_COLORS.length)];
  const m = el('div', 'modal np-modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Nuevo proyecto');
  m.innerHTML = `
    <div class="modal-head"><h3>Nuevo proyecto</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div><label>Nombre del proyecto</label><input class="field" type="text"><div class="field-error"></div></div>
      <div class="np-color-row">
        <label>Color</label>
        <div class="np-color-wrap">
          <button type="button" class="np-color-btn" id="npColorBtn">
            <span class="np-color-dot" style="background:${color}"></span>
            <span class="np-color-txt">Aleatorio</span>
            <span class="np-color-chev">${svg('chevronDown', 12)}</span>
          </button>
          <div class="np-color-pop" id="npColorPop" hidden>
            ${INIT_COLORS.map(c => `<button type="button" class="color-sw${c === color ? ' on' : ''}" data-color="${c}" style="--sw:${c}" aria-label="Color"></button>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn btn-primary" data-ok>Crear</button></div>`;
  const input = m.querySelector('.field'); const err = m.querySelector('.field-error');
  const colorBtn = m.querySelector('#npColorBtn');
  const pop = m.querySelector('#npColorPop');
  const dot = m.querySelector('.np-color-dot');
  const txt = m.querySelector('.np-color-txt');
  colorBtn.onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; };
  m.addEventListener('click', (e) => { if (!e.target.closest('.np-color-wrap')) pop.hidden = true; });
  pop.querySelectorAll('.color-sw').forEach(sw => sw.onclick = () => {
    color = sw.dataset.color;
    dot.style.background = color;
    txt.textContent = 'Personalizado';
    pop.querySelectorAll('.color-sw').forEach(x => x.classList.toggle('on', x === sw));
    pop.hidden = true;
  });
  const submit = async () => {
    const name = input.value.trim();
    if (!name) { input.classList.add('invalid'); err.textContent = 'Este campo no puede estar vacío.'; input.focus(); return; }
    const okBtn = m.querySelector('[data-ok]'); okBtn.classList.add('is-loading');
    try {
      const it = await api.createInitiative(name, color);
      if (it) {
        if (!it.color) it.color = color;
        STATE.initiatives.push(it); STATE.meetingsByInit[it.id] = [];
        renderSidebar(); toast('ok', 'Proyecto creado'); closeModal(); selectInitiative(it.id);
        // Si venimos de "elige un proyecto" (p. ej. al grabar), continuar la acción
        if (typeof onCreated === 'function') onCreated(it.id);
      }
    } catch (e) { okBtn.classList.remove('is-loading'); err.textContent = 'No se pudo crear. ' + (e && e.message || ''); }
  };
  m.querySelector('[data-ok]').onclick = submit;
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-x]').onclick = closeModal;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  openModal(m);
}
function promptRenameInitiative(iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  formModal('Renombrar proyecto', 'Nuevo nombre', it ? it.name : '', 'Guardar', async (name) => {
    await api.renameInitiative(iid, name); if (it) it.name = name; renderSidebar(); renderMain(); toast('ok', 'Proyecto renombrado');
  });
}
function promptRenameMeeting(mid) {
  const current = (() => {
    for (const k in STATE.meetingsByInit) {
      const m = STATE.meetingsByInit[k].find(x => x.id === mid);
      if (m) return m.title;
    }
    return STATE.transcript && STATE.transcript.title ? STATE.transcript.title : '';
  })();
  formModal('Renombrar reunión', 'Título', current, 'Guardar', async (title) => {
    await api.renameMeeting(mid, title);
    for (const k in STATE.meetingsByInit) { const m = STATE.meetingsByInit[k].find(x => x.id === mid); if (m) m.title = title; }
    if (STATE.transcript) STATE.transcript.title = title;
    renderSidebar(); renderMain(); toast('ok', 'Reunión renombrada');
  });
}
function promptChangeMeetingDate(mid) {
  // Fecha actual de la reunión
  let currentDate = '';
  for (const k in STATE.meetingsByInit) {
    const m = STATE.meetingsByInit[k].find(x => x.id === mid);
    if (m && m.started_at) { currentDate = m.started_at.slice(0, 10); break; }
  }
  const wrap = el('div', 'modal');
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Cambiar fecha');
  wrap.innerHTML = `
    <div class="modal-head"><h3>Cambiar fecha</h3><button class="icon-btn sm" data-x>${svg('x', 14)}</button></div>
    <div class="modal-body">
      <label style="font-size:11px;color:var(--text-secondary);font-weight:600;display:block;margin-bottom:6px">Fecha del calendario</label>
      <input class="field" type="date" id="datePickerInput" value="${esc(currentDate)}" style="width:100%">
      <p style="font-size:11px;color:var(--text-muted);margin-top:8px">Si dejas vacío se usará la fecha de importación original.</p>
    </div>
    <div class="modal-foot">
      <button class="btn" data-c>Cancelar</button>
      <button class="btn btn-primary" data-ok>Guardar</button>
    </div>`;
  wrap.querySelector('[data-x]').onclick = closeModal;
  wrap.querySelector('[data-c]').onclick = closeModal;
  wrap.querySelector('[data-ok]').onclick = async () => {
    const val = wrap.querySelector('#datePickerInput').value.trim();
    const r = await api.setMeetingDate(mid, val || currentDate);
    if (r && r.ok) {
      // Actualizar fecha en STATE
      for (const k in STATE.meetingsByInit) {
        const m = STATE.meetingsByInit[k].find(x => x.id === mid);
        if (m) { m.started_at = r.started_at; }
      }
      closeModal(); toast('ok', 'Fecha actualizada');
      await refreshMeetings(STATE.selInit); renderMain();
    } else {
      toast('err', errMsg(r && r.error, 'No se pudo cambiar la fecha'));
    }
  };
  openModal(wrap);
  setTimeout(() => wrap.querySelector('#datePickerInput').focus(), 80);
}
function promptMoveMeeting(mid) {
  const m = el('div', 'modal'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Mover reunión');
  m.innerHTML = `<div class="modal-head"><h3>Mover a otro proyecto</h3><button class="icon-btn sm" data-x>${svg('x', 14)}</button></div>
    <div class="modal-body"><label>Proyecto destino</label><span id="moveMount"></span></div>
    <div class="modal-foot"><button class="btn" data-c>Cancelar</button><button class="btn btn-primary" data-ok>Mover</button></div>`;
  let target = STATE.initiatives[0] && STATE.initiatives[0].id;
  const sel = customSelect({
    value: target, className: 'cdrop-block', minWidth: 260,
    items: STATE.initiatives.map(i => ({ value: i.id, label: i.name, color: _initColor(i) })),
    onChange: (v) => { target = v; },
  });
  m.querySelector('#moveMount').replaceWith(sel);
  m.querySelector('[data-ok]').onclick = async () => { if (!target) return; await api.moveMeeting(mid, target); closeModal(); toast('ok', 'Reunión movida'); refreshAll(); };
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

function _pickInitiativeForImport() {
  return new Promise((resolve) => {
    const m = el('div', 'modal');
    m.setAttribute('role', 'dialog');
    m.innerHTML = `
      <div class="modal-card iap-modal">
        <div class="modal-head">
          <span class="modal-title">¿A qué proyecto importar?</span>
          <button class="icon-btn" id="iapClose">${svg('x', 14)}</button>
        </div>
        <div class="modal-body iap-body">
          <p class="iap-hint">Selecciona un proyecto o crea uno nuevo.</p>
          <div class="iap-list" id="iapList"></div>
          <button class="btn iap-new-btn" id="iapNew">${svg('plus', 13)} Nuevo proyecto</button>
        </div>
      </div>`;
    const list = m.querySelector('#iapList');
    STATE.initiatives.forEach(it => {
      const row = el('button', 'iap-item');
      row.innerHTML = `<span class="iap-dot" style="background:${_initColor(it)}"></span><span class="iap-name">${esc(it.name)}</span>`;
      row.onclick = () => { closeModal(); resolve(it.id); };
      list.appendChild(row);
    });
    m.querySelector('#iapClose').onclick = () => { closeModal(); resolve(null); };
    m.querySelector('#iapNew').onclick = () => {
      closeModal();
      _promptNewInitiativeReturn(resolve);
    };
    openModal(m);
  });
}

function _promptNewInitiativeReturn(onCreated) {
  let color = INIT_COLORS[0];
  const m = el('div', 'modal');
  m.setAttribute('role', 'dialog');
  m.innerHTML = `
    <div class="modal-head"><h3>Nuevo proyecto</h3><button class="icon-btn sm" data-x>${svg('x', 14)}</button></div>
    <div class="modal-body" style="gap:12px">
      <input class="field" id="niName2" placeholder="Nombre del proyecto" maxlength="120" autocomplete="off">
    </div>
    <div class="modal-foot">
      <button class="btn" data-x>Cancelar</button>
      <button class="btn btn-primary" id="niOk2">Crear</button>
    </div>`;
  const inp = m.querySelector('#niName2');
  const ok = async () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    closeModal();
    const r = await api.createInitiative(name, color).catch(() => null);
    if (r && r.id) {
      STATE.initiatives.unshift(r);
      renderSidebar();
      onCreated(r.id);
    } else { toast('err', 'No se pudo crear el proyecto'); onCreated(null); }
  };
  m.querySelector('#niOk2').onclick = ok;
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { closeModal(); onCreated(null); });
  openModal(m);
  setTimeout(() => inp.focus(), 50);
}

async function doImport(btn) {
  btn.classList.add('is-loading');
  try {
    let initId = STATE.selInit || (STATE.transcript && STATE.transcript.initiative_id) || null;
    if (!initId) {
      btn.classList.remove('is-loading');
      initId = await _pickInitiativeForImport();
      if (!initId) return;
      btn.classList.add('is-loading');
    }
    const r = await api.importMediaMultiple(initId);
    if (r && r.error) { toast('err', errMsg(r.error, 'No se pudo importar el archivo')); }
    else if (r && r.cancelled) { /* usuario cerró el diálogo */ }
    else if (r && r.ok) {
      toast('info', `Registrando ${r.count} video${r.count !== 1 ? 's' : ''}…`);
      await refreshMeetings(initId);
      try { renderBgJobs(await api.getBackgroundJobs()); } catch { /* sin jobs */ }
      toast('ok', `${r.count} video${r.count !== 1 ? 's' : ''} importado${r.count !== 1 ? 's' : ''} · transcribiendo en 2.º plano`);
    }
  } catch { toast('err', 'Error al importar'); }
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

function _nowDateShort() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}
function startMeetingRecording() {
  if (STATE.appState !== 'idle') return;
  // Sin proyecto: modal para elegir/crear uno y volver a intentar la grabación
  if (!STATE.selInit) { pickInitiativeModal((iid) => { selectInitiative(iid); startMeetingRecording(); }); return; }
  formModal('Nueva reunión', 'Título de la reunión', _nowDateShort(), 'Empezar a grabar', beginMeetingRecording);
}
async function beginMeetingRecording(title) {
  if (!STATE.selInit) { toast('err', 'Selecciona un proyecto antes de grabar'); return; }
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
  // La reunión recién creada aparece ya en el árbol (con su spinner de grabación).
  await refreshMeetings(STATE.selInit);
}
async function toggleMeetingMic() {
  const next = !STATE.meetingMicMuted;
  const r = await api.toggleMeetingMicMute(next);
  if (!r || r.ok === false) { toast('err', errMsg(r && r.error, 'No se pudo cambiar el micrófono')); return; }
  STATE.meetingMicMuted = next;
  renderActionBar();
  toast('info', next ? 'Tu micrófono está silenciado' : 'Tu micrófono está activo');
}
async function stopMeetingRecording() {
  stopTimer();
  try {
    const r = await api.stopRecording();
    const stoppedId = r && r.meeting_id;
    STATE.screen = STATE.selInit ? 'initiative' : 'welcome';
    setAppState('idle');
    await refreshMeetings(STATE.selInit);
    if (r && r.ok) {
      toast('ok', 'Grabación detenida · se transcribe en segundo plano');
      // Modal opcional para renombrar la reunión
      if (stoppedId) {
        const ts = _nowDateShort();
        const mtg = (STATE.meetingsByInit[STATE.selInit] || []).find(m => m.id === stoppedId);
        const curTitle = (mtg && mtg.title) || ts;
        // Se muestra como en las listas ("mié 08 Jul"); si no se toca, no se renombra
        const shown = mtg ? _fmtMeetingLabel(mtg) : curTitle;
        formModal('Nombrar la reunión', 'Título (opcional)', shown, 'Guardar nombre', async (title) => {
          title = (title || '').trim();
          if (!title || title === shown || title === curTitle) return;
          await api.renameMeeting(stoppedId, title);
          for (const k in STATE.meetingsByInit) {
            const m = STATE.meetingsByInit[k].find(x => x.id === stoppedId);
            if (m) m.title = title;
          }
          renderSidebar(); renderMain();
          toast('ok', 'Reunión renombrada');
        });
      }
    } else {
      toast('err', errMsg(r && r.error, 'No se pudo finalizar la reunión'));
    }
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
  STATE.recElapsed = 0; STATE.screenPanelCollapsed = false;
  STATE.screenRecording = false; STATE.screenMeetingId = null; STATE.screenPanelName = '';
  // Inicia como OBS: fuente a pantalla completa, con tiradores sobre el borde.
  STATE.screenTransform = { x: 0, y: 0, w: 1, h: 1 };
  // Asegurar que monitorIdx apunte a un monitor real (mss.monitors[0] = pantalla virtual)
  if (!STATE.monitors.find(x => x.index === STATE.monitorIdx)) {
    STATE.monitorIdx = STATE.monitors.length ? STATE.monitors[0].index : 1;
  }
  // Cargar miniaturas para el selector visual
  try {
    const thumbs = await api.getMonitorThumbnails();
    if (thumbs && thumbs.length) {
      STATE.monitorThumbnails = thumbs.reduce((acc, t) => { acc[t.index] = t.thumbnail; return acc; }, {});
      const freshMons = thumbs.map(t => ({ index: t.index, left: t.left, top: t.top, width: t.width, height: t.height }));
      STATE.monitors = freshMons;
      if (!STATE.monitors.find(x => x.index === STATE.monitorIdx)) {
        STATE.monitorIdx = STATE.monitors[0].index;
      }
    }
  } catch (_) {}
  const r = await api.startScreenPreview(STATE.monitorIdx);
  if (!r || r.ok === false) { toast('err', errMsg(r && r.error, 'No se pudo abrir la vista previa')); return; }
  if (r.recording) {
    STATE.screenMeetingId = r.meeting_id || null;
    STATE.screenRecording = true;
    setAppState('screen-recording');
    startTimer();
    return;
  }
  showScreenPanel();
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Aspecto del lienzo de salida = aspecto del monitor elegido.
function screenCanvasAspect() {
  const mon = (STATE.monitors || []).find(x => x.index === STATE.monitorIdx) || (STATE.monitors || [])[0];
  return (mon && mon.width && mon.height) ? (mon.width / mon.height) : (16 / 9);
}

function showScreenPanel() {
  STATE.screenPanelOpen = true;
  const recording = !!STATE.screenRecording;
  const t = STATE.screenTransform || { x: 0, y: 0, w: 1, h: 1 };
  const micIcon = () => svg(STATE.micMuted ? 'headerMicOff' : 'headerMic', 15);
  const micLabel = () => STATE.micMuted ? 'Activar micro' : 'Silenciar micro';
  const m = el('div', 'modal screen-panel');
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', recording ? 'Grabando pantalla' : 'Preparar grabación');

  const head = recording
    ? `<span class="rec-badge"><span class="rdot"></span>REC</span><span class="rec-clock" id="screenClock">${fmt(STATE.recElapsed)}</span>`
    : '';
  const sourceStyle = `left:${t.x * 100}%;top:${t.y * 100}%;width:${t.w * 100}%;height:${t.h * 100}%`;
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    .map(h => `<span class="obs-h obs-${h}" data-h="${h}"></span>`).join('');
  const moveIcon = `<span class="obs-move-icon" title="Arrastra para mover">⠿</span>`;
  const canvas = `
    <div class="obs-canvas" id="obsCanvas" style="aspect-ratio:${screenCanvasAspect()}">
      ${recording ? '' : `<div class="obs-dim" id="obsDim"></div><div class="obs-source" id="obsSource" style="${sourceStyle}">${handles}${moveIcon}</div>`}
      ${recording ? '<span class="obs-tag">grabando · composición final</span>' : ''}
    </div>`;
  const resetBtn = !recording ? `<button class="btn btn-xs" id="scReset" title="Restablecer a pantalla completa" style="margin-left:auto;font-size:11px">Pantalla completa</button>` : '';
  const controls = recording
    ? `<button class="btn btn-stop" id="scStop"><span class="sq"></span>Detener vídeo</button>
       <button class="btn btn-lg ${STATE.micMuted ? 'btn-danger' : ''}" id="scMic">${micIcon()}${micLabel()}</button>
       <button class="btn btn-lg" id="scCap">${svg('camera', 15)}Captura</button>
       <button class="btn btn-lg" id="scNote">${svg('note', 15)}Nota</button>`
    : `<button class="btn btn-record" id="scStart"><span class="dot"></span>Iniciar grabación</button>
       <button class="btn btn-lg ${STATE.micMuted ? 'btn-danger' : ''}" id="scMic">${micIcon()}${micLabel()}</button>
       <button class="btn btn-ghost" id="scCancel">Cancelar</button>`;

  // Selector de monitores (miniaturas compactas para el dropdown)
  const thumbs = STATE.monitorThumbnails || {};
  const THUMB_H = 50;
  const monPicker = (STATE.monitors.length ? STATE.monitors : []).map(mo => {
    const ar = mo.width && mo.height ? mo.width / mo.height : 16 / 9;
    const tw = Math.round(THUMB_H * ar);
    const b64 = thumbs[mo.index] || '';
    const sel = mo.index === STATE.monitorIdx;
    const bg = b64 ? `background-image:url('data:image/jpeg;base64,${b64}')` : '';
    return `<button type="button" class="mon-thumb${sel ? ' is-sel' : ''}" data-midx="${mo.index}" title="Pantalla ${mo.index} · ${mo.width}×${mo.height}" aria-pressed="${sel ? 'true' : 'false'}">
      <div class="mon-thumb-screen" style="width:${tw}px;height:${THUMB_H}px;${bg}"></div>
      <span class="mon-thumb-label">Pantalla ${mo.index}<br><span class="mon-thumb-res">${mo.width}×${mo.height}</span></span>
    </button>`;
  }).join('');
  const selectedMonitor = STATE.monitors.find(mo => mo.index === STATE.monitorIdx);
  const selectedLabel = selectedMonitor
    ? `Pantalla ${selectedMonitor.index} · ${selectedMonitor.width}×${selectedMonitor.height}`
    : 'Selecciona una pantalla';

  // Dropdown de selección de pantalla (disponible siempre, incluso durante grabación)
  const monDropHtml = monPicker
    ? `<div class="mon-dropdown" id="monDropdown">
        <button class="mon-dropdown-btn" id="monDropBtn" type="button" title="Cambiar pantalla">
          ${svg('monitor', 13)}<span id="monDropLabel">${esc(selectedLabel)}</span>${svg('chevronDown', 11)}
        </button>
        <div class="mon-dropdown-pop" id="monDropPop">
          <div class="mon-picker" id="monPicker">${monPicker}</div>
        </div>
      </div>`
    : '';

  m.innerHTML = `
    ${head ? `<div class="modal-head">${head}${recording ? '<button class="icon-btn sc-collapse-btn" id="scCollapse" aria-label="Minimizar panel" title="Minimizar panel (−)" style="margin-left:auto">−</button>' : ''}</div>` : ''}
    <div class="screen-setup">
      <input id="scName" class="field" placeholder="Ej. Demo cliente, revisión semanal..." autocomplete="off" value="${esc(STATE.screenPanelName || '')}">
      ${monDropHtml}
    </div>
    ${canvas}
    <div style="padding:10px 20px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      ${controls}${resetBtn}
    </div>`;

  if (!recording) {
    const scReset = m.querySelector('#scReset');
    if (scReset) scReset.onclick = () => {
      STATE.screenTransform = { x: 0, y: 0, w: 1, h: 1 };
      applyObsSource(); pushTransform();
    };
  }

  // Dropdown de pantallas: disponible siempre (pre-grabación Y durante grabación)
  {
    const dropdown = m.querySelector('#monDropdown');
    const dropBtn  = m.querySelector('#monDropBtn');
    if (dropBtn && dropdown) {
      dropBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('is-open');
      });
      const closeOutside = (e) => {
        if (!dropdown.isConnected) { document.removeEventListener('click', closeOutside); return; }
        if (!dropdown.contains(e.target)) dropdown.classList.remove('is-open');
      };
      document.addEventListener('click', closeOutside);
    }

    m.querySelector('#monPicker')?.addEventListener('click', (e) => {
      const card = e.target.closest('.mon-thumb');
      if (!card) return;
      const idx = +card.dataset.midx;
      dropdown?.classList.remove('is-open');
      if (idx === STATE.monitorIdx) return;
      STATE.monitorIdx = idx;
      m.querySelectorAll('.mon-thumb').forEach(c => {
        const isSelected = +c.dataset.midx === idx;
        c.classList.toggle('is-sel', isSelected);
        c.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      });
      const mon = STATE.monitors.find(mo => mo.index === idx);
      const labelEl = m.querySelector('#monDropLabel');
      if (labelEl && mon) labelEl.textContent = `Pantalla ${mon.index} · ${mon.width}×${mon.height}`;
      const cv = m.querySelector('#obsCanvas'); if (cv) cv.style.aspectRatio = screenCanvasAspect();
      const source = m.querySelector('#obsSource'); if (source) source.style.backgroundImage = 'none';
      if (recording) {
        // Cambio en caliente: actualiza la grabación y el preview simultáneamente
        api.setScreenMonitor(STATE.monitorIdx);
        api.setScreenPreviewMonitor(STATE.monitorIdx);
        toast('ok', `Grabando Pantalla ${idx}`);
      } else {
        api.setScreenPreviewMonitor(STATE.monitorIdx);
      }
    });
  }
  m.querySelector('#scName').oninput = (e) => { STATE.screenPanelName = e.target.value; };
  m.querySelector('#scName').onblur = (e) => {
    const v = e.target.value.trim();
    if (v && recording && STATE.screenMeetingId) api.renameMeeting(STATE.screenMeetingId, v);
  };
  m.querySelector('#scMic').onclick = () => {
    STATE.micMuted = !STATE.micMuted;
    if (recording) api.toggleScreenMicMute(STATE.micMuted);
    const btn = m.querySelector('#scMic');
    btn.innerHTML = `${micIcon()}${micLabel()}`;
    btn.classList.toggle('btn-danger', STATE.micMuted);
  };
  if (recording) {
    m.querySelector('#scStop').onclick = stopScreenRecording;
    m.querySelector('#scCap').onclick = () => api.takeCapture(STATE.monitorIdx).then(() => toast('ok', 'Captura guardada'));
    m.querySelector('#scNote').onclick = () => promptNote();
    m.querySelector('#scCollapse').onclick = () => {
      STATE.screenPanelCollapsed = true;
      $('#overlayRoot').hidden = true;
      renderActionBar();
    };
  } else {
    m.querySelector('#scStart').onclick = startScreenFromPanel;
    m.querySelector('#scCancel').onclick = cancelScreenPanel;
    wireObsCanvas(m.querySelector('#obsCanvas'));
  }
  const root = $('#overlayRoot'); root.replaceChildren(m); root.hidden = false;
  // Inicializar la máscara DESPUÉS de insertar en el DOM (getElementById necesita el documento)
  if (!recording) applyObsSource();
  root.onclick = (e) => {
    if (e.target !== root) return;
    if (recording) { STATE.screenPanelCollapsed = true; root.hidden = true; renderActionBar(); }
    else { api.stopScreenPreview(); STATE.screenPanelOpen = false; root.hidden = true; root.replaceChildren(); }
  };
}

function applyObsSource() {
  const s = document.getElementById('obsSource');
  if (!s) return;
  const t = STATE.screenTransform;
  s.style.left = (t.x * 100) + '%'; s.style.top = (t.y * 100) + '%';
  s.style.width = (t.w * 100) + '%'; s.style.height = (t.h * 100) + '%';
}
let _txTimer;
function pushTransform() {
  clearTimeout(_txTimer);
  const t = STATE.screenTransform;
  _txTimer = setTimeout(() => api.setScreenTransform(t.x, t.y, t.w, t.h), 60);
}

// Redimensionar arrastrando cualquier borde/esquina + mover desde el centro (estilo OBS).
function wireObsCanvas(canvas) {
  if (!canvas) return;
  const source = canvas.querySelector('#obsSource');
  if (!source) return;
  const MIN = 0.05;
  const EDGE = 18; // px: zona de borde donde el cursor cambia a resize
  let mode = null, handle = null, sx = 0, sy = 0, orig = null;

  // Detecta si el puntero está en el borde del recuadro y devuelve la dirección ('n','se',…)
  function edgeAt(e) {
    const r = source.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    const nW = lx < EDGE, nE = lx > r.width - EDGE;
    const nN = ly < EDGE, nS = ly > r.height - EDGE;
    if (!nW && !nE && !nN && !nS) return null;
    return (nN ? 'n' : nS ? 's' : '') + (nW ? 'w' : nE ? 'e' : '');
  }

  const CURSORS = { n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize',
                    nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize' };

  function doMove(e) {
    if (!mode) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = (e.clientX - sx) / rect.width;
    const dy = (e.clientY - sy) / rect.height;
    let { x, y, w, h } = orig;
    if (mode === 'move') {
      x = clamp(orig.x + dx, 0, 1 - w);
      y = clamp(orig.y + dy, 0, 1 - h);
    } else if (handle) {
      if (handle.includes('e')) w = clamp(orig.w + dx, MIN, 1 - orig.x);
      if (handle.includes('s')) h = clamp(orig.h + dy, MIN, 1 - orig.y);
      if (handle.includes('w')) { const nx = clamp(orig.x + dx, 0, orig.x + orig.w - MIN); w = orig.w + (orig.x - nx); x = nx; }
      if (handle.includes('n')) { const ny = clamp(orig.y + dy, 0, orig.y + orig.h - MIN); h = orig.h + (orig.y - ny); y = ny; }
    }
    STATE.screenTransform = { x, y, w, h };
    applyObsSource();
  }

  // Con setPointerCapture los eventos pointermove/pointerup llegan siempre a source,
  // incluso cuando el puntero sale del elemento — no se necesitan listeners en window.
  source.addEventListener('pointermove', (e) => {
    if (!mode) {
      const hn = e.target.closest('.obs-h');
      const dir = hn ? hn.dataset.h : edgeAt(e);
      source.style.cursor = dir ? (CURSORS[dir] || 'nwse-resize') : 'move';
    } else {
      doMove(e);
    }
  });

  source.addEventListener('pointerup', (e) => {
    if (!mode) return;
    mode = null; handle = null;
    source.style.cursor = 'move';
    try { source.releasePointerCapture(e.pointerId); } catch (_) {}
    pushTransform();
  });

  source.addEventListener('pointercancel', () => { mode = null; handle = null; source.style.cursor = 'move'; });

  source.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const hn = e.target.closest('.obs-h');
    if (hn) {
      mode = 'resize'; handle = hn.dataset.h;
    } else {
      const dir = edgeAt(e);
      mode = dir ? 'resize' : 'move';
      handle = dir || null;
    }
    sx = e.clientX; sy = e.clientY; orig = { ...STATE.screenTransform };
    e.preventDefault();
    try { source.setPointerCapture(e.pointerId); } catch (_) {}
  });
}

async function startScreenFromPanel() {
  // Sin proyecto elegido: modal para seleccionar o crear uno y, al hacerlo,
  // la grabación arranca sola (el modal reemplaza al panel; closeModal lo restaura).
  if (!STATE.selInit) {
    STATE.screenPanelName = (document.getElementById('scName')?.value || '').trim();
    pickInitiativeModal((iid) => {
      STATE.selInit = iid;
      renderSidebar();
      const nm = document.getElementById('scName');
      if (nm && STATE.screenPanelName) nm.value = STATE.screenPanelName;
      startScreenFromPanel();
    });
    return;
  }
  const name = (document.getElementById('scName')?.value || '').trim() || STATE.screenPanelName || '';
  const t = STATE.screenTransform;
  await api.setScreenTransform(t.x, t.y, t.w, t.h);  // colocación elegida
  const r = await api.startScreenRecording(STATE.selInit, STATE.monitorIdx);
  if (!r || r.ok === false) { toast('err', errMsg(r && r.error, 'No se pudo iniciar la grabación')); return; }
  STATE.screenMeetingId = r.meeting_id || null;
  STATE.micMuted = !!r.mic_muted;
  STATE.screenRecording = true;
  if (name && STATE.screenMeetingId) api.renameMeeting(STATE.screenMeetingId, name);
  startTimer();
  setAppState('screen-recording');
  showScreenPanel();  // re-render en modo grabación
  // La reunión recién creada aparece ya en el árbol (con su spinner de grabación).
  await refreshMeetings(STATE.selInit);
}

async function cancelScreenPanel() {
  STATE.screenPanelOpen = false;
  try { await api.stopScreenPreview(); } catch (e) { /* nada */ }
  closeModal();
  setAppState('idle');
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
    toast('info', 'Guardando video…');
    await refreshMeetings(STATE.selInit);
  } else {
    toast('err', errMsg(res && res.error, 'No se pudo detener la grabación'));
  }
}
// El vídeo terminó de guardarse/mezclarse en segundo plano.
window.onScreenVideoSaved = async function (meetingId, initiativeId, ok, audio) {
  if (initiativeId && STATE.meetingsByInit[initiativeId] !== undefined) {
    await refreshMeetings(initiativeId);
  } else if (STATE.selInit) {
    await refreshMeetings(STATE.selInit);
  }
  if (ok) {
    const msg = audio === false ? 'Vídeo guardado (sin sonido)' : 'Vídeo añadido a Archivos';
    toast(audio === false ? 'info' : 'ok', msg, 'Ver archivo', () => {
      if (meetingId) {
        openMeeting(meetingId);
        STATE.activeTab = 'archivos';
        renderMain();
      }
    });
  } else {
    toast('err', 'No se pudo guardar el vídeo');
  }
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
   7e. Proyectos/reuniones V2 (archivar/eliminar)
   ============================================================ */
function _afterRemoveFromTree(iid) {
  // Si el proyecto abierta se archivó/eliminó, volver a la bienvenida.
  if (iid && STATE.selInit === iid) { STATE.selInit = null; STATE.selMeeting = null; STATE.screen = 'welcome'; }
}
async function toggleInitiativePin(iid) {
  const r = await api.toggleInitiativePin(iid);
  if (!r || !r.ok) { toast('err', 'No se pudo anclar el proyecto'); return; }
  STATE.initiatives = await api.listInitiatives() || [];   // reordena: ancladas arriba
  renderSidebar();
  toast('ok', r.pinned ? 'Proyecto anclado' : 'Proyecto desanclado');
}
function archiveInitiative(iid) {
  confirmModal('Archivar proyecto', 'Se moverá al Archivo. Podrás restaurarla cuando quieras.', 'Archivar', async () => {
    const r = await api.archiveItem('initiative', iid);
    if (r && r.ok === false) { toast('err', errMsg(r.error, 'No se pudo archivar')); return; }
    toast('ok', 'Proyecto archivado'); _afterRemoveFromTree(iid); STATE.initiatives = await api.listInitiatives() || []; renderSidebar(); renderMain(); updateLibraryCounts();
  }, false);
}
function deleteInitiative(iid) {
  archiveInitiative(iid);
}

/* ---- Tour inicial (spotlight style) ---- */
const TOUR_KEY = 'hm.tour.v2';
function showInitialTourIfNeeded(force) {
  if (!force && load(TOUR_KEY, '') === '1') return;
  if (document.querySelector('.setup-overlay') || document.getElementById('initialTour')) return;
  if (document.body.classList.contains('licensing')) return;   // nunca sobre la pantalla de licencia
  STATE.sidebarOpen = true;
  applySidebar();
  renderActionBar();

  // 4 pasos: los más importantes de la app
  const steps = [
    {
      sel: '#navInitiatives', icon: 'folder', color: '#aacfbf',
      title: 'Proyectos',
      text: 'Organiza aquí cada cliente o proyecto. Todo su historial de reuniones queda en un solo lugar.',
    },
    {
      sel: '#abRecord', icon: 'mic', color: '#ff7a82',
      title: 'Graba reuniones',
      text: 'Un clic y Helpmeet escucha, transcribe en tiempo real y genera un resumen automático al terminar.',
    },
    {
      sel: '#abScreen', icon: 'monitorDot', color: '#7eb8ff',
      title: 'Captura videollamadas',
      text: 'Graba lo que ocurre en tu pantalla: Meet, Zoom, Teams. Helpmeet transcribe y archiva todo.',
    },
    {
      sel: null, icon: 'rocket', color: '#aacfbf',
      title: '¡Todo listo para empezar!',
      text: 'Crea tu primer proyecto y empieza a grabar. Helpmeet se encarga del resto.',
    },
  ];

  let idx = 0;
  const root = el('div', 'initial-tour');
  root.id = 'initialTour';
  root.innerHTML = `
    <div class="tour-spotlight" id="tourSpot"></div>
    <div class="tour-card" id="tourCard" role="dialog" aria-modal="true" aria-live="polite">
      <div class="tour-icon-ring" id="tourRing"></div>
      <div class="tour-dots" id="tourDots"></div>
      <h3 id="tourTitle"></h3>
      <p id="tourBody"></p>
      <div class="tour-actions">
        <button class="tour-skip" id="tourSkip">Omitir tour</button>
        <button class="tour-next" id="tourNext"></button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const spotEl  = document.getElementById('tourSpot');
  const cardEl  = document.getElementById('tourCard');
  const ringEl  = document.getElementById('tourRing');
  const dotsEl  = document.getElementById('tourDots');
  const titleEl = document.getElementById('tourTitle');
  const bodyEl  = document.getElementById('tourBody');
  const nextBtn = document.getElementById('tourNext');

  const finish = (startProject) => {
    save(TOUR_KEY, '1');
    document.querySelectorAll('.tour-target').forEach(n => n.classList.remove('tour-target'));
    root.classList.add('tour-out');
    setTimeout(() => { root.remove(); if (startProject) document.getElementById('btnNewInitiative')?.click(); }, 300);
  };

  const placeCard = (target) => {
    const CW = 308, CH = 260, PAD = 10;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (!target) {
      spotEl.style.display = 'none';
      cardEl.style.cssText += ';top:50%;left:50%;transform:translate(-50%,-50%)';
      return;
    }
    const r = target.getBoundingClientRect();
    spotEl.style.cssText = `display:block;top:${r.top - PAD}px;left:${r.left - PAD}px;width:${r.width + PAD * 2}px;height:${r.height + PAD * 2}px`;
    const below = vh - r.bottom, above = r.top, right = vw - r.right, left = r.left;
    let top, lft;
    if (below >= CH + 18) {
      top = r.bottom + 16; lft = clamp(r.left + r.width / 2 - CW / 2, 14, vw - CW - 14);
    } else if (above >= CH + 18) {
      top = r.top - CH - 16; lft = clamp(r.left + r.width / 2 - CW / 2, 14, vw - CW - 14);
    } else if (right >= CW + 18) {
      top = clamp(r.top + r.height / 2 - CH / 2, 14, vh - CH - 14); lft = r.right + 16;
    } else {
      top = clamp(r.top + r.height / 2 - CH / 2, 14, vh - CH - 14); lft = Math.max(14, r.left - CW - 16);
    }
    cardEl.style.cssText = `top:${top}px;left:${lft}px;transform:none`;
  };

  const render = (animate) => {
    const step = steps[idx];
    const isLast = idx === steps.length - 1;

    document.querySelectorAll('.tour-target').forEach(n => n.classList.remove('tour-target'));

    dotsEl.innerHTML = steps.map((_, i) => `<span class="tour-dot${i === idx ? ' is-on' : ''}"></span>`).join('');
    ringEl.innerHTML = `<span style="color:${step.color}">${svg(step.icon, 24)}</span>`;
    ringEl.style.background = step.color + '1e';
    ringEl.style.borderColor = step.color + '45';
    titleEl.textContent = step.title;
    bodyEl.textContent = step.text;
    nextBtn.textContent = isLast ? '¡Crear mi primer proyecto!' : 'Siguiente →';

    const target = step.sel ? document.querySelector(step.sel) : null;
    if (target) target.classList.add('tour-target');
    placeCard(target);
  };

  const nextStep = () => {
    if (idx >= steps.length - 1) { finish(true); return; }
    cardEl.classList.add('tour-step-out');
    setTimeout(() => {
      cardEl.classList.remove('tour-step-out');
      cardEl.style.animation = 'none';
      void cardEl.offsetWidth;
      cardEl.style.animation = '';
      idx++;
      render(true);
    }, 160);
  };

  document.getElementById('tourSkip').onclick = () => finish(false);
  nextBtn.onclick = nextStep;
  root.addEventListener('click', (e) => { if (e.target === root) finish(false); });

  setTimeout(() => render(false), 100);
}
function archiveMeeting(mid) {
  confirmModal('Archivar reunión', 'Se moverá al Archivo. Podrás restaurarla.', 'Archivar', async () => {
    const r = await api.archiveItem('meeting', mid);
    if (r && r.ok === false) { toast('err', errMsg(r.error, 'No se pudo archivar')); return; }
    toast('ok', 'Reunión archivada'); if (STATE.selMeeting === mid) backToTree(); refreshAll(); updateLibraryCounts();
  }, false);
}
function deleteMeeting(mid) {
  archiveMeeting(mid);
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
// Activa/desactiva el spinner en las reuniones de la barra lateral según el
// progreso en vivo, sin reconstruir el árbol (la animación no parpadea).
function refreshSidebarJobs() {
  document.querySelectorAll('.tree-meeting[data-mid]').forEach(mr => {
    const rec = meetingIsRecording(mr.dataset.mid);
    mr.classList.toggle('recording', rec);
    mr.classList.toggle('transcribing', !rec && meetingIsTranscribing(mr.dataset.mid));
  });
  document.querySelectorAll('.tree-initiative[data-iid]').forEach(row => {
    const ms = STATE.meetingsByInit[row.dataset.iid] || [];
    const hasRec = ms.some(m => meetingIsRecording(m.id));
    const hasTrans = !hasRec && ms.some(m => meetingIsTranscribing(m.id));
    row.classList.toggle('has-recording', hasRec);
    row.classList.toggle('has-transcribing', hasTrans);
  });
}

function renderBgJobs(jobs) {
  STATE.bgJobs = Array.isArray(jobs) ? jobs : [];
  refreshMeetingTitleJob();
  refreshSidebarJobs();
  // Eliminar tarjeta flotante si quedó de una sesión anterior
  const host = document.getElementById('bgJobs'); if (host) host.remove();
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
  if (!b64) return;
  const url = 'url(data:image/jpeg;base64,' + b64 + ')';
  const canvas = document.getElementById('obsCanvas');
  if (canvas) {
    const source = document.getElementById('obsSource');
    if (source) {
      canvas.style.backgroundImage = 'none';
      source.style.backgroundImage = url;
      source.style.backgroundSize = '100% 100%';
      source.style.backgroundPosition = 'center';
      source.style.backgroundRepeat = 'no-repeat';
    } else {
      canvas.style.backgroundImage = url;
      canvas.style.backgroundSize = 'contain';
      canvas.style.backgroundPosition = 'center';
      canvas.style.backgroundRepeat = 'no-repeat';
    }
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
  m.querySelector('[data-rec]').onclick = async () => {
    closeModal();
    if (!v2Available('recover_recording')) { toast('err', 'Recuperación no disponible'); return; }
    const r = await api.v2.recoverRecording(rec.id);
    if (!r || !r.ok) { toast('err', errMsg(r && r.error, 'No se pudo recuperar la grabación')); return; }
    try { renderBgJobs(await api.getBackgroundJobs()); } catch (e) {}
    if (r.meeting_id) {
      // Reunión conocida: navegar directo a ella (ya tiene video_path)
      if (r.initiative_id) STATE.selInit = r.initiative_id;
      await refreshMeetings(r.initiative_id || STATE.selInit);
      await openMeeting(r.meeting_id, false);
      toast('ok', 'Vídeo recuperado — usa "Transcribir este vídeo" para obtener el texto');
    } else {
      // Sin reunión vinculada (crash antiguo): el vídeo quedó en carpeta «Recuperados»
      toast('info', 'Vídeo guardado en carpeta «Recuperados». Ábrela con el ícono de carpeta, luego usa «Importar vídeo y transcribir» en la reunión que quieras.');
    }
  };
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
  const m = el('div', 'modal wide diagnostics-modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Diagnóstico del sistema');
  m.innerHTML = `
    <div class="modal-head"><h3>${svg('check', 16)} Diagnóstico</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div class="diag-summary" id="diagSummary">
        <span class="diag-summary-dot"></span>
        <div><b>Comprobando equipo</b><span>Validando requisitos principales</span></div>
      </div>
      <div id="diagList" class="diag-list"><p style="color:var(--text-muted);font-size:13px">Comprobando…</p></div>
      <div class="diag-actions"><button class="btn" id="diagFolder">Cambiar carpeta</button><button class="btn" id="diagReload">Comprobar otra vez</button></div>
    </div>`;
  m.querySelector('[data-x]').onclick = closeModal;
  const listEl = m.querySelector('#diagList');
  const summaryEl = m.querySelector('#diagSummary');
  const compactDetail = (label, info) => {
    const raw = String((info && (info.label || info.detail)) || 'No disponible');
    if (/carpeta/i.test(label)) return raw.split(/[\\/]/).slice(-2).join('\\') || raw;
    if (/procesamiento/i.test(label)) return raw.includes('local') ? 'Local, en este equipo' : raw.split('.')[0];
    if (/modelo/i.test(label)) return raw.replace(/^Modelo\s*/i, '').replace(/descargado/i, 'listo').trim();
    if (/micr[oó]fono|audio/i.test(label)) return raw.replace(/\s*\([^)]*\)/g, '').replace(/^Audio del sistema:\s*/i, '');
    if (/ventana/i.test(label)) return raw.replace(/^WebView2\s*/i, '');
    return raw;
  };
  async function loadDiag() {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Comprobando…</p>';
    summaryEl.className = 'diag-summary';
    summaryEl.innerHTML = '<span class="diag-summary-dot"></span><div><b>Comprobando equipo</b><span>Validando requisitos principales</span></div>';
    const d = await api.getDiagnostics() || {};
    const rows = [
      ['WebView2', d.webview2],
      ['Espacio en disco', d.disk],
      ['Modelo', d.whisper],
      ['Micrófono', d.mic],
      ['Sistema', d.loopback],
      ['Exportación', d.export_dir],
      ['Procesamiento', d.processing],
    ];
    listEl.replaceChildren();
    const okCount = rows.filter(([, info]) => (info && info.status) === 'ok').length;
    const errorCount = rows.filter(([, info]) => (info && info.status) === 'error').length;
    const warnCount = rows.length - okCount - errorCount;
    summaryEl.classList.toggle('has-error', errorCount > 0);
    summaryEl.classList.toggle('has-warn', !errorCount && warnCount > 0);
    summaryEl.innerHTML = `<span class="diag-summary-dot"></span><div><b>${errorCount ? 'Revisa ' + errorCount + ' punto' + (errorCount > 1 ? 's' : '') : okCount + '/' + rows.length + ' listo'}</b><span>${errorCount ? 'Hay requisitos que necesitan atención' : warnCount ? 'Puedes grabar, con avisos menores' : 'Equipo listo para grabar y transcribir'}</span></div>`;
    rows.forEach(([label, info]) => {
      info = info || { status: 'warn', label: 'No disponible' };
      const ico = info.status === 'ok' ? svg('check', 14) : info.status === 'error' ? svg('x', 14) : svg('warn', 14);
      const row = el('div', 'diag-row ' + (info.status || 'warn'));
      const full = `${info.label || ''}${info.detail ? ' · ' + info.detail : ''}`;
      row.innerHTML = `<span class="diag-ico">${ico}</span><div class="diag-body"><div class="diag-label">${esc(label)}</div><div class="diag-detail" title="${esc(full)}">${esc(compactDetail(label, info))}</div></div>`;
      listEl.appendChild(row);
    });
  }
  m.querySelector('#diagReload').onclick = loadDiag;
  m.querySelector('#diagFolder').onclick = async () => { const r = await api.chooseExportDir(); if (r && r.ok) { toast('ok', 'Carpeta actualizada'); loadDiag(); } };
  openModal(m);
  loadDiag();
}

function openSettings() { STATE.screen = 'settings'; renderMain(); renderTopStatus(); }

function viewSettings() {
  const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
  const head = el('div', 'mhead');
  head.style.cssText = 'border-bottom:none';
  head.innerHTML = `<div class="mhead-row mhead-row--mid" style="max-width:1100px"><h1 class="page-title">Ajustes</h1></div>`;
  const content = el('div', 'content');
  const inner = el('div', 'sv-page');
  inner.style.maxWidth = '1100px';
  content.appendChild(inner);
  wrap.replaceChildren(head, content);

  (async () => {
    const s = await api.getSettings() || {};
    STATE.settings = s;
    const hasTx = v2Available('get_transcription_settings');
    let scfg = s;
    const sByLang = scfg.models_by_lang || {};

    inner.innerHTML = `
      <div class="sv-cards">
      <div class="sv-section sv-card">
        <div class="sv-sec-title">${svg('mic', 14)} Transcripción ${hasTx ? '<span class="privacy-badge"><i></i>Local</span>' : ''}</div>
        <div class="sv-row"><span class="sv-lbl">Idioma</span><div class="cfg-chips" id="svLangChips"></div></div>
        <div class="sv-row"><span class="sv-lbl">Modelo</span><div class="cfg-chips" id="svModelChips"></div></div>
        <label class="toggle-row" for="svDefaultMute" style="padding:10px 0 2px">
          <span>Micrófono silenciado al iniciar</span>
          <input type="checkbox" id="svDefaultMute" ${s.default_mic_muted ? 'checked' : ''}>
          <span class="toggle-ui" aria-hidden="true"><i></i></span>
        </label>
      </div>

      <div class="sv-col">
        <div class="sv-section sv-card">
          <div class="sv-sec-title">${svg('palette', 14)} Apariencia</div>
          <div class="sv-row">
            <span class="sv-lbl">Tema</span>
            <div id="svThemeChips" style="display:flex;gap:8px">
              <button class="cfg-chip" data-theme-opt="light">Claro</button>
              <button class="cfg-chip" data-theme-opt="dark">Oscuro</button>
            </div>
          </div>
        </div>

        <div class="sv-section sv-card">
          <div class="sv-sec-title">${svg('monitor', 14)} Grabación de pantalla</div>
          <div class="sv-row"><span class="sv-lbl">Calidad</span><div class="cfg-chips" id="svVideoChips"></div></div>
        </div>
      </div>

      <div class="sv-section sv-card sv-card--full">
        <div class="sv-sec-title">${svg('edit', 14)} Instrucciones para la IA</div>
        <textarea id="svAiInstr" class="obj-text sv-textarea" rows="8"
          placeholder="Instrucciones al inicio de cada exportación a Claude…">${esc(s.ai_instructions || '')}</textarea>
        <div class="sv-row-end">
          <button class="btn" id="svAiReset">Restablecer</button>
          <button class="btn btn-primary" id="svAiSave">Guardar</button>
        </div>
      </div>

      <div class="sv-section sv-card">
        <div class="sv-sec-title">${svg('folder', 14)} Carpeta de exportación</div>
        <div class="sv-row">
          <span class="sv-path mono">${esc(s.export_dir || '—')}</span>
          <button class="btn" id="svDir">Elegir…</button>
        </div>
      </div>

      <div class="sv-section sv-card" id="svLicSection">
        <div class="sv-sec-title">${svg('checkSquare', 14)} Licencia</div>
        <div class="sv-lic-rows">
          <div class="sv-row">
            <span class="sv-lbl">Estado</span>
            <span id="svLicStatus" style="color:var(--text-secondary)">Cargando…</span>
          </div>
          <div class="sv-row">
            <span class="sv-lbl">Plan</span>
            <span id="svLicPlan" style="color:var(--text-primary)">—</span>
          </div>
        </div>
        <div class="sv-row-end" style="margin-top:12px">
          <button class="sv-act sv-lic-deactivate" id="svLicDeactivate" style="display:none">
            ${svg('x', 11)} Desactivar en este dispositivo
          </button>
        </div>
      </div>

      <div class="sv-section sv-card sv-card--full">
        <div class="sv-sec-title">${svg('download', 14)} Actualizaciones</div>
        <div class="sv-upd-card">
          <div class="sv-upd-ico">${svg('download', 17)}</div>
          <div class="sv-upd-info">
            <div class="sv-upd-ver">Helpmeet <span class="mono">v${esc(STATE.version || '')}</span></div>
            <div class="sv-upd-status" id="svUpdStatus">Comprueba si hay una versión nueva disponible</div>
          </div>
          <button class="btn" id="svUpdCheck">Buscar actualizaciones</button>
        </div>
      </div>

      <div class="sv-section sv-section--actions sv-card--full">
        <button class="sv-act" id="svDiag">${svg('check', 13)} Diagnóstico</button>
        <button class="sv-act sv-act--danger" id="svWipe">${svg('trash', 13)} Borrar datos</button>
      </div>
      </div>`;

    function renderChips() {
      const langBox = inner.querySelector('#svLangChips');
      const modelBox = inner.querySelector('#svModelChips');
      if (!langBox || !modelBox) return;
      langBox.innerHTML = (scfg.languages || []).map(lg =>
        `<button class="cfg-chip ${lg.id === scfg.language ? 'on' : ''}" data-lang="${lg.id}">${esc(lg.label)}</button>`).join('');
      modelBox.innerHTML = (sByLang[scfg.language] || scfg.models || []).map(mo =>
        `<button class="cfg-chip ${mo.tier === scfg.tier ? 'on' : ''}" data-tier="${mo.tier}" title="${esc(mo.label)} · ${esc(mo.download)}">${esc(mo.id)}</button>`).join('');
      langBox.querySelectorAll('[data-lang]').forEach(b => b.onclick = async () => {
        if (b.dataset.lang === scfg.language) return;
        scfg = await api.v2.setTranscriptionSettings({ language: b.dataset.lang }) || scfg;
        renderChips(); toast('ok', `Idioma: ${scfg.language_label || b.dataset.lang}`);
      });
      modelBox.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
        if (b.dataset.tier === scfg.tier) return;
        scfg = await api.v2.setTranscriptionSettings({ tier: b.dataset.tier }) || scfg;
        renderChips(); toast('ok', `Modelo: ${scfg.model || b.dataset.tier}`);
      });
    }
    function renderVideoChips() {
      const box = inner.querySelector('#svVideoChips');
      if (!box) return;
      box.innerHTML = (scfg.video_profiles || []).map(vp =>
        `<button class="cfg-chip ${vp.id === scfg.video_profile ? 'on' : ''}" data-vprof="${vp.id}">${esc(vp.label)}</button>`).join('');
      box.querySelectorAll('[data-vprof]').forEach(b => b.onclick = async () => {
        if (b.dataset.vprof === scfg.video_profile) return;
        scfg = await api.v2.setTranscriptionSettings({ video_profile: b.dataset.vprof }) || scfg;
        renderVideoChips(); toast('ok', 'Calidad guardada');
      });
    }
    if (hasTx) { renderChips(); renderVideoChips(); }

    inner.querySelector('#svDefaultMute').onchange = async (e) => {
      STATE.micMuted = e.target.checked; updateMicChip();
      await api.v2.setTranscriptionSettings({ default_mic_muted: e.target.checked });
      toast('ok', e.target.checked ? 'Micrófono empieza silenciado' : 'Micrófono empieza activo');
    };
    inner.querySelector('#svAiSave').onclick = async () => { await api.setAiInstructions(inner.querySelector('#svAiInstr').value); toast('ok', 'Instrucciones guardadas'); };
    inner.querySelector('#svAiReset').onclick = async () => { const r = await api.setAiInstructions(''); inner.querySelector('#svAiInstr').value = (r && r.text) || ''; toast('ok', 'Restablecido'); };
    inner.querySelector('#svDir').onclick = async () => { const r = await api.chooseExportDir(); if (r && r.ok) { toast('ok', 'Carpeta actualizada'); openSettings(); } };
    inner.querySelector('#svDiag').onclick = () => openDiagnostics();
    // Apariencia: claro / oscuro cálido (persistido en hm.theme)
    const themeBox = inner.querySelector('#svThemeChips');
    if (themeBox) {
      const renderTheme = () => {
        const cur = load('hm.theme', 'light');
        themeBox.querySelectorAll('[data-theme-opt]').forEach(b =>
          b.classList.toggle('on', b.dataset.themeOpt === cur));
      };
      themeBox.querySelectorAll('[data-theme-opt]').forEach(b => b.onclick = () => {
        const v = b.dataset.themeOpt;
        save('hm.theme', v);
        if (v === 'dark') document.body.dataset.theme = 'dark';
        else delete document.body.dataset.theme;
        renderTheme();
        toast('ok', v === 'dark' ? 'Modo oscuro activado' : 'Modo claro activado');
      });
      renderTheme();
    }
    // Actualizaciones: comprueba bajo demanda; si hay versión nueva, el botón
    // pasa a "Descargar" y abre el enlace en el navegador.
    const updBtn = inner.querySelector('#svUpdCheck');
    const updStatus = inner.querySelector('#svUpdStatus');
    updBtn.onclick = async () => {
      updBtn.disabled = true; updBtn.textContent = 'Comprobando…';
      let u = null;
      try { u = await api.checkForUpdate(); } catch (e) { u = null; }
      if (u && u.available) {
        updStatus.textContent = `Nueva versión ${u.version} disponible`;
        updStatus.style.color = 'var(--accent)';
        updBtn.disabled = false;
        updBtn.textContent = `Descargar ${u.version}`;
        updBtn.classList.add('btn-primary');
        updBtn.onclick = () => api.openUrl(u.url);
      } else {
        updStatus.textContent = u ? 'Tienes la última versión' : 'No se pudo comprobar (¿sin internet?)';
        updBtn.disabled = false;
        updBtn.textContent = 'Buscar actualizaciones';
      }
    };
    // Sección licencia
    if (HAS_PYWEBVIEW()) {
      api.getLicenseInfo().then(info => {
        const stEl = inner.querySelector('#svLicStatus');
        const planEl = inner.querySelector('#svLicPlan');
        const btn = inner.querySelector('#svLicDeactivate');
        if (!stEl) return;
        if (info && info.active) {
          stEl.textContent = 'Activa';
          stEl.style.color = 'var(--accent)';
          planEl.textContent = info.plan || 'personal';
          btn.style.display = '';
          btn.onclick = () => confirmModal(
            'Desactivar licencia',
            'Se borrará la activación de este dispositivo. Necesitarás tu product key para volver a activar.',
            'Desactivar', async () => {
              await api.deactivateLicense();
              toast('ok', 'Licencia desactivada');
              showLicenseGate();
            }
          );
        } else {
          stEl.textContent = 'Sin licencia';
          planEl.textContent = '—';
        }
      });
    }

    inner.querySelector('#svWipe').onclick = () => {
      confirmModal('Borrar todos los datos',
        'Se borrarán TODOS tus datos locales: proyectos, reuniones, transcripciones, notas, capturas y ajustes. Tu carpeta de exportación NO se toca. Esta acción no se puede deshacer.',
        'Borrar todo', async () => {
          const r = await api.wipeAllData();
          if (r && r.ok) {
            toast('ok', 'Datos borrados');
            STATE.selInit = null; STATE.selMeeting = null; STATE.screen = 'welcome';
            STATE.meetingsByInit = {}; STATE.openInits = {}; STATE.transcript = null;
            STATE.initiatives = await api.listInitiatives() || [];
            await refreshAll(); renderSidebar(); renderMain();
          } else toast('err', 'No se pudieron borrar los datos');
        });
    };
  })();

  return wrap;
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
async function refreshMeetings(iid) { if (!iid) return; STATE.meetingsByInit[iid] = await api.listMeetings(iid) || []; renderSidebar(); if (STATE.screen === 'initiative') renderMain(); refreshSidebarJobs(); }

// ¿El backend trae el arranque único (P-06)? En el navegador (MOCK) siempre sí.
function bootstrapAvailable() {
  return !HAS_PYWEBVIEW() || typeof window.pywebview.api.get_bootstrap_state === 'function';
}

// Vuelca el estado de arranque (proyectos, reuniones, monitores y contadores)
// que llega en UNA sola llamada al backend.
function applyBootstrap(b) {
  STATE.initiatives = b.initiatives || [];
  STATE.meetingsByInit = {};
  const mbi = b.meetings_by_initiative || {};
  for (const it of STATE.initiatives) STATE.meetingsByInit[it.id] = mbi[it.id] || mbi[String(it.id)] || [];
  STATE.monitors = b.monitors || [];
  if (STATE.monitors.length) STATE.monitorIdx = STATE.monitors[0].index;  // índice real (1 = principal)
  const lc = b.library_counts || {};
  STATE.archiveCount = lc.archive || 0; STATE.trashCount = lc.trash || 0;
  const ac = $('#archiveCount'), tc = $('#trashCount');
  if (ac) ac.textContent = STATE.archiveCount; if (tc) tc.textContent = STATE.trashCount;
  if (b.version) { STATE.version = b.version; const ve = $('#headerVersion'); if (ve) ve.textContent = 'v' + b.version; }
  checkForUpdateOnce();
  if (b.default_mic_muted != null) { STATE.micMuted = !!b.default_mic_muted; updateMicChip(); }
  // Restaurar estado de grabación de pantalla si el backend la tenía activa
  if (b.screen_recording) {
    STATE.screenMeetingId = b.screen_meeting_id || null;
    STATE.screenRecording = true;
    setAppState('screen-recording');
    startTimer();
  }
}

// Aviso de actualización: consulta una sola vez por sesión, en segundo plano.
// Si hay versión nueva, el chip de versión del header se vuelve clicable y
// abre la descarga en el navegador. Sin internet: silencio total.
let _updateChecked = false;
async function checkForUpdateOnce() {
  if (_updateChecked) return;
  _updateChecked = true;
  let u = null;
  try { u = await api.checkForUpdate(); } catch (e) { return; }
  if (!u || !u.available) return;
  const ve = $('#headerVersion');
  if (ve) {
    ve.textContent = `v${u.current} · ⬆ ${u.version} disponible`;
    ve.classList.add('has-update');
    ve.title = `Nueva versión ${u.version} — clic para descargar`;
    ve.onclick = () => api.openUrl(u.url);
  }
  toast('info', `Nueva versión ${u.version} disponible — clic en la versión (arriba) para descargar`);
}

async function refreshAll() {
  if (bootstrapAvailable()) {
    try {
      const b = await api.getBootstrapState();
      if (b) {
        const mbi = b.meetings_by_initiative || {};
        for (const it of STATE.initiatives) STATE.meetingsByInit[it.id] = mbi[it.id] || mbi[String(it.id)] || [];
        renderSidebar();
        return;
      }
    } catch (e) { /* si falla, usa el camino antiguo de abajo */ }
  }
  for (const it of STATE.initiatives) STATE.meetingsByInit[it.id] = await api.listMeetings(it.id) || [];
  renderSidebar();
}

// Iconos SVG estilo Windows 11 para los controles de ventana
const WC_SVG = {
  min:     `<svg width="10" height="1" viewBox="0 0 10 1"><line x1="0" y1="0.5" x2="10" y2="0.5" stroke="currentColor" stroke-width="1"/></svg>`,
  max:     `<svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="0" fill="none" stroke="currentColor" stroke-width="1"/></svg>`,
  restore: `<svg width="11" height="11" viewBox="0 0 11 11"><rect x="2.5" y="0.5" width="8" height="8" rx="0" fill="none" stroke="currentColor" stroke-width="1"/><rect x="0.5" y="2.5" width="8" height="8" rx="0" fill="var(--bg-sidebar)" stroke="currentColor" stroke-width="1"/></svg>`,
  close:   `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.1"/><line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.1"/></svg>`,
};

function wireTopbar() {
  $('#btnRefreshSidebar').innerHTML = svg('refresh', 14);
  $('#btnNewInitiative').innerHTML = svg('plus', 14);
  // Iconos del botón "Nuevo proyecto" y del pie (los accesos van sin iconos)
  const _si = (sel, icon) => { const e = $(sel); if (e) e.innerHTML = svg(icon, 20); };
  _si('#btnNewProjectTop .np-ico', 'plus');
  _si('#btnArchive .sl-ico',   'archive');
  _si('#btnSettingsSide .sl-ico', 'settings');
  // Iconos del rail colapsado (mismo orden que el panel expandido)
  const _ri = (id, icon) => { const e = $(id); if (e) e.innerHTML = svg(icon, 17); };
  _ri('#railNew',         'plus');
  _ri('#railHome',        'home');
  _ri('#railFavorites',   'star');
  _ri('#railMeetings',    'calendar');
  _ri('#railDocs',        'folder');
  _ri('#railInitiatives', 'rocket');
  _ri('#railArchive',     'archive');
  _ri('#railSettings',    'settings');

  // Botón hamburguesa (como Gmail) → colapsar/expandir sidebar
  const menuBtn = $('#btnMenu');
  if (menuBtn) {
    menuBtn.innerHTML = svg('menu', 20);
    menuBtn.onclick = () => { STATE.sidebarOpen = !STATE.sidebarOpen; applySidebar(); };
  }
  // El logo/marca ya no alterna el panel (lo hace la hamburguesa)
  const brandEl = document.querySelector('.brand');
  if (brandEl) brandEl.onclick = null;

  $('#btnRefreshSidebar').onclick = async () => {
    const btn = $('#btnRefreshSidebar');
    if (btn.dataset.loading) return;
    btn.dataset.loading = '1';
    btn.classList.add('is-spinning');
    try {
      await api.syncInitiativesWithFolders();
      STATE.initiatives = await api.listInitiatives() || [];
      STATE.meetingsByInit = {};
      await refreshAll();
      renderSidebar();
      if (STATE.screen === 'initiatives-list') renderMain();
    } catch(e) {
      toast('err', 'Error al actualizar');
    } finally {
      delete btn.dataset.loading;
      btn.classList.remove('is-spinning');
    }
  };
  $('#btnNewInitiative').onclick = promptNewInitiative;
  if ($('#btnNewProjectTop')) $('#btnNewProjectTop').onclick = promptNewInitiative;
  if ($('#navHome')) $('#navHome').onclick = () => { STATE.screen = 'welcome'; STATE.selInit = null; STATE.selMeeting = null; renderSidebar(); renderMain(); renderTopStatus(); };
  if ($('#btnArchive')) $('#btnArchive').onclick = () => { STATE.screen = 'archive'; renderMain(); renderTopStatus(); };
  if ($('#btnTrash')) $('#btnTrash').onclick = () => { STATE.screen = 'trash'; renderMain(); };
  $('#btnSettingsSide').onclick = () => { STATE.screen = 'settings'; renderMain(); renderTopStatus(); };
  $('#railNew')?.addEventListener('click', promptNewInitiative);
  $('#railHome')?.addEventListener('click', () => { STATE.screen = 'welcome'; STATE.selInit = null; STATE.selMeeting = null; renderSidebar(); renderMain(); renderTopStatus(); });
  $('#railMeetings')?.addEventListener('click', () => { openMeetingsView(); });
  $('#railDocs')?.addEventListener('click', openDocsView);
  $('#railFavorites')?.addEventListener('click', () => { STATE.screen = 'favorites'; renderMain(); renderTopStatus(); });
  $('#railInitiatives')?.addEventListener('click', () => { STATE.screen = 'initiatives-list'; renderMain(); renderTopStatus(); });
  $('#railArchive')?.addEventListener('click', () => { STATE.screen = 'archive'; renderMain(); renderTopStatus(); });
  $('#railTrash')?.addEventListener('click', () => { STATE.screen = 'trash'; renderMain(); });
  $('#railSettings')?.addEventListener('click', () => { STATE.screen = 'settings'; renderMain(); renderTopStatus(); });
  // "Proyectos" es un acceso más (como Inicio/Documentos): solo navega.
  // El árbol de iniciativas queda siempre visible debajo.
  $('#navInitiativesToggle').onclick = () => {
    STATE.screen = 'initiatives-list';
    renderMain(); renderTopStatus();
  };
  $('#navMeetings').onclick = openMeetingsView;
  if ($('#navFavorites')) $('#navFavorites').onclick = () => { STATE.screen = 'favorites'; renderMain(); renderTopStatus(); };
  if ($('#navDocs')) $('#navDocs').onclick = openDocsView;

  // Controles de ventana frameless — iconos SVG estilo Win11
  const wcMin = $('#wcMin'), wcMax = $('#wcMax'), wcClose = $('#wcClose');
  if (wcMin) wcMin.innerHTML = WC_SVG.min;
  if (wcMax) wcMax.innerHTML = WC_SVG.max;
  if (wcClose) wcClose.innerHTML = WC_SVG.close;

  const updateMaxIcon = async () => {
    if (!wcMax) return;
    const r = await api.winIsMaximized().catch(() => ({ maximized: false }));
    wcMax.innerHTML = (r && r.maximized) ? WC_SVG.restore : WC_SVG.max;
  };

  if (wcMin) wcMin.onclick = () => api.winMinimize();
  if (wcMax) wcMax.onclick = async () => { await api.winMaximize(); setTimeout(updateMaxIcon, 80); };
  if (wcClose) wcClose.onclick = () => api.winClose();

  // Arrastre de ventana: solo desde el topbar, ignorando elementos interactivos
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    topbar.addEventListener('mousedown', async (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, a, [role="button"], .brand, .win-controls')) return;
      e.preventDefault();
      // Maximizada: al agarrarla se restaura primero (como cualquier app de
      // Windows) y recién entonces se arrastra; antes se movía a pantalla completa.
      try {
        const r = await api.winIsMaximized().catch(() => null);
        if (r && r.maximized) { await api.winMaximize(); setTimeout(updateMaxIcon, 80); }
      } catch (err) { /* sin backend: seguir con el arrastre normal */ }
      api.winStartMove();
    });
    // Doble clic → maximizar/restaurar
    topbar.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, input, a, [role="button"], .brand, .win-controls')) return;
      wcMax?.click();
    });
  }
}
function elFromHTML(h) { const t = el('div'); t.innerHTML = h; return t.firstChild; }

/* ============================================================
   ASISTENTE DE PRIMERA EJECUCIÓN (SETUP)
   ============================================================ */
function showSetupOverlay(cfg) {
  // cfg: objeto get_transcription_settings (puede ser null si aún no cargó)
  const ov = el('div', 'setup-overlay');
  ov.innerHTML = `
    <div class="setup-box">
      <div class="setup-hero">
        <img class="setup-logo-img" src="assets/helpmeet-symbol.svg" alt="">
        <h1 class="setup-h1">Bienvenido a Helpmeet</h1>
        <p class="setup-sub">Vamos a preparar el motor de transcripción antes de tu primera grabación. Solo se hace una vez y tardará unos minutos.</p>
      </div>

      <div class="setup-cols">
        <div class="setup-section">
          <div class="setup-section-title">Carpeta de grabaciones</div>
          <div class="setup-folder-row">
            <span class="setup-folder-path" id="setupFolderPath">…</span>
            <button class="btn setup-folder-btn" id="setupFolderBtn">Cambiar</button>
          </div>
        </div>
        <div class="setup-section setup-section-checks">
          <div class="setup-section-title">Estado del sistema</div>
          <div class="setup-checks" id="setupChecks"><span class="setup-check-placeholder">Comprobando…</span></div>
        </div>
      </div>
      <div class="setup-section" id="setupCfgWrap">
        <div class="setup-section-title">Idioma y calidad del modelo</div>
        <div id="setupModelChips"></div>
      </div>

      <div class="setup-progress-wrap" id="setupProgressWrap" hidden>
        <div class="setup-progress-bar-outer"><div class="setup-progress-bar-fill" id="setupFill" style="width:3%"></div></div>
        <div class="setup-progress-label" id="setupLabel">Preparando…</div>
      </div>

      <div class="setup-error-msg" id="setupErrorMsg" hidden></div>

      <div class="setup-foot">
        <button class="btn btn-primary setup-btn-start" id="setupBtnStart">Descargar e instalar modelo</button>
        <button class="btn setup-btn-skip" id="setupBtnSkip" hidden>Continuar sin configurar</button>
      </div>
    </div>`;

  document.body.appendChild(ov);

  let _cfg = cfg || {};
  let _started = false;

  // Nombre corto de cada calidad. El chip muestra el id real del modelo
  // (base/small/medium/large-v3); la etiqueta va debajo, pequeña.
  const TIER_LABEL = {
    fast: 'Rápido', balanced: 'Recomendado', accurate: 'Preciso', max: 'Máxima',
  };

  async function _loadChips() {
    try { _cfg = await api.v2.getTranscriptionSettings() || _cfg; } catch (e) { /* usa lo que hay */ }
    const byLang = _cfg.models_by_lang || {};
    const modelEl = ov.querySelector('#setupModelChips');

    // Recomendado por defecto: Español + calidad "Rápido" (small).
    if (!_cfg.tier) {
      try { _cfg = await api.v2.setTranscriptionSettings({ language: 'es', tier: 'balanced' }) || _cfg; } catch (e) { /* */ }
    }

    // Paso 1 — Idioma
    const langChips = (_cfg.languages || []).map(lg =>
      `<button class="cfg-chip setup-lang-chip${lg.id === _cfg.language ? ' on' : ''}" data-lang="${esc(lg.id)}">${esc(lg.label)}</button>`
    ).join('');

    // Paso 2 — Calidad (mismos modelos para ambos idiomas)
    const models = byLang[_cfg.language] || _cfg.models || [];
    const qualChips = models.map(mo => {
      const active = mo.tier === _cfg.tier;
      const isRec  = mo.tier === 'balanced';
      return `<button class="cfg-chip setup-model-chip${active ? ' on' : ''}${isRec ? ' is-rec' : ''}${mo.downloaded ? ' is-dl' : ''}" data-tier="${esc(mo.tier)}" title="${esc(mo.label)}">${isRec ? '<span class="setup-q-star">★</span>' : ''}${esc(mo.id)}<span class="cfg-chip-sub">${esc(TIER_LABEL[mo.tier] || '')} · ${esc(mo.download)}</span></button>`;
    }).join('');

    modelEl.innerHTML = `
      <div class="setup-pick">
        <span class="setup-pick-lbl">Idioma</span>
        <div class="setup-pick-chips">${langChips}</div>
      </div>
      <div class="setup-pick">
        <span class="setup-pick-lbl">Calidad</span>
        <div class="setup-pick-chips">${qualChips}</div>
      </div>`;

    modelEl.querySelectorAll('[data-lang]').forEach(b => b.onclick = async () => {
      try { _cfg = await api.v2.setTranscriptionSettings({ language: b.dataset.lang }) || _cfg; } catch (e) { /* */ }
      _loadChips();
    });
    modelEl.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
      try { _cfg = await api.v2.setTranscriptionSettings({ tier: b.dataset.tier }) || _cfg; } catch (e) { /* */ }
      _loadChips();
    });

    // Carpeta de destino
    const folderEl = ov.querySelector('#setupFolderPath');
    if (folderEl && _cfg.export_dir) folderEl.textContent = _cfg.export_dir;
  }
  _loadChips();

  ov.querySelector('#setupFolderBtn').onclick = async () => {
    try {
      await api.chooseExportDir();
      _loadChips();  // actualiza la ruta mostrada
    } catch (e) { /* cancelado */ }
  };

  async function _loadChecks() {
    try {
      const r = await api.getRecordingPreflight('meeting', 0);
      const checksEl = ov.querySelector('#setupChecks');
      if (!r || !r.checks) { checksEl.innerHTML = ''; return; }
      checksEl.innerHTML = r.checks.map(c => {
        const ico = c.status === 'ok' ? svg('check', 13) : c.status === 'error' ? svg('x', 13) : svg('info', 13);
        return `<span class="setup-check ${c.status}">${ico}<span>${esc(c.title)}</span></span>`;
      }).join('');
    } catch (e) { ov.querySelector('#setupChecks').innerHTML = ''; }
  }
  _loadChecks();

  function _enterApp() {
    window.onSetupProgress = null;
    ov.classList.add('setup-fade-out');
    setTimeout(() => {
      ov.style.display = 'none';
      ov.style.pointerEvents = 'none';
      if (ov.parentNode) ov.remove();
      setTimeout(() => showInitialTourIfNeeded(false), 300);
    }, 450);
  }

  window.onSetupProgress = (e) => {
    const fill = ov.querySelector('#setupFill');
    const label = ov.querySelector('#setupLabel');
    const errEl = ov.querySelector('#setupErrorMsg');
    const btn = ov.querySelector('#setupBtnStart');
    const skip = ov.querySelector('#setupBtnSkip');
    const pct = Math.round((e.pct || 0) * 100);
    if (fill) fill.style.width = Math.max(3, pct) + '%';
    if (e.stage === 'downloading') {
      const sz = e.size_label ? ` (${e.size_label})` : '';
      if (label) label.textContent = `Descargando modelo «${e.model || ''}»${sz}… ${pct}%`;
    } else if (e.stage === 'loading') {
      if (label) label.textContent = `Cargando en memoria… ${pct}%`;
    } else if (e.stage === 'done') {
      if (fill) fill.style.width = '100%';
      if (label) label.textContent = 'Completado';
      if (errEl) errEl.hidden = true;
      btn.textContent = 'Comenzar →';
      btn.disabled = false;
      btn.onclick = _enterApp;
      _loadChecks();
    } else if (e.stage === 'error') {
      if (errEl) {
        errEl.hidden = false;
        const msg = errMsg(e.error, 'Error durante la instalación.');
        errEl.innerHTML =
          `<span class="setup-error-text">${esc(msg)}</span>` +
          `<a class="setup-clear-cache" href="#">Limpiar caché y reintentar</a>`;
        errEl.querySelector('.setup-clear-cache').onclick = async (ev) => {
          ev.preventDefault();
          try { await api.v2.clearWhisperCache(); } catch (_) { /* */ }
          errEl.hidden = true;
          if (label) label.textContent = 'Preparando…';
          if (fill) fill.style.width = '3%';
          btn.click();
        };
      }
      if (label) label.textContent = 'Se produjo un error.';
      btn.textContent = 'Reintentar';
      btn.disabled = false;
      _started = false;
      skip.hidden = false;
    }
  };

  ov.querySelector('#setupBtnStart').onclick = async () => {
    if (_started) return;
    _started = true;
    const btn = ov.querySelector('#setupBtnStart');
    btn.disabled = true;
    btn.textContent = 'Instalando…';
    ov.querySelector('#setupProgressWrap').hidden = false;
    ov.querySelector('#setupErrorMsg').hidden = true;
    try { await api.v2.runSetup(); } catch (e) { /* la respuesta llega por onSetupProgress */ }
  };
  ov.querySelector('#setupBtnSkip').onclick = _enterApp;
}

window.doLicenseActivate = async function() {
  const input = document.getElementById('licenseKeyInput');
  const btn   = document.querySelector('.license-btn');
  const errEl = document.getElementById('licenseError');
  if (!input || !btn || btn.disabled) return;
  const key = input.value.trim().toUpperCase();
  if (!key || key.length < 22) { input.focus(); input.classList.add('lic-shake'); setTimeout(() => input.classList.remove('lic-shake'), 500); return; }
  btn.disabled = true;
  btn.innerHTML = '<span class="lic-spinner"></span>Activando...';
  if (errEl) errEl.hidden = true;
  try {
    const result = await api.activateLicense(key);
    if (result && result.ok) {
      btn.innerHTML = '<span class="lic-check"></span>Activado';
      btn.classList.add('lic-success');
      const gate = document.getElementById('licenseGate');
      gate.classList.add('lic-fade-out');
      await new Promise(r => setTimeout(r, 400));
      gate.hidden = true;
      gate.classList.remove('lic-fade-out');
      document.body.classList.remove('licensing');
      await _finishInit();
    } else {
      if (errEl) {
        errEl.textContent = errMsg(result && result.error, 'No se pudo activar. Revisa la key e inténtalo de nuevo.');
        errEl.hidden = false;
      }
      input.classList.add('lic-shake');
      setTimeout(() => input.classList.remove('lic-shake'), 500);
      btn.disabled = false;
      btn.innerHTML = 'Activar';
    }
  } catch (e) {
    if (errEl) { errEl.textContent = 'Error inesperado. Inténtalo de nuevo.'; errEl.hidden = false; }
    btn.disabled = false;
    btn.innerHTML = 'Activar';
  }
};

function showLicenseGate() {
  const gate = document.getElementById('licenseGate');
  // Pantalla completa: oculta la app de detrás y cierra modales abiertos
  // (p. ej. si se llega aquí desde Configuración → Desactivar licencia).
  document.body.classList.add('licensing');
  try { closeModal(); } catch (e) {}
  // El tour (z 12000) quedaría por encima del gate: fuera también.
  document.getElementById('initialTour')?.remove();
  document.querySelectorAll('.tour-target').forEach(n => n.classList.remove('tour-target'));
  gate.hidden = false;
  gate.classList.add('lic-fade-in');
  setTimeout(() => gate.classList.remove('lic-fade-in'), 400);
  const input = document.getElementById('licenseKeyInput');
  if (!input) return;
  setTimeout(() => input.focus(), 120);
  // Auto-formato HM-XXXX-XXXX-XXXX-XXXX mientras escribe
  input.addEventListener('input', () => {
    const sel = input.selectionStart;
    const raw = input.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 18);
    let fmt = '';
    if (raw.length >= 2) {
      fmt = raw.slice(0, 2) + '-';
      const rest = raw.slice(2);
      for (let i = 0; i < rest.length; i++) {
        if (i > 0 && i % 4 === 0) fmt += '-';
        fmt += rest[i];
      }
    } else {
      fmt = raw;
    }
    input.value = fmt;
    input.classList.toggle('valid', fmt.length === 22);
  });
}

async function _finishInit() {
  let booted = false;
  try {
    if (bootstrapAvailable()) {
      // P-06: un solo viaje al backend en vez de una llamada por iniciativa.
      const b = await api.getBootstrapState();
      if (b) {
        applyBootstrap(b);
        booted = true;
        try { renderBgJobs(b.background_jobs || []); } catch (e) { /* sin jobs */ }
        if (!b.setup_done) {
          showSetupOverlay(null);
        }
      }
    }
    if (!booted) {
      // Backend antiguo: camino anterior (una llamada por iniciativa).
      STATE.initiatives = await api.listInitiatives() || [];
      STATE.monitors = await api.listMonitors() || [];
      if (STATE.monitors.length) STATE.monitorIdx = STATE.monitors[0].index;
      for (const it of STATE.initiatives) STATE.meetingsByInit[it.id] = await api.listMeetings(it.id) || [];
    }
  } catch (e) { console.warn('init', e); }
  renderSidebar(); renderActionBar(); renderMain();
  setTimeout(() => showInitialTourIfNeeded(false), 500);
  if (!booted) {
    updateLibraryCounts();
    try { renderBgJobs(await api.getBackgroundJobs()); } catch (e) { /* sin jobs */ }
  }
  // Recuperación al arrancar (V2). Si no hay backend, no molesta.
  if (v2Available('list_recoverable_recordings')) {
    const recs = await api.v2.listRecoverable();
    if (recs && recs.length) showRecoveryBanner(recs[0]);
  }
}

async function init() {
  applySidebar();
  wireTopbar();
  setAppState('idle');

  // Verificar licencia
  if (HAS_PYWEBVIEW()) {
    try {
      const lic = await api.checkLicense();
      if (!lic || !lic.ok) { showLicenseGate(); return; }
    } catch (e) { console.warn('license_check', e); }
  }

  await _finishInit();
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

