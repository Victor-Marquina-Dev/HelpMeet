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
/* ============================================================
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
  // Misma carpeta maciza que #i-folder del sprite (ver la nota ahí): las dos
  // versiones aparecen en la misma pantalla y tienen que verse iguales.
  folder: '<path d="M2.5 7a2.4 2.4 0 0 1 2.4-2.4h4a1.8 1.8 0 0 1 1.3.6l1.4 1.5a1.8 1.8 0 0 0 1.3.6h5.2a2.4 2.4 0 0 1 2.4 2.4v7a2.4 2.4 0 0 1-2.4 2.4H4.9a2.4 2.4 0 0 1-2.4-2.4z" fill="currentColor" stroke="none"/>',
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
  diamond: '<path d="M12 2l3.5 7L12 22l-3.5-13L12 2z" fill="currentColor" stroke="none"/><path d="M2 10l6-3 3.5 13-6-5L2 10z" fill="currentColor" fill-opacity=".35" stroke="none"/><path d="M22 10l-6-3-3.5 13 6-5L22 10z" fill="currentColor" fill-opacity=".55" stroke="none"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
};
/* Iconos de transporte de vídeo: son siluetas macizas (triángulos, barras), no
   trazos. Con el `fill:none` general salían dibujados por su contorno, que a
   14px casi desaparece — el play del recortador se veía como una punta de flecha
   hueca en vez de un botón. */
const SOLID_ICONS = new Set(['play', 'pause', 'rewind', 'fastForward']);

function svg(name, size) {
  size = size || 15;
  let attrs;
  if (name === 'dots') attrs = '';
  else if (SOLID_ICONS.has(name)) attrs = ' fill="currentColor" stroke="none"';
  else attrs = ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"${attrs}>${ICONS[name] || ''}</svg>`;
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
  getPlanFeatures: () => call('get_plan_features'),
  deactivateLicense: () => call('deactivate_license'),
  reportVideoUsage: (seconds) => call('report_video_usage', seconds),
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
  importMediaMultiple: (iid, kind) => call('import_media_multiple', iid, kind),
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
  copyMeetingContext: (mid, lang) => call('copy_meeting_context', mid, lang || null),
  getCaptureImage: (cid) => call('get_capture_image', cid),
  getCaptureThumbnail: (cid) => call('get_capture_thumbnail', cid),
  getMeetingThumbnail: (mid) => call('get_meeting_thumbnail', mid),
  getBackgroundJobs: () => call('get_background_jobs'),
  setAiInstructions: (t) => call('set_ai_instructions', t),
  openMeetingFolder: (mid) => call('open_meeting_folder', mid),
  openPath: (p) => call('open_path', p),
  getSettings: () => call('get_settings'),
  getUiLanguage: () => call('get_ui_language'),
  setUiLanguage: (lang) => call('set_ui_language', lang),
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
  exportMeetingClips: (mid, segments, deleteOriginal) => call('export_meeting_clips', mid, segments || [], !!deleteOriginal),
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
    cancelCurrentJob: () => call('cancel_meeting_job'),
    listRecoverable: () => call('list_recoverable_recordings'),
    recoverRecording: (id) => call('recover_recording', id),
    discardRecoverable: (id) => call('discard_recoverable_recording', id),
    getAudioDevices: () => call('get_audio_devices'),               // @pending-python
    testAudioDevices: (cfg) => call('test_audio_devices', cfg),     // @pending-python
    startScreenRecording: (iid, idx) => call('start_screen_recording', iid, idx),
    stopScreenRecording: () => call('stop_screen_recording'),
    updateUtterance: (id, ch) => call('update_utterance', id, ch),
    splitUtterance: (id, pos) => call('split_utterance', id, pos),  // @pending-python
    mergeUtterances: (a, b) => call('merge_utterances', a, b),      // @pending-python
    deleteUtterance: (id) => call('delete_utterance', id),
    toggleHighlight: (id) => call('toggle_utterance_highlight', id),
    listMeetingAssets: (mid) => call('list_meeting_assets', mid),   // @pending-python
    updateNote: (id, t) => call('update_note', id, t),
    deleteNote: (id) => call('delete_note', id),
    deleteCapture: (id) => call('delete_capture', id),              // @pending-python
    generateSummary: (mid) => call('generate_meeting_summary', mid),// @pending-python
    getInsights: (mid) => call('get_meeting_insights', mid),        // @pending-python
    updateInsights: (mid, d) => call('update_meeting_insights', mid, d), // @pending-python
    deleteMeeting: (id) => call('delete_meeting', id),              // @pending-python
    archiveInitiative: (id) => call('archive_item', 'initiative', id),
    searchAdvanced: (q, f) => call('search_advanced', q, f),        // @pending-python
    getTranscriptionSettings: () => call('get_transcription_settings'),
    setTranscriptionSettings: (d) => call('set_transcription_settings', d),
    listParticipants: (iid) => call('list_participants', iid),
    addParticipants: (iid, names) => call('add_participants', iid, names),
    renameParticipant: (id, name) => call('rename_participant', id, name),
    deleteParticipant: (id) => call('delete_participant', id),
    setMeParticipant: (iid, pid) => call('set_me_participant', iid, pid),
    assignUtteranceParticipant: (uid, pid) => call('assign_utterance_participant', uid, pid),
    cancelMeetingJob: (mid) => call('cancel_meeting_job', mid),
    runSetup: () => call('run_setup'),
    clearVoskCache: () => call('clear_vosk_cache'),
  },
  // Controles de ventana frameless
  winMinimize: () => call('win_minimize'),
  winMaximize: () => call('win_maximize'),
  winClose: () => call('win_close'),
  winRefreshTheme: (dark) => call('win_refresh_theme', !!dark),
  winIsMaximized: () => call('win_is_maximized'),
  winStartResize: (dir) => call('win_start_resize', dir),
  winStartMove: () => call('win_start_move'),
};

// ─── Plan feature gating ──────────────────────────────────────

const _PLAN_UPGRADE_LABELS = {
  zip_export: 'Exportar ZIP',
  participants: 'Gestionar participantes',
  glossary: 'Glosario de terminos',
  recovery: 'Recuperar grabaciones',
  video_unlimited: 'Video ilimitado',
};

function hasFeature(key) {
  const pf = window._planFeatures;
  if (!pf) return true;  // si no se cargo aun, no bloquear
  return !!pf[key];
}

function upgradeLabel(key) {
  return _PLAN_UPGRADE_LABELS[key] || key;
}

function proBadge(key) {
  if (hasFeature(key)) return '';
  return `<span class="pro-badge" title="Disponible en Helpmeet Pro">${svg('diamond', 10)} PRO</span>`;
}

function showUpgradeToast(key) {
  const label = upgradeLabel(key);
  toast('warn', `${label} — Disponible en Helpmeet Pro`);
}

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
      id: 'm1', title: 'Kick-off con diseño', started_at: '2026-06-20T10:00:00', duration: '45:12', video_duration: '45:12', video_path: 'C:\Helpmeet\export\grabacion.mp4',
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
    create_initiative: (name, color) => {
      name = (name || '').trim();
      if (inits.some(x => (x.name || '').trim().toLowerCase() === name.toLowerCase())) return wait({ error: 'duplicate_name' });
      const it = { id: 'i' + (++mctr), name, color: color || '#aacfbf', created_at: new Date().toISOString() }; inits.push(it); meetings[it.id] = []; return wait(it);
    },
    rename_initiative: (id, name) => {
      name = (name || '').trim();
      if (inits.some(x => x.id !== id && (x.name || '').trim().toLowerCase() === name.toLowerCase())) return wait({ ok: false, error: 'duplicate_name' });
      const it = inits.find(x => x.id === id); if (it) it.name = name; return wait({ ok: true });
    },
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
    get_meeting_thumbnail: (mid) => {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='90'><rect width='160' height='90' fill='#3a5a52'/><circle cx='80' cy='45' r='22' fill='#fff' fill-opacity='.85'/><polygon points='72,32 72,58 96,45' fill='#3a5a52'/></svg>`;
      return wait({ ok: true, data_url: 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) }, 250);
    },
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
    cancel_meeting_job: () => wait({ ok: true }),
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

/* Preferencia de micrófono silenciado, persistida en el navegador.
   Por defecto silenciado (como antes): ante la duda, no grabar tu voz. */
const MIC_KEY = 'hm.mic-muted';
function _leerMicMuted() {
  try {
    const v = localStorage.getItem(MIC_KEY);
    return v == null ? true : v === '1';
  } catch { return true; }
}
function _guardarMicMuted(m) {
  try { localStorage.setItem(MIC_KEY, m ? '1' : '0'); } catch { /* modo privado */ }
}

/* ============================================================
   3. ESTADO CENTRAL
   ============================================================ */
const STATE = {
  appState: 'idle',     // idle | recording | recording-local | recording-cloud | screen-recording | processing
  screen: 'welcome',    // welcome | initiative | meeting | search | glossary | archive | trash | meetings | docs
  sidebarOpen: load('hm.sidebar', '1') === '1',
  /* La vista semanal es la que abre el calendario: en la mensual las reuniones
     de un día caben de a tres y el resto queda detrás de un "+N más", y con el
     uso real (varias por día) eso es la mayoría. La semana muestra el título
     entero y la duración, que es lo que se viene a mirar. */
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
  activeTab: 'general',
  _txLang: '',           // idioma seleccionado en el filtro de transcripcion
  _txApply: null,        // funcion de busqueda en transcripcion
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
  /* Silenciar el micrófono sobrevive al cierre de la app: es una decisión sobre
     la privacidad de quien graba, y volver a arrancar con el micrófono abierto
     porque nadie guardó el estado es la clase de sorpresa que se descubre
     demasiado tarde. Se guarda en localStorage además de intentarlo en el
     backend (setTranscriptionSettings), porque esa ruta depende de `api.v2` y
     si no está montada no persistía nada. Ver _leerMicMuted. */
  micMuted: _leerMicMuted(),
  meetingMicMuted: false,
  screenPanelCollapsed: false,
  /* Reuniones cuyo .mp4 se está muxeando ahora mismo (id → timestamp de inicio).
     El backend no expone este estado: stop_screen_recording vuelve enseguida y
     el muxeo corre en un hilo que solo avisa al terminar (onScreenVideoSaved).
     Entre esos dos momentos la reunión no tiene video_path, y sin esta marca la
     pestaña General no tendría forma de distinguir "todavía no está" de "no hay
     vídeo". Se pierde si se cierra la app a mitad del muxeo: es correcto, al
     reabrir ya no sabemos si aquel trabajo terminó y no debemos inventarlo. */
  videoPending: {},
  /* Análogo a videoPending, para el otro hueco que el backend no expone: entre
     detener una grabación de audio y que su trabajo aparezca en bgJobs. */
  txPending: {},
  settings: { export_dir: '', token_set: false },
  archiveCount: 0,
  trashCount: 0,
};

function load(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// Migración única: sidebar abierto por defecto desde v74
if (!load('hm.sidebar-default-v74', '')) { save('hm.sidebar', '1'); save('hm.sidebar-default-v74', '1'); }
// Tema: claro por defecto; 'dark' activa el modo oscuro calido (Ajustes -> Apariencia)
if (load('hm.theme', 'light') === 'dark') document.body.dataset.theme = 'dark';

/* Cambio de tema en un solo sitio. El tema nuevo se revela en un círculo que
   crece desde el control que lo pidió, en vez de que toda la pantalla cambie de
   golpe: el ojo sigue el origen y el salto de luminosidad deja de sorprender.

   Se apoya en View Transitions, que toma una instantánea del antes y del después
   y anima entre las dos. Donde no exista —o si el usuario pidió menos
   movimiento— se aplica el tema directo, sin animación y sin errores. */
function aplicarTema(valor) {
  const poner = () => {
    if (valor === 'dark') document.body.dataset.theme = 'dark';
    else delete document.body.dataset.theme;
  };
  const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (menosMovimiento || typeof document.startViewTransition !== 'function') {
    poner();
    return;
  }
  try {
    document.startViewTransition(poner);
  } catch (e) {
    poner();   // si el navegador la anuncia pero falla, el tema igual cambia
  }
}
// Favicon: version oscura en modo oscuro
(function updateFavicon() {
  const isDark = load('hm.theme', 'light') === 'dark';
  const png = document.getElementById('faviconPng');
  const ico = document.getElementById('faviconIco');
  if (png) png.href = isDark ? 'assets/helpmeet-favicon.png' : 'assets/helpmeet-favicon.png';
  if (ico) ico.href = isDark ? 'assets/helpmeet-dark.ico' : 'assets/helpmeet.ico';
})();

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

/* ── Fechas: una sola fuente para toda la app ──────────────────
   Antes estos arrays y la lógica de semanas estaban copiados en varios
   sitios y los bugs (semanas duplicadas) había que arreglarlos copia
   por copia. Cualquier cambio de formato de fechas se hace AQUÍ. */
const DIAS_CORTOS  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Hora local "HH:MM" de una fecha ISO ('' si no es válida).
function hhmmOf(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Semana (lunes–domingo) a la que pertenece una fecha: claves con fecha
// LOCAL (no UTC) y el mes tomado del JUEVES de la semana (convención ISO),
// para que una semana a caballo entre dos meses no se duplique.
// La usan el árbol lateral, la vista de proyecto y la tabla de Proyectos.
function weekInfoOf(iso) {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d)) return null;
  const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3);
  const fmt = dt => `${dt.getDate()} ${MESES_CORTOS[dt.getMonth()]}`;
  return {
    wKey: `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`,
    mKey: `${thu.getFullYear()}-${String(thu.getMonth() + 1).padStart(2, '0')}`,
    wLabel: `${fmt(mon)} – ${fmt(sun)}`,
    mLabel: `${MESES_LARGOS[thu.getMonth()]} ${thu.getFullYear()}`,
  };
}

// Markup de un waveform en vivo. n = nº de barras. cls = clase extra (p.ej. 'hm-wave--tx').
// Arranca en modo 'idle' (animación de fallback); onAudioLevels lo vuelve reactivo.
function waveMarkup(n = 7, cls = '') {
  let bars = '';
  for (let i = 0; i < n; i++) bars += '<i></i>';
  const extra = (cls ? ' ' + cls : '') + (STATE.micMuted ? ' muted' : '');
  return `<span class="hm-wave idle${extra}" aria-hidden="true">${bars}</span>`;
}

function renderTopStatus() {
  const root = $('#topbarStatus');
  const s = STATE.appState;
  /* Grabando (audio o pantalla): la barra de título va VACÍA.
     Tenía una pastilla roja con punto, cronómetro y waveform, y decía
     exactamente lo mismo que el panel flotante que está abajo en ese momento:
     que se está grabando, desde cuándo y que entra audio. Dos relojes corriendo
     en la misma pantalla no dan más información, solo obligan a decidir cuál
     mirar. El panel es el que manda porque además tiene los controles. */
  if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud'
      || s === 'screen-recording') {
    root.innerHTML = '';
  } else if (s === 'processing') {
    const progressText = STATE.jobDeterminate ? Math.round(STATE.jobProgress) + '%' : processingElapsed();
    root.innerHTML = `<div class="status-proc"><span class="spinner"></span>${esc(STATE.jobStage)} · ${progressText}</div>`;
  } else {
    /* En reposo la barra de título va VACÍA, como el mockup. Antes mostraba una
       pastilla con el proyecto y la reunión abiertos, pero eso ya se sabe: el
       proyecto está resaltado en el panel lateral y el título de la reunión es
       lo más grande de la pantalla. Repetirlo arriba no añadía nada y llenaba
       una barra que el rediseño deja despejada.
       El hueco solo se usa para lo que no se ve en ningún otro sitio: el
       trabajo en segundo plano. La grabación tiene su propio panel. */
    root.innerHTML = '';
  }
  updateMicChip();
}

/* Chip de micrófono del header: silenciar/activar mi audio.
   - Durante una grabación: silencia en vivo (reunión o pantalla).
   - En reposo: queda como preferencia para la próxima grabación. */
async function toggleMic() {
  STATE.micMuted = !STATE.micMuted;
  _guardarMicMuted(STATE.micMuted);
  updateMicChip();
  _medidorMic();          // corta o abre el medidor según el estado nuevo
  const s = STATE.appState;
  try {
    if (s === 'screen-recording') await api.toggleScreenMicMute(STATE.micMuted);
    else if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') await api.toggleMeetingMicMute(STATE.micMuted);
    else if (api.v2 && api.v2.setTranscriptionSettings) await api.v2.setTranscriptionSettings({ default_mic_muted: STATE.micMuted });
  } catch (e) { /* no romper la UI por el guardado */ }
  toast('info', STATE.micMuted ? t('recording.micMuted') : t('recording.micActive'));
}
function updateMicChip() {
  /* Antes del guard: esta función se llama en cada render de estado, así que es
     el punto natural para abrir el medidor cuando aparece el dock y cerrarlo
     cuando desaparece. El guard de abajo sale si no hay botón, y ahí justamente
     hay que cortar el stream. */
  _medidorMic();
  const b = $('#btnMic'); if (!b) return;
  const m = !!STATE.micMuted;
  /* Dos clases: .muted era la del diseño anterior y .is-muted la del dock nuevo
     (donde el micrófono tachado se tiñe de rojo). Se ponen las dos para que el
     estado se vea sea cual sea el markup que esté montado — al portar el dock,
     esta función seguía poniendo solo la vieja y buscando un .mic-ico que ya no
     existía: el estado cambiaba de verdad pero no se veía. */
  b.classList.toggle('muted', m);
  b.classList.toggle('is-muted', m);
  b.setAttribute('aria-pressed', m ? 'true' : 'false');
  const lbl = m ? 'Empezar con el micrófono activo' : 'Empezar con el micrófono silenciado';
  b.setAttribute('aria-label', lbl);
  b.setAttribute('title', lbl);
  // Markup nuevo: el icono es un <use> del sprite.
  const u = b.querySelector('svg use');
  if (u) u.setAttribute('href', m ? '#i-mic-off' : '#i-mic');
  // Markup viejo, mientras siga existiendo en alguna pantalla.
  const i = b.querySelector('.mic-ico');
  if (i) i.innerHTML = svg(m ? 'headerMicOff' : 'headerMic', 16);
  // Los waveforms en vivo siguen al micrófono, en los dos componentes.
  document.querySelectorAll('.hm-wave').forEach(w => w.classList.toggle('muted', m));
  document.querySelectorAll('.waveform.live').forEach(w => w.classList.toggle('is-muted', m));
}
/* ---- Buscador global (Ctrl+K) ----
   Hasta el rediseño esto era código muerto: openSearch() buscaba un #search
   que nunca existió en index.html, y runSearch() no la llamaba nadie — el
   backend api.search() estaba hecho y probado pero era inalcanzable.
   Ahora vive en un <dialog> (patrón del mockup): filtra proyectos y reuniones
   al instante en local, y Enter lanza la búsqueda dentro de las
   transcripciones, que es lo que api.search() sabe hacer y el mockup no. */
const SO = { cursor: -1, rows: [] };

/* "29 jul" — mismo formato corto que usa el mockup en la columna de la derecha. */
function soFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }).replace('.', '');
}

function openSearch() {
  const dlg = $('#searchOverlay'); if (!dlg || dlg.open) return;
  const ico = $('#soIcon'); if (ico && !ico.innerHTML) ico.innerHTML = svg('search', 17);
  const input = $('#searchInput');
  if (input) input.value = '';
  renderSearchOverlay('');
  dlg.showModal();
  requestAnimationFrame(() => dlg.classList.add('show'));
  if (input) input.focus();
}
function closeSearchOverlay() {
  const dlg = $('#searchOverlay'); if (!dlg || !dlg.open) return;
  dlg.classList.remove('show');
  dlg.close();
}

/* Índices locales: se leen del estado ya cargado, sin ir al backend. */
function soProjects(q) {
  const items = STATE.initiatives || [];
  if (!q) return items.slice(0, 6);
  return items.filter(i => (i.name || '').toLowerCase().includes(q)).slice(0, 8);
}
function soMeetings(q) {
  const out = [];
  const byInit = STATE.meetingsByInit || {};
  Object.keys(byInit).forEach(iid => {
    const ini = (STATE.initiatives || []).find(x => String(x.id) === String(iid));
    (byInit[iid] || []).forEach(m => {
      if (!q || (m.title || '').toLowerCase().includes(q) || (ini?.name || '').toLowerCase().includes(q)) {
        out.push({ m, ini });
      }
    });
  });
  out.sort((a, b) => String(b.m.started_at || '').localeCompare(String(a.m.started_at || '')));
  return out.slice(0, q ? 8 : 6);
}

function soRow({ ico, dot, title, sub, time, onClick }) {
  const b = el('button', 'so-row'); b.type = 'button';
  const icoHtml = dot
    ? `<span class="so-dot" style="background:${esc(dot)}"></span>`
    : svg(ico || 'file', 15);
  b.innerHTML = `<span class="so-row-ico">${icoHtml}</span>` +
    `<span class="so-row-main"><span class="so-row-title">${esc(title)}</span>` +
    (sub ? `<span class="so-row-sub">${sub}</span>` : '') + `</span>` +
    (time ? `<span class="so-row-time">${esc(time)}</span>` : '');
  b.onclick = () => { closeSearchOverlay(); onClick(); };
  return b;
}

function renderSearchOverlay(query, contentHits) {
  const list = $('#searchOverlayResults'); if (!list) return;
  const q = (query || '').trim().toLowerCase();
  list.replaceChildren();
  SO.rows = [];
  SO.cursor = -1;

  const addGroup = (label) => {
    const h = el('div', 'search-overlay-group-label'); h.textContent = label; list.appendChild(h);
  };
  const addRow = (row) => { list.appendChild(row); SO.rows.push(row); };

  const projs = soProjects(q);
  if (projs.length) {
    addGroup('Proyectos');
    projs.forEach(p => addRow(soRow({
      dot: p.color || 'var(--text-muted)',
      title: p.name,
      sub: `${(STATE.meetingsByInit?.[p.id] || []).length} reuniones`,
      onClick: () => selectInitiative(p.id),
    })));
  }

  const meets = soMeetings(q);
  if (meets.length) {
    addGroup('Reuniones');
    meets.forEach(({ m, ini }) => addRow(soRow({
      ico: m.source === 'screen' ? 'monitorDot' : 'mic',
      title: m.title || 'Sin título',
      sub: esc(ini?.name || ''),
      time: soFecha(m.started_at),
      onClick: () => openMeeting(m.id),
    })));
  }

  if (contentHits && contentHits.length) {
    addGroup('En las transcripciones');
    contentHits.slice(0, 12).forEach(r => addRow(soRow({
      ico: 'search',
      title: r.meeting_title || r.meeting || 'Reunión',
      sub: highlight(r.text || '', query.trim()),
      time: r.date || '',
      onClick: () => { if (r.meeting_id) openMeeting(r.meeting_id); },
    })));
  }

  if (!SO.rows.length) {
    const e = el('div', 'search-overlay-empty');
    e.textContent = q ? `Sin resultados para “${query.trim()}”` : 'Escribe para buscar.';
    list.appendChild(e);
  } else if (q && !contentHits) {
    const hint = el('div', 'search-overlay-hint');
    hint.textContent = 'Enter para buscar también dentro de las transcripciones';
    list.appendChild(hint);
  }
}

/* Flechas + Enter: navegar sin soltar el teclado. */
function soMoveCursor(delta) {
  if (!SO.rows.length) return;
  if (SO.cursor >= 0) SO.rows[SO.cursor]?.classList.remove('is-cursor');
  SO.cursor = (SO.cursor + delta + SO.rows.length) % SO.rows.length;
  const row = SO.rows[SO.cursor];
  row.classList.add('is-cursor');
  row.scrollIntoView({ block: 'nearest' });
}

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
  // Papelera queda marcada en las dos: Archivados vive dentro de esa pantalla.
  $('#btnTrash')?.classList.toggle('active', STATE.screen === 'trash' || STATE.screen === 'archive');
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
    case 'allnotes': return main.replaceChildren(viewAllNotes());
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
      <div class="empty-logo"><img src="assets/helpmeet-symbol.svg?v=20260802v2" alt=""></div>
      <h2 class="empty-title">Helpmeet</h2>
      <p>${t('welcome.subtitle')}. ${t('welcome.newProjectHint')}</p>
      <button class="btn btn-welcome" id="wNew">${svg('plus', 18)} ${t('welcome.newProject')}</button>
      <button class="empty-diag" id="wDiag">Diagnóstico del sistema</button>
    </div>`;
  w.querySelector('#wNew').onclick = promptNewInitiative;
  w.querySelector('#wDiag').onclick = openDiagnostics;
  return w;
}

// Inicio con actividad reciente: reuniones de todos los proyectos
// agrupadas por día (Hoy / Ayer / fecha), con acción rápida.
/* ---- Patrón de fila de reunión (FASE 2) ----
   Es la pieza más reutilizada del mockup: Inicio, la pestaña Reuniones de cada
   proyecto y Favoritos usan exactamente esta anatomía. Los hijos son hermanos y
   no van anidados dentro de .row a propósito: .row sigue siendo el <button> de
   navegación, y un botón no puede contener limpiamente otros controles.
   opts: { showProject, showDate, onMore } */
function meetingRow(m, it, opts) {
  opts = opts || {};
  const favs = _getMeetingFavs();
  const esFav = favs.has(m.id);
  const esPantalla = m.source === 'screen' || m.source === 'import';
  const color = it ? (it.color || avatarColorFor(it.name)) : 'var(--text-faint)';

  const wrap = el('div', 'row-wrap');
  wrap.dataset.mid = m.id;

  // Casilla de selección
  const slot = el('label', 'row-select-slot');
  slot.title = 'Seleccionar';
  slot.innerHTML =
    `<input type="checkbox" class="row-checkbox" aria-label="Seleccionar ${esc(m.title || 'reunión')}">` +
    `<svg class="row-check-mark" aria-hidden="true"><use href="#i-check"/></svg>`;

  // Icono de tipo: la verdad la fija si hay vídeo, igual que en el mockup.
  const tipo = el('span', 'row-doc-icon');
  tipo.title = esPantalla ? 'Grabación de pantalla' : 'Grabación de audio';
  tipo.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${esPantalla ? 'monitor' : 'audiowave'}"/></svg>`;

  // Contenido navegable
  const sub = _subtituloReunion(m);
  const ubic = _ubicacionReunion(m, it);
  const nav = el('button', 'row');
  nav.type = 'button';
  nav.innerHTML =
    `<span class="row-main">` +
      `<span class="row-title">${esc(_fmtMeetingLabel(m))}</span>` +
      `<span class="row-sub">` +
        `<svg class="icon row-sub-ico" aria-hidden="true"><use href="#i-clock"/></svg>${esc(sub)}` +
        `<span class="row-folder-chip" title="${esc(ubic.titulo)}">` +
          `<svg class="icon" aria-hidden="true"><use href="#i-folder"/></svg>` +
          `<span class="row-folder-chip-name">${esc(ubic.nombre)}</span>` +
        `</span>` +
      `</span>` +
    `</span>`;
  nav.onclick = () => { if (it) STATE.selInit = it.id; openMeeting(m.id); };

  // Estrella
  const fav = el('button', 'row-fav-btn' + (esFav ? ' active' : ''));
  fav.type = 'button';
  fav.setAttribute('aria-pressed', esFav ? 'true' : 'false');
  fav.title = esFav ? 'Quitar de favoritos' : 'Marcar como favorita';
  fav.innerHTML = '<svg aria-hidden="true"><use href="#i-star"/></svg>';
  fav.onclick = (e) => {
    e.stopPropagation();
    const ahora = _toggleMeetingFav(m.id);
    fav.classList.toggle('active', ahora);
    fav.setAttribute('aria-pressed', ahora ? 'true' : 'false');
    fav.title = ahora ? 'Quitar de favoritos' : 'Marcar como favorita';
    const favEl = $('#favCount');
    if (favEl) { const n = _getMeetingFavs().size; favEl.textContent = n || ''; }
  };

  wrap.append(slot, tipo, nav, fav);

  // Proyecto: solo donde la lista mezcla varios. Dentro de un proyecto todas
  // las filas son del mismo y el indicador sería ruido.
  /* Indicador de ubicación: el proyecto y, si la reunión está dentro de una
     carpeta del usuario, también la carpeta — "Mi bolsillo / Alquiler". Es la
     ruta real donde vive, que es lo que se quiere saber al mirar la lista; con
     solo el proyecto no se distingue una reunión suelta de una archivada en su
     carpeta. El icono se tiñe con el color del proyecto. */
  if (opts.showProject && it) {
    const proj = el('span', 'row-proj-icon');
    proj.style.color = color;
    proj.title = 'Proyecto: ' + it.name;
    proj.setAttribute('aria-label', proj.title);
    proj.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-folder"/></svg>` +
      `<span class="row-proj-name-grid"><span class="row-proj-name">${esc(it.name)}</span></span>`;
    wrap.appendChild(proj);
  }

  // [hora][···]
  const acciones = el('span', 'row-actions-slot');
  const hora = opts.showDate ? `${soFecha(m.started_at)} · ${m.time || ''}` : (m.time || hhmmOf(m.started_at) || '');
  const meta = el('span', 'row-meta');
  meta.innerHTML = `<span class="row-time">${esc(hora)}</span>`;
  const more = el('button', 'row-more-btn');
  more.type = 'button';
  more.title = 'Más acciones';
  more.setAttribute('aria-label', 'Más acciones de ' + (m.title || 'la reunión'));
  more.innerHTML = '<svg class="icon icon-sm" aria-hidden="true"><use href="#i-more"/></svg>';
  more.onclick = (e) => {
    e.stopPropagation();
    if (opts.onMore) opts.onMore(e, m, it);
    /* m.id y no m: openMeetingMenu recibe el ID de la reunión. Al pasarle el
       objeto, todo lo que compara con el id fallaba en silencio —
       promptMoveMeetingToFolder buscaba 'x.id === {objeto}', no encontraba el
       proyecto y salía sin hacer nada; lo mismo el favorito y el archivar. */
    else openMeetingMenu(e, m.id);
  };
  acciones.append(meta, more);
  wrap.appendChild(acciones);

  return wrap;
}

/* Subtítulo de la fila: duración cuando la hay, y si no el estado real.
   El recuento de frases se añade acá porque salió del título: como nombre no
   servía —cambia solo mientras se transcribe—, pero como dato sí dice algo que
   la fila no dice en ningún otro sitio: cuánto contenido tiene. */
function _subtituloReunion(m) {
  if (m.status === 'processing') return 'Transcribiendo…';
  const n = m.frases || 0;
  const frases = n ? ` · ${n} ${n === 1 ? 'frase' : 'frases'}` : '';
  const d = _duracionReunion(m);
  if (d) return d + frases;
  if (m.has_video) return 'Sin transcribir' + frases;
  return 'Pendiente';
}

/* Solo la duración, sin el recuento de frases: la usan las celdas del
   calendario, donde el ancho es de una columna de siete y "1 min · 330 frases"
   sale cortado a media palabra. */
