# Model danych

Każda tabela domenowa zawiera `organization_id`. Członek zespołu (`employees`) ma powiązane konto (`users`) z e-mailem: logowanie, zaproszenie (konto bez hasła) i role żyją na `User`, a RCP/wnioski na `Employee`. Kolumna `employees.user_id` może być NULL tylko w danych legacy lub awaryjnych — API nie tworzy kart bez konta. Klucze obce, unikalności organizacyjne i kontrola w transakcji zapobiegają połączeniom między organizacjami.

| Etap | Encje i relacje |
| --- | --- |
| Fundamenty | `organizations` 1:N `users`, `employees`, `departments`; `users` 1:N `sessions`; `users` N:M `roles`; `audit_logs` wskazuje aktora i obiekt |
| RCP | `employees` 1:N `time_entries`; wpis 1:N `break_entries`; `attendance_corrections` wskazuje wpis, wnioskodawcę i decydenta |
| Grafiki | `shift_templates` 1:N `shift_assignments`; przydział wskazuje pracownika, zakres UTC i status publikacji |
| Wnioski | `leave_types` 1:N `leave_requests`; decyzje i zapis zmian limitu tworzą historię salda |

W bazie istnieje najwyżej jeden otwarty wpis pracy na pracownika i najwyżej jedna otwarta przerwa na wpis. Koniec nie może poprzedzać początku. Przydziały i wpisy nie mogą nakładać się w ramach pracownika. Korekty zachowują stan przed i po; audyt jest dopisywany, nie nadpisywany. Wersja wpisu chroni przed jednoczesnymi korektami.

`teams`, uniwersalne `approval_workflows`, `notifications` i pełna macierz `permissions` nie są potrzebne w pierwszym schemacie. Okresy zatrudnienia i parametry normy dodajemy przed obliczeniami produkcyjnymi.
