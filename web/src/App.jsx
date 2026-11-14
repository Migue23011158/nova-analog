import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';

const NOMBRES = {
  cocuy: "Sierra Nevada del Cocuy (Colombia)",
  bayuda: "Campo volcánico de Bayuda (Sudán)",
  khaybar: "Harrat Khaybar (Arabia Saudita)",
  undara: "Tubos de lava de Undara (Australia)",
  atacama: "Desierto de Atacama (Chile)",
  devon: "Cráter Haughton (Canadá)",
  svalbard: "Svalbard, Bockfjorden (Noruega)",
  mcmurdo: "Valles Secos de McMurdo (Antártida)",
  mojave: "Death Valley (EE. UU.)",
};

const ETIQUETAS = {
  shackleton: "Shackleton (Luna)",
  arcadia: "Arcadia Planitia (Marte)",
  movilidad: "Movilidad de róveres",
  construccion: "Construcción con regolito",
};

const PESOS_INICIALES = {
  movilidad: { pendiente_deg: 0.30, rugosidad_m: 0.15, amplitud_K: 0.15, ati: 0.25, aridez_P_PET: 0.15 },
  construccion: { pendiente_deg: 0.15, rugosidad_m: 0.10, amplitud_K: 0.15, ati: 0.30, aridez_P_PET: 0.30 },
};

const VARIABLES = [
  { key: 'pendiente_deg', label: 'Pendiente (°)' },
  { key: 'rugosidad_m', label: 'Rugosidad (m)' },
  { key: 'amplitud_K', label: 'Amplitud Térmica (K)' },
  { key: 'ati', label: 'Inercia Térmica (ATI)' },
  { key: 'aridez_P_PET', label: 'Aridez (P/PET)' }
];

const nombreZona = (clave) => NOMBRES[clave] || clave;
const etiquetaValor = (clave) => ETIQUETAS[clave] || clave;

function ControlMapa({ centroObjetivo }) {
  const map = useMap();

  useEffect(() => {
    if (centroObjetivo) {
      map.flyTo(centroObjetivo.coords, 8);
    }
  }, [centroObjetivo, map]);

  return null;
}

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