function _duracionReunion(m) {
  if (!m.dur || m.dur === '—') return '';
  const [mm, ss] = String(m.dur).split(':').map(x => parseInt(x, 10) || 0);
  const total = mm + (ss >= 30 ? 1 : 0);
  return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total || 1} min`;
}

/* Minutos reales de una reunión, para los contadores de la tarjeta del día. */
function _minutosDe(m) {
  if (!m.dur || m.dur === '—') return 0;
  const [mm, ss] = String(m.dur).split(':').map(n => parseInt(n, 10) || 0);
  return mm + ss / 60;
}

function viewHomeFeed() {
  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');

  const items = [];
  for (const [iid, ms] of Object.entries(STATE.meetingsByInit || {})) {
    const it = (STATE.initiatives || []).find(x => x.id === Number(iid));
    for (const m of (ms || [])) items.push({ m, it });
  }
  items.sort((a, b) => String(b.m.started_at || '').localeCompare(String(a.m.started_at || '')));

  const titulo = el('h1', 'page-title'); titulo.textContent = 'Inicio';
  inner.appendChild(titulo);

  // ---- Tarjeta del día ----
  const hoy = new Date();
  const deHoy = items.filter(({ m }) => {
    const d = new Date(m.started_at);
    return !isNaN(d) && d.toDateString() === hoy.toDateString();
  });
  const minutos = deHoy.reduce((s, { m }) => s + _minutosDe(m), 0);
  const frases = deHoy.reduce((s, { m }) => s + (m.frases || 0), 0);
  const durTxt = minutos >= 60
    ? `${Math.floor(minutos / 60)} h ${Math.round(minutos % 60)} m`
    : `${Math.round(minutos)} m`;

  const card = el('div', 'today-card');
  card.innerHTML =
    `<div class="today-num-wrap">` +
      `<div class="today-num">${hoy.getDate()}<span class="today-dot" aria-hidden="true"></span></div>` +
      `<div class="today-labels">` +
        `<span class="cap">${hoy.toLocaleDateString('es', { month: 'long' })}</span>` +
        `<span class="cap">${hoy.toLocaleDateString('es', { weekday: 'long' })}</span>` +
      `</div>` +
    `</div>` +
    `<div class="today-stats">` +
      `<div class="tstat"><span class="tstat-val">${deHoy.length}</span><span class="tstat-lbl">grabadas hoy</span></div>` +
      `<span class="tstat-sep" aria-hidden="true"></span>` +
      `<div class="tstat"><span class="tstat-val">${durTxt}</span><span class="tstat-lbl">de audio</span></div>` +
      `<span class="tstat-sep" aria-hidden="true"></span>` +
      `<div class="tstat"><span class="tstat-val">${frases}</span><span class="tstat-lbl">frases</span></div>` +
    `</div>`;
  inner.appendChild(card);

  // ---- Lista agrupada por día ----
  if (!items.length) {
    const vacio = el('div', 'empty-state');
    vacio.innerHTML =
      `<svg class="icon icon-lg" aria-hidden="true"><use href="#i-pages"/></svg>` +
      `<div class="l1">Sin actividad todavía</div>` +
      `<div class="l2">Graba una reunión, graba la pantalla o importa un video desde la barra de abajo.</div>`;
    inner.appendChild(vacio);
  } else {
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    const etiquetaDia = (iso) => {
      const d = new Date(iso);
      if (isNaN(d)) return 'Sin fecha';
      if (d.toDateString() === hoy.toDateString()) return 'Hoy';
      if (d.toDateString() === ayer.toDateString()) return 'Ayer';
      return d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
    };

    let dia = null, lista = null;
    items.slice(0, 30).forEach(({ m, it }) => {
      const et = etiquetaDia(m.started_at);
      if (et !== dia) {
        const g = el('div', 'group-label'); g.textContent = et;
        inner.appendChild(g);
        lista = el('div', 'list');
        inner.appendChild(lista);
        dia = et;
      }
      lista.appendChild(meetingRow(m, it, { showProject: true }));
    });
  }

  wrap.appendChild(inner);
  return wrap;
}
/* ============================================================
   Vista de Calendario (estilo Stitch)
   ============================================================ */
const CAL_MONTHS = MESES_LARGOS;
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
  ev.innerHTML = `<span class="cal-ev-dot" style="${dotStyle}"></span>${time ? `<span class="cal-ev-time">${esc(time)}</span>` : ''}<span class="cal-ev-title">${esc(_fmtMeetingLabel(m, { enCalendario: true }))}</span>`;
  ev.onclick = (e) => { e.stopPropagation(); _calOpenMeeting(m, it); };
  return ev;
}

function viewFavorites() {
  const favs = _getMeetingFavs();
  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');

  // Todas las favoritas, agrupadas por proyecto.
  const porProy = new Map();
  for (const [iid, ms] of Object.entries(STATE.meetingsByInit || {})) {
    const it = (STATE.initiatives || []).find(x => x.id === Number(iid));
    (ms || []).filter(m => favs.has(m.id)).forEach(m => {
      const k = it ? it.id : 0;
      if (!porProy.has(k)) porProy.set(k, { it, ms: [] });
      porProy.get(k).ms.push(m);
    });
  }
  const total = [...porProy.values()].reduce((s, g) => s + g.ms.length, 0);

  const head = el('div', 'fav-head');
  head.innerHTML =
    `<h1 class="page-title">Favoritos</h1>` +
    `<span class="fav-count">${total} ${total === 1 ? 'reunión' : 'reuniones'}</span>`;
  if (total) {
    const limpiar = el('button', 'btn-outline fav-clear');
    limpiar.type = 'button';
    limpiar.textContent = 'Quitar todas';
    limpiar.onclick = () => confirmModal('Quitar todas las favoritas',
      'Se desmarcan todas. Las reuniones no se borran.', 'Quitar', () => {
        _setMeetingFavs(new Set());
        renderSidebar(); renderMain();
      });
    head.appendChild(limpiar);
  }
  inner.appendChild(head);

  if (!total) {
    const v = el('div', 'empty-state');
    v.innerHTML =
      `<svg class="icon icon-lg"><use href="#i-star"/></svg>` +
      `<div class="l1">Sin favoritos todavía</div>` +
      `<div class="l2">Marcá una reunión con la estrella y la vas a encontrar acá.</div>`;
    inner.appendChild(v);
    wrap.appendChild(inner);
    return wrap;
  }

  const cont = el('div');
  cont.id = 'favGroups';
  // El primer grupo arranca abierto y el resto cerrados: con muchos proyectos,
  // abrirlos todos convierte la pantalla en una lista larguísima sin jerarquía.
  let primero = true;
  porProy.forEach(({ it, ms }) => {
    const abierto = primero; primero = false;
    const g = el('section', 'fav-group' + (abierto ? ' is-open' : ''));

    const hdr = el('div', 'fav-group-hdr');
    const tog = el('button', 'fav-group-toggle');
    tog.type = 'button';
    tog.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    tog.innerHTML =
      `<svg class="fav-chev"><use href="#i-chevright"/></svg>` +
      `<span class="fav-group-dot" style="background:${esc(_initColor(it) || 'var(--text-muted)')}"></span>` +
      `<span class="fav-group-name">${esc(it ? it.name : 'Sin proyecto')}</span>` +
      `<span class="fav-group-cnt">${ms.length}</span>`;

    const body = el('div', 'fav-group-body fav-list');
    if (!abierto) body.hidden = true;
    const lista = el('div', 'list');
    ms.forEach(m => lista.appendChild(meetingRow(m, it, { showProject: true, showDate: true })));
    body.appendChild(lista);

    tog.onclick = () => {
      const ahora = g.classList.toggle('is-open');
      tog.setAttribute('aria-expanded', ahora ? 'true' : 'false');
      body.hidden = !ahora;
    };

    // Hermano del toggle, no hijo: un button dentro de otro es HTML inválido.
    const vaciar = el('button', 'icon-btn fav-group-clear');
    vaciar.type = 'button';
    vaciar.title = `Quitar las favoritas de ${it ? it.name : 'este grupo'}`;
    vaciar.innerHTML = '<svg class="icon icon-sm"><use href="#i-close"/></svg>';
    vaciar.onclick = () => {
      const s = _getMeetingFavs();
      ms.forEach(m => s.delete(m.id));
      _setMeetingFavs(s);
      renderSidebar(); renderMain();
    };

    hdr.append(tog, vaciar);
    g.append(hdr, body);
    cont.appendChild(g);
  });
  inner.appendChild(cont);

  wrap.appendChild(inner);
  return wrap;
}

function viewMeetings() {
  const C = STATE.cal;
  const hoy = new Date(); const hoyKey = _dkey(hoy);

  // Reuniones agrupadas por día (YYYY-MM-DD).
  const porDia = {};
  for (const { m, it } of _calMeetings()) {
    const k = (m.started_at || '').substring(0, 10);
    if (!k) continue;
    (porDia[k] = porDia[k] || []).push({ m, it });
  }
  for (const k in porDia) porDia[k].sort((a, b) => (a.m.started_at || '').localeCompare(b.m.started_at || ''));

  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner cal-head');
  inner.style.maxWidth = '980px';

  const h1 = el('h1', 'page-title'); h1.textContent = 'Calendario';
  inner.appendChild(h1);

  // ---- Barra: filtro · modo · navegación ----
  const barra = el('div', 'cal-bar');
  const montaFiltro = el('span');
  barra.appendChild(montaFiltro);

  const modos = el('div', 'cal-modes');
  modos.setAttribute('role', 'group');
  [['month', 'Mes'], ['week', 'Semana']].forEach(([id, txt]) => {
    const b = el('button', 'cal-mode' + (C.view === id ? ' is-on' : ''));
    b.type = 'button'; b.textContent = txt;
    b.onclick = () => { C.view = id; renderMain(); };
    modos.appendChild(b);
  });
  barra.appendChild(modos);

  // Etiqueta del periodo visible.
  let etiqueta;
  if (C.view === 'week') {
    const ws = new Date(C.weekStart + 'T00:00:00');
    const we = new Date(ws); we.setDate(we.getDate() + 6);
    etiqueta = ws.getMonth() === we.getMonth()
      ? `${ws.getDate()} – ${we.getDate()} ${CAL_MONTHS_SHORT[ws.getMonth()]}`
      : `${ws.getDate()} ${CAL_MONTHS_SHORT[ws.getMonth()]} – ${we.getDate()} ${CAL_MONTHS_SHORT[we.getMonth()]}`;
  } else {
    etiqueta = `${CAL_MONTHS[C.m]} ${C.y}`;
  }

  const nav = el('div', 'cal-nav');
  const bPrev = el('button', 'icon-btn');
  bPrev.type = 'button'; bPrev.title = 'Anterior'; bPrev.setAttribute('aria-label', 'Anterior');
  bPrev.innerHTML = '<svg class="icon"><use href="#i-chevleft"/></svg>';
  bPrev.onclick = () => { _calShift(-1); renderMain(); };
  const lbl = el('div', 'cal-month'); lbl.textContent = etiqueta;
  const bNext = el('button', 'icon-btn');
  bNext.type = 'button'; bNext.title = 'Siguiente'; bNext.setAttribute('aria-label', 'Siguiente');
  bNext.innerHTML = '<svg class="icon"><use href="#i-chevright"/></svg>';
  bNext.onclick = () => { _calShift(1); renderMain(); };
  const bHoy = el('button', 'cal-today-btn');
  bHoy.type = 'button'; bHoy.textContent = 'Hoy';
  bHoy.onclick = () => {
    const n = new Date();
    C.y = n.getFullYear(); C.m = n.getMonth(); C.weekStart = _dkey(_startOfWeek(n));
    renderMain();
  };
  nav.append(bPrev, lbl, bNext, bHoy);
  barra.appendChild(nav);
  inner.appendChild(barra);

  // Filtro por proyecto (componente ya existente en la app).
  const filtro = customSelect({
    value: C.filter,
    items: [{ value: 'all', label: 'Todos los espacios' }]
      .concat(STATE.initiatives.map(it => ({ value: it.id, label: it.name, color: _initColor(it) }))),
    icon: 'filter', className: 'cal-filter', minWidth: 190,
    onChange: (v) => { C.filter = v; renderMain(); },
  });
  montaFiltro.replaceWith(filtro);

  // ---- Cuerpo ----
  if (C.view === 'week') {
    inner.appendChild(_calWeekGrid(C.weekStart, porDia, hoyKey));
  } else {
    const dows = el('div', 'cal-dows');
    // Semana que empieza en lunes: el domingo de CAL_DOW se manda al final.
    ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(d => {
      const c = el('div', 'cal-dow'); c.textContent = d; dows.appendChild(c);
    });
    inner.appendChild(dows);
    inner.appendChild(_calMonth(C.y, C.m, porDia, hoyKey));
  }

  // Estado vacío: se calcula contra el filtro activo, así que un mes con
  // reuniones pero ninguna del proyecto filtrado también sale vacío.
  if (!Object.keys(porDia).length) {
    const v = el('div', 'cal-empty-month');
    v.textContent = `No grabaste nada${C.filter !== 'all' ? ' en este proyecto' : ''} en este periodo.`;
    inner.appendChild(v);
  }

  wrap.appendChild(inner);
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
/* Rejilla del mes, con la semana empezando en lunes. Las líneas de 1px las
   dibuja el gap sobre un fondo del color del borde: así no se doblan a dos
   píxeles entre celda y celda. */
function _calMonth(y, m, porDia, hoyKey) {
  const grid = el('div', 'cal-grid');
  const primero = new Date(y, m, 1);
  const offset = (primero.getDay() + 6) % 7;   // lunes = 0
  const dias = new Date(y, m + 1, 0).getDate();
  const celdas = Math.ceil((offset + dias) / 7) * 7;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const MAX = 3;

  for (let i = 0; i < celdas; i++) {
    const n = i - offset + 1;
    const cell = el('div', 'cal-cell');
    if (n < 1 || n > dias) { cell.classList.add('is-out'); grid.appendChild(cell); continue; }

    const fecha = new Date(y, m, n);
    const k = _dkey(fecha);
    if (k === hoyKey) cell.classList.add('is-today');
    if (fecha > hoy) cell.classList.add('is-future');

    const num = el('div', 'cal-num'); num.textContent = n;
    cell.appendChild(num);

    const evs = (porDia[k] || []);
    if (evs.length) {
      const cont = el('div', 'cal-evs');
      evs.slice(0, MAX).forEach(({ m: mt, it }) => {
        const b = el('button', 'cal-ev');
        b.type = 'button';
        b.title = `${_fmtMeetingLabel(mt)}${it ? ' · ' + it.name : ''}`;
        b.innerHTML =
          `<span class="cal-ev-dot" style="background:${esc(_initColor(it) || 'var(--text-muted)')}"></span>` +
          `<span class="cal-ev-time">${esc(_hora24(mt.started_at))}</span>` +
          `<span class="cal-ev-title">${esc(_fmtMeetingLabel(mt, { enCalendario: true }))}</span>`;
        b.onclick = () => { if (it) STATE.selInit = it.id; openMeeting(mt.id); };
        cont.appendChild(b);
      });
      if (evs.length > MAX) {
        const mas = el('button', 'cal-more');
        mas.type = 'button';
        mas.textContent = `+${evs.length - MAX} más`;
        mas.onclick = () => { STATE.cal.view = 'week'; STATE.cal.weekStart = _dkey(_startOfWeek(fecha)); renderMain(); };
        cont.appendChild(mas);
      }
      cell.appendChild(cont);
    }
    grid.appendChild(cell);
  }
  return grid;
}

/* Hora en 24 h: dentro de la celda el sufijo "a. m./p. m." cuesta seis
   caracteres por evento, y sin él "5:20" no se distingue de las cinco de la
   mañana. */
function _hora24(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const CAL_HOUR_PX = 48;   // alto de cada hora en la rejilla semanal

// Vista semanal estilo Notion: eje de horas, fila "Todo el día", columnas
// iguales y línea roja de la hora actual.
/* Semana: siete columnas altas con la lista del día, no una rejilla con eje
   horario. Estas reuniones duran de 1 a 45 minutos; sobre doce horas de eje la
   mitad serían bloques de dos píxeles. Lo que sí aporta el modo semana es
   espacio para leer el título entero y la duración. */
function _calWeekGrid(weekStartKey, porDia, hoyKey) {
  const cont = el('div', 'cal-week');
  const inicio = new Date(weekStartKey + 'T00:00:00');
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  for (let i = 0; i < 7; i++) {
    const fecha = new Date(inicio); fecha.setDate(inicio.getDate() + i);
    const k = _dkey(fecha);
    const col = el('div', 'cal-wday');
    if (fecha > hoy) col.classList.add('is-future');

    const cab = el('div', 'cal-wday-head');
    const num = el('div', 'cal-num' );
    num.textContent = fecha.getDate();
    if (k === hoyKey) { col.classList.add('is-today'); num.style.cssText = 'background:var(--recording);color:#fff;border-radius:50%;font-weight:600'; }
    const dow = el('div', 'cal-wday-dow'); dow.textContent = DOW[i];
    cab.append(num, dow);
    col.appendChild(cab);

    const evs = porDia[k] || [];
    if (evs.length) {
      const lista = el('div', 'cal-wday-evs');
      evs.forEach(({ m: mt, it }) => {
        const b = el('button', 'cal-wev');
        b.type = 'button';
        b.title = `${_fmtMeetingLabel(mt)}${it ? ' · ' + it.name : ''}`;
        b.innerHTML =
          `<span class="cal-wev-top">` +
            `<span class="cal-ev-dot" style="background:${esc(_initColor(it) || 'var(--text-muted)')}"></span>` +
            `<span class="cal-ev-time">${esc(_hora24(mt.started_at))}</span>` +
            `<span class="cal-wev-dur">${esc(_duracionReunion(mt))}</span>` +
          `</span>` +
          `<span class="cal-wev-title">${esc(_fmtMeetingLabel(mt, { enCalendario: true }))}</span>`;
        b.onclick = () => { if (it) STATE.selInit = it.id; openMeeting(mt.id); };
        lista.appendChild(b);
      });
      col.appendChild(lista);
    }
    cont.appendChild(col);
  }
  return cont;
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

// Panel flotante con las reuniones de un dia en el calendario mensual
function _calShowDayPicker(e, date, evs) {
  closeMenu();
  const panel = el('div', 'cdrop-panel cal-pick-panel');
  const dayLabel = `${date.getDate()} de ${CAL_MONTHS[date.getMonth()]}`;
  const hdr = el('div'); hdr.style.cssText = 'padding:6px 12px;font-size:11px;font-weight:700;color:var(--text-muted);border-bottom:1px solid var(--border-subtle)';
  hdr.textContent = dayLabel;
  panel.appendChild(hdr);
  if (!evs.length) {
    const empty = el('div', 'cdrop-opt');
    empty.style.cssText = 'color:var(--text-faint);font-style:italic';
    empty.textContent = 'Sin reuniones este dia';
    panel.appendChild(empty);
  } else {
    evs.forEach(({ m, it }) => {
      const hhmm = (m.started_at || '').substring(11, 16);
      const o = el('div', 'cdrop-opt');
      o.innerHTML = `<span class="cdrop-dot" style="background:${_initColor(it)}"></span>`
        + `<span class="cdrop-opt-label">${esc(_fmtMeetingLabel(m))}</span>`
        + `<span class="cal-pick-time">${esc(_calFmtTime(hhmm))}</span>`;
      o.onclick = (ev2) => { ev2.stopPropagation(); closeMenu(); _calOpenMeeting(m, it); };
      panel.appendChild(o);
    });
  }
  // Link para ir a la vista semanal
  const foot = el('div'); foot.style.cssText = 'padding:4px 12px;border-top:1px solid var(--border-subtle)';
  foot.innerHTML = `<button class="btn sm" style="width:100%;justify-content:center;font-size:10px">Ver semana completa</button>`;
  foot.querySelector('button').onclick = () => {
    closeMenu();
    const C = STATE.cal;
    const dow = date.getDay();
    const ws = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow);
    C.weekStart = _dkey(ws);
    C.view = 'week';
    renderMain();
  };
  panel.appendChild(foot);
  document.body.appendChild(panel);
  let left = e.clientX + 4, top = e.clientY + 4;
  if (left + panel.offsetWidth > window.innerWidth - 10) left = window.innerWidth - panel.offsetWidth - 10;
  if (top + panel.offsetHeight > window.innerHeight - 10) top = e.clientY - panel.offsetHeight - 4;
  panel.style.left = Math.max(10, left) + 'px';
  panel.style.top = Math.max(10, top) + 'px';
  _ctxOpen = panel;
  setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
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
  ev.innerHTML = `<span class="cal-tg-ev-title">${esc(_fmtMeetingLabel(m, { enCalendario: true }))}</span><span class="cal-tg-ev-time" style="color:${color}">${esc(_calFmtTime(hhmm))}</span>`;
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
  const allMs = STATE.meetingsByInit[STATE.selInit] || [];
  const color = (it && it.color) || avatarColorFor(it ? it.name : '');
  STATE.initTab = STATE.initTab || 'reuniones';

  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');

  /* ---- Cabecera: punto de color + nombre, contador debajo, acciones a la
     derecha. "Exportar" va fuera del grupo que se revela: es la acción
     principal de la pantalla y no debe esconderse. ---- */
  const head = el('div', 'proj-header');
  const main = el('div', 'proj-header-main');
  const carpetas = _getFolders(STATE.selInit);
  const meta = allMs.length
    ? `${allMs.length} ${allMs.length === 1 ? 'reunión' : 'reuniones'}` +
      (carpetas.length ? ` · ${carpetas.length} ${carpetas.length === 1 ? 'carpeta' : 'carpetas'}` : '')
    : 'Sin reuniones todavía';
  main.innerHTML =
    `<h1 class="page-title"><span class="accent-dot" style="background:${esc(color)}"></span>${esc(it ? it.name : '')}</h1>` +
    `<div class="proj-meta">${esc(meta)}</div>`;

  const acciones = el('div', 'proj-header-actions');
  const bar = el('div', 'action-bar action-reveal');
  bar.id = 'initActions';

  const bCopy = el('button', 'icon-btn action-reveal-copy');
  bCopy.type = 'button'; bCopy.id = 'initCopyMd';
  bCopy.disabled = !allMs.length;
  bCopy.title = allMs.length ? 'Copiar transcripción en Markdown' : 'Aún no hay reuniones que copiar';
  bCopy.innerHTML = `<svg class="icon icon-sm"><use href="#i-copy"/></svg>` +
    `<span class="action-reveal-label-grid"><span class="action-reveal-label">Copiar transcripción .md</span></span>`;
  bCopy.onclick = (e) => copyInitiativeContext(STATE.selInit, e.currentTarget);

  const bFolder = el('button', 'icon-btn');
  bFolder.type = 'button'; bFolder.id = 'initOpenFolder';
  bFolder.title = 'Abrir la carpeta completa del proyecto';
  bFolder.innerHTML = '<svg class="icon"><use href="#i-folder"/></svg>';
  bFolder.onclick = (e) => doOpenFolder(e.currentTarget);

  const bMenu = el('button', 'icon-btn');
  bMenu.type = 'button'; bMenu.id = 'initMenu';
  bMenu.title = 'Más acciones del proyecto';
  bMenu.setAttribute('aria-label', 'Más acciones del proyecto');
  bMenu.innerHTML = '<svg class="icon"><use href="#i-more"/></svg>';
  bMenu.onclick = (e) => openInitiativeMenu(e, STATE.selInit);

  bar.append(bCopy, bFolder, bMenu);

  const bExport = el('button', 'btn-pill-secondary');
  bExport.type = 'button';
  bExport.innerHTML = '<svg class="icon icon-sm"><use href="#i-download"/></svg>Exportar';
  bExport.onclick = () => exportInitiativeTo(STATE.selInit);

  acciones.append(bar, bExport);
  head.append(main, acciones);
  inner.appendChild(head);

  // ---- Pestañas ----
  const tabsWrap = el('div', 'tabs-wrap');
  const pills = el('div', 'segmented-pill');
  pills.setAttribute('role', 'tablist');
  [
    { id: 'reuniones', label: 'Reuniones', icon: 'i-doc' },
    { id: 'archivos',  label: 'Archivos',  icon: 'i-layers' },
    { id: 'carpetas',  label: 'Carpetas',  icon: 'i-folder' },
  ].forEach(tab => {
    const b = el('button', 'tab-btn' + (STATE.initTab === tab.id ? ' active' : ''));
    b.type = 'button'; b.setAttribute('role', 'tab');
    b.innerHTML = `<svg><use href="#${tab.icon}"/></svg>${tab.label}`;
    b.onclick = () => { STATE.initTab = tab.id; renderMain(); };
    pills.appendChild(b);
  });
  tabsWrap.appendChild(pills);

  const panel = el('div', 'tab-panel active');
  if (STATE.initTab === 'reuniones') _panelReuniones(panel, it, allMs);
  else if (STATE.initTab === 'archivos') _panelArchivos(panel, it, allMs);
  else _panelCarpetasExport(panel, it, allMs);
  tabsWrap.appendChild(panel);
  inner.appendChild(tabsWrap);

  wrap.appendChild(inner);
  return wrap;
}

/* ---- Pestaña Reuniones: carpetas del usuario arriba, sueltas debajo ----
   Es el orden de cualquier explorador de archivos. La agrupación por mes se
   queda solo para las sueltas: dentro de una carpeta el orden ya lo puso quien
   la llenó, y volver a partirla por meses la haría ilegible. */
function _panelReuniones(panel, it, allMs) {
  const carpetas = _getFolders(STATE.selInit);

  if (carpetas.length || allMs.length) {
    const fila = el('div', 'group-label-row');
    fila.innerHTML = '<span class="group-label" style="margin:0">Carpetas</span>';
    const nueva = el('button', 'btn-newfolder');
    nueva.type = 'button';
    nueva.innerHTML = '<svg class="icon icon-sm"><use href="#i-plus"/></svg>Nueva carpeta';
    nueva.onclick = () => promptCreateFolder(STATE.selInit);
    fila.appendChild(nueva);
    panel.appendChild(fila);
  }

  carpetas.forEach(f => {
    const dentro = allMs.filter(m => _getMeetingFolder(m.id) === f.id);
    const uf = el('div', 'ufolder');
    const cab = el('div', 'ufolder-head');
    const tog = el('button', 'ufolder-toggle');
    tog.type = 'button';
    tog.setAttribute('aria-expanded', 'false');
    tog.innerHTML =
      `<svg class="ufolder-chev icon icon-sm"><use href="#i-chevright"/></svg>` +
      `<svg class="ufolder-ico icon icon-sm"><use href="#i-folder"/></svg>` +
      `<span class="ufolder-name">${esc(f.name)}</span>` +
      `<span class="ufolder-count">${dentro.length} ${dentro.length === 1 ? 'reunión' : 'reuniones'}</span>`;
    /* Un solo hijo directo (.ufolder-inner) porque el plegado va con
       grid-template-rows 0fr→1fr, y esa técnica necesita exactamente un hijo
       que lleve el overflow:hidden. Ver .ufolder-children en content.css. */
    const hijos = el('div', 'ufolder-children');
    const caja = el('div', 'ufolder-inner');
    const lista = el('div', 'list');
    dentro.forEach(m => lista.appendChild(meetingRow(m, it, { showProject: true, showDate: true })));
    if (!dentro.length) {
      const v = el('div', 'ufolder-empty');
      v.textContent = 'Carpeta vacía';
      caja.appendChild(v);
    }
    caja.appendChild(lista);
    hijos.appendChild(caja);
    tog.onclick = () => {
      const abierta = uf.classList.toggle('open');
      hijos.classList.toggle('open', abierta);
      tog.setAttribute('aria-expanded', abierta ? 'true' : 'false');
    };
    const mas = el('button', 'icon-btn ufolder-more');
    mas.type = 'button';
    mas.title = 'Acciones de la carpeta';
    mas.innerHTML = '<svg class="icon icon-sm"><use href="#i-more"/></svg>';
    mas.onclick = (e) => openMenu(e, [
      { label: 'Renombrar carpeta', icon: 'edit', onClick: () =>
        formModal('Renombrar carpeta', 'Nombre de la carpeta', f.name, 'Guardar', (nv) => {
          if (!nv.trim()) return;
          _saveFolders(STATE.selInit, _getFolders(STATE.selInit).map(x => x.id === f.id ? { ...x, name: nv.trim() } : x));
          renderMain(); renderSidebar();
        }) },
      { sep: true },
      // Eliminar la carpeta NO borra las reuniones: vuelven al proyecto.
      { label: 'Eliminar carpeta', icon: 'trash', danger: true, onClick: () =>
        confirmModal('Eliminar carpeta',
          `Se elimina la carpeta «${f.name}». Las reuniones que tenía no se borran, solo quedan sin carpeta.`,
          'Eliminar', () => {
            _deleteFolder(STATE.selInit, f.id);
            if (_getSelFolder(STATE.selInit) === f.id) _setSelFolder(STATE.selInit, null);
            toast('ok', 'Carpeta eliminada');
            renderMain(); renderSidebar();
          }) },
    ]);
    cab.append(tog, mas);
    uf.append(cab, hijos);
    panel.appendChild(uf);
  });

  // Reuniones sueltas, agrupadas por mes.
  const sueltas = allMs.filter(m => _getMeetingFolder(m.id) == null);
  if (!sueltas.length && !carpetas.length) {
    const vacio = el('div', 'empty-state');
    vacio.innerHTML =
      `<svg class="icon icon-lg"><use href="#i-pages"/></svg>` +
      `<div class="l1">Aún no hay reuniones aquí</div>` +
      `<div class="l2">Graba tu primera reunión de ${esc(it ? it.name : 'este proyecto')} para verla aquí.</div>`;
    panel.appendChild(vacio);
    return;
  }

  let mes = null, lista = null;
  sueltas.forEach(m => {
    const etiqueta = m.month_label || 'Sin fecha';
    if (etiqueta !== mes) {
      const g = el('div', 'group-label'); g.textContent = etiqueta;
      panel.appendChild(g);
      lista = el('div', 'list');
      panel.appendChild(lista);
      mes = etiqueta;
    }
    lista.appendChild(meetingRow(m, it, { showProject: true, showDate: true }));
  });
}

/* ---- Pestaña Archivos: vídeos y documentos del proyecto ----
   Filas planas a propósito (.row y no .row-wrap): un vídeo o un .md no se
   selecciona en lote ni se marca como favorito, así que no llevan casilla ni
   estrella — solo abrir. */
function _panelArchivos(panel, it, allMs) {
  const videos = allMs.filter(m => m.has_video);

  const gv = el('div', 'group-label-row');
  gv.innerHTML = '<span class="group-label" style="margin:0">Videos</span>';
  const bImp = el('button', 'btn-pill-secondary');
  bImp.type = 'button';
  bImp.innerHTML = '<svg class="icon icon-sm"><use href="#i-plus"/></svg>Importar video';
  bImp.onclick = () => _importVideosToInit(STATE.selInit);
  gv.appendChild(bImp);
  panel.appendChild(gv);

  if (videos.length) {
    const lv = el('div', 'list');
    videos.forEach(m => {
      const r = el('button', 'row');
      r.type = 'button';
      const tipo = m.source === 'screen' ? 'Grabación de pantalla' : 'Grabación de audio';
      r.innerHTML =
        `<span class="row-icon"><svg class="icon"><use href="#i-video"/></svg></span>` +
        `<span class="row-main">` +
          `<span class="row-title">${esc(_fmtMeetingLabel(m))}</span>` +
          `<span class="row-sub">${esc(tipo)} · ${esc(_subtituloReunion(m))}</span>` +
        `</span>` +
        `<span class="row-meta"><span class="row-time">${esc(m.size || '')}</span></span>`;
      r.onclick = () => openMeeting(m.id);
      lv.appendChild(r);
    });
    panel.appendChild(lv);
  } else {
    const v = el('div', 'empty-state compact');
    v.innerHTML = `<svg class="icon icon-lg"><use href="#i-video"/></svg><div class="l1">Sin videos todavía</div>`;
    panel.appendChild(v);
  }

  // Documentos convertidos a .md, servidos por el backend.
  const gd = el('div', 'group-label-row');
  gd.innerHTML = '<span class="group-label" style="margin:0">Documentos <span class="arrow-suffix">→ .md</span></span>';
  const bDoc = el('button', 'btn-pill-secondary');
  bDoc.type = 'button';
  bDoc.innerHTML = '<svg class="icon icon-sm"><use href="#i-plus"/></svg>Importar documento';
  bDoc.onclick = openDocsView;
  gd.appendChild(bDoc);
  panel.appendChild(gd);

  const ld = el('div', 'list');
  panel.appendChild(ld);
  api.listDocuments(STATE.selInit).then(docs => {
    docs = docs || [];
    if (!docs.length) {
      const v = el('div', 'empty-state compact');
      v.innerHTML = `<svg class="icon icon-lg"><use href="#i-pages"/></svg><div class="l1">Sin documentos todavía</div>`;
      ld.replaceWith(v);
      return;
    }
    docs.forEach(d => {
      const r = el('div', 'row doc-row');
      const fmt = (d.source_ext || d.ext || '').replace('.', '').toUpperCase();
      r.innerHTML =
        `<span class="row-icon"><svg class="icon"><use href="#i-doc"/></svg></span>` +
        `<span class="row-main">` +
          `<span class="row-title">${esc(d.name || d.md_name || '')}</span>` +
          `<span class="row-sub">${esc(fmt)}${d.ocr ? ' · OCR' : ''}${d.images ? ' · ' + d.images + ' imágenes' : ''}</span>` +
        `</span>`;
      ld.appendChild(r);
    });
  }).catch(() => {});
}

/* ---- Pestaña Carpetas: la estructura que el exportador crea en disco ----
   No es una carpeta del usuario: es lo que exporter.py escribe (proyecto → mes
   → carpeta por reunión con transcripción.md, capturas/ y el audio). Se muestra
   para que se vea qué se va a encontrar al abrir la carpeta del proyecto. */
function _panelCarpetasExport(panel, it, allMs) {
  if (!allMs.length) {
    const v = el('div', 'empty-state');
    v.innerHTML =
      `<svg class="icon icon-lg"><use href="#i-folder"/></svg>` +
      `<div class="l1">Aún no hay carpetas exportadas</div>` +
      `<div class="l2">Cada reunión transcrita crea su carpeta al exportarse.</div>`;
    panel.appendChild(v);
    return;
  }

  const arbol = el('div', 'folder-tree');
  const raiz = el('div', 'folder-row folder-row-root');
  raiz.innerHTML = `<svg class="icon icon-sm"><use href="#i-folder"/></svg>` +
    `<span class="folder-name">${esc(_slugProyecto(it ? it.name : ''))}/</span>`;
  arbol.appendChild(raiz);

  /* Dos niveles de agrupación, los dos plegables. El mes es carpeta real en
     disco; la semana es agrupación de lectura (el exportador no la crea), y por
     eso su fila lleva calendario en vez de carpeta y no termina en "/".
     El mes se toma de la fecha de CADA reunión, no del jueves de su semana como
     hace weekInfoOf: en disco manda el día propio, así que una semana a caballo
     entre julio y agosto sale en las dos ramas, con sus reuniones en cada una. */
  const meses = new Map();
  allMs.forEach(m => {
    const d = new Date(m.started_at);
    const mKey = isNaN(d) ? 'sin-fecha'
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!meses.has(mKey)) meses.set(mKey, { label: _slugMes(m.started_at), semanas: new Map() });
    const mes = meses.get(mKey);
    const w = weekInfoOf(m.started_at);
    const wKey = w ? w.wKey : 'sin-fecha';
    if (!mes.semanas.has(wKey)) mes.semanas.set(wKey, { label: _rotuloSemana(m.started_at), ms: [] });
    mes.semanas.get(wKey).ms.push(m);
  });

  /* Abierto de entrada: solo el mes y la semana más recientes (allMs llega
     ordenado de nuevo a viejo). Lo de esta semana se ve sin tocar nada y el
     historial no obliga a bajar treinta filas para llegar a él. */
  const hijosRaiz = el('div', 'folder-children');
  let primerMes = true;
  meses.forEach(mes => {
    let nMes = 0;
    mes.semanas.forEach(s => { nMes += s.ms.length; });
    const [filaMes, cajaMes] = _grupoCarpeta('folder', mes.label + '/', nMes, primerMes);
    hijosRaiz.append(filaMes, cajaMes);
    const dentroMes = cajaMes.firstChild;
    let primeraSem = true;
    mes.semanas.forEach(sem => {
      const [filaSem, cajaSem] = _grupoCarpeta(
        'calendar', 'Semana ' + sem.label, sem.ms.length, primerMes && primeraSem, 'folder-week');
      dentroMes.append(filaSem, cajaSem);
      const dentroSem = cajaSem.firstChild;
      sem.ms.forEach(m => dentroSem.appendChild(_carpetaReunion(m)));
      primeraSem = false;
    });
    primerMes = false;
  });

  arbol.appendChild(hijosRaiz);
  panel.appendChild(arbol);
}

/* Fila de grupo del árbol (mes o semana): el rótulo con su contador, y la caja
   plegable que le corresponde, como HERMANA y no anidada — así el
   `.folder-item.open .folder-toggle-arrow` de la hoja de estilos no alcanza a
   las flechas de los niveles de abajo y cada una gira por su cuenta. */
let _fgSeq = 0;
function _grupoCarpeta(icono, nombre, n, abierto, clase) {
  const id = 'fg-' + (++_fgSeq);
  const fila = el('div', 'folder-item folder-item-group' +
    (clase ? ' ' + clase : '') + (abierto ? ' open' : ''));
  const tog = el('button', 'folder-toggle');
  tog.type = 'button';
  tog.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  tog.setAttribute('aria-controls', id);
  tog.innerHTML =
    `<svg class="folder-toggle-arrow icon icon-sm"><use href="#i-chevright"/></svg>` +
    `<svg class="icon icon-sm"><use href="#i-${icono}"/></svg>` +
    `<span class="folder-name">${esc(nombre)}</span>` +
    `<span class="folder-count">${n} ${n === 1 ? 'reunión' : 'reuniones'}</span>`;
  fila.appendChild(tog);

  const caja = el('div', 'folder-group-children' + (abierto ? ' open' : ''));
  caja.id = id;
  caja.appendChild(el('div', 'folder-group-inner'));
  tog.onclick = () => {
    const ab = !fila.classList.contains('open');
    fila.classList.toggle('open', ab);
    caja.classList.toggle('open', ab);
    tog.setAttribute('aria-expanded', ab ? 'true' : 'false');
  };
  return [fila, caja];
}

/* Carpeta de una reunión, con los nombres REALES que escribe exporter.py.
   Antes la lista era inventada a medias (el título en el nombre, acentos en los
   ficheros, y solo tres hijos): la pestaña existe justamente para saber qué se
   va a encontrar en disco, así que si miente no sirve para nada. */
function _carpetaReunion(m) {
  const item = el('div', 'folder-item');
  const tog = el('button', 'folder-toggle');
  tog.type = 'button';
  tog.setAttribute('aria-expanded', 'false');
  tog.innerHTML =
    `<svg class="folder-toggle-arrow icon icon-sm"><use href="#i-chevright"/></svg>` +
    `<svg class="icon icon-sm"><use href="#i-folder"/></svg>` +
    `<span class="folder-name">${esc(_slugCarpeta(m))}/</span>`;
  const hojas = el('div', 'folder-meeting-children');
  hojas.innerHTML =
    `<div class="folder-leaf-inner">` +
      `<div class="folder-leaf"><svg class="icon icon-sm"><use href="#i-doc"/></svg>transcripcion.md</div>` +
      `<div class="folder-leaf"><svg class="icon icon-sm"><use href="#i-folder"/></svg>capturas/</div>` +
      `<div class="folder-leaf"><svg class="icon icon-sm"><use href="#i-mic"/></svg>${m.has_video ? 'grabacion.mp4' : 'grabacion.wav'}</div>` +
    `</div>`;
  tog.onclick = () => {
    const abierta = item.classList.toggle('open');
    hojas.classList.toggle('open', abierta);
    tog.setAttribute('aria-expanded', abierta ? 'true' : 'false');
  };
  item.append(tog, hojas);
  return item;
}

/* Nombre de carpeta que produce el exportador (meeting_folder_name):
   fecha_hora-con-segundos_id-a-cuatro-cifras. NO lleva el título: acá lo
   llevaba, y en disco no existe. */
function _slugCarpeta(m) {
  const d = new Date(m.started_at);
  const p = (n) => String(n).padStart(2, '0');
  if (isNaN(d)) return 'sin-fecha';
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}_` +
    `${p(d.getHours())}h${p(d.getMinutes())}m_${p(d.getSeconds())}_` +
    String(m.id == null ? 0 : m.id).padStart(4, '0');
}

