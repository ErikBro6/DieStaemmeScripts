# SpeckMichs Die Stämme Tool Collection

Eine **modulare Userscript-Sammlung für Die Stämme**, die verschiedene Spielseiten gezielt erweitert und automatisiert.
Alle Funktionen sind in einzelne Module aufgeteilt und können flexibel gesteuert werden.

---

## Modulverwaltung

Die enthaltenen Module lassen sich direkt **ingame über die DS-Tools-Settings** aktivieren oder deaktivieren:

<img width="107" height="49" alt="DS-Tools Menü" src="https://github.com/user-attachments/assets/dfd4b477-cf70-4079-bf9c-80da94cf16b8" />

Die Einstellungen sind persistent und gelten accountweit.

---

## Benachrichtigungen

Das Projekt unterstützt **Discord-Webhooks**, z. B. zum Senden von Benachrichtigungen bei bestimmten Spielereignissen (Inc-Reminder etc.).
Die Konfiguration erfolgt ebenfalls über die DS-Tools-Einstellungsseite.

---

## Installation

Direkter Installations-Link für Tampermonkey / Violentmonkey:

```
https://raw.githubusercontent.com/EmoteBot6/DieStaemmeScripts/master/main.user.js
```

Nach der Installation erscheint im Spielmenü der Eintrag **DS-Tools**.

---

## Development Setup

Beiträge sind ausdrücklich erwünscht.

### Schritte

1. Repository klonen
2. Neuen Branch erstellen
3. Lokalen HTTP-Server starten, z. B. mit Python:

```bash
python3 -m http.server 8123
```

4. Im Tampermonkey-Menü das Environment auf **dev** umstellen:

<img width="428" height="89" alt="Tampermonkey Dev Environment" src="https://github.com/user-attachments/assets/ec8b8ee0-e8a0-4d5f-9250-d90712479b3f" />

Danach werden die Module aus dem lokalen Manifest geladen.

---

## Mitmachen

Pull Requests und Issues jeder Art sind willkommen.
Der Code ist bewusst modular aufgebaut, um Erweiterungen einfach zu halten.
