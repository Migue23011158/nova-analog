/**
 * Nova Analog — interfaz basada en el diseño de Figma Make, conectada a datos reales.
 *
 * Datos: public/sitios.json (lo genera el script 02_similitud.py).
 * Imágenes: teselas Esri World Imagery (mapa y globo), public/arcadia.jpg (HiRISE) y public/shackleton.jpg (LROC). Si faltan las dos últimas,
 *           se muestra un aviso en su lugar.
 *
 * Reglas: ningún número se inventa. Lo que no viene en sitios.json se muestra como SIN DATO.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMapEvents } from 'react-leaflet';
import Globe from 'globe.gl';
import { cargarModelo, clasificar as clasificarGMM } from './nova_gmm.js';
import './App.css';

const BASE = import.meta.env.BASE_URL;
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/* ---------- Idioma (ES / EN) ----------
   Todo texto visible pasa por t('texto en español'). Si el idioma es inglés y el texto está en EN, se traduce;
   si no está, se muestra en español (nunca queda vacío). {n} se reemplaza con valores. */
let LANG = 'es';
const EN = {
  // Navegación y encabezados
  'Explorar': 'Explore', 'Comparar': 'Compare', '¿Cómo se calcula?': 'How is it calculated?',
  'Mi ubicación': 'My location', 'Ubicación activa': 'Location on',
  'Marte · Arcadia Planitia': 'Mars · Arcadia Planitia', 'Luna · Borde de Shackleton': 'Moon · Shackleton rim',
  'ANÁLOGOS TERRESTRES / {n} SITIOS': 'EARTH ANALOGS / {n} SITES',
  'Encuentra un pedazo de Marte o de la Luna en la Tierra.': 'Find a piece of Mars or the Moon on Earth.',
  'Elige Marte o Luna': 'Pick Mars or Moon', 'Elige un sitio': 'Pick a site', 'Compara': 'Compare',
  'ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR': 'DRAG TO ROTATE · SCROLL TO ZOOM',
  'No se pudo cargar sitios.json': 'Could not load sitios.json',
  // Cuerpos y referencias
  'Tierra': 'Earth', 'Marte': 'Mars', 'Luna': 'Moon', 'Borde de Shackleton': 'Shackleton rim',
  'SITIO DE REFERENCIA': 'REFERENCE SITE', '{c} · SITIO DE REFERENCIA': '{c} · REFERENCE SITE',
  'Mira la lista: lugares de la Tierra que ya analizamos y se le parecen.': 'See the list: places on Earth we already analyzed that resemble it.',
  'Tu ubicación': 'Your location',
  'Tu navegador no pudo mostrar el globo 3D (WebGL). Usa la lista de sitios de la derecha.': 'Your browser could not show the 3D globe (WebGL). Use the site list on the right.',
  // Clases
  'No coincide': 'No match', 'Pendiente': 'Pending', 'No evaluado': 'Not evaluated', 'Pendiente de procesar': 'Not processed yet',
  'MARTE': 'MARS', 'LUNA': 'MOON', 'NO COINCIDE': 'NO MATCH', 'PENDIENTE': 'PENDING', 'NO EVALUADO': 'NOT EVALUATED',
  'Ninguna': 'None', 'Ninguna (fuera de rango)': 'None (out of range)', 'Ninguna (filtro: húmedo o con vegetación)': 'None (filter: wet or vegetated)',
  'Fuera de rango': 'Out of range', 'SIN DATO': 'NO DATA', 'Sin dato': 'No data', 'sin dato': 'no data', 'Cargando…': 'Loading…',
  // Novedad, tipo, países
  'Nuevo (provisional)': 'New (provisional)', 'Candidato (citado en literatura)': 'Candidate (cited in literature)', 'Nuevo como estudio': 'New as a study', 'Sin verificar': 'Not verified',
  'Candidato nuevo': 'New candidate', 'Control': 'Control', 'Conocido': 'Known', 'Por verificar': 'To verify',
  'Sudán': 'Sudan', 'Arabia Saudita': 'Saudi Arabia', 'Canadá': 'Canada', 'Noruega': 'Norway', 'Antártida': 'Antarctica', 'EE. UU.': 'USA',
  // Sitios (nombres)
  'Sierra Nevada del Cocuy': 'Sierra Nevada del Cocuy', 'Campo volcánico de Bayuda': 'Bayuda volcanic field',
  'Tubos de lava de Undara': 'Undara lava tubes', 'Cráter Haughton, isla Devon': 'Haughton Crater, Devon Island',
  'Valles Secos de McMurdo': 'McMurdo Dry Valleys',
  // Lista y pesos
  '{n} UBICACIONES': '{n} LOCATIONS', 'Sitios': 'Sites', 'ÍNDICE / 100': 'INDEX / 100',
  'Mejor puntaje': 'Best score', 'Cerca de mí': 'Near me', 'sin acceso por carretera': 'no road access',
  '~{n} días de ti': '~{n} days from you', '~{n} h de ti': '~{n} h from you', 'acceso {n}': 'access {n}', 'acceso SIN DATO': 'access NO DATA',
  '{n} días': '{n} days',
  'MODELO ACTIVO': 'ACTIVE MODEL', 'Pesos por variable': 'Weights by variable', 'PESOS RELATIVOS': 'RELATIVE WEIGHTS',
  'El índice divide por la suma de pesos: solo importa la proporción entre ellos': 'The index divides by the sum of weights: only their proportion matters',
  'Restablecer': 'Reset', 'Movilidad de róveres': 'Rover mobility', 'Construcción': 'Construction',
  // Variables
  'Pendiente ': 'Slope', 'Inercia térmica': 'Thermal inertia', 'Albedo': 'Albedo', 'Ciclos de congelamiento': 'Freeze–thaw cycles',
  '{n} % del año': '{n} % of the year',
  'Unidades distintas (ATI aparente vs. SI): se compara por clases': 'Different units (apparent ATI vs. SI): compared by class',
  'no aplica a la Luna': 'does not apply to the Moon',
  // Parecidos
  'YA ANALIZADOS · SUGERENCIAS': 'ALREADY ANALYZED · SUGGESTIONS',
  'En la Tierra se parecen a Marte': 'On Earth, these resemble Mars', 'En la Tierra se parecen a la Luna': 'On Earth, these resemble the Moon',
  'ÍNDICE VS. {r}': 'INDEX VS. {r}',
  'Resultados ya calculados con el índice y el modelo: no es una búsqueda nueva. Toca un sitio para compararlo con {r}.': 'Results already computed with the index and the model: this is not a new search. Tap a site to compare it with {r}.',
  'Ningún sitio analizado coincide todavía.': 'No analyzed site matches yet.',
  'Índice: {c}': 'Index: {c}', 'Modelo: {c}': 'Model: {c}',
  // Comparar
  'TIERRA': 'EARTH', 'TOCA EL MAPA PARA CONSULTAR CUALQUIER PUNTO': 'TAP THE MAP TO CHECK ANY POINT', 'IMAGEN ORBITAL': 'ORBITAL IMAGE',
  'Imagen orbital de {r}': 'Orbital image of {r}',
  'SIMILITUD CON {r}': 'SIMILARITY TO {r}', 'Clase del sitio: {c}': 'Site class: {c}',
  'mejor coincidencia: {r} {n}': 'best match: {r} {n}', 'clase si ≥ {n}': 'class if ≥ {n}',
  '{n} variables · confianza {c}': '{n} variables · confidence {c}', 'Variables con dato que entran al índice': 'Variables with data that enter the index',
  'Variables con dato que entran al índice, y confianza según los datos disponibles': 'Variables with data that enter the index, and confidence given the available data',
  'Índice de similitud 0–100 · no es una probabilidad': 'Similarity index 0–100 · not a probability',
  'alta': 'high', 'media': 'medium', 'baja': 'low', 'ALTA': 'HIGH', 'MEDIA': 'MEDIUM', 'BAJA': 'LOW',
  'BAJA · Faltan datos críticos': 'LOW · Critical data missing',
  'CONCLUSIÓN': 'CONCLUSION', 'COMPARACIÓN DE VARIABLES · {p}': 'VARIABLE COMPARISON · {p}', 'Perfil del terreno': 'Terrain profile',
  'Confianza': 'Confidence', 'NO APLICA': 'DOES NOT APPLY', 'SIN DATO COMPARABLE': 'NO COMPARABLE DATA', 'NO SE EVALÚA': 'NOT EVALUATED',
  'SIN DATO EN ESTE SITIO': 'NO DATA AT THIS SITE',
  'Esta variable no existe en la Luna: no se compara.': 'This variable does not exist on the Moon: it is not compared.',
  'La Tierra usa inercia térmica aparente (ATI) y Marte o la Luna unidades SI: no se pueden comparar número a número.': 'Earth uses apparent thermal inertia (ATI) and Mars or the Moon use SI units: they cannot be compared number to number.',
  'Esta variable se muestra como contexto, pero no se evalúa en el índice.': 'This variable is shown as context but is not evaluated in the index.',
  'No hay dato de esta variable en este sitio: no entra al índice y baja la confianza.': 'There is no data for this variable at this site: it does not enter the index and lowers confidence.',
  'LÍMITES DEL MODELO': 'MODEL LIMITS', 'Dónde falla la analogía': 'Where the analogy fails',
  'Gravedad': 'Gravity', 'Atmósfera': 'Atmosphere', 'Radiación': 'Radiation',
  '0,38 g en Marte': '0.38 g on Mars', '0,17 g en la Luna': '0.17 g on the Moon',
  'Presión ~0,6 % de la Tierra': 'Pressure ~0.6 % of Earth\'s', 'Prácticamente inexistente': 'Practically none',
  'Sin protección magnetosférica': 'No magnetospheric shielding', 'No aplica': 'Does not apply',
  'Ningún lugar de la Tierra lo reproduce: no se puntúa.': 'No place on Earth reproduces it: it is not scored.',
  'Imagen pendiente': 'Image pending', '({f} en la carpeta public)': '({f} in the public folder)',
  // Punto a gusto
  'Consultando…': 'Checking…', 'No se pudo leer global_clases.bin.': 'Could not read global_clases.bin.',
  'No pasa el filtro': 'Does not pass the filter', 'Zona húmeda, con vegetación, océano o sin dato.': 'Wet or vegetated area, ocean, or no data.',
  'Pasa el filtro, pero está fuera de lo que el modelo conoce de Marte y de la Luna.': 'Passes the filter, but is outside what the model knows about Mars and the Moon.',
  'Pasa el filtro, pero no se parece ni a Marte ni a la Luna.': 'Passes the filter, but resembles neither Mars nor the Moon.',
  'Su pendiente y su albedo se parecen más a Marte que a lo demás.': 'Its slope and albedo resemble Mars more than the rest.',
  'Su pendiente y su albedo se parecen más a la Luna que a lo demás.': 'Its slope and albedo resemble the Moon more than the rest.',
  'PUNTO ELEGIDO · {c}': 'SELECTED POINT · {c}', 'El modelo dice: {c}': 'The model says: {c}',
  'Resultado ya calculado para la celda{k} que contiene el punto. No es un estudio del sitio.': 'Result already computed for the cell{k} containing the point. It is not a site study.',
  ' de ~{n} km': ' of ~{n} km', 'Cerrar': 'Close',
  // Modelo
  'MODELO ENTRENADO · GMM': 'TRAINED MODEL · GMM', 'Parecido relativo': 'Relative resemblance',
  'Sus condiciones están fuera de lo que el modelo conoce de Marte y de la Luna.': 'Its conditions are outside what the model knows about Mars and the Moon.',
  'No se evalúa: superficie húmeda o con vegetación.': 'Not evaluated: wet or vegetated surface.',
  'Faltan pendiente o albedo para este sitio.': 'Slope or albedo is missing for this site.',
  'Compara las tres clases entre sí; no es la probabilidad de "ser Marte".': 'It compares the three classes with each other; it is not the probability of "being Mars".',
  'ÍNDICE FRENTE A MODELO': 'INDEX VS. MODEL', 'Sitio': 'Site', 'Índice': 'Index', 'Modelo': 'Model',
  'Coinciden': 'Agree', 'Difieren': 'Differ',
  // Pie
  'Desarrollado con ayuda de IA (Claude y Gemini) · NASA Space Apps Challenge 2026 · Datos: NASA, ESA, USGS · Imágenes: Esri World Imagery (mapa y globo), {a}, {b}, globo de Marte: NASA/JPL/USGS (Viking MDIM 2.1), globo de la Luna: NASA/GSFC SVS (CGI Moon Kit, LROC). El índice de similitud (0–100) no es una probabilidad; se calcula a 1 km por celda.':
    'Built with AI assistance (Claude and Gemini) · NASA Space Apps Challenge 2026 · Data: NASA, ESA, USGS · Images: Esri World Imagery (map and globe), {a}, {b}, Mars globe: NASA/JPL/USGS (Viking MDIM 2.1), Moon globe: NASA/GSFC SVS (CGI Moon Kit, LROC). The similarity index (0–100) is not a probability; it is computed per 1 km cell.',
};
function t(txt, vars) {
  let r = LANG === 'en' && txt in EN ? EN[txt] : txt;
  if (vars) for (const [k, v] of Object.entries(vars)) r = r.split(`{${k}}`).join(v);
  return r;
}
// Tablas de textos: se traducen al leerlas (Object.keys / entries siguen funcionando)
const tabla = (o) => new Proxy(o, { get: (x, k) => (typeof x[k] === 'string' ? t(x[k]) : x[k]) });
// Clase del modelo GMM (texto que viene de nova_gmm.js)
const tClase = (c) => (c && c.startsWith('Ninguna (filtro') ? t('Ninguna (filtro: húmedo o con vegetación)') : t(c));