/* Carpeta de mes del exportador (month_folder_name): "2026-07 Julio". */
function _slugMes(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return 'sin-fecha';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')} ${MESES_LARGOS[d.getMonth()]}`;
}

/* Mismo slug que exporter.py::_slug para la carpeta del proyecto.
   \p{L}\p{N} y no \w: el \w de Python es unicode y conserva los acentos, el de
   JavaScript es ASCII y los borrar\u00eda \u2014 el mismo nombre saldr\u00eda escrito de dos
   maneras distintas en la misma pantalla. */
function _slugProyecto(nombre) {
  const limpio = String(nombre || '').replace(/[^\p{L}\p{N}_\s-]/gu, '').trim().toLowerCase();
  const slug = limpio.replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || slug.startsWith('.') || slug.includes('..')) return 'sin-nombre';
  return slug.slice(0, 120);
}

/* R\u00f3tulo de la semana, RECORTADO al mes en el que est\u00e1 anidada: la semana va de
   lunes a domingo y puede cruzar el cambio de mes, pero dentro de "2026-07
   Julio" no puede anunciar d\u00edas de agosto \u2014 esas reuniones est\u00e1n en la rama de
   agosto. Con el recorte, los dos extremos caen siempre en el mismo mes. */
function _rotuloSemana(iso) {
  const w = weekInfoOf(iso);
  const d = new Date(iso);
  if (!w || isNaN(d)) return 'sin fecha';
  const lun = new Date(w.wKey + 'T00:00:00');
  const dom = new Date(lun); dom.setDate(lun.getDate() + 6);
  const ini = lun.getMonth() === d.getMonth() ? lun : new Date(d.getFullYear(), d.getMonth(), 1);
  const fin = dom.getMonth() === d.getMonth() ? dom : new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${ini.getDate()} \u2013 ${fin.getDate()} ${MESES_CORTOS[fin.getMonth()]}`;
}

/* Busca la carpeta de usuario `fid` sin depender de que el llamador pase el
   proyecto correcto.

   El box de la fila dec\u00eda la carpeta de mes incluso para reuniones que S\u00cd
   estaban archivadas en una carpeta: la b\u00fasqueda usaba `_getFolders(it.id)`, y
   el `it` que recibe meetingRow no siempre trae el mismo id con el que se
   guardaron las carpetas (en Inicio, Favoritos y "Todas mis notas" ni siquiera
   llega). Cuando la lista sal\u00eda vac\u00eda, la reuni\u00f3n "no ten\u00eda carpeta" y ca\u00eda al
   mes \u2014 sin fallar en voz alta, que es lo que lo hizo dif\u00edcil de ver: el panel
   de Reuniones s\u00ed agrupaba bien, porque ese usa STATE.selInit.

   Ahora se prueban tres or\u00edgenes en orden y gana el primero que la encuentre:
   el proyecto que vino por par\u00e1metro, el que la propia reuni\u00f3n declara, y el
   proyecto donde STATE dice que vive. */
function _carpetaDe(m, it, fid) {
  const candidatos = [];
  if (it && it.id != null) candidatos.push(it.id);
  if (m.initiative_id != null) candidatos.push(m.initiative_id);
  for (const k in (STATE.meetingsByInit || {})) {
    if ((STATE.meetingsByInit[k] || []).some(x => x.id === m.id)) { candidatos.push(k); break; }
  }
  for (const iid of candidatos) {
    // Number() en los dos lados: un id guardado como texto por una versi\u00f3n
    // anterior no debe hacer fallar la comparaci\u00f3n en silencio.
    const f = (_getFolders(iid) || []).find(x => Number(x.id) === Number(fid));
    if (f) return f;
  }
  return null;
}

/* Subcarpeta donde la reuni\u00f3n est\u00e1 guardada, para el box del subt\u00edtulo de la
   fila. Prioridad: la carpeta del usuario si est\u00e1 archivada en una; si no, la
   carpeta de mes del exportador. Las dos contestan "\u00bfd\u00f3nde est\u00e1?" \u2014 una dentro
   de la app, la otra en disco. */
function _ubicacionReunion(m, it) {
  const fid = _getMeetingFolder(m.id);
  const carpeta = fid == null ? null : _carpetaDe(m, it, fid);
  if (carpeta) return { nombre: carpeta.name, titulo: `Carpeta: ${carpeta.name}` };
  const mes = _slugMes(m.started_at);
  const raiz = it ? _slugProyecto(it.name) + '/' : '';
  return { nombre: mes, titulo: `Carpeta en disco: ${raiz}${mes}/` };
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
  const t = STATE.transcript;
  const langs = t ? _deriveLanguages(t.utterances || []) : [];
  // Si hay multiples idiomas, mostrar selector antes de copiar
  if (langs.length > 1) {
    if (btn) btn.classList.add('is-loading');
    const LANG_LABELS = { es: 'Espanol', en: 'English', pt: 'Portugues', fr: 'Francais', de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文', ko: '한국어' };
    const menuItems = langs.map(l => ({
      label: (LANG_LABELS[l.code] || l.code.toUpperCase()) + ' (' + l.count + ' frases)',
      icon: 'copy',
      onClick: () => _doCopyMeetingContext(mid, btn, l.code),
    }));
    // Agregar opcion "Todos"
    menuItems.unshift({
      label: 'Todos los idiomas (' + t.utterances.filter(u => u.kind === 'utterance').length + ' frases)',
      icon: 'copy',
      onClick: () => _doCopyMeetingContext(mid, btn, null),
    });
    openMenu({ clientX: btn.getBoundingClientRect().left, clientY: btn.getBoundingClientRect().bottom + 4 }, menuItems);
    if (btn) btn.classList.remove('is-loading');
    return;
  }
  return _doCopyMeetingContext(mid, btn, null);
}

async function _doCopyMeetingContext(mid, btn, language) {
  if (btn) btn.classList.add('is-loading');
  try {
    const r = await api.copyMeetingContext(mid, language);
    if (!r || !r.text || !r.text.trim()) {
      toast('info', 'Esta reunion aun no tiene contenido que copiar.');
      return;
    }
    const ok = await copyText(r.text);
    const kb = Math.max(1, Math.round(r.text.length / 1024));
    const langLabel = language ? ` (${language})` : '';
    toast(ok ? 'ok' : 'err', ok ? `Transcripcion .md copiada${langLabel} (~${kb} KB) · pegala en Claude` : 'No se pudo copiar al portapapeles');
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

// Trabajo en curso (encolado o corriendo) de una reunión, o null.
function meetingJob(mid) {
  if (mid == null) return null;
  const key = String(mid);
  return (STATE.bgJobs || []).find(j =>
    String(j.meeting_id) === key && (j.state === 'queued' || j.state === 'running')
  ) || null;
}

function currentMeetingJob() {
  return meetingJob(STATE.selMeeting);
}

// ¿Esta reunión se está transcribiendo ahora mismo? (progreso en vivo de bgJobs)
function meetingIsTranscribing(mid) {
  return !!meetingJob(mid);
}

// ¿El .mp4 de esta reunión se está muxeando todavía? (ver STATE.videoPending)
function meetingVideoPending(mid) {
  return mid != null && !!STATE.videoPending[String(mid)];
}

/* Qué mostrar en la columna del vídeo de la pestaña General. Un solo lugar
   decide, para que el card de progreso y el panel de vídeo no puedan
   contradecirse: son estados excluyentes del mismo hueco. */
function generalVideoState(t, mid) {
  if (meetingIsTranscribing(mid)) return 'transcribing';
  /* La marca de "recién detenida" solo vale mientras la reunión no tenga texto:
     si ya hay frases, el trabajo terminó y la marca quedó sin bajar. */
  const sinTexto = !(t && t.utterances && t.utterances.some(u => !u.kind || u.kind === 'utterance'));
  if (mid != null && STATE.txPending[String(mid)] && sinTexto) return 'transcribing';
  if (t && t.video_path) return 'video';
  if (meetingVideoPending(mid)) return 'muxing';
  return 'none';
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
  // Los botones de transcribir del panel de vídeo no deben quedar activos
  // mientras ya hay una transcripción en curso para esta misma reunión.
  /* Solo los de transcribir: `[data-tx-btn]` en vez de `.btn` a secas, para no
     apagar también Ver y Copiar, que siguen siendo válidos mientras se
     transcribe. (El selector anterior colgaba de `.video-file`, una fila que ya
     no existe.) */
  document.querySelectorAll('.video-panel .rec-actions .btn[data-tx-btn]').forEach(b => {
    b.disabled = !!job; b.classList.toggle('is-disabled', !!job);
    b.title = job ? 'Ya se está transcribiendo esta reunión…' : '';
  });
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
  const fraseCount = t && t.utterances ? t.utterances.filter(u => !u.kind || u.kind === 'utterance').length : 0;
  const transcribed = fraseCount > 0;
  const meetingJob = currentMeetingJob();
  /* Copiar/favorito/carpeta viven en la fila del reproductor —de vídeo o de
     audio— y solo suben aquí cuando no hay ningún medio que reproducir. Se
     decide en un único sitio para que las dos ramas no puedan mostrarlos a la
     vez, que es lo que antes los ponía duplicados en pantalla. */
  const hasVideoAsset = !!(t && (t.video_path || (t.assets && t.assets.audio)));

  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');

  /* Cabecera: miga → título → "···". El buscador dentro de la transcripción
     (#mSearch) se retiró de esta pantalla por decisión del dueño registrada en
     diseno.md; la búsqueda global de Ctrl+K ya mira dentro de las
     transcripciones, así que la capacidad no se pierde. */
  const head = el('div', 'meeting-header');
  const main = el('div', 'meeting-header-main');
  if (it) {
    const crumb = el('div', 'crumb');
    crumb.innerHTML = `<button type="button"><svg class="icon"><use href="#i-chevleft"/></svg>${esc(it.name)}</button>`;
    crumb.querySelector('button').onclick = () => selectInitiative(it.id);
    main.appendChild(crumb);
  }
  const h1 = el('h1', 'page-title');
  h1.textContent = t ? _fmtMeetingLabel(t) : 'Reunión';
  main.appendChild(h1);

  const side = el('div', 'meeting-header-side');
  const btnMenu = el('button', 'icon-btn');
  btnMenu.type = 'button';
  btnMenu.title = 'Más acciones de la reunión';
  btnMenu.setAttribute('aria-label', 'Más acciones de la reunión');
  btnMenu.innerHTML = '<svg class="icon"><use href="#i-more"/></svg>';
  btnMenu.onclick = (e) => openMeetingMenu(e, STATE.selMeeting);
  side.appendChild(btnMenu);
  head.append(main, side);
  inner.appendChild(head);

  // Fila de trabajo en curso (transcripción en segundo plano).
  const jobRow = el('div', 'meeting-job-row');
  jobRow.id = 'meetingJobRow';
  jobRow.innerHTML = meetingJobMarkup(meetingJob);
  inner.appendChild(jobRow);
  _wireJobCancel(jobRow.querySelector('[data-meeting-job]'));

  /* Fila de pestañas: píldoras a la izquierda, barra de acciones a la derecha.
     Los tres botones están siempre visibles; solo la etiqueta de "Copiar" se
     revela al pasar el mouse por el grupo entero. */
  const tabsWrap = el('div', 'tabs-wrap');
  const tabsRow = el('div', 'tabs-row');

  const TABS = [
    { id: 'transcript', label: 'Transcripcion' },
    { id: 'general',    label: 'General' },
    { id: 'notas',      label: 'Notas' },
    { id: 'archivos',   label: 'Archivos' },
  ];
  const pills = el('div', 'segmented-pill');
  pills.setAttribute('role', 'tablist');
  TABS.forEach(tab => {
    const b = el('button', 'tab-btn' + (STATE.activeTab === tab.id ? ' active' : ''));
    b.type = 'button'; b.dataset.tab = tab.id; b.setAttribute('role', 'tab');
    b.textContent = tab.label;
    b.onclick = () => { STATE.activeTab = tab.id; renderMain(); };
    pills.appendChild(b);
  });

  tabsRow.appendChild(pills);
  /* Copiar, favorito y carpeta bajan junto al vídeo. Aquí arriba solo se quedan
     cuando NO hay vídeo: sin panel de reproducción esa fila no existe, y sin
     esta salvedad una reunión de solo audio se quedaría sin esas tres acciones. */
  if (!hasVideoAsset) {
    const bar = el('div', 'action-bar action-reveal');
    bar.id = 'meetingActions';
    meetingBarButtons(STATE.selMeeting, t).forEach(b => bar.appendChild(b));
    tabsRow.appendChild(bar);
  }
  tabsWrap.appendChild(tabsRow);

  const panel = el('div', 'tab-panel active');
  panel.dataset.tabPanel = STATE.activeTab;
  if (STATE.activeTab === 'notas') panel.classList.add('notes-mode');
  panel.appendChild(renderTab(STATE.activeTab, t));
  tabsWrap.appendChild(panel);
  inner.appendChild(tabsWrap);

  wrap.appendChild(inner);
  return wrap;
}

/* Copiar / favorito / abrir carpeta. Se construyen aquí una sola vez porque
   viven en dos sitios según el caso: junto al vídeo cuando lo hay, y en la fila
   de pestañas cuando la reunión es solo audio. Duplicar el código era lo que
   antes los dejaba en pantalla dos veces a la vez. */
function meetingBarButtons(mid, t) {
  const transcribed = !!(t && t.utterances && t.utterances.some(u => !u.kind || u.kind === 'utterance'));
  const esFav = t ? _isMeetingFav(t.id) : false;

  const btnCopy = el('button', 'icon-btn action-reveal-copy');
  btnCopy.type = 'button'; btnCopy.id = 'mCopy';
  btnCopy.disabled = !transcribed;
  btnCopy.title = transcribed ? 'Copiar la transcripción en Markdown' : 'Disponible cuando transcribas el vídeo';
  btnCopy.innerHTML = `<svg class="icon icon-sm"><use href="#i-copy"/></svg>` +
    `<span class="action-reveal-label-grid"><span class="action-reveal-label">Copiar transcripción .md</span></span>`;
  btnCopy.onclick = (e) => copyMeetingContext(mid, e.currentTarget);

  const btnFav = el('button', 'icon-btn meeting-fav-btn' + (esFav ? ' active' : ''));
  btnFav.type = 'button'; btnFav.id = 'mFav';
  btnFav.setAttribute('aria-pressed', esFav ? 'true' : 'false');
  btnFav.title = esFav ? 'Quitar de favoritos' : 'Añadir a favoritos';
  btnFav.innerHTML = '<svg class="icon"><use href="#i-star"/></svg>';
  if (t) btnFav.onclick = () => {
    _toggleMeetingFav(t.id);
    const ahora = _isMeetingFav(t.id);
    btnFav.classList.toggle('active', ahora);
    btnFav.setAttribute('aria-pressed', ahora ? 'true' : 'false');
    btnFav.title = ahora ? 'Quitar de favoritos' : 'Añadir a favoritos';
    renderSidebar();
    toast(ahora ? 'ok' : 'info', ahora ? 'Añadida a favoritos' : 'Quitada de favoritos');
  };

  const btnOpen = el('button', 'icon-btn');
  btnOpen.type = 'button'; btnOpen.id = 'mOpen';
  btnOpen.title = 'Abrir la carpeta de la reunión';
  btnOpen.innerHTML = '<svg class="icon"><use href="#i-folder"/></svg>';
  btnOpen.onclick = (e) => doOpenFolder(e.currentTarget);

  return [btnCopy, btnFav, btnOpen];
}

function renderTab(tab, t) {
  if (tab === 'general') return renderGeneral(t);
  if (tab === 'archivos') return renderFiles();
  if (tab === 'notas') return renderNotes();
  return renderTranscript(t);  // transcript
}

function renderGeneral(t) {
  const r = el('div', 'meeting-general');
  const mid = (t && (t.meeting_id || t.id)) || STATE.selMeeting;
  /* Se guarda lo dibujado para que syncGeneralVideoState detecte la transición
     y rehaga la pestaña una sola vez. */
  const vState = generalVideoState(t, mid);
  _generalVideoState = vState;

  // ── Info + Video lado a lado ──
  const row = el('div', 'general-row');

  // Info
  const info = el('div', 'general-info');
  const dur = (t && t.video_duration) || (t && t.audio_duration) || (t && t.duration) || '—';
  const fechaHora = t && t.date ? t.date : (t && t.started_at ? new Date(t.started_at).toLocaleString('es', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—');
  info.innerHTML = `
    <div class="general-info-row"><span class="general-info-label">Fecha</span><span>${esc(fechaHora)}</span></div>
    <div class="general-info-row"><span class="general-info-label">Duracion</span><span>${esc(dur)}</span></div>`;
  row.appendChild(info);

  // Video compacto al costado — o el card que explica por qué todavía no está
  if (vState === 'video') {
    const vp = videoPanel(t);
    vp.classList.add('video-panel--compact');
    row.appendChild(vp);
  } else if (vState !== 'none') {
    row.appendChild(videoProcCard(vState, mid, !!(t && t.video_path)));
  } else if (t && t.assets && t.assets.audio) {
    // Reunión de solo audio: su propio reproductor y sus acciones.
    const ap = audioPanel(t);
    ap.classList.add('video-panel--compact');
    row.appendChild(ap);
  }

  r.appendChild(row);
  return r;
}

function renderTranscript(t) {
  /* Dos clases a propósito: .transcript es la del mockup (la que trae los
     estilos nuevos) y .reading es la que busca window.addUtterance para saber
     dónde insertar cada frase que llega en vivo. Mismo elemento, dos
     identidades — si se quita .reading, el motor sigue transcribiendo pero el
     texto deja de aparecer en pantalla. */
  const r = el('div', 'transcript reading');
  const allUs = (t && t.utterances) || [];
  const availableLangs = _deriveLanguages(allUs);

  /* Selector de idioma: solo cuando hay MÁS DE UNO que elegir. Con un idioma
     (o sin dato de idioma) mostraba un chip "Transcripcion · N" que repetía lo
     que ya dice la pestaña y añadía una fila de ruido antes del texto. */
  const hasUtterances = allUs.filter(u => u.kind === 'utterance').length > 0;
  if (hasUtterances && availableLangs.length > 1) {
    STATE._txLang = STATE._txLang || (availableLangs.length > 0 ? availableLangs[0].code : '');
    const langBar = el('div', 'lang-bar');
    const LANG_LABELS = { es: 'Espanol', en: 'English', pt: 'Portugues', fr: 'Francais', de: 'Deutsch', it: 'Italiano', ja: '日本語', zh: '中文', ko: '한국어' };
    let chips;
    if (availableLangs.length === 0) {
      // Sin datos de idioma: mostrar chip unico con el total
      const total = allUs.filter(u => u.kind === 'utterance').length;
      chips = [{ code: '', count: total }];
    } else if (availableLangs.length === 1) {
      chips = availableLangs;
    } else {
      chips = [{ code: '', count: allUs.filter(u => u.kind === 'utterance').length }].concat(availableLangs);
    }
    langBar.innerHTML = chips.map(l => {
      const label = l.code ? (LANG_LABELS[l.code] || l.code.toUpperCase()) : (availableLangs.length === 0 ? 'Transcripcion' : 'Todos');
      const active = STATE._txLang === l.code ? ' active' : '';
      return `<button class="lang-chip${active}" data-lang="${l.code}">${esc(label)} <span class="lang-chip-count">${l.count}</span></button>`;
    }).join('');
    langBar.querySelectorAll('.lang-chip').forEach(btn => {
      btn.onclick = () => { STATE._txLang = btn.dataset.lang; renderMain(); };
    });
    r.appendChild(langBar);
  } else {
    STATE._txLang = '';
  }

  const selectedLang = STATE._txLang || '';
  const us = selectedLang ? allUs.filter(u => (u.language || '') === selectedLang || u.kind !== 'utterance') : allUs;
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
    context.innerHTML = `<textarea id="meetingContext" rows="1" maxlength="2000" placeholder="Anadir contexto (Enter para guardar)" aria-label="Anadir contexto"></textarea>
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
      contextState.textContent = 'Guardando...';
      const r2 = await api.addMeetingNote(STATE.selMeeting, text);
      if (r2 && r2.ok && r2.note) {
        contextInput.value = ''; resizeContext(); contextState.textContent = '';
        if (STATE.transcript) {
          STATE.transcript.utterances = STATE.transcript.utterances || [];
          STATE.transcript.utterances.unshift(r2.note);
        }
        const reading = document.querySelector('.reading');
        if (reading) {
          const node = contextEvent(r2.note);
          const firstItem = reading.querySelector('.utterance');
          if (firstItem) reading.insertBefore(node, firstItem); else reading.appendChild(node);
          node.scrollIntoView({ block: 'nearest' });
        }
        toast('ok', 'Contexto guardado');
      } else { contextState.textContent = 'Error'; }
    };
    contextInput.addEventListener('input', resizeContext);
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
    r.appendChild(tools);
  }


  if (recording) {
    // En grabación las frases llegan YA REALES y persistidas en vivo
    // (window.addUtterance, transcripción progresiva): se pintan todas con
    // sus acciones normales. El indicador de "escuchando" se queda fijo al
    // final de la lista; todo el bloque desaparece solo al dejar de grabar
    // (este código deja de ejecutarse en el siguiente renderMain()).
    us.forEach(u => { const it = buildItem(u); items.push(it); r.appendChild(it.node); });
    /* Indicador de escucha, con la forma del mockup (.listening-row): tres
       puntos animados + "Escuchando…". Comunica "sigue grabando" sin fingir
       que hay texto pendiente de aparecer.
       Conserva id="previewTyping" porque window.setLivePartial escribe aquí el
       texto parcial de Vosk, y window.addUtterance inserta cada frase cerrada
       JUSTO ANTES de este elemento. Renombrarlo rompe las dos cosas. */
    const typing = el('div', 'listening-row preview-typing');
    typing.id = 'previewTyping';
    typing.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>' +
      '<span class="listening-label">Escuchando…</span>';
    r.appendChild(typing);
    return r;
  }

  if (!us.length && !(t && t.video_path)) {
    r.appendChild(el('p', null, '<span style="color:var(--text-muted)">Sin transcripción todavía.</span>'));
    return r;
  }

  r.appendChild(bulkBar);   // sticky arriba, antes de las frases
  r.appendChild(moreBtn);
  moreBtn.onclick = () => drawBatch(PAGE);
  drawBatch(PAGE);
  return r;
}

// Barra compacta del vídeo. No incrusta el reproductor al cambiar de reunión:
// el usuario decide cuándo abrirlo en su reproductor habitual.
function videoPanel(t) {
  const hasTx = !!(t.utterances && t.utterances.some(u => !u.kind || u.kind === 'utterance'));
  const mid = t.meeting_id || t.id || STATE.selMeeting;
  const busy = meetingIsTranscribing(mid);
  const wrap = el('div', 'video-panel');
  wrap.dataset.videoMid = String(mid);
  /* La fila con el nombre del archivo se quitó: repetía lo que ya dice la
     pestaña y su botón de play duplicaba el del propio reproductor. */
  wrap.innerHTML = `<div class="rec-actions"></div>
  <div class="video-player-wrap">
    <video class="video-player" controls preload="metadata" muted playsinline></video>
    <div class="video-player-overlay">
      <button class="video-player-big-play" title="Reproducir">${svg('play', 28)}</button>
    </div>
  </div>`;
  const playerWrap = wrap.querySelector('.video-player-wrap');
  const player = wrap.querySelector('.video-player');
  const bigPlay = wrap.querySelector('.video-player-big-play');
  // Cargar URL del video inmediatamente (sin autoplay)
  api.getMediaVideoUrl(mid).then(url => { if (url) { player.src = url; player.load(); } }).catch(() => {});
  const startPlayback = () => { player.muted = false; player.play().catch(() => {}); playerWrap.classList.add('is-playing'); };
  bigPlay.onclick = (e) => { e.stopPropagation(); startPlayback(); };
  player.onplay = () => { playerWrap.classList.add('is-playing'); };
  player.onpause = () => { playerWrap.classList.remove('is-playing'); };

  /* Solo las acciones que NO están ya en la barra de la reunión. Copiar, la
     estrella y la carpeta viven arriba, junto a las pestañas, y "ver la
     transcripción" es la pestaña de al lado: repetirlos aquí no daba un atajo,
     daba dos sitios distintos para lo mismo. */
  const actions = el('div', 'rec-actions');

  /* Los rótulos describen la ACCIÓN, no el estado. "Retranscribir" obligaba a
     saber de antemano que abría un recortador, y "Retranscribir todo" solo se
     entendía por contraste con el otro botón. */
  const bt = el('button', 'btn sm', 'Generar clips');
  bt.dataset.txBtn = 'clip';
  bt.dataset.txLabel = bt.textContent;
  bt.onclick = () => openClipEditor(wrap, t, hasTx);
  actions.appendChild(bt);
  // Transcribir directo, sin pasar por el recortador (vídeo completo)
  const btNow = el('button', 'btn sm', 'Transcribir todo');
  btNow.dataset.txBtn = 'now';
  btNow.dataset.txLabel = btNow.textContent;
  btNow.onclick = () => transcribeScreenVideo(mid, hasTx, null);
  actions.appendChild(btNow);
  actions.appendChild(hintButton(
    '· Generar clips: marcás tramos del vídeo y sale un .mp4 por cada uno. Desde ahí también podés transcribir solo esos tramos.\n' +
    '· Transcribir todo: recorre la grabación entera y la convierte en texto.' +
    (hasTx ? '\n\nEsta grabación ya tiene transcripción: volver a transcribir la reemplaza.' : '')
  ));

  /* Copiar, favorito y carpeta viven aquí, junto al vídeo, y no arriba con las
     pestañas: estaban en los dos sitios a la vez. `meetingBarButtons` los crea
     una sola vez para que la barra de arriba pueda reusarlos cuando la reunión
     no tiene vídeo y esta fila no existe. */
  // `action-reveal` es lo que hace que "Copiar" despliegue su etiqueta al pasar
  // el mouse por el grupo; sin esa clase en el padre el botón queda mudo.
  const extra = el('span', 'rec-actions-tail action-reveal');
  meetingBarButtons(mid, t).forEach(b => extra.appendChild(b));
  actions.appendChild(extra);

  wrap.querySelector('.rec-actions').replaceWith(actions);
  applyVideoPanelTranscribing(wrap, mid);
  return wrap;
}

