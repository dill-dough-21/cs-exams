# Jak kontrybuować

Zachęcamy wszystkich studentów do współpracy! Aby zachować porządek w repozytorium i dbać o poprawność pytań, prosimy o przestrzeganie poniższych wytycznych.

## 1. Dodawanie nowych pytań
Pytania są przechowywane w folderze `data/` jako pliki JSON. Możesz edytować istniejące pliki lub proponować nowe.

### Format JSON
Każde pytanie musi mieć dokładnie taką strukturę:
```json
{
  "question": "Treść pytania tutaj?",
  "options": [
    "Odpowiedź A",
    "Odpowiedź B",
    "Odpowiedź C",
    "Odpowiedź D"
  ],
  "correct": [0, 2] // Indeksy poprawnych odpowiedzi (liczone od 0)
}
```

### Krok po kroku
1.  **Zrób fork repozytorium** na GitHubie.
2.  **Utwórz branch** dla swoich zmian (np. `fix/poprawa-literowki` lub `feat/nowe-pytania-kcm`).
3.  **Edytuj pliki JSON** w folderze `data/`.
    *   Jeśli dodajesz nowy plik, dodaj go do odpowiedniego semestru w `config.json`. Struktura pliku wygląda następująco:
        ```json
        {
          "semesters": [
            {
              "title": "Nazwa Semestru",
              "files": [
                {
                  "name": "Nazwa Przedmiotu",
                  "file": "data/nazwa_pliku.json",
                  "description": "Opis"
                }
              ]
            }
          ]
        }
        ```
4.  **Przetestuj swoje zmiany**, otwierając `index.html` w przeglądarce.
5.  **Zgłoś Pull Request (PR)**.

## 2. Zgłaszanie błędów
*   Jeśli znajdziesz błędną odpowiedź, otwórz Issue lub zgłoś PR z poprawką.
*   "Griefing" lub wandalizm (celowe psucie danych) skutkować będzie natychmiastowym banem/blokadą.

## 3. Zasady
*   Bądź uprzejmy.
*   Zamieszczaj tylko treści związane z egzaminami uniwersyteckimi.
