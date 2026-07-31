/* Busca el patrón que ya rompió el dock, el riel colapsado y la barra de
   selección: una clase declarada en las hojas VIEJAS y también en las NUEVAS,
   donde la vieja declara propiedades que la nueva no redeclara. Esas
   propiedades sobreviven a la cascada y son las que hacen "no se ve". */
const fs = require('fs');
const base = require('path').join(__dirname, '..', 'helpmeet', 'ui', 'web') + '/';
const VIEJAS = ['style.css', 'css/components.css', 'css/layout.css'];
const NUEVAS = ['css/shell.css', 'css/content.css', 'css/meeting.css',
  'css/calendar.css', 'css/recording.css', 'css/settings.css'];

// Propiedades capaces de hacer invisible o inerte un elemento.
const PELIGROSAS = new Set(['display', 'visibility', 'opacity', 'max-height', 'max-width',
  'height', 'width', 'overflow', 'overflow-x', 'overflow-y', 'pointer-events',
  'position', 'top', 'right', 'bottom', 'left', 'z-index', 'transform', 'clip-path']);

function reglas(txt) {
  // Fuera comentarios y bloques @media/@keyframes (solo el envoltorio).
  const limpio = txt.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(limpio))) {
    const sel = m[1].trim();
    if (!sel || sel.startsWith('@') || sel.startsWith('from') || sel.startsWith('to')) continue;
    const props = new Map();
    m[2].split(';').forEach(d => {
      const i = d.indexOf(':');
      if (i > 0) props.set(d.slice(0, i).trim(), d.slice(i + 1).trim());
    });
    sel.split(',').forEach(s => out.push({ sel: s.trim(), props }));
  }
  return out;
}

function porClase(archivos) {
  const mapa = new Map();   // clase -> Map(prop -> [{archivo, sel}])
  for (const f of archivos) {
    const txt = fs.readFileSync(base + f, 'utf8');
    for (const r of reglas(txt)) {
      // Solo selectores de UNA clase, sin combinadores ni pseudo-estados:
      // son los que compiten de tú a tú por especificidad.
      const m = /^\.([A-Za-z0-9_-]+)$/.exec(r.sel);
      if (!m) continue;
      const cls = m[1];
      if (!mapa.has(cls)) mapa.set(cls, new Map());
      const dst = mapa.get(cls);
      for (const [p, v] of r.props) {
        if (!dst.has(p)) dst.set(p, []);
        dst.get(p).push({ archivo: f, valor: v });
      }
    }
  }
  return mapa;
}

const viejas = porClase(VIEJAS);
const nuevas = porClase(NUEVAS);

const hallazgos = [];
for (const [cls, propsNuevas] of nuevas) {
  const propsViejas = viejas.get(cls);
  if (!propsViejas) continue;
  const sobreviven = [];
  for (const [p, vs] of propsViejas) {
    if (propsNuevas.has(p)) continue;              // la nueva la sobreescribe
    if (!PELIGROSAS.has(p)) continue;              // cosmética, no rompe
    sobreviven.push(p + ': ' + vs[0].valor + '  [' + vs.map(v => v.archivo).join(' + ') + ']');
  }
  if (sobreviven.length) hallazgos.push({ cls, sobreviven });
}

hallazgos.sort((a, b) => b.sobreviven.length - a.sobreviven.length);
if (!hallazgos.length) { console.log('Sin colisiones peligrosas.'); process.exit(0); }
console.log('Clases con propiedades VIEJAS que sobreviven a la regla nueva\n');
for (const h of hallazgos) {
  console.log('.' + h.cls);
  h.sobreviven.forEach(s => console.log('    ' + s));
}
console.log('\nTotal: ' + hallazgos.length + ' clases');
