# icspresso

Eine Firefox-WebExtension, die `.ics`-Kalenderdateien abfängt und direkt in Google Calendar öffnet.

## Was macht icspresso?

Wenn du auf einer Website auf einen Link zu einer Kalenderdatei klickst, passiert normalerweise Folgendes: Die Datei wird heruntergeladen und du musst sie manuell in deinen Kalender importieren.

**icspresso** vereinfacht diesen Prozess:

1. Erkennt automatisch anhand des Content-Type, wenn du eine Kalenderdatei öffnest
2. Liest die Eventdaten (Titel, Datum, Uhrzeit, Ort, Beschreibung)
3. Öffnet Google Calendar mit allen Daten vorausgefüllt
4. Du musst nur noch auf "Speichern" klicken

### Features

- **Automatische Erkennung** anhand des Content-Type (`text/calendar`, `application/ics`, etc.)
- **Zeitzonenkonvertierung** (Europe/Berlin, America/New_York, etc.)
- **Ganztägige Events** werden korrekt erkannt
- **Wiederkehrende Termine** werden als Text in der Beschreibung angezeigt
- **Teilnehmerlisten** werden in die Beschreibung übernommen
- **Quell-URL** der Seite wird in der Beschreibung gespeichert
- **Multi-Event-Dateien**: Bei mehreren Events werden mehrere Tabs geöffnet
- **Authentifizierte Downloads**: Funktioniert auch mit Login-geschützten Kalenderdateien

## Installation

1. Lade die `.xpi`-Datei von den [Releases](../../releases) herunter
2. Öffne Firefox und gehe zu `about:addons`
3. Klicke auf das Zahnrad-Symbol und wähle **"Add-on aus Datei installieren..."**
4. Wähle die heruntergeladene `.xpi`-Datei

## Berechtigungen

Die Extension benötigt folgende Berechtigungen:

| Berechtigung | Grund |
|--------------|-------|
| `webRequest` | Um den Content-Type von Anfragen zu prüfen |
| `webRequestBlocking` | Um die Antwort abzufangen und zu verarbeiten |
| `<all_urls>` | Um Kalenderdateien von beliebigen Websites zu laden |
| `notifications` | Um Fehlermeldungen anzuzeigen |

## Technische Details

- **Manifest Version:** 2 (für `webRequestBlocking` Support)
- **Firefox-spezifisch:** Nutzt `filterResponseData()` API
- **Keine externe Abhängigkeiten:** Reines JavaScript

## Unterstützte Content-Types

- `text/calendar` (iCalendar)
- `application/ics`
- `application/icalendar`
- `text/x-vcalendar` (vCalendar, Legacy)

## Bekannte Einschränkungen

- Nur Firefox (keine Chrome-Unterstützung)
- Wiederkehrende Termine werden nicht als echte Wiederholungen erstellt, sondern nur als Text in der Beschreibung
- Erinnerungen aus der ICS-Datei werden ignoriert (Google Calendar nutzt deine Standard-Einstellungen)
- Events ohne Endzeit (DTEND fehlt oder gleich DTSTART) werden als Null-Dauer-Event erstellt

## Lizenz

GPL-3.0 - siehe [LICENSE](LICENSE)
