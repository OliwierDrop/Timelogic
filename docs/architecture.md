# Architektura

Monorepo: `apps/web` (React + TypeScript + Vite), `apps/api` (FastAPI + SQLAlchemy), `packages` (kontrakty OpenAPI), `infra` (Compose). Jeden backend z modułami domenowymi unika komunikacji między serwisami. PostgreSQL przechowuje dane i sesje. Frontend komunikuje się wyłącznie z `/api/v1`.

## Przepływ danych

Przeglądarka wysyła ciasteczko sesji i nagłówek CSRF. API ustala użytkownika, organizację i zakres pracowników przed zapytaniem. Zapis RCP blokuje rekord pracownika w transakcji, sprawdza aktualny stan, zapisuje wpis i audyt, po czym zwraca nowy stan. Raporty bazują na zaakceptowanych danych; wyniki obliczeń można później materializować bez zmiany źródła prawdy.

## Uruchomienie

Compose uruchamia bazę, API i web. Migracja Alembic wykonuje się przed startem API. Health checks weryfikują gotowość usług. Dane demonstracyjne są oddzielone od produkcyjnego uruchomienia.

## Produkcja (TLS i proxy)

Aplikacja działa w modelu **jednej origin** (SPA + `/api` przez nginx w usłudze `web`). Na produkcji TLS ustawia się na krawędzi:

1. **Zalecane:** DNS → Caddy/nginx/Traefik (HTTPS) → `127.0.0.1:8080` (`scripts/compose.proxy.yml`). `PUBLIC_ORIGIN=https://twoja.domena`, `COOKIE_SECURE=true`, `TRUSTED_PROXIES` = adresy peerów proxy. Wzory: `scripts/proxy-examples/`.
2. **LAN / test:** HTTP na `0.0.0.0:8080` (`scripts/compose.publish.yml`).
3. **Bez osobnego proxy:** własne PEM w `./certs` + `scripts/compose.tls.yml` (port 443).

Instalator (`scripts/install.sh`) przeprowadza wybór trybu. Let’s Encrypt nie jest wbudowany — w trybie proxy robi to edge (np. Caddy). Middleware API porównuje nagłówek `Origin` z `PUBLIC_ORIGIN`; limit logowań używa `X-Forwarded-For` tylko gdy peer jest na `TRUSTED_PROXIES`.

## Decyzje

- `organization_id` od pierwszej migracji; UI obsługuje jedną organizację.
- Daty zdarzeń jako `timestamptz` w UTC; prezentacja według strefy organizacji.
- Role stałe w pierwszej wersji; rozbudowany edytor uprawnień dopiero po zebraniu przypadków użycia.
- Publikacja grafików oddziela plan roboczy od danych widocznych pracownikowi.
