# Nova Analog — User guide

*English below · [Guía en español más abajo](#nova-analog--guía-de-uso)*

**Live app:** https://migue23011158.github.io/nova-analog/
Works on desktop and mobile. Opens in English; switch to Spanish with **ES / EN** (top right).

## In one minute
1. Pick a reference: **Mars · Arcadia Planitia** or **Moon · Shackleton rim**.
2. Pick an Earth site from the list or the globe.
3. Press **Compare** to see how similar it is, and why.
4. Want somewhere else? Press **Explore anywhere on Earth** and select any region.

## Explore (home screen)
| Element | What it does |
|---|---|
| **Earth · Mars · Moon** (below the globe) | Switches the globe. Mars and Moon show the reference site with a marker; the list changes to the Earth sites that resemble it. The planet image takes a couple of seconds to load. |
| **Mars · Arcadia / Moon · Shackleton** (above the globe) | Chooses the reference used for every score. |
| **Globe** | Drag to rotate, scroll to zoom. Click a marker to select a site. |
| **Site card** | Coordinates, class (Mars / Moon / No match), score, number of variables and confidence. |
| **Explore anywhere on Earth** | Opens the region comparator (see below). |
| **Sites list** | *Best score* sorts by similarity. *Near me* sorts by travel time from your location. |
| **Index weights** | Sliders that tune the 0–100 score. *Rover mobility* (default) or *Construction*. **Reset** restores them. |
| **My location** | Asks for your location and flies the globe there. |
| **? How is it calculated** | The method in one screen. |
| **ⓘ** (next to key terms) | Hover or tap for a short definition. |

## Compare
| Element | What it does |
|---|---|
| **Earth map** (left) | Real satellite imagery. The dashed square is the **analyzed area (3 × 3 km)**; there is a km scale. |
| **Tap the map** | Shows what the trained model says for any point on Earth (Mars, Moon, out of range, or not evaluated). |
| **View terrain ↗** | Opens the same place in Google Maps satellite. |
| **Reference image** (right) | Arcadia Planitia (Mars) or Shackleton rim (Moon). |
| **Similarity to …** (center) | Score from 0 to 100. **It is not a probability.** |
| **Pills below** | Site class, score against both references, variables used and confidence. |
| **Carousel** | Jump to any other site. |
| **Conclusion** | One sentence: in what the site resembles the reference, and where it differs. |
| **Trained model (GMM)** | Second opinion from a model trained on real Mars, Moon and Earth pixels. It can answer "none". |
| **Index vs. model** | Whether both methods agree for every site. |
| **Terrain profile** | Each variable side by side: Earth vs. reference, with its similarity bar. |
| **Where the analogy fails** | Gravity, atmosphere and radiation: no place on Earth reproduces them. |

## Explore anywhere on Earth (region comparator)
- **Drag a rectangle** on the world map, **click a point**, or choose a place in **Go to** (Atacama, Alta Guajira, Qaidam, Lut…).
- Orange = Mars-like, white = Moon-like, gray = evaluated but not similar, dark = not evaluated (wet, vegetated, ice or urban).
- The panel shows a **satellite view** of the selection (＋ / − to zoom, **View terrain ↗**), what the model says, and how the region compares with Arcadia and Shackleton.
- Keep **Filter: on** for results. *Filter off* only shows why the filter is needed.

## How to read the results
- **Similarity score (0–100):** how close slope, albedo and freeze–thaw cycles are to the reference. Class = the reference with the higher score, if it reaches 60.
- **Trained model (GMM):** uses only slope and albedo, the two variables measured the same way on Earth, Mars and the Moon. It was never shown the known Earth analogs, and in a global screening it rediscovered published ones (Qaidam, Lut, Atacama, Mojave).
- **Confidence:** how many variables had data at that site.

## Limits
- One score describes a ~1 km cell, not a single rock. The global screening uses ~11 km cells.
- Thermal inertia on Earth and on Mars/Moon use different units, so it is shown but not scored.
- The *Moon* class is the weakest: it mostly means "gray and steep".
- Alta Guajira is a candidate already cited in the literature, not a new discovery.

## Tips for a demo
- Keep **Rover mobility** selected (the validation was done with it).
- Wait two seconds after choosing Mars or Moon for the planet to load.
- Good examples: **Atacama** (Mars, 80), **Death Valley** (Mars, 98), **Alta Guajira** (Mars, 88), **Bayuda** (rejected by the model).

---

# Nova Analog — Guía de uso

**Aplicación:** https://migue23011158.github.io/nova-analog/
Funciona en PC y celular. Abre en inglés; cambia a español con **ES / EN** (arriba a la derecha).

## En un minuto
1. Elige una referencia: **Marte · Arcadia Planitia** o **Luna · Borde de Shackleton**.
2. Elige un sitio de la Tierra en la lista o en el globo.
3. Toca **Comparar** para ver qué tanto se parece y por qué.
4. ¿Quieres otro lugar? Toca **Explora cualquier lugar del mundo** y selecciona cualquier región.

## Explorar (pantalla inicial)
| Elemento | Qué hace |
|---|---|
| **Tierra · Marte · Luna** (debajo del globo) | Cambia el globo. Marte y Luna muestran el sitio de referencia con un marcador y la lista pasa a los sitios de la Tierra que se le parecen. La imagen del planeta tarda un par de segundos en cargar. |
| **Marte · Arcadia / Luna · Shackleton** (encima del globo) | Elige la referencia con la que se calculan los puntajes. |
| **Globo** | Arrastra para girar y usa la rueda para acercar. Toca un marcador para elegir un sitio. |
| **Tarjeta del sitio** | Coordenadas, clase (Marte / Luna / No coincide), puntaje, número de variables y confianza. |
| **Explora cualquier lugar del mundo** | Abre el comparador de regiones (ver abajo). |
| **Lista de sitios** | *Mejor puntaje* ordena por similitud. *Cerca de mí* ordena por tiempo de viaje desde tu ubicación. |
| **Pesos del índice** | Deslizadores que ajustan el puntaje 0–100. *Movilidad de róveres* (por defecto) o *Construcción*. **Restablecer** los devuelve. |
| **Mi ubicación** | Pide tu ubicación y lleva el globo hasta allá. |
| **? ¿Cómo se calcula?** | El método en una pantalla. |
| **ⓘ** (junto a términos clave) | Pasa el mouse o toca para ver una definición corta. |

## Comparar
| Elemento | Qué hace |
|---|---|
| **Mapa de la Tierra** (izquierda) | Imagen satelital real. El cuadro punteado es el **área analizada (3 × 3 km)**; hay escala en km. |
| **Tocar el mapa** | Muestra qué dice el modelo entrenado para cualquier punto de la Tierra (Marte, Luna, fuera de rango o no evaluado). |
| **Ver terreno ↗** | Abre el mismo lugar en Google Maps satélite. |
| **Imagen de referencia** (derecha) | Arcadia Planitia (Marte) o borde de Shackleton (Luna). |
| **Similitud con …** (centro) | Puntaje de 0 a 100. **No es una probabilidad.** |
| **Pastillas de abajo** | Clase del sitio, puntaje contra las dos referencias, variables usadas y confianza. |
| **Carrusel** | Salta a cualquier otro sitio. |
| **Conclusión** | Una frase: en qué se parece el sitio a la referencia y en qué difiere. |
| **Modelo entrenado (GMM)** | Segunda opinión de un modelo entrenado con píxeles reales de Marte, la Luna y la Tierra. Puede responder "ninguno". |
| **Índice frente a modelo** | Si los dos métodos coinciden para cada sitio. |
| **Perfil del terreno** | Cada variable lado a lado: Tierra frente a la referencia, con su barra de similitud. |
| **Dónde falla la analogía** | Gravedad, atmósfera y radiación: ningún lugar de la Tierra las reproduce. |

## Explora cualquier lugar del mundo (comparador de regiones)
- **Arrastra un rectángulo** sobre el mapa, **haz clic en un punto** o elige un lugar en **Ir a** (Atacama, Alta Guajira, Qaidam, Lut…).
- Naranja = parecido a Marte, blanco = parecido a la Luna, gris = evaluado pero no se parece, oscuro = no evaluado (húmedo, con vegetación, hielo o ciudad).
- El panel muestra una **vista satelital** de la selección (＋ / − para acercar, **Ver terreno ↗**), qué dice el modelo y cómo se compara la región con Arcadia y Shackleton.
- Deja **Filtro: activado** para ver resultados. *Filtro desactivado* solo sirve para mostrar por qué el filtro es necesario.

## Cómo leer los resultados
- **Puntaje de similitud (0–100):** qué tan cerca están la pendiente, el albedo y los ciclos de congelamiento de los de la referencia. La clase es la referencia con mayor puntaje, si llega a 60.
- **Modelo entrenado (GMM):** usa solo pendiente y albedo, las dos variables que se miden igual en la Tierra, Marte y la Luna. Nunca vio los análogos terrestres conocidos, y en un barrido mundial recuperó por su cuenta análogos publicados (Qaidam, Lut, Atacama, Mojave).
- **Confianza:** cuántas variables tuvieron dato en ese sitio.

## Límites
- Un puntaje describe una celda de ~1 km, no una roca puntual. El barrido mundial usa celdas de ~11 km.
- La inercia térmica de la Tierra y la de Marte o la Luna usan unidades distintas, así que se muestra pero no se puntúa.
- La clase *Luna* es la más débil: significa sobre todo "gris y empinado".
- La Alta Guajira es una candidata ya citada en la literatura, no un descubrimiento nuevo.

## Consejos para una demo
- Deja **Movilidad de róveres** seleccionado (la validación se hizo con ese perfil).
- Espera dos segundos después de elegir Marte o Luna para que cargue el planeta.
- Buenos ejemplos: **Atacama** (Marte, 80), **Death Valley** (Marte, 98), **Alta Guajira** (Marte, 88), **Bayuda** (rechazado por el modelo).
