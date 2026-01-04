# icspresso

Eine Firefox-WebExtension, die `.ics`-Kalenderdateien abfängt und direkt in Google Calendar öffnet.

## Was macht icspresso?

Wenn du auf einer Website auf einen Link zu einer Kalenderdatei (`.ics`, `.ical`, `.ifb`, `.vcs`) klickst, passiert normalerweise Folgendes: Die Datei wird heruntergeladen und du musst sie manuell in deinen Kalender importieren.

**icspresso** vereinfacht diesen Prozess:

1. Erkennt automatisch, wenn du eine Kalenderdatei öffnest
2. Liest die Eventdaten (Titel, Datum, Uhrzeit, Ort, Beschreibung)
3. Öffnet Google Calendar mit allen Daten vorausgefüllt
4. Du musst nur noch auf "Speichern" klicken

### Features

- **Automatische Erkennung** von `.ics`, `.ical`, `.ifb` und `.vcs` Dateien
- **Zeitzonenkonvertierung** (Europe/Berlin, America/New_York, etc.)
- **Ganztägige Events** werden korrekt erkannt
- **Wiederkehrende Termine** werden als Text in der Beschreibung angezeigt
- **Teilnehmerlisten** werden in die Beschreibung übernommen
- **Quell-URL** der Seite wird in der Beschreibung gespeichert
- **Multi-Event-Dateien**: Bei mehreren Events werden mehrere Tabs geöffnet
- **Authentifizierte Downloads**: Funktioniert auch mit Login-geschützten Kalenderdateien

## Installation

### Option 1: Temporäre Installation (zum Testen)

1. Öffne Firefox und navigiere zu `about:debugging#/runtime/this-firefox`
2. Klicke auf **"Temporäres Add-on laden..."**
3. Wähle die Datei `manifest.json` aus dem icspresso-Ordner
4. Die Extension ist jetzt aktiv (bis Firefox geschlossen wird)

**Hinweis:** Temporäre Add-ons werden bei jedem Firefox-Neustart entfernt.

### Option 2: Permanente Installation (signiertes Add-on)

Für eine permanente Installation muss das Add-on von Mozilla signiert werden.

#### Schritt 1: ZIP-Datei erstellen

```bash
cd /pfad/zu/icspresso
7z a icspresso.zip manifest.json background.js
# oder mit zip:
zip -r icspresso.zip manifest.json background.js
```

#### Schritt 2: Mozilla-Entwicklerkonto erstellen

1. Gehe zu https://addons.mozilla.org/developers/
2. Erstelle ein Konto oder melde dich an

#### Schritt 3: Add-on hochladen

1. Gehe zu https://addons.mozilla.org/developers/addon/submit/distribution
2. Wähle eine Verteilungsoption:
   - **"Auf dieser Seite"** - Öffentlich im Mozilla Add-on Store
   - **"Selbstständig"** - Nur für dich, nicht öffentlich gelistet
3. Lade die `icspresso.zip` hoch
4. Fülle die erforderlichen Informationen aus
5. Warte auf die automatische Signierung (meist 1-5 Minuten)

#### Schritt 4: Signiertes XPI herunterladen

1. Gehe zu https://addons.mozilla.org/developers/addons
2. Klicke auf **icspresso**
3. Gehe zu **"Versionen verwalten"** (linke Seitenleiste)
4. Klicke auf den Download-Link neben der Version
5. Speichere die `.xpi`-Datei

#### Schritt 5: XPI installieren

1. Öffne Firefox
2. Gehe zu `about:addons`
3. Klicke auf das Zahnrad-Symbol ⚙️
4. Wähle **"Add-on aus Datei installieren..."**
5. Wähle die heruntergeladene `.xpi`-Datei

### Option 3: Self-Signing mit web-ext (Kommandozeile)

Für automatisierte Builds oder wenn du die Web-Oberfläche nicht nutzen möchtest:

#### API-Schlüssel generieren

1. Gehe zu https://addons.mozilla.org/developers/addon/api/key/
2. Generiere einen neuen API-Schlüssel
3. Notiere **JWT issuer** und **JWT secret**

#### web-ext installieren und signieren

```bash
# web-ext installieren
npm install -g web-ext

# Add-on signieren
cd /pfad/zu/icspresso
web-ext sign --api-key=DEIN_JWT_ISSUER --api-secret=DEIN_JWT_SECRET

# Die signierte .xpi wird im Ordner web-ext-artifacts/ erstellt
```

## Berechtigungen

Die Extension benötigt folgende Berechtigungen:

| Berechtigung | Grund |
|--------------|-------|
| `webRequest` | Um Anfragen zu `.ics`-Dateien zu erkennen |
| `webRequestBlocking` | Um die Antwort abzufangen und zu verarbeiten |
| `<all_urls>` | Um Kalenderdateien von beliebigen Websites zu laden |
| `notifications` | Um Fehlermeldungen anzuzeigen |

## Technische Details

- **Manifest Version:** 2 (für `webRequestBlocking` Support)
- **Firefox-spezifisch:** Nutzt `filterResponseData()` API
- **Keine externe Abhängigkeiten:** Reines JavaScript

## Unterstützte Kalenderformate

- `.ics` (iCalendar)
- `.ical` (iCalendar alternative Endung)
- `.ifb` (Free/Busy)
- `.vcs` (vCalendar, Legacy)

## Bekannte Einschränkungen

- Nur Firefox (keine Chrome-Unterstützung)
- Wiederkehrende Termine werden nicht als echte Wiederholungen erstellt, sondern nur als Text in der Beschreibung
- Erinnerungen aus der ICS-Datei werden ignoriert (Google Calendar nutzt deine Standard-Einstellungen)

## Links

- **Mozilla Add-on Developer Hub:** https://addons.mozilla.org/developers/
- **Add-on hochladen:** https://addons.mozilla.org/developers/addon/submit/distribution
- **API-Schlüssel generieren:** https://addons.mozilla.org/developers/addon/api/key/
- **Temporäre Add-ons laden:** `about:debugging#/runtime/this-firefox`
- **Installierte Add-ons verwalten:** `about:addons`

## Lizenz

GPL-3.0 - siehe [LICENSE](LICENSE)