/* ---------- Metadatos fijos (presentación) ---------- */
const REFS = {
  arcadia: tabla({
    target: 'mars', cuerpo: 'Marte', nombre: 'Arcadia Planitia', corto: 'Arcadia',
    coords: '47.2° N, 184.3° E', img: 'arcadia.jpg', credito: 'NASA/JPL/USGS (Viking MDIM 2.1)',
    lat: 47.2, lon: -175.7,
  }),
  shackleton_borde: tabla({
    target: 'moon', cuerpo: 'Luna', nombre: 'Borde de Shackleton', corto: 'Shackleton',
    coords: '89.67° S, 129.78° E', img: 'shackleton.jpg', credito: 'NASA/GSFC/Arizona State University (LROC)',
    lat: -89.67, lon: 129.78,
  }),
};

/* Cuerpos del globo de inicio. Marte y la Luna solo muestran su sitio de referencia (sin zoom ni arrastre).
   Texturas en public/: marte_textura.jpg (Viking MDIM 2.1, NASA/USGS) y luna_textura.jpg (CGI Moon Kit, NASA SVS). */
const CUERPOS = {
  tierra: tabla({ nombre: 'Tierra' }),
  marte: tabla({ nombre: 'Marte', ref: 'arcadia', target: 'mars', textura: 'marte_textura.jpg', atm: '#E8743B' }),
  luna: tabla({ nombre: 'Luna', ref: 'shackleton_borde', target: 'moon', textura: 'luna_textura.jpg', atm: null }),
};

/* Clase del modelo en cualquier punto de la Tierra: public/global_clases.bin (lo genera Richard).
   uint8, fila 0 = 90° N, columna 0 = −180°, ancho = 2 × alto. Códigos según LEEME_web_datos.md. */
const CLASES_BIN = tabla({ 1: 'Marte', 2: 'Luna', 3: 'Fuera de rango', 4: 'Ninguna' });
const KIND_BIN = { 1: 'mars', 2: 'moon', 3: 'none', 4: 'none' };
let gridPromesa = null;
function cargarGrilla() {
  if (!gridPromesa) {
    gridPromesa = fetch(BASE + 'global_clases.bin')
      .then((r) => { if (!r.ok) throw new Error('sin archivo'); return r.arrayBuffer(); })
      .then((buf) => {
        const datos = new Uint8Array(buf);
        const W = Math.round(Math.sqrt(datos.length * 2));
        const H = datos.length / W;
        if (!Number.isInteger(H) || W !== 2 * H) throw new Error('formato inesperado');
        return { datos, W, H };
      })
      .catch((e) => { gridPromesa = null; throw e; });
  }
  return gridPromesa;
}
function claseEnPunto(g, lat, lon) {
  const lng = ((((lon + 180) % 360) + 360) % 360) - 180;
  const fila = Math.min(g.H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * g.H)));
  const col = Math.min(g.W - 1, Math.max(0, Math.floor(((lng + 180) / 360) * g.W)));
  return g.datos[fila * g.W + col];
}
const TARGET_TO_REF = { mars: 'arcadia', moon: 'shackleton_borde' };

/* Valores físicos de cada referencia (columna derecha de las filas espejo).
   Fuente: documento del equipo "parametros-8-marte-luna.md" v1.3 (15-nov-2026).
   Si sitios.json trae "valores_referencia", esos valores tienen prioridad.
   La inercia térmica de Marte y la Luna está en unidades SI; la de la Tierra es ATI aparente:
   NO son comparables número a número, por eso se muestran como texto. */
const VALORES_REF_DOCUMENTADOS = {
  arcadia: {
    pendiente_deg: { v: 0.25, src: 'MOLA' },
    albedo: { v: 0.239, src: 'TES' },
    ati: { txt: '224 SI', src: 'TES · Mellon 2000' },
    ciclos_hielo_frac: { v: 0, src: 'MCD v6.2' },
  },
  shackleton_borde: {
    pendiente_deg: { v: 17.0, src: 'LOLA · Barker 2023' },
    albedo: { v: 0.187, src: 'LOLA' },
    ati: { txt: '~55 SI', src: 'Hayne 2017 (global)' },
  },
};

