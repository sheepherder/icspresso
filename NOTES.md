# Entwickler-Notizen

## Installation zum Testen

### Option 1: Temporäre Installation

1. Öffne Firefox und navigiere zu `about:debugging#/runtime/this-firefox`
2. Klicke auf **"Temporäres Add-on laden..."**
3. Wähle die Datei `manifest.json` aus dem icspresso-Ordner
4. Die Extension ist jetzt aktiv (bis Firefox geschlossen wird)

**Hinweis:** Temporäre Add-ons werden bei jedem Firefox-Neustart entfernt.

### Option 2: Signierung über Mozilla Web-Oberfläche

#### Schritt 1: ZIP-Datei erstellen

```bash
cd /pfad/zu/icspresso
7z a icspresso.zip manifest.json background.js
```

#### Schritt 2: Add-on hochladen

1. Gehe zu https://addons.mozilla.org/developers/addon/submit/distribution
2. Wähle eine Verteilungsoption:
   - **"Auf dieser Seite"** - Öffentlich im Mozilla Add-on Store
   - **"Selbstständig"** - Nur für dich, nicht öffentlich gelistet
3. Lade die `icspresso.zip` hoch
4. Fülle die erforderlichen Informationen aus
5. Warte auf die automatische Signierung (meist 1-5 Minuten)

#### Schritt 3: Signiertes XPI herunterladen

1. Gehe zu https://addons.mozilla.org/developers/addons
2. Klicke auf **icspresso**
3. Gehe zu **"Versionen verwalten"** (linke Seitenleiste)
4. Klicke auf den Download-Link neben der Version
5. Speichere die `.xpi`-Datei

### Option 3: Self-Signing mit web-ext (Kommandozeile)

#### API-Schlüssel generieren

1. Gehe zu https://addons.mozilla.org/developers/addon/api/key/
2. Generiere einen neuen API-Schlüssel
3. Notiere **JWT issuer** und **JWT secret**

#### web-ext installieren und signieren

```bash
npm install -g web-ext

cd /pfad/zu/icspresso
web-ext sign --api-key=DEIN_JWT_ISSUER --api-secret=DEIN_JWT_SECRET

# Die signierte .xpi wird im Ordner web-ext-artifacts/ erstellt
```

## Nützliche Links

- **Mozilla Add-on Developer Hub:** https://addons.mozilla.org/developers/
- **Add-on hochladen:** https://addons.mozilla.org/developers/addon/submit/distribution
- **API-Schlüssel generieren:** https://addons.mozilla.org/developers/addon/api/key/
- **Temporäre Add-ons laden:** `about:debugging#/runtime/this-firefox`
- **Installierte Add-ons verwalten:** `about:addons`
