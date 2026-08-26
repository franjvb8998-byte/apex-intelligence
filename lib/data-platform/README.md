# Data Platform

Infraestructura de ingestión desacoplada de proveedores externos.

- Documentación v2: [`docs/data-platform.md`](../../docs/data-platform.md)
- API-Football Real Data v1: [`docs/API_FOOTBALL.md`](../../docs/API_FOOTBALL.md)
- Referencia ampliada: [`docs/DATA_PLATFORM.md`](../../docs/DATA_PLATFORM.md)
- Entrypoint: `index.ts`

**v2:** `IDataProvider` · `MockDataProvider` · `ApiFootballDataProvider` (HTTP + fixtures) · `ProviderFactory`  
**Default:** `APEX_DATA_PROVIDER=mock`

**Regla de oro:** el Intelligence Core solo ve el modelo `Apex*`. Nunca JSON de vendors.
