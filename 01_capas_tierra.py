"""
Nova Analog — Paso 1: capas terrestres alineadas a una grilla de 1 km.

Lee por ventana desde Microsoft Planetary Computer (STAC, sin cuenta) y deja,
por cada zona candidata, un GeoTIFF multibanda alineado a EPSG:6933 (área igual)
a 1 km con estas bandas:

  1 pendiente (grados)          ← NASADEM
  2 rugosidad (desv. est. elev.)← NASADEM
  3 LST día media (K)           ← MODIS MOD11A2
  4 LST noche media (K)         ← MODIS MOD11A2
  5 amplitud térmica (K)        ← 3 - 4
  6 inercia térmica aparente    ← (1 - albedo) / amplitud  (ATI, adimensional)
  7 albedo onda corta (0-1)     ← MODIS MCD43A3
  8 índice de aridez P/PET      ← TerraClimate (climatología 1991-2020)
  9 humedad de suelo (mm)       ← TerraClimate
 10 cobertura de datos (0-1)    ← fracción de bandas con dato real

Instalar:  pip install pystac-client planetary-computer rioxarray xarray
                       rasterio numpy scipy odc-stac
Correr:    python 01_capas_tierra.py                (todas las zonas)
           python 01_capas_tierra.py atacama        (una zona)
"""
import sys, warnings
import numpy as np
import xarray as xr
import rioxarray  # noqa: F401  (registra el accesor .rio)
import pystac_client, planetary_computer
from odc.stac import load as stac_load
from scipy.ndimage import generic_filter
from rasterio.enums import Resampling

warnings.filterwarnings("ignore")

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
CRS_OUT = "EPSG:6933"      # área igual, metros
RES_OUT = 1000             # 1 km
SALIDA = "capas_1km"       # carpeta de salida

# ---- Zonas candidatas: bbox en lon/lat (oeste, sur, este, norte) -------------
# Recortes manejables. Agregar o quitar según el tiempo que tarde cada una.
ZONAS = {
    "atacama":     (-70.8, -25.5, -68.0, -22.0),
    "puna":        (-68.5, -27.5, -66.0, -23.5),
    "guajira":     (-73.5,  11.0, -71.0,  12.6),
    "tatacoa":     (-75.4,   3.0, -74.8,   3.5),
    "mojave":      (-118.0, 34.5, -115.0, 37.5),
    "sahara_hoggar": (4.0,  22.0,   7.0,  25.0),
    "islandia":    (-19.0,  63.8, -16.5,  65.2),
    "devon":       (-92.0,  74.8, -87.0,  75.9),
}

# Análogos de control (para validar después; no se usan aquí, quedan a mano)
CONTROL = {
    "atacama_yungay": (-70.0, -24.1),
    "haughton":       (-89.8,  75.4),
    "death_valley":   (-116.9, 36.5),
}


def abrir_catalogo():
    return pystac_client.Client.open(STAC, modifier=planetary_computer.sign_inplace)


def grilla_objetivo(bbox):
    """Plantilla vacía a 1 km en EPSG:6933 que cubre el bbox."""
    from pyproj import Transformer
    t = Transformer.from_crs("EPSG:4326", CRS_OUT, always_xy=True)
    xs, ys = zip(t.transform(bbox[0], bbox[1]), t.transform(bbox[2], bbox[3]))
    x0, x1 = np.floor(min(xs) / RES_OUT) * RES_OUT, np.ceil(max(xs) / RES_OUT) * RES_OUT
    y0, y1 = np.floor(min(ys) / RES_OUT) * RES_OUT, np.ceil(max(ys) / RES_OUT) * RES_OUT
    x = np.arange(x0 + RES_OUT / 2, x1, RES_OUT)
    y = np.arange(y1 - RES_OUT / 2, y0, -RES_OUT)
    g = xr.DataArray(np.full((len(y), len(x)), np.nan, dtype="float32"),
                     coords={"y": y, "x": x}, dims=("y", "x"))
    return g.rio.write_crs(CRS_OUT)


def a_grilla(da, plantilla, metodo=Resampling.average):
    """Reproyecta y remuestrea cualquier capa a la plantilla de 1 km."""
    da = da.rio.write_nodata(np.nan, encoded=False) if da.rio.nodata is None else da
    return da.rio.reproject_match(plantilla, resampling=metodo)


# ---- NASADEM: pendiente y rugosidad ------------------------------------------
def capa_nasadem(cat, bbox, plantilla):
    items = list(cat.search(collections=["nasadem"], bbox=bbox).items())
    if not items:
        return None, None
    dem = stac_load(items, bands=["elevation"], bbox=bbox, crs="EPSG:4326",
                    resolution=0.0003, chunks={}).elevation.isel(time=0).astype("float32")
    dem = dem.where(dem > -500).compute()
    # pendiente en grados sobre una proyección métrica intermedia
    dem_m = dem.rio.write_crs("EPSG:4326").rio.reproject(CRS_OUT, resolution=90,
                                                           resampling=Resampling.bilinear)
    z = dem_m.values
    gy, gx = np.gradient(z, 90.0)
    pend = np.degrees(np.arctan(np.hypot(gx, gy))).astype("float32")
    rug = generic_filter(z, np.nanstd, size=11, mode="nearest").astype("float32")
    pend_da = dem_m.copy(data=pend)
    rug_da = dem_m.copy(data=rug)
    return a_grilla(pend_da, plantilla), a_grilla(rug_da, plantilla)


# ---- MODIS MOD11A2: temperatura superficial día y noche -----------------------
def capa_lst(cat, bbox, plantilla, anios=("2022", "2023")):
    items = list(cat.search(collections=["modis-11A2-061"], bbox=bbox,
                            datetime=f"{anios[0]}-01-01/{anios[-1]}-12-31").items())
    if not items:
        return None, None
    ds = stac_load(items, bands=["LST_Day_1km", "LST_Night_1km"], bbox=bbox,
                   crs="EPSG:4326", resolution=0.01, chunks={})
    dia = ds.LST_Day_1km.where(ds.LST_Day_1km > 0) * 0.02
    noche = ds.LST_Night_1km.where(ds.LST_Night_1km > 0) * 0.02
    dia_m = dia.mean("time").compute().astype("float32").rio.write_crs("EPSG:4326")
    noche_m = noche.mean("time").compute().astype("float32").rio.write_crs("EPSG:4326")
    return a_grilla(dia_m, plantilla), a_grilla(noche_m, plantilla)


# ---- MODIS MCD43A3: albedo de onda corta --------------------------------------
def capa_albedo(cat, bbox, plantilla, anio="2023"):
    items = list(cat.search(collections=["modis-43A3-061"], bbox=bbox,
                            datetime=f"{anio}-01-01/{anio}-12-31").items())
    if not items:
        return None
    ds = stac_load(items, bands=["Albedo_BSA_shortwave"], bbox=bbox,
                   crs="EPSG:4326", resolution=0.005, chunks={})
    alb = (ds.Albedo_BSA_shortwave.where(ds.Albedo_BSA_shortwave < 32767) * 0.001)
    alb_m = alb.mean("time").compute().astype("float32").rio.write_crs("EPSG:4326")
    return a_grilla(alb_m, plantilla)


# ---- TerraClimate: aridez (P/PET) y humedad de suelo --------------------------
def capa_terraclimate(cat, bbox, plantilla):
    items = list(cat.search(collections=["terraclimate"], bbox=bbox,
                            datetime="2015-01-01/2020-12-31").items())
    if not items:
        return None, None
    ds = stac_load(items, bands=["ppt", "pet", "soil"], bbox=bbox,
                   crs="EPSG:4326", resolution=0.04, chunks={})
    p = ds.ppt.sum("time").compute().astype("float32")
    pet = ds.pet.sum("time").compute().astype("float32")
    aridez = (p / pet.where(pet > 0)).rio.write_crs("EPSG:4326")
    suelo = ds.soil.mean("time").compute().astype("float32").rio.write_crs("EPSG:4326")
    return a_grilla(aridez, plantilla, Resampling.bilinear), a_grilla(suelo, plantilla, Resampling.bilinear)


def procesar_zona(nombre, bbox):
    import os
    os.makedirs(SALIDA, exist_ok=True)
    cat = abrir_catalogo()
    plantilla = grilla_objetivo(bbox)
    print(f"[{nombre}] grilla {plantilla.shape} a 1 km")

    pend, rug = capa_nasadem(cat, bbox, plantilla);          print(f"[{nombre}] NASADEM ok")
    dia, noche = capa_lst(cat, bbox, plantilla);             print(f"[{nombre}] MOD11A2 ok")
    alb = capa_albedo(cat, bbox, plantilla);                 print(f"[{nombre}] MCD43A3 ok")
    aridez, suelo = capa_terraclimate(cat, bbox, plantilla); print(f"[{nombre}] TerraClimate ok")

    vacio = plantilla.copy()
    bandas = {
        "pendiente_deg":   pend if pend is not None else vacio,
        "rugosidad_m":     rug if rug is not None else vacio,
        "lst_dia_K":       dia if dia is not None else vacio,
        "lst_noche_K":     noche if noche is not None else vacio,
    }
    amp = (bandas["lst_dia_K"] - bandas["lst_noche_K"])
    bandas["amplitud_K"] = amp
    bandas["albedo"] = alb if alb is not None else vacio
    # Inercia térmica aparente (ATI): mayor = roca firme; menor = polvo suelto
    bandas["ati"] = (1 - bandas["albedo"]) / amp.where(amp > 0)
    bandas["aridez_P_PET"] = aridez if aridez is not None else vacio
    bandas["humedad_suelo_mm"] = suelo if suelo is not None else vacio

    pila = xr.concat([b.rename(None) for b in bandas.values()], dim="band")
    pila = pila.assign_coords(band=list(bandas.keys()))
    cobertura = (~np.isnan(pila)).sum("band") / len(bandas)
    pila = xr.concat([pila, cobertura.expand_dims(band=["cobertura"])], dim="band")
    pila = pila.rio.write_crs(CRS_OUT)

    ruta = f"{SALIDA}/{nombre}_1km.tif"
    pila.rio.to_raster(ruta, driver="COG", compress="deflate", dtype="float32")
    print(f"[{nombre}] guardado {ruta}  bandas={list(pila.band.values)}")
    return ruta


if __name__ == "__main__":
    pedidas = sys.argv[1:] or list(ZONAS)
    for z in pedidas:
        try:
            procesar_zona(z, ZONAS[z])
        except Exception as e:
            print(f"[{z}] FALLÓ: {e}")
