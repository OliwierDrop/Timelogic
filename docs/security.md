# Bezpieczeństwo i dane osobowe

Sesje serwerowe z losowym identyfikatorem zapisanym w bazie jako hash; ciasteczko `HttpOnly`, `Secure` w produkcji i `SameSite=Lax`. Hasła Argon2id. Rotacja i unieważnianie sesji, ograniczenie prób logowania, tokeny zaproszeń i resetu jednorazowe oraz krótkotrwałe. Zapisy wymagają tokenu CSRF. Sekrety pochodzą ze zmiennych środowiskowych, bez wartości produkcyjnych w repozytorium.

Każdy endpoint filtruje `organization_id` i stosuje RBAC oraz zakres działów. ORM używa zapytań parametryzowanych. Frontend nie renderuje niezaufanego HTML; CSP i nagłówki bezpieczeństwa ograniczają XSS. Audyt zapisuje aktora, czas, typ działania i identyfikator obiektu; nie przechowuje haseł ani sekretów.

Kopie PostgreSQL są szyfrowane, ograniczone uprawnieniami i sprawdzane przez próbne odtworzenie. Retencja jest określana według kategorii danych i podstawy prawnej; nie należy usuwać dokumentacji pracowniczej według jednego globalnego okresu. Przed uruchomieniem produkcyjnym specjalista HR/prawnik weryfikuje ewidencję, urlopy, nadgodziny i retencję, a zespół bezpieczeństwa ocenia dostęp, backup i konfigurację TLS. Podstawa do przeglądu: https://www.gov.pl/web/rodzina/akta-osobowe oraz https://api.sejm.gov.pl/eli/acts/DU/2026/474/text.pdf.
