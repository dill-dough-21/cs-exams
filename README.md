# Jak kontrybuować

Zachęcamy wszystkich studentów do współpracy! To projekt społecznościowy, ale żeby zachować porządek i uczyć się dobrych praktyk, wprowadzamy zasadę **Code First**.

## Ważne: No Issues Policy

**Nie przyjmujemy zgłoszeń błędów w formie "tekstowej" przez zakładkę Issues.**
Jeśli widzisz błąd w pytaniu lub odpowiedzi:

1. Nie pisz: "W pytaniu X jest błąd".
2. **Popraw go** w pliku JSON i wyślij **Pull Request (PR)**.

Zakładka *Issues* służy wyłącznie do dyskusji nad architekturą aplikacji lub propozycjami dużych, nowych funkcjonalności. Literówki i błędy w danych naprawiamy kodem.

---

## 1. Jak dodać lub poprawić pytania (Krok po kroku)

1. **Zrób Fork repozytorium** (kliknij przycisk "Fork" w prawym górnym rogu).
2. **Sklonuj swój fork** na komputer.
3. **Utwórz Branch** dla swoich zmian. Nazywaj branche opisowo:
    - `fix/poprawa-odpowiedzi-kcm`
    - `feat/nowe-pytania-si`
4. **Edytuj pliki** (szczegóły formatu poniżej).
5. **Przetestuj zmiany**: Otwórz plik `index.html` w przeglądarce i sprawdź, czy quiz działa i nie wyrzuca błędów w konsoli.
6. **Wyślij Pull Request** do głównego repozytorium (do brancha `main`).

## 2. Format danych (JSON)

Pytania znajdują się w folderze `data/`. Każde pytanie musi zachować **poprawny format JSON**.

### Struktura pojedynczego pytania

```json
{
  "question": "Treść pytania?",
  "options": [
    "Odpowiedź A",
    "Odpowiedź B",
    "Odpowiedź C",
    "Odpowiedź D"
  ],
  "correct": [0, 2]
}
```

- **correct**: Tablica z indeksami poprawnych odpowiedzi (liczone od 0).
- **Uwaga na przecinki!** Pamiętaj, że ostatni element w tablicy lub obiekcie JSON nie może mieć przecinka na końcu.

### Dodawanie nowego przedmiotu/pliku

Jeśli tworzysz zupełnie nowy plik (np. `data/nowy_przedmiot.json`), musisz go zarejestrować w pliku `config.json`.

```json
{
  "name": "Nazwa Przedmiotu",
  "file": "data/nowy_przedmiot.json",
  "description": "Krótki opis, np. rok 2026"
}
```

## 3. Zasady akceptacji PR

Twój Pull Request zostanie zaakceptowany, jeśli:

- Format JSON jest poprawny (zwaliduj go przed wysłaniem, np. na [jsonlint.com](https://jsonlint.com)).
- Dotyczy materiału z egzaminów uniwersyteckich.
- **Uzasadnisz zmianę**: Jeśli poprawiasz odpowiedź, napisz w opisie PR dlaczego Twoja wersja jest poprawna (link, cytat, wyjaśnienie). Zmiany bez uzasadnienia mogą być odrzucane.
- Nie zawiera treści obraźliwych ani spamu.

> "Griefing" lub celowe wprowadzanie błędnych danych skutkować będzie blokadą możliwości kontrybucji.

## 4. Ranking, aktywne sesje i anty-bot

Backend działa jako Vercel Serverless Functions w folderze `api/`.
Dane rankingu, sesji i rate limitu są trzymane w Supabase.

### Supabase

1. Utwórz projekt Supabase.
2. W panelu SQL Editor uruchom [supabase/schema.sql](supabase/schema.sql).
3. W Vercel dodaj zmienne środowiskowe:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RATE_LIMIT_SALT
```

`SUPABASE_SERVICE_ROLE_KEY` wolno trzymać tylko w Vercel Environment Variables. Nigdy w JS frontendu.

### Cloudflare Turnstile

W Cloudflare Turnstile dodaj domenę aplikacji, a potem:

1. Sekret dodaj w Vercel:

```text
TURNSTILE_SECRET_KEY
```

2. Publiczny site key wpisz w [index.html](index.html):

```html
<meta name="turnstile-site-key" content="PUBLICZNY_SITE_KEY">
```

Jeśli `TURNSTILE_SECRET_KEY` nie jest ustawiony, backend nie wymaga Turnstile. To ułatwia lokalne testy.

### Punktacja

Backend sam liczy wynik w `api/_lib/scoring.js`:

- pełna poprawna odpowiedź na pytanie: `100 pkt`,
- brak częściowych punktów w pytaniach wielokrotnego wyboru,
- bonus szybkości: maksymalnie `20%` punktów bazowych, tylko od `60%` poprawnych odpowiedzi,
- bonus perfekcyjny: `10 pkt * liczba pytań`, gdy wynik to `100%`,
- wynik nierealny czasowo jest odrzucany.

Przykład dla 10 pytań:

```text
10/10 wolno: 1000 + 100 bonus perfekcyjny = 1100 pkt
10/10 szybko: 1000 + bonus szybkości + 100 bonus perfekcyjny
7/10: 700 + ewentualny bonus szybkości
```

Ranking ogólny to suma najlepszych wyników gracza ze wszystkich quizów.
