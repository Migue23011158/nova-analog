# Nova Analog — Mars and the Moon, found on Earth

*English below · [Español más abajo](#nova-analog--marte-y-la-luna-encontrados-en-la-tierra-español)*

**NASA Space Apps Challenge 2026 · Local event: Duitama, Colombia · Team NOVA SQUAT**

Live app: https://migue23011158.github.io/nova-analog/

Nova Analog finds places on Earth whose surface resembles two reference sites:

- **Mars — Arcadia Planitia** (47.2° N, 184.3° E), a mid-latitude plain with shallow ground ice.
- **Moon — Shackleton crater rim** (89.67° S, 129.78° E), at the lunar south pole.

The goal is to help decide where to test rovers, construction methods and training on Earth, close to home.

## What the app does

- **Explore:** a 3D globe with the analyzed Earth sites, a ranked list and adjustable weights. A selector switches the globe to Mars or the Moon to show where each reference site is, together with the Earth sites that resemble it.
- **Compare:** the Earth site next to the reference site, with a **similarity score (0–100)**, the site class, a variable-by-variable comparison, the trained model's result and the limits of the analogy (gravity, atmosphere, radiation).
- **Any point:** tap the Earth map in Compare to see the class the model assigned to that cell of the global screening.
- **Compare any region:** a separate tool that classifies a whole region with the same model.
- English by default, with a Spanish option (ES / EN).

## Method (short)

1. **Pre-filter:** only dry or periglacial, bare surfaces are evaluated. Wet or vegetated areas are marked "Not evaluated".
2. **Similarity index (0–100):** each variable (slope, albedo, freeze–thaw cycles) is compared with the reference through a Gaussian function, then combined with weights. **It is not a probability.**
3. **Trained model (GMM):** a Gaussian mixture model trained on real Mars, Moon and Earth pixels using only **slope and albedo**, the two variables measured the same way on the three bodies. It can answer "neither" when a place is outside what it learned.
4. **Validation:** the model was never shown the known Earth analogs. In the global screening it independently recovers published Mars analogs (Qaidam, Lut, Atacama, Mojave).

Alta Guajira (Colombia) is shown as a **candidate already cited in the literature** (Bolívar-Torres et al. 2026, *International Journal of Astrobiology*), not as a new discovery: the model reached the same region from orbital data alone.

## Data

- **NASA:** MOLA (Mars topography), TES (Mars albedo and thermal inertia), LOLA and Diviner (Moon), MODIS and NASADEM (Earth), Viking MDIM 2.1 (Mars mosaic), LROC (Moon images), NASA SVS CGI Moon Kit.
- **Other:** ESA Copernicus DEM, Mars Climate Database v6.2, Microsoft Planetary Computer, Google Earth Engine, Esri World Imagery (Earth map and globe tiles).

## Limits

- Comparisons use ~1 km cells (global screening ~11 km). A score describes a cell, not a single rock.
- Earth thermal inertia (apparent ATI) and Mars/Moon thermal inertia (SI units) are not directly comparable, so thermal inertia is shown as context only.
- Gravity, atmosphere and radiation cannot be reproduced anywhere on Earth.

## Use of artificial intelligence

This project was built with AI assistance, as required by the Space Apps rules:

- **Claude (Anthropic):** data-processing scripts, web app logic and layout, translation, verification.
- **Gemini (Google):** early versions of the web app code.
- **Figma Make:** initial visual design of the interface.
- **Gemini (Google):** team logo and app icon (AI-generated).

All results, numbers and decisions were reviewed by the team.

## Credits

Images: Esri World Imagery; NASA/JPL/USGS (Viking MDIM 2.1); NASA/GSFC/Arizona State University (LROC); NASA/GSFC Scientific Visualization Studio (CGI Moon Kit).
Software: React, Vite, Leaflet, globe.gl (three.js), GitHub Pages.

## Run locally

```
cd web
npm install
npm run dev
```

---

# Nova Analog — Marte y la Luna, encontrados en la Tierra (español)

**NASA Space Apps Challenge 2026 · Evento local: Duitama, Colombia · Equipo NOVA SQUAT**

Aplicación: https://migue23011158.github.io/nova-analog/

Nova Analog encuentra lugares de la Tierra cuya superficie se parece a dos sitios de referencia:

- **Marte — Arcadia Planitia** (47,2° N, 184,3° E), una llanura de latitudes medias con hielo poco profundo.
- **Luna — borde del cráter Shackleton** (89,67° S, 129,78° E), en el polo sur lunar.

El objetivo es ayudar a decidir dónde probar róveres, métodos de construcción y entrenamiento en la Tierra, cerca de casa.

## Qué hace la aplicación

- **Explorar:** un globo 3D con los sitios analizados, una lista ordenada y pesos ajustables. Un selector cambia el globo a Marte o a la Luna para mostrar dónde está cada sitio de referencia y qué sitios de la Tierra se le parecen.
- **Comparar:** el sitio de la Tierra junto al de referencia, con un **puntaje de similitud (0–100)**, la clase del sitio, la comparación variable por variable, el resultado del modelo entrenado y los límites de la analogía (gravedad, atmósfera, radiación).
- **Cualquier punto:** al tocar el mapa de la Tierra en Comparar se ve la clase que el modelo asignó a esa celda del barrido mundial.
- **Comparar cualquier región:** una herramienta aparte que clasifica una región completa con el mismo modelo.
- Inglés por defecto, con opción en español (ES / EN).

## Método (resumen)

1. **Filtro previo:** solo se evalúan superficies secas o periglaciares y desnudas. Las zonas húmedas o con vegetación quedan como "No evaluado".
2. **Índice de similitud (0–100):** cada variable (pendiente, albedo, ciclos de congelamiento) se compara con la referencia mediante una función gaussiana y luego se combinan con pesos. **No es una probabilidad.**
3. **Modelo entrenado (GMM):** un modelo de mezcla gaussiana entrenado con píxeles reales de Marte, la Luna y la Tierra, usando solo **pendiente y albedo**, las dos variables que se miden igual en los tres cuerpos. Puede responder "ninguna" cuando un lugar está fuera de lo que aprendió.
4. **Validación:** al modelo nunca se le mostraron los análogos terrestres conocidos. En el barrido mundial recupera por su cuenta análogos de Marte ya publicados (Qaidam, Lut, Atacama, Mojave).

La Alta Guajira (Colombia) se presenta como **candidata ya citada en la literatura** (Bolívar-Torres et al. 2026, *International Journal of Astrobiology*), no como un descubrimiento nuevo: el modelo llegó a la misma región solo con datos orbitales.

## Datos

- **NASA:** MOLA (topografía de Marte), TES (albedo e inercia térmica de Marte), LOLA y Diviner (Luna), MODIS y NASADEM (Tierra), Viking MDIM 2.1 (mosaico de Marte), LROC (imágenes de la Luna), CGI Moon Kit del NASA SVS.
- **Otros:** Copernicus DEM (ESA), Mars Climate Database v6.2, Microsoft Planetary Computer, Google Earth Engine, Esri World Imagery (mapa y globo de la Tierra).

## Límites

- Las comparaciones usan celdas de ~1 km (el barrido mundial, ~11 km). Un puntaje describe una celda, no una roca puntual.
- La inercia térmica de la Tierra (ATI aparente) y la de Marte o la Luna (unidades SI) no son comparables directamente; por eso se muestra solo como contexto.
- La gravedad, la atmósfera y la radiación no se pueden reproducir en ningún lugar de la Tierra.

## Uso de inteligencia artificial

Este proyecto se hizo con ayuda de IA, como piden las reglas de Space Apps:

- **Claude (Anthropic):** scripts de procesamiento de datos, lógica y diseño de la aplicación web, traducción, verificación.
- **Gemini (Google):** primeras versiones del código de la aplicación.
- **Figma Make:** diseño visual inicial de la interfaz.
- **Gemini (Google):** logo del equipo e ícono de la aplicación (generados con IA).

El equipo revisó todos los resultados, cifras y decisiones.

## Créditos

Imágenes: Esri World Imagery; NASA/JPL/USGS (Viking MDIM 2.1); NASA/GSFC/Arizona State University (LROC); NASA/GSFC Scientific Visualization Studio (CGI Moon Kit).
Software: React, Vite, Leaflet, globe.gl (three.js), GitHub Pages.

## Ejecutar en local

```
cd web
npm install
npm run dev
```
