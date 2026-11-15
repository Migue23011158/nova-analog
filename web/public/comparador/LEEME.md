# Comparador de regiones — Nova Analog

Página autónoma: el usuario selecciona un rectángulo de la Tierra y la compara con Marte (Arcadia, franja 30–60°N) y la Luna (Shackleton, polo sur).

## Integración (Miguel) — sin tocar el código de la app
1. Copiar `comparador.html` y la carpeta `datos/` dentro de `web/public/comparador/`.
2. En la app, un enlace o botón: `<a href="/comparador/comparador.html" target="_blank">Compare a region</a>`
   (o un `<iframe src="/comparador/comparador.html">` en la vista Comparar).
3. Listo. No usa librerías ni red externa. Tiene botón ES/EN.

## Datos
- `datos/*.png`: rejilla 0,2° (1800×850, fila 0 = 85°N, columna 0 = −180°), PNG en escala de grises sin pérdida.
  - `n_tierra, n_marte, n_luna, n_fuera, n_no_evaluado`: cuántas de las 4 subceldas de 0,1° caen en cada clase.
  - `p_marte` = (v−1)/250 · `tip_marte`, `tip_luna` = (v−1)/2,5 (percentil 0–100) · `pendiente` = (v−1)/10 (°) · `albedo` = (v−1)/500 · `rugosidad` = exp((v−1)/34)−1 (m). v = 0 → sin dato.
- `referencias_comparacion.json`: percentiles e histogramas de Arcadia, Shackleton (30 km), franja Marte y polo sur lunar.
- Clasificación: `nova_gmm.json` (GMM pendiente + albedo), mismos conteos que `global_clases`: 57.427 Marte, 7.965 Luna, 110.696 fuera, 1.940 Ninguna (celdas de 0,1°).

## Límites (decirlos si preguntan)
- Escala 0,1–0,2°: la Alta Guajira no pasa el filtro a esta escala; solo aparece en el análisis a 1 km.
- El modelo usa 2 variables; la rugosidad se muestra, no clasifica. No ve hielo ni composición.
- La "tipicidad" es un percentil frente a píxeles reales, no una probabilidad.

## Capa Colombia 1 km (añadida 15:05)
- `datos/co/`: rejilla 0,01° (1240×1690, desde `capas_1km/colombia_1km.tif`, EPSG:6933 → lat/lon). Hay que copiar también esta subcarpeta.
- `clase` (con filtro): 1 Marte, 2 Luna, 3 no se parece, 4 no evaluado. `clase_sin_filtro`: el modelo aplicado a todo (solo para ver qué ve el modelo).
- `motivo`: 1 solo vegetación, 2 solo húmedo, 3 ambos.
- Resultado: 925.433 px; pasan el filtro 2.926 (0,3 %); 1.640 Marte y 277 Luna, casi todo en la Alta Guajira. Tatacoa: 0 pasan (NDVI y humedad).

## Actualización 15:15
- Botón "Filtro": con filtro (resultado) / sin filtro (todo el terreno clasificado solo por pendiente y albedo; 2.015.306 celdas de 0,1°: 671.173 Marte, 71.301 Luna). El modo sin filtro NO es resultado: muestra por qué el filtro es necesario (la Amazonía sale "Marte" por ser plana).
- `datos/r1km/`: 8 regiones más a 1 km (Atacama, Mojave, Khaybar, Devon, Bayuda, McMurdo, Undara, Svalbard) + `index.json`. Copiar también esta carpeta.
- Devon y McMurdo no tienen NDVI ni aridez: se evalúan completos (roca y hielo).
