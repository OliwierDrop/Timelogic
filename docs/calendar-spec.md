# Specyfikacja kalendarza TimeLogic

Własna semantyka TimeLogic inspirowana obserwacjami iNewi (O19–O30, P03, P06, P07). Nie kopiujemy UI ani zasobów referencji.

## Widok

- Siatka **pracownik × dzień**; zakres tydzień lub miesiąc (domyślnie miesiąc).
- Zakładki: **Wszystko** (domyślna), **Grafik pracy**, **Dostępność**, **Wnioski** — filtrują treść komórek, hover, filtry boczne i akcje nagłówka.
- Wszystko: tło dostępności + typ dnia + grafiki + wnioski; hover + Grafik / + Wniosek.
- Grafik pracy: tylko grafiki; hover + Grafik.
- Dostępność: tło dostępności (zielone / czerwone / bursztyn) + typ dnia; bez hover-akcji.
- Wnioski: chipy wniosków; hover + Wniosek; filtr typu wniosku.
- Lewy panel: zakres dat; szkice i rodzaj grafiku (Wszystko/Grafik); typ wniosku (Wszystko/Wnioski); tagi i stanowiska.
- Nagłówek: Publikuj / Akcje / Kreator / Dodaj zależnie od zakładki.
- Klik komórki: prawy **overlay** dnia (nie przesuwa siatki) — data + strzałki dnia + zamknięcie; pracownik (rola/tagi); dostępność; typ dnia; grafiki; wnioski; limity collapsible (scroll body dopiero po rozwinięciu długiej listy).

## Publikacja (model szkicu)

- Pracownik widzi wyłącznie przydziały opublikowane i nie supersedowane.
- Planner tworzy szkice (`published_at` puste). Edycja opublikowanego = nowy szkic z `replaces_id` wskazującym poprzednią wersję.
- Usunięcie opublikowanego = szkic z `replaces_id` i `flags.pending_delete`; publikacja superseduje oryginał i usuwa tombstone. Odrzucenie szkicu przywraca opublikowany.
- Usunięcie szkicu (w tym tombstone) = hard-delete.
- Publikacja zatwierdza szkice i ustawia `superseded_at` na zastąpionych wierszach.
- Odrzucenie szkiców usuwa je; ostatnia opublikowana wersja wraca do widoku.

## Typy grafiku

| Kod API | UI | Wymagane |
| --- | --- | --- |
| `standard` | Normowany | godziny od–do |
| `flexible` | Elastyczny | opcjonalny czas trwania / okno startu |
| `on_call` | Dyżur | opcjonalne godziny; rodzaj dyżuru (domyślnie zdalny) |

Wspólne: kolor, notatka, flagi (praca przed/po, przerwa auto + długość + bezpłatna, pilnowanie mienia, prace wzbronione).

## Typy dnia i dostępność

- Typ dnia na `(pracownik, data)`: `P`, `ND`, `SW`, `TP5`, `HW` (UI: ŚW, 5TP).
- **Domyślne typy dnia** (bez wpisu w DB): Pn–Pt = `P`, sobota = `TP5` (5TP), niedziela = `ND`. Nadpisanie zapisuje wiersz; reset typów wraca do tych domyślnych.
- Dostępność: cały dzień / godziny / niedostępność; **brak wpisu = dostępny**.
- Dostępność ustawia **tylko zalogowany pracownik dla siebie** (sugestia dla manager/HR/admin — tylko odczyt). Planiści nie edytują cudzej dostępności.

## Kreator i akcje

- Kreator 3 kroki: pracownicy → parametry → dni tygodnia + zakres + pomijaj święta + nadpisz.
- Akcje: odrzuć szkice, usuń grafiki, kopiuj do osoby, reset dostępności / typów dnia w zakresie.
- Poza tą wersją: import `.xlsx`, przeciąganie kopiuj/przenieś.
