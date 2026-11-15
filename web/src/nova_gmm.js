// nova_gmm.js — Nova Analog: el mismo modelo (nova_gmm.json) en el navegador, sin servidor.
// Uso en React:
//   import { cargarModelo, clasificar } from "./nova_gmm.js";
//   const modelo = await cargarModelo(import.meta.env.BASE_URL + "nova_gmm.json");
//   clasificar(modelo, { pendiente_deg: 3.0, albedo: 0.22 })
//   -> { p_marte, p_luna, p_ninguna, clase_bayes, en_rango_marte, en_rango_luna, clase_final }
// Datos: pendiente_deg (grados, ~90 m promediada a 1 km) y albedo (0-1). Opcionales para el filtro:
//   ndvi, aridez_P_PET, precip_anual_mm, ciclos_hielo_frac.

export async function cargarModelo(url) {
  const m = await (await fetch(url)).json();
  m._comp = m.gmm.map((g) => g.covarianzas.map((C, k) => {
    const det = C[0][0] * C[1][1] - C[0][1] * C[1][0];
    const inv = [[C[1][1] / det, -C[0][1] / det], [-C[1][0] / det, C[0][0] / det]];
    return { logw: Math.log(g.pesos[k]), mu: g.medias[k], inv, logdet: Math.log(det) };
  }));
  return m;
}

function loglik(comps, z) {
  const lp = comps.map(({ logw, mu, inv, logdet }) => {
    const d0 = z[0] - mu[0], d1 = z[1] - mu[1];
    const maha = d0 * (inv[0][0] * d0 + inv[0][1] * d1) + d1 * (inv[1][0] * d0 + inv[1][1] * d1);
    return logw - 0.5 * (maha + logdet + 2 * Math.log(2 * Math.PI));
  });
  const mx = Math.max(...lp);
  return mx + Math.log(lp.reduce((s, v) => s + Math.exp(v - mx), 0));
}

function noPasaFiltro({ ndvi, aridez_P_PET, precip_anual_mm, ciclos_hielo_frac }) {
  const def = (v) => v !== undefined && v !== null && !Number.isNaN(v);
  if (!def(ndvi) && !def(aridez_P_PET) && !def(precip_anual_mm)) return false;
  const veg = def(ndvi) && !(ndvi >= -0.05 && ndvi < 0.25);
  const seco = (def(aridez_P_PET) && aridez_P_PET < 0.5) || (def(precip_anual_mm) && precip_anual_mm < 250);
  const peri = def(ciclos_hielo_frac) && ciclos_hielo_frac >= 0.5;
  const humedo = (def(aridez_P_PET) || def(precip_anual_mm)) && !(seco || peri);
  return veg || humedo;
}

export function clasificar(m, punto) {
  const { pendiente_deg: p, albedo: a } = punto;
  if (p == null || a == null || !(p >= 0) || !(a > 0 && a < 1)) return { clase_final: "SIN DATO" };
  if (noPasaFiltro(punto)) return { clase_final: "Ninguna (filtro: húmedo o con vegetación)" };
  const z = [(Math.log1p(p) - m.escalado.media[0]) / m.escalado.desv[0],
             (a - m.escalado.media[1]) / m.escalado.desv[1]];
  const L = m._comp.map((c) => loglik(c, z));
  const mx = Math.max(...L), e = L.map((v) => Math.exp(v - mx)), s = e.reduce((x, y) => x + y, 0);
  const P = e.map((v) => v / s);
  const clase_bayes = m.clases[P.indexOf(Math.max(...P))];
  const en_rango_marte = L[0] >= m.umbral_rechazo_loglik.Marte;
  const en_rango_luna = L[1] >= m.umbral_rechazo_loglik.Luna;
  let clase_final = clase_bayes;
  if (!en_rango_marte && !en_rango_luna) clase_final = "Ninguna (fuera de rango)";
  else if (clase_bayes === "Marte" && !en_rango_marte && en_rango_luna) clase_final = "Luna";
  else if (clase_bayes === "Luna" && !en_rango_luna && en_rango_marte) clase_final = "Marte";
  return { p_marte: P[0], p_luna: P[1], p_ninguna: P[2], clase_bayes, en_rango_marte, en_rango_luna, clase_final };
}