/* Panel para las reuniones de solo audio. General quedaba con la ficha de datos
   y nada más: ni forma de escuchar lo grabado, ni de transcribirlo, ni las
   acciones que sí tiene una grabación de pantalla.

   Reusa el mismo servidor de medios que el vídeo —`url_for` devuelve el archivo
   de la reunión, sea .mp4 o .wav— y las mismas clases, para que las dos
   pestañas se vean como la misma pantalla con distinto contenido. */
function audioPanel(t) {
  const hasTx = !!(t.utterances && t.utterances.some(u => !u.kind || u.kind === 'utterance'));
  const mid = t.meeting_id || t.id || STATE.selMeeting;
  const wrap = el('div', 'video-panel audio-panel');
  wrap.dataset.videoMid = String(mid);
  wrap.innerHTML = `<div class="rec-actions"></div>
    <audio class="audio-player" controls preload="metadata"></audio>`;

  const player = wrap.querySelector('.audio-player');
  api.getMediaVideoUrl(mid).then(url => { if (url) { player.src = url; player.load(); } }).catch(() => {});

  const actions = el('div', 'rec-actions');
  /* Generar clips también aquí: para audio el corte es exacto —no hay fotogramas
     clave que respetar— y desde el mismo recortador se puede transcribir solo
     los tramos marcados, que es lo que hacía el botón "Transcribir todo". */
  const btClip = el('button', 'btn sm', 'Generar clips');
  btClip.dataset.txBtn = 'clip';
  btClip.dataset.txLabel = btClip.textContent;
  btClip.onclick = () => openClipEditor(wrap, t, hasTx);
  actions.appendChild(btClip);

  /* Copiar con su nombre escrito, no como icono: era la acción que de verdad se
     usa aquí, y estaba escondida detrás de un símbolo que además se repetía. */
  const btCopy = el('button', 'btn sm btn-quiet');
  btCopy.innerHTML = `<svg class="icon icon-sm"><use href="#i-copy"/></svg>Copiar transcripción`;
  btCopy.disabled = !hasTx;
  btCopy.title = hasTx ? 'Copiar la transcripción en Markdown' : 'Disponible cuando la reunión esté transcrita';
  btCopy.onclick = (e) => copyMeetingContext(mid, e.currentTarget);
  actions.appendChild(btCopy);

  // Favorito y carpeta sí siguen como iconos: no son la acción principal.
  const extra = el('span', 'rec-actions-tail');
  meetingBarButtons(mid, t).slice(1).forEach(b => extra.appendChild(b));
  actions.appendChild(extra);

  wrap.querySelector('.rec-actions').replaceWith(actions);
  applyVideoPanelTranscribing(wrap, mid);
  return wrap;
}

/* Botón "?" con la explicación al pasar por encima. Nace del par «Transcribir
   por partes / Transcribir todo»: los rótulos ya dicen QUÉ hace cada uno, pero
   no cuál conviene. El tooltip del riel no sirve acá —está atado a `.sidebar`—
   así que este se resuelve en CSS y responde igual al teclado. */
function hintButton(texto) {
  const b = el('button', 'hint-btn', '?');
  b.type = 'button';
  b.dataset.hint = texto;
  b.setAttribute('aria-label', 'Qué hace cada opción');
  return b;
}

/* Card que ocupa el hueco del vídeo mientras todavía no hay nada que reproducir.
   Cubre los dos silencios que tenía la pestaña General: el muxeo (el .mp4 aún no
   existe) y la transcripción (el panel de vídeo se esconde a propósito, ver
   applyVideoPanelTranscribing). Sin esto el usuario ve la ficha de datos y un
   costado vacío, sin ninguna pista de que falta algo en camino. */
function videoProcCard(kind, mid, hasVideo) {
  const card = el('div', 'video-proc video-panel--compact');
  card.dataset.procMid = String(mid);
  card.dataset.procKind = kind;
  card.dataset.procVideo = hasVideo ? '1' : '';
  /* Micrófono cuando la reunión es solo audio: un icono de vídeo prometería un
     reproductor que no va a aparecer. */
  const glifo = (hasVideo || kind === 'muxing') ? 'i-video' : 'i-mic';
  card.innerHTML =
    `<div class="video-proc-frame${glifo === 'i-mic' ? ' is-audio' : ''}">` +
      `<svg class="video-proc-glyph"><use href="#${glifo}"/></svg>` +
    `</div>` +
    `<div class="video-proc-copy"><b data-proc-title></b><small data-proc-note></small></div>` +
    `<span class="video-proc-bar" data-proc-bar hidden><i data-proc-fill></i></span>`;
  updateVideoProcCard(card);
  return card;
}

/* Refresca el texto y la barra sin reconstruir el card: renderBgJobs lo llama en
   cada tic del progreso y un re-render completo ahí reiniciaría el vídeo y la
   posición de lectura. */
function updateVideoProcCard(card) {
  const kind = card.dataset.procKind;
  const title = card.querySelector('[data-proc-title]');
  const note = card.querySelector('[data-proc-note]');
  const fill = card.querySelector('[data-proc-fill]');
  const bar = card.querySelector('[data-proc-bar]');
  if (kind === 'muxing') {
    title.textContent = 'Preparando el vídeo…';
    note.textContent = 'Uniendo imagen y sonido. Podés seguir usando la app; aparece solo cuando esté listo.';
    /* Sin barra: el muxeo no informa progreso. Una barra moviéndose sola finge
       saber cuánto falta, y el barrido del marco ya dice que algo está pasando. */
    bar.hidden = true;
    return;
  }
  const job = meetingJob(card.dataset.procMid);
  const pct = Math.max(0, Math.min(100, Math.round(((job && job.progress) || 0) * 100)));
  title.textContent = (job && job.stage) || 'Transcribiendo…';
  /* La nota promete solo lo que hay: si esta reunión no tiene vídeo, decir que
     "vuelve a estar disponible" mandaría a buscar algo que no existe. */
  if (job && job.state === 'queued') {
    note.textContent = 'En cola. Empieza en cuanto termine el trabajo anterior.';
  } else if (card.dataset.procVideo) {
    note.textContent = `El vídeo vuelve a estar disponible al terminar · ${pct}%`;
  } else {
    note.textContent = `Convirtiendo el audio en texto · ${pct}%`;
  }
  bar.hidden = false;
  fill.style.width = pct + '%';
}

function applyVideoPanelTranscribing(wrap, mid) {
  const busy = meetingIsTranscribing(mid);
  wrap.classList.toggle('is-transcribing', busy);
  if (busy) wrap.style.display = 'none';
  else wrap.style.display = '';
  wrap.querySelectorAll('[data-tx-btn]').forEach(b => {
    b.disabled = busy;
    b.classList.toggle('is-disabled', busy);
    b.textContent = busy ? 'Transcribiendo...' : (b.dataset.txLabel || b.textContent);
  });
}

// ── Idiomas disponibles (fallback si el API no los devuelve) ──
function _deriveLanguages(utterances) {
  const map = {};
  for (const u of utterances) {
    if (u.kind !== 'utterance') continue;
    const lang = u.language || '';
    if (lang) map[lang] = (map[lang] || 0) + 1;
  }
  const langs = Object.entries(map).map(([code, count]) => ({ code, count }));
  langs.sort((a, b) => b.count - a.count);
  return langs;
}

function refreshVideoPanelButtons() {
  document.querySelectorAll('.video-panel[data-video-mid]').forEach(wrap => {
    applyVideoPanelTranscribing(wrap, wrap.dataset.videoMid);
  });
  document.querySelectorAll('.video-proc[data-proc-mid]').forEach(updateVideoProcCard);
  syncGeneralVideoState();
}

/* Último estado que dibujó renderGeneral. El card de progreso y el panel de
   vídeo son piezas distintas del DOM, así que pasar de uno a otro (empieza una
   transcripción, termina el muxeo) pide rehacer la pestaña, no repintar la
   barra. Comparar contra lo dibujado hace que eso ocurra UNA vez por transición
   y no en cada tic del progreso, que reiniciaría el reproductor. */
let _generalVideoState = null;

function syncGeneralVideoState() {
  if (STATE.screen !== 'meeting' || STATE.activeTab !== 'general') return;
  if (_generalVideoState === null) return;
  if (generalVideoState(STATE.transcript, STATE.selMeeting) !== _generalVideoState) renderMain();
}

// Recortador estilo CapCut: reproductor + línea de tiempo con miniaturas + manijas.
async function openClipEditor(wrap, t, isRetx) {
  // Un solo recortador a la vez: reabrirlo desde el mismo botón cierra el que hay.
  const abierto = document.querySelector('.clip-modal');
  if (abierto) { abierto.close(); abierto.remove(); return; }

  const mid = t.meeting_id || STATE.selMeeting;
  const url = await api.getMediaVideoUrl(mid);

  /* <dialog> nativo y no un div flotante: trae Esc, la retención del foco y el
     ::backdrop de fábrica, que es justo lo que el modo "ampliar" imitaba a mano
     con un .clip-backdrop y un listener de teclado propio. */
  /* Sin vídeo el recortador sigue sirviendo —marcar tramos de audio es lo
     mismo— pero sobran el reproductor y la tira de fotogramas. */
  const esAudio = !(t && t.video_path);
  const dlg = el('dialog', 'clip-modal' + (esAudio ? ' is-audio' : ''));
  dlg.innerHTML = `
    <div class="clip-modal-head">
      <div class="clip-modal-title">
        <b>Trabajar por partes</b>
        <small>Marcá los tramos que te interesan y elegí abajo qué hacer con ellos</small>
      </div>
      <button class="icon-btn clip-close" type="button" title="Cerrar (Esc)">${svg('x', 16)}</button>
    </div>
    <div class="clip-editor">
      <video class="clip-video" src="${esc(url || '')}" preload="metadata"></video>
      <div class="clip-ctrl">
        <button class="clip-cbtn clip-skip" data-d="-10" title="Retroceder 10 segundos">${svg('rewind', 14)}<span class="clip-cnum">10</span></button>
        <button class="clip-cbtn clip-play" title="Reproducir el clip seleccionado">${svg('play', 16)}</button>
        <button class="clip-cbtn clip-skip" data-d="10" title="Avanzar 10 segundos"><span class="clip-cnum">10</span>${svg('fastForward', 14)}</button>
        <span class="clip-ctrl-sep"></span>
        <button class="clip-cbtn clip-mark-a" title="El clip empieza aquí (posición actual del vídeo)">${svg('markIn', 14)}</button>
        <button class="clip-cbtn clip-mark-b" title="El clip termina aquí (posición actual del vídeo)">${svg('markOut', 14)}</button>
        <span class="clip-time">0:00 / 0:00</span>
        ${esAudio ? '' : `<button class="clip-cbtn clip-ver" type="button" title="Mostrar u ocultar el vídeo">${svg('eye', 14)}</button>`}
      </div>
      <div class="clip-tl">
        <div class="clip-thumbs is-loading"></div>
        <div class="clip-section-marks"></div>
        <div class="clip-shade sl"></div>
        <div class="clip-shade sr"></div>
        <div class="clip-sel"><span class="clip-h l"></span><span class="clip-h r"></span></div>
        <div class="clip-cursor"></div>
      </div>
      <div class="clip-scale"><span>0:00</span><span class="clip-dur">--:--</span></div>
      <div class="clip-segs"></div>
      <div class="clip-out">
        <label class="clip-opt"><input type="checkbox" class="clip-opt-clips" checked>
          <span><b>Guardar como clips</b><small>${esAudio
            ? 'Un .wav por clip, en una carpeta «clips». El corte es exacto: el audio no tiene fotogramas clave.'
            : 'Un .mp4 por clip, en una carpeta «clips». No recomprime: es rápido y no pierde calidad.'}</small></span></label>
        <label class="clip-opt"><input type="checkbox" class="clip-opt-tx">
          <span><b>Transcribir los tramos</b><small>Convierte en texto solo lo marcado, sin recorrer el vídeo entero.</small></span></label>
        <label class="clip-opt clip-opt-danger"><input type="checkbox" class="clip-opt-del" disabled>
          <span><b>Enviar el vídeo original a la papelera</b><small class="clip-del-note">Solo con los clips activados.</small></span></label>
      </div>
      <div class="clip-foot">
        <div class="clip-total">Cargando el vídeo…</div>
        <div class="clip-actions">
          <button class="btn clip-cancel" type="button">Cancelar</button>
          <button class="btn btn-primary clip-go" type="button" disabled>Transcribir selección →</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  const ed = dlg.querySelector('.clip-editor');
  if (!url) {
    ed.querySelector('.clip-total').textContent = 'No se pudo cargar el vídeo';
    return;
  }

  const video = ed.querySelector('.clip-video');
  const tl = ed.querySelector('.clip-tl');
  const sel = ed.querySelector('.clip-sel');
  const shadeL = ed.querySelector('.clip-shade.sl');
  const shadeR = ed.querySelector('.clip-shade.sr');
  const cursor = ed.querySelector('.clip-cursor');
  const segsBox = ed.querySelector('.clip-segs');
  const marksBox = ed.querySelector('.clip-section-marks');
  const totalEl = ed.querySelector('.clip-total');
  const goBtn = ed.querySelector('.clip-go');
  const state = { dur: 0, a: 0, b: 0, segs: [], active: 0 };
  const fmt = s => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

  /* Las miniaturas tardan: hasta que llegan, la tira lleva `is-loading` y late
     en vez de quedarse negra sin explicar por qué. Se piden 16 porque a lo ancho
     del modal 12 salían estiradas. */
  const tiraThumbs = ed.querySelector('.clip-thumbs');
  if (esAudio) {
    // No hay fotogramas que pedir: la tira queda como una pista lisa.
    tiraThumbs.classList.remove('is-loading');
  } else {
    api.getVideoThumbnails(mid, 16).then(thumbs => {
      const utiles = (thumbs || []).filter(th => th && th.thumb);
      tiraThumbs.classList.remove('is-loading');
      if (!utiles.length) { tiraThumbs.classList.add('is-empty'); return; }
      tiraThumbs.innerHTML = utiles.map(th =>
        `<i style="background-image:url(data:image/jpeg;base64,${th.thumb})"></i>`).join('');
    }).catch(() => {
      tiraThumbs.classList.remove('is-loading');
      tiraThumbs.classList.add('is-empty');
    });
  }

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
    const izq = state.a / state.dur * 100;
    const der = state.b / state.dur * 100;
    sel.style.left = izq + '%';
    sel.style.width = (der - izq) + '%';
    /* Se oscurece lo que queda FUERA del clip en vez de teñir lo de dentro: así
       las miniaturas del tramo elegido se ven a su color y el resto se aparta
       solo. Es lo que hace cualquier editor de vídeo. */
    shadeL.style.width = izq + '%';
    shadeR.style.left = der + '%';
    syncActiveSection();
    const secs = totalSelected();
    /* Neutro: desde aquí se puede cortar, transcribir o las dos cosas, así que
       decir "se transcribirá" prometía solo una de las tres. */
    totalEl.innerHTML = `Seleccionado <b>${fmt(secs)}</b> de ${fmt(state.dur)} <span class="clip-range">· Clip ${state.active + 1}: ${fmt(state.a)} – ${fmt(state.b)}</span>`;
    updateGo();
  }
  function paintSegs() {
    const canAdd = !!spaceNextToActive() && !isFullyCovered();
    marksBox.innerHTML = state.segs.map((s, i) => {
      if (!state.dur || i === state.active) return '';
      const left = s.start / state.dur * 100;
      const width = (s.end - s.start) / state.dur * 100;
      return `<button type="button" class="clip-section-mark" data-i="${i}" style="left:${left}%;width:${width}%" title="Clip ${i + 1}"></button>`;
    }).join('');
    marksBox.querySelectorAll('.clip-section-mark').forEach(mark => mark.onclick = e => {
      e.stopPropagation();
      activateSection(+mark.dataset.i);
    });
    let addLabel = '+ Añadir clip';
    if (!canAdd) addLabel = isFullyCovered() ? 'Todo el vídeo está cubierto' : 'Sin hueco junto al clip activo';
    /* Pestañas «Clip N» en vez de píldoras con el rango dentro: con tres o más
       tramos la fila se volvía ilegible, y el rango del activo ya se lee entero
       en el pie. Solo el activo puede borrarse, para que la × no obligue a
       apuntar fino entre pestañas. */
    segsBox.innerHTML = state.segs.map((s, i) => {
      const activo = i === state.active;
      return `<button type="button" class="clip-tab${activo ? ' is-active' : ''}" data-i="${i}"` +
        ` title="${fmt(s.start)}–${fmt(s.end)}">Clip ${i + 1}` +
        (activo && state.segs.length > 1 ? `<span class="x" title="Eliminar este clip">×</span>` : '') +
        `</button>`;
    }).join('') + `<button type="button" class="clip-add" ${canAdd ? '' : 'disabled'}>${addLabel}</button>`;
    segsBox.querySelectorAll('.clip-tab').forEach(p => p.onclick = e => {
      if (e.target.closest('.x')) return;
      activateSection(+p.dataset.i);
    });
    segsBox.querySelectorAll('.x').forEach(x => x.onclick = e => {
      const idx = +e.target.closest('.clip-tab').dataset.i;
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
  // ── Qué hacer con los tramos ──
  const optTx = ed.querySelector('.clip-opt-tx');
  const optClips = ed.querySelector('.clip-opt-clips');
  const optDel = ed.querySelector('.clip-opt-del');
  const delNote = ed.querySelector('.clip-del-note');

  /* Borrar el original y transcribir por tramos no pueden ir juntos: la
     transcripción se encola y se ejecuta después, cuando el archivo del que
     salen esos tramos ya no estaría. En vez de dejar que falle a destiempo, la
     casilla se apaga sola y dice por qué. */
  function syncOpciones() {
    optDel.disabled = !optClips.checked;
    if (optDel.disabled) optDel.checked = false;
    if (optDel.checked && optTx.checked) optTx.checked = false;
    optTx.disabled = optDel.checked;
    if (optDel.checked) {
      delNote.textContent = 'Se puede recuperar desde la papelera de Windows. La reunión pasa a mostrar el primer clip.';
    } else if (optDel.disabled) {
      delNote.textContent = 'Solo con los clips activados.';
    } else {
      delNote.textContent = 'No se borra del todo: va a la papelera de Windows. Desactiva transcribir, porque los tramos dejarían de tener de dónde salir.';
    }
    updateGo();
  }
  [optTx, optClips, optDel].forEach(c => c.addEventListener('change', syncOpciones));
  setTimeout(syncOpciones, 0);   // estado inicial, ya con updateGo() definido

  function updateGo() {
    const hayTramos = state.segs.some(s => (s.end - s.start) >= 0.5);
    const nTramos = state.segs.filter(s => (s.end - s.start) >= 0.5).length;
    const tx = optTx.checked, clips = optClips.checked;
    goBtn.disabled = !hayTramos || (!tx && !clips);
    if (!tx && !clips) goBtn.textContent = 'Elegí qué hacer';
    else if (tx && clips) goBtn.textContent = 'Cortar y transcribir →';
    else if (clips) goBtn.textContent = nTramos === 1 ? 'Crear el clip →' : `Crear ${nTramos} clips →`;
    else goBtn.textContent = 'Transcribir selección →';
  }

  // Controles de reproducción: play/pausa y saltos de ±10 s.
  const playBtn = ed.querySelector('.clip-play');
  const timeEl = ed.querySelector('.clip-time');
  let playingClip = false;   // reproduciendo el clip → pausa al llegar a su fin
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
  video.addEventListener('pause', () => { playBtn.innerHTML = svg('play', 16); playBtn.title = 'Reproducir el clip seleccionado'; });
  ed.querySelectorAll('.clip-skip').forEach(b => b.onclick = () => {
    if (!state.dur) return;
    playingClip = false;   // navegación libre: no auto-pausar en el fin del clip
    video.currentTime = Math.min(state.dur, Math.max(0, video.currentTime + Number(b.dataset.d)));
  });

  // Marcar el clip viendo el vídeo: fija inicio/fin en la posición actual.
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

  /* El reproductor arranca plegado también con vídeo: la tira de fotogramas de
     la línea de tiempo ya dice qué se está recortando, y el modal entra entero
     en pantalla sin scroll. Se despliega con el ojo cuando hace falta mirar un
     momento concreto. */
  const verBtn = ed.querySelector('.clip-ver');
  if (verBtn) {
    let visible = false;
    const pintarVer = () => {
      dlg.classList.toggle('video-oculto', !visible);
      verBtn.classList.toggle('is-on', visible);
      verBtn.title = visible ? 'Ocultar el vídeo' : 'Mostrar el vídeo';
    };
    verBtn.onclick = () => { visible = !visible; pintarVer(); };
    pintarVer();
  }

  /* Cerrar siempre pasa por aquí: `close()` dispara el evento y ahí se pausa el
     vídeo. Sin eso, salir con Esc dejaba el audio sonando bajo la pantalla. */
  function closeEditor() { dlg.close(); }
  dlg.addEventListener('close', () => { video.pause(); dlg.remove(); });
  dlg.querySelector('.clip-close').onclick = closeEditor;
  // Clic fuera del contenido: el <dialog> ocupa toda la pantalla, así que el
  // propio elemento ES el fondo.
  dlg.addEventListener('mousedown', e => { if (e.target === dlg) closeEditor(); });

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
    const quiereTx = optTx.checked && !optTx.disabled;
    const quiereClips = optClips.checked;
    const borrar = quiereClips && optDel.checked;
    goBtn.disabled = true;

    if (quiereClips) {
      // El corte es síncrono y puede tardar unos segundos: el modal se queda
      // abierto para poder dar el error sin haber perdido la selección.
      goBtn.textContent = 'Cortando…';
      let r;
      try { r = await api.exportMeetingClips(mid, all, borrar); }
      catch (e) { r = { ok: false, error: String(e) }; }
      if (!r || !r.ok) {
        toast('err', (r && r.error) || 'No se pudieron crear los clips');
        goBtn.disabled = false; updateGo();
        return;
      }
      const n = (r.clips || []).length;
      /* El corte arranca en el fotograma clave anterior, así que un clip puede
         empezar un poco antes de la marca. Se avisa solo cuando el desvío se
         nota, en vez de prometer una exactitud que el método no da. */
      const desvio = Math.max(0, ...(r.clips || []).map(c => c.start - c.real_start));
      let msg = n === 1 ? '1 clip creado' : `${n} clips creados`;
      if (desvio >= 0.5) msg += ` · empiezan hasta ${desvio.toFixed(1)} s antes de la marca`;
      if (r.deleted_original) msg += ' · el original está en la papelera';
      if (r.warning) msg += ` · ${r.warning}`;
      toast(r.warning ? 'err' : 'ok', msg, 'Abrir carpeta', () => api.openPath(r.folder));
      if (!quiereTx) {
        closeEditor();
        // La reunión ahora apunta al primer clip si se borró el original.
        if (r.deleted_original) await openMeeting(mid);
        return;
      }
    }

    closeEditor();
    if (quiereTx) await transcribeScreenVideo(mid, isRetx, all);
  };
}

async function transcribeScreenVideo(mid, force, clipSegments) {
  // Verificar limite de horas de video para plan Personal
  if (!hasFeature('video_unlimited')) {
    const pf = window._planFeatures || {};
    const maxH = pf.video_hours || 10;
    const usedH = pf.video_hours_used || 0;
    if (usedH >= maxH) {
      toast('warn', `Límite de ${maxH}h de video alcanzado (${usedH.toFixed(1)}h usadas) — Disponible en Helpmeet Pro`);
      return;
    }
  }
  // La transcripción del vídeo va en SEGUNDO PLANO: puedes seguir grabando otro.
  let f = null;
  try { f = await api.transcribeMeetingVideo(mid, force, clipSegments || null); }
  catch (e) { f = { ok: false, error: e && e.message }; }
  if (f && f.already) { toast('info', 'Este vídeo ya está transcrito'); return; }
  if (f && f.ok) {
    // Actualizar contador local de horas (el backend también lo hace)
    if (!hasFeature('video_unlimited') && window._planFeatures) {
      const durH = (f.video_duration_seconds || 0) / 3600;
      window._planFeatures.video_hours_used = (window._planFeatures.video_hours_used || 0) + durH;
    }
    await refreshMeetings(STATE.selInit);
    if (STATE.screen === 'meeting' && STATE.selMeeting === mid) await openMeeting(mid, true);
    toast('ok', 'Se transcribe en segundo plano · puedes seguir grabando');
  } else {
    toast('err', errMsg(f && f.error, 'No se pudo transcribir el vídeo'));
  }
}

/* Fila de frase con el markup del mockup: [hora mm:ss] [texto] [estrella].
   La construye también window.addUtterance en cada frase que llega en vivo, así
   que su forma es parte del contrato con el motor de transcripción.
   Solo se etiqueta "Yo": las frases del interlocutor son el caso por defecto —
   la mayoría del texto— y repetir "Los demás" en cada línea era ruido. */
function utterance(u) {
  const d = el('div', 'utt utterance turn' + (u.speaker === 'me' ? ' me' : '') + (u.highlighted ? ' highlighted' : ''));
  d.tabIndex = 0;
  d.dataset.id = u.id;
  const esYo = u.speaker === 'me';
  const quien = u.display_name || (esYo ? 'Yo' : '');
  d.innerHTML =
    `<div class="utt-time mono">${esc(u.time || '')}</div>` +
    `<div class="utt-body u-body">` +
      (quien && esYo ? `<span class="utt-speaker me">${esc(quien)}</span>` : '') +
      `<span class="u-text">${esc(u.text)}</span>` +
    `</div>` +
    `<button class="utt-star${u.highlighted ? ' active' : ''}" type="button" data-act="star" ` +
      `title="${u.highlighted ? 'Quitar de importantes' : 'Marcar como importante'}" ` +
      `aria-label="${u.highlighted ? 'Quitar de importantes' : 'Marcar como importante'}">` +
      `<svg aria-hidden="true"><use href="#i-star"/></svg></button>`;
  d.querySelector('.utt-star').onclick = () => utteranceAction('star', u, d);
  // Editar y eliminar pasan al menú contextual de la frase: el mockup deja la
  // fila con un solo control visible para que la lectura corrida no se corte.
  d.oncontextmenu = (e) => {
    e.preventDefault();
    openMenu(e, [
      { label: u.highlighted ? 'Quitar de importantes' : 'Marcar como importante', icon: 'star', onClick: () => utteranceAction('star', u, d) },
      { label: 'Editar frase', icon: 'edit', onClick: () => utteranceAction('edit', u, d) },
      { sep: true },
      { label: 'Eliminar frase', icon: 'trash', danger: true, onClick: () => utteranceAction('del', u, d) },
    ]);
  };
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
    <div class="u-body"><p class="u-text">${esc(u.text || '')}</p></div>
    <div class="u-actions">
      <button class="u-act" data-act="edit" title="Editar nota" aria-label="Editar nota">${svg('edit', 14)}</button>
      <button class="u-act danger" data-act="del" title="Eliminar nota" aria-label="Eliminar nota">${svg('trash', 14)}</button>
    </div>`;
  d.querySelectorAll('.u-act').forEach(b => b.onclick = () => noteContextAction(b.dataset.act, u, d));
  return d;
}
function contextEvent(u) {
  const d = el('div', 'utterance turn ctx-entry');
  d.dataset.id = u.id;
  d.innerHTML = `
    <div class="u-side"><span class="u-tag">Contexto</span>${u.time ? `<span class="u-time mono">${esc(u.time)}</span>` : ''}</div>
    <div class="u-body"><p class="u-text">${esc(u.text || '')}</p></div>
    <div class="u-actions">
      <button class="u-act" data-act="edit" title="Editar contexto" aria-label="Editar contexto">${svg('edit', 14)}</button>
      <button class="u-act danger" data-act="del" title="Eliminar contexto" aria-label="Eliminar contexto">${svg('trash', 14)}</button>
    </div>`;
  d.querySelectorAll('.u-act').forEach(b => b.onclick = () => noteContextAction(b.dataset.act, u, d));
  return d;
}

