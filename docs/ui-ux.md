# Interfejs

Tryb Operate: priorytetem są szybkie czynności, czytelność tabel i jednoznaczny stan wpisu. Własna identyfikacja TimeLogic nie powiela wyglądu inEwi.

## Mapa ekranów

Pulpit pokazuje bieżący status i zadania do rozpatrzenia. Mój czas zawiera zegar, przerwy, historię i wnioski o korektę. Pracownicy zawierają listę, filtry i profil. Grafiki mają kalendarz z panelem dnia i publikacją. Wnioski mają listę, formularz, saldo i kolejkę decyzji. Raporty zawierają zakres dat, filtry i eksport. Administracja obejmuje działy, konta, role i audyt.

## Shell aplikacji

Układ Operate (wzorce z inEwi, własny wygląd TimeLogic):

1. **Górna nawigacja** — brand, moduły (role-gated), kompaktowy RCP (status + Start/Przerwa/Stop), konto.
2. **Lewy panel filtrów** — na listach i grafiku (okres, wyszukiwanie, status); na mobile jako drawer.
3. **Nagłówek modułu** — tytuł, okres/nawigacja tygodnia, akcje (Dodaj, Publikuj).
4. **Create/edit wyłącznie w modalu** — bez formularzy wklejonych pod listą; klik w komórkę kalendarza otwiera modal zmiany.

Na telefonie RCP i najważniejsze akcje zostają w zasięgu; pozostałe moduły w menu. Wszystkie ekrany definiują stany: ładowanie, pusto, błąd, sukces, konflikt i brak uprawnienia.

## Wnioski z obserwacji konta testowego

Rejestr dowodów jest w [analysis.md](analysis.md). Na ekranach inEwi powtarza się układ: górna nawigacja z zegarem RCP, zwijany panel filtrów po lewej, nagłówek modułu z okresem i akcjami, zakładki oraz tabela lub kalendarz. Raport ewidencji ma wiele grup kolumn i przewijanie poziome. W TimeLogic zachowamy szybki dostęp do RCP oraz spójność filtrów, ale przyjmiemy własny wygląd i prostsze domyślne widoki.

Na małych ekranach filtr powinien otwierać się w panelu, a główne akcje Start/Przerwa/Stop oraz historia dnia pozostać bezpośrednio dostępne. Szerokie raporty potrzebują zamrożonej kolumny pracownika, grupowania kolumn i alternatywnej karty szczegółów dnia. Operacje obejmujące wiele osób lub dni pokażą podsumowanie przed zapisem. Statusy będą miały tekstową etykietę i kolor, aby wynik nie zależał wyłącznie od barwy.

Zrzut ustawień RCP wykonany przez REA (dowód R05 w `analysis.md`) pokazuje granatową typografię, niebieski kolor akcji, jasnoszare grupy ustawień, biały pasek górny i boczną nawigację. Formularz ma ograniczoną szerokość, dzięki czemu długie etykiety i przełączniki można skanować w pionie. Własny ekran TimeLogic zastosuje ten sam priorytet czytelności: krótkie sekcje, jawne jednostki przy liczbach, opis skutku ustawienia i wyraźny stan włączony/wyłączony. Kolory i komponenty pozostaną własne.

## System komponentów

Tokeny: neutralne powierzchnie, semantyczne kolory statusów, typografia, odstępy, promienie, obramowania, focus ring oraz warianty light/dark. Wspólne komponenty: tabela danych, formularz z błędami przy polach, modal potwierdzenia, karta pracownika, zegar RCP, oś czasu, kalendarz, panel szczegółów, badge statusu i powiadomienie. Status nigdy nie zależy wyłącznie od koloru. Interakcje muszą działać klawiaturą i na ekranie dotykowym.
