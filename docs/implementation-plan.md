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

CI: lint, typy, testy jednostkowe, integracyjne API na PostgreSQL, testy komponentów, Playwright i migracje. Dane demo nie są danymi produkcyjnymi.