/* Estado de novedad (verificacion-novedad.md, barrido del 14-nov). */
// Guajira: ya citada en Bolívar-Torres et al. 2026 (Int. J. Astrobiology) → candidata, no "nueva"
const NOVEDAD_NOMBRE = tabla({ 'Alta Guajira': 'Candidato (citado en literatura)' });
const novedadDe = (s) => NOVEDAD[s.zona] || NOVEDAD[s.zonaOrig] || NOVEDAD_NOMBRE[s.nombre];
const NOVEDAD = tabla({
  cocuy: 'Nuevo (provisional)',
  bayuda: 'Nuevo (provisional)',
  khaybar: 'Nuevo como estudio',
  undara: 'Sin verificar',
});

const VARS = {
  pendiente_deg: { get label() { return t('Pendiente ').trim(); }, fmt: (v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)}°`, delta: (a, b) => `Δ ${Math.abs(a - b).toFixed(1)}°` },
  ati: { get label() { return t('Inercia térmica'); }, fmt: (v) => `${v.toFixed(3)} ATI`, get nota() { return t('Unidades distintas (ATI aparente vs. SI): se compara por clases'); } },
  albedo: { label: 'Albedo', fmt: (v) => v.toFixed(3), delta: (a, b) => `Δ ${Math.abs(a - b).toFixed(2)}` },
  ciclos_hielo_frac: { get label() { return t('Ciclos de congelamiento'); }, fmt: (v) => t('{n} % del año', { n: Math.round(v * 100) }) },
};

const NOMBRE_CORTO = tabla({
  cocuy: 'Colombia', bayuda: 'Sudán', khaybar: 'Arabia Saudita', undara: 'Australia', atacama: 'Chile',
  devon: 'Canadá', svalbard: 'Noruega', mcmurdo: 'Antártida', mojave: 'EE. UU.',
  colombia: 'Colombia', guajira: 'Colombia', deathvalley: 'EE. UU.', death_valley: 'EE. UU.',
});
const paisDe = (s) => NOMBRE_CORTO[s.zona] || NOMBRE_CORTO[s.zonaOrig] || '';
const nivelDe = (c) => (c === undefined || c === null ? null : c >= 0.75 ? 'ALTA' : c >= 0.5 ? 'MEDIA' : 'BAJA');
const SIN_CARRETERA = ['devon', 'mcmurdo'];
const TIPO = tabla({ nuevo: 'Candidato nuevo', control: 'Control', conocido: 'Conocido', verificar: 'Por verificar' });
const PROP_LABEL = tabla({ movilidad: 'Movilidad de róveres', construccion: 'Construcción' });
const CLASE_TXT = tabla({ mars: 'MARTE', moon: 'LUNA', none: 'NO COINCIDE', pending: 'PENDIENTE', unevaluated: 'NO EVALUADO' });
const PILL_TXT = tabla({ mars: 'Marte', moon: 'Luna', none: 'No coincide', pending: 'Pendiente', unevaluated: 'No evaluado' });
const COLOR = { mars: '#C1440E', moon: '#8DAED0', none: '#6B7280', pending: '#9CA3AF', unevaluated: '#7f8792' };

/* ---------- Utilidades ---------- */
const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : LANG === 'en' ? 'W' : 'O'}`;
const nombreDe = (s) => t(s.nombre);
// Índice redondeado normal, salvo justo bajo el umbral: 59,6 se muestra 59 (no 60), para que coincida con la clase
let UMBRAL = 60;
const fmtIdx = (x) => String(x < UMBRAL && Math.round(x) >= UMBRAL ? UMBRAL - 1 : Math.round(x));

function fmtTiempo(min) {
  if (min === null || min === undefined) return t('SIN DATO');
  return min > 2880 ? t('{n} días', { n: (min / 1440).toFixed(1) }) : `${(min / 60).toFixed(1)} h`;
}

function distanciaKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Miniatura: una tesela satelital de Esri en la posición del sitio
function teselaEsri(lat, lon, z = 11) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latR = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
  return ESRI.replace('{z}', z).replace('{y}', y).replace('{x}', x);
}

