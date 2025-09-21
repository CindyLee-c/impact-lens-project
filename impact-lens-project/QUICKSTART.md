# Impact-Lens Quick Start Guide

## 🚀 Snel aan de slag (5 minuten)

### Stap 1: Backend opstarten (lokaal)

```bash
cd impact-lens-project/backend

# Installeer Python dependencies
pip install -r requirements.txt

# Set je OpenAI API key
export OPENAI_API_KEY="sk-your-openai-api-key-here"
# Set je Gemini API key
export GEMINI_API_KEY="your-gemini-api-key-here"

# Start de server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ Test: Ga naar `http://localhost:8000` - je zou {"message": "Impact-Lens API"} moeten zien

### Stap 2: Chrome Extensie laden

1. **Open Chrome** en ga naar `chrome://extensions/`
2. **Enable "Developer mode"** (toggle rechtsboven)
3. **Klik "Load unpacked"**
4. **Selecteer** de `chrome-extension` folder
5. **Pin de extensie** (puzzle-icoon in Chrome toolbar)

✅ Test: Je ziet nu het Impact-Lens icoon in je toolbar

### Stap 3: Eerste analyse

1. **Ga naar een nieuwsartikel** (bijv. nu.nl, nrc.nl)
2. **Klik op het Impact-Lens icoon** in je toolbar
3. **Klik "Open analyse paneel"**
4. **Klik "Analyseer artikel"**

🎉 **Klaar!** Je ziet nu de analyse met hoofdclaim, kritische vragen en impact punten.

## 🛠 Troubleshooting

### Backend start niet?
```bash
# Check Python versie (moet 3.11+ zijn)
python --version

# Installeer dependencies opnieuw
pip install --upgrade -r requirements.txt
```

### Extensie werkt niet?
- Check of alle bestanden aanwezig zijn in `chrome-extension/`
- Refresh de extensie pagina: `chrome://extensions/`
- Check de browser console voor errors (F12)

### API errors?
- Verify je OpenAI API key is geldig en heeft credits
- Verify je Gemini API key is geldig
- Check of de backend draait op poort 8000
- Test de API direct: `curl http://localhost:8000/health`

## 🚀 Deploy naar Google Cloud (optioneel)

```bash
# Set Google Cloud project
gcloud config set project YOUR_PROJECT_ID

# Deploy backend
cd backend
gcloud builds submit --config cloudbuild.yaml \
  --substitutions _OPENAI_API_KEY="your-openai-api-key"
  --substitutions _GEMINI_API_KEY="your-gemini-api-key"

# Update API URL in extensie
# Edit chrome-extension/background.js
# Change API_BASE_URL to your Cloud Run URL
```

## 💡 Tips

- **Best results**: Gebruik op nieuwsartikelen van minimaal 200 woorden
- **Language**: Werkt het best met Nederlandse artikelen
- **Limits**: 5 gratis analyses per maand in de huidige versie
- **Sources**: De extensie genereert relevante bronnen voor fact-checking

## 📝 Volgende stappen

1. **Test** op verschillende nieuwssites
2. **Bekijk** de code om aanpassingen te maken
3. **Deploy** naar Google Cloud voor productie gebruik
4. **Integreer** Stripe voor betalingen (zie hoofddocumentatie)