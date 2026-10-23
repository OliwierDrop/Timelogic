# Własne API

Prefiks `/api/v1`. Daty są ISO 8601 z offsetem, identyfikatory UUID. Odpowiedź błędu zawiera `code`, `message` i opcjonalne `fields`. `401` oznacza brak sesji, `403` brak uprawnienia, `404` obiekt nieistniejący lub poza organizacją, `409` konflikt stanu, `422` błąd danych.

| Zasób | Operacje |
| --- | --- |
| Auth | `POST /auth/login`, `/auth/logout`, `/auth/invite`, `/auth/reset-password`; `GET /auth/me` |
| Pracownicy | `GET/POST /employees`, `GET/PATCH /employees/{id}`, `GET/POST /departments` |
| RCP | `GET/POST /time-entries`, `POST /time-entries/{id}/stop`, `POST /time-entries/{id}/breaks`, `POST /time-entries/{id}/breaks/{break_id}/stop` |
| Korekty | `GET/POST /attendance-corrections`, `POST /attendance-corrections/{id}/decision` |
| Grafiki | `GET/POST /shifts`, `PATCH /shifts/{id}`, `POST /shifts/publish` |
| Nieobecności | `GET/POST /leave-requests`, `POST /leave-requests/{id}/decision`, `GET /leave-balances` |
| Raporty | `GET /reports/time`, `GET /reports/export?format=csv|xlsx|pdf` |
| Audyt | `GET /audit-logs` — wyłącznie uprawnione role |

Start/Stop i przerwy wymagają `Idempotency-Key`; ten sam klucz z identyczną operacją zwraca pierwotny wynik. Listy mają `limit`, `offset`, filtry i stabilne sortowanie. Eksport stosuje te same filtry i kontrolę dostępu co raport ekranowy. OpenAPI jest źródłem typów klienta.