/* ---------- Íconos ---------- */
const Icon = ({ name, size = 18 }) => {
  const paths = {
    globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></>),
    compare: <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />,
    pin: (<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>),
    reset: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
    gravity: (<><path d="M12 3v14M8 13l4 4 4-4" /><path d="M5 21h14" /></>),
    wind: <path d="M3 8h12a3 3 0 1 0-3-3M3 12h16a2 2 0 1 1-2 2M3 16h8" />,
    radiation: (<><circle cx="12" cy="12" r="2" /><path d="M12 3a9 9 0 0 1 7.8 4.5L14 11M4.2 7.5A9 9 0 0 0 4.2 16.5L10 13M12 21a9 9 0 0 0 7.8-4.5L14 13" /></>),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

function Logo() {
  return (
    <div className="logo">
      <span className="crater"><i /></span>
      <span>NOVA <strong>ANALOG</strong></span>
    </div>
  );
}

function ClassPill({ kind, long = false }) {
  return (
    <span className={`class-pill ${kind}`}>
      <i />
      {long && kind === 'pending' ? t('Pendiente de procesar') : PILL_TXT[kind]}
    </span>
  );
}

const GlassCard = ({ children, className = '' }) => <div className={`glass-card ${className}`}>{children}</div>;

/* =====================================================================================
   App
   ===================================================================================== */
export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState('explore');
  const [target, setTarget] = useState('mars');
  const [proposito, setProposito] = useState('movilidad');
  const [pesos, setPesos] = useState({});
  const [zonaSel, setZonaSel] = useState('atacama');
  const [miPos, setMiPos] = useState(null);
  const [ayuda, setAyuda] = useState(false);
  const [modelo, setModelo] = useState(null);
  const [cuerpo, setCuerpo] = useState('tierra');
  const [lang, setLang] = useState(() => {
    try { const g = localStorage.getItem('nova_lang'); if (g === 'es' || g === 'en') return g; } catch { /* sin almacenamiento */ }
    return 'en';   // inglés por defecto; el botón ES / EN cambia a español
  });
  LANG = lang;
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem('nova_lang', lang); } catch { /* sin almacenamiento */ }
  }, [lang]);
  const elegirCuerpo = (c) => {
    setCuerpo(c);
    if (CUERPOS[c].target) setTarget(CUERPOS[c].target);
  };

  // Modelo final (GMM bayesiano con rechazo): public/nova_gmm.json
  useEffect(() => {
    cargarModelo(BASE + 'nova_gmm.json').then(setModelo).catch(() => setModelo(null));
  }, []);

  useEffect(() => {
    fetch(BASE + 'sitios.json')
      .then((r) => r.json())
      .then((d) => {
        setDatos(d);
        const props = Object.keys(d.pesos || {});
        const p0 = props.includes('movilidad') ? 'movilidad' : props[0];
        setProposito(p0);
        setPesos({ ...(d.pesos?.[p0] || {}) });
      })
      .catch(() => setError(t('No se pudo cargar sitios.json')));
  }, []);

  // Solo se muestran deslizadores de variables que de verdad entran al índice (están en algún desglose)
  const variables = useMemo(() => {
    const todas = datos?.variables || [];
    const usadas = new Set();
    for (const st of datos?.sitios || []) for (const d of Object.values(st.desglose || {})) Object.keys(d || {}).forEach((k) => usadas.add(k));
    return usadas.size ? todas.filter((v) => usadas.has(v)) : todas;
  }, [datos]);
  const variablesFicha = datos?.variables || [];
  const refs = useMemo(() => {
    const r = datos?.referencias;
    return Array.isArray(r) ? r : Object.keys(r || {});
  }, [datos]);
  const umbral = datos?.umbral_clase ?? 60;
  UMBRAL = umbral;
  const refKey = TARGET_TO_REF[target];

  /* Índice 0–100 con los pesos actuales; ignora variables null o ausentes */
  const indice = (des) => {
    if (!des) return null;
    let s = 0, w = 0;
    for (const v of variables) {
      const x = des[v];
      if (x === null || x === undefined) continue;
      const p = pesos[v] ?? 0;
      s += x * p; w += p;
    }
    return w > 0 ? (100 * s) / w : null;
  };
  const indiceRef = (sitio, rk) => indice(sitio.desglose?.[`${rk}|${proposito}`]);

  /* Clase del sitio: no depende de qué referencia se esté mirando */
  const kindDe = (sitio) => {
    if (sitio.procesado === false) return 'pending';
    if (sitio.filtrado === true) return 'unevaluated';
    let best = null, bs = -1;
    for (const rk of refs) {
      const x = indiceRef(sitio, rk);
      if (x !== null && x > bs) { bs = x; best = rk; }
    }
    return best && bs >= umbral ? REFS[best]?.target || 'none' : 'none';
  };

  const sitios = useMemo(() => {
    if (!datos) return [];
    const vistos = {};
    return (datos.sitios || []).map((s0) => {
      // Si dos sitios comparten zona (ej. dos puntos de Colombia), se les da un identificador único
      const n = (vistos[s0.zona] = (vistos[s0.zona] || 0) + 1);
      const s = n === 1 ? s0 : { ...s0, zonaOrig: s0.zona, zona: `${s0.zona}_${n}` };
      const kind = kindDe(s);
      const evaluable = kind !== 'pending' && kind !== 'unevaluated';
      const score = evaluable ? indiceRef(s, refKey) : null;
      const valoresNum = Object.fromEntries(
        Object.entries(s.valores || {}).map(([k, v]) => [k, v === null || v === undefined ? v : Number(v)]),
      );
      const gmm = modelo ? clasificarGMM(modelo, valoresNum) : null;
      const des = s.desglose?.[`${refKey}|${proposito}`] || {};
      const nvars = variables.filter((v) => des[v] !== null && des[v] !== undefined).length;
      const confNivel = nivelDe(s.confianza?.[`${refKey}|${proposito}`]);
      return { ...s, kind, score, gmm, nvars, confNivel };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, pesos, proposito, refKey, refs, modelo, variables]);

  const sel = sitios.find((s) => s.zona === zonaSel) || sitios[0];

  const cambiarProposito = (p) => {
    setProposito(p);
    setPesos({ ...(datos?.pesos?.[p] || {}) });
  };
  const restablecer = () => setPesos({ ...(datos?.pesos?.[proposito] || {}) });

  const pedirUbicacion = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lon: p.coords.longitude };
          setMiPos(pos);
          resolve(pos);
        },
        () => resolve(null),
      );
    });

  const abrirComparar = (zona) => {
    if (zona) setZonaSel(zona);
    setView('compare');
    window.scrollTo({ top: 0 });
  };

  if (error) return <div className="app-shell"><p className="globe-error" style={{ margin: 40 }}>{error}</p></div>;
  if (!datos || !sel) return <div className="app-shell" />;

  return (
    <div className="app-shell">
      <div className="coordinate-grid" />

      <header className="topbar">
        <Logo />
        <div className="segmented target-switch">
          <button className={`mars-tab ${target === 'mars' ? 'active' : ''}`} onClick={() => setTarget('mars')}>
            <span /> {t('Marte · Arcadia Planitia')}
          </button>
          <button className={`moon-tab ${target === 'moon' ? 'active' : ''}`} onClick={() => setTarget('moon')}>
            <span /> {t('Luna · Borde de Shackleton')}
          </button>
        </div>
        <div className="top-actions">
        <button className="lang-btn" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a español'}>
          <b className={lang === 'es' ? 'on' : ''}>ES</b><i>/</i><b className={lang === 'en' ? 'on' : ''}>EN</b>
        </button>
        <button className="help-btn" onClick={() => setAyuda(true)} aria-label={t('¿Cómo se calcula?')}>?<span>{t('¿Cómo se calcula?')}</span></button>
        <button className={`location-btn ${miPos ? 'on' : ''}`} onClick={pedirUbicacion}>
          <Icon name="pin" size={16} /> <span>{miPos ? t('Ubicación activa') : t('Mi ubicación')}</span>
        </button>
        </div>
      </header>

      <nav className="view-nav">
        <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}>
          <Icon name="globe" /><span>{t('Explorar')}</span>
        </button>
        <button className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}>
          <Icon name="compare" /><span>{t('Comparar')}</span>
        </button>
      </nav>

      {view === 'explore' ? (
        <main className="explore-view">
          <section className="globe-section">
            <div className="explore-heading">
              <span>{t('ANÁLOGOS TERRESTRES / {n} SITIOS', { n: sitios.length })}</span>
              <h1>{t('Encuentra un pedazo de Marte o de la Luna en la Tierra.')}</h1>
              <p><b>1</b> {t('Elige Marte o Luna')} <i /> <b>2</b> {t('Elige un sitio')} <i /> <b>3</b> {t('Compara')}</p>
            </div>
            <div className="segmented body-switch" role="tablist" aria-label="Cuerpo del globo">
              {Object.entries(CUERPOS).map(([k, c]) => (
                <button key={k} className={`${cuerpo === k ? 'active' : ''} b-${k}`} onClick={() => elegirCuerpo(k)}>
                  <span /> {c.nombre}
                </button>
              ))}
            </div>
            {cuerpo === 'tierra' && <span className="globe-hint">{t('ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR')}</span>}
            <EarthGlobe sitios={sitios} sel={sel} miPos={miPos} cuerpo={cuerpo} lang={lang}
              onSelect={(z) => setZonaSel(z)} onCompare={() => abrirComparar()} />
          </section>
          <aside className="explore-sidebar">
            {cuerpo === 'tierra' ? (
              <>
                <SitesList sitios={sitios} sel={sel} miPos={miPos} pedirUbicacion={pedirUbicacion}
                  onSelect={(z) => setZonaSel(z)} onCompare={abrirComparar} />
                <Weights variables={variables} pesos={pesos} setPesos={setPesos} propositos={Object.keys(datos.pesos || {})}
                  proposito={proposito} cambiarProposito={cambiarProposito} restablecer={restablecer} />
              </>
            ) : (
              <Parecidos sitios={sitios} cuerpo={cuerpo} onCompare={abrirComparar} />
            )}
          </aside>
        </main>
      ) : (
        <CompareView datos={datos} sitios={sitios} sel={sel} target={target} refKey={refKey} refs={refs}
          variables={variablesFicha} proposito={proposito} umbral={umbral} indiceRef={indiceRef}
          onSelect={(z) => setZonaSel(z)} />
      )}

      {ayuda && <ComoSeCalcula umbral={umbral} onClose={() => setAyuda(false)} />}

      <footer className="credits">
        {t('Desarrollado con ayuda de IA (Claude y Gemini) · NASA Space Apps Challenge 2026 · Datos: NASA, ESA, USGS · Imágenes: Esri World Imagery (mapa y globo), {a}, {b}, globo de Marte: NASA/JPL/USGS (Viking MDIM 2.1), globo de la Luna: NASA/GSFC SVS (CGI Moon Kit, LROC). El índice de similitud (0–100) no es una probabilidad; se calcula a 1 km por celda.',
          { a: REFS.arcadia.credito, b: REFS.shackleton_borde.credito })}
      </footer>
    </div>
  );
}

/* =====================================================================================
   Explorar: globo 3D real (globe.gl)
   ===================================================================================== */
