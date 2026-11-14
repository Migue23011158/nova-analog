"""
Nova Analog — Paso 2: puntuación de similitud por celda y validación.

Entrada:  capas_1km/<zona>_1km.tif  (del paso 1)
          referencias.json           (vector de la Luna y Marte; lo llena el sexto físico)
Salida:   resultados/<zona>_<ref>_<proposito>.tif   puntuación 0-100 por celda
          resultados/candidatos.geojson               top N celdas de todas las zonas
          resultados/validacion.csv                   nota de los análogos de control

Método: similitud gaussiana por variable (la de Karen), combinada con pesos
por propósito. Mahalanobis queda como mejora opcional (función al final).

Correr:  python 02_similitud.py
"""
import json, glob, os
import numpy as np
import rioxarray, xarray as xr
import pandas as pd

ENTRADA = "capas_1km"
SALIDA = "resultados"
os.makedirs(SALIDA, exist_ok=True)

# Variables que entran al vector (deben existir en referencias.json)
VARS = ["pendiente_deg", "rugosidad_m", "amplitud_K", "ati", "aridez_P_PET"]

# Pesos por propósito (suman 1). Se ajustan en cinco minutos si el equipo discrepa.
PESOS = {
    "movilidad":    {"pendiente_deg": .30, "rugosidad_m": .15, "amplitud_K": .15, "ati": .25, "aridez_P_PET": .15},
    "construccion": {"pendiente_deg": .15, "rugosidad_m": .10, "amplitud_K": .15, "ati": .30, "aridez_P_PET": .30},
}

# Referencias: media (mu) y tolerancia (sigma) por variable.
# VALORES DE ARRANQUE para que el script corra HOY. El sexto físico los
# reemplaza con lo extraído de LOLA/Diviner (Luna) y MOLA/THEMIS (Marte).
# La aridez planetaria es 0; la tolerancia dice qué tan seco exigimos en la Tierra.
REFERENCIAS_ARRANQUE = {
    "polo_sur_lunar": {
        "pendiente_deg": {"mu": 8.0,  "sigma": 6.0},
        "rugosidad_m":   {"mu": 60.0, "sigma": 40.0},
        "amplitud_K":    {"mu": 40.0, "sigma": 15.0},   # proxy: usamos amplitud terrestre comparable, no la lunar real (300 K)
        "ati":           {"mu": 0.025,"sigma": 0.012},
        "aridez_P_PET":  {"mu": 0.0,  "sigma": 0.08},
    },
    "jezero": {
        "pendiente_deg": {"mu": 4.0,  "sigma": 4.0},
        "rugosidad_m":   {"mu": 30.0, "sigma": 25.0},
        "amplitud_K":    {"mu": 35.0, "sigma": 15.0},
        "ati":           {"mu": 0.020,"sigma": 0.010},
        "aridez_P_PET":  {"mu": 0.0,  "sigma": 0.10},
    },
}


def cargar_referencias():
    if os.path.exists("referencias.json"):
        with open("referencias.json") as f:
            return json.load(f)
    print("AVISO: usando referencias de arranque. Reemplazar con referencias.json")
    return REFERENCIAS_ARRANQUE


def similitud_gaussiana(x, mu, sigma):
    """S_i = exp(-(x-mu)^2 / (2 sigma^2)), entre 0 y 1."""
    return np.exp(-((x - mu) ** 2) / (2 * sigma ** 2))


def puntuar(pila, ref, pesos):
    """Devuelve (puntuacion 0-100, desglose dict, confianza 0-1)."""
    sims, w_usados = [], []
    desglose = {}
    for v in VARS:
        if v not in pesos or v not in ref:
            continue
        x = pila.sel(band=v)
        s = similitud_gaussiana(x, ref[v]["mu"], ref[v]["sigma"])
        desglose[v] = s
        sims.append(s * pesos[v])
        w_usados.append(xr.where(np.isnan(x), 0.0, pesos[v]))
    suma = sum(sims)
    peso_total = sum(w_usados)
    punt = 100 * suma / peso_total.where(peso_total > 0)
    confianza = pila.sel(band="cobertura")
    return punt.astype("float32"), desglose, confianza


