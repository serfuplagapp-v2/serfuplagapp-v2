# Serfuplagapp v2

App de gestión para control de plagas (SaaS multi-empresa). Reconstrucción de la v1
con foco en velocidad y aislamiento por empresa. Serfuplagas es el cliente #1.

## Stack

- **Next.js 16** (App Router) + **TypeScript estricto**
- **Tailwind v4** + **shadcn/ui** (identidad visual heredada de la v1)
- **Supabase** (PostgreSQL + RLS + Auth + Storage)
- **Vercel** (hosting y deploy automático desde GitHub)

> En Next.js 16, el antiguo `middleware.ts` se llama `proxy.ts`.

## Documentación del proyecto

La fuente de verdad vive en [`docs/`](docs/):

- `01_ARQUITECTURA_V2.md` — decisiones de arquitectura (leer primero)
- `02_PLAN_FASES.md` — plan de trabajo por fases
- `03_MIGRACION.md` · `04_DICCIONARIO_DATOS.md` · `05_DIAGNOSTICO_V1.md`

## Cómo correr en tu PC (opcional)

```bash
npm install
# Copia .env.example como .env.local y completa los valores de Supabase
npm run dev
```

Abre http://localhost:3000.

## Scripts

| Comando            | Qué hace                                  |
| ------------------ | ----------------------------------------- |
| `npm run dev`      | Servidor de desarrollo                    |
| `npm run build`    | Compila para producción                   |
| `npm run start`    | Sirve la versión compilada                |
| `npm run lint`     | Revisa el código con ESLint               |
| `npm run typecheck`| Revisa los tipos de TypeScript            |

## Base de datos

Toda la definición vive como migraciones SQL en [`supabase/`](supabase/). Ver
[`supabase/README.md`](supabase/README.md) para aplicarlas.

## Variables de entorno

Ver [`.env.example`](.env.example). Nunca subir claves al repositorio.
