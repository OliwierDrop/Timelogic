# Architektura

Monorepo: `apps/web` (React + TypeScript + Vite), `apps/api` (FastAPI + SQLAlchemy), `packages` (kontrakty OpenAPI), `infra` (Compose). Jeden backend z modułami domenowymi unika komunikacji między serwisami. PostgreSQL przechowuje dane i sesje. Frontend komunikuje się wyłącznie z `/api/v1`.

## Przepływ danych

Przeglądarka wysyła ciasteczko sesji i nagłówek CSRF. API ustala użytkownika, organizację i zakres pracowników przed zapytaniem. Zapis RCP blokuje rekord pracownika w transakcji, sprawdza aktualny stan, zapisuje wpis i audyt, po czym zwraca nowy stan. Raporty bazują na zaakceptowanych danych; wyniki obliczeń można później materializować bez zmiany źródła prawdy.

## Uruchomienie

Compose uruchamia bazę, API i web. Migracja Alembic wykonuje się przed startem API. Health checks weryfikują gotowość usług. TLS i ograniczenia sieciowe należy skonfigurować w reverse proxy przed produkcją. Dane demonstracyjne są oddzielone od produkcyjnego uruchomienia.

## Decyzje

- `organization_id` od pierwszej migracji; UI obsługuje jedną organizację.
- Daty zdarzeń jako `timestamptz` w UTC; prezentacja według strefy organizacji.
- Role stałe w pierwszej wersji; rozbudowany edytor uprawnień dopiero po zebraniu przypadków użycia.
- Publikacja grafików oddziela plan roboczy od danych widocznych pracownikowi.
