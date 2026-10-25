# Analiza referencji inEwi

Stan: 2026-10-25 (uzupełnienie kalendarza). Zakres: autoryzowane konto testowe administratora. Analiza odczytowa: ekrany, filtry, menu i niedokończone formularze. Nie uruchomiono RCP ani niczego nie zapisano w iNewi. Dane osobowe konta nie są utrwalane. TimeLogic ma własny kod, API i model danych. Specyfikacja TimeLogic: [calendar-spec.md](calendar-spec.md).

## Rejestr dowodów

Klasy: **O** — zaobserwowane w koncie testowym, **P** — opisane publicznie, **W** — wniosek, **T** — propozycja dla TimeLogic. Wysoka pewność dotyczy widocznego elementu, nie skutku zapisu. Wszystkie obserwacje wykonano 2026-10-23; linki do widoków wymagają zalogowania.

| ID | Obszar | Ustalenie | Klasa | Pewność | Źródło |
| --- | --- | --- | --- | --- | --- |
| O01 | Nawigacja | Moduły: Zespół, Kalendarz, Wnioski, RCP, Raporty; zegar RCP jest stale w górnym pasku. | O | Wysoka | [Pulpit](https://inewi.pl/app) |
| O02 | Pulpit | Zadania, limity urlopowe i statystyki osobiste: plan, nieobecność, praca nocna, nadgodziny, czas poza planem i czas przepracowany. | O | Wysoka | [Pulpit](https://inewi.pl/app) |
| O03 | Zespół | Lista ma wyszukiwanie, filtry stanu konta, roli, tagu i stanowiska; zakładki Zespół, Dokumenty, Benefity. | O | Wysoka | [Zespół](https://inewi.pl/app/zespol/_zespol) |
| O04 | Kalendarz | Widoki Wszystko, Grafik pracy, Dostępność, Wnioski. Filtry obejmują okres, ostrzeżenia, typ zmiany, status publikacji, typ wniosku, osobę, rolę i tag. Jest akcja publikacji. | O | Wysoka | [Kalendarz](https://inewi.pl/app/kalendarz/_wszystko) |
| O05 | Wnioski | Zakładki Zgrupowane, Pojedyncze, Do rozpatrzenia, Użycie i limity; filtry daty, statusu, typu, załączników i osób. | O | Wysoka | [Wnioski](https://inewi.pl/app/wnioski/_zgrupowane) |
| O06 | Formularz wniosku | Kreator: pracownicy, kategoria (urlop, dowolny, kadrowy, RCP, zamiana grafiku, delegacja), dalej pola zależne od kategorii. Dla urlopu widoczne są nowy/edytuj/usuń i typ. | O | Wysoka dla pól | [Wnioski](https://inewi.pl/app/wnioski/_zgrupowane) |
| O07 | Menu RCP | Zdarzenia, Statusy pracy, Lokalizacje, Urządzenia, Tryb kiosku. | O | Wysoka | [Zdarzenia](https://inewi.pl/app/zdarzenia/_wszystkie) |
| O08 | Zdarzenia | Zakładki Wszystko, Foto-rejestracja, Edytowane, Do rozpatrzenia, Usunięte. Filtry daty, statusu/przerwy, kanału wysyłki, offline, lokalizacji, osoby, roli i tagu. | O | Wysoka | [Zdarzenia](https://inewi.pl/app/zdarzenia/_wszystkie) |
| O09 | Formularz zdarzenia | Dwa kroki: pracownicy, potem dni tygodnia, data/zakres, pomijanie świąt, typ i godzina. Typy pokazują Start, Stop, początek/koniec przerwy płatnej i bezpłatnej. Zapis był nieaktywny przy pustych polach. | O | Wysoka dla pól | [Zdarzenia](https://inewi.pl/app/zdarzenia/_wszystkie) |
| O10 | Statusy pracy | Na tym koncie aktywne Przerwa i Przerwa bezpłatna; są filtry przypisania, statusu zatrzymującego czas i stany aktywny/archiwalny/usunięty. | O | Wysoka | [Statusy](https://inewi.pl/app/statusy-pracy/_aktywne) |
| O11 | Raporty | Widoki Lista obecności, Ewidencja czasu pracy, Kadrowy. Wspólne filtry: okres, osoby, statusy, ostrzeżenia/błędy, nieopublikowane grafiki i wnioski. | O | Wysoka | [Raporty](https://inewi.pl/app/raporty/_lista-obecnosci) |
| O12 | Ewidencja | Szeroka tabela grupuje statusy dni, grafiki, sumy czasu, dodatki zmianowe, nieobecności, składniki wynagrodzenia i typy wniosków; zawiera kolumny nadgodzin 50%/100%, nocy, dyżuru i przerw. | O | Wysoka dla kolumn | [Ewidencja](https://inewi.pl/app/raporty/_ewidencja-czasu-pracy) |
| O13 | Eksport | Menu oferuje CSV, XLSX i PDF osobno dla Raportu pracy i Ewidencji czasu pracy. Nie pobierano pliku, więc jego zawartość nie jest potwierdzona. | O | Wysoka dla opcji | [Ewidencja](https://inewi.pl/app/raporty/_ewidencja-czasu-pracy) |
| O14 | Organizacja | Ustawienia obejmują strefę czasową, początek tygodnia, walutę, święta, RCP, grafik, wnioski, automatyzację i powiadomienia. | O | Wysoka | [Organizacja](https://inewi.pl/app/ustawienia/organizacja) |
| O15 | Ustawienia RCP | Widoczne są okres rozliczeniowy, limity nadgodzin, przerwy płatne/bezpłatne, tryb offline, lokalizacja, zdjęcia, czas nocny i definicja niedzieli/święta. Samo istnienie opcji nie potwierdza ich działania. | O | Wysoka dla widoczności | [RCP](https://inewi.pl/app/ustawienia/organizacja/rejestracja-czasu-pracy) |
| O16 | Ustawienia wniosków | Typy urlopowe, kadrowe i dowolne mają naliczanie dzienne, godzinowe lub elastyczne. Widać opcje ukrywania szczegółów, dwuetapowej akceptacji, korekt RCP i zamiany grafików. | O | Wysoka dla widoczności | [Wnioski](https://inewi.pl/app/ustawienia/organizacja/wnioski) |
| O17 | Lokalizacje | Lista lokalizacji ma pola nazwy, miasta, adresu i tolerancji; na koncie jest pozycja domyślna z tolerancją 500 m. | O | Wysoka | [Lokalizacje](https://inewi.pl/app/lokalizacje) |
| O18 | Urządzenia | Lista urządzeń była pusta; dostępne filtry statusu online/offline i systemu iOS/Android. | O | Wysoka | [Urządzenia](https://inewi.pl/app/urzadzenia) |
| O19 | Panel dnia | Klik komórki otwiera prawy panel: pracownik, dostępność, typ dnia, norma godzinowa, grafiki, wnioski, historia, limity. | O | Wysoka | [Kalendarz](https://inewi.pl/app/kalendarz/_wszystko) 2026-10-25 |
| O20 | Typy dnia | Widoczne kody: P (pracujący), ND (za niedzielę), ŚW (za święto), 5TP (pięciodniowy tydzień pracy), HW (harmonogramowo wolne). 5TP/ND nie są tożsame z sobotą/niedzielą kalendarzową. | O | Wysoka | Kalendarz 2026-10-25 |
| O21 | Formularz grafiku | Pojedynczy grafik: dzień i pracownik przypisane; typy Normowany / Elastyczny / Dyżur; opcjonalna notatka. | O | Wysoka dla pól | Modal „Dodaj grafik pracy” 2026-10-25 |
| O22 | Normowany | Godziny od–do, kolor, liczenie pracy przed/po, przerwa automatyczna, pilnowanie mienia, prace wzbronione młodocianym. | O | Wysoka dla pól | j.w. |
| O23 | Elastyczny | Opcjonalny czas trwania oraz opcjonalne okno rozpoczęcia — inny układ niż normowany. | O | Wysoka dla pól | j.w. |
| O24 | Dyżur | Opcjonalne godziny i rodzaj dyżuru; widoczna domyślna wartość „Zdalny”. | O | Wysoka dla pól | j.w. |
| O25 | Przerwa auto | Po włączeniu: długość przerwy i przełącznik „Jako przerwa bezpłatna”. | O | Wysoka dla pól | j.w. |
| O26 | Kreator zbiorczy | Trzy kroki: pracownicy → parametry grafiku → dni tygodnia i zakres dat; domyślnie pn–pt; opcje pomijania świąt i nadpisania istniejących. | O | Wysoka dla pól | „Kreator grafików pracy” 2026-10-25 |
| O27 | Walidacja UI | Normowany bez godzin: komunikat „Czas wymagany” przy przejściu dalej. | O | Wysoka | Kreator 2026-10-25 |
| O28 | Wniosek z dnia | Formularz z wybranym pracownikiem i datą komórki; opcje weekendów/świąt, autoakceptacji, przełożonego, załączników, notatki. | O | Wysoka dla pól | Kalendarz 2026-10-25 |
| O29 | Menu Akcje | Odrzucenie nieopublikowanych, usuwanie grafików, kopiowanie do innej osoby, reset dostępności i dni wolnych. | O | Wysoka dla opcji | Kalendarz 2026-10-25 |
| O30 | Import | Modal przyjmuje .xlsx, szablon i kolejny krok po wyborze pliku. Importu nie wykonano. | O | Wysoka dla UI | Kalendarz 2026-10-25 |
| P01 | Role | Dokumentacja opisuje role i zakres dostępu. | P | Wysoka | [Pomoc: role](https://pomoc.inewi.pl/pl/article/role-inaczej-uprawnienia-1876rty/) |
| P02 | RCP | Dokumentacja opisuje Start, Stop i przerwy. | P | Wysoka | [Pomoc: moduły](https://pomoc.inewi.pl/pl/article/oferowane-moduly-aplikacji-gdlwjj/) |
| P03 | Grafiki | Dokumentacja: przygotowanie, publikacja, hover ze skrótami, odrzucenie szkiców przywraca ostatnią opublikowaną, kopiowanie/przenoszenie przeciąganiem. | P | Wysoka | [Pomoc: kalendarz](https://pomoc.inewi.pl/pl/article/modul-grafiki-pracy-kalendarz-p630i3/) |
| P04 | Wnioski | Dokumentacja opisuje składanie i rozpatrywanie wniosków. | P | Wysoka | [Pomoc: wnioski](https://pomoc.inewi.pl/pl/article/modul-wnioski-r2tzsc/) |
| P05 | Raport | Dokumentacja opisuje raport ewidencji. | P | Wysoka | [Pomoc: raport](https://pomoc.inewi.pl/pl/article/raport-ewidencji-czasu-pracysumaryczny-pracy-modul-rcp-nn326b/) |
| P06 | Dostępność | Osobna deklaracja: cały dzień, wybrane godziny lub niedostępność. | P | Wysoka | Pomoc: dostępność |
| P07 | Typy dni | Oznaczenia dni wolnych mogą być sugestiami automatyzacji; 5TP ≠ sobota, ND ≠ musi być niedziela. | P | Wysoka | Pomoc: typy dni |
| W01 | Model | Widoczne statusy i raporty sugerują oddzielenie zdarzeń RCP od obliczonej ewidencji, ale nie dowodzą modelu danych inEwi. | W | Średnia | O08, O10, O12 |
| T01 | TimeLogic | Własny strumień zdarzeń z audytem i osobna wyliczana ewidencja dnia ze statusem kompletności. | T | Decyzja projektowa | [Projekt bazy](database-design.md) |
| T02 | TimeLogic kalendarz | Siatka pracownik×dzień, szkic nadpisujący opublikowany (`replaces_id`), typy grafiku, panel dnia; bez importu xlsx i drag w pierwszej dostawie. | T | Decyzja projektowa | [Specyfikacja kalendarza](calendar-spec.md) |

## Wzorce interfejsu

- Górny pasek utrzymuje główne moduły i RCP w zasięgu; boczny panel filtrów służy ekranom danych.
- Tworzenie rekordów nie odbywa się formularzem na dole listy: przycisk „Dodaj” otwiera menu lub nakładkę/kreator (np. trasa `…/dodaj-zdarzenia` z nagłówkiem „Dodaj zdarzenia”). TimeLogic mapuje to na modal/overlay.
- Kalendarz grafiku: nagłówek z okresem i akcjami (Publikuj, Akcje, Dodaj), zakładki widoku, siatka pracownik × dzień, lewy panel filtrów (zakres dat, typy grafiku, pracownicy, role, tagi).
- Listy mają zakładki stanu, licznik zaznaczeń, akcje kontekstowe i puste stany. W TimeLogic zachować przepływ filtr → wybór → działanie, z własnym stylem wizualnym.
- Ewidencja ma wiele grup kolumn i poziome przewijanie. W TimeLogic domyślnie pokazać najważniejsze sumy i pozwolić rozwinąć szczegóły oraz skonfigurować kolumny.
- Formularze najpierw ustalają zakres pracowników, potem parametry. Dla masowych operacji TimeLogic powinien przed zapisem pokazać liczbę wynikowych rekordów.
- Nie kopiować logo, ikon, tekstów ani zasobów inEwi. Opcji konfiguracji nie traktować jako domyślnych reguł prawa pracy.

## Ograniczenia i dalsze dowody

Nie sprawdzono skutków zapisu, edycji istniejących zmian, konfliktów, publikacji, historii, przeciągania ani działania innych ról. Nie potwierdzono modelu bazy, kontraktów sieciowych i prywatnego API. Analiza dostępności i responsywności nie jest pełna.

REA 6.7.0 jest zarejestrowane w Codexie, lecz narzędzia MCP nie zostały załadowane w bieżącej sesji, więc użyto CLI. Za zgodą użytkownika pobrano Chromium for Testing 156.0.8078.4 do katalogu użytkownika i uruchomiono oddzielny profil z CDP dostępnym tylko na `127.0.0.1:9222`. Sesja wymagała osobnego logowania przez użytkownika. Nie kopiowano ciasteczek ani hasła z innej przeglądarki.

### Uzupełnienie REA z 2026-10-23

| ID | Dowód REA | Wynik i ograniczenie |
| --- | --- | --- |
| R01 | `list-browser-targets`, `ev_2ea9cc537052bbd4c7d09b412e66c546ae31f85a0217c600e81a6084f2af09d7` | REA wykrył kartę inEwi w Chromium przez CDP. |
| R02 | `inspect-web-page`, `ev_0472ce8f04604e91089c5505fd71fbd8b4e59ab84fe9a1f12074e664e14ce15b` | Pasywny odczyt zalogowanego pulpitu potwierdził drzewo dostępności z 232 węzłami i nazwami głównych modułów. Przechwytywanie zaczęło się po zalogowaniu, więc nie obejmuje wcześniejszych żądań. |
| R03 | `capture-browser-scenario`, `ev_3614558fa0b303ec25e83139d34879069d7230aaff305b9bd8ea0520b3ec68f8` | REA wykonał wyłącznie nawigację do Zespołu, Kalendarza, Wniosków, Zdarzeń, Raportów i ustawień RCP. Wszystkie kroki zakończyły się poprawnie. Zatrzymano 392 zdarzenia obserwacyjne, w tym 132 żądania, 128 odpowiedzi i 5 nieudanych żądań. Cztery żądania nie skończyły się w oknie przechwytywania. Liczby nie określają semantyki prywatnego API. |
| R04 | `inspect-web-page`, `ev_be603166dfe51e51355b1f6d980bf4e388c57e408fb85d6b309674f93d6d7019` | Pasywny odczyt ustawień RCP potwierdził 564 węzły dostępności i widoczne etykiety konfiguracji; część wartości pól była redagowana przez narzędzie. |
| R05 | `capture-web-screenshot`, `ev_39a95d405659cfaa6e8ff83fcd0c1280332fee3260a4b83b518227d3aa1f6584` | REA przechwycił obraz bieżącego widoku ustawień RCP przy obszarze 918 × 877 px; obrazu nie zapisano w repozytorium, ponieważ zawiera widok konta. |
| R06 | `analyze-web-bundle` | Próba pełnej analizy pakietu JavaScript zakończyła się błędem `JavaScript heap out of memory` przy limicie około 4 GB. Brak wyniku o strukturze kodu; nie zwiększano limitu pamięci ani nie powtarzano ciężkiej analizy. |
| R07 | `capture-browser-scenario`, `ev_348f42e01f6ac6ad2cea8b93ed411f7b9d0bab59e741b04f505021e006aa0cae` | Powtórzono nawigację z krótkim oczekiwaniem po każdym widoku. REA przechwycił tekst dostępności dla Zespołu, Kalendarza, Wniosków, Zdarzeń, Raportów i ustawień RCP (od 3,3 do 6,6 kB na ekran). Wszystkie kroki zakończyły się poprawnie, bez zdarzenia błędu strony w tym oknie. Nie wykonywano zapisów. |
| R08 | `inspect-web-page`, `ev_bcef5f30253913975457ee15f3c1063a5b6ff90ab9e3e6dd4c874e11e80ae392` | Kalendarz (`/kalendarz/_wszystko`): górne linki Zespół/Kalendarz/Wnioski/Raporty, przycisk RCP „Wirtualne RCP - Czas pracy - start”, zakładki Wszystko/Grafik pracy/Dostępność, akcje Publikuj/Akcje/Importuj/Dodaj, panel filtrów (Zakres dat, Grafiki pracy, Pracownicy, Role, Tagi). |
| R09 | `inspect-web-page`, `ev_fadf80c94c15240c45435fd50eea92120dc0896ebe76cd9a262aba0f6c1bd918` | Widok Grafik pracy (`/kalendarz/_grafiki/…`): ten sam shell; filtry „Tylko nieopublikowane grafiki”, typy normowany/elastyczny. |
| R10 | CDP DOM + nawigacja | Przycisk Dodaj ma `data-testid=add-dropdown-button` (menu). Dodawanie zdarzeń otwiera nakładkę trasą `…/dodaj-zdarzenia` z nagłówkiem „Dodaj zdarzenia” — nie formularz pod listą. Bez zapisu. |

Narzędzia REA nie odtwarzają wcześniejszego ruchu sieciowego. Scenariusz nie przechwytuje stosów inicjujących żądania, a kolejność zdarzeń nie dowodzi zależności przyczynowych. Nie używamy zaobserwowanych adresów prywatnych usług jako kontraktu TimeLogic.
