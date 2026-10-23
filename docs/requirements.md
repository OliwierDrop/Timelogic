# Wymagania

## Użytkownicy i granica wydań

- Pracownik: własne konto, historia czasu, rejestracja Start/Stop i przerw, korekty, grafik i wnioski.
- Kierownik: pracownicy przypisanych działów, grafiki i decyzje w swoim zakresie.
- HR: pracownicy całej organizacji, ewidencja, korekty, nieobecności i raporty.
- Administrator: konfiguracja organizacji, kont i ról oraz audyt.

Pierwszy kamień milowy obejmuje konta, pracowników i RCP jako pilotaż. Produkcyjna ewidencja wymaga dodatkowo grafików, nieobecności, raportów, zatwierdzonych reguł prawnych i audytu bezpieczeństwa.

## Wymagania funkcjonalne

1. Zaproszenie użytkownika, logowanie, wylogowanie i reset hasła.
2. Zarządzanie działami oraz kartami pracowników bez obowiązkowego konta użytkownika.
3. Rejestracja jednego otwartego okresu pracy i jednej aktywnej przerwy na pracownika; historia oraz korekty z decyzją i audytem.
4. Planowanie, sprawdzanie konfliktów i publikowanie zmian; pracownik widzi tylko opublikowane zmiany.
5. Wniosek o nieobecność, decyzja uprawnionej osoby, saldo i kalendarz.
6. Raport czasu i absencji z filtrowaniem oraz eksportem CSV, XLSX i PDF.

## Wymagania niefunkcjonalne

Interfejs po polsku, strefa Europe/Warsaw, responsywność, light/dark mode i cel WCAG 2.2 AA. PostgreSQL jest źródłem prawdy; API jest wersjonowane i opisane OpenAPI. Każdy zapis ma walidację, kontrolę zakresu organizacji i ślad audytowy. System jest hostowany samodzielnie przez Docker Compose. Produkcyjne użycie wymaga polityk kopii, retencji i procedur odtwarzania.
