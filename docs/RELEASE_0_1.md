# Release 0.1 — Product Polish

**UX only.** No nuevos motores. No cambios a PE / LE / Data Platform.

## Experiencia unificada

Todas las pantallas de producto usan `ProductShell` → `AppShell`:

- Sidebar de navegación definitiva
- Header con breadcrumbs + título
- Perfil
- Notificaciones (mock)
- Buscador global + paleta de comandos (**Ctrl+K** / **⌘K**)
- Transiciones de página (Framer Motion, respeta `prefers-reduced-motion`)
- Skip link y foco visible (`apex-focusable`)
- Loading / Empty / Error states del Design System

## Rutas cubiertas

Dashboard · Match Center · Copilot · Match Analysis · APEX Vision · Showcase · Design System

Marketing (`/`, login, register) conserva `PageShell`.

## Server vs Client boundary

- `ProductShell` — **server-agnostic** chrome; recibe `user` por props (sin Supabase / `next/headers`).
- `getShellUser()` en `@/lib/auth/get-shell-user` — **solo** Server Components / layouts / route handlers.
- Client (`error.tsx`, etc.) importa estados desde `@/components/app-shell/states`.
- Showcase usa `GuestShell` (`user={null}`), sin módulos server.

## Código

```text
components/app-shell/
lib/navigation/
```