def procesar():
    refs = cargar_referencias()
    candidatos = []
    for ruta in sorted(glob.glob(f"{ENTRADA}/*_1km.tif")):
        zona = os.path.basename(ruta).replace("_1km.tif", "")
        pila = rioxarray.open_rasterio(ruta)
        # nombres de banda guardados como descripciones
        nombres = pila.attrs.get("long_name") or pila.rio.descriptions or []
        if len(nombres) == pila.shape[0]:
            pila = pila.assign_coords(band=list(nombres))
        for nombre_ref, ref in refs.items():
            for prop, pesos in PESOS.items():
                punt, desg, conf = puntuar(pila, ref, pesos)
                out = f"{SALIDA}/{zona}_{nombre_ref}_{prop}.tif"
                punt.rio.write_crs(pila.rio.crs).rio.to_raster(out, driver="COG", compress="deflate")
                # top 20 celdas de esta zona
                df = punt.to_dataframe(name="punt").reset_index().dropna()
                df = df.nlargest(20, "punt")
                for _, r in df.iterrows():
                    fila = {"zona": zona, "referencia": nombre_ref, "proposito": prop,
                            "x": float(r.x), "y": float(r.y), "puntuacion": round(float(r.punt), 1),
                            "confianza": round(float(conf.sel(x=r.x, y=r.y)), 2)}
                    for v, s in desg.items():
                        fila[f"sim_{v}"] = round(float(s.sel(x=r.x, y=r.y)), 2)
                    candidatos.append(fila)
                print(f"{zona:14s} {nombre_ref:16s} {prop:13s} max={float(punt.max()):5.1f}")
    guardar_candidatos(candidatos, pila.rio.crs)


def guardar_candidatos(filas, crs):
    import geopandas as gpd
    df = pd.DataFrame(filas)
    gdf = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.x, df.y), crs=crs).to_crs("EPSG:4326")
    gdf["lon"] = gdf.geometry.x.round(4); gdf["lat"] = gdf.geometry.y.round(4)
    gdf.to_file(f"{SALIDA}/candidatos.geojson", driver="GeoJSON")
    print(f"guardado {SALIDA}/candidatos.geojson  ({len(gdf)} puntos)")


def validar():
    """Puntuación en los análogos de control. Si alguno queda bajo 60, revisar sigma o pesos."""
    control = {"atacama_yungay": (-70.0, -24.1), "haughton": (-89.8, 75.4), "death_valley": (-116.9, 36.5)}
    from pyproj import Transformer
    t = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True)
    filas = []
    for ruta in sorted(glob.glob(f"{SALIDA}/*.tif")):
        da = rioxarray.open_rasterio(ruta).squeeze()
        for nombre, (lon, lat) in control.items():
            x, y = t.transform(lon, lat)
            try:
                v = float(da.sel(x=x, y=y, method="nearest", tolerance=1500))
            except KeyError:
                continue
            filas.append({"archivo": os.path.basename(ruta), "control": nombre, "puntuacion": round(v, 1)})
    df = pd.DataFrame(filas)
    df.to_csv(f"{SALIDA}/validacion.csv", index=False)
    print("\nVALIDACIÓN (meta: control >= 60 en su propia zona)")
    print(df.to_string(index=False) if len(df) else "sin coincidencias: ¿las zonas cubren los puntos de control?")


# ---- Mejora opcional: Mahalanobis (solo si la validación pasa y sobra tiempo) --
def mahalanobis(pila, mu_vec, cov):
    inv = np.linalg.inv(cov)
    X = np.stack([pila.sel(band=v).values for v in VARS], axis=-1)
    d = X - mu_vec
    d2 = np.einsum("...i,ij,...j->...", d, inv, d)
    return 100 * np.exp(-d2 / (2 * len(VARS)))


if __name__ == "__main__":
    procesar()
    validar()