function noteContextAction(act, u, node) {
  if (act === 'del') {
    confirmModal('Eliminar entrada', 'Se eliminara permanentemente.', 'Eliminar', async () => {
      const r = await api.v2.deleteNote(u.id);
      if (r && r.ok) { node.remove(); toast('ok', 'Entrada eliminada'); }
      else toast('err', 'No se pudo eliminar');
    });
  } else if (act === 'edit') {
    const body = node.querySelector('.u-body');
    const orig = u.text;
    body.innerHTML = `<textarea class="field" placeholder="Editar..." maxlength="5000" style="height:auto;min-height:60px;padding:9px;resize:vertical">${esc(orig)}</textarea>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary" data-s>Guardar</button><button class="btn" data-c>Cancelar</button></div>`;
    body.querySelector('[data-c]').onclick = () => openMeeting(STATE.selMeeting, true);
    body.querySelector('[data-s]').onclick = async () => {
      const v = body.querySelector('textarea').value.trim();
      await api.v2.updateNote(u.id, { text: v }); toast('ok', 'Cambios guardados'); openMeeting(STATE.selMeeting, true);
    };
    body.querySelector('textarea').focus();
  }
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
  body.innerHTML = `<textarea class="field" placeholder="Editar frase..." maxlength="5000" style="height:auto;min-height:60px;padding:9px;resize:vertical">${esc(orig)}</textarea>
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
      <textarea id="partAdd" class="field" maxlength="2000" style="height:auto;min-height:54px;padding:9px" placeholder="Un nombre completo por linea (ej. Victor Marquina)"></textarea>
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
        <input class="field part-name" placeholder="Nombre del participante" maxlength="100" value="${esc(p.name)}">
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
        <div class="note-item-meta">
          ${displayTime ? `<span class="note-item-time">${esc(displayTime)}</span>` : '<span></span>'}
          <div class="note-item-actions">
            <button class="u-act" data-act="edit" title="Editar nota" aria-label="Editar nota">${svg('edit', 12)}</button>
            <button class="u-act danger" data-act="del" title="Eliminar nota" aria-label="Eliminar nota">${svg('trash', 12)}</button>
          </div>
        </div>
      </div>`;
    item.querySelector('[data-act="edit"]').onclick = () => {
      const body = item.querySelector('.note-item-body');
      const orig = n.text;
      body.innerHTML = `<textarea class="field" style="height:auto;min-height:60px;padding:8px;resize:vertical;width:100%">${esc(orig)}</textarea>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="btn btn-primary btn-sm" data-s>Guardar</button><button class="btn btn-sm" data-c>Cancelar</button></div>`;
      body.querySelector('[data-c]').onclick = () => { STATE.activeTab = 'notas'; renderMain(); };
      body.querySelector('[data-s]').onclick = async () => {
        const v = body.querySelector('textarea').value.trim();
        await api.v2.updateNote(n.id, { text: v }); toast('ok', 'Nota actualizada');
        STATE.activeTab = 'notas'; renderMain();
      };
      body.querySelector('textarea').focus();
    };
    item.querySelector('[data-act="del"]').onclick = () => {
      confirmModal('Eliminar nota', 'Se eliminara permanentemente.', 'Eliminar', async () => {
        const r = await api.v2.deleteNote(n.id);
        if (r && r.ok) {
          item.remove();
          // Quitar del estado
          if (STATE.transcript && STATE.transcript.assets && STATE.transcript.assets.notes) {
            STATE.transcript.assets.notes = STATE.transcript.assets.notes.filter(x => x.id !== n.id);
          }
          if (!list.querySelector('.note-item')) list.innerHTML = `<div class="notes-empty">${svg('note', 20)}<p>Aun no hay notas.</p></div>`;
          toast('ok', 'Nota eliminada');
        } else toast('err', 'No se pudo eliminar');
      });
    };
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

// Miniatura del video en la cabecera de la reunión: mismo patrón que
// loadCaptureThumb (carga aparte, cae en silencio si no hay video/falla).
async function loadMeetingThumb(btn, meetingId) {
  try {
    const r = await api.getMeetingThumbnail(meetingId);
    if (!r || !r.data_url) return;
    btn.classList.remove('is-empty');
    btn.style.backgroundImage = `url("${r.data_url}")`;
    btn.onclick = () => openLightbox(r.data_url);
  } catch (e) { /* sin miniatura: el botón queda oculto (is-empty) */ }
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
  // El input vive en el <dialog> del buscador y puede no estar montado: opcional.
  head.querySelector('#clearSearch').onclick = () => { const i = $('#searchInput'); if (i) i.value = ''; backToTree(); };
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
  const wrap = el('div', 'content-scroll scroll');
  const head = el('div', 'content-inner');

  const h1 = el('h1', 'page-title');
  h1.textContent = isTrash ? 'Papelera' : 'Archivados';
  head.appendChild(h1);

  /* Conmutador Papelera / Archivados. Archivados salió del pie del sidebar para
     que el riel colapsado quede con dos iconos como el mockup; vive acá porque
     las dos son la misma idea —cosas retiradas de la vista— y comparten la
     misma pantalla y las mismas acciones (restaurar, eliminar). */
  const tabs = el('div', 'segmented-pill');
  tabs.setAttribute('role', 'tablist');
  tabs.style.marginBottom = '18px';
  [['trash', 'Papelera', 'i-trash'], ['archive', 'Archivados', 'i-archive']].forEach(([id, txt, ico]) => {
    const b = el('button', 'tab-btn' + ((id === 'trash') === isTrash ? ' active' : ''));
    b.type = 'button'; b.setAttribute('role', 'tab');
    b.innerHTML = `<svg><use href="#${ico}"/></svg>${txt}`;
    b.onclick = () => { STATE.screen = id; renderMain(); renderTopStatus(); };
    tabs.appendChild(b);
  });
  head.appendChild(tabs);

  if (isTrash) {
    const emptyBtn = el('button', 'btn-outline');
    emptyBtn.id = 'emptyTrash';
    emptyBtn.type = 'button';
    emptyBtn.innerHTML = '<svg class="icon icon-sm"><use href="#i-trash"/></svg>Vaciar la papelera';
    tabs.parentNode.insertBefore(emptyBtn, tabs.nextSibling);
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
  // La clase .actionbar--dock se retiró con la Fase 7: era la que ponía
  // pointer-events:none en el contenedor, y al reemplazar .dock por .rec-dock
  // dejó de haber quien lo reactivara — el dock se veía pero no se podía pulsar.
  if (s === 'idle') {
    // Siempre habilitados: sin proyecto elegido, el clic abre el modal
    // "¿En qué proyecto?" y la acción continúa sola al elegir/crear uno.
    /* Dock en reposo (mockup): píldora compacta anclada donde después entra el
       panel de grabación, así uno sustituye al otro sin que la vista salte.
       Los dos modos van como icono y despliegan su nombre al pasar el mouse por
       el GRUPO entero, no por cada botón: así se leen los dos a la vez y se
       pueden comparar antes de elegir. */
    bar.innerHTML = `
      <div class="rec-dock">
        <div class="rec-actions is-reveal">
          <button class="rec-cta" id="abRecord" type="button" title="Grabar reunión (audio)" aria-label="Grabar reunión (audio)">
            <svg class="icon"><use href="#i-audiowave"/></svg>
            <span class="rec-label-grid"><span class="rec-label">Grabar</span></span>
          </button>
          <button class="rec-cta-screen" id="abScreen" type="button" title="Grabar pantalla" aria-label="Grabar pantalla">
            <svg class="icon"><use href="#i-monitor"/></svg>
            <span class="rec-label-grid"><span class="rec-label">Grabar pantalla</span></span>
          </button>
          <span class="rec-foot-sep" aria-hidden="true"></span>
          <button class="dock-import-btn" id="abUpload" type="button" aria-haspopup="true" aria-expanded="false" title="Importar audio o vídeo" aria-label="Importar audio o vídeo">
            <svg class="icon"><use href="#i-upload"/></svg>
            <span class="rec-label-grid"><span class="rec-label">Importar</span></span>
            <svg class="icon rec-import-chev"><use href="#i-chevup"/></svg>
          </button>
          <span class="rec-foot-sep" aria-hidden="true"></span>
          <button class="dock-mute-btn${STATE.micMuted ? ' is-muted' : ''}" id="btnMic" type="button" aria-pressed="${STATE.micMuted}"
                  title="${STATE.micMuted ? 'Empezar con el micrófono activo' : 'Empezar con el micrófono silenciado'}"
                  aria-label="${STATE.micMuted ? 'Empezar con el micrófono activo' : 'Empezar con el micrófono silenciado'}">
            <svg class="icon"><use href="#i-mic${STATE.micMuted ? '-off' : ''}"/></svg>
          </button>
        </div>
      </div>`;
    // Sin proyecto seleccionado: modal para elegir/crear uno y seguir con la acción
    const needProject = (cont) => pickInitiativeModal((iid) => { selectInitiative(iid); cont(); });
    const _rec = () => withRecordingConsent(() => startMeetingRecording());
    const _scr = () => withRecordingConsent(() => openScreenPanel());
    const _imp = (kind) => confirmImportDestination(STATE.selInit, kind,
      (folderId) => doImport(document.getElementById('abUpload'), kind, folderId));
    bar.querySelector('#btnMic').onclick = toggleMic;
    /* Los dos modos son botones directos, no un desplegable: son las dos
       acciones principales de la app y esconderlas tras un menú añadía un clic
       a lo que más se usa.
       Tampoco pasan por needProject: el destino lo resuelve proyectoDestino()
       —último usado, o "General" creado al vuelo— sin abrir ningún diálogo. */
    bar.querySelector('#abRecord').onclick = _rec;
    bar.querySelector('#abScreen').onclick = _scr;
    bar.querySelector('#abUpload').onclick = (e) => _openRecordPicker(e.currentTarget, [
      { icon: 'upload', label: 'Importar video', run: () => canRecord ? _imp('video') : needProject(() => _imp('video')) },
      { icon: 'upload', label: 'Importar audio', run: () => canRecord ? _imp('audio') : needProject(() => _imp('audio')) },
    ]);
    // El dock se acaba de reconstruir: si había una selección en curso, vuelve
    // a apartarse — las dos barras ocupan el mismo punto de la pantalla.
    if (typeof refrescarSeleccion === 'function') refrescarSeleccion();
  } else if (s === 'recording' || s === 'recording-local' || s === 'recording-cloud') {
    // Grabación de solo audio: sin botón "Captura" (capturar pantalla
    // solo tiene sentido cuando se está grabando la pantalla).
    // El panel flotante reemplaza a la barra de botones (FASE 7).
    bar.replaceChildren(recPanel({ modo: 'audio' }));
  } else if (s === 'processing') {
    /* Transcribiendo en segundo plano: píldora flotante en el mismo punto que el
       dock y el panel. Antes era una franja a lo ancho; con el contenedor en
       display:contents se desarmaba en botones sueltos apilados. */
    bar.replaceChildren(procPanel());
  } else if (s === 'screen-recording') {
    // Mismo panel que en audio: la única diferencia real es que en pantalla hay
    // monitor que elegir, área que recortar y captura que tomar.
    bar.replaceChildren(recPanel({ modo: 'screen' }));
  } else {
    bar.replaceChildren();
  }
}

/* Píldora de "transcribiendo en segundo plano". */
function procPanel() {
  const p = el('div', 'proc-dock');
  const pct = STATE.jobDeterminate ? Math.round(STATE.jobProgress) + '%' : processingElapsed();
  p.innerHTML =
    `<span class="spinner"></span>` +
    `<span class="proc-dock-stage">${esc(STATE.jobStage || 'Transcribiendo…')}</span>` +
    `<span class="proc-track"><i class="${STATE.jobDeterminate ? '' : 'indeterminate'}" ` +
      `style="width:${STATE.jobDeterminate ? STATE.jobProgress : 35}%"></i></span>` +
    `<span class="proc-dock-pct mono">${esc(pct)}</span>`;
  if (v2Available('cancel_meeting_job')) {
    const b = el('button', 'btn-ghost');
    b.type = 'button';
    b.textContent = 'Cancelar';
    b.onclick = cancelJob;
    p.appendChild(b);
  }
  return p;
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
  STATE.docsFilter = STATE.docsFilter || 'all';
  STATE.docsOcr = STATE.docsOcr || 'auto';
  if (STATE.docsImages === undefined) STATE.docsImages = false;

  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');
  inner.style.maxWidth = '760px';

  // ---- Cabecera ----
  const head = el('div', 'docs-head');
  head.innerHTML =
    `<h1 class="page-title">Documentos <span class="docs-arrow">→</span> .md</h1>` +
    `<p class="docs-sub">Convierte PDF, Word, PowerPoint y hojas de cálculo a Markdown ` +
    `para pegárselo a una IA. El original se guarda intacto junto al .md.</p>`;
  inner.appendChild(head);

  // ---- Barra: espacio · OCR · extraer imágenes · importar ----
  const barra = el('div', 'docs-bar');

  const pickEspacio = _docsPick(
    STATE.docsFilter === 'all' ? 'Todos los espacios'
      : (STATE.initiatives.find(x => x.id === STATE.docsFilter)?.name || 'Todos los espacios'),
    'i-folder',
    (e) => openMenu(e, [{ label: 'Todos los espacios', onClick: () => { STATE.docsFilter = 'all'; renderMain(); } }]
      .concat(STATE.initiatives.map(it => ({
        label: it.name, onClick: () => { STATE.docsFilter = it.id; renderMain(); },
      }))))
  );

  const OCR_TXT = { auto: 'OCR: Automático', force: 'OCR: Forzar', off: 'OCR: Desactivado' };
  const pickOcr = _docsPick(OCR_TXT[STATE.docsOcr], 'i-scan', (e) => openMenu(e,
    Object.keys(OCR_TXT).map(k => ({
      label: OCR_TXT[k], onClick: () => { STATE.docsOcr = k; renderMain(); },
    }))));

  // Casilla nativa oculta + caja dibujada: el teclado y el clic sobre el texto
  // funcionan sin JS.
  const chkImgs = el('label', 'rec-pick docs-check');
  chkImgs.innerHTML =
    `<input type="checkbox" class="docs-check-input" id="docsExtractImages"${STATE.docsImages ? ' checked' : ''}>` +
    `<span class="docs-check-box"><svg class="icon"><use href="#i-check"/></svg></span>` +
    `<span>Extraer imágenes</span>`;
  chkImgs.querySelector('input').onchange = (e) => { STATE.docsImages = e.target.checked; };

  const bImport = el('button', 'btn-pill-secondary docs-import');
  bImport.type = 'button';
  bImport.innerHTML = '<svg class="icon icon-sm"><use href="#i-upload"/></svg>Importar documentos';
  bImport.onclick = () => _docsImportar();

  barra.append(pickEspacio, pickOcr, chkImgs, bImport);
  inner.appendChild(barra);

  // ---- Grupos por espacio ----
  const grupos = el('div', 'doc-groups');
  grupos.innerHTML = '<div class="empty-state compact"><div class="l1">Cargando…</div></div>';
  inner.appendChild(grupos);

  api.listAllDocuments().then(docs => {
    docs = docs || [];
    grupos.replaceChildren();

    const visibles = STATE.docsFilter === 'all'
      ? docs : docs.filter(d => d.initiative_id === STATE.docsFilter);

    if (!visibles.length) {
      const v = el('div', 'empty-state');
      v.innerHTML =
        `<svg class="icon icon-lg"><use href="#i-pages"/></svg>` +
        `<div class="l1">Sin documentos convertidos</div>` +
        `<div class="l2">Importá un PDF, Word o PowerPoint y lo vas a encontrar acá como .md.</div>`;
      grupos.appendChild(v);
      return;
    }

    // Agrupados por espacio, ordenados por actividad reciente (no por el orden
    // del menú): lo que se tocó último va arriba.
    const porEsp = {};
    visibles.forEach(d => {
      const k = d.initiative_id;
      (porEsp[k] = porEsp[k] || { nombre: d.initiative_name, color: d.color, docs: [] }).docs.push(d);
    });

    Object.keys(porEsp).forEach((k, i) => {
      const g = porEsp[k];
      const sec = el('section', 'doc-group' + (i === 0 ? ' is-first' : ''));
      sec.innerHTML =
        `<div class="doc-group-label">` +
          `<span class="doc-group-dot" style="background:${esc(g.color || 'var(--text-muted)')}"></span>` +
          `${esc(g.nombre)}<span class="doc-group-count">${g.docs.length}</span>` +
        `</div>`;
      const lista = el('div', 'doc-list');
      g.docs.forEach(d => lista.appendChild(_docRow(d)));
      sec.appendChild(lista);
      grupos.appendChild(sec);
    });
  }).catch(() => {
    grupos.replaceChildren();
    const v = el('div', 'empty-state compact');
    v.innerHTML = '<div class="l1">No se pudieron cargar los documentos.</div>';
    grupos.appendChild(v);
  });

  wrap.appendChild(inner);
  return wrap;
}

/* Importar: pide el proyecto destino si se está viendo "Todos los espacios",
   porque un documento siempre se convierte dentro de uno concreto. */
async function _docsImportar() {
  let destino = STATE.docsFilter;
  if (destino === 'all') {
    if (!(STATE.initiatives || []).length) { toast('err', 'Creá un proyecto primero'); return; }
    destino = await new Promise(res => pickInitiativeModal(iid => res(iid)));
    if (!destino) return;
  }
  const r = await api.pickAndConvertDocuments(destino, STATE.docsOcr, STATE.docsImages).catch(() => null);
  if (r && r.ok === false && r.error) { toast('err', r.error); return; }
  const n = (r && (r.converted || r.count)) || 0;
  if (n) toast('ok', `${n} ${n === 1 ? 'documento convertido' : 'documentos convertidos'}`);
  renderMain();
}

/* Píldora con el valor elegido + chevron. */
function _docsPick(valor, icono, onClick) {
  const b = el('button', 'rec-pick');
  b.type = 'button';
  b.innerHTML =
    `<svg class="icon"><use href="#${icono}"/></svg>` +
    `<span>${esc(valor)}</span>` +
    `<svg class="icon rec-pick-chev"><use href="#i-chevdown-fallback"/></svg>`;
  // El sprite no trae chevron hacia abajo: se usa el derecho rotado.
  const chev = b.querySelector('.rec-pick-chev use');
  chev.setAttribute('href', '#i-chevright');
  b.querySelector('.rec-pick-chev').style.transform = 'rotate(90deg)';
  b.onclick = onClick;
  return b;
}

/* Fila de documento. Las acciones aparecen al pasar el mouse; el mensaje de
   error se ve siempre, porque es estado y no una acción a descubrir. */
function _docRow(d) {
  const r = el('div', 'doc-row');
  const base = String(d.name || '').replace(/\.md$/i, '');
  const ext = (d.original_name || '').split('.').pop().toUpperCase();
  const fecha = d.created_at ? soFecha(d.created_at) : '';

  const insignias = [];
  if (fecha) insignias.push(`<span class="doc-badge date">${esc(fecha)}</span>`);
  if (ext) insignias.push(`<span class="doc-badge">${esc(ext)}</span>`);
  if (d.ocr) insignias.push(`<span class="doc-badge ocr"><svg class="icon"><use href="#i-scan"/></svg>OCR</span>`);
  if (d.images) insignias.push(`<span class="doc-badge"><svg class="icon"><use href="#i-image"/></svg>${d.images} ${d.images === 1 ? 'imagen' : 'imágenes'}</span>`);

  r.innerHTML =
    `<span class="doc-ico"><svg class="icon"><use href="#i-doc"/></svg></span>` +
    `<div class="doc-main">` +
      `<span class="doc-name">${esc(d.name || '')}</span>` +
      `<span class="doc-badges">${insignias.join('')}</span>` +
    `</div>`;

  const acciones = el('div', 'doc-actions');

  const bVer = el('button', 'doc-view');
  bVer.type = 'button';
  bVer.innerHTML = '<svg class="icon"><use href="#i-eye"/></svg>Ver';
  bVer.onclick = () => openDocModal(d);
  acciones.appendChild(bVer);

  const bCopiar = el('button', 'doc-act');
  bCopiar.type = 'button'; bCopiar.title = 'Copiar el .md al portapapeles';
  bCopiar.innerHTML = '<svg class="icon"><use href="#i-copy"/></svg>';
  bCopiar.onclick = async () => {
    const res = await api.readDocument(d.initiative_id, d.name).catch(() => null);
    if (res && res.ok) { await navigator.clipboard.writeText(res.text || ''); toast('ok', 'Markdown copiado'); }
    else toast('err', 'No se pudo leer el documento');
  };
  acciones.appendChild(bCopiar);

  const bCarpeta = el('button', 'doc-act');
  bCarpeta.type = 'button'; bCarpeta.title = 'Abrir la carpeta del documento';
  bCarpeta.innerHTML = '<svg class="icon"><use href="#i-folder"/></svg>';
  bCarpeta.onclick = () => api.openPath(d.folder_path);
  acciones.appendChild(bCarpeta);

  const bBorrar = el('button', 'doc-act doc-del');
  bBorrar.type = 'button'; bBorrar.title = 'Eliminar el documento';
  bBorrar.innerHTML = '<svg class="icon"><use href="#i-trash"/></svg>';
  bBorrar.onclick = () => confirmModal('Eliminar documento',
    `Se elimina «${base}» y su original. No se puede deshacer.`, 'Eliminar', async () => {
      await api.deleteDocument(d.initiative_id, d.name).catch(() => {});
      toast('ok', 'Documento eliminado');
      renderMain();
    });
  acciones.appendChild(bBorrar);

  r.appendChild(acciones);
  return r;
}

/* ============================================================
   4b. VISTA: TODAS LAS INICIATIVAS
   ============================================================ */
const _initNotesKey = id => `hm.initNote.${id}`;
function _getInitNote(id) { return localStorage.getItem(_initNotesKey(id)) || ''; }
function _setInitNote(id, val) { val ? localStorage.setItem(_initNotesKey(id), val) : localStorage.removeItem(_initNotesKey(id)); }

function viewAllInitiatives() {
  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');
  inner.style.maxWidth = '860px';

  const inis = STATE.initiatives || [];
  const head = el('div', 'esp-head');
  head.innerHTML =
    `<h1 class="page-title">Espacios</h1>` +
    `<span class="esp-count">${inis.length} ${inis.length === 1 ? 'espacio' : 'espacios'}</span>`;
  inner.appendChild(head);

  if (!inis.length) {
    const v = el('div', 'empty-state');
    v.innerHTML =
      `<svg class="icon icon-lg"><use href="#i-folder"/></svg>` +
      `<div class="l1">Todavía no hay espacios</div>` +
      `<div class="l2">Creá el primero para empezar a grabar reuniones dentro.</div>`;
    inner.appendChild(v);
    wrap.appendChild(inner);
    return wrap;
  }

  const caja = el('div', 'esp-table-wrap');
  const tabla = el('table', 'esp-table');
  tabla.innerHTML =
    `<thead><tr>` +
      // scope="col" no es decorativo: sin él, un lector de pantalla no sabe que
      // "98" pertenece a la columna "Reuniones" y lee las celdas como números
      // sueltos, sin la cabecera que les da sentido.
      `<th scope="col">Espacio</th><th scope="col">Última actividad</th>` +
      `<th scope="col" class="esp-num">Reuniones</th><th scope="col" class="esp-num">Duración</th><th scope="col">Pendientes</th>` +
    `</tr></thead>`;
  const tbody = el('tbody');

  inis.forEach(it => {
    const ms = STATE.meetingsByInit[it.id] || [];
    const ordenadas = [...ms].sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
    const ultima = ordenadas[0];
    const minutos = ms.reduce((s, m) => s + _minutosDe(m), 0);
    const durTxt = minutos >= 60
      ? `${Math.floor(minutos / 60)} h ${Math.round(minutos % 60)} m`
      : `${Math.round(minutos)} m`;
    const pendientes = ms.filter(m => m.status !== 'done').length;

    const tr = el('tr');

    const tdNombre = el('td', 'esp-name');
    const inner2 = el('div', 'esp-name-inner');
    const tog = el('button', 'esp-toggle');
    tog.type = 'button';
    tog.setAttribute('aria-expanded', 'false');
    tog.setAttribute('aria-label', 'Ver las reuniones de ' + it.name);
    tog.innerHTML = '<svg><use href="#i-chevright"/></svg>';
    const punto = el('span', 'dot');
    punto.style.background = _initColor(it) || 'var(--text-muted)';
    const txt = el('span', 'esp-name-txt');
    txt.textContent = it.name; txt.title = it.name;
    inner2.append(tog, punto, txt);
    tdNombre.appendChild(inner2);

    const tdAct = el('td');
    tdAct.textContent = ultima ? `${soFecha(ultima.started_at)} · ${ultima.time || ''}` : '—';
    const tdN = el('td', 'esp-num'); tdN.textContent = ms.length;
    const tdDur = el('td', 'esp-num'); tdDur.textContent = ms.length ? durTxt : '—';

    const tdPend = el('td');
    if (pendientes) {
      const p = el('button', 'esp-pend');
      p.type = 'button';
      p.textContent = `${pendientes} por transcribir`;
      p.title = 'Abrir el espacio para transcribirlas';
      p.onclick = (e) => { e.stopPropagation(); selectInitiative(it.id); };
      tdPend.appendChild(p);
    } else {
      const ok = el('span', 'esp-ok'); ok.textContent = ms.length ? 'Al día' : '—';
      tdPend.appendChild(ok);
    }

    tr.append(tdNombre, tdAct, tdN, tdDur, tdPend);
    // Clic en la fila (fuera del desplegable) abre el espacio.
    tr.onclick = (e) => { if (!e.target.closest('.esp-toggle, .esp-pend')) selectInitiative(it.id); };
    tbody.appendChild(tr);

    // Fila de detalle: las reuniones del espacio, agrupadas por mes.
    const trDet = el('tr', 'esp-detail');
    trDet.hidden = true;
    const tdDet = el('td'); tdDet.colSpan = 5;
    const sub = el('div', 'esp-sub');
    if (!ordenadas.length) {
      const v = el('div', 'esp-sub-empty'); v.textContent = 'Sin reuniones todavía';
      sub.appendChild(v);
    } else {
      let mes = null;
      ordenadas.slice(0, 12).forEach(m => {
        const et = m.month_label || 'Sin fecha';
        if (et !== mes) {
          const g = el('div', 'esp-sub-month'); g.textContent = et;
          sub.appendChild(g); mes = et;
        }
        const f = el('button', 'esp-sub-row');
        f.type = 'button';
        f.innerHTML =
          `<svg class="icon"><use href="#i-${m.source === 'screen' ? 'monitor' : 'audiowave'}"/></svg>` +
          `<span class="esp-sub-title">${esc(_fmtMeetingLabel(m))}</span>` +
          `<span class="esp-sub-dur">${esc(_subtituloReunion(m))}</span>` +
          `<span class="esp-sub-time">${esc(m.time || '')}</span>`;
        f.onclick = () => { STATE.selInit = it.id; openMeeting(m.id); };
        sub.appendChild(f);
      });
    }
    tdDet.appendChild(sub);
    trDet.appendChild(tdDet);
    tbody.appendChild(trDet);

    tog.onclick = (e) => {
      e.stopPropagation();
      const abierta = trDet.hidden;
      trDet.hidden = !abierta;
      tog.setAttribute('aria-expanded', abierta ? 'true' : 'false');
    };
  });

  tabla.appendChild(tbody);
  caja.appendChild(tabla);

  const nuevo = el('button', 'esp-new');
  nuevo.type = 'button';
  nuevo.innerHTML = '<svg class="icon"><use href="#i-plus"/></svg>Nuevo espacio';
  nuevo.onclick = promptNewInitiative;
  caja.appendChild(nuevo);

  inner.appendChild(caja);
  wrap.appendChild(inner);
  return wrap;
}
/* ============================================================
   5. SIDEBAR
   ============================================================ */
let _sidebarSearch = '';

// Etiqueta de reunión estilo "vie 04 Jul" (día en minúscula, mes con mayúscula inicial).
// Solo reformatea los títulos autogenerados por fecha (empiezan por DD/MM/YY);
// respeta los nombres que el usuario haya puesto a mano.
function _fmtMeetingLabel(m, opts) {
  const t = (m && m.title) || '';
  const d = m && m.started_at ? new Date(m.started_at) : null;
  /* Título por defecto (la fecha dd/mm/aa que pone el grabador): se muestra
     como "vie 31 Jul 1:22 PM" — día, fecha y hora.

     Antes acá devolvía "Reunión de N frases" y era peor por dos razones. Una,
     **no es un nombre**: cambia solo a medida que avanza la transcripción, así
     que la misma reunión se llama distinto según cuándo la mires. Dos, tres
     reuniones seguidas sin nombre quedaban como "Reunión de 5 / 6 / 7 frases",
     que no distingue nada — la hora sí. El recuento no se pierde: bajó al
     subtítulo, junto a la duración, que es donde vive lo medible. */
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(t.trim()) && d && !isNaN(d)) {
    /* En el calendario NO: la celda ya está dentro de su columna de día y trae
       su propia hora al lado, así que el nombre-fecha repetiría lo mismo tres
       veces en la misma tarjeta. Ahí dice "Sin nombre", y lo que distingue una
       reunión de otra dentro del mismo día es la hora, que está justo encima.
       El recuento de frases tampoco entra: la celda mide una columna de siete y
       "1 min · 330 frases" sale cortado a media palabra. */
    if (opts && opts.enCalendario) return 'Sin nombre';
    const hhmm = (m.started_at || '').substring(11, 16);
    const time = hhmm ? ' ' + _calFmtTime(hhmm) : '';
    return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}${time}`;
  }
  // Si es el nuevo formato por defecto "Reunion mie 8 Jul 21:53", mostrar corto
  if (/^Reunion (lun|mar|mie|jue|vie|sab|dom) \d{1,2} (Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic) \d{2}:\d{2}$/.test(t.trim())) {
    return t.replace('Reunion ', '');
  }
  return t || 'Sin titulo';
}

/* ---- Fila de proyecto del sidebar (FASE 1 del rediseño) ----
   Markup del mockup: contenedor .projitem.nested con dos objetivos de clic
   independientes — el nombre navega, el "···" abre el menú. La versión
   anterior era un árbol desplegable que mostraba las reuniones y las carpetas
   dentro del propio sidebar; el mockup lo aplana a propósito: las reuniones
   viven en la pantalla del proyecto y las carpetas dentro de su pestaña
   Reuniones, no en el panel lateral. */
function _renderInitRow(tree, it) {
  const isSelected = STATE.selInit === it.id && STATE.screen === 'initiative';
  const pcolor = it.color || avatarColorFor(it.name);

  const row = el('div', 'projitem nested' + (isSelected ? ' active' : '') + (it.pinned ? ' pinned' : ''));
  row.dataset.iid = it.id;

  const nav = el('button', 'proj-row-nav');
  nav.type = 'button';
  nav.title = it.name || '';
  nav.innerHTML =
    `<svg class="icon icon-sm" style="color:${esc(pcolor)}"><use href="#i-folder"/></svg>` +
    `<span class="label-text">${esc(it.name)}</span>` +
    `<svg class="proj-pin"><use href="#i-star"/></svg>`;
  nav.onclick = () => selectInitiative(it.id);

  const menuBtn = el('button', 'proj-row-menu-btn');
  menuBtn.type = 'button';
  menuBtn.setAttribute('aria-label', 'Más acciones para ' + (it.name || ''));
  menuBtn.setAttribute('aria-haspopup', 'true');
  menuBtn.innerHTML = '<svg class="icon icon-sm"><use href="#i-more"/></svg>';
  menuBtn.onclick = (e) => { e.stopPropagation(); openInitiativeMenu(e, it.id); };

  row.append(nav, menuBtn);
  // Clic derecho en cualquier punto de la fila: mismo menú.
  row.oncontextmenu = (e) => { e.preventDefault(); openInitiativeMenu(e, it.id); };
  tree.appendChild(row);
}

function renderSidebar() {
  const tree = $('#sidebarTree');
  if (!tree) return;
  tree.replaceChildren();

  /* "Todas mis notas" primero: la vista agregada de las reuniones de todos los
     proyectos. No es un proyecto —no existe en la base, no se renombra ni se
     borra, y no aparece como destino al guardar— así que va sin punto de color
     ni menú "···", que es lo que la distingue de las filas de abajo. */
  {
    const total = Object.values(STATE.meetingsByInit || {}).reduce((s, ms) => s + (ms || []).length, 0);
    const fila = el('div', 'projitem nested proj-all' + (STATE.screen === 'allnotes' ? ' active' : ''));
    const nav = el('button', 'proj-row-nav');
    nav.type = 'button';
    nav.title = 'Las reuniones de todos los proyectos';
    nav.innerHTML =
      `<svg class="icon icon-sm"><use href="#i-layers"/></svg>` +
      `<span class="label-text">Todas mis notas</span>` +
      (total ? `<span class="proj-all-count">${total}</span>` : '');
    nav.onclick = () => {
      STATE.screen = 'allnotes'; STATE.selInit = null; STATE.selMeeting = null;
      renderSidebar(); renderMain(); renderTopStatus();
    };
    fila.appendChild(nav);
    tree.appendChild(fila);
  }

  // Contadores de los accesos directos (vacíos cuando son cero).
  const favEl = $('#favCount');
  if (favEl) { const n = _getMeetingFavs().size; favEl.textContent = n || ''; }

  const all = STATE.initiatives || [];
  // Anclados arriba, el resto después. Sin cabeceras de sección: el mockup
  // retiró ese nivel — la estrella de .proj-pin ya marca cuál está anclado.
  const pinned = all.filter(it => it.pinned);
  const rest = all.filter(it => !it.pinned);

  pinned.forEach(it => _renderInitRow(tree, it));

  // Corte "Mostrar todo" para listas largas. El proyecto seleccionado nunca
  // queda escondido por el corte.
  const VISIBLE_LIMIT = 12;
  const showAll = !!STATE.showAllProjects;
  const visible = showAll ? rest : rest.slice(0, VISIBLE_LIMIT);
  if (!showAll) {
    const sel = rest.find(it => it.id === STATE.selInit);
    if (sel && !visible.includes(sel)) visible.push(sel);
  }
  visible.forEach(it => _renderInitRow(tree, it));

  if (!showAll && rest.length > VISIBLE_LIMIT) {
    const more = el('div', 'projitem nested');
    more.innerHTML = `<button class="proj-row-nav" type="button">` +
      `<svg class="icon icon-sm"><use href="#i-chevright"/></svg>` +
      `<span class="label-text">Mostrar todo (${rest.length})</span></button>`;
    more.onclick = () => { STATE.showAllProjects = true; renderSidebar(); };
    tree.appendChild(more);
  }

  if (!all.length) {
    const vacio = el('div', 'projitem nested');
    vacio.innerHTML = '<span class="label-text" style="padding:6px 8px;color:var(--text-faint)">Sin proyectos</span>';
    tree.appendChild(vacio);
  }
}

/* ============================================================
   PROYECTO DESTINO — sin preguntar
   Grabar no debe abrir un diálogo de "¿en qué proyecto?": cuando la reunión ya
   empezó, cada clic de más es tiempo perdido. Se resuelve solo:
     1. el proyecto abierto en ese momento, si hay uno;
     2. el último que se usó (queda guardado);
     3. el primero de la lista;
     4. y si no hay ninguno, se crea "General" al vuelo.
   El destino siempre se puede cambiar —antes desde el sidebar, durante la
   grabación desde el selector del pie del panel— así que elegir por defecto no
   encierra a nadie.
   ============================================================ */
const PROYECTO_POR_DEFECTO = 'General';

function _recordarProyecto(iid) { if (iid) save('hm.ultimoProyecto', String(iid)); }
function _proyectoRecordado() {
  const v = parseInt(load('hm.ultimoProyecto', ''), 10);
  return Number.isNaN(v) ? null : v;
}

async function proyectoDestino() {
  const inis = STATE.initiatives || [];
  if (STATE.selInit && inis.some(i => i.id === STATE.selInit)) return STATE.selInit;

  const ultimo = _proyectoRecordado();
  if (ultimo && inis.some(i => i.id === ultimo)) return ultimo;

  if (inis.length) return inis[0].id;

  // Ninguno todavía: se crea el de por defecto sin molestar al usuario.
  const r = await api.createInitiative(PROYECTO_POR_DEFECTO, INIT_COLORS ? INIT_COLORS[0] : '').catch(() => null);
  STATE.initiatives = await api.listInitiatives() || [];
  renderSidebar();
  const creado = (r && (r.id || (r.initiative && r.initiative.id))) ||
    (STATE.initiatives.find(i => i.name === PROYECTO_POR_DEFECTO) || {}).id;
  if (creado) toast('info', `Se guardará en «${PROYECTO_POR_DEFECTO}»`);
  return creado || null;
}

async function selectInitiative(id) {
  STATE.selInit = id;
  // El último proyecto abierto es el destino por defecto de la próxima grabación.
  _recordarProyecto(id);
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
  if (!keepTab) STATE.activeTab = 'general';
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

/* Colapsar el panel = cambiar su ancho, no cambiar de elemento.
   Antes había dos <aside> (.sidebar y .sidebar-rail) y se alternaba su display,
   lo que obligaba a mantener dos juegos de botones con los mismos destinos.
   El mockup usa uno solo con .shell.collapsed; el atributo data-sidebar se
   conserva porque varias reglas de las hojas viejas todavía lo consultan. */
function applySidebar() {
  document.body.setAttribute('data-sidebar', STATE.sidebarOpen ? 'open' : 'collapsed');
  $('#shell')?.classList.toggle('collapsed', !STATE.sidebarOpen);
  save('hm.sidebar', STATE.sidebarOpen ? '1' : '0');
}

// ---- Sidebar redimensionable ----
(function initSidebarResize() {
  /* Rango del rediseno: el panel mide 190px por defecto y no tiene sentido que
     llegue a 480 como en el diseno anterior — a partir de ~280 la linea divisoria
     queda lejisimos del contenido, que es lo que se veia "muy separado".
     Clave de almacenamiento nueva (hm.sidebar-w2) para IGNORAR los anchos
     guardados con el diseno viejo, que seguian pisando los 190px. */
  const SIDEBAR_MIN = 168, SIDEBAR_MAX = 280, SNAP_THRESHOLD = 130;
  const saved = parseInt(load('hm.sidebar-w2', ''), 10);
  if (saved && saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) {
    document.documentElement.style.setProperty('--sidebar-w', saved + 'px');
  }

  let startX, startW, dragging = false;
  let pendiente = null, rafId = 0;

  function stopDrag() {
    dragging = false;
    // Si quedó un fotograma en cola, aplicarlo ya: soltar el ratón un instante
    // antes del repintado dejaba el panel un par de píxeles corrido.
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (pendiente != null) {
      document.documentElement.style.setProperty('--sidebar-w', pendiente + 'px');
      pendiente = null;
    }
    document.body.classList.remove('sidebar-dragging');
    document.body.style.userSelect = '';
  }

  document.addEventListener('mousedown', e => {
    const handle = e.target.closest('#sidebarResizeHandle');
    if (!handle) return;
    e.preventDefault();
    /* stopPropagation porque el tirador se superpone a la barra de título: sin
       esto, el mismo mousedown podía llegar a quien mueve la ventana y el
       arrastre tardaba en responder justo en esa franja de arriba. */
    e.stopPropagation();

    if (STATE.sidebarOpen) {
      startW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10) || 320;
    } else {
      /* Plegado: el arrastre lo despliega en vez de no hacer nada. Antes esta
         función se salía si el panel estaba plegado, y el bloque que debía
         cubrir ese caso escuchaba un `#railResizeHandle` que NO EXISTE en el
         HTML — código muerto, así que no había forma de desplegarlo tirando. */
      STATE.sidebarOpen = true;
      applySidebar();
      document.documentElement.style.setProperty('--sidebar-w', SIDEBAR_MIN + 'px');
      startW = SIDEBAR_MIN;
    }
    startX = e.clientX;
    dragging = true;
    document.body.classList.add('sidebar-dragging');
    document.body.style.userSelect = 'none';
  });

  /* El ancho se aplica UNA vez por fotograma, no en cada mousemove.
     Cambiar `--sidebar-w` obliga a recalcular el layout del panel entero, y el
     ratón dispara eventos más rápido de lo que el navegador puede repintar: los
     sobrantes se encolaban y el borde llegaba tarde al puntero. Es el retardo
     que se sentía al arrastrar. */
  const aplicarAncho = () => {
    rafId = 0;
    if (pendiente == null || !dragging) return;
    document.documentElement.style.setProperty('--sidebar-w', pendiente + 'px');
    pendiente = null;
  };

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const newW = Math.min(SIDEBAR_MAX, startW + (e.clientX - startX));
    if (newW < SNAP_THRESHOLD) {
      // Snap inmediato al rail durante el arrastre
      stopDrag();
      STATE.sidebarOpen = false; applySidebar();
      document.documentElement.style.setProperty('--sidebar-w', SIDEBAR_MIN + 'px');
      return;
    }
    pendiente = Math.max(SIDEBAR_MIN, newW);
    if (!rafId) rafId = requestAnimationFrame(aplicarAncho);
  });

  document.addEventListener('mouseup', e => {
    if (!dragging) return;
    const finalW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10);
    stopDrag();
    save('hm.sidebar-w2', String(finalW));
  });
})();