function EarthGlobe({ sitios, sel, miPos, cuerpo = 'tierra', lang, onSelect, onCompare }) {
  const ref = useRef(null);
  const globeRef = useRef(null);
  const [fallo, setFallo] = useState(false);

  // Crear el globo una sola vez
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let globe;
    try {
      globe = new Globe(el, { animateIn: true })
        .backgroundColor('rgba(0,0,0,0)')
        // Misma imagen satelital de Esri que el mapa: se carga por teselas y gana detalle al acercar
        .globeTileEngineUrl((x, y, l) => ESRI.replace('{z}', l).replace('{y}', y).replace('{x}', x))
        .globeTileEngineMaxLevel(17)
        .showAtmosphere(true)
        .atmosphereColor('#3BA3FF')
        .atmosphereAltitude(0.18)
        .pointLat('lat').pointLng('lon')
        .pointColor('color')
        .pointAltitude('alt')
        .pointRadius('r')
        .pointLabel('label')
        .onPointClick((p) => p.zona && onSelectRef.current(p.zona))
        .ringLat('lat').ringLng('lon')
        .ringColor(() => (t) => `rgba(255,255,255,${1 - t})`)
        .ringMaxRadius(4).ringPropagationSpeed(2.5).ringRepeatPeriod(1100);
      const ctr = globe.controls();
      ctr.autoRotate = true;
      ctr.autoRotateSpeed = 0.35;
      ctr.enableZoom = true;
      el.addEventListener('pointerdown', () => { ctr.autoRotate = false; });
      globeRef.current = globe;
    } catch {
      setFallo(true);
      return;
    }
    const ajustar = () => { const t = Math.min(el.clientWidth, el.clientHeight) || el.clientWidth; globe.width(t).height(t); };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    return () => { ro.disconnect(); globe._destructor?.(); el.innerHTML = ''; };
  }, []);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const vistaRef = useRef('');
  const cfg = CUERPOS[cuerpo];
  const refC = cfg.ref ? REFS[cfg.ref] : null;

  // Al activar "Mi ubicación", el globo gira hasta la posición del usuario
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !miPos || cuerpo !== 'tierra') return;
    g.controls().autoRotate = false;
    g.pointOfView({ lat: miPos.lat, lng: miPos.lon, altitude: 0.45 }, 1800);
  }, [miPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Piel del globo: fotos de Esri (Tierra) o textura de Marte / la Luna (fija, sin zoom ni arrastre)
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const ctr = g.controls();
    if (cuerpo === 'tierra') {
      g.globeImageUrl(null);
      g.globeTileEngineUrl((x, y, l) => ESRI.replace('{z}', l).replace('{y}', y).replace('{x}', x));
      g.showAtmosphere(true).atmosphereColor('#3BA3FF').atmosphereAltitude(0.18);
      ctr.enableRotate = true; ctr.enableZoom = true;
    } else {
      g.globeTileEngineUrl(null);
      g.globeImageUrl(BASE + cfg.textura);
      if (cfg.atm) g.showAtmosphere(true).atmosphereColor(cfg.atm).atmosphereAltitude(0.08);
      else g.showAtmosphere(false);
      ctr.autoRotate = false; ctr.enableRotate = false; ctr.enableZoom = false;
    }
  }, [cuerpo]);

  // Actualizar marcadores cuando cambian los datos, la selección o el cuerpo
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    if (refC) {
      // Marte o Luna: solo el sitio de referencia. No se acerca: misma distancia que la Tierra.
      g.pointsData([{ lat: refC.lat, lon: refC.lon, color: '#FFFFFF', alt: 0.05, r: 1.3,
        label: `<div style="font:11px Space Grotesk;background:#0b111c;border:1px solid #2a3a50;padding:6px 8px;border-radius:8px;color:#eef4ff">${refC.nombre}<br><span style="color:#9fb3c8">${refC.coords}</span></div>` }]);
      g.ringsData([{ lat: refC.lat, lon: refC.lon }]);
      void lang;
      // Shackleton está en el polo: se inclina la vista para que el marcador se vea
      g.pointOfView({ lat: Math.max(-62, Math.min(62, refC.lat)), lng: refC.lon, altitude: 2.9 }, 900);
      vistaRef.current = '';
      return;
    }
    const pts = sitios.map((s) => ({
      zona: s.zona, lat: s.lat, lon: s.lon,
      color: COLOR[s.kind],
      alt: s.zona === sel.zona ? 0.06 : 0.025,
      r: s.zona === sel.zona ? 0.9 : 0.55,
      label: `<div style="font:11px Space Grotesk;background:#0b111c;border:1px solid #2a3a50;padding:6px 8px;border-radius:8px;color:#eef4ff">
        ${nombreDe(s)}<br><span style="color:${COLOR[s.kind]}">${PILL_TXT[s.kind]}${s.score !== null ? ' · ' + fmtIdx(s.score) : ''}</span></div>`,
    }));
    if (miPos) pts.push({ lat: miPos.lat, lon: miPos.lon, color: '#3BA3FF', alt: 0.02, r: 0.45, label: t('Tu ubicación') });
    g.pointsData(pts);
    g.ringsData([{ lat: sel.lat, lon: sel.lon }]);
    // Solo se mueve la cámara si cambió el sitio o el cuerpo (no al activar la ubicación)
    const clave = `${sel.zona}|${cuerpo}`;
    if (vistaRef.current !== clave) {
      vistaRef.current = clave;
      g.pointOfView({ lat: sel.lat, lng: sel.lon, altitude: 2.9 }, 900);
    }
  }, [sitios, sel, miPos, cuerpo, lang]);

  return (
    <div className="globe-area">
      <div className="orbit orbit-a" />
      <div className="orbit orbit-b" />
      {fallo ? (
        <p className="globe-error">{t('Tu navegador no pudo mostrar el globo 3D (WebGL). Usa la lista de sitios de la derecha.')}</p>
      ) : (
        <div className="globe-gl" ref={ref} />
      )}
      {refC ? (
        <GlassCard className="marker-card ref-card">
          <small>{t('{c} · SITIO DE REFERENCIA', { c: cfg.nombre.toUpperCase() })}</small>
          <strong>{refC.nombre}</strong>
          <p className="marker-meta">{refC.coords}</p>
          <p className="marker-meta">{t('Mira la lista: lugares de la Tierra que ya analizamos y se le parecen.')}</p>
        </GlassCard>
      ) : (
        <GlassCard className="marker-card">
          <small>{fmtCoord(sel.lat, sel.lon)}</small>
          <strong>{nombreDe(sel)}</strong>
          <div>
            <ClassPill kind={sel.kind} long />
            <b>{sel.score !== null ? fmtIdx(sel.score) : '—'}</b>
          </div>
          {sel.kind !== 'pending' && sel.kind !== 'unevaluated' && (
            <p className="marker-meta" title={t('Variables con dato que entran al índice, y confianza según los datos disponibles')}>
              {t('{n} variables · confianza {c}', { n: sel.nvars, c: sel.confNivel ? t(sel.confNivel.toLowerCase()) : t('sin dato') })}
            </p>
          )}
          <button onClick={onCompare}>{t('Comparar')} <Icon name="arrow" size={13} /></button>
        </GlassCard>
      )}
      {cuerpo === 'tierra' && <GlassCard className="legend">
        <span><i className="mars" /> {t('Marte')}</span>
        <span><i className="moon" /> {t('Luna')}</span>
        <span><i className="none" /> {t('No coincide')}</span>
        <span><i className="pending" /> {t('Pendiente de procesar')}</span>
        <span><i className="unevaluated" /> {t('No evaluado')}</span>
      </GlassCard>}
    </div>
  );
}

