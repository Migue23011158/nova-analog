/**
 * @file App.jsx
 * @description Aplicación web principal de Nova Analog (NASA Space Apps Challenge).
 * Visualiza y evalúa análogos terrestres frente a referencias planetarias (Marte y Luna)
 * consumiendo dinámicamente los datos desde `public/sitios.json`.
 */

import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import './App.css';

/**
 * Metadatos fijos de presentación para las claves de referencia definidas en `sitios.json`.
 * @type {Record<string, { etiqueta: string, cuerpo: string }>}
 */
const REFS_META = {
  arcadia: { etiqueta: "Arcadia Planitia (Marte)", cuerpo: "Marte" },
  shackleton_borde: { etiqueta: "Borde de Shackleton (Luna)", cuerpo: "Luna" },
};

/**
 * Etiquetas legibles en español para los propósitos de misión (`pesos`).
 * @type {Record<string, string>}
 */
const ETIQUETAS_PROP = {
  movilidad: "Movilidad de róveres",
  construccion: "Construcción con regolito",
};

/**
 * Etiquetas legibles en español para las variables ambientales (`variables`).
 * @type {Record<string, string>}
 */
const ETIQUETAS_VAR = {
  pendiente_deg: "Pendiente",
  ati: "Inercia térmica",
  albedo: "Albedo",
  ciclos_hielo_frac: "Ciclos de congelamiento",
};

/**
 * Configuración visual de los chips según el tipo de sitio (`sitio.tipo`).
 * @type {Record<string, { label: string, color: string }>}
 */
const ETIQUETAS_TIPO = {
  nuevo: { label: "Candidato nuevo", color: "#22c55e" },
  control: { label: "Control", color: "#8DAED0" },
  conocido: { label: "Análogo conocido", color: "#9ca3af" },
  verificar: { label: "Por verificar", color: "#eab308" },
};

/**
 * Paleta de colores asignada a cada clase planetaria resultante.
 * @type {Record<string, string>}
 */
const COLORES_CLASE = {
  Marte: "#c1440e",
  Luna: "#8DAED0",
  "No coincide": "#6b7280",
};

/**
 * Componente auxiliar de Leaflet para centrar animadamente el mapa
 * cuando el usuario selecciona un sitio desde el ranking Top 5.
 * @param {{ centroObjetivo: { coords: [number, number], ts: number } | null }} props
 */
function ControlMapa({ centroObjetivo }) {
  const map = useMap();

  useEffect(() => {
    if (centroObjetivo) {
      map.flyTo(centroObjetivo.coords, 8);
    }
  }, [centroObjetivo, map]);

  return null;
}

/**
 * Control flotante sobre el mapa que solicita la geolocalización del navegador,
 * centra el mapa en las coordenadas del usuario y dibuja un CircleMarker azul.
 */
function BotonUbicacion() {
  const map = useMap();
  const [miPos, setMiPos] = useState(null);

  const localizar = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.latitude, pos.coords.longitude];
        setMiPos(coords);
        map.flyTo(coords, 10);
      },
      () => alert("No se pudo obtener tu ubicación.")
    );
  };

  return (
    <>
      <button
        onClick={localizar}
        style={{
          position: 'absolute', top: 15, right: 15, zIndex: 1000,
          padding: '10px 14px', background: '#0b3d91', color: '#fff',
          border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
        }}
      >
        📍 Mi ubicación
      </button>
      {miPos && (
        <CircleMarker
          center={miPos}
          radius={9}
          pathOptions={{ color: '#3b82f6', fillColor: '#2563eb', fillOpacity: 0.9 }}
        />
      )}
    </>
  );
}

/**
 * Componente principal de Nova Analog.
 * Gestiona la carga de datos desde `public/sitios.json`, el estado de filtros,
 * los pesos interactivos, el cálculo en vivo del índice de similitud, la clasificación
 * planetaria, el Top 5, la ficha técnica detallada y la tabla comparativa.
 */
