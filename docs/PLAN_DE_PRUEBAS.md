# Plan de pruebas — TCG Tournaments

## Objetivo y alcance

Validar las reglas de autenticación y redirección, los contratos HTTP principales y los recorridos públicos críticos. Las pruebas automatizadas funcionales no escriben en Supabase: usan dobles o respuestas controladas.

## Matriz

| Tipo solicitado | Casos | Herramienta | Criterio de aprobación | Comando |
| --- | --- | --- | --- | --- |
| Unitarias | UT-01 a UT-04: destino por rol y existencia de tienda | Vitest | Cada perfil llega a su panel; la tienda tiene prioridad | `npm run test:unit` |
| Integración | IT-01 a IT-05: JSON, validación, autenticación y redirección segura | Vitest | Contratos 200/400/401 y bloqueo de destino externo | `npm run test:integration` |
| Usando mock | MK-01 y MK-02: alta exitosa y correo duplicado con Supabase simulado | Vitest | Se verifica el payload sin crear usuarios; duplicado retorna 409 | `npm run test:mock` |
| Aceptación | CA-01 búsqueda; CA-02 filtro por ciudad; CA-03 rechazo de login | Playwright | El usuario completa el recorrido y recibe feedback visible | `cd ../../tcg-frontend/tcg-frontend && npm run test:acceptance` |
| Carga | PF-01: hasta 20 usuarios virtuales en el listado público | k6 | Error < 1 %, p95 < 800 ms, checks > 99 % | `npm run test:load` |
| Estrés | PF-02: incremento progresivo hasta 150 usuarios virtuales | k6 | Referencia: error < 5 % y p95 < 2 s; registrar punto de degradación | `npm run test:stress` |

## Criterios de aceptación

### CA-01 — Buscar torneos desde la portada

**Dado** que una persona visita la portada, **cuando** activa el buscador, **entonces** accede al listado y ve “Torneos TCG”.

### CA-02 — Filtrar por ciudad

**Dado** que una persona está en el listado, **cuando** escribe “Santiago” y confirma, **entonces** el filtro queda en la URL para que la búsqueda sea reproducible.

### CA-03 — Mostrar un rechazo de autenticación

**Dado** que el servicio rechaza las credenciales, **cuando** la persona envía el login, **entonces** permanece en la página y recibe un error accesible.

## Preparación y evidencias

1. Usar Node.js 20 o superior y ejecutar `npm install` en ambos proyectos.
2. Para aceptación, instalar Chromium una vez con `npx playwright install chromium` en el frontend.
3. Para rendimiento, instalar k6, aplicar las migraciones y levantar el backend.
4. Ejecutar carga o estrés sólo contra un ambiente autorizado. Para cambiar el destino: `k6 run -e BASE_URL=https://ambiente.example tests/performance/load.js`.
5. Conservar la salida de Vitest, el reporte HTML de Playwright y las métricas de k6 como evidencias de ejecución.

Un test automatizado aprobado demuestra el comportamiento cubierto; no reemplaza la revisión exploratoria ni autoriza estrés en producción.