/* ---------- Marte / Luna: lugares de la Tierra ya analizados que se le parecen ---------- */
function Parecidos({ sitios, cuerpo, onCompare }) {
  const cfg = CUERPOS[cuerpo];
  const ref = REFS[cfg.ref];
  const kind = cfg.target;
  const claseModelo = cuerpo === 'marte' ? 'Marte' : 'Luna';
  const lista = sitios
    .filter((s) => s.kind === kind || s.gmm?.clase_final === claseModelo)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return (
    <GlassCard className="sites-card parecidos">
      <div className="card-heading">
        <div><small>{t('YA ANALIZADOS · SUGERENCIAS')}</small><h2>{cuerpo === 'marte' ? t('En la Tierra se parecen a Marte') : t('En la Tierra se parecen a la Luna')}</h2></div>
        <span>{t('ÍNDICE VS. {r}', { r: ref.corto.toUpperCase() })}</span>
      </div>
      <p className="parecidos-nota">
        {t('Resultados ya calculados con el índice y el modelo: no es una búsqueda nueva. Toca un sitio para compararlo con {r}.', { r: ref.nombre })}
      </p>
      <div className="site-list">
        {lista.length === 0 && <p className="parecidos-nota">{t('Ningún sitio analizado coincide todavía.')}</p>}
        {lista.map((s, i) => (
          <button key={s.zona} onClick={() => onCompare(s.zona)}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="site-list-copy">
              <strong>{nombreDe(s)}</strong>
              <small>{paisDe(s)}{novedadDe(s) ? ` · ${novedadDe(s)}` : s.tipo === 'control' ? ` · ${t('Control')}` : ''}</small>
              <span className="parecidos-tags">
                {s.kind === kind && <span className={`tag ${kind}`}>{t('Índice: {c}', { c: t(claseModelo) })}</span>}
                {s.gmm?.clase_final === claseModelo && <span className={`tag ${kind}`}>{t('Modelo: {c}', { c: t(claseModelo) })}</span>}
              </span>
            </span>
            <span className="list-result">
              <b>{s.score !== null ? fmtIdx(s.score) : '—'}</b>
              <small>/ 100</small>
            </span>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

/* ---------- Lista de sitios ---------- */
function SitesList({ sitios, sel, miPos, pedirUbicacion, onSelect, onCompare }) {
  const [orden, setOrden] = useState('score');

  const conDistancia = sitios.map((s) => {
    // Con ubicación: estimación por distancia (×1,35 por vías, a 55 km/h). Sin ubicación: acceso desde la ciudad más cercana.
    const horasAprox = miPos ? (distanciaKm(miPos, s) * 1.35) / 55 : null;
    return { ...s, horasAprox };
  });
  const ordenados = [...conDistancia].sort((a, b) => {
    if (orden === 'score') return (b.score ?? -1) - (a.score ?? -1);
    const da = a.horasAprox ?? (a.viaje_min ?? Infinity) / 60;
    const db = b.horasAprox ?? (b.viaje_min ?? Infinity) / 60;
    return da - db;
  });

  const textoDistancia = (s) => {
    if (SIN_CARRETERA.includes(s.zona)) return t('sin acceso por carretera');
    if (s.horasAprox !== null) {
      return s.horasAprox > 48 ? t('~{n} días de ti', { n: (s.horasAprox / 24).toFixed(1) }) : t('~{n} h de ti', { n: Math.round(s.horasAprox) });
    }
    return s.viaje_min !== null && s.viaje_min !== undefined ? t('acceso {n}', { n: fmtTiempo(s.viaje_min) }) : t('acceso SIN DATO');
  };

  return (
    <GlassCard className="sites-card">
      <div className="card-heading">
        <div><small>{t('{n} UBICACIONES', { n: sitios.length })}</small><h2>{t('Sitios')}</h2></div>
        <span>{t('ÍNDICE / 100')}</span>
      </div>
      <div className="list-tabs">
        <button className={orden === 'score' ? 'active' : ''} onClick={() => setOrden('score')}>{t('Mejor puntaje')}</button>
        <button className={orden === 'near' ? 'active' : ''}
          onClick={async () => { setOrden('near'); if (!miPos) await pedirUbicacion(); }}>
          {t('Cerca de mí')}
        </button>
      </div>
      <div className="site-list">
        {ordenados.map((s, i) => (
          <button key={s.zona}
            className={`${sel.zona === s.zona ? 'selected' : ''} ${s.kind === 'unevaluated' ? 'dashed' : ''}`}
            onClick={() => onSelect(s.zona)} onDoubleClick={() => onCompare(s.zona)}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="site-list-copy">
              <strong>{nombreDe(s)}</strong>
              <small>{paisDe(s)}{novedadDe(s) ? ` · ${novedadDe(s)}` : s.tipo === 'control' ? ` · ${t('Control')}` : ''}</small>
              <ClassPill kind={s.kind} long />
            </span>
            <span className="list-result">
              <b>{s.score !== null ? fmtIdx(s.score) : '—'}</b>
              <small>{textoDistancia(s)}</small>
            </span>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

/* ---------- Pesos ---------- */
function Weights({ variables, pesos, setPesos, propositos, proposito, cambiarProposito, restablecer }) {
  const suma = Math.round(variables.reduce((a, v) => a + (pesos[v] ?? 0), 0) * 100);
  return (
    <GlassCard className="weights">
      <div className="card-heading">
        <div><small>{t('MODELO ACTIVO')}</small><h2>{t('Pesos por variable')}</h2></div>
        <span title={t('El índice divide por la suma de pesos: solo importa la proporción entre ellos')}>{suma === 100 ? 'Σ 100%' : t('PESOS RELATIVOS')}</span>
      </div>
      <div className="segmented purpose-switch">
        {propositos.map((p) => (
          <button key={p} className={proposito === p ? 'active' : ''} onClick={() => cambiarProposito(p)}>
            {PROP_LABEL[p] || p}
          </button>
        ))}
      </div>
      {variables.map((v) => {
        const val = Math.round((pesos[v] ?? 0) * 100);
        return (
          <label className="slider" key={v}>
            <span><b>{VARS[v]?.label || v}</b><em>{val}%</em></span>
            <input type="range" min="0" max="100" value={val}
              onChange={(e) => setPesos({ ...pesos, [v]: Number(e.target.value) / 100 })}
              style={{ '--value': `${val}%` }} />
          </label>
        );
      })}
      <button className="reset" onClick={restablecer}><Icon name="reset" size={15} /> {t('Restablecer')}</button>
    </GlassCard>
  );
}

/* =====================================================================================
   Comparar
   ===================================================================================== */
function CompareView({ datos, sitios, sel, target, refKey, refs, variables, proposito, umbral, indiceRef, onSelect }) {
  const ref = REFS[refKey];
  const evaluable = sel.kind !== 'pending' && sel.kind !== 'unevaluated';
  const [punto, setPunto] = useState(null);   // ubicación a gusto (solo Tierra)
  useEffect(() => setPunto(null), [sel.zona]);
  const elegirPunto = (lat, lon) => {
    setPunto({ lat, lon, estado: 'cargando' });
    cargarGrilla()
      .then((g) => setPunto({ lat, lon, estado: 'ok', codigo: claseEnPunto(g, lat, lon), km: Math.round((360 / g.W) * 111) }))
      .catch(() => setPunto({ lat, lon, estado: 'error' }));
  };
  const des = sel.desglose?.[`${refKey}|${proposito}`] || {};
  const conf = sel.confianza?.[`${refKey}|${proposito}`];
  const valoresRef = { ...(VALORES_REF_DOCUMENTADOS[refKey] || {}) };
  for (const [k, v] of Object.entries(datos.valores_referencia?.[refKey] || {})) {
    if (v !== null && v !== undefined) valoresRef[k] = typeof v === 'object' ? v : { v, src: 'sitios.json' };
  }

  const filas = variables.map((v) => {
    const noAplica = v === 'ciclos_hielo_frac' && target === 'moon';
    const sim = des[v];
    const fueraIndice = evaluable && !noAplica && !(v in des);   // la variable no entra al índice
    const tierra = sel.valores?.[v];
    const ref_ = valoresRef[v];
    const otro = ref_?.v;
    const cfg = VARS[v] || { label: v, fmt: (x) => String(x) };
    const tieneT = tierra !== null && tierra !== undefined;
    const tieneO = (otro !== null && otro !== undefined) || Boolean(ref_?.txt);
    return {
      v, label: cfg.label.toUpperCase(), noAplica, fueraIndice,
      sim: sim === null || sim === undefined ? null : sim,
      tierra: tieneT ? cfg.fmt(tierra) : t('SIN DATO'),
      otro: noAplica ? t('NO APLICA') : ref_?.txt ? ref_.txt : tieneO ? cfg.fmt(otro) : t('SIN DATO'),
      fuente: noAplica ? '' : ref_?.src || '',
      faltaT: !tieneT, faltaO: !noAplica && !tieneO,
      nota: noAplica ? t('no aplica a la Luna')
        : cfg.delta && tieneT && otro !== undefined && otro !== null ? cfg.delta(tierra, otro)
        : cfg.nota || '',
    };
  });

  // Conclusión generada a partir de los datos (español o inglés)
  const en = LANG === 'en';
  const nomSel = nombreDe(sel);
  let conclusion;
  if (sel.kind === 'pending') conclusion = en ? `${nomSel} has not been processed yet: there is no data to compare it.` : `${nomSel} todavía no ha sido procesado: no hay datos para compararlo.`;
  else if (sel.kind === 'unevaluated') conclusion = en ? `${nomSel} is not evaluated: its surface is wet or vegetated.` : `${nomSel} no se evalúa: su superficie es húmeda o tiene vegetación.`;
  else {
    const conDato = filas.filter((f) => !f.noAplica && f.sim !== null).sort((a, b) => b.sim - a.sim);
    const nombre = (f) => VARS[f.v].label.toLowerCase();
    const parecidas = conDato.filter((f) => f.sim >= 0.7).map(nombre);
    const parciales = conDato.filter((f) => f.sim >= 0.45 && f.sim < 0.7).map(nombre);
    const distintas = conDato.filter((f) => f.sim < 0.45).map(nombre);
    const faltan = filas.filter((f) => !f.noAplica && !f.fueraIndice && f.sim === null).map((f) => VARS[f.v].label.toLowerCase());
    const y = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(', ')} ${en ? 'and' : 'y'} ${arr.at(-1)}` : arr[0]);
    const R = ref.corto;
    if (parecidas.length) {
      conclusion = en ? `${nomSel} resembles ${R} in ${y(parecidas)}` : `${nomSel} se parece a ${R} en ${y(parecidas)}`;
      if (parciales.length) conclusion += en ? `; partially in ${y(parciales)}` : `; parcialmente en ${y(parciales)}`;
    } else if (parciales.length) {
      conclusion = en ? `${nomSel} only partially resembles ${R}, in ${y(parciales)}` : `${nomSel} se parece solo parcialmente a ${R}, en ${y(parciales)}`;
    } else if (conDato.length) {
      conclusion = en ? `${nomSel} does not resemble ${R} in any measured variable` : `${nomSel} no se parece a ${R} en ninguna variable medida`;
    } else {
      conclusion = en ? `${nomSel} does not have enough data to compare it with ${R}` : `${nomSel} no tiene datos suficientes para compararlo con ${R}`;
    }
    if (distintas.length) conclusion += en ? `; it differs in ${y(distintas)}` : `; difiere en ${y(distintas)}`;
    if (faltan.length) conclusion += en ? `. No data for ${y(faltan)}` : `. Sin dato de ${y(faltan)}`;
    conclusion += '.';
  }

  const nivelConf = nivelDe(conf);
  const score = evaluable ? indiceRef(sel, refKey) : null;
  const otrosIndices = refs.map((rk) => ({ rk, x: evaluable ? indiceRef(sel, rk) : null }));
  const mejor = otrosIndices.filter((o) => o.x !== null).sort((a, b) => b.x - a.x)[0];

  return (
    <main className={`compare-view ${target}`}>
      <div className={`compare-visual glow-${target}`} key={`${sel.zona}-${target}`}>
        {/* TIERRA: mapa satelital real, con zoom */}
        <section className="site-panel earth">
          <div className="site-heading">
            <span className="eyebrow">{t('TIERRA')}</span>
            <span className="image-meta">{t('TOCA EL MAPA PARA CONSULTAR CUALQUIER PUNTO')}</span>
          </div>
          <div className="site-image">
            <MapContainer key={sel.zona} center={[sel.lat, sel.lon]} zoom={10} minZoom={3} maxZoom={18}
              zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={ESRI} maxNativeZoom={16} maxZoom={18} />
              <ClickPunto onPick={elegirPunto} />
              {punto && (
                <CircleMarker center={[punto.lat, punto.lon]} radius={9}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: punto.estado === 'ok' ? COLOR[KIND_BIN[punto.codigo]] || COLOR.pending : COLOR.pending, fillOpacity: 0.9 }} />
              )}
            </MapContainer>
            {punto && <PuntoCard punto={punto} onClose={() => setPunto(null)} />}
            <span className="corner tl" /><span className="corner tr" />
            <span className="corner bl" /><span className="corner br" />
            <span className="credit">Esri World Imagery</span>
          </div>
          <div className="site-caption">
            <div><h2>{nombreDe(sel)}</h2><p>{fmtCoord(sel.lat, sel.lon)}</p></div>
            <span className="site-chip">{novedadDe(sel) || TIPO[sel.tipo] || sel.tipo}</span>
          </div>
        </section>

        <div className="center-divider" />

        {/* MARTE / LUNA: imagen de NASA del sitio de referencia */}
        <section className={`site-panel ${target}`}>
          <div className="site-heading">
            <span className="eyebrow">{ref.cuerpo.toUpperCase()}</span>
            <span className="image-meta">{t('IMAGEN ORBITAL')}</span>
          </div>
          <div className="site-image">
            <ImagenRef src={BASE + ref.img} alt={t('Imagen orbital de {r}', { r: ref.nombre })} />
            <div className="scan-lines" />
            <span className="corner tl" /><span className="corner tr" />
            <span className="corner bl" /><span className="corner br" />
            <span className="credit">{ref.credito}</span>
          </div>
          <div className="site-caption">
            <div><h2>{ref.nombre}</h2><p>{ref.coords}</p></div>
            <span className="ref-label">{t('SITIO DE REFERENCIA')}</span>
          </div>
        </section>

        <div className={`score-wrap ${target} ${score === null ? 'no-score' : ''}`}>
          <p className="score-title">{t('SIMILITUD CON {r}', { r: ref.corto.toUpperCase() })}</p>
          <div className="score-ring" style={{ '--score': `${(score ?? 0) * 3.6}deg` }}>
            <div><strong>{score === null ? '—' : fmtIdx(score)}</strong><span>/ 100</span></div>
          </div>
        </div>
      </div>

      <div className="score-notes">
        <span className={`score-note clase-note c-${sel.kind}`}>
          {t('Clase del sitio: {c}', { c: CLASE_TXT[sel.kind] })}
          {mejor && mejor.rk !== refKey && ` (${t('mejor coincidencia: {r} {n}', { r: REFS[mejor.rk]?.corto, n: fmtIdx(mejor.x) })})`}
        </span>
        <span className="score-note">
          {otrosIndices.map((o, i) => (
            <span key={o.rk}>{i > 0 && ' · '}{REFS[o.rk]?.cuerpo} {o.x === null ? '—' : fmtIdx(o.x)}</span>
          ))} · {t('clase si ≥ {n}', { n: umbral })}
        </span>
          {evaluable && (
          <span className="score-note" title={t('Variables con dato que entran al índice')}>
            {t('{n} variables · confianza {c}', { n: filas.filter((f) => !f.noAplica && f.sim !== null).length, c: nivelConf ? t(nivelConf.toLowerCase()) : t('sin dato') })}
          </span>
        )}
        <span className="score-note">{t('Índice de similitud 0–100 · no es una probabilidad')}</span>
      </div>

      <section className="site-carousel" aria-label="Seleccionar sitio terrestre">
        {sitios.map((s) => (
          <button key={s.zona} className={sel.zona === s.zona ? 'selected' : ''} onClick={() => onSelect(s.zona)}>
            <span className={`carousel-thumb ${s.kind}`}>
              <img src={teselaEsri(s.lat, s.lon)} alt="" loading="lazy" />
            </span>
            <span className="carousel-copy">
              <strong>{nombreDe(s)}</strong>
              <ClassPill kind={s.kind} />
            </span>
            <b>{s.score !== null ? fmtIdx(s.score) : '—'}</b>
          </button>
        ))}
      </section>

      <a className="comparador-link" href={BASE + 'comparador/comparador.html'} target="_blank" rel="noopener noreferrer">
        {LANG === 'en' ? 'Compare any region →' : 'Comparar cualquier región →'}
      </a>

      <section className="conclusion">
        <span>{t('CONCLUSIÓN')}</span>
        <h3>{conclusion}</h3>
      </section>

      <ModeloSection sel={sel} sitios={sitios} />

      {evaluable && (
        <section className="metrics-section">
          <div className="section-title">
            <div><span>{t('COMPARACIÓN DE VARIABLES · {p}', { p: (PROP_LABEL[proposito] || '').toUpperCase() })}</span><h3>{t('Perfil del terreno')}</h3></div>
            <div className={`confidence conf-${(nivelConf || 'na').toLowerCase()}`}>
              <span>{t('Confianza')}</span>
              <strong>{conf === undefined || conf === null ? '—' : `${Math.round(conf * 100)}%`}</strong>
              <i><b style={{ width: `${Math.round((conf ?? 0) * 100)}%` }} /></i>
              <em>{nivelConf === 'BAJA' ? t('BAJA · Faltan datos críticos') : nivelConf ? t(nivelConf) : t('SIN DATO')}</em>
            </div>
          </div>
          {filas.map((f) => {
            const falta = f.noAplica || f.sim === null;
            const pct = falta ? 0 : Math.round(f.sim * 100);
            return (
              <div className={`mirror-row ${falta ? 'is-missing' : ''}`} key={f.v}>
                <div className="metric-value earth-value">
                  <small>{t('TIERRA')}</small>
                  <strong className={f.faltaT ? 'missing' : ''}>{f.tierra}</strong>
                </div>
                <div className="metric-center">
                  <div className="metric-head"><span>{f.label}</span><b>{falta ? '—' : `${pct}%`}</b></div>
                  {falta ? (
                    <div className="missing-track" title={
                      t(f.noAplica ? 'Esta variable no existe en la Luna: no se compara.'
                        : f.fueraIndice && f.v === 'ati' ? 'La Tierra usa inercia térmica aparente (ATI) y Marte o la Luna unidades SI: no se pueden comparar número a número.'
                        : f.fueraIndice ? 'Esta variable se muestra como contexto, pero no se evalúa en el índice.'
                        : 'No hay dato de esta variable en este sitio: no entra al índice y baja la confianza.')}>
                      <i /> {t(f.noAplica ? 'NO APLICA' : f.fueraIndice && f.v === 'ati' ? 'SIN DATO COMPARABLE' : f.fueraIndice ? 'NO SE EVALÚA' : 'SIN DATO EN ESTE SITIO')} <i />
                    </div>
                  ) : (
                    <div className={`similarity ${target}`}><span style={{ width: `${pct}%` }} /><i style={{ left: `${pct}%` }} /></div>
                  )}
                  <em>{f.nota}</em>
                </div>
                <div className="metric-value target-value">
                  <small>{ref.cuerpo.toUpperCase()}</small>
                  <strong className={f.noAplica ? 'not-applicable' : f.faltaO ? 'missing' : ''}>{f.otro}</strong>
                  {f.fuente && <span className="src">{f.fuente}</span>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="failures">
        <div className="failure-title">
          <span>!</span>
          <div><small>{t('LÍMITES DEL MODELO')}</small><strong>{t('Dónde falla la analogía')}</strong></div>
        </div>
        <Failure icon="gravity" title={t('Gravedad')} text={t(target === 'mars' ? '0,38 g en Marte' : '0,17 g en la Luna')} />
        <Failure icon="wind" title={t('Atmósfera')} text={t(target === 'mars' ? 'Presión ~0,6 % de la Tierra' : 'Prácticamente inexistente')} />
        <Failure icon="radiation" title={t('Radiación')} text={t('Sin protección magnetosférica')} />
      </section>
    </main>
  );
}

function ImagenRef({ src, alt }) {
  const [ok, setOk] = useState(true);
  useEffect(() => setOk(true), [src]);
  return ok ? (
    <img src={src} alt={alt} onError={() => setOk(false)} />
  ) : (
    <div className="img-fallback">{t('Imagen pendiente')}<br />{t('({f} en la carpeta public)', { f: src.split('/').pop() })}</div>
  );
}

function Failure({ icon, title, text }) {
  return (
    <div className="failure">
      <span><Icon name={icon} size={21} /></span>
      <div>
        <strong>{title}</strong><p>{text}</p>
        <em className="na-tag" title={t('Ningún lugar de la Tierra lo reproduce: no se puntúa.')}>{t('No aplica')}</em>
      </div>
    </div>
  );
}

/* ---------- Ubicación a gusto: clic en el mapa de la Tierra ---------- */
function ClickPunto({ onPick }) {
  const map = useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
      map.flyTo(e.latlng, Math.max(map.getZoom(), 9), { duration: 0.8 });
    },
  });
  return null;
}

function PuntoCard({ punto, onClose }) {
  let titulo, kind, nota;
  const c = punto.codigo;
  if (punto.estado === 'cargando') { titulo = t('Consultando…'); kind = 'pending'; }
  else if (punto.estado === 'error') { titulo = t('Sin dato'); kind = 'pending'; nota = t('No se pudo leer global_clases.bin.'); }
  else if (c in CLASES_BIN) {
    titulo = CLASES_BIN[c]; kind = KIND_BIN[c];
    nota = t(c === 3 ? 'Pasa el filtro, pero está fuera de lo que el modelo conoce de Marte y de la Luna.'
      : c === 4 ? 'Pasa el filtro, pero no se parece ni a Marte ni a la Luna.'
      : kind === 'mars' ? 'Su pendiente y su albedo se parecen más a Marte que a lo demás.'
      : 'Su pendiente y su albedo se parecen más a la Luna que a lo demás.');
  } else { titulo = t('No pasa el filtro'); kind = 'unevaluated'; nota = t('Zona húmeda, con vegetación, océano o sin dato.'); }
  return (
    <div className="punto-card">
      <button className="punto-close" onClick={onClose} aria-label={t('Cerrar')}>×</button>
      <small>{t('PUNTO ELEGIDO · {c}', { c: fmtCoord(punto.lat, punto.lon) })}</small>
      <strong style={{ color: COLOR[kind] }}>{t('El modelo dice: {c}', { c: titulo })}</strong>
      {nota && <p>{nota}</p>}
      <p className="punto-escala">
        {t('Resultado ya calculado para la celda{k} que contiene el punto. No es un estudio del sitio.', { k: punto.km ? t(' de ~{n} km', { n: punto.km }) : '' })}
      </p>
    </div>
  );
}

/* ---------- Panel "¿Cómo se calcula?" ---------- */
function ComoSeCalcula({ umbral, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="glass-card modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Cómo se calcula">
        <button className="modal-close" onClick={onClose} aria-label={t('Cerrar')}>×</button>
        {LANG === 'en' ? (
          <>
            <small>METHOD</small>
            <h2>How is the index calculated?</h2>
            <ol>
              <li><b>Pre-filter.</b> Only dry or periglacial surfaces are evaluated. Wet, vegetated areas are shown as "Not evaluated".</li>
              <li><b>Similarity per variable (0 to 1).</b> Each variable of the Earth site is compared with the reference site using a Gaussian function: it is 1 when they are equal and drops as they move apart.</li>
              <li><b>Index (0 to 100).</b> 100 × Σ(weight × similarity) / Σ(weights). Variables without data are left out: that is why confidence is shown.</li>
              <li><b>Class.</b> The reference (Mars or Moon) with the highest index, if it is above {umbral}. If none is: "No match".</li>
            </ol>
            <h3>References</h3>
            <p><b>Mars · Arcadia Planitia</b> (47.2° N, 184.3° E): slope 0.25° (MOLA), albedo 0.239 (TES), thermal inertia 224 SI (TES), never above 0 °C at the surface (Mars Climate Database).</p>
            <p><b>Moon · Shackleton rim</b> (89.67° S, 129.78° E): slope 17.0° (LOLA), albedo 0.187 (LOLA), thermal inertia ~55 SI (global average, Hayne 2017).</p>
            <h3>What the index does not say</h3>
            <ul>
              <li>It is not a probability or a percentage of "being Mars".</li>
              <li>It is computed on 1 km cells: it does not describe a single rock.</li>
              <li>Earth's thermal inertia (apparent ATI) and that of Mars or the Moon (SI) are not compared number to number.</li>
              <li>Gravity, atmosphere and radiation are not similar anywhere on Earth: they are not scored.</li>
            </ul>
          </>
        ) : (
          <>
        <small>MÉTODO</small>
        <h2>¿Cómo se calcula el índice?</h2>
        <ol>
          <li><b>Filtro previo.</b> Solo se evalúan superficies secas o periglaciares. Lo húmedo con vegetación queda como "No evaluado".</li>
          <li><b>Similitud por variable (0 a 1).</b> Cada variable del sitio terrestre se compara con la del sitio de referencia con una función gaussiana: vale 1 si son iguales y baja a medida que se alejan.</li>
          <li><b>Índice (0 a 100).</b> 100 × Σ(peso × similitud) / Σ(pesos). Las variables sin dato no entran: por eso se muestra la confianza.</li>
          <li><b>Clase.</b> La referencia (Marte o Luna) con mayor índice, si pasa de {umbral}. Si ninguna pasa: "No coincide".</li>
        </ol>
        <h3>Referencias</h3>
        <p><b>Marte · Arcadia Planitia</b> (47,2° N, 184,3° E): pendiente 0,25° (MOLA), albedo 0,239 (TES), inercia térmica 224 SI (TES), nunca supera 0 °C en superficie (Mars Climate Database).</p>
        <p><b>Luna · borde de Shackleton</b> (89,67° S, 129,78° E): pendiente 17,0° (LOLA), albedo 0,187 (LOLA), inercia térmica ~55 SI (promedio global, Hayne 2017).</p>
        <h3>Lo que el índice no dice</h3>
        <ul>
          <li>No es una probabilidad ni un porcentaje de "ser Marte".</li>
          <li>Se calcula en celdas de 1 km: no describe una roca puntual.</li>
          <li>La inercia térmica de la Tierra (ATI aparente) y la de Marte o la Luna (SI) no se comparan número a número.</li>
          <li>Gravedad, atmósfera y radiación no se parecen en ningún lugar de la Tierra: no se puntúan.</li>
        </ul>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Modelo final (GMM) e índice frente a modelo ---------- */
const kindGMM = (c) => {
  if (!c || c === 'SIN DATO') return 'pending';
  if (c === 'Marte') return 'mars';
  if (c === 'Luna') return 'moon';
  return 'none';
};

function ModeloSection({ sel, sitios }) {
  const r = sel.gmm;
  if (r === undefined) return null;
  const clase = r?.clase_final ?? 'SIN DATO';
  const sinDato = clase === 'SIN DATO';
  const color = COLOR[kindGMM(clase)];
  const barras = [
    { n: 'Marte', v: r?.p_marte, c: COLOR.mars },
    { n: 'Luna', v: r?.p_luna, c: COLOR.moon },
    { n: 'Ninguna', v: r?.p_ninguna, c: COLOR.none },
  ];
  const catIndice = (s) => ({ mars: 'Marte', moon: 'Luna', none: 'Ninguna' })[s.kind] || null;   // null = no comparable
  const catModelo = (s) => { const c = s.gmm?.clase_final; if (!c || c === 'SIN DATO') return null; return c.startsWith('Ninguna') ? 'Ninguna' : c; };

  return (
    <section className="model-section">
      <div className="glass-card model-card">
        <small>{t('MODELO ENTRENADO · GMM')}</small>
        <div className="model-class" style={{ color, borderColor: color }}>{sinDato ? t('SIN DATO') : tClase(clase)}</div>
        {clase.startsWith('Ninguna (fuera de rango)') && (
          <p className="model-note">{t('Sus condiciones están fuera de lo que el modelo conoce de Marte y de la Luna.')}</p>
        )}
        {clase.startsWith('Ninguna (filtro') && (
          <p className="model-note">{t('No se evalúa: superficie húmeda o con vegetación.')}</p>
        )}
        {sinDato && <p className="model-note">{t('Faltan pendiente o albedo para este sitio.')}</p>}
        {!sinDato && r?.p_marte !== undefined && (
          <>
            <h4>{t('Parecido relativo')}</h4>
            {barras.map((b) => (
              <div className="model-bar" key={b.n}>
                <span>{t(b.n)}</span>
                <i><b style={{ width: `${Math.round(b.v * 100)}%`, background: b.c }} /></i>
                <em>{Math.round(b.v * 100)}%</em>
              </div>
            ))}
            <p className="model-note">{t('Compara las tres clases entre sí; no es la probabilidad de "ser Marte".')}</p>
          </>
        )}
      </div>

      <div className="glass-card model-table">
        <small>{t('ÍNDICE FRENTE A MODELO')}</small>
        <table>
          <thead><tr><th>{t('Sitio')}</th><th>{t('Índice')}</th><th>{t('Modelo')}</th><th /></tr></thead>
          <tbody>
            {sitios.map((s) => {
              const a = PILL_TXT[s.kind];
              const b = s.gmm ? tClase(s.gmm.clase_final) : t('Cargando…');
              const ca = catIndice(s), cb = catModelo(s);
              const comparable = ca !== null && cb !== null;
              const igual = comparable && ca === cb;
              return (
                <tr key={s.zona} className={s.zona === sel.zona ? 'sel' : ''}>
                  <td>{nombreDe(s)}</td>
                  <td style={{ color: COLOR[s.kind] }}>{a}</td>
                  <td style={{ color: COLOR[kindGMM(s.gmm?.clase_final)] }}>{b}</td>
                  <td className={comparable ? (igual ? 'ok' : 'dif') : ''}>{comparable ? t(igual ? 'Coinciden' : 'Difieren') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
