# Plan wdrożenia

| Etap | Cel i zależność | Baza/API/UI | Bezpieczeństwo i testy | Ukończenie i ryzyko |
| --- | --- | --- | --- | --- |
| 0 Analiza | Udokumentować referencję | Rejestr dowodów i mapa ekranów | Tylko konto testowe | Źródła i luki oznaczone; ryzyko braku CDP |
| 1 Fundamenty | Uruchomić system | Organizacja, konta, sesje, role, audyt; auth i shell | Sesje, CSRF, izolacja, migracje | Zaproszony użytkownik loguje się; ryzyko konfiguracji |
| 2 Pracownicy | Zarządzać personelem po 1 | Działy i karty; lista, profil, formularz | Testy zakresów i audytu | HR edytuje, pracownik widzi siebie; ryzyko historii zatrudnienia |
| 3 RCP | Rejestrować czas po 2 | Wpisy, przerwy, korekty; zegar i historia | Transakcje, idempotencja, północ, DST | Przepływ Start–Stop–korekta działa pilotażowo; ryzyko niekompletnych zdarzeń |
| 4 Grafiki | Planować i publikować po 2–3 | Przydziały z kind/flags i `replaces_id`; siatka, panel dnia, kreator; day-types i availability | Konflikty na warstwie aktywnej, role, DST | Pracownik widzi opublikowany plan; szkic nadpisuje po publikacji; ryzyko norm zmianowych |
| 5 Nieobecności | Obsługiwać wnioski po 4 | Typy, wnioski, salda; formularze i kalendarz | Decyzje, zakres i saldo | Pełny obieg wniosku; ryzyko naliczania urlopu |
| 6 Produkcyjna ewidencja | Raporty po 3–5 | Dodatkowe kategorie czasu, raporty i eksport | Uzgodnienie danych, restore, WCAG, E2E i przegląd prawny | Dopiero po akceptacji HR/prawnej i audycie bezpieczeństwa |
| 7 Rozbudowa | QR i integracje po 6 | Osobne migracje i kontrakty | Osobne modele zagrożeń | Każda funkcja oceniana oddzielnie |
| 8 Klient mobilny | Android/iOS po stabilnym API (po 3–6; auth mobile możliwy wcześniej) | Osobna appka (np. React Native / Flutter / natywna); **najpierw adres serwera** (`PUBLIC_ORIGIN` instalacji), potem login do konta na tej instancji; ten sam `/api/v1` | Auth pod native (Bearer/token obok cookie+CSRF dla weba), HTTPS, walidacja hosta, brak hardkodowanego origin | Model multi-instance (self-host): jedna appka → wiele serwerów firm; zakres MVP: RCP + mój grafik, potem wnioski/planowanie |

### Etap 8 — założenia (mobilny klient multi-instance)

- Instalacja TimeLogic zostaje self-hosted (Compose/API/DB per firma). Aplikacja mobilna **nie** wymaga centralnej chmury tenantów: użytkownik wpisuje URL serwera (np. `https://rcp.firma.pl`), appka sprawdza dostępność (`/health` lub lekki endpoint discovery) i dopiero wtedy pokazuje logowanie.
- Web nadal działa w modelu same-origin (cookie + CSRF). Mobile dostaje równoległy kontrakt sesji (np. token w `Authorization`), bez łamania istniejącego logowania przeglądarkowego.
- Base URL serwera jest konfigurowalny i zapamiętywany lokalnie na urządzeniu; zmiana serwera = wylogowanie / nowa sesja.
- Priorytet funkcji: Start/Stop/przerwy i podgląd opublikowanego grafiku; kreator zbiorczy i admin organizacji pozostają w webie na start.

CI: lint, typy, testy jednostkowe, integracyjne API na PostgreSQL, testy komponentów, Playwright i migracje. Dane demo nie są danymi produkcyjnymi.
