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

/* ---------- Metadatos fijos (presentación) ---------- */
const REFS = {
  arcadia: {
    target: 'mars', cuerpo: 'Marte', nombre: 'Arcadia Planitia', corto: 'Arcadia',
    coords: '47.2° N, 184.3° E', img: 'arcadia.jpg', credito: 'NASA/JPL-Caltech/UArizona (HiRISE)',
    lat: 47.2, lon: -175.7,
  },
  shackleton_borde: {
    target: 'moon', cuerpo: 'Luna', nombre: 'Borde de Shackleton', corto: 'Shackleton',
    coords: '89.67° S, 129.78° E', img: 'shackleton.jpg', credito: 'NASA/GSFC/Arizona State University (LROC)',
    lat: -89.67, lon: 129.78,
  },
};

/* Cuerpos del globo de inicio. Marte y la Luna solo muestran su sitio de referencia (sin zoom ni arrastre).
   Texturas en public/: marte_textura.jpg (Viking MDIM 2.1, NASA/USGS) y luna_textura.jpg (CGI Moon Kit, NASA SVS). */
const CUERPOS = {
  tierra: { nombre: 'Tierra' },
  marte: { nombre: 'Marte', ref: 'arcadia', target: 'mars', textura: 'marte_textura.jpg', atm: '#E8743B' },
  luna: { nombre: 'Luna', ref: 'shackleton_borde', target: 'moon', textura: 'luna_textura.jpg', atm: null },
};

/* Clase del modelo en cualquier punto de la Tierra: public/global_clases.bin (lo genera Richard).
   uint8, fila 0 = 90° N, columna 0 = −180°, ancho = 2 × alto. Códigos según LEEME_web_datos.md. */
const CLASES_BIN = { 1: 'Marte', 2: 'Luna', 3: 'Fuera de rango', 4: 'Ninguna' };
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
const NOVEDAD_NOMBRE = { 'Alta Guajira': 'Nuevo (provisional)' };
const novedadDe = (s) => NOVEDAD[s.zona] || NOVEDAD[s.zonaOrig] || NOVEDAD_NOMBRE[s.nombre];
const NOVEDAD = {
  cocuy: 'Nuevo (provisional)',
  bayuda: 'Nuevo (provisional)',
  khaybar: 'Nuevo como estudio',
  undara: 'Sin verificar',
};

