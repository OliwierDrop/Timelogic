# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
React, TypeScript, Vite, FastAPI, PostgreSQL — wybór użytkownika.

## Users
Pracownik rejestruje czas i składa wnioski; kierownik planuje pracę i zatwierdza zmiany; HR prowadzi ewidencję; administrator zarządza dostępem.

## Product Purpose
Samodzielnie hostowany system do zarządzania pracownikami i ewidencji czasu pracy polskiej firmy. Pierwszy działający zakres to konta, pracownicy i RCP.

## Capabilities and Constraints
Jedna organizacja w pierwszej wersji, model przygotowany na wiele. Strefa Europe/Warsaw. Autoryzowane konto testowe inEwi zostało zbadane w UI oraz pasywnie przez REA z lokalnym Chromium/CDP.

## Evidence on Hand
Publiczna dokumentacja oraz rejestr obserwacji konta testowego w [docs/analysis.md](docs/analysis.md). Luki dotyczą operacji zapisu, innych ról i pełnej statycznej analizy bundle.

## Product Principles
- Szybkie codzienne operacje i czytelne dane.
- Niezależna implementacja, bez kopiowania zasobów inEwi.
- Każda zmiana czasu i uprawnień pozostawia ślad.
- Produkcyjna ewidencja wymaga osobnego przeglądu prawnego.

## Accessibility & Inclusion
Cel WCAG 2.2 AA, obsługa desktopu, tabletu i telefonu, tryb jasny i ciemny.