/* El bloque "Expansión desde el rail" se retiró: escuchaba sobre un
   `#railResizeHandle` que nunca existió en index.html, así que jamás corrió.
   Desplegar arrastrando lo hace ahora el propio tirador del panel. */

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
  const ph = opts.placeholder ? ` placeholder="${esc(opts.placeholder)}"` : '';
  const ml = opts.maxlength ? ` maxlength="${opts.maxlength}"` : '';
  const m = el('div', 'modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', title);
  m.innerHTML = `
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div><label>${esc(fieldLabel)}</label>${opts.textarea ? `<textarea class="field" style="height:auto;min-height:70px;padding:9px"${ph}${ml}>${esc(value || '')}</textarea>` : `<input class="field" type="text" value="${esc(value || '')}"${ph}${ml}>`}
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
let _ctxOpenAt = 0;  // timestamp: ignora clicks cercanos al open
function openMenu(e, items) {
  e.stopPropagation();
  closeMenu();
  const menu = el('div', 'ctx-menu');
  items.forEach(it => {
    if (it.sep) { menu.appendChild(el('div', 'ctx-sep')); return; }
    const mi = el('div', 'ctx-item' + (it.danger ? ' danger' : ''));
    /* La etiqueta se escapa con esc(), asi que NO puede traer HTML: proBadge()
       devolvia un <span> y salia impreso como texto crudo en el menu. Los
       distintivos van como banderas y se construyen aca. */
    mi.innerHTML = (it.icon ? svg(it.icon, 14) : '') + '<span>' + esc(it.label) + '</span>';
    if (it.pro) mi.innerHTML += '<span class="ctx-badge" title="Disponible en Helpmeet Pro">PRO</span>';
    if (it.pending) mi.innerHTML += '<span class=\"pending-badge\" style=\"margin-left:auto\">V2</span>';
    mi.onclick = (ev) => { ev.stopPropagation(); closeMenu(); it.onClick && it.onClick(); };
    menu.appendChild(mi);
  });
  document.body.appendChild(menu);
  const x = Math.min(e.clientX, window.innerWidth - 220);
  const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 10);
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  _ctxOpen = menu;
  _ctxOpenAt = Date.now();
  setTimeout(() => {
    const handler = (ev) => { if (Date.now() - _ctxOpenAt > 100) closeMenu(); };
    document.addEventListener('click', handler, { once: true });
  }, 50);
}
function closeMenu() { if (_ctxOpen) { if (_ctxOpen._owner) _ctxOpen._owner.setAttribute('aria-expanded', 'false'); _ctxOpen.remove(); _ctxOpen = null; } }

// Popover del botón "Grabar" del dock: audio o pantalla. Se abre hacia arriba
// (el dock vive pegado abajo) igual que openCustomSelectPanel, pero sin
// marcar ninguna opción como "seleccionada" — siempre vuelve a preguntar.
function _openRecordPicker(anchor, options) {
  if (_ctxOpen && _ctxOpen._owner === anchor) { closeMenu(); return; }
  closeMenu();
  const panel = el('div', 'cdrop-panel rec-pick-panel');
  panel._owner = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  options.forEach((opt, i) => {
    const o = el('div', 'cdrop-opt rec-pick-opt');
    o.style.animationDelay = (i * 0.035) + 's';
    o.innerHTML = `<span class=\"cdrop-ico dock-ico--${opt.icon === 'mic' ? 'rec' : 'screen'}\">${svg(opt.icon, 15)}</span><span class=\"cdrop-opt-label\">${esc(opt.label)}</span>`;
    o.onclick = (e) => { e.stopPropagation(); closeMenu(); opt.run(); };
    panel.appendChild(o);
  });
  document.body.appendChild(panel);
  const r = anchor.getBoundingClientRect();
  panel.style.minWidth = Math.max(r.width, 200) + 'px';
  let left = r.left;
  let top = r.top - panel.offsetHeight - 6;
  if (top < 10) top = r.bottom + 6;
  if (left + panel.offsetWidth > window.innerWidth - 10) left = window.innerWidth - panel.offsetWidth - 10;
  panel.style.left = Math.max(10, left) + 'px';
  panel.style.top = Math.max(10, top) + 'px';
  _ctxOpen = panel;
  _ctxOpenAt = Date.now();
  setTimeout(() => {
    const handler = (ev) => { if (Date.now() - _ctxOpenAt > 100) closeMenu(); };
    document.addEventListener('click', handler, { once: true });
  }, 50);
}

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
      (it.color ? `<span class=\"cdrop-dot\" style=\"background:${it.color}\"></span>` : '') +
      `<span class=\"cdrop-opt-label\">${esc(it.label)}</span>` +
      (it.value === curVal ? `<span class=\"cdrop-check\">${svg('check', 13)}</span>` : '');
    o.title = it.label;
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
  _ctxOpenAt = Date.now();
  setTimeout(() => {
    const handler = (ev) => { if (Date.now() - _ctxOpenAt > 100) closeMenu(); };
    document.addEventListener('click', handler, { once: true });
  }, 50);
}

// ── Carpetas de proyecto (agrupan reuniones; guardadas localmente) ──
function _getFolders(iid) { try { return JSON.parse(localStorage.getItem('hm.folders.' + iid) || '[]'); } catch { return []; } }
function _saveFolders(iid, folders) { localStorage.setItem('hm.folders.' + iid, JSON.stringify(folders)); }
// Reunión que se está arrastrando hacia una pestaña de carpeta (o null)
let _dragMeetingId = null;
// Carpeta seleccionada por proyecto: persiste entre sesiones. Si la
// carpeta guardada ya no existe (se eliminó), vuelve a "Todas".
function _getSelFolder(iid) {
  const v = localStorage.getItem('hm.fsel.' + iid);
  if (!v) return null;
  const fid = +v;
  return _getFolders(iid).some(f => f.id === fid) ? fid : null;
}
function _setSelFolder(iid, fid) {
  if (fid == null) localStorage.removeItem('hm.fsel.' + iid);
  else localStorage.setItem('hm.fsel.' + iid, String(fid));
}
function _createFolder(iid, name) {
  const folders = _getFolders(iid);
  const f = { id: Date.now(), name: name.trim() };
  folders.push(f);
  _saveFolders(iid, folders);
  return f;
}
function _deleteFolder(iid, fid) { _saveFolders(iid, _getFolders(iid).filter(f => f.id !== fid)); }
// Carpeta asignada a una reunión (o null): la carpeta vive dentro del
// proyecto, así que si ya no existe (se borró) la reunión queda "sin carpeta".
function _getMeetingFolder(mid) {
  const v = localStorage.getItem('hm.mfolder.' + mid);
  return v ? +v : null;
}
function _setMeetingFolder(mid, fid) {
  if (fid == null) localStorage.removeItem('hm.mfolder.' + mid);
  else localStorage.setItem('hm.mfolder.' + mid, String(fid));
}
function promptCreateFolder(iid) {
  formModal('Nueva carpeta', 'Nombre de la carpeta', '', 'Crear', (name) => {
    if (!name.trim()) return;
    _createFolder(iid, name);
    toast('ok', `Carpeta «${name.trim()}» creada`);
    if (STATE.screen === 'initiative' && STATE.selInit === iid) renderMain();
    renderSidebar();
  }, { placeholder: 'Ej: Reuniones 2026', maxlength: 80 });
}
// Modal "Mover a carpeta": lista las carpetas del proyecto de la reunión
// (con "Sin carpeta" y "+ Nueva carpeta"), igual patrón que pickInitiativeModal.
function promptMoveMeetingToFolder(mid) {
  let iid = null;
  for (const k in STATE.meetingsByInit) {
    if (STATE.meetingsByInit[k].some(x => x.id === mid)) { iid = k; break; }
  }
  if (iid == null) return;
  const folders = _getFolders(iid);
  const current = _getMeetingFolder(mid);
  const apply = (fid, okMsg) => {
    _setMeetingFolder(mid, fid);
    closeModal();
    toast('ok', okMsg);
    if (STATE.screen === 'initiative') renderMain();
  };
  const m = el('div', 'modal pick-init-modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Mover a carpeta');
  m.innerHTML = `
    <div class="modal-head"><h3>Mover a carpeta</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div class="pick-init-list">
        ${/* Sin la fila "Sin carpeta": este diálogo se abre para ELEGIR una
             carpeta, y sacarla de donde está no es una carpeta más de la lista.
             Para eso está "Sacar de la carpeta", en el menú "···" de la fila y
             en la barra de selección múltiple. */''}
        ${folders.map(f => `
        <button type="button" class="pick-init-row${current === f.id ? ' on' : ''}" data-fid="${f.id}">
          <span class="pick-init-name">${esc(f.name)}</span>
        </button>`).join('')}
      </div>
      <button type="button" class="btn pick-init-new">${svg('plus', 13)} Nueva carpeta</button>
    </div>`;
  m.querySelectorAll('.pick-init-row').forEach(b => b.onclick = () => {
    const fid = b.dataset.fid === 'none' ? null : Number(b.dataset.fid);
    apply(fid, fid == null ? 'Reunión sin carpeta' : 'Reunión movida de carpeta');
  });
  m.querySelector('.pick-init-new').onclick = () => {
    closeModal();
    formModal('Nueva carpeta', 'Nombre de la carpeta', '', 'Crear', (name) => {
      if (!name.trim()) return;
      const f = _createFolder(iid, name);
      apply(f.id, `Movida a «${name.trim()}»`);
    }, { placeholder: 'Ej: Reuniones 2026', maxlength: 80 });
  };
  m.querySelector('[data-x]').onclick = closeModal;
  openModal(m);
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
  const canGlossary = hasFeature('glossary');
  const empty = ms.length === 0;
  openMenu(e, [
    { label: pinned ? 'Desanclar proyecto' : 'Anclar proyecto', icon: 'pin', onClick: () => toggleInitiativePin(iid) },
    { label: allFav ? 'Quitar de favoritas' : 'Anadir todas a favoritas', icon: 'star', onClick: () => _initAllFav(iid) },
    { label: 'Renombrar proyecto', icon: 'edit', onClick: () => promptRenameInitiative(iid) },
    { label: 'Cambiar color', icon: 'palette', onClick: () => pickInitiativeColor(iid) },
    { sep: true },
    { label: 'Importar videos', icon: 'upload', onClick: () => _importVideosToInit(iid) },
    { sep: true },
    { label: 'Exportar a otra carpeta', icon: 'download', onClick: () => exportInitiativeTo(iid) },
    { sep: true },
    { label: 'Archivar proyecto', icon: 'archive', onClick: () => archiveInitiative(iid) },
    { sep: true },
    { label: 'Eliminar proyecto', icon: 'trash', danger: true, onClick: () => permanentlyDeleteInitiative(iid) },
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
function _setMeetingFavs(s) { localStorage.setItem('hm.favMeetings', JSON.stringify([...s])); }
function _toggleMeetingFav(mid) { const s = _getMeetingFavs(); s.has(mid) ? s.delete(mid) : s.add(mid); _setMeetingFavs(s); return s.has(mid); }
function _isMeetingFav(mid) { return _getMeetingFavs().has(mid); }

async function _ensureAllMeetingsLoaded() {
  const pending = (STATE.initiatives || []).filter(it => !STATE.meetingsByInit[it.id]);
  if (!pending.length) return false;
  await Promise.all(pending.map(async it => {
    STATE.meetingsByInit[it.id] = await api.listMeetings(it.id).catch(() => []) || [];
  }));
  return true;
}

function openMeetingMenu(e, mid) {
  const isFav = _isMeetingFav(mid);
  const canParticipants = hasFeature('participants');
  openMenu(e, [
    { label: isFav ? 'Quitar de favoritos' : 'Marcar como favorita', icon: 'star', onClick: () => { _toggleMeetingFav(mid); renderSidebar(); renderMain(); } },
    { sep: true },
    { label: 'Participantes', pro: !canParticipants, icon: 'users', onClick: () => { if (canParticipants) { if (STATE.transcript) participantsModal(STATE.transcript); } else showUpgradeToast('participants'); } },
    { label: 'Importar video y transcribir…', icon: 'upload', onClick: () => doImportVideoForMeeting(mid) },
    { sep: true },
    { label: 'Renombrar reunión', icon: 'edit', onClick: () => promptRenameMeeting(mid) },
    { label: 'Cambiar fecha', icon: 'calendar', onClick: () => promptChangeMeetingDate(mid) },
    { label: 'Mover a otro proyecto', icon: 'folder', onClick: () => promptMoveMeeting(mid) },
    { label: 'Mover a carpeta', icon: 'folder', onClick: () => promptMoveMeetingToFolder(mid) },
    /* Solo si está dentro de una: es la contrapartida de "Mover a carpeta" y la
       única salida para UNA reunión desde que el diálogo dejó de ofrecer "Sin
       carpeta" (antes solo existía en la selección múltiple). No borra nada —
       la reunión vuelve a la lista del proyecto. */
    ...(_getMeetingFolder(mid) != null
      ? [{ label: 'Sacar de la carpeta', icon: 'x', onClick: () => {
            _setMeetingFolder(mid, null);
            toast('ok', 'Fuera de la carpeta');
            renderMain(); renderSidebar();
          } }]
      : []),
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
      <button type="button" class="btn pick-init-new">${svg('plus', 13)} ${t('welcome.newProject')}</button>
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
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', t('welcome.newProject'));
  m.innerHTML = `
    <div class="modal-head"><h3>${t('welcome.newProject')}</h3><button class="icon-btn sm" data-x aria-label="${t('common.close')}">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div><label>Nombre del proyecto</label><input class="field" type="text" placeholder="Ej: Cliente Acme, Proyecto Alpha" maxlength="120"><div class="field-error"></div></div>
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
      if (it && it.error === 'duplicate_name') {
        okBtn.classList.remove('is-loading');
        input.classList.add('invalid'); err.textContent = 'Ya existe un proyecto con ese nombre. Elige otro.'; input.focus(); input.select();
        return;
      }
      if (it && it.id) {
        if (!it.color) it.color = color;
        STATE.initiatives.push(it); STATE.meetingsByInit[it.id] = [];
        renderSidebar(); toast('ok', 'Proyecto creado'); closeModal(); selectInitiative(it.id);
        // Si venimos de "elige un proyecto" (p. ej. al grabar), continuar la acción
        if (typeof onCreated === 'function') onCreated(it.id);
      } else {
        okBtn.classList.remove('is-loading'); err.textContent = 'No se pudo crear el proyecto.';
      }
    } catch (e) { okBtn.classList.remove('is-loading'); err.textContent = 'No se pudo crear. ' + (e && e.message || ''); }
  };
  m.querySelector('[data-ok]').onclick = submit;
  m.querySelector('[data-c]').onclick = closeModal;
  m.querySelector('[data-x]').onclick = closeModal;
  input.addEventListener('input', () => { input.classList.remove('invalid'); err.textContent = ''; });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  openModal(m);
}
function promptRenameInitiative(iid) {
  const it = STATE.initiatives.find(x => x.id === iid);
  formModal('Renombrar proyecto', 'Nuevo nombre', it ? it.name : '', 'Guardar', async (name) => {
    const r = await api.renameInitiative(iid, name);
    if (r && r.error === 'duplicate_name') throw new Error('Ya existe un proyecto con ese nombre.');
    if (it) it.name = name; renderSidebar(); renderMain(); toast('ok', 'Proyecto renombrado');
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
  formModal('Renombrar reunion', 'Titulo', current, 'Guardar', async (title) => {
    await api.renameMeeting(mid, title);
    for (const k in STATE.meetingsByInit) { const m = STATE.meetingsByInit[k].find(x => x.id === mid); if (m) m.title = title; }
    if (STATE.transcript) STATE.transcript.title = title;
    renderSidebar(); renderMain(); toast('ok', 'Reunion renombrada');
  }, { placeholder: current, maxlength: 200 });
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
  formModal('Añadir nota', 'Nota rapida (se vincula al momento actual)', '', 'Guardar', async (text) => {
    await api.addNote(text); toast('ok', 'Nota añadida');
  }, { textarea: true, placeholder: 'Escribe tu nota...', maxlength: 4000 });
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

function _pickInitiativeForImport(preselectedId) {
  return new Promise((resolve) => {
    let chosen = preselectedId != null && STATE.initiatives.some(it => it.id === preselectedId)
      ? preselectedId : null;
    const m = el('div', 'modal');
    m.setAttribute('role', 'dialog');
    m.innerHTML = `
      <div class="modal-card iap-modal">
        <div class="modal-head">
          <span class="modal-title">¿A qué proyecto importar?</span>
          <button class="icon-btn" id="iapClose">${svg('x', 14)}</button>
        </div>
        <div class="modal-body iap-body">
          <p class="iap-hint">Confirma el proyecto donde se guardará el vídeo. Puedes elegir otro o crear uno nuevo.</p>
          <div class="iap-list" id="iapList"></div>
          <button class="btn iap-new-btn" id="iapNew">${svg('plus', 13)} ${t('welcome.newProject')}</button>
        </div>
        <div class="modal-foot">
          <button class="btn" id="iapCancel">Cancelar</button>
          <button class="btn btn-primary" id="iapConfirm" disabled>Elegir archivos →</button>
        </div>
      </div>`;
    const list = m.querySelector('#iapList');
    const confirm = m.querySelector('#iapConfirm');
    const syncConfirm = () => { confirm.disabled = chosen == null; };
    STATE.initiatives.forEach(it => {
      const row = el('button', 'iap-item' + (it.id === chosen ? ' selected' : ''));
      row.innerHTML = `<span class="iap-dot" style="background:${_initColor(it)}"></span><span class="iap-name">${esc(it.name)}</span>`;
      row.onclick = () => {
        chosen = it.id;
        list.querySelectorAll('.iap-item').forEach(r => r.classList.remove('selected'));
        row.classList.add('selected');
        syncConfirm();
      };
      list.appendChild(row);
    });
    syncConfirm();
    m.querySelector('#iapClose').onclick = () => { closeModal(); resolve(null); };
    m.querySelector('#iapCancel').onclick = () => { closeModal(); resolve(null); };
    confirm.onclick = () => { if (chosen == null) return; closeModal(); resolve(chosen); };
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
    <div class="modal-head"><h3>${t('welcome.newProject')}</h3><button class="icon-btn sm" data-x>${svg('x', 14)}</button></div>
    <div class="modal-body" style="gap:12px">
      <input class="field" id="niName2" placeholder="Nombre del proyecto" maxlength="120" autocomplete="off">
    </div>
    <div class="modal-foot">
      <button class="btn" data-x>Cancelar</button>
      <button class="btn btn-primary" id="niOk2">Crear</button>
    </div>`;
  const inp = m.querySelector('#niName2');
  const errEl = el('div', 'field-error'); m.querySelector('.modal-body').appendChild(errEl);
  const ok = async () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    const okBtn = m.querySelector('#niOk2'); okBtn.classList.add('is-loading');
    const r = await api.createInitiative(name, color).catch(() => null);
    okBtn.classList.remove('is-loading');
    if (r && r.error === 'duplicate_name') {
      errEl.textContent = 'Ya existe un proyecto con ese nombre. Elige otro.'; inp.focus(); inp.select();
      return;
    }
    if (r && r.id) {
      STATE.initiatives.unshift(r);
      renderSidebar();
      closeModal();
      onCreated(r.id);
    } else { closeModal(); toast('err', 'No se pudo crear el proyecto'); onCreated(null); }
  };
  m.querySelector('#niOk2').onclick = ok;
  inp.addEventListener('input', () => { errEl.textContent = ''; });
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  m.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { closeModal(); onCreated(null); });
  openModal(m);
  setTimeout(() => inp.focus(), 50);
}

// Antes de abrir el selector nativo de archivos, confirma en qué proyecto
// (y, si tiene carpetas, en cuál) va a quedar guardado lo importado.
function confirmImportDestination(iid, kind, onConfirm) {
  const it = STATE.initiatives.find(x => x.id === iid);
  const name = it ? it.name : 'el proyecto';
  const folders = iid ? _getFolders(iid) : [];
  const noun = kind === 'audio' ? 'el audio' : 'el video';
  const m = el('div', 'modal');
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Confirmar importación');
  m.innerHTML = `
    <div class="modal-head"><h3>Importar a «${esc(name)}»</h3><button class="icon-btn sm" data-x aria-label="Cerrar">${svg('x', 14)}</button></div>
    <div class="modal-body" style="gap:12px">
      <p style="font-size:12px;color:var(--text-secondary);margin:0;line-height:1.5">Vas a elegir ${noun} desde tu computadora. Se guardará dentro del proyecto <b>${esc(name)}</b>.</p>
      ${folders.length ? `<div><label>Carpeta (opcional)</label><div id="impFolderSel"></div></div>` : ''}
    </div>
    <div class="modal-foot"><button class="btn" data-x>Cancelar</button><button class="btn btn-primary" data-ok>Elegir archivo…</button></div>`;
  let selFolder = null;
  if (folders.length) {
    const sel = customSelect({
      value: null,
      items: [{ value: null, label: 'Sin carpeta' }, ...folders.map(f => ({ value: f.id, label: f.name }))],
      icon: 'folder',
      onChange: (v) => { selFolder = v; },
    });
    m.querySelector('#impFolderSel').appendChild(sel);
  }
  m.querySelector('[data-ok]').onclick = () => { closeModal(); onConfirm(selFolder); };
  m.querySelectorAll('[data-x]').forEach(b => b.onclick = closeModal);
  openModal(m);
}

async function doImport(btn, kind, folderId) {
  const noun = kind === 'audio' ? 'audio' : 'video';
  let initId = STATE.selInit || (STATE.transcript && STATE.transcript.initiative_id) || null;
  if (!initId) {
    initId = await _pickInitiativeForImport();
    if (!initId) return;
  }
  // Preflight con idioma/modelo antes de importar
  openRecordingPreflight('meeting', () => _doImportExecute(btn, kind, folderId, initId, noun));
}
async function _doImportExecute(btn, kind, folderId, initId, noun) {
  btn.classList.add('is-loading');
  try {
    const r = await api.importMediaMultiple(initId, kind);
    if (r && r.error) { toast('err', errMsg(r.error, 'No se pudo importar el archivo')); }
    else if (r && r.cancelled) { /* usuario cerro el dialogo */ }
    else if (r && r.ok) {
      if (folderId != null && r.files) r.files.forEach(f => _setMeetingFolder(f.meeting_id, folderId));
      toast('info', `Registrando ${r.count} ${noun}${r.count !== 1 ? 's' : ''}...`);
      await refreshMeetings(initId);
      try { renderBgJobs(await api.getBackgroundJobs()); } catch { /* sin jobs */ }
      toast('ok', `${r.count} ${noun}${r.count !== 1 ? 's' : ''} importado${r.count !== 1 ? 's' : ''} · transcribiendo en 2.º plano`);
      if (folderId != null) renderSidebar();
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
// Nombre por defecto para reuniones: incluye dia y hora
function _defaultMeetingTitle() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  return `Reunion ${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]} ${hh}:${mm}`;
}
// Fecha de hoy como en las listas: "mié 08 Jul"
function _prettyToday() {
  const d = new Date();
  return `${DIAS_CORTOS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MESES_CORTOS[d.getMonth()]}`;
}
/* Grabar arranca DE FRENTE, sin pedir el título.
   Antes abría un formModal("Título de la reunión") antes de empezar: un paso
   entre "quiero grabar" y "se está grabando, justo cuando la reunión ya empezó
   y no hay tiempo de ponerle nombre. El título se pone después —desde el menú
   "···" de la fila o desde la propia reunión— cuando ya se sabe de qué fue.
   Mientras tanto lleva la fecha, y al transcribir el motor propone uno. */
async function startMeetingRecording() {
  if (STATE.appState !== 'idle') return;
  /* Ni proyecto ni idioma se preguntan acá. El idioma y el modelo son ajustes
     que viven en Configuración (y el idioma se cambia en caliente desde el pie
     del panel); preguntarlos en cada grabación repetía una decisión que casi
     nunca cambia. */
  const iid = await proyectoDestino();
  if (!iid) { toast('err', 'No se pudo preparar un proyecto para guardar la reunión'); return; }
  STATE.selInit = iid;
  _recordarProyecto(iid);
  beginMeetingRecording(_nowDateShort());
}
async function beginMeetingRecording(title) {
  if (!STATE.selInit) { toast('err', 'Selecciona un proyecto antes de grabar'); return; }
  STATE._livePartials = { me: '', others: '' };  // limpia el parcial de una reunión anterior
  // Sesión nueva: el panel arranca expandido aunque la anterior quedara minimizada.
  STATE._recPanelMin = false;
  let r;
  try {
    r = await api.startRecording(STATE.selInit, title);
  } catch (e) {
    console.error('[grabar audio] startRecording lanzó:', e);
    toast('err', 'No se pudo iniciar la grabación: ' + ((e && e.message) || e));
    return;
  }
  if (!r || r.ok === false) {
    toast('err', errMsg(r && r.error, 'No se pudo iniciar la grabación'));
    return;
  }
  try {
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
  } catch (e) {
    // El backend YA está grabando, pero el render falló. No dejar la UI en un
    // estado inconsistente: mostrar el error real y reflejar que se está grabando.
    console.error('[grabar audio] falló tras iniciar (render/refresh):', e);
    toast('err', 'La grabación inició pero la vista falló: ' + ((e && e.message) || e));
    try { setAppState('recording-local'); } catch (_) { /* estado ya aplicado */ }
  }
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
    setAppState('idle');
    await refreshMeetings(STATE.selInit);
    if (r && r.ok) {
      /* Mismo cierre que la grabación de pantalla: detener lleva a la reunión.
         Antes esto volvía al proyecto y dejaba dos avisos sueltos —"se
         transcribe en segundo plano" y, un rato después, "transcripción
         lista"— que obligaban a ir a buscar a mano lo que se acababa de grabar.

         Se guarda sin preguntar el nombre: el nombre se pone DURANTE la
         grabación o después desde el menú "···" de la fila, y mientras tanto la
         reunión lleva su fecha, que ya identifica. */
      if (stoppedId != null) {
        /* El trabajo de transcripción tarda un momento en aparecer en bgJobs.
           Sin esta marca, la pestaña General se dibujaría vacía en ese hueco y
           el card de "transcribiendo" entraría un segundo después, de golpe. */
        STATE.txPending[String(stoppedId)] = Date.now();
        await openMeeting(stoppedId);
      } else {
        STATE.screen = STATE.selInit ? 'initiative' : 'welcome';
      }
    } else {
      STATE.screen = STATE.selInit ? 'initiative' : 'welcome';
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
  // Mismo criterio que la grabación de audio: el destino se resuelve solo.
  if (!STATE.selInit) {
    proyectoDestino().then((iid) => {
      if (!iid) { toast('err', 'No se pudo preparar un proyecto'); return; }
      STATE.selInit = iid; _recordarProyecto(iid);
      renderSidebar(); openScreenPanel();
    });
    return;
  }
  STATE.recElapsed = 0; STATE.screenPanelCollapsed = false;
  // Nombre por defecto visible como en las listas ("mié 08 Jul"); si el usuario
  // no lo cambia, no se renombra y el backend conserva su nombre por defecto.
  STATE.screenRecording = false; STATE.screenMeetingId = null; STATE.screenPanelName = _prettyToday();
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
    ? `<span class="rec-badge"><span class="rdot"></span>REC</span><span class="rec-clock" id="screenClock">${fmt(STATE.recElapsed)}</span>${waveMarkup(9)}`
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
      <input id="scName" class="field" maxlength="120" placeholder="Ej. Demo cliente, revision semanal..." autocomplete="off" value="${esc(STATE.screenPanelName || '')}">
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
    if (v && v !== _prettyToday() && recording && STATE.screenMeetingId) api.renameMeeting(STATE.screenMeetingId, v);
  };
  m.querySelector('#scMic').onclick = () => {
    STATE.micMuted = !STATE.micMuted;
    _guardarMicMuted(STATE.micMuted);
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
  STATE._livePartials = { me: '', others: '' };  // limpia el parcial de una grabación anterior
  const r = await api.startScreenRecording(STATE.selInit, STATE.monitorIdx);
  if (!r || r.ok === false) { toast('err', errMsg(r && r.error, 'No se pudo iniciar la grabación')); return; }
  STATE.screenMeetingId = r.meeting_id || null;
  STATE.micMuted = !!r.mic_muted;
  STATE.screenRecording = true;
  /* Sesión nueva, transcripción en blanco. Sin esto el panel arrancaba con las
     frases de la grabación ANTERIOR: la ruta de audio sí reseteaba
     STATE.transcript, esta no, y el panel flotante lee de ahí. */
  STATE.selMeeting = STATE.screenMeetingId;
  STATE.transcript = {
    title: r.title || name || _prettyToday(), started_at: r.started_at,
    utterances: [], assets: { captures: [], notes: [], video: null }, video_path: null,
  };
  if (name && name !== _prettyToday() && STATE.screenMeetingId) api.renameMeeting(STATE.screenMeetingId, name);
  startTimer();
  /* Se cierra el panel GRANDE de configuración (el del recorte y el selector de
     monitor): ya cumplió su función y ocuparía la pantalla que se está
     grabando. El panel flotante, en cambio, queda EXPANDIDO — es donde se ve el
     cronómetro y el texto apareciendo, que es justo lo que hay que poder mirar
     mientras se graba. Minimizarlo lo dejaba inútil de entrada; se minimiza a
     mano con su propio botón cuando molesta. */
  STATE.screenPanelOpen = false;
  STATE.screenPanelCollapsed = true;
  STATE._recPanelMin = false;
  closeModal();
  setAppState('screen-recording')
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
  // Aplica el nombre escrito en el panel (si lo hay y no es el de por defecto).
  const nameField = document.getElementById('scName');
  const _nfv = nameField ? nameField.value.trim() : '';
  if (_nfv && _nfv !== _prettyToday() && STATE.screenMeetingId) {
    api.renameMeeting(STATE.screenMeetingId, _nfv);
  }
  stopTimer();
  closeModal();
  setAppState('idle');
  const mid = STATE.screenMeetingId;
  let res = null;
  try { res = await api.stopScreenRecording(); } catch (e) {}
  STATE.screenMeetingId = null;
  if (res && res.ok) {
    /* El muxeo va en segundo plano; no bloqueamos. Se anota como pendiente para
       que la pestaña General pueda decir "preparando el vídeo" en vez de dejar
       el hueco vacío. Lo borra onScreenVideoSaved. */
    const savedId = res.meeting_id != null ? res.meeting_id : mid;
    if (savedId != null) STATE.videoPending[String(savedId)] = Date.now();
    await refreshMeetings(STATE.selInit);
    /* Detener lleva a la reunión recién grabada. La transcripción de pantalla se
       hace EN VIVO durante la grabación (ver _save_screen_video_bg: solo encola
       trabajo si falló del todo), así que al parar el texto ya está escrito y
       nadie lo estaba llevando a verlo: quedaba un aviso suelto y una pantalla
       que no cambiaba. Abrir la reunión es la consecuencia esperable de parar. */
    if (savedId != null) await openMeeting(savedId);
    else toast('info', 'Guardando video…');
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
  /* Si la reunión está abierta se recarga ANTES de bajar la marca de pendiente:
     así el transcript ya trae video_path cuando General vuelve a dibujarse y el
     card de "preparando" da paso al reproductor sin pasar por un hueco vacío. */
  const abierta = STATE.screen === 'meeting' && String(STATE.selMeeting) === String(meetingId);
  if (ok && abierta) {
    try { await openMeeting(meetingId, true); } catch (e) { /* refresco best-effort */ }
  }
  // Se baja pase lo que pase: si el guardado falló, dejar el card girando para
  // siempre sería peor que decir que no hay vídeo.
  delete STATE.videoPending[String(meetingId)];
  if (!ok) { toast('err', 'No se pudo guardar el vídeo'); return; }
  if (abierta) renderMain();

  /* Un solo aviso, y que diga lo que de verdad pasó. Antes salía "Vídeo añadido
     a Archivos" con un enlace a esa pestaña: describía el archivo, no el estado
     de la grabación, y no mencionaba la transcripción. El enlace solo aparece si
     el usuario está en otra pantalla — estando ya en la reunión no llevaría a
     ninguna parte. */
  let msg;
  if (audio === false) msg = 'Vídeo guardado, pero sin sonido';  // sin audio no hay transcripción que prometer
  else if (meetingIsTranscribing(meetingId)) msg = 'Vídeo listo · transcribiendo…';
  else msg = 'Grabación lista';
  const kind = audio === false ? 'info' : 'ok';
  if (abierta || !meetingId) toast(kind, msg);
  else toast(kind, msg, 'Abrir reunión', () => openMeeting(meetingId));
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
  if (!v2Available('cancel_meeting_job')) { toast('info', 'Cancelar requiere backend V2.'); }
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
  // Cronómetro del panel flotante: se actualiza el nodo suelto, no se
  // re-renderiza el panel entero — reconstruirlo cada segundo reiniciaría la
  // animación de entrada y el scroll de las burbujas.
  const p = $('#recPanelTimer'); if (p) p.textContent = fmt(STATE.recElapsed);
}
function startTimer() { STATE.recStartedAt = Date.now(); STATE.recElapsed = 0; clearInterval(STATE.recTimer); STATE.recTimer = setInterval(tickTimer, 1000); }
function stopTimer() { clearInterval(STATE.recTimer); STATE.recStartedAt = 0; }
// Al volver a enfocar/mostrar la ventana, corrige el reloj al instante.
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTimer(); });
window.addEventListener('focus', tickTimer);
/* mm:ss hasta la hora, y h:mm:ss a partir de ahí. Antes una grabación de 90
   minutos mostraba "90:00", que se lee como noventa segundos. */
function fmt(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), seg = s % 60;
  const dd = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(seg)}` : `${dd(m)}:${dd(seg)}`;
}
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

function permanentlyDeleteInitiative(iid) {
  confirmModal('Eliminar proyecto', 'Se eliminara permanentemente. Esta accion no se puede deshacer.', 'Eliminar', async () => {
    const r = await api.permanentlyDeleteItem('initiative', iid);
    if (r && r.ok === false) { toast('err', errMsg(r.error, 'No se pudo eliminar')); return; }
    toast('ok', 'Proyecto eliminado'); _afterRemoveFromTree(iid); STATE.initiatives = await api.listInitiatives() || []; renderSidebar(); renderMain(); updateLibraryCounts();
  }, true);
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
      title: 'Graba reuniones o pantalla',
      text: 'Pulsa "Grabar" y elige audio o pantalla (Meet, Zoom, Teams). Helpmeet escucha, transcribe en tiempo real y genera un resumen automático al terminar.',
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
// Python inyecta frases YA REALES (transcripción progresiva, guardadas en la
// base de datos con su id definitivo) mientras se graba. Se insertan antes
// del indicador de "escuchando" para que este se quede siempre al final.
window.addUtterance = function (id, speaker, text, start, end) {
  if (!STATE.transcript) STATE.transcript = { title: '', started_at: '', utterances: [] };
  const u = {
    id, speaker: speaker === 'me' || speaker === 'Yo' ? 'me' : 'others',
    time: fmt(Math.round(start)), start_time: start, end_time: end, text,
  };
  STATE.transcript.utterances.push(u);
  if (STATE.screen === 'meeting' && STATE.activeTab === 'transcript') {
    const r = document.querySelector('.reading');
    if (r) r.insertBefore(utterance(u), $('#previewTyping'));
    const lc = $('#liveCount'); if (lc) lc.textContent = STATE.transcript.utterances.length + ' frases';
  }
  // Burbujas del panel flotante: se refrescan aunque no se esté mirando la
  // pantalla de Reunión, porque el panel flota sobre cualquier vista.
  const stream = $('#recStream');
  if (stream) _recPanelBurbujas(stream);
};
// Texto EN VIVO de Vosk que todavía puede cambiar (no está guardado en la
// base: la frase se persiste recién cuando Vosk detecta silencio y llama a
// addUtterance). Reemplaza los 3 puntos del indicador de "escuchando" con el
// texto real mientras se habla; `text` vacío devuelve los puntos (frase
// cerrada, o silencio). Las dos pistas pueden tener parcial a la vez.
window.setLivePartial = function (speaker, text) {
  if (!STATE._livePartials) STATE._livePartials = { me: '', others: '' };
  STATE._livePartials[speaker === 'me' ? 'me' : 'others'] = text || '';
  /* El panel flotante puede estar visible sobre cualquier pantalla, así que su
     burbuja en curso se actualiza SIEMPRE — no solo cuando se está mirando la
     transcripción. Sin esto el panel no mostraba nada hasta que una frase se
     cerraba, y eso era justo lo que faltaba al empezar a grabar. */
  const viva = $('#recLiveBubble');
  if (viva) _recPintaParcial(viva);
  const typing = $('#previewTyping');
  if (!typing) return;
  const parts = [];
  if (STATE._livePartials.me) {
    parts.push(`<span class="preview-partial"><b>Yo:</b>${esc(STATE._livePartials.me)}</span>`);
  }
  // Sin etiqueta para el interlocutor: es el caso por defecto.
  if (STATE._livePartials.others) {
    parts.push(`<span class="preview-partial">${esc(STATE._livePartials.others)}</span>`);
  }
  // Sin parciales en curso vuelve al indicador de escucha del mockup.
  typing.innerHTML = parts.length
    ? '<span class="dots"><span></span><span></span><span></span></span>' + parts.join('')
    : '<span class="dots"><span></span><span></span><span></span></span>' +
      '<span class="listening-label">Escuchando…</span>';
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
  refreshVideoPanelButtons();
  // Eliminar tarjeta flotante si quedó de una sesión anterior
  const host = document.getElementById('bgJobs'); if (host) host.remove();
}
window.onBackgroundJobs = renderBgJobs;
window.onJobFinished = async function (meetingId, initiativeId, ok) {
  /* La comparación va por String: meetingId llega desde Python como número, pero
     STATE.selMeeting suele venir de un data-* del árbol, que es texto. Con ===
     el refresco no se disparaba y la transcripción recién terminada no entraba
     hasta cambiar de pantalla y volver. */
  const abierta = STATE.screen === 'meeting' && String(STATE.selMeeting) === String(meetingId);
  delete STATE.txPending[String(meetingId)];
  try {
    if (initiativeId != null) await refreshMeetings(initiativeId);
    if (abierta) await openMeeting(meetingId, true);
  } catch (e) { /* refresco best-effort */ }
  if (!ok) { toast('err', 'No se pudo transcribir una reunión'); return; }
  /* Sin aviso cuando la reunión está delante: el texto aparece solo, y un toast
     que anuncia lo que ya se ve es ruido. Solo se avisa si estás en otra
     pantalla, porque ahí no hay forma de enterarse. */
  if (!abierta) {
    toast('ok', 'Transcripción lista', 'Abrir', () => openMeeting(meetingId, true));
  }
};

/* ---- Adaptadores V2 opcionales (Python puede llamarlos; si no, no pasa nada) ---- */
window.onAppStateChanged = function (s) { if (s && s.state) setAppState(s.state); };
window.onJobProgress = function (job) { if (job && typeof job.progress === 'number') { STATE.jobStage = job.stage || STATE.jobStage; window.setProgress(job.progress / 100); } };
// Nivel de audio en vivo → waveforms reactivos. `levels` puede ser un número
// (0..1) o un array de números por barra. Si no llegan niveles, los waves
// vuelven solos a la animación de fallback (modo 'idle').
let _waveIdleTimer = null;
window.onAudioLevels = function (levels) {
  const waves = document.querySelectorAll('.hm-wave');
  if (!waves.length) return;
  const arr = Array.isArray(levels) ? levels : [levels];
  const peak = arr.reduce((m, v) => Math.max(m, +v || 0), 0);
  waves.forEach(w => {
    w.classList.remove('idle');
    const bars = w.children;
    for (let i = 0; i < bars.length; i++) {
      // reparte los niveles disponibles; si hay menos que barras, interpola por índice
      const src = arr.length >= bars.length
        ? arr[i]
        : arr[Math.floor(i / bars.length * arr.length)];
      const lv = Math.max(0, Math.min(1, (+src || 0) * (0.7 + Math.random() * 0.3)));
      bars[i].style.setProperty('--lv', lv.toFixed(3));
    }
  });
  clearTimeout(_waveIdleTimer);
  _waveIdleTimer = setTimeout(() => {
    document.querySelectorAll('.hm-wave').forEach(w => {
      w.classList.add('idle');
      Array.from(w.children).forEach(b => b.style.removeProperty('--lv'));
    });
  }, peak > 0.02 ? 900 : 300);
};
window.onRecoveryDetected = function (rec) { showRecoveryBanner(rec); };

/* ============================================================
   MEDIDOR DE MICRÓFONO — el nivel de verdad, medido en el navegador

   `window.onAudioLevels` está en este archivo desde antes, pero **Python nunca
   lo llama**: no hay un solo emisor en todo `helpmeet/`. O sea que el waveform
   verde —el que supuestamente prueba que entra audio— llevaba toda su vida
   corriendo la animación de relleno de `.hm-wave.idle`, sin ninguna relación
   con lo que dice el micrófono. Se veía convincente y no medía nada.

   Medirlo acá y no en Python es lo único que sirve **en reposo**: el backend
   solo tiene el audio mientras graba, y el dock —donde uno quiere comprobar
   que el micrófono anda antes de empezar— está justo antes de eso.

   El stream se abre solo cuando hace falta y se cierra al silenciar o al
   esconder la ventana. Un micrófono abierto sin motivo es exactamente lo que
   la gente teme de una app que graba.
   ============================================================ */
let _micStream = null, _micCtx = null, _micRAF = 0;

async function _medidorMic() {
  const hazFalta = !STATE.micMuted && !!document.querySelector('#btnMic, .rec-mute-btn');
  if (!hazFalta || document.hidden) return _cortarMedidorMic();
  if (_micStream || !navigator.mediaDevices?.getUserMedia) return;
  try {
    // Sin cancelación de eco ni supresión de ruido: acá se mide lo que entra,
    // no se prepara para transcribir. Con los filtros puestos, hablar bajo
    // apenas movía la aguja.
    _micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (e) {
    console.warn('[mic] sin acceso al micrófono:', (e && e.name) || e);
    _micStream = null;
    return;
  }
  _micCtx = new (window.AudioContext || window.webkitAudioContext)();
  const an = _micCtx.createAnalyser();
  an.fftSize = 512;
  an.smoothingTimeConstant = 0.6;
  _micCtx.createMediaStreamSource(_micStream).connect(an);
  const buf = new Uint8Array(an.fftSize);
  let suave = 0;

  const tick = () => {
    an.getByteTimeDomainData(buf);
    let suma = 0;
    for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; suma += d * d; }
    // Voz de conversación: RMS entre 0,05 y 0,2. Sin el factor, el medidor se
    // quedaría pegado al suelo y parecería que no funciona.
    const nivel = Math.min(1, Math.sqrt(suma / buf.length) * 6);
    // Sube al instante y baja despacio: así una sílaba se alcanza a ver, en vez
    // de parpadear entre picos.
    suave = nivel > suave ? nivel : suave * 0.82 + nivel * 0.18;
    _pintaNivelMic(suave);
    _micRAF = requestAnimationFrame(tick);
  };
  _micRAF = requestAnimationFrame(tick);
}

function _cortarMedidorMic() {
  if (_micRAF) { cancelAnimationFrame(_micRAF); _micRAF = 0; }
  if (_micStream) { _micStream.getTracks().forEach(t => t.stop()); _micStream = null; }
  if (_micCtx) { _micCtx.close().catch(() => {}); _micCtx = null; }
  _pintaNivelMic(0);
}

/* Un solo número alimenta las dos señales: el halo de los botones de micrófono
   y las barras del waveform, que hasta hoy fingían. */
function _pintaNivelMic(n) {
  const v = n.toFixed(3);
  document.querySelectorAll('#btnMic, .rec-mute-btn').forEach(b => {
    b.style.setProperty('--nivel', v);
    b.classList.toggle('oye', n > 0.06);
  });
  if (n > 0.02) window.onAudioLevels([n, n * 0.78, n, n * 0.62, n * 0.9, n * 0.7, n]);
}

document.addEventListener('visibilitychange', () => { _medidorMic(); });
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
  const m = el('div', 'modal preflight-modal');
  m.setAttribute('role', 'dialog');
  m.setAttribute('aria-label', isScreen ? t('recording.screenTitle') : t('recording.title'));
  m.innerHTML = `
    <div class="modal-head"><h3>${svg(isScreen ? 'monitorDot' : 'mic', 16)} ${isScreen ? t('recording.screenTitle') : t('recording.title')}</h3><button class="icon-btn sm" data-x aria-label="${t('common.close')}">${svg('x', 14)}</button></div>
    <div class="modal-body">
      <div class="pre-cfg" id="preCfg">
        <div class="pre-cfg-row"><span class="pre-cfg-lbl">Idioma</span><div class="cfg-chips" id="cfgLang"></div></div>
        <div class="pre-cfg-row"><span class="pre-cfg-lbl">Modelo</span><div class="cfg-chips" id="cfgModel"></div></div>
      </div>
      <div class="preflight-foot">
        <button class="btn" id="preCancel">Cancelar</button>
        <button class="btn btn-primary" id="preStart">Iniciar grabacion</button>
      </div>
    </div>`;
  const start = m.querySelector('#preStart');

  let cfg = STATE.settings;
  if (!cfg || !cfg.languages) {
    try { cfg = await api.getSettings() || {}; STATE.settings = cfg; } catch (e) { cfg = {}; }
  }
  const byLang = cfg.models_by_lang || {};
  function renderCfgChips() {
    const langBox = m.querySelector('#cfgLang');
    const modelBox = m.querySelector('#cfgModel');
    if (!langBox || !modelBox) return;
    langBox.innerHTML = (cfg.languages || []).map(lg =>
      `<button class="cfg-chip ${lg.id === cfg.language ? 'on' : ''}" data-lang="${lg.id}">${esc(lg.label)}</button>`).join('');
    modelBox.innerHTML = (byLang[cfg.language] || cfg.models || []).map(mo =>
      `<button class="cfg-chip ${mo.tier === cfg.tier ? 'on' : ''}" data-tier="${mo.tier}" title="${esc(mo.label)}">${esc(mo.id)}</button>`).join('');
    langBox.querySelectorAll('[data-lang]').forEach(b => b.onclick = async () => {
      if (b.dataset.lang === cfg.language) return;
      cfg = await api.v2.setTranscriptionSettings({ language: b.dataset.lang }) || cfg;
      renderCfgChips();
    });
    modelBox.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
      if (b.dataset.tier === cfg.tier) return;
      cfg = await api.v2.setTranscriptionSettings({ tier: b.dataset.tier }) || cfg;
      renderCfgChips();
    });
  }
  if (v2Available('set_transcription_settings')) renderCfgChips();
  else m.querySelector('#preCfg').hidden = true;

  m.querySelector('[data-x]').onclick = closeModal;
  m.querySelector('#preCancel').onclick = closeModal;
  start.onclick = () => { closeModal(); setTimeout(proceed, 0); };
  openModal(m);
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
      ['Modelo', d.vosk],
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
  head.innerHTML = `<div class="mhead-row mhead-row--mid" style="max-width:1100px"><h1 class="page-title">${t('settings.title')}</h1></div>`;
  const content = el('div', 'content');
  const inner = el('div', 'sv-page');
  inner.style.maxWidth = '1100px';
  // Indicador de carga mientras se obtienen los settings
  inner.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:60px 0"><span class="spinner"></span><span style="margin-left:12px;color:var(--text-muted);font-size:13px">' + t('settings.loading') + '</span></div>';
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
        <div class="sv-sec-title">${svg('mic', 14)} ${t('settings.transcription')} ${hasTx ? '<span class="privacy-badge"><i></i>' + t('settings.local') + '</span>' : ''}</div>
        <div class="sv-row"><span class="sv-lbl">${t('settings.language')}</span><div class="cfg-chips" id="svLangChips"></div></div>
        <div class="sv-row"><span class="sv-lbl">${t('settings.model')}</span><div class="cfg-chips" id="svModelChips"></div></div>
        <label class="toggle-row" for="svDefaultMute" style="padding:10px 0 2px">
          <span>${t('settings.micMutedDefault')}</span>
          <input type="checkbox" id="svDefaultMute" ${s.default_mic_muted ? 'checked' : ''}>
          <span class="toggle-ui" aria-hidden="true"><i></i></span>
        </label>
      </div>

      <div class="sv-col">
        <div class="sv-section sv-card">
          <div class="sv-sec-title">${svg('palette', 14)} ${t('settings.appearance')}</div>
          <div class="sv-row">
            <span class="sv-lbl">${t('settings.theme')}</span>
            <div id="svThemeChips" style="display:flex;gap:8px">
              <button class="cfg-chip" data-theme-opt="light">${t('settings.light')}</button>
              <button class="cfg-chip" data-theme-opt="dark">${t('settings.dark')}</button>
            </div>
          </div>
          <div class="sv-row">
            <span class="sv-lbl">${t('settings.uiLanguage')}</span>
            <div id="svUiLangChips" style="display:flex;gap:8px">
              <button class="cfg-chip" data-ui-lang="es">${t('langSwitcher.es')}</button>
              <button class="cfg-chip" data-ui-lang="en">${t('langSwitcher.en')}</button>
            </div>
          </div>
        </div>

        <div class="sv-section sv-card">
          <div class="sv-sec-title">${svg('monitor', 14)} ${t('settings.screenRecording')}</div>
          <div class="sv-row"><span class="sv-lbl">${t('settings.quality')}</span><div class="cfg-chips" id="svVideoChips"></div></div>
        </div>
      </div>

      <div class="sv-section sv-card sv-card--full">
        <div class="sv-sec-title">${svg('edit', 14)} ${t('settings.aiInstructions')}</div>
        <textarea id="svAiInstr" class="obj-text sv-textarea" rows="8" maxlength="10000"
          placeholder="${t('settings.aiPlaceholder')}">${esc(s.ai_instructions || '')}</textarea>
        <div class="sv-row-end">
          <button class="btn" id="svAiReset">${t('settings.aiReset')}</button>
          <button class="btn btn-primary" id="svAiSave">${t('settings.aiSave')}</button>
        </div>
      </div>

      <div class="sv-section sv-card">
        <div class="sv-sec-title">${svg('folder', 14)} ${t('settings.exportFolder')}</div>
        <div class="sv-row">
          <span class="sv-path mono">${esc(s.export_dir || '—')}</span>
          <button class="btn" id="svDir">${t('settings.choose')}</button>
        </div>
      </div>

      <div class="sv-section sv-card" id="svLicSection">
        <div class="sv-sec-title">${svg('checkSquare', 14)} ${t('settings.license')}</div>
        <div class="sv-lic-rows">
          <div class="sv-row">
            <span class="sv-lbl">${t('settings.licenseStatus')}</span>
            <span id="svLicStatus" style="color:var(--text-secondary)">${t('settings.licenseLoading')}</span>
          </div>
          <div class="sv-row">
            <span class="sv-lbl">${t('settings.licensePlan')}</span>
            <span id="svLicPlan" style="color:var(--text-primary)">—</span>
          </div>
        </div>
        <div id="svLicFeatures" style="margin-top:8px"></div>
        <div class="sv-row-end" style="margin-top:12px">
          <button class="sv-act sv-lic-deactivate" id="svLicDeactivate" style="display:none">
            ${svg('x', 11)} ${t('settings.licenseDeactivate')}
          </button>
        </div>
      </div>

      <div class="sv-section sv-card sv-card--full">
        <div class="sv-sec-title">${svg('download', 14)} ${t('settings.updates')}</div>
        <div class="sv-upd-card">
          <div class="sv-upd-ico">${svg('download', 17)}</div>
          <div class="sv-upd-info">
            <div class="sv-upd-ver">Helpmeet <span class="mono">v${esc(STATE.version || '')}</span></div>
            <div class="sv-upd-status" id="svUpdStatus">${t('settings.updatesCheck')}</div>
          </div>
          <button class="btn" id="svUpdCheck">${t('settings.updatesCheck')}</button>
        </div>
      </div>

      <div class="sv-section sv-section--actions sv-card--full">
        <button class="sv-act" id="svDiag">${svg('check', 13)} ${t('settings.diagnostics')}</button>
        <button class="sv-act sv-act--danger" id="svWipe">${svg('trash', 13)} ${t('settings.wipeData')}</button>
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
        renderChips(); toast('ok', t('settings.language') + ': ' + (scfg.language_label || b.dataset.lang));
      });
      modelBox.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
        if (b.dataset.tier === scfg.tier) return;
        scfg = await api.v2.setTranscriptionSettings({ tier: b.dataset.tier }) || scfg;
        renderChips(); toast('ok', t('settings.model') + ': ' + (scfg.model || b.dataset.tier));
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
        renderVideoChips(); toast('ok', t('settings.qualitySaved'));
      });
    }
    if (hasTx) { renderChips(); renderVideoChips(); }

    inner.querySelector('#svDefaultMute').onchange = async (e) => {
      STATE.micMuted = e.target.checked; _guardarMicMuted(STATE.micMuted); updateMicChip();
      await api.v2.setTranscriptionSettings({ default_mic_muted: e.target.checked });
      toast('ok', e.target.checked ? t('settings.micStartsMuted') : t('settings.micStartsActive'));
    };
    inner.querySelector('#svAiSave').onclick = async () => { await api.setAiInstructions(inner.querySelector('#svAiInstr').value); toast('ok', t('settings.aiSaved')); };
    inner.querySelector('#svAiReset').onclick = async () => { const r = await api.setAiInstructions(''); inner.querySelector('#svAiInstr').value = (r && r.text) || ''; toast('ok', t('common.done')); };
    inner.querySelector('#svDir').onclick = async () => { const r = await api.chooseExportDir(); if (r && r.ok) { toast('ok', t('settings.folderUpdated')); openSettings(); } };
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
        aplicarTema(v);
        // Actualizar favicon
        const icoEl = document.getElementById('faviconIco');
        if (icoEl) icoEl.href = v === 'dark' ? 'assets/helpmeet-dark.ico' : 'assets/helpmeet.ico';
        // Actualizar icono de ventana nativa (Windows)
        try { api.winRefreshTheme(v === 'dark'); } catch (e) { /* solo Windows */ }
        renderTheme();
        toast('ok', v === 'dark' ? t('settings.themeDarkActive') : t('settings.themeLightActive'));
      });
      renderTheme();
    }
    // Idioma de la UI
    const uiLangBox = inner.querySelector('#svUiLangChips');
    if (uiLangBox) {
      const renderUiLang = () => {
        const cur = HelpmeetI18n.getLang() || 'es';
        uiLangBox.querySelectorAll('[data-ui-lang]').forEach(b =>
          b.classList.toggle('on', b.dataset.uiLang === cur));
      };
      uiLangBox.querySelectorAll('[data-ui-lang]').forEach(b => b.onclick = async () => {
        const lang = b.dataset.uiLang;
        if (lang === HelpmeetI18n.getLang()) return;
        HelpmeetI18n.switchLang(lang);
        try { await api.setUiLanguage(lang); } catch (e) { /* offline / no pywebview */ }
        renderUiLang();
        toast('ok', t('settings.languageSaved'));
      });
      renderUiLang();
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
        const featEl = inner.querySelector('#svLicFeatures');
        if (!stEl) return;
        if (info && info.active) {
          stEl.textContent = 'Activa';
          stEl.style.color = 'var(--accent)';
          const planName = info.plan || 'personal';
          const planBadge = planName === 'pro' ? '<span class="pro-badge">PRO</span>' :
                            planName === 'team' ? '<span class="pro-badge" style="background:linear-gradient(135deg,#ede9fe,#ddd6fe);color:#5b21b6;border-color:#a78bfa">TEAM</span>' : '';
          planEl.innerHTML = `${planName} ${planBadge}`;
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
          // Cargar features del plan
          api.getPlanFeatures().then(pf => {
            window._planFeatures = pf;
            if (!featEl || !pf) return;
            const features = [
              { key: 'video_unlimited', label: 'Video ilimitado', ok: pf.video_unlimited, locked: !pf.video_unlimited ? `Limitado a ${pf.video_hours}h (${pf.video_hours_used?.toFixed(1) || 0}h usadas)` : '' },
              { key: 'zip_export', label: 'Exportar ZIP', ok: pf.zip_export },
              { key: 'participants', label: 'Participantes', ok: pf.participants },
              { key: 'glossary', label: 'Glosario', ok: pf.glossary },
              { key: 'recovery', label: 'Recuperar grabaciones', ok: pf.recovery },
            ];
            featEl.innerHTML = features.map(f => {
              const icon = f.ok ? '✅' : '🔒';
              const cls = f.ok ? '' : 'feature-locked';
              const msg = f.locked || `Disponible en Helpmeet Pro`;
              return `<div class="sv-row ${cls}" data-upgrade-msg="${msg}" style="font-size:12px;padding:2px 0;color:var(--text-secondary)">
                <span>${icon} ${f.label}</span>
                ${!f.ok && pf.plan === 'personal' ? '<span class="pro-badge">PRO</span>' : ''}
              </div>`;
            }).join('');
          });
        } else {
          stEl.textContent = 'Sin licencia';
          planEl.textContent = '—';
          if (featEl) featEl.innerHTML = '';
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
  // El <dialog> del buscador se cierra solo con Esc (nativo); si está abierto,
  // ningún otro atajo debe dispararse por debajo.
  if ($('#searchOverlay')?.open) return;
  if (e.key === 'Escape') { if (!$('#overlayRoot').hidden) closeModal(); closeMenu(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); promptNewInitiative(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); STATE.sidebarOpen = !STATE.sidebarOpen; applySidebar(); }
});

/* ---- Cableado del buscador global ---- */
function wireSearchOverlay() {
  const dlg = $('#searchOverlay'); if (!dlg) return;
  const input = $('#searchInput'); if (!input) return;

  // Filtrado local instantáneo mientras se escribe.
  input.addEventListener('input', () => renderSearchOverlay(input.value));

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); soMoveCursor(1); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); soMoveCursor(-1); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Con una fila marcada por las flechas, Enter la abre.
    if (SO.cursor >= 0 && SO.rows[SO.cursor]) { SO.rows[SO.cursor].click(); return; }
    // Sin marca, Enter busca dentro de las transcripciones (api.search).
    const q = input.value.trim();
    if (!q) return;
    const hits = await api.search(q) || [];
    renderSearchOverlay(q, hits);
    if (!hits.length) {
      const list = $('#searchOverlayResults');
      const nada = el('div', 'search-overlay-hint');
      nada.textContent = 'Nada en las transcripciones para esa búsqueda.';
      list?.appendChild(nada);
    }
  });

  // Clic en el ::backdrop cierra (showModal no lo hace solo).
  dlg.addEventListener('click', (e) => { if (e.target === dlg) closeSearchOverlay(); });
  // Esc nativo: sincroniza la clase de la animación.
  dlg.addEventListener('close', () => dlg.classList.remove('show'));
}

/* Prevención de cierre durante grabación */
/* Re-render settings page when language changes */
document.addEventListener('helpmeet:lang-changed', () => {
  if (STATE.screen === 'settings') openSettings();
});

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
  // El backend manda si trae el dato; si no, queda lo guardado en el navegador.
  if (b.default_mic_muted != null) { STATE.micMuted = !!b.default_mic_muted; _guardarMicMuted(STATE.micMuted); updateMicChip(); }
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
  /* FASE 1 del rediseño: los iconos del chasis ya vienen en el HTML, del sprite
     SVG (<use href="#i-…">), así que aquí ya no se inyectan uno por uno. Con
     ellos desaparecieron el botón grande "Nuevo proyecto", la cabecera
     "Proyectos" con su contador y su botón de refrescar, y el <aside> del riel
     colapsado entero (ahora el sidebar cambia de ancho, no se cambia de
     elemento). Ver css/shell.css. */

  // Plegar/desplegar el panel lateral.
  const menuBtn = $('#btnMenu');
  if (menuBtn) menuBtn.onclick = () => { STATE.sidebarOpen = !STATE.sidebarOpen; applySidebar(); };

  // Buscador desde la titlebar (además de Ctrl+K).
  $('#btnSearchTop')?.addEventListener('click', openSearch);

  // "Mis notas": el icono pliega la lista de proyectos; el texto y la flecha
  // navegan por su cuenta (los cablea el resto de wireTopbar más abajo).
  const foldBtn = $('#btnFoldProjects');
  if (foldBtn) {
    foldBtn.onclick = () => {
      // En el riel colapsado no hay nada que plegar: el icono abre la gestión.
      if ($('#shell')?.classList.contains('collapsed')) {
        STATE.screen = 'initiatives-list'; renderMain(); renderTopStatus(); return;
      }
      // La clase va en #sidebarFold, el contenedor que se pliega; #sidebarTree
      // es el hijo que recorta. Ver .projlist-fold en shell.css.
      const nested = $('#sidebarFold');
      const plegado = nested?.classList.toggle('collapsed-group');
      foldBtn.setAttribute('aria-expanded', plegado ? 'false' : 'true');
    };
  }
  // El texto "Mis notas" abre la misma vista agregada que la fila de abajo.
  $('#btnMyNotes')?.addEventListener('click', () => {
    STATE.screen = 'allnotes'; STATE.selInit = null; STATE.selMeeting = null;
    renderSidebar(); renderMain(); renderTopStatus();
  });
  $('#btnManageSpaces')?.addEventListener('click', () => {
    STATE.screen = 'initiatives-list'; renderMain(); renderTopStatus();
  });

  // Sincronizar con las carpetas del disco: era el botón ↻ de la cabecera
  // "Proyectos", que el mockup eliminó. La acción sigue disponible desde el
  // menú "···" de cualquier proyecto y desde Configuración.
  $('#btnNewInitiative')?.addEventListener('click', promptNewInitiative);
  $('#navHome')?.addEventListener('click', () => { STATE.screen = 'welcome'; STATE.selInit = null; STATE.selMeeting = null; renderSidebar(); renderMain(); renderTopStatus(); });
  $('#btnArchive')?.addEventListener('click', () => { STATE.screen = 'archive'; renderMain(); renderTopStatus(); });
  $('#btnTrash')?.addEventListener('click', () => { STATE.screen = 'trash'; renderMain(); renderTopStatus(); });
  $('#btnSettingsSide')?.addEventListener('click', () => { STATE.screen = 'settings'; renderMain(); renderTopStatus(); });

  // Tema claro/oscuro. El botón vive ahora en la titlebar y es solo un icono
  // (sol/luna) que se intercambia en el sprite, sin etiqueta de texto.
  const themeBtn = $('#btnThemeToggle');
  const themeIconUse = $('#themeIcon')?.querySelector('use');
  const updateThemeUI = () => {
    const isDark = load('hm.theme', 'light') === 'dark';
    if (themeIconUse) themeIconUse.setAttribute('href', isDark ? '#i-sun' : '#i-moon');
    if (themeBtn) {
      const lbl = isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
      themeBtn.title = lbl; themeBtn.setAttribute('aria-label', lbl);
    }
  };
  updateThemeUI();
  if (themeBtn) themeBtn.onclick = () => {
    const isDark = load('hm.theme', 'light') === 'dark';
    const next = isDark ? 'light' : 'dark';
    save('hm.theme', next);
    aplicarTema(next);
    // Actualizar favicon
    const icoEl = document.getElementById('faviconIco');
    if (icoEl) icoEl.href = next === 'dark' ? 'assets/helpmeet-dark.ico' : 'assets/helpmeet.ico';
    // Actualizar icono de ventana nativa (Windows)
    try { api.winRefreshTheme(next === 'dark'); } catch (e) { /* solo Windows */ }
    updateThemeUI();
    toast('ok', next === 'dark' ? t('settings.themeDarkActive') : t('settings.themeLightActive'));
  };
  /* El <aside class="sidebar-rail"> desapareció con la Fase 1: el mockup usa un
     solo panel que cambia de ancho, así que los mismos .navitem sirven en los
     dos estados y no hay que cablear un juego de botones duplicado. */
  $('#navMeetings')?.addEventListener('click', openMeetingsView);
  $('#navFavorites')?.addEventListener('click', () => { STATE.screen = 'favorites'; renderMain(); renderTopStatus(); });
  $('#navDocs')?.addEventListener('click', openDocsView);

  // Controles de ventana frameless. Los iconos base vienen del sprite; solo se
  // sustituye el de maximizar, que alterna entre cuadrado y "restaurar".
  const wcMax = $('#wcMax');
  const updateMaxIcon = async () => {
    if (!wcMax) return;
    const r = await api.winIsMaximized().catch(() => ({ maximized: false }));
    const u = wcMax.querySelector('use');
    if (u) u.setAttribute('href', (r && r.maximized) ? '#i-pages' : '#i-maximize');
  };
  const wcMin = $('#wcMin'), wcClose = $('#wcClose');

  if (wcMin) wcMin.onclick = () => api.winMinimize();
  if (wcMax) wcMax.onclick = async () => { await api.winMaximize(); setTimeout(updateMaxIcon, 80); };
  if (wcClose) wcClose.onclick = () => api.winClose();

  /* Arrastre de ventana desde la barra de título, ignorando lo interactivo.
     Con la Fase 1 la barra pasó de .topbar a .titlebar y este querySelector
     quedó devolviendo null: la ventana dejó de poder moverse y de responder al
     doble clic para maximizar. Se aceptan las dos clases para no volver a
     romperlo si alguna pantalla vieja sigue usando la anterior. */
  const topbar = document.querySelector('.titlebar, .topbar');
  if (topbar) {
    topbar.addEventListener('mousedown', async (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, input, a, [role="button"], .brand, .win-controls, .wincontrols, .topbar-status')) return;
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
      if (e.target.closest('button, input, a, [role="button"], .brand, .win-controls, .wincontrols')) return;
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
    <div class="setup-theme-toggle" id="setupThemeChips">
      <button class="cfg-chip" data-theme-opt="light">Claro</button>
      <button class="cfg-chip" data-theme-opt="dark">Oscuro</button>
    </div>
    <div class="setup-box">
      <div class="setup-hero">
        <img class="setup-logo-img" src="assets/helpmeet-symbol.svg?v=20260802v2" alt="">
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

  // Modo claro/oscuro también aquí: es la primera pantalla que se ve y
  // todavía no hay forma de llegar a Configuración para elegirlo.
  const themeBox = ov.querySelector('#setupThemeChips');
  if (themeBox) {
    const renderTheme = () => {
      const cur = load('hm.theme', 'light');
      themeBox.querySelectorAll('[data-theme-opt]').forEach(b =>
        b.classList.toggle('on', b.dataset.themeOpt === cur));
    };
    themeBox.querySelectorAll('[data-theme-opt]').forEach(b => b.onclick = () => {
      const v = b.dataset.themeOpt;
      save('hm.theme', v);
      aplicarTema(v);
      renderTheme();
    });
    renderTheme();
  }

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
          try { await api.v2.clearVoskCache(); } catch (_) { /* */ }
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
  // Recuperacion al arrancar (V2). Si no hay backend, no molesta.
  // Solo disponible en planes Pro/Team.
  if (hasFeature('recovery') && v2Available('list_recoverable_recordings')) {
    const recs = await api.v2.listRecoverable();
    if (recs && recs.length) showRecoveryBanner(recs[0]);
  }
}

// Captura de errores JS que de otro modo se perderían en silencio (p. ej. una
// promesa rechazada dentro de un setTimeout sin await). Sin esto, un fallo de
// render durante "Iniciar grabación" hacía que "no pasara nada".
window.addEventListener('error', (e) => {
  console.error('[JS error]', e.message, e.filename + ':' + e.lineno);
  try { toast('err', 'Error: ' + e.message); } catch (_) { /* toast no listo */ }
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = (e && e.reason && (e.reason.message || e.reason)) || 'desconocido';
  console.error('[promesa no manejada]', reason);
  try { toast('err', 'Error: ' + reason); } catch (_) { /* toast no listo */ }
});

async function init() {
  applySidebar();
  wireTopbar();
  wireSearchOverlay();
  setAppState('idle');

  // Verificar licencia
  if (HAS_PYWEBVIEW()) {
    try {
      const lic = await api.checkLicense();
      if (!lic || !lic.ok) { showLicenseGate(); return; }
      // Cargar features del plan para gating de UI
      window._planFeatures = await api.getPlanFeatures();
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



/* ============================================================
   PANEL FLOTANTE DE GRABACIÓN — FASE 7
   Cronómetro centrado, burbujas de lo transcrito y controles al pie.

   Ausencia deliberada: Pausar/Reanudar. api_recording.py solo expone silenciar
   (toggle_meeting_mic_mute / toggle_screen_mic_mute) y detener. Construir la
   pausa de verdad implica cortar y retomar la captura sin cerrar la sesión, y
   decidir qué pasa con las marcas de tiempo durante el hueco — es desarrollo,
   no rediseño. Un botón que no hace nada es peor que su ausencia.
   ============================================================ */
function recPanel(opts) {
  opts = opts || {};
  const esPantalla = opts.modo === 'screen';
  const it = STATE.initiatives.find(x => x.id === STATE.selInit);
  const silenciado = esPantalla ? STATE.micMuted : STATE.meetingMicMuted;

  const panel = el('div', 'rec-panel' + (STATE._recPanelMin ? ' is-minimized' : '') + (esPantalla ? '' : ' mode-audio'));
  panel.id = 'recPanel';

  const btn = (cls, icono, titulo, onClick, extra) => {
    const b = el('button', cls);
    b.type = 'button';
    if (titulo) { b.title = titulo; b.setAttribute('aria-label', titulo); }
    b.innerHTML = `<svg class="icon"><use href="#${icono}"/></svg>` + (extra || '');
    if (onClick) b.onclick = onClick;
    return b;
  };

  /* ---- Cabecera: buscar a la izquierda; ajustes, copiar y minimizar a la
     derecha. Las tres de la derecha son de sesión; buscar es de contenido, y por
     eso queda sola en el otro extremo. ---- */
  const head = el('div', 'rec-panel-head');
  head.appendChild(btn('icon-btn', 'i-search', 'Buscar en lo transcrito', openSearch));

  /* Título en la cabecera, editable con un clic. La reunión nace con la fecha
     porque preguntarlo antes de grabar frenaba el arranque; poder escribirlo
     ACÁ, mientras la reunión pasa, es el momento en que de verdad se sabe de
     qué es. Se guarda al salir del campo o con Enter. */
  const tituloActual = (STATE.transcript && STATE.transcript.title) || _prettyToday();
  const tit = el('button', 'rec-title');
  tit.type = 'button';
  tit.title = 'Clic para ponerle nombre a la reunión';
  tit.textContent = tituloActual;
  tit.onclick = () => {
    const inp = el('input', 'rec-title-input');
    inp.type = 'text';
    inp.value = tit.textContent;
    inp.setAttribute('aria-label', 'Nombre de la reunión');
    tit.replaceWith(inp);
    inp.focus(); inp.select();
    const guardar = () => {
      const v = (inp.value || '').trim() || tituloActual;
      tit.textContent = v;
      inp.replaceWith(tit);
      if (v !== tituloActual) {
        const mid = STATE.selMeeting || STATE.screenMeetingId;
        if (mid) {
          api.renameMeeting(mid, v).catch(() => {});
          if (STATE.transcript) STATE.transcript.title = v;
          refreshMeetings(STATE.selInit);
        }
      }
    };
    inp.addEventListener('blur', guardar);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      if (e.key === 'Escape') { inp.value = tit.textContent; inp.blur(); }
    });
  };
  head.appendChild(tit);
  const hr = el('div', 'rec-panel-head-right');
  hr.appendChild(btn('icon-btn', 'i-settings', 'Ajustes de transcripción', () => {
    STATE.screen = 'settings'; renderMain(); renderTopStatus();
  }));
  hr.appendChild(btn('icon-btn', 'i-copy', 'Copiar lo transcrito', async () => {
    const us = ((STATE.transcript && STATE.transcript.utterances) || []).filter(u => !u.kind || u.kind === 'utterance');
    if (!us.length) { toast('info', 'Todavía no hay nada transcrito'); return; }
    await navigator.clipboard.writeText(us.map(u => `[${u.time}] ${u.speaker === 'me' ? 'Yo' : 'Los demás'}: ${u.text}`).join('\n'));
    toast('ok', 'Copiado al portapapeles');
  }));
  hr.appendChild(btn('icon-btn rec-min-btn', 'i-minus', 'Minimizar el panel',
    () => { STATE._recPanelMin = true; renderActionBar(); }));
  head.appendChild(hr);
  panel.appendChild(head);

  // ---- Cronómetro ----
  const timer = el('div', 'rec-timer-center');
  timer.innerHTML = `<span class="rec-timer" id="recPanelTimer">${fmt(STATE.recElapsed)}</span>`;
  panel.appendChild(timer);

  // ---- Burbujas ----
  const stream = el('div', 'rec-stream scroll');
  stream.id = 'recStream';
  _recPanelBurbujas(stream);
  panel.appendChild(stream);

  // ---- Pie ----
  const foot = el('div', 'rec-panel-foot');

  const izq = el('div', 'rec-foot-left');
  const wave = el('span', 'waveform live');
  wave.setAttribute('aria-hidden', 'true');
  wave.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
  izq.appendChild(wave);

  izq.appendChild(btn(
    'icon-btn rec-mute-btn' + (silenciado ? ' muted' : ''),
    silenciado ? 'i-mic-off' : 'i-mic',
    silenciado ? 'Activar el micrófono' : 'Silenciar el micrófono',
    () => {
      if (esPantalla) { STATE.micMuted = !STATE.micMuted; _guardarMicMuted(STATE.micMuted); api.toggleScreenMicMute(STATE.micMuted); }
      else toggleMeetingMic();
      renderActionBar();
    }));

  /* Notas y Captura con su nombre revelado al pasar el mouse por el grupo, no
     por cada botón: así se leen los dos a la vez. Misma técnica 0fr→1fr que el
     dock, para que el gesto sea el mismo en toda la app.
     Iconos cambiados: el "pin" no se leía como nota (parecía una aguja suelta)
     y ahora es un cuaderno; la captura usa el marco de imagen, que es lo que
     una captura produce. */
  const grupo = el('div', 'rec-tools is-reveal');
  const conRotulo = (cls, icono, rotulo, onClick) => {
    const b = el('button', cls);
    b.type = 'button';
    b.title = rotulo;
    b.setAttribute('aria-label', rotulo);
    b.innerHTML = `<svg class="icon"><use href="#${icono}"/></svg>` +
      `<span class="rec-label-grid"><span class="rec-label">${esc(rotulo)}</span></span>`;
    b.onclick = onClick;
    return b;
  };
  grupo.appendChild(conRotulo('rec-tool-btn rec-note-btn', 'i-note-plus', 'Notas', () => promptNote()));
  if (esPantalla) {
    grupo.appendChild(conRotulo('rec-tool-btn rec-cap-btn', 'i-screenshot', 'Capturar pantalla',
      () => api.takeCapture(STATE.monitorIdx).then(() => toast('ok', 'Captura guardada'))));
  }
  izq.appendChild(grupo);

  izq.appendChild(el('span', 'rec-foot-sep'));

  /* Detener: cuadrado y no icono de sprite, igual que el mockup. Es la única
     acción irreversible del panel y va después del separador para que no quede
     a la misma distancia visual que el resto. */
  const stop = el('button', 'rec-stop');
  stop.type = 'button';
  stop.title = esPantalla ? 'Detener la grabación de pantalla' : 'Detener la grabación';
  stop.setAttribute('aria-label', stop.title);
  stop.innerHTML = '<span class="rec-stop-sq"></span>';
  stop.onclick = () => { STATE._recPanelMin = false; (esPantalla ? stopScreenRecording : stopMeetingRecording)(); };
  izq.appendChild(stop);

  foot.appendChild(izq);

  // Expandir: solo visible cuando el panel está minimizado.
  foot.appendChild(btn('icon-btn rec-expand-btn', 'i-expand-up', 'Ampliar el panel',
    () => { STATE._recPanelMin = false; renderActionBar(); }));

  /* ---- Selectores del pie derecho ----
     Proyecto destino: en la app la reunión SIEMPRE nace dentro de un proyecto,
     así que poder cambiarlo sin salir de la grabación evita tener que moverla
     después. Monitor y recorte solo existen en modo pantalla. */
  const der = el('div', 'rec-foot-right');

  der.appendChild(_recPick('i-folder', it ? it.name : 'Sin proyecto', (e) => {
    openMenu(e, (STATE.initiatives || []).map(p => ({
      label: p.name, icon: 'folder',
      onClick: async () => {
        if (STATE.selMeeting) await api.moveMeeting(STATE.selMeeting, p.id).catch(() => {});
        STATE.selInit = p.id;
        renderSidebar(); renderActionBar(); renderTopStatus();
        toast('ok', `Se guardará en ${p.name}`);
      },
    })));
  }));

  if (esPantalla) {
    const mon = (STATE.monitors || []).find(m => m.index === STATE.monitorIdx);
    der.appendChild(_recPick('i-monitor', mon ? `Monitor ${mon.index}` : 'Monitor 1', (e) => {
      openMenu(e, (STATE.monitors || []).map(m => ({
        label: `Monitor ${m.index} · ${m.width}×${m.height}`, icon: 'monitor',
        onClick: () => { STATE.monitorIdx = m.index; api.setScreenMonitor(m.index); renderActionBar(); },
      })));
    }));
    const crop = el('button', 'rec-pick rec-crop-btn');
    crop.type = 'button';
    crop.title = 'Ajustar el área de captura';
    crop.setAttribute('aria-label', crop.title);
    crop.innerHTML = '<svg class="icon"><use href="#i-crop"/></svg>';
    crop.onclick = () => { STATE.screenPanelCollapsed = false; showScreenPanel(); };
    der.appendChild(crop);
  }

  // Idioma de transcripción: los que realmente soporta Vosk.
  const IDIOMAS = { es: 'Español', en: 'English' };
  const actual = IDIOMAS[STATE.txLang] || 'Auto';
  der.appendChild(_recPick(null, actual, (e) => {
    openMenu(e, [{ label: 'Auto', onClick: () => { STATE.txLang = ''; renderActionBar(); } }]
      .concat(Object.keys(IDIOMAS).map(k => ({
        label: IDIOMAS[k], onClick: () => { STATE.txLang = k; renderActionBar(); },
      }))));
  }));

  foot.appendChild(der);
  panel.appendChild(foot);
  return panel;
}

/* Selector del pie: icono opcional + valor + chevron hacia arriba (el menú se
   abre hacia arriba porque el panel vive pegado al borde inferior). */
function _recPick(icono, valor, onClick) {
  const b = el('button', 'rec-pick');
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'true');
  b.innerHTML =
    (icono ? `<svg class="icon"><use href="#${icono}"/></svg>` : '') +
    `<span class="rec-pick-val">${esc(valor)}</span>` +
    `<svg class="icon rec-pick-chev"><use href="#i-chevup"/></svg>`;
  b.onclick = onClick;
  return b;
}

/* Burbujas del panel: las frases ya cerradas, y al final una burbuja en curso
   con el texto parcial que el motor todavía está refinando + los tres puntos.
   Solo se etiqueta "Yo": las frases del interlocutor son el caso por defecto —
   la mayoría del texto— y repetir "Los demás" en cada burbuja era ruido. */
function _recPanelBurbujas(stream) {
  const us = ((STATE.transcript && STATE.transcript.utterances) || [])
    .filter(u => !u.kind || u.kind === 'utterance');
  stream.replaceChildren();

  us.slice(-6).forEach(u => {
    const b = el('div', 'rec-bubble');
    const yo = u.speaker === 'me';
    b.innerHTML = (yo ? '<span class="rec-bubble-who">Yo</span>' : '') + esc(u.text || '');
    stream.appendChild(b);
  });

  // Burbuja en curso: se rellena desde window.setLivePartial.
  const viva = el('div', 'rec-bubble is-live');
  viva.id = 'recLiveBubble';
  _recPintaParcial(viva);
  stream.appendChild(viva);

  stream.scrollTop = stream.scrollHeight;
}

/* Contenido de la burbuja en curso. Sin parcial todavía muestra solo los puntos
   —"sigue escuchando"— en vez de una frase vacía. */
function _recPintaParcial(burbuja) {
  const p = STATE._livePartials || {};
  const yo = (p.me || '').trim();
  const otros = (p.others || '').trim();
  const puntos = '<span class="rec-typing" aria-label="Transcribiendo"><span></span><span></span><span></span></span>';
  if (!yo && !otros) { burbuja.innerHTML = puntos; return; }
  // Si hablo yo se marca; lo del interlocutor va sin etiqueta.
  const texto = yo
    ? '<span class="rec-bubble-who">Yo</span>' + esc(yo)
    : esc(otros);
  burbuja.innerHTML = texto + puntos;
}

/* ============================================================
   SELECCIÓN MÚLTIPLE
   Las casillas de cada fila (.row-checkbox) alimentan una barra global que
   entra desde abajo. Patrón de explorador de archivos: la acción vive en la
   fila y se revela al pasar el mouse, en vez de un "modo selección" que se
   enciende desde una barra de herramientas.
   ============================================================ */
/* Casillas marcadas, sin filtrar por id. Antes se mapeaba a Number(data-mid) y
   se descartaba lo que diera NaN: si una sola fila no traia el atributo, la
   cuenta bajaba y la barra se ocultaba aunque hubiera casillas marcadas. */
function _selMarcadas() {
  return [...document.querySelectorAll('.row-checkbox:checked')];
}
/* Los ids solo hacen falta para EJECUTAR las acciones, no para saber si hay
   seleccion. Se resuelven aparte y se ignoran las filas sin id. */
function _selSeleccionadas() {
  return _selMarcadas()
    .map(c => c.closest('.row-wrap'))
    .filter(Boolean)
    .map(w => Number(w.dataset.mid))
    .filter(n => Number.isFinite(n));
}

function _selBarra() {
  let bar = $('#selBar');
  if (bar) return bar;
  bar = el('div', 'sel-bar');
  bar.id = 'selBar';
  bar.hidden = true;
  document.body.appendChild(bar);
  return bar;
}

function refrescarSeleccion() {
  const marcadas = _selMarcadas();
  const ids = _selSeleccionadas();
  const bar = _selBarra();
  const dock = document.querySelector('.rec-dock');

  if (!marcadas.length) {
    bar.hidden = true;
    bar.replaceChildren();
    if (dock) dock.hidden = false;
    return;
  }

  // El dock se aparta mientras hay selección: las dos barras ocupan el mismo
  // punto. Salvo que haya una grabación en curso, que manda.
  if (dock && STATE.appState === 'idle') dock.hidden = true;

  bar.replaceChildren();
  bar.hidden = false;
  // Reinicia la animación de entrada al cambiar el contenido.
  bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = '';

  const n = marcadas.length;
  const cuenta = el('span', 'sel-count');
  cuenta.innerHTML = `<span class="sel-badge">${n}</span>` +
    `<span>${n === 1 ? 'seleccionada' : 'seleccionadas'}</span>`;
  bar.appendChild(cuenta);

  const limpiar = el('button', 'icon-btn sel-clear');
  limpiar.type = 'button';
  limpiar.title = 'Quitar selección';
  limpiar.setAttribute('aria-label', 'Quitar selección');
  limpiar.innerHTML = '<svg class="icon icon-sm"><use href="#i-close"/></svg>';
  limpiar.onclick = () => {
    document.querySelectorAll('.row-checkbox:checked').forEach(c => { c.checked = false; });
    refrescarSeleccion();
  };
  bar.appendChild(limpiar);
  bar.appendChild(el('span', 'rec-foot-sep'));

  const accion = (icono, texto, onClick) => {
    const b = el('button', 'btn-ghost');
    b.type = 'button';
    b.innerHTML = `<svg class="icon"><use href="#${icono}"/></svg>${texto}`;
    b.onclick = onClick;
    bar.appendChild(b);
    return b;
  };

  // Mover a otro proyecto: existe de verdad (move_meeting).
  accion('i-folder', 'Mover a proyecto', () => {
    pickInitiativeModal(async (iid) => {
      for (const mid of ids) await api.moveMeeting(mid, iid).catch(() => {});
      toast('ok', `${ids.length} ${ids.length === 1 ? 'reunión movida' : 'reuniones movidas'}`);
      STATE.meetingsByInit = {};
      await refreshAll();
      renderSidebar(); renderMain(); refrescarSeleccion();
    });
  });

  // Mover a carpeta: organizar es una tarea a posteriori, mirando la lista,
  // no reunión a reunión — por eso vive acá y no solo en el menú de la fila.
  if (STATE.selInit) {
    accion('i-folder', 'Mover a carpeta', (e) => {
      const carpetas = _getFolders(STATE.selInit);
      const items = carpetas.map(f => ({
        label: f.name, icon: 'folder',
        onClick: () => { ids.forEach(mid => _setMeetingFolder(mid, f.id)); renderMain(); refrescarSeleccion(); },
      }));
      items.push({ sep: true });
      items.push({ label: 'Sacar de la carpeta', icon: 'x',
        onClick: () => { ids.forEach(mid => _setMeetingFolder(mid, null)); renderMain(); refrescarSeleccion(); } });
      openMenu(e, items);
    });
  }

  accion('i-archive', 'Archivar', () => {
    confirmModal('Archivar reuniones',
      `Se archivan ${ids.length} ${ids.length === 1 ? 'reunión' : 'reuniones'}. Se pueden restaurar desde Archivados.`,
      'Archivar', async () => {
        for (const mid of ids) await api.archiveItem('meeting', mid).catch(() => {});
        toast('ok', 'Archivadas');
        STATE.meetingsByInit = {};
        await refreshAll();
        renderSidebar(); renderMain(); refrescarSeleccion();
      });
  });

  // Marcar todas como favoritas: es local (localStorage), instantáneo.
  accion('i-star', 'Favoritas', () => {
    const s = _getMeetingFavs();
    const todasYa = ids.every(id => s.has(id));
    ids.forEach(id => todasYa ? s.delete(id) : s.add(id));
    _setMeetingFavs(s);
    renderSidebar(); renderMain(); refrescarSeleccion();
  });
}

// Delegado global: cualquier casilla de cualquier lista alimenta la misma barra.
/* Se escuchan 'change' Y 'click' en fase de CAPTURA, y con try/catch visible.
   Motivo: la barra no aparecia y por lectura del codigo no se veia por que. Con
   un solo 'change' en fase de burbuja, cualquier handler intermedio que llame a
   stopPropagation la deja muda; y si refrescarSeleccion lanza, el fallo es
   invisible. Asi el evento llega siempre y un error se ve en pantalla en vez de
   perderse en la consola. */
function _selDispara(e) {
  const cb = e.target && e.target.closest
    ? (e.target.closest('.row-checkbox') || (e.target.closest('.row-select-slot') ? e.target.closest('.row-select-slot').querySelector('.row-checkbox') : null))
    : null;
  if (!cb) return;
  // El click sobre la etiqueta cambia el estado DESPUES de este handler.
  requestAnimationFrame(() => {
    try {
      refrescarSeleccion();
    } catch (err) {
      console.error('[seleccion]', err);
      try { toast('err', 'Fallo la barra de seleccion: ' + ((err && err.message) || err)); } catch (_) {}
    }
  });
}
document.addEventListener('change', _selDispara, true);
document.addEventListener('click', _selDispara, true);

/* ============================================================
   TOOLTIP DEL RIEL COLAPSADO
   El title= nativo no se puede posicionar ni estilar: es una caja genérica que
   tapa el icono de abajo justo cuando el riel mide 60px. Este reutiliza el
   mismo texto en un elemento propio, y quita el title mientras se muestra para
   que el del navegador no aparezca encima. Se restaura al salir, porque es el
   nombre accesible que leen los lectores de pantalla.
   ============================================================ */
(function () {
  const RETARDO = 450;
  let tip = null, temporizador = null, activo = null;

  const elemento = () => {
    if (!tip) {
      tip = el('div', 'rail-tooltip');
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    return tip;
  };

  function colocar(el0) {
    const t = elemento();
    const r = el0.getBoundingClientRect();
    t.style.top = Math.min(Math.max(r.top + r.height / 2, 16), window.innerHeight - 16) + 'px';
    const ancho = t.offsetWidth;
    const izq = r.right + 10;
    t.style.left = (izq + ancho > window.innerWidth - 8 ? r.left - ancho - 10 : izq) + 'px';
  }

  function ocultar() {
    clearTimeout(temporizador); temporizador = null;
    if (tip) tip.classList.remove('show');
    activo = null;
  }

  document.addEventListener('mouseover', (e) => {
    const shell = $('#shell');
    if (!shell || !shell.classList.contains('collapsed')) return;
    const btn = e.target.closest('.sidebar [title]');
    if (!btn || btn === activo) return;
    ocultar();
    activo = btn;
    const texto = btn.getAttribute('title');
    if (!texto) return;
    btn.dataset.tipText = texto;
    btn.removeAttribute('title');       // silencia el tooltip nativo
    temporizador = setTimeout(() => {
      const t = elemento();
      t.textContent = texto;
      t.classList.add('show');
      colocar(btn);
    }, RETARDO);
  });

  document.addEventListener('mouseout', (e) => {
    const btn = e.target.closest('.sidebar [title], .sidebar [data-tip-text]');
    if (!btn) return;
    if (btn.dataset.tipText) { btn.setAttribute('title', btn.dataset.tipText); delete btn.dataset.tipText; }
    if (btn === activo) ocultar();
  });

  // Plegar/desplegar deja el tooltip huérfano si no se cierra a mano.
  document.addEventListener('click', (e) => { if (e.target.closest('#btnMenu')) ocultar(); });
  window.addEventListener('blur', ocultar);
})();

/* ---- Todas mis notas ----
   Las reuniones de todos los proyectos, agrupadas por MES. Se diferencia de
   Inicio a propósito: Inicio es "qué pasó hoy" (tarjeta del día y agrupación por
   día, para lo reciente); esto es el archivo completo, donde el mes es la unidad
   con la que uno busca hacia atrás. */
function viewAllNotes() {
  const wrap = el('div', 'content-scroll scroll');
  const inner = el('div', 'content-inner');

  const items = [];
  for (const [iid, ms] of Object.entries(STATE.meetingsByInit || {})) {
    const it = (STATE.initiatives || []).find(x => x.id === Number(iid));
    for (const m of (ms || [])) items.push({ m, it });
  }
  items.sort((a, b) => String(b.m.started_at || '').localeCompare(String(a.m.started_at || '')));

  const nProy = (STATE.initiatives || []).length;
  const hero = el('div', 'space-hero');
  hero.innerHTML =
    `<div class="space-hero-badge"><svg class="icon"><use href="#i-layers"/></svg></div>` +
    `<h1 class="page-title">Todas mis notas</h1>` +
    `<div class="space-hero-sub">Las reuniones de todos tus proyectos, en un solo sitio.</div>` +
    `<div class="space-hero-meta">` +
      `<span class="item"><svg class="icon"><use href="#i-lock"/></svg>Todo es privado</span>` +
      `<span class="sep">·</span>` +
      `<span class="item"><svg class="icon"><use href="#i-folder"/></svg>${nProy} ${nProy === 1 ? 'proyecto' : 'proyectos'}</span>` +
    `</div>`;
  inner.appendChild(hero);

  if (!items.length) {
    const v = el('div', 'empty-state');
    v.innerHTML =
      `<svg class="icon icon-lg"><use href="#i-pages"/></svg>` +
      `<div class="l1">Todavía no hay reuniones</div>` +
      `<div class="l2">Lo que grabes va a aparecer acá, sin importar en qué proyecto lo guardes.</div>`;
    inner.appendChild(v);
    wrap.appendChild(inner);
    return wrap;
  }

  let mes = null, lista = null;
  items.forEach(({ m, it }) => {
    const et = m.month_label || 'Sin fecha';
    if (et !== mes) {
      const g = el('div', 'group-label'); g.textContent = et;
      inner.appendChild(g);
      lista = el('div', 'list');
      inner.appendChild(lista);
      mes = et;
    }
    lista.appendChild(meetingRow(m, it, { showProject: true, showDate: true }));
  });

  wrap.appendChild(inner);
  return wrap;
}