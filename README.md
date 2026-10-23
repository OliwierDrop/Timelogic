# TimeLogic

Polski system RCP (ewidencja czasu pracy): karty pracowników, zaproszenia do konta, rejestracja czasu, grafiki, wnioski i korekty. Monorepo Docker — FastAPI + React.

Dokumentacja projektowa: [`docs/`](docs/). Kontekst produktowy: [`PRODUCT.md`](PRODUCT.md).

## Stack

| Warstwa | Technologia |
| --- | --- |
| Web | React, React Router, TanStack Query, Vite, nginx |
| API | FastAPI, SQLAlchemy 2, Alembic, Pydantic |
| DB | PostgreSQL 18 |

## Szybki start (Docker)

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

Pierwszy admin: ustaw zmienne bootstrap w środowisku API (lub użyj lokalnego pliku wygenerowanego przy starcie — **nie commituj** `.local-admin.txt` / `.env`).

## Co jest w pilotażu

- **Zespół** — tworzenie pracowników (imię, nazwisko, e-mail, rola), tagi z kolorami i tagami informacyjnymi, stanowiska, statusy (zaproszony / aktywny / nieaktywny)
- **Zaproszenia** — mail z tokenem → `/set-password` (hasło 2×) → logowanie; ponowne wysłanie z menu ⋯
- **Akcje karty** — edycja, dezaktywacja, usunięcie (modale w aplikacji)
- **RCP** — wpisy czasu, przerwy, korekty
- **Grafiki / wnioski** — szkielety funkcjonalne w aplikacji
- **Raporty** — zakładka w nawigacji (placeholder)

## Struktura

```
apps/api/     FastAPI + migracje Alembic
apps/web/     SPA React
compose.yaml  db + api + web
docs/         wymagania, architektura, bezpieczeństwo
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
| `PUBLIC_ORIGIN` | Publiczny URL frontu (linki w mailach zaproszeń), domyślnie `http://localhost:8080` |
| `COOKIE_SECURE` | `false` lokalnie, `true` za HTTPS |
| `SMTP_*` | Opcjonalnie — bez SMTP link zaproszenia wraca w odpowiedzi API / UI |

## Status

To nadal **pilot**, nie gotowa produkcyjna dokumentacja HR. Do produkcji potrzeba m.in. domknięcia raportów, przeglądu prawnego i bezpieczeństwa (patrz `docs/`).