const VARS = {
  pendiente_deg: { label: 'Pendiente', fmt: (v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)}°`, delta: (a, b) => `Δ ${Math.abs(a - b).toFixed(1)}°` },
  ati: { label: 'Inercia térmica', fmt: (v) => `${v.toFixed(3)} ATI`, nota: 'Unidades distintas (ATI aparente vs. SI): se compara por clases' },
  albedo: { label: 'Albedo', fmt: (v) => v.toFixed(3), delta: (a, b) => `Δ ${Math.abs(a - b).toFixed(2)}` },
  ciclos_hielo_frac: { label: 'Ciclos de congelamiento', fmt: (v) => `${Math.round(v * 100)} % del año` },
};

const NOMBRE_CORTO = {
  cocuy: 'Colombia', bayuda: 'Sudán', khaybar: 'Arabia Saudita', undara: 'Australia', atacama: 'Chile',
  devon: 'Canadá', svalbard: 'Noruega', mcmurdo: 'Antártida', mojave: 'EE. UU.',
  colombia: 'Colombia', guajira: 'Colombia', deathvalley: 'EE. UU.', death_valley: 'EE. UU.',
};
const paisDe = (s) => NOMBRE_CORTO[s.zona] || NOMBRE_CORTO[s.zonaOrig] || '';
const nivelDe = (c) => (c === undefined || c === null ? null : c >= 0.75 ? 'ALTA' : c >= 0.5 ? 'MEDIA' : 'BAJA');
const SIN_CARRETERA = ['devon', 'mcmurdo'];
const TIPO = { nuevo: 'Candidato nuevo', control: 'Control', conocido: 'Conocido', verificar: 'Por verificar' };
const PROP_LABEL = { movilidad: 'Movilidad de róveres', construccion: 'Construcción' };
const CLASE_TXT = { mars: 'MARTE', moon: 'LUNA', none: 'NO COINCIDE', pending: 'PENDIENTE', unevaluated: 'NO EVALUADO' };
const PILL_TXT = { mars: 'Marte', moon: 'Luna', none: 'No coincide', pending: 'Pendiente', unevaluated: 'No evaluado' };
const COLOR = { mars: '#C1440E', moon: '#8DAED0', none: '#6B7280', pending: '#9CA3AF', unevaluated: '#7f8792' };

/* ---------- Utilidades ---------- */
const fmtCoord = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'O'}`;

function fmtTiempo(min) {
  if (min === null || min === undefined) return 'SIN DATO';
  return min > 2880 ? `${(min / 1440).toFixed(1)} días` : `${(min / 60).toFixed(1)} h`;
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
      {long && kind === 'pending' ? 'Pendiente de procesar' : PILL_TXT[kind]}
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
      .catch(() => setError('No se pudo cargar sitios.json'));
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
          <button className={target === 'mars' ? 'active mars-tab' : ''} onClick={() => setTarget('mars')}>
            <span /> Marte · Arcadia Planitia
          </button>
          <button className={target === 'moon' ? 'active moon-tab' : ''} onClick={() => setTarget('moon')}>
            <span /> Luna · Borde de Shackleton
          </button>
        </div>
        <div className="top-actions">
        <button className="help-btn" onClick={() => setAyuda(true)} aria-label="¿Cómo se calcula?">?<span>¿Cómo se calcula?</span></button>
        <button className={`location-btn ${miPos ? 'on' : ''}`} onClick={pedirUbicacion}>
          <Icon name="pin" size={16} /> <span>{miPos ? 'Ubicación activa' : 'Mi ubicación'}</span>
        </button>
        </div>
      </header>

      <nav className="view-nav">
        <button className={view === 'explore' ? 'active' : ''} onClick={() => setView('explore')}>
          <Icon name="globe" /><span>Explorar</span>
        </button>
        <button className={view === 'compare' ? 'active' : ''} onClick={() => setView('compare')}>
          <Icon name="compare" /><span>Comparar</span>
        </button>
      </nav>

      {view === 'explore' ? (
        <main className="explore-view">
          <section className="globe-section">
            <div className="explore-heading">
              <span>ANÁLOGOS TERRESTRES / {sitios.length} SITIOS</span>
              <h1>Encuentra un pedazo de Marte o de la Luna en la Tierra.</h1>
              <p><b>1</b> Elige Marte o Luna <i /> <b>2</b> Elige un sitio <i /> <b>3</b> Compara</p>
            </div>
            <div className="segmented body-switch" role="tablist" aria-label="Cuerpo del globo">
              {Object.entries(CUERPOS).map(([k, c]) => (
                <button key={k} className={`${cuerpo === k ? 'active' : ''} b-${k}`} onClick={() => elegirCuerpo(k)}>
                  <span /> {c.nombre}
                </button>
              ))}
            </div>
            {cuerpo === 'tierra' && <span className="globe-hint">ARRASTRA PARA GIRAR · RUEDA PARA ACERCAR</span>}
            <EarthGlobe sitios={sitios} sel={sel} miPos={miPos} cuerpo={cuerpo}
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
        Desarrollado con ayuda de IA (Claude y Gemini) · NASA Space Apps Challenge 2026 · Datos: NASA, ESA, USGS ·
        Imágenes: Esri World Imagery (mapa y globo), {REFS.arcadia.credito}, {REFS.shackleton_borde.credito},
        globo de Marte: NASA/JPL/USGS (Viking MDIM 2.1), globo de la Luna: NASA/GSFC SVS (CGI Moon Kit, LROC).
        El índice de similitud (0–100) no es una probabilidad; se calcula a 1 km por celda.
      </footer>
    </div>
  );
}

/* =====================================================================================
   Explorar: globo 3D real (globe.gl)
   ===================================================================================== */
function EarthGlobe({ sitios, sel, miPos, cuerpo = 'tierra', onSelect, onCompare }) {
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

  const cfg = CUERPOS[cuerpo];
  const refC = cfg.ref ? REFS[cfg.ref] : null;

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
      // Shackleton está en el polo: se inclina la vista para que el marcador se vea
      g.pointOfView({ lat: Math.max(-62, Math.min(62, refC.lat)), lng: refC.lon, altitude: 2.9 }, 900);
      return;
    }
    const pts = sitios.map((s) => ({
      zona: s.zona, lat: s.lat, lon: s.lon,
      color: COLOR[s.kind],
      alt: s.zona === sel.zona ? 0.06 : 0.025,
      r: s.zona === sel.zona ? 0.9 : 0.55,
      label: `<div style="font:11px Space Grotesk;background:#0b111c;border:1px solid #2a3a50;padding:6px 8px;border-radius:8px;color:#eef4ff">
        ${s.nombre}<br><span style="color:${COLOR[s.kind]}">${PILL_TXT[s.kind]}${s.score !== null ? ' · ' + s.score.toFixed(0) : ''}</span></div>`,
    }));
    if (miPos) pts.push({ lat: miPos.lat, lon: miPos.lon, color: '#3BA3FF', alt: 0.02, r: 0.45, label: 'Tu ubicación' });
    g.pointsData(pts);
    g.ringsData([{ lat: sel.lat, lon: sel.lon }]);
    g.pointOfView({ lat: sel.lat, lng: sel.lon, altitude: 2.9 }, 900);
  }, [sitios, sel, miPos, cuerpo]);

  return (
    <div className="globe-area">
      <div className="orbit orbit-a" />
      <div className="orbit orbit-b" />
      {fallo ? (
        <p className="globe-error">Tu navegador no pudo mostrar el globo 3D (WebGL). Usa la lista de sitios de la derecha.</p>
      ) : (
        <div className="globe-gl" ref={ref} />
      )}
      {refC ? (
        <GlassCard className="marker-card ref-card">
          <small>{cfg.nombre.toUpperCase()} · SITIO DE REFERENCIA</small>
          <strong>{refC.nombre}</strong>
          <p className="marker-meta">{refC.coords}</p>
          <p className="marker-meta">Mira la lista: lugares de la Tierra que ya analizamos y se le parecen.</p>
        </GlassCard>
      ) : (
        <GlassCard className="marker-card">
          <small>{fmtCoord(sel.lat, sel.lon)}</small>
          <strong>{sel.nombre}</strong>
          <div>
            <ClassPill kind={sel.kind} long />
            <b>{sel.score !== null ? sel.score.toFixed(0) : '—'}</b>
          </div>
          {sel.kind !== 'pending' && sel.kind !== 'unevaluated' && (
            <p className="marker-meta" title="Variables con dato que entran al índice, y confianza según los datos disponibles">
              {sel.nvars} variables · confianza {sel.confNivel ? sel.confNivel.toLowerCase() : 'sin dato'}
            </p>
          )}
          <button onClick={onCompare}>Comparar <Icon name="arrow" size={13} /></button>
        </GlassCard>
      )}
      {cuerpo === 'tierra' && <GlassCard className="legend">
        <span><i className="mars" /> Marte</span>
        <span><i className="moon" /> Luna</span>
        <span><i className="none" /> No coincide</span>
        <span><i className="pending" /> Pendiente de procesar</span>
        <span><i className="unevaluated" /> No evaluado</span>
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
        <div><small>YA ANALIZADOS · SUGERENCIAS</small><h2>En la Tierra se parecen a {cuerpo === 'marte' ? 'Marte' : 'la Luna'}</h2></div>
        <span>ÍNDICE VS. {ref.corto.toUpperCase()}</span>
      </div>
      <p className="parecidos-nota">
        Resultados ya calculados con el índice y el modelo: no es una búsqueda nueva. Toca un sitio para compararlo con {ref.nombre}.
      </p>
      <div className="site-list">
        {lista.length === 0 && <p className="parecidos-nota">Ningún sitio analizado coincide todavía.</p>}
        {lista.map((s, i) => (
          <button key={s.zona} onClick={() => onCompare(s.zona)}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="site-list-copy">
              <strong>{s.nombre}</strong>
              <small>{paisDe(s)}{novedadDe(s) ? ` · ${novedadDe(s)}` : s.tipo === 'control' ? ' · Control' : ''}</small>
              <span className="parecidos-tags">
                {s.kind === kind && <span className={`tag ${kind}`}>Índice: {claseModelo}</span>}
                {s.gmm?.clase_final === claseModelo && <span className={`tag ${kind}`}>Modelo: {claseModelo}</span>}
              </span>
            </span>
            <span className="list-result">
              <b>{s.score !== null ? s.score.toFixed(0) : '—'}</b>
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
    if (SIN_CARRETERA.includes(s.zona)) return 'sin acceso por carretera';
    if (s.horasAprox !== null) {
      return s.horasAprox > 48 ? `~${(s.horasAprox / 24).toFixed(1)} días de ti` : `~${Math.round(s.horasAprox)} h de ti`;
    }
    return s.viaje_min !== null && s.viaje_min !== undefined ? `acceso ${fmtTiempo(s.viaje_min)}` : 'acceso SIN DATO';
  };

  return (
    <GlassCard className="sites-card">
      <div className="card-heading">
        <div><small>{sitios.length} UBICACIONES</small><h2>Sitios</h2></div>
        <span>ÍNDICE / 100</span>
      </div>
      <div className="list-tabs">
        <button className={orden === 'score' ? 'active' : ''} onClick={() => setOrden('score')}>Mejor puntaje</button>
        <button className={orden === 'near' ? 'active' : ''}
          onClick={async () => { setOrden('near'); if (!miPos) await pedirUbicacion(); }}>
          Cerca de mí
        </button>
      </div>
      <div className="site-list">
        {ordenados.map((s, i) => (
          <button key={s.zona}
            className={`${sel.zona === s.zona ? 'selected' : ''} ${s.kind === 'unevaluated' ? 'dashed' : ''}`}
            onClick={() => onSelect(s.zona)} onDoubleClick={() => onCompare(s.zona)}>
            <span className="rank">{String(i + 1).padStart(2, '0')}</span>
            <span className="site-list-copy">
              <strong>{s.nombre}</strong>
              <small>{paisDe(s)}{novedadDe(s) ? ` · ${novedadDe(s)}` : s.tipo === 'control' ? ' · Control' : ''}</small>
              <ClassPill kind={s.kind} long />
            </span>
            <span className="list-result">
              <b>{s.score !== null ? s.score.toFixed(0) : '—'}</b>
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
        <div><small>MODELO ACTIVO</small><h2>Pesos por variable</h2></div>
        <span title="El índice divide por la suma de pesos: solo importa la proporción entre ellos">{suma === 100 ? 'Σ 100%' : 'PESOS RELATIVOS'}</span>
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
      <button className="reset" onClick={restablecer}><Icon name="reset" size={15} /> Restablecer</button>
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
      tierra: tieneT ? cfg.fmt(tierra) : 'SIN DATO',
      otro: noAplica ? 'NO APLICA' : ref_?.txt ? ref_.txt : tieneO ? cfg.fmt(otro) : 'SIN DATO',
      fuente: noAplica ? '' : ref_?.src || '',
      faltaT: !tieneT, faltaO: !noAplica && !tieneO,
      nota: noAplica ? 'no aplica a la Luna'
        : cfg.delta && tieneT && otro !== undefined && otro !== null ? cfg.delta(tierra, otro)
        : cfg.nota || '',
    };
  });

  // Conclusión generada a partir de los datos
  let conclusion;
  if (sel.kind === 'pending') conclusion = `${sel.nombre} todavía no ha sido procesado: no hay datos para compararlo.`;
  else if (sel.kind === 'unevaluated') conclusion = `${sel.nombre} no se evalúa: su superficie es húmeda o tiene vegetación.`;
  else {
    const conDato = filas.filter((f) => !f.noAplica && f.sim !== null).sort((a, b) => b.sim - a.sim);
    const nombre = (f) => VARS[f.v].label.toLowerCase();
    const parecidas = conDato.filter((f) => f.sim >= 0.7).map(nombre);
    const parciales = conDato.filter((f) => f.sim >= 0.45 && f.sim < 0.7).map(nombre);
    const distintas = conDato.filter((f) => f.sim < 0.45).map(nombre);
    const faltan = filas.filter((f) => !f.noAplica && !f.fueraIndice && f.sim === null).map((f) => VARS[f.v].label.toLowerCase());
    const y = (arr) => (arr.length > 1 ? `${arr.slice(0, -1).join(', ')} y ${arr.at(-1)}` : arr[0]);
    if (parecidas.length) {
      conclusion = `${sel.nombre} se parece a ${ref.corto} en ${y(parecidas)}`;
      if (parciales.length) conclusion += `; parcialmente en ${y(parciales)}`;
    } else if (parciales.length) {
      conclusion = `${sel.nombre} se parece solo parcialmente a ${ref.corto}, en ${y(parciales)}`;
    } else if (conDato.length) {
      conclusion = `${sel.nombre} no se parece a ${ref.corto} en ninguna variable medida`;
    } else {
      conclusion = `${sel.nombre} no tiene datos suficientes para compararlo con ${ref.corto}`;
    }
    if (distintas.length) conclusion += `; difiere en ${y(distintas)}`;
    if (faltan.length) conclusion += `. Sin dato de ${y(faltan)}`;
    conclusion += '.';
  }

  const nivelConf = nivelDe(conf);
  const score = evaluable ? indiceRef(sel, refKey) : null;
  const otrosIndices = refs.map((rk) => ({ rk, x: evaluable ? indiceRef(sel, rk) : null }));

  return (
    <main className={`compare-view ${target}`}>
      <div className="compare-visual">
        {/* TIERRA: mapa satelital real, con zoom */}
        <section className="site-panel earth">
          <div className="site-heading">
            <span className="eyebrow">TIERRA</span>
            <span className="image-meta">TOCA EL MAPA PARA CONSULTAR CUALQUIER PUNTO</span>
          </div>
          <div className="site-image">
            <MapContainer key={sel.zona} center={[sel.lat, sel.lon]} zoom={10} minZoom={3}
              zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
              <TileLayer url={ESRI} />
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
            <div><h2>{sel.nombre}</h2><p>{fmtCoord(sel.lat, sel.lon)}</p></div>
            <span className="site-chip">{novedadDe(sel) || TIPO[sel.tipo] || sel.tipo}</span>
          </div>
        </section>

        <div className="center-divider" />

        {/* MARTE / LUNA: imagen de NASA del sitio de referencia */}
        <section className={`site-panel ${target}`}>
          <div className="site-heading">
            <span className="eyebrow">{ref.cuerpo.toUpperCase()}</span>
            <span className="image-meta">IMAGEN ORBITAL</span>
          </div>
          <div className="site-image">
            <ImagenRef src={BASE + ref.img} alt={`Imagen orbital de ${ref.nombre}`} />
            <div className="scan-lines" />
            <span className="corner tl" /><span className="corner tr" />
            <span className="corner bl" /><span className="corner br" />
            <span className="credit">{ref.credito}</span>
          </div>
          <div className="site-caption">
            <div><h2>{ref.nombre}</h2><p>{ref.coords}</p></div>
            <span className="ref-label">SITIO DE REFERENCIA</span>
          </div>
        </section>

        <div className={`score-wrap ${target} ${score === null ? 'no-score' : ''}`}>
          <div className="score-ring" style={{ '--score': `${(score ?? 0) * 3.6}deg` }}>
            <div><strong>{score === null ? '—' : score.toFixed(0)}</strong><span>/ 100</span></div>
          </div>
          <p>ÍNDICE VS. {ref.corto.toUpperCase()}</p>
          <div className={`score-class c-${sel.kind}`}>{CLASE_TXT[sel.kind]}</div>
          <small>
            {otrosIndices.map((o, i) => (
              <span key={o.rk}>{i > 0 && ' · '}{REFS[o.rk]?.cuerpo} {o.x === null ? '—' : o.x.toFixed(0)}</span>
            ))} · clase si ≥ {umbral}
          </small>
          {evaluable && (
            <small className="score-note" title="Variables con dato que entran al índice">
              {filas.filter((f) => !f.noAplica && f.sim !== null).length} variables · confianza {nivelConf ? nivelConf.toLowerCase() : 'sin dato'}
            </small>
          )}
          <small className="score-note">Índice de similitud 0–100 · no es una probabilidad</small>
        </div>
      </div>

      <section className="site-carousel" aria-label="Seleccionar sitio terrestre">
        {sitios.map((s) => (
          <button key={s.zona} className={sel.zona === s.zona ? 'selected' : ''} onClick={() => onSelect(s.zona)}>
            <span className={`carousel-thumb ${s.kind}`}>
              <img src={teselaEsri(s.lat, s.lon)} alt="" loading="lazy" />
            </span>
            <span className="carousel-copy">
              <strong>{s.nombre}</strong>
              <ClassPill kind={s.kind} />
            </span>
            <b>{s.score !== null ? s.score.toFixed(0) : '—'}</b>
          </button>
        ))}
      </section>

      <section className="conclusion">
        <span>CONCLUSIÓN</span>
        <h3>{conclusion}</h3>
      </section>

      <ModeloSection sel={sel} sitios={sitios} />

      {evaluable && (
        <section className="metrics-section">
          <div className="section-title">
            <div><span>COMPARACIÓN DE VARIABLES · {PROP_LABEL[proposito]?.toUpperCase()}</span><h3>Perfil del terreno</h3></div>
            <div className={`confidence conf-${(nivelConf || 'na').toLowerCase()}`}>
              <span>Confianza</span>
              <strong>{conf === undefined || conf === null ? '—' : `${Math.round(conf * 100)}%`}</strong>
              <i><b style={{ width: `${Math.round((conf ?? 0) * 100)}%` }} /></i>
              <em>{nivelConf === 'BAJA' ? 'BAJA · Faltan datos críticos' : nivelConf ? nivelConf : 'SIN DATO'}</em>
            </div>
          </div>
          {filas.map((f) => {
            const falta = f.noAplica || f.sim === null;
            const pct = falta ? 0 : Math.round(f.sim * 100);
            return (
              <div className={`mirror-row ${falta ? 'is-missing' : ''}`} key={f.v}>
                <div className="metric-value earth-value">
                  <small>TIERRA</small>
                  <strong className={f.faltaT ? 'missing' : ''}>{f.tierra}</strong>
                </div>
                <div className="metric-center">
                  <div className="metric-head"><span>{f.label}</span><b>{falta ? '—' : `${pct}%`}</b></div>
                  {falta ? (
                    <div className="missing-track" title={
                      f.noAplica ? 'Esta variable no existe en la Luna: no se compara.'
                        : f.fueraIndice && f.v === 'ati' ? 'La Tierra usa inercia térmica aparente (ATI) y Marte o la Luna unidades SI: no se pueden comparar número a número.'
                        : f.fueraIndice ? 'Esta variable se muestra como contexto, pero no se evalúa en el índice.'
                        : 'No hay dato de esta variable en este sitio: no entra al índice y baja la confianza.'}>
                      <i /> {f.noAplica ? 'NO APLICA' : f.fueraIndice && f.v === 'ati' ? 'SIN DATO COMPARABLE' : f.fueraIndice ? 'NO SE EVALÚA' : 'SIN DATO EN ESTE SITIO'} <i />
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
          <div><small>LÍMITES DEL MODELO</small><strong>Dónde falla la analogía</strong></div>
        </div>
        <Failure icon="gravity" title="Gravedad" text={target === 'mars' ? '0,38 g en Marte' : '0,17 g en la Luna'} />
        <Failure icon="wind" title="Atmósfera" text={target === 'mars' ? 'Presión ~0,6 % de la Tierra' : 'Prácticamente inexistente'} />
        <Failure icon="radiation" title="Radiación" text="Sin protección magnetosférica" />
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
    <div className="img-fallback">Imagen pendiente<br />({src.split('/').pop()} en la carpeta public)</div>
  );
}

function Failure({ icon, title, text }) {
  return (
    <div className="failure">
      <span><Icon name={icon} size={21} /></span>
      <div>
        <strong>{title}</strong><p>{text}</p>
        <em className="na-tag" title="Ningún lugar de la Tierra lo reproduce: no se puntúa.">No aplica</em>
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
  if (punto.estado === 'cargando') { titulo = 'Consultando…'; kind = 'pending'; }
  else if (punto.estado === 'error') { titulo = 'Sin dato'; kind = 'pending'; nota = 'No se pudo leer global_clases.bin.'; }
  else if (CLASES_BIN[punto.codigo]) {
    titulo = CLASES_BIN[punto.codigo]; kind = KIND_BIN[punto.codigo];
    nota = punto.codigo === 3 ? 'Pasa el filtro, pero está fuera de lo que el modelo conoce de Marte y de la Luna.'
      : punto.codigo === 4 ? 'Pasa el filtro, pero no se parece ni a Marte ni a la Luna.'
      : `Su pendiente y su albedo se parecen más a ${titulo === 'Marte' ? 'Marte' : 'la Luna'} que a lo demás.`;
  } else { titulo = 'No pasa el filtro'; kind = 'unevaluated'; nota = 'Zona húmeda, con vegetación, océano o sin dato.'; }
  return (
    <div className="punto-card">
      <button className="punto-close" onClick={onClose} aria-label="Cerrar">×</button>
      <small>PUNTO ELEGIDO · {fmtCoord(punto.lat, punto.lon)}</small>
      <strong style={{ color: COLOR[kind] }}>El modelo dice: {titulo}</strong>
      {nota && <p>{nota}</p>}
      <p className="punto-escala">Resultado ya calculado para la celda{punto.km ? ` de ~${punto.km} km` : ''} que contiene el punto. No es un estudio del sitio.</p>
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
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
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
  const nombreIndice = (s) => (s.kind === 'pending' ? 'Pendiente' : s.kind === 'unevaluated' ? 'No evaluado' : PILL_TXT[s.kind]);
  const nombreModelo = (s) => (s.gmm ? s.gmm.clase_final : 'Cargando…');
  const base = (t) => (t.startsWith('Ninguna') || t === 'No coincide' || t === 'No evaluado' ? 'Ninguna' : t);

  return (
    <section className="model-section">
      <div className="glass-card model-card">
        <small>MODELO ENTRENADO · GMM</small>
        <div className="model-class" style={{ color, borderColor: color }}>{sinDato ? 'SIN DATO' : clase}</div>
        {clase.startsWith('Ninguna (fuera de rango)') && (
          <p className="model-note">Sus condiciones están fuera de lo que el modelo conoce de Marte y de la Luna.</p>
        )}
        {clase.startsWith('Ninguna (filtro') && (
          <p className="model-note">No se evalúa: superficie húmeda o con vegetación.</p>
        )}
        {sinDato && <p className="model-note">Faltan pendiente o albedo para este sitio.</p>}
        {!sinDato && r?.p_marte !== undefined && (
          <>
            <h4>Parecido relativo</h4>
            {barras.map((b) => (
              <div className="model-bar" key={b.n}>
                <span>{b.n}</span>
                <i><b style={{ width: `${Math.round(b.v * 100)}%`, background: b.c }} /></i>
                <em>{Math.round(b.v * 100)}%</em>
              </div>
            ))}
            <p className="model-note">Compara las tres clases entre sí; no es la probabilidad de "ser Marte".</p>
          </>
        )}
      </div>

      <div className="glass-card model-table">
        <small>ÍNDICE FRENTE A MODELO</small>
        <table>
          <thead><tr><th>Sitio</th><th>Índice</th><th>Modelo</th><th /></tr></thead>
          <tbody>
            {sitios.map((s) => {
              const a = nombreIndice(s), b = nombreModelo(s);
              const comparable = !['Pendiente', 'No evaluado'].includes(a) && !['SIN DATO', 'Cargando…'].includes(b);
              const igual = comparable && base(a) === base(b);
              return (
                <tr key={s.zona} className={s.zona === sel.zona ? 'sel' : ''}>
                  <td>{s.nombre}</td>
                  <td style={{ color: COLOR[s.kind] }}>{a}</td>
                  <td style={{ color: COLOR[kindGMM(s.gmm?.clase_final)] }}>{b}</td>
                  <td className={comparable ? (igual ? 'ok' : 'dif') : ''}>{comparable ? (igual ? 'Coinciden' : 'Difieren') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