export default function App() {
  const [datosJson, setDatosJson] = useState(null);
  const [referencia, setReferencia] = useState('');
  const [proposito, setProposito] = useState('');
  const [pesos, setPesos] = useState({});
  const [seleccionadoZona, setSeleccionadoZona] = useState(null);
  const [centroObjetivo, setCentroObjetivo] = useState(null);
  const [comparados, setComparados] = useState([]);

  // 1. Carga inicial de sitios.json usando BASE_URL para soportar subrutas (ej. GitHub Pages)
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'sitios.json')
      .then((res) => res.json())
      .then((data) => {
        setDatosJson(data);
        const refs = Array.isArray(data.referencias)
          ? data.referencias
          : Object.keys(data.referencias || {});
        const props = Object.keys(data.pesos || {});

        if (refs.length > 0) setReferencia(refs.includes('arcadia') ? 'arcadia' : refs[0]);
        if (props.length > 0) {
          const propInicial = props[0];
          setProposito(propInicial);
          setPesos({ ...data.pesos[propInicial] });
        }
      })
      .catch((err) => console.error('Error cargando sitios.json:', err));
  }, []);

  // Listas derivadas directamente de sitios.json sin hardcodear valores
  const opcionesReferencia = useMemo(() => {
    if (!datosJson) return [];
    return Array.isArray(datosJson.referencias)
      ? datosJson.referencias
      : Object.keys(datosJson.referencias || {});
  }, [datosJson]);

  const opcionesProposito = useMemo(
    () => (datosJson ? Object.keys(datosJson.pesos || {}) : []),
    [datosJson]
  );

  const variables = useMemo(
    () => (datosJson ? datosJson.variables || [] : []),
    [datosJson]
  );

  const sitios = useMemo(
    () => (datosJson ? datosJson.sitios || [] : []),
    [datosJson]
  );

  const umbralClase = datosJson?.umbral_clase ?? 60;
  const modeloPresentable = Boolean(datosJson?.modelo_presentable);

  /**
   * Cambia el propósito de misión y carga sus pesos predeterminados desde `sitios.json`.
   * @param {string} nuevoProposito Clave del propósito (`movilidad` | `construccion`).
   */
  const cambiarProposito = (nuevoProposito) => {
    setProposito(nuevoProposito);
    if (datosJson?.pesos?.[nuevoProposito]) {
      setPesos({ ...datosJson.pesos[nuevoProposito] });
    }
  };

  /**
   * Restaura los pesos de los deslizadores a los valores originales del propósito activo.
   */
  const restablecerPesos = () => {
    if (datosJson?.pesos?.[proposito]) {
      setPesos({ ...datosJson.pesos[proposito] });
    }
  };

  /**
   * Calcula el índice de similitud ponderado (0–100) para un objeto de desglose.
   * Fórmula: 100 * Σ(peso_i * similitud_i) / Σ(peso_i), excluyendo variables null o ausentes.
   * @param {Record<string, number | null> | undefined} desgloseObj
   * @returns {number | null}
   */
  const calcularIndice = (desgloseObj) => {
    if (!desgloseObj) return null;
    let sumaPonderada = 0;
    let sumaPesos = 0;

    for (const vKey of variables) {
      const valor = desgloseObj[vKey];
      if (valor === null || valor === undefined) continue;
      const peso = pesos[vKey] ?? 0;
      sumaPonderada += valor * peso;
      sumaPesos += peso;
    }

    return sumaPesos > 0 ? (100 * sumaPonderada) / sumaPesos : null;
  };

  /**
   * Determina la clase planetaria en vivo comparando el índice contra todas las referencias.
   * - Retorna `null` si el sitio no está procesado (`procesado === false`) o fue descartado (`filtrado === true`).
   * - Asigna el cuerpo de la referencia con mayor índice si alcanza `umbral_clase`; de lo contrario, `"No coincide"`.
   * @param {object} sitio
   * @returns {string | null}
   */
  const clasificarSitio = (sitio) => {
    if (!sitio || sitio.procesado === false || sitio.filtrado === true) return null;

    let mejorRef = null;
    let mejorScore = -1;

    for (const refKey of opcionesReferencia) {
      const des = sitio.desglose?.[`${refKey}|${proposito}`];
      const score = calcularIndice(des);
      if (score !== null && score > mejorScore) {
        mejorScore = score;
        mejorRef = refKey;
      }
    }

    if (mejorRef && mejorScore >= umbralClase) {
      return REFS_META[mejorRef]?.cuerpo || mejorRef;
    }
    return "No coincide";
  };

  /**
   * Obtiene el color hexadecimal del marcador en el mapa según estado y clasificación.
   * @param {object} sitio
   * @returns {string}
   */
  const obtenerColorSitio = (sitio) => {
    if (sitio.procesado === false) return "#d1d5db"; // Gris claro para sitios pendientes
    const claseActual = clasificarSitio(sitio);
    if (!claseActual) return COLORES_CLASE["No coincide"];
    return COLORES_CLASE[claseActual] || COLORES_CLASE["No coincide"];
  };

  // Ranking Top 5 calculado en vivo (excluye pendientes y filtrados)
  const top5 = useMemo(() => {
    return sitios
      .filter((s) => s.procesado !== false && s.filtrado !== true)
      .map((s) => {
        const des = s.desglose?.[`${referencia}|${proposito}`];
        return { sitio: s, score: calcularIndice(des) };
      })
      .filter((item) => item.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [sitios, referencia, proposito, pesos, variables]);

  const seleccionado = useMemo(
    () => sitios.find((s) => s.zona === seleccionadoZona) || null,
    [sitios, seleccionadoZona]
  );

  const sitiosComparados = useMemo(
    () => comparados.map((z) => sitios.find((s) => s.zona === z)).filter(Boolean),
    [comparados, sitios]
  );

  /**
   * Agrega o quita un sitio de la tabla comparativa (límite de 3 sitios simultáneos).
   * @param {object} sitio
   */
  const toggleComparar = (sitio) => {
    if (comparados.includes(sitio.zona)) {
      setComparados(comparados.filter((z) => z !== sitio.zona));
    } else if (comparados.length < 3) {
      setComparados([...comparados, sitio.zona]);
    } else {
      alert("Máximo 3 sitios para comparar lado a lado.");
    }
  };

  /**
   * Selecciona un sitio desde el Top 5 y vuela hacia sus coordenadas en el mapa.
   * @param {object} sitio
   */
  const seleccionarDesdeTop = (sitio) => {
    setSeleccionadoZona(sitio.zona);
    setCentroObjetivo({ coords: [sitio.lat, sitio.lon], ts: Date.now() });
  };

  /**
   * Formatea el tiempo estimado de viaje de minutos a horas con un decimal.
   * @param {number | null | undefined} viajeMin
   * @returns {string}
   */
  const SIN_CARRETERA = ['devon', 'mcmurdo'];
  const formatearViaje = (viajeMin, zona) => {
    const nota = SIN_CARRETERA.includes(zona) ? ' (sin acceso por carretera)' : '';
    if (viajeMin === null || viajeMin === undefined) return `SIN DATO${nota}`;
    const texto = viajeMin > 2880
      ? `${(viajeMin / 1440).toFixed(1)} días`
      : `${(viajeMin / 60).toFixed(1)} h`;
    return texto + nota;
  };

  /**
   * Renderiza la ficha técnica del sitio seleccionado contemplando tres estados:
   * 1. Pendiente de procesar (`procesado === false`).
   * 2. Descartado por filtro ambiental (`filtrado === true`).
   * 3. Evaluado completo (índice, clase, modelo opcional, confianza, viaje y barras).
   */
  const renderFicha = () => {
    if (!seleccionado) {
      return (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>
          Toca un punto en el mapa o en el Top 5 para ver su ficha técnica.
        </p>
      );
    }

    const tipoInfo = ETIQUETAS_TIPO[seleccionado.tipo] || { label: seleccionado.tipo, color: '#9ca3af' };

    // Estado 1: Sitio aún no procesado por el pipeline científico
    if (seleccionado.procesado === false) {
      return (
        <div style={{ background: '#1f2937', padding: 14, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{seleccionado.nombre}</h3>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 999,
              border: `1px solid ${tipoInfo.color}`, color: tipoInfo.color, whiteSpace: 'nowrap'
            }}>
              {tipoInfo.label}
            </span>
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: 6, background: '#111827',
            color: '#d1d5db', fontWeight: 'bold', marginBottom: 8
          }}>
            Pendiente de procesar
          </div>
          <p style={{ margin: '4px 0', fontSize: 13 }}>
            <strong>Viaje:</strong> {formatearViaje(seleccionado.viaje_min, seleccionado.zona)}
          </p>
        </div>
      );
    }

    // Estado 2: Sitio descartado por filtro previo (superficie húmeda con vegetación)
    if (seleccionado.filtrado === true) {
      return (
        <div style={{ background: '#1f2937', padding: 14, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{seleccionado.nombre}</h3>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 999,
              border: `1px solid ${tipoInfo.color}`, color: tipoInfo.color, whiteSpace: 'nowrap'
            }}>
              {tipoInfo.label}
            </span>
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: 6, background: '#111827',
            color: '#eab308', fontWeight: 'bold', marginBottom: 8
          }}>
            No evaluado: superficie húmeda
          </div>
          <p style={{ margin: '4px 0', fontSize: 13 }}>
            <strong>Viaje:</strong> {formatearViaje(seleccionado.viaje_min, seleccionado.zona)}
          </p>
        </div>
      );
    }

    // Estado 3: Sitio procesado y apto para evaluación
    const keyRefProp = `${referencia}|${proposito}`;
    const des = seleccionado.desglose?.[keyRefProp] || {};
    const score = calcularIndice(des);
    const clase = clasificarSitio(seleccionado);
    const colorClase = COLORES_CLASE[clase] || COLORES_CLASE["No coincide"];
    const conf = seleccionado.confianza?.[keyRefProp];
    const enComparador = comparados.includes(seleccionado.zona);
    const colorRef = REFS_META[referencia]?.cuerpo === 'Luna' ? COLORES_CLASE.Luna : COLORES_CLASE.Marte;
    const indicesPorRef = opcionesReferencia.map((rk) => ({
      cuerpo: REFS_META[rk]?.cuerpo || rk,
      valor: calcularIndice(seleccionado.desglose?.[`${rk}|${proposito}`]),
    }));

    return (
      <div style={{ background: '#1f2937', padding: 14, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{seleccionado.nombre}</h3>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 999,
            border: `1px solid ${tipoInfo.color}`, color: tipoInfo.color, whiteSpace: 'nowrap'
          }}>
            {tipoInfo.label}
          </span>
        </div>

        {/* Puntuación global y etiqueta de clase planetaria */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '8px 0' }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 'bold', color: colorRef, lineHeight: 1 }}>
              {score !== null ? score.toFixed(1) : '—'} <span style={{ fontSize: 14, color: '#9ca3af' }}>/ 100</span>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              vs. {REFS_META[referencia]?.etiqueta || referencia}
            </div>
          </div>
          <div style={{
            fontSize: 18, fontWeight: 'bold', padding: '4px 10px', borderRadius: 6,
            border: `2px solid ${colorClase}`, color: colorClase
          }}>
            {clase}
          </div>
        </div>
        <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#9ca3af', textAlign: 'right' }}>
          {indicesPorRef.map((r, i) => (
            <span key={r.cuerpo}>
              {i > 0 && ' · '}
              <span style={{ color: COLORES_CLASE[r.cuerpo] || '#9ca3af', fontWeight: 'bold' }}>{r.cuerpo}</span>{' '}
              {r.valor !== null ? r.valor.toFixed(1) : 'SIN DATO'}
            </span>
          ))}
          {' '}· clase si ≥ {umbralClase}
        </p>

        {/* Bloque condicional del modelo de clasificación ML */}
        {modeloPresentable && seleccionado.modelo && (
          <div style={{ background: '#111827', padding: 10, borderRadius: 6, marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 6, color: '#e5e7eb' }}>
              Modelo: {seleccionado.modelo.clase}
            </div>
            {[
              { label: 'p(Tierra)', val: seleccionado.modelo.p_tierra, color: '#9ca3af' },
              { label: 'p(Marte)', val: seleccionado.modelo.p_marte, color: '#c1440e' },
              { label: 'p(Luna)', val: seleccionado.modelo.p_luna, color: '#8DAED0' },
            ].map((m) => {
              const pct = Math.round((m.val ?? 0) * 100);
              return (
                <div key={m.label} style={{ marginBottom: 5, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>{m.label}</span>
                    <span>{pct}%</span>
                  </div>
                  <div style={{ width: '100%', height: 5, background: '#1f2937', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: m.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Confianza de datos y alerta cuando es inferior al 50% */}
        <p style={{ margin: '4px 0', fontSize: 13 }}>
          <strong>Confianza:</strong>{' '}
          {conf !== null && conf !== undefined ? `${Math.round(conf * 100)}%` : 'SIN DATO'}
        </p>
        {conf !== null && conf !== undefined && conf < 0.5 && (
          <p style={{ margin: '4px 0', fontSize: 12, color: '#eab308', background: '#111827', padding: '6px 8px', borderRadius: 4 }}>
            ⚠️ Pocos datos: el índice se basa en menos variables
          </p>
        )}
        <p style={{ margin: '4px 0 10px 0', fontSize: 13 }}>
          <strong>Viaje:</strong> {formatearViaje(seleccionado.viaje_min, seleccionado.zona)}
        </p>

        <hr style={{ borderColor: '#374151' }} />

        {/* Desglose individual por variable ambiental */}
        <div style={{ marginTop: 10 }}>
          {variables.map((vKey) => {
            const raw = des[vKey];
            const tieneDato = raw !== null && raw !== undefined;
            const esCiclosEnLuna = vKey === 'ciclos_hielo_frac' && referencia === 'shackleton_borde';
            const pct = tieneDato ? Math.round(raw * 100) : 0;

            return (
              <div key={vKey} style={{ marginBottom: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>{ETIQUETAS_VAR[vKey] || vKey}</span>
                  <span style={{ color: !tieneDato ? '#eab308' : '#f3f4f6' }}>
                    {tieneDato ? `${pct}%` : esCiclosEnLuna ? 'no aplica a la Luna' : 'SIN DATO'}
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#111827', borderRadius: 3, overflow: 'hidden' }}>
                  {tieneDato && (
                    <div style={{ width: `${pct}%`, height: '100%', background: '#60a5fa' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => toggleComparar(seleccionado)}
          style={{ width: '100%', marginTop: 8, padding: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          {enComparador ? 'Quitar de comparación' : `+ Comparar (${comparados.length}/3)`}
        </button>
      </div>
    );
  };

  return (
    <div className="app-layout">
      {/* PANEL IZQUIERDO / SUPERIOR EN MÓVIL: Mapa interactivo sin repetición horizontal */}
      <div className="mapa-panel">
        <MapContainer
          center={[15.0, -20.0]}
          zoom={2}
          minZoom={2}
          maxBounds={[[-90, -180], [90, 180]]}
          maxBoundsViscosity={1}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            noWrap={true}
          />
          <ControlMapa centroObjetivo={centroObjetivo} />
          <BotonUbicacion />
          {sitios.map((sitio) => {
            const color = obtenerColorSitio(sitio);
            return (
              <CircleMarker
                key={sitio.zona}
                center={[sitio.lat, sitio.lon]}
                radius={9}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  dashArray: sitio.filtrado === true ? '4 4' : undefined,
                }}
                eventHandlers={{ click: () => setSeleccionadoZona(sitio.zona) }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* PANEL DERECHO / INFERIOR EN MÓVIL: Controles, Top 5, Ficha Técnica y Comparador */}
      <div className="control-panel">
        <h2 style={{ marginTop: 0, color: '#60a5fa' }}>🚀 Nova Analog</h2>

        {/* Selectores dinámicos de referencia planetaria y propósito */}
        <div style={{ background: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Referencia planetaria</label>
            <select
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, background: '#111827', color: '#f3f4f6', border: '1px solid #374151' }}
            >
              {opcionesReferencia.map((refKey) => (
                <option key={refKey} value={refKey}>
                  {REFS_META[refKey]?.etiqueta || refKey}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Propósito de misión</label>
            <select
              value={proposito}
              onChange={(e) => cambiarProposito(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, background: '#111827', color: '#f3f4f6', border: '1px solid #374151' }}
            >
              {opcionesProposito.map((propKey) => (
                <option key={propKey} value={propKey}>
                  {ETIQUETAS_PROP[propKey] || propKey}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deslizadores interactivos de ponderación por variable */}
        <div style={{ background: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Pesos por Variable</h4>
            <button
              onClick={restablecerPesos}
              style={{ padding: '4px 8px', fontSize: 11, background: '#374151', color: '#f3f4f6', border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              Restablecer
            </button>
          </div>
          {variables.map((vKey) => (
            <div key={vKey} style={{ marginBottom: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{ETIQUETAS_VAR[vKey] || vKey}</span>
                <span>{Math.round((pesos[vKey] ?? 0) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={pesos[vKey] ?? 0}
                onChange={(e) => setPesos({ ...pesos, [vKey]: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        {/* Ranking Top 5 de candidatos evaluados */}
        <div style={{ background: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Top 5 Candidatos</h4>
          {top5.map(({ sitio, score }, i) => {
            const clase = clasificarSitio(sitio);
            const color = COLORES_CLASE[clase] || '#60a5fa';
            return (
              <div
                key={sitio.zona}
                onClick={() => seleccionarDesdeTop(sitio)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 8px', marginBottom: 4, borderRadius: 4, cursor: 'pointer',
                  background: '#111827', fontSize: 13
                }}
              >
                <span>{i + 1}. {sitio.nombre}</span>
                <strong style={{ color }}>{score.toFixed(1)}</strong>
              </div>
            );
          })}
        </div>

        {/* Ficha técnica del sitio seleccionado */}
        {renderFicha()}

        {/* Tabla comparativa lado a lado (máximo 3 sitios) */}
        {sitiosComparados.length > 0 && (
          <div style={{ background: '#1f2937', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Comparador ({sitiosComparados.length}/3)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid #374151' }}>Variable</th>
                    {sitiosComparados.map((s) => (
                      <th key={s.zona} style={{ textAlign: 'center', padding: 4, borderBottom: '1px solid #374151' }}>
                        {s.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 4 }}>Índice</td>
                    {sitiosComparados.map((s) => {
                      const sc = calcularIndice(s.desglose?.[`${referencia}|${proposito}`]);
                      return (
                        <td key={s.zona} style={{ textAlign: 'center', padding: 4, fontWeight: 'bold' }}>
                          {sc !== null ? sc.toFixed(1) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ padding: 4 }}>Clase</td>
                    {sitiosComparados.map((s) => {
                      const cl = clasificarSitio(s);
                      const col = COLORES_CLASE[cl] || '#9ca3af';
                      return (
                        <td key={s.zona} style={{ textAlign: 'center', padding: 4, fontWeight: 'bold', color: col }}>
                          {cl || '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td style={{ padding: 4 }}>Viaje</td>
                    {sitiosComparados.map((s) => (
                      <td key={s.zona} style={{ textAlign: 'center', padding: 4 }}>
                        {formatearViaje(s.viaje_min, s.zona)}
                      </td>
                    ))}
                  </tr>
                  {variables.map((vKey) => (
                    <tr key={vKey}>
                      <td style={{ padding: 4 }}>{ETIQUETAS_VAR[vKey] || vKey}</td>
                      {sitiosComparados.map((s) => {
                        const val = s.desglose?.[`${referencia}|${proposito}`]?.[vKey];
                        const esCiclosEnLuna = vKey === 'ciclos_hielo_frac' && referencia === 'shackleton_borde';
                        return (
                          <td key={s.zona} style={{ textAlign: 'center', padding: 4 }}>
                            {val !== null && val !== undefined
                              ? `${Math.round(val * 100)}%`
                              : esCiclosEnLuna
                              ? 'no aplica'
                              : 'SIN DATO'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: 4 }}></td>
                    {sitiosComparados.map((s) => (
                      <td key={s.zona} style={{ textAlign: 'center', padding: 4 }}>
                        <button
                          onClick={() => toggleComparar(s)}
                          style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          Quitar
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pie de página: créditos, fuentes y declaración de uso de IA */}
        <footer style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #374151', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
          Desarrollado con ayuda de IA (Claude y Gemini) · NASA Space Apps Challenge 2026 · Datos: NASA, ESA, USGS
        </footer>
      </div>
    </div>
  );
}