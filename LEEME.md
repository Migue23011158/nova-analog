# Nova Analog — scripts del sábado

## Orden
1. `01_capas_tierra.py` — descarga por ventana desde Planetary Computer y deja un GeoTIFF por zona a 1 km, 10 bandas. **Corre primero con una zona pequeña** (`python 01_capas_tierra.py tatacoa`) y mide cuánto tarda antes de lanzar todas.
2. `referencias_PLANTILLA.json` → copiar a `referencias.json` y llenar (sexto físico). Mientras tanto el paso 2 corre con valores de arranque.
3. `02_similitud.py` — puntuación 0-100 por celda, top 20 por zona en `resultados/candidatos.geojson`, y `validacion.csv` con la nota de Atacama, Haughton y Death Valley.

## Instalar (una sola vez)
```
pip install pystac-client planetary-computer odc-stac rioxarray xarray rasterio numpy scipy pandas geopandas pyproj
```

## Punto de control 1 (13:00)
Tener `capas_1km/*.tif` para al menos cuatro zonas. Si a las 12:00 solo hay una, recortar la lista de ZONAS a la mitad.

## Punto de control 2 (20:00)
`validacion.csv` con los tres controles por encima de 60. Si no: ajustar `sigma` en referencias (más grande = más tolerante) antes que tocar pesos. Si a las 20:30 sigue sin pasar: quedarse con 3 variables (pendiente, ati, aridez) y un propósito.

## Lo que la app necesita de aquí
- `resultados/*_movilidad.tif` y `*_construccion.tif` → capas del mapa (COG, se sirven estáticas).
- `resultados/candidatos.geojson` → fichas, comparador, buscador. Cada punto trae puntuación, confianza y desglose `sim_*`.
- Falta añadir a cada candidato: tiempo de viaje (Karen, capa Oxford/MAP) y altitud (ya está en NASADEM).

## Declarar
Los scripts se escribieron con ayuda de IA (Claude). Decirlo en el envío.
