# TimeLogic

Polski system RCP (ewidencja czasu pracy): karty pracowników, zaproszenia do konta, rejestracja czasu, grafiki, wnioski i korekty. Monorepo Docker — FastAPI + React.

Dokumentacja projektowa: [`docs/`](docs/). Kontekst produktowy: [`PRODUCT.md`](PRODUCT.md).

## Stack

| Warstwa | Technologia |
| --- | --- |
| Web | React, React Router, TanStack Query, Vite, nginx |
| API | FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| DB | PostgreSQL 18 |

## Instalacja na serwerze (Linux)

Wymagania: Docker Engine, plugin Compose (`docker compose`), git.

```bash
curl -fsSL https://raw.githubusercontent.com/OliwierDrop/Timelogic/main/scripts/install.sh | bash
```

Albo po sklonowaniu: `./scripts/install.sh`.

Instalator pyta o organizację, admina oraz **tryb udostępniania**:

| Tryb | Opis | Compose |
| --- | --- | --- |
| 1 — HTTP :8080 | IP/hostname, LAN lub test | `scripts/compose.publish.yml` |
| 2 — Reverse proxy | DNS + HTTPS na Caddy/nginx (zalecane) | `scripts/compose.proxy.yml` → `127.0.0.1:8080` |
| 3 — Własne PEM | HTTPS w kontenerze `web` | `scripts/compose.tls.yml` + `./certs` |

W trybie 2 zapisuje `generated-proxy.md` i wzory w [`scripts/proxy-examples/`](scripts/proxy-examples/). Let’s Encrypt zostaje po stronie proxy (np. Caddy). Hasło admina nie jest zapisywane na dysku.

Opcjonalnie: `TIMELOGIC_DIR`, `TIMELOGIC_REPO`, `TIMELOGIC_BRANCH`.

## Szybki start (Docker, lokalnie)

1. Skopiuj konfigurację:

```bash
cp .env.example .env
```

2. Uruchom stack:

```bash
docker compose up --build -d
```

3. Otwórz aplikację: [http://localhost:8080](http://localhost:8080)

API (wewnętrznie) nasłuchuje na porcie `8000` w sieci Compose; web proxy’uje `/api`. Postgres lokalnie: `127.0.0.1:55432`.

Pierwszy admin: ustaw `BOOTSTRAP_EMAIL`, `BOOTSTRAP_PASSWORD` (min. 12 znaków) i uruchom w kontenerze API `python -m app.bootstrap`. Bootstrap tworzy organizację, konto admina **oraz kartę w Zespole** (opcjonalnie `BOOTSTRAP_FIRST_NAME` / `BOOTSTRAP_LAST_NAME`). Dane lokalne trzymaj w `.local-admin.txt` / `.env` — **nie commituj**.

W Zespole każdy pracownik ma konto z e-mailem. Status **zaproszony** = konto istnieje, ale jeszcze bez hasła (`password_hash` puste).

## Co jest w pilotażu

- **Zespół** — tworzenie pracowników (imię, nazwisko, e-mail, rola), tagi z kolorami i tagami informacyjnymi, stanowiska, statusy (zaproszony / aktywny / nieaktywny)
- **Zaproszenia** — mail z tokenem → `/set-password` (hasło 2×) → logowanie; ponowne wysłanie z menu ⋯
- **Akcje karty** — edycja, dezaktywacja, usunięcie (modale w aplikacji)
- **RCP** — wpisy czasu, przerwy, korekty
- **Grafiki / wnioski** — szkielety funkcjonalne w aplikacji
- **Raporty** — zakładka w nawigacji (placeholder)

## Struktura

```
apps/api/                      FastAPI + migracje Alembic
apps/web/                      SPA React (+ nginx.tls.conf)
compose.yaml                   db + api + web (lokalnie 127.0.0.1:8080)
scripts/install.sh             instalator serwerowy (tryby A/B/C)
scripts/compose.publish.yml    HTTP 0.0.0.0:8080
scripts/compose.proxy.yml      HTTP tylko 127.0.0.1:8080
scripts/compose.tls.yml        HTTPS :443 + ./certs
scripts/proxy-examples/        Caddy / nginx przed aplikacją
docs/                          wymagania, architektura, bezpieczeństwo
```

## Testy API

```bash
cd apps/api
# z venv projektu i działającą bazą testową (patrz tests/)
pytest
```

## Zmienne środowiskowe

Wzór: [`.env.example`](.env.example)

| Zmienna | Opis |
| --- | --- |
| `POSTGRES_*` | Baza w kontenerze `db` |
| `PUBLIC_ORIGIN` | Dokładny publiczny URL przeglądarki (origin CSRF), np. `https://rcp.firma.pl` |
| `COOKIE_SECURE` | `false` lokalnie, `true` przy HTTPS |
| `TRUSTED_PROXIES` | Lista IP/CIDR zaufanego proxy; wtedy `X-Forwarded-For` wpływa na limit logowań |
| `SMTP_*` | Opcjonalnie — bez SMTP link zaproszenia wraca w odpowiedzi API / UI |
| `BOOTSTRAP_EMAIL` / `BOOTSTRAP_PASSWORD` | Pierwszy admin (min. 12 znaków hasła); bootstrap zakłada też kartę w Zespole |
| `BOOTSTRAP_ORGANIZATION` | Nazwa organizacji (domyślnie „Moja organizacja”) |
| `BOOTSTRAP_FIRST_NAME` / `BOOTSTRAP_LAST_NAME` | Imię i nazwisko na karcie admina (domyślnie Administrator / System) |

## Status

To nadal **pilot**, nie gotowa produkcyjna dokumentacja HR. Do produkcji potrzeba m.in. domknięcia raportów, przeglądu prawnego i bezpieczeństwa (patrz `docs/`).
