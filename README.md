# Investigación de Operaciones Studio

Elige Método Gráfico, Método Simplex, Transporte o Asignación desde el inicio. El repaso ofrece dos recorridos independientes de 120 y 300 minutos. En los laboratorios de programación lineal puedes editar las restricciones, seguir los pasos del cálculo, practicar y comparar ambos métodos para un modelo de dos variables. La vista de Simplex muestra la M simbólica en la fase auxiliar y permite comparar el modelo primal con su dual.

La biblioteca muestra cada enunciado antes del modelo editable e indica su PDF y página. Incluye los siete problemas de Método Gráfico, SONY, agricultor, McDonald’s, camiones, industria, Práctica Máx y las dos variantes de alimentos. El modelo impreso de alimentos alcanza `670/9` y la variante de un kilogramo con cotas inclusivas alcanza `260/3`.

Los PDF de estudio incluyen [Método Gráfico y Simplex](Metodo_Grafico_y_Simplex_IEEE.pdf), con teoría y resoluciones paso a paso, y [Transporte y Asignación](Teoria_Transporte_y_Asignacion_IEEE.pdf), con los fundamentos de ambos métodos.

En **Mi sesión**, puedes exportar tus borradores, avances y exámenes en JSON. La versión 2 migra los respaldos anteriores y conserva el examen mixto de Transporte y Asignación. **Mixto general** tiene una tarea por tema. Ambos exámenes duran 20 minutos.

## Implementación

- `src/core/graphical.js` usa proyección exacta de Fourier–Motzkin, intersecciones de rectas y direcciones de recesión. El zoom actúa sobre el SVG.
- `src/core/simplex.js` ejecuta dos fases con aritmética racional, muestra la M simbólica de la fase auxiliar y activa la regla de Bland al detectar degeneración. `src/core/lp-certificates.js` comprueba redundancia, otros óptimos y holgura complementaria.
- `src/data/lp-exercises.js` reúne los ejercicios y sus referencias. La figura del problema gráfico 4 se redibuja a partir de las marcas de la guía. El editor admite ligaduras inclusivas e igualdades. El caso de cotas estrictas de alimentos se explica en las notas de fuente.
- `src/ui/lp-lab.js` conecta los laboratorios, la comparación y la práctica. `src/state/progress.js` conserva los itinerarios por separado, 120 minutos para Fundamentos, Gráfico, Simplex y práctica y 300 minutos para Transporte y Asignación.

## Pruebas

Para comprobar los motores, ejecuta `npm test`. Para comprobar el HTML offline en Chromium, Firefox y WebKit, instala los navegadores con `node node_modules/playwright/cli.js install chromium firefox webkit` y ejecuta `npm run test:browser` después de compilar. `npm run check:worker` valida la configuración del Worker mediante el modo de prueba de Wrangler.

## Compilar y abrir localmente

Con Node.js 22.12 o posterior, ejecuta:

```sh
npm ci
```

La instalación genera `dist/index.html`. Abre el archivo con doble clic para usarlo sin conexión. Ejecuta `npm run build` tras editar el código.

## Publicar en Cloudflare Workers

En **Workers & Pages**, conecta este repositorio de GitHub desde la rama `main` al Worker `transporte-asignaci-n-studio`. Usa la raíz del repositorio y `npx wrangler deploy` como comando de despliegue. La instalación automática de dependencias compila el HTML mediante `postinstall`. Si desactivas esa instalación, ejecuta `npm ci` como comando de compilación.

Wrangler sirve solo el HTML de `dist/`. Autoriza este repositorio en la integración de Cloudflare Workers & Pages y gestiona la autenticación desde Cloudflare. [Guía oficial de Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
