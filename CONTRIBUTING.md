# Contribuir a Secopia

¡Gracias por tu interés en contribuir a Secopia! 🇨🇴

## Requisitos

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- **Docker** (opcional, para Redis y Typesense local)

## Setup local

```bash
# 1. Clonar el repo
git clone https://github.com/Andrez421/secopia.git
cd secopia

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp apps/web/.env.example apps/web/.env.local
# Editar .env.local con tus claves

# 4. (Opcional) Levantar servicios locales
docker compose up -d

# 5. Desarrollo
pnpm dev
```

## Estructura del proyecto

```
secopia/
├── apps/
│   ├── web/           # Next.js 15 — app web
│   └── mcp-server/    # HTTP server para MCP remoto
├── packages/
│   ├── types/         # Interfaces TypeScript compartidas
│   ├── socrata-client/ # Cliente Socrata + SoQLBuilder + LRU cache
│   └── mcp/           # MCP server factory + tools + resources
└── scripts/           # Scripts de mantenimiento
```

## Convenciones

### Commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: agregar filtro por modalidad
fix: corregir paginación en búsqueda
docs: actualizar README
refactor: extraer SoQLBuilder a módulo separado
test: agregar tests para LruCache
```

### Código

- **Linting y formato:** Biome (no ESLint ni Prettier)
- **Componentes:** PascalCase (`SearchBar.tsx`)
- **Utilidades:** camelCase (`formatCOP.ts`)
- **Tipos:** PascalCase con sufijo descriptivo (`ContratoSECOP2`)

### Branches

```
feat/nombre-descriptivo
fix/nombre-descriptivo
docs/nombre-descriptivo
```

## Comandos útiles

```bash
pnpm dev          # Desarrollo con hot reload
pnpm check        # Type checking
pnpm lint         # Biome lint
pnpm test         # Tests
pnpm clean        # Limpiar artefactos
```

## Seguridad

- **NUNCA** uses string interpolation para construir queries SoQL
- Siempre usá `SoQLBuilder` y sus métodos tipados
- Las API keys van en variables de entorno, nunca en el código

## Reportar bugs

Abrí un issue en GitHub con:

1. Descripción del problema
2. Pasos para reproducir
3. Comportamiento esperado vs actual
4. Capturas de pantalla si aplica

## Pull Requests

1. Creá un branch desde `main`
2. Hacé tus cambios siguiendo las convenciones
3. Asegurate de que `pnpm check && pnpm lint && pnpm test` pasen
4. Abrí un PR con descripción clara de los cambios

---

¿Dudas? Abrí un issue o preguntá en las discusiones del repo.
