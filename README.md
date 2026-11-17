# Transporte & Asignación Studio

Laboratorio de Investigación de Operaciones con matrices editables, resolución paso a paso, práctica guiada y examen. El progreso se guarda en el navegador y se puede exportar como JSON desde **Mi sesión**.

## Compilar y abrir localmente

Con Node.js 22.12 o posterior, ejecuta:

```sh
npm ci
```

La instalación genera `dist/index.html`. Abre el archivo con doble clic para usarlo sin conexión. Ejecuta `npm run build` tras editar el código.

## Publicar en Cloudflare Workers

En **Workers & Pages**, conecta este repositorio de GitHub desde la rama `main` al Worker `transporte-asignaci-n-studio`. Usa la raíz del repositorio y `npx wrangler deploy` como comando de despliegue. La instalación automática de dependencias compila el HTML mediante `postinstall`. Si desactivas esa instalación, ejecuta `npm ci` como comando de compilación.

Wrangler sirve solo el HTML de `dist/`. Autoriza este repositorio en la integración de Cloudflare Workers & Pages y gestiona la autenticación desde Cloudflare. [Guía oficial de Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
