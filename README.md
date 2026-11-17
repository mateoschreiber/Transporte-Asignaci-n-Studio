# Transporte & Asignación Studio

Laboratorio de Investigación de Operaciones con matrices editables, resolución paso a paso, práctica guiada y examen. El progreso se guarda en el navegador y se puede exportar como JSON desde **Mi sesión**.

## Compilar y abrir localmente

Con Node.js 22.12 o posterior, ejecuta:

```sh
npm ci
npm run build
```

Abre `dist/index.html` con doble clic. El archivo incluye la aplicación y funciona también sin conexión.

## Publicar en Cloudflare Workers

En **Workers & Pages**, crea un Worker e importa este repositorio de GitHub desde la rama `main`. Usa el nombre `transporte-asignacion-studio`, el directorio raíz del repositorio, `npm run build` como comando de compilación y `npx wrangler deploy` como comando de despliegue.

Wrangler sirve solo el HTML de `dist/`. Autoriza este repositorio en la integración de Cloudflare Workers & Pages y gestiona la autenticación desde Cloudflare. [Guía oficial de Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