export default function App() {
  const [features, setFeatures] = useState([]);
  const [referenciaFiltro, setReferenciaFiltro] = useState('');
  const [propositoFiltro, setPropositoFiltro] = useState('');
  const [seleccionado, setSeleccionado] = useState(null);
  const [centroObjetivo, setCentroObjetivo] = useState(null);
  const [comparados, setComparados] = useState([]);
  const [pesos, setPesos] = useState(PESOS_INICIALES.movilidad);

  useEffect(() => {
    fetch('/candidatos.geojson')
      .then((res) => res.json())
      .then((data) => {
        const lista = data.features || [];
        setFeatures(lista);
        const refs = [...new Set(lista.map(f => f.properties.referencia).filter(Boolean))];
        const props = [...new Set(lista.map(f => f.properties.proposito).filter(Boolean))];
        if (refs.length > 0) setReferenciaFiltro(refs[0]);
        if (props.length > 0) {
          const propInicial = props[0];
          setPropositoFiltro(propInicial);
          if (PESOS_INICIALES[propInicial]) setPesos(PESOS_INICIALES[propInicial]);
        }
      })
      .catch((err) => console.error('Error cargando candidatos.geojson:', err));
  }, []);

  const opcionesReferencia = useMemo(
    () => [...new Set(features.map(f => f.properties.referencia).filter(Boolean))],
    [features]
  );

  const opcionesProposito = useMemo(
    () => [...new Set(features.map(f => f.properties.proposito).filter(Boolean))],
    [features]
  );

  const cambiarProposito = (nuevoProposito) => {
    setPropositoFiltro(nuevoProposito);
    if (PESOS_INICIALES[nuevoProposito]) {
      setPesos(PESOS_INICIALES[nuevoProposito]);
    }
    setSeleccionado(null);
  };

  const restablecerPesos = () => {
    setPesos(PESOS_INICIALES[propositoFiltro] || PESOS_INICIALES.movilidad);
  };

  const calcularScore = (props) => {
    let suma = 0;
    let totalPeso = 0;
    VARIABLES.forEach((v) => {
      const val = props[`sim_${v.key}`];
      if (val !== null && val !== undefined) {
        suma += val * pesos[v.key];
        totalPeso += pesos[v.key];
      }
    });
    if (totalPeso === 0) return 0;
    return Number(((100 * suma) / totalPeso).toFixed(1));
  };

  const colorPunto = (score) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  const puntosVisibles = useMemo(() => {
    return features.filter(
      (f) =>
        (!referenciaFiltro || f.properties.referencia === referenciaFiltro) &&
        (!propositoFiltro || f.properties.proposito === propositoFiltro)
    );
  }, [features, referenciaFiltro, propositoFiltro]);

  const top5 = useMemo(() => {
    return [...puntosVisibles]
      .map((f) => ({ feature: f, score: calcularScore(f.properties) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [puntosVisibles, pesos]);

  const toggleComparar = (feature) => {
    const id = `${feature.properties.zona}_${feature.properties.referencia}_${feature.properties.proposito}_${feature.geometry.coordinates.join(',')}`;
    const existe = comparados.find(c => c.id === id);
    if (existe) {
      setComparados(comparados.filter(c => c.id !== id));
    } else if (comparados.length < 3) {
      setComparados([...comparados, { id, ...feature }]);
    } else {
      alert("Máximo 3 sitios para comparar lado a lado.");
    }
  };

  const seleccionarDesdeTop = (f) => {
    const [lon, lat] = f.geometry.coordinates;
    setSeleccionado(f);
    setCentroObjetivo({ coords: [lat, lon], ts: Date.now() });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', margin: 0, fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[15.0, -20.0]} zoom={2} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
          />
          <ControlMapa centroObjetivo={centroObjetivo} />
          <BotonUbicacion />
          {puntosVisibles.map((f, idx) => {
            const [lon, lat] = f.geometry.coordinates;
            const score = calcularScore(f.properties);
            const color = colorPunto(score);
            return (
              <CircleMarker
                key={`${f.properties.zona}_${idx}`}
                center={[lat, lon]}
                radius={9}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.85 }}
                eventHandlers={{ click: () => setSeleccionado(f) }}
              />
            );
          })}
        </MapContainer>
      </div>

      <div style={{ width: 400, background: '#111827', color: '#f3f4f6', padding: 20, overflowY: 'auto', borderLeft: '1px solid #374151' }}>
        <h2 style={{ marginTop: 0, color: '#60a5fa' }}>🚀 Nova Analog</h2>

        {/* FILTROS DINÁMICOS */}
        <div style={{ background: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Referencia planetaria</label>
            <select
              value={referenciaFiltro}
              onChange={(e) => { setReferenciaFiltro(e.target.value); setSeleccionado(null); }}
              style={{ width: '100%', padding: 8, borderRadius: 4, background: '#111827', color: '#f3f4f6', border: '1px solid #374151' }}
            >
              {opcionesReferencia.map((ref) => (
                <option key={ref} value={ref}>{etiquetaValor(ref)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Propósito de misión</label>
            <select
              value={propositoFiltro}
              onChange={(e) => cambiarProposito(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, background: '#111827', color: '#f3f4f6', border: '1px solid #374151' }}
            >
              {opcionesProposito.map((prop) => (
                <option key={prop} value={prop}>{etiquetaValor(prop)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* PESOS POR VARIABLE */}
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
          {VARIABLES.map(v => (
            <div key={v.key} style={{ marginBottom: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{v.label}</span>
                <span>{Math.round(pesos[v.key] * 100)}%</span>
              </div>
              <input
                type="range" min="0" max="1" step="0.05"
                value={pesos[v.key]}
                onChange={(e) => setPesos({ ...pesos, [v.key]: parseFloat(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        {/* TOP 5 */}
        <div style={{ background: '#1f2937', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Top 5 Candidatos</h4>
          {top5.map(({ feature, score }, i) => (
            <div
              key={`${feature.properties.zona}_${i}`}
              onClick={() => seleccionarDesdeTop(feature)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 8px', marginBottom: 4, borderRadius: 4, cursor: 'pointer',
                background: '#111827', fontSize: 13
              }}
            >
              <span>{i + 1}. {nombreZona(feature.properties.zona)}</span>
              <strong style={{ color: colorPunto(score) }}>{score.toFixed(1)}</strong>
            </div>
          ))}
        </div>

        {/* FICHA TÉCNICA */}
        {seleccionado ? (
          <div style={{ background: '#1f2937', padding: 14, borderRadius: 8, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 6px 0' }}>{nombreZona(seleccionado.properties.zona)}</h3>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: colorPunto(calcularScore(seleccionado.properties)), marginBottom: 8 }}>
              {calcularScore(seleccionado.properties).toFixed(1)} <span style={{ fontSize: 14, color: '#9ca3af' }}>/ 100</span>
            </div>
            <p style={{ margin: '4px 0', fontSize: 13 }}>
              <strong>Confianza:</strong> {seleccionado.properties.confianza !== null && seleccionado.properties.confianza !== undefined ? `${Math.round(seleccionado.properties.confianza * 100)}%` : 'sin dato'}
            </p>
            <p style={{ margin: '4px 0 10px 0', fontSize: 13 }}>
              <strong>Viaje:</strong> {seleccionado.properties.viaje_min !== null && seleccionado.properties.viaje_min !== undefined ? `${(seleccionado.properties.viaje_min / 60).toFixed(1)} h` : 'sin dato'}
            </p>
            <hr style={{ borderColor: '#374151' }} />
            <div style={{ marginTop: 10 }}>
              {VARIABLES.map(v => {
                const raw = seleccionado.properties[`sim_${v.key}`];
                const tieneDato = raw !== null && raw !== undefined;
                const pct = tieneDato ? Math.round(raw * 100) : 0;
                return (
                  <div key={v.key} style={{ marginBottom: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>{v.label}</span>
                      <span>{tieneDato ? `${pct}%` : 'sin dato'}</span>
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
              + Comparar ({comparados.length}/3)
            </button>
          </div>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Toca un punto en el mapa o en el Top 5 para ver su ficha técnica.</p>
        )}

        {/* COMPARADOR */}
        {comparados.length > 0 && (
          <div style={{ background: '#1f2937', padding: 12, borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Comparador ({comparados.length}/3)</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: 4, borderBottom: '1px solid #374151' }}>Variable</th>
                    {comparados.map(c => (
                      <th key={c.id} style={{ textAlign: 'center', padding: 4, borderBottom: '1px solid #374151' }}>
                        {nombreZona(c.properties.zona)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: 4 }}>Puntuación</td>
                    {comparados.map(c => {
                      const sc = calcularScore(c.properties);
                      return <td key={c.id} style={{ textAlign: 'center', padding: 4, fontWeight: 'bold', color: colorPunto(sc) }}>{sc.toFixed(1)}</td>;
                    })}
                  </tr>
                  <tr>
                    <td style={{ padding: 4 }}>Viaje</td>
                    {comparados.map(c => (
                      <td key={c.id} style={{ textAlign: 'center', padding: 4 }}>
                        {c.properties.viaje_min !== null && c.properties.viaje_min !== undefined ? `${(c.properties.viaje_min / 60).toFixed(1)} h` : 'sin dato'}
                      </td>
                    ))}
                  </tr>
                  {VARIABLES.map(v => (
                    <tr key={v.key}>
                      <td style={{ padding: 4 }}>{v.label}</td>
                      {comparados.map(c => {
                        const val = c.properties[`sim_${v.key}`];
                        return (
                          <td key={c.id} style={{ textAlign: 'center', padding: 4 }}>
                            {val !== null && val !== undefined ? `${Math.round(val * 100)}%` : 'sin dato'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ padding: 4 }}></td>
                    {comparados.map(c => (
                      <td key={c.id} style={{ textAlign: 'center', padding: 4 }}>
                        <button onClick={() => toggleComparar(c)} style={{ fontSize: 11, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>Quitar</button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}