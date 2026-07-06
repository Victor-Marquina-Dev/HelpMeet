# Rediseño "Documentos → .md" (v2) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rediseñar la sección de documentos: ver todos los documentos de todas las iniciativas con filtro y búsqueda, arrastrar-soltar, y un modal "Ver" con Copiar/Abrir .md.

**Architecture:** El módulo puro `documents.py` gana solo `read_markdown`. La clase `Api` orquesta la vista global (`list_all_documents`), la lectura (`read_document`) y la subida por arrastre (`save_uploaded_document`). El frontend reescribe `viewDocs()` reutilizando los helpers reales de la app (`el`, `esc`, `customSelect`, `openModal`, `confirmModal`, `copyText`, `toast`, `emptyState`).

**Tech Stack:** Python 3.12, markitdown, pywebview 5.1 (WebView2), pytest.

**Spec:** `docs/superpowers/specs/2026-07-06-documentos-md-rediseno-design.md`

---

## File Structure

- **Editar** `helpmeet/documents.py` — añadir `read_markdown(docs_dir, md_name)`.
- **Editar** `tests/test_documents.py` — test de `read_markdown`.
- **Editar** `helpmeet/ui/app.py` — `list_all_documents`, `read_document`, `save_uploaded_document` en `Api`.
- **Editar** `helpmeet/ui/web/index.html` — renombrar nav a "Documentos → .md" + cache-bust.
- **Editar** `helpmeet/ui/web/app.js` — reescribir `viewDocs()` (destino, dropzone+drag&drop, lista global con filtro/búsqueda, tarjetas, modal Ver).
- **Editar** `helpmeet/ui/web/style.css` — estilos del rediseño (reemplazan las 6 reglas mínimas de v1).

Contexto: rama `feat/documentos-a-markdown`, árbol limpio (el WIP de "archivar" está en un stash y se restaura al final). Tests con `.\.venv\Scripts\python.exe -m pytest`. Toda edición se commitea con SOLO los archivos de su tarea (nunca `git add -A`), con el trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Ignorar `dist_release/` y el `.drawio`.

---

## Task 1: `read_markdown` en documents.py (TDD)

**Files:** Modify `helpmeet/documents.py`, `tests/test_documents.py`

- [ ] **Step 1: Test que falla**

Añadir a `tests/test_documents.py`:

```python
def test_read_markdown_devuelve_el_contenido(tmp_path):
    src = tmp_path / "nota.txt"
    src.write_text("contenido de prueba para leer", encoding="utf-8")
    docs = tmp_path / "documentos"
    info = documents.save_and_convert(src, docs)
    texto = documents.read_markdown(docs, info["name"])
    assert "contenido de prueba" in texto


def test_read_markdown_inexistente_lanza(tmp_path):
    import pytest
    with pytest.raises(FileNotFoundError):
        documents.read_markdown(tmp_path, "no-existe.md")
```

- [ ] **Step 2: Verificar que falla**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -k read_markdown -v`
Expected: FAIL con `AttributeError: ... has no attribute 'read_markdown'`.

- [ ] **Step 3: Implementación**

Añadir a `helpmeet/documents.py`:

```python
def read_markdown(docs_dir: Path, md_name: str) -> str:
    """Devuelve el texto del .md indicado (para el modal y para copiar)."""
    md_path = Path(docs_dir) / md_name
    return md_path.read_text(encoding="utf-8")
```

(`read_text` ya lanza `FileNotFoundError` si no existe.)

- [ ] **Step 4: Verificar que pasa**

Run: `.\.venv\Scripts\python.exe -m pytest tests/test_documents.py -v`
Expected: PASS (todos, 12 tests).

- [ ] **Step 5: Commit**

```bash
git add helpmeet/documents.py tests/test_documents.py
git commit -m "feat(documents): read_markdown para leer el contenido de un .md"
```

---

## Task 2: Métodos de `Api` (vista global, lectura, subida por arrastre)

**Files:** Modify `helpmeet/ui/app.py`

- [ ] **Step 1: Añadir imports necesarios**

En la cabecera de `app.py`, junto a los imports estándar, asegurar que existen `base64` y `tempfile` (busca `import base64` / `import tempfile`; el archivo ya importa varios). Si falta alguno, añádelo con los demás imports de stdlib.

- [ ] **Step 2: Añadir los métodos en `Api`**

Insertar, junto a los otros métodos de Documentos (después de `delete_document`), dentro de la clase `Api`:

```python
    def list_all_documents(self):
        """Todos los documentos convertidos de TODAS las iniciativas, con su proyecto."""
        out = []
        for ini in repo.list_initiatives(self._session):
            docs_dir = initiative_export_dir(ini, settings.get_export_dir()) / "documentos"
            for doc in documents.list_documents(docs_dir):
                doc = dict(doc)
                doc["initiative_id"] = ini.id
                doc["initiative_name"] = ini.name
                doc["color"] = ini.color or ""
                out.append(doc)
        out.sort(key=lambda d: d.get("created_at", ""), reverse=True)
        return out

    def read_document(self, initiative_id, md_name):
        """Texto del .md (para el modal 'Ver' y para copiar)."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False, "error": "El proyecto ya no existe."}
        try:
            return {"ok": True, "text": documents.read_markdown(docs_dir, md_name)}
        except FileNotFoundError:
            return {"ok": False, "error": "No se pudo leer el documento."}

    def save_uploaded_document(self, initiative_id, name, data_b64):
        """Guarda un archivo arrastrado (base64) y lo convierte a .md."""
        docs_dir = self._documents_dir(initiative_id)
        if docs_dir is None:
            return {"ok": False, "reason": "El proyecto ya no existe.", "name": name}
        safe = Path(name).name or "documento"
        try:
            raw = base64.b64decode(data_b64)
        except Exception:
            return {"ok": False, "reason": "Archivo ilegible.", "name": safe}
        tmp = Path(tempfile.gettempdir()) / f"helpmeet_up_{safe}"
        try:
            tmp.write_bytes(raw)
            info = documents.save_and_convert(tmp, docs_dir)
            return {"ok": True, "converted": info}
        except documents.EmptyDocumentError:
            return {"ok": False, "reason": "Sin texto (¿escaneado?)", "name": safe}
        except documents.UnsupportedDocumentError:
            return {"ok": False, "reason": "Formato no soportado", "name": safe}
        except Exception as exc:  # noqa: BLE001
            _log.exception("Fallo al convertir archivo arrastrado %s", safe)
            return {"ok": False, "reason": str(exc), "name": safe}
        finally:
            try:
                tmp.unlink(missing_ok=True)
            except Exception:
                pass
```

- [ ] **Step 3: Verificar import y tests de API**

Run: `.\.venv\Scripts\python.exe -c "import helpmeet.ui.app; print('ok')"` → `ok`.
Run: `.\.venv\Scripts\python.exe -m pytest tests/test_ui_api.py -q` → PASS.

- [ ] **Step 4: Commit**

```bash
git add helpmeet/ui/app.py
git commit -m "feat(api): documentos globales, lectura y subida por arrastre"
```

---

## Task 3: Frontend — reescribir la pantalla, modal Ver, drag&drop, estilos

**Files:** Modify `helpmeet/ui/web/index.html`, `helpmeet/ui/web/app.js`, `helpmeet/ui/web/style.css`

**Antes de empezar:** lee en `app.js` la implementación ACTUAL de `viewDocs`, `refreshDocsList`, `onDocsPick` (búscalas) y los helpers reales: `el(tag,cls,html)`, `esc(s)`, `customSelect({...})`, `openModal(node)`, `closeModal()`, `confirmModal(title,body,okLabel,onOk,danger)`, `copyText(text)`, `toast(kind,msg)`, `emptyState({...})`, y el objeto `api`. Reutilízalos; no reinventes.

- [ ] **Step 1: Renombrar el nav en `index.html`**

- En `#navDocs`, cambiar el texto del `.si-label` de "Documentos" a "Documentos → .md".
- En `#railDocs`, cambiar `aria-label` y `title` a "Documentos → .md".
- Subir el `?v=` de `style.css` y `app.js` (p. ej. `?v=20260706-1`).

- [ ] **Step 2: Añadir el wrapper de API que falta**

En el objeto `api`, junto a los wrappers de documentos añadidos en v1, agregar:

```javascript
  listAllDocuments: () => call('list_all_documents'),
  readDocument: (iid, name) => call('read_document', iid, name),
  saveUploadedDocument: (iid, name, b64) => call('save_uploaded_document', iid, name, b64),
```

- [ ] **Step 3: Reescribir `viewDocs` y sus auxiliares**

Reemplaza la implementación actual de `viewDocs`/`refreshDocsList`/`onDocsPick` por esta lógica (adaptando `el`/`esc`/`customSelect`/`openModal`/`copyText`/`toast`/`emptyState` a las firmas reales del archivo). `STATE` gana `docsDest` (id proyecto destino), `docsFilter` (`'all'` o id), `docsQuery` (texto).

Estructura y comportamiento requerido:

1. **Carga**: `const inits = await api.listDocumentInitiatives();` y `const docs = await api.listAllDocuments();`. Si `STATE.docsDest` es nulo y hay iniciativas, `STATE.docsDest = inits[0].id`.
2. **Cabecera**: título "Documentos → .md" + subtítulo (texto del spec).
3. **Zona convertir** (tarjeta): etiqueta "Convertir a:" + `customSelect` de proyectos (valor `STATE.docsDest`, `onChange` fija `STATE.docsDest`). Debajo, **dropzone** con:
   - texto "Arrastra aquí tus archivos · PDF · Word · PowerPoint · texto",
   - botón "Elegir archivos…" → `await api.pickAndConvertDocuments(STATE.docsDest)` y luego refrescar lista + toast del resumen,
   - handlers `dragover`/`dragenter` (añaden clase `.drag`, `preventDefault`), `dragleave`/`drop` (quitan `.drag`); en `drop` llamar a `handleDrop(ev)`.
   - Si `inits` está vacío: deshabilitar dropzone y botón.
4. **Barra de lista**: título `Todos los documentos (n)`; **buscador** `<input>` que fija `STATE.docsQuery` y re-renderiza la lista (filtrado en cliente por `name`); **filtro** `customSelect` con opciones `Todas` (valor `'all'`) + una por iniciativa (valor id), fija `STATE.docsFilter`.
5. **Lista**: filtrar `docs` por `docsFilter` (si no es `'all'`, `d.initiative_id === STATE.docsFilter`) y por `docsQuery` (substring case-insensitive en `d.name`). Vacío → `emptyState` (sin iniciativas → "Crea un proyecto…"; sin resultados → "Aún no hay documentos…"). Cada documento = tarjeta con:
   - icono de tipo por extensión de `d.original_name` (`.pdf`→'PDF' rojo, `.docx`→'DOCX' azul, `.pptx`→'PPTX' naranja, `.html/.htm`→'HTML' violeta, resto→'TXT' gris). Usa una función `fileKind(name)`.
   - nombre `d.name`, etiqueta de proyecto (color `d.color` con punto), `d.original_name`, `d.created_at` (formatear a fecha corta con el helper de fechas que use la app; si no hay, mostrar tal cual), tamaño `d.size` (formatear a KB).
   - acciones: **Ver** → `openDocModal(d)`; **Copiar .md** (📋) → `copyDocMd(d)`; **Original** (📂) → `api.openDocumentOriginal(d.initiative_id, d.name)`; **Eliminar** (🗑) → `confirmModal('Eliminar documento', 'Se borrarán el .md y el original de "<nombre>". ¿Seguro?', 'Eliminar', async()=>{ await api.deleteDocument(d.initiative_id, d.name); refrescar; }, true)`.

Funciones auxiliares nuevas:

```javascript
function fileKind(name){
  const e=(name||'').toLowerCase().split('.').pop();
  if(e==='pdf')return{cls:'pdf',lbl:'PDF'};
  if(e==='docx'||e==='doc')return{cls:'doc',lbl:'DOCX'};
  if(e==='pptx'||e==='ppt')return{cls:'ppt',lbl:'PPTX'};
  if(e==='html'||e==='htm')return{cls:'html',lbl:'HTML'};
  return{cls:'txt',lbl:(e||'TXT').toUpperCase().slice(0,4)};
}

async function copyDocMd(d){
  const res=await api.readDocument(d.initiative_id,d.name);
  if(res&&res.ok){ await copyText(res.text); toast('ok','Markdown copiado'); }
  else toast('err','No se pudo leer el documento');
}

// Render Markdown ligero y SEGURO (escapa HTML primero).
function mdToHtml(src){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines=esc(src).split(/\r?\n/); let html=''; let inList=false;
  const inline=s=>s
    .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>');
  for(let ln of lines){
    if(/^\s*---\s*$/.test(ln)){ if(inList){html+='</ul>';inList=false;} html+='<hr>'; continue; }
    const h=ln.match(/^(#{1,3})\s+(.*)$/);
    if(h){ if(inList){html+='</ul>';inList=false;} const n=h[1].length; html+=`<h${n}>${inline(h[2])}</h${n}>`; continue; }
    const li=ln.match(/^\s*[-*]\s+(.*)$/);
    if(li){ if(!inList){html+='<ul>';inList=true;} html+=`<li>${inline(li[1])}</li>`; continue; }
    if(inList){html+='</ul>';inList=false;}
    if(ln.trim()==='') continue;
    html+=`<p>${inline(ln)}</p>`;
  }
  if(inList)html+='</ul>';
  return html;
}

async function openDocModal(d){
  const res=await api.readDocument(d.initiative_id,d.name);
  const text=(res&&res.ok)?res.text:'';
  const k=fileKind(d.original_name);
  // construir el nodo del modal con el helper `el`, con:
  //  - cabecera: <span class="m-ftype ${k.cls}">${k.lbl}</span> + nombre + botones
  //  - botón "Copiar .md": copyText(text) (texto CRUDO), toast ok
  //  - botón "Abrir .md": api.openDocument(d.initiative_id, d.name)
  //  - botón cerrar: closeModal()
  //  - cuerpo: <div class="md">${ res.ok ? mdToHtml(text) : 'No se pudo leer el documento' }</div>
  //  - pie: original + fecha + tamaño
  // luego: openModal(nodo)
}
```

`handleDrop(ev)`: por cada `ev.dataTransfer.files`, si `STATE.docsDest` existe, leer con `FileReader.readAsDataURL`, quitar el prefijo `data:...;base64,`, y `await api.saveUploadedDocument(STATE.docsDest, file.name, b64)`; acumular éxitos/fallos; al terminar, `toast` con el resumen y refrescar la lista. Mostrar "Convirtiendo…" mientras trabaja.

- [ ] **Step 4: Estilos en `style.css`**

Reemplazar las 6 reglas `.docs-*` mínimas de v1 por el set del rediseño (tarjetas, dropzone, barra de lista, iconos de tipo, modal de lectura). Usar variables de tema existentes. Bloque de referencia (adáptalo a las clases que uses en `viewDocs`):

```css
/* ---------- Documentos → .md (rediseño) ---------- */
.docs-screen{padding:24px;max-width:920px;margin:0 auto}
.docs-head h1{margin:0 0 4px;font-size:22px;font-weight:800;letter-spacing:-.01em}
.docs-head h1 .arrow{color:var(--accent)}
.docs-sub{color:var(--text-muted);margin:0 0 20px;font-size:13px;max-width:62ch}
.docs-convert{background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--r-xl);padding:16px;margin-bottom:22px;box-shadow:var(--shadow-soft)}
.docs-convert-top{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.docs-dz{border:2px dashed var(--border-strong);border-radius:var(--r-lg);padding:24px 18px;text-align:center;background:var(--bg-app);transition:border-color .15s,background .15s}
.docs-dz.drag{border-color:var(--accent);background:var(--accent-soft)}
.docs-dz .dz-title{font-weight:700;font-size:14px}
.docs-dz .dz-sub{color:var(--text-muted);font-size:12.5px;margin-top:3px}
.docs-listbar{display:flex;align-items:center;gap:12px;margin-bottom:12px;flex-wrap:wrap}
.docs-listtitle{font-size:15px;font-weight:800}
.docs-listtitle .count{color:var(--text-faint);font-weight:700;margin-left:6px;font-variant-numeric:tabular-nums}
.docs-spacer{flex:1}
.docs-rows{display:flex;flex-direction:column;gap:9px}
.docs-card{display:flex;align-items:center;gap:14px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:var(--r-lg);padding:12px 14px;transition:border-color .15s,box-shadow .15s}
.docs-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-soft)}
.docs-ftype{width:42px;height:42px;flex:0 0 auto;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#fff}
.docs-ftype.pdf{background:#d93025}.docs-ftype.doc{background:#2b6cb0}.docs-ftype.ppt{background:#dd6b20}.docs-ftype.html{background:#805ad5}.docs-ftype.txt{background:#5f6368}
.docs-cbody{min-width:0;flex:1}
.docs-cname{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.docs-cmeta{display:flex;align-items:center;gap:9px;margin-top:3px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)}
.docs-badge{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:var(--r-pill);background:var(--bg-input);color:var(--text-secondary)}
.docs-badge .dot{width:8px;height:8px;border-radius:50%}
.docs-cactions{display:flex;align-items:center;gap:6px;flex:0 0 auto}
.docs-view{display:inline-flex;align-items:center;gap:7px;background:var(--accent-soft);color:var(--accent);border:1px solid transparent;border-radius:var(--r-md);padding:7px 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
.docs-view:hover{background:var(--accent);color:var(--on-accent)}
.docs-ico{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:var(--r-md);border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);cursor:pointer;font-size:15px}
.docs-ico:hover{background:var(--hover-soft);border-color:var(--border-strong)}
.docs-ico.danger:hover{background:var(--danger-soft,rgba(217,48,37,.1));color:var(--danger);border-color:var(--danger)}
/* modal Ver */
.docs-modal{width:min(680px,94vw);max-height:86vh;display:flex;flex-direction:column}
.docs-mhead{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border-subtle)}
.docs-mftype{width:34px;height:34px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex:0 0 auto}
.docs-mtitle{font-weight:800;font-size:14.5px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.docs-mbody{padding:20px 22px;overflow:auto}
.docs-mbody .md :is(h1,h2,h3){margin:.2em 0 .4em;line-height:1.25}
.docs-mbody .md h1{font-size:20px;font-weight:800}
.docs-mbody .md h2{font-size:16px;font-weight:800;color:var(--text-secondary)}
.docs-mbody .md p,.docs-mbody .md li{font-size:13.5px;color:var(--text-secondary)}
.docs-mbody .md code{font-family:var(--font-mono);background:var(--bg-input);padding:1px 5px;border-radius:4px;font-size:12.5px}
.docs-mbody .md hr{border:none;border-top:1px solid var(--border-subtle);margin:14px 0}
.docs-mfoot{padding:10px 16px;border-top:1px solid var(--border-subtle);color:var(--text-faint);font-size:11.5px}
.docs-empty{color:var(--text-faint);font-size:13px}
```

- [ ] **Step 5: Verificaciones**

- `.\.venv\Scripts\python.exe -c "import helpmeet.ui.app; print('ok')"` → `ok`.
- `node --check helpmeet/ui/web/app.js` → sin salida (sintaxis válida). Si no hay `node`, releer el diff con cuidado (llaves/backticks balanceados).
- Releer el diff: `viewDocs` usa los helpers reales; el modal usa `openModal`; "Copiar .md" copia texto crudo; drag&drop usa `saveUploadedDocument`.

- [ ] **Step 6: Commit**

```bash
git add helpmeet/ui/web/index.html helpmeet/ui/web/app.js helpmeet/ui/web/style.css
git commit -m "feat(ui): rediseño Documentos → .md (lista global, arrastrar, modal Ver)"
```

---

## Self-Review (cobertura del spec)

- Rename "Documentos → .md" → Task 3 Step 1.
- Ver todos + filtro + búsqueda → Task 2 (`list_all_documents`) + Task 3 Step 3.
- Destino vs filtro separados → Task 3 (STATE.docsDest vs docsFilter).
- Arrastrar-soltar (base64) → Task 2 (`save_uploaded_document`) + Task 3 (`handleDrop`).
- Modal Ver + Copiar .md + Abrir .md → Task 3 (`openDocModal`, `read_document`, `copyText`, `open_document`).
- Copiar .md en la fila → Task 3 (`copyDocMd`).
- Eliminar ambos con confirmación → Task 3 (`confirmModal` + `delete_document`, que ya borra los dos).
- Estilos claro/oscuro → Task 3 Step 4 (variables de tema).
- `read_markdown` → Task 1.

Tipos/nombres consistentes: `read_markdown`, `list_all_documents`, `read_document`, `save_uploaded_document`, `readDocument`, `listAllDocuments`, `saveUploadedDocument`, `fileKind`, `mdToHtml`, `openDocModal`, `copyDocMd`, `handleDrop`, `STATE.docsDest/docsFilter/docsQuery`.
