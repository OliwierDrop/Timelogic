# Własne API

Prefiks `/api/v1`. Daty są ISO 8601 z offsetem, identyfikatory UUID. Odpowiedź błędu zawiera `code`, `message` i opcjonalne `fields`. `401` oznacza brak sesji, `403` brak uprawnienia, `404` obiekt nieistniejący lub poza organizacją, `409` konflikt stanu, `422` błąd danych.

| Zasób | Operacje |
| --- | --- |
| Auth | `POST /auth/login`, `/auth/login/2fa`, `/auth/logout`, `/auth/invite`, `/auth/reset-password`; `GET /auth/me` (profil + `security` + `preferences`); self-service: `PATCH /auth/me/profile`, `POST /auth/me/password`, `GET/PATCH /auth/me/preferences`, `POST /auth/me/2fa/totp/{setup,confirm,disable}`, `POST /auth/me/2fa/email/{setup,confirm,disable}` |
| Organizacja | `GET/PATCH /organization` (nazwa, strefa); `GET/PUT /organization/mail`, `POST /organization/mail/test` — admin; SMTP w bazie (hasło nie wraca w GET) |
| Pracownicy | `GET/POST /employees`, `GET/PATCH /employees/{id}`, `GET/POST /departments` |
| RCP | `GET/POST /time-entries`, `POST /time-entries/{id}/stop`, `POST /time-entries/{id}/breaks`, `POST /time-entries/{id}/breaks/{break_id}/stop` |
| Korekty | `GET/POST /attendance-corrections`, `POST /attendance-corrections/{id}/decision` |
| Grafiki | `GET/POST /shifts`, `PATCH /shifts/{id}`, `DELETE /shifts/{id}`, `POST /shifts/publish`, `/shifts/reject-drafts`, `/shifts/bulk`, `/shifts/copy`; `GET/PUT /calendar/day-types`, `GET/PUT /calendar/availability` |
| Nieobecności | `GET/POST /leave-requests`, `POST /leave-requests/{id}/decision`, `GET /leave-balances` |
| Raporty | `GET /reports/time`, `GET /reports/export?format=csv|xlsx|pdf` |
| Audyt | `GET /audit-logs` — wyłącznie uprawnione role |

Start/Stop i przerwy wymagają `Idempotency-Key`; ten sam klucz z identyczną operacją zwraca pierwotny wynik. Listy mają `limit`, `offset`, filtry i stabilne sortowanie. Eksport stosuje te same filtry i kontrolę dostępu co raport ekranowy. OpenAPI jest źródłem typów klienta.
