# Impact-Lens Chrome Extension

Een Chrome-extensie die nieuwsartikelen analyseert en kritische vragen genereert met impact samenvattingen.

## Project Structuur

```
impact-lens-project/
├── chrome-extension/     # Chrome extensie bestanden
│   ├── manifest.json     # Extensie configuratie
│   ├── content.js        # Content script voor pagina-inhoud
│   ├── background.js     # Service worker
│   ├── sidebar.html/js   # Zijpaneel interface
│   └── popup.html        # Popup interface
└── backend/              # FastAPI backend
    ├── main.py           # API server
    ├── requirements.txt  # Python dependencies
    ├── Dockerfile        # Container configuratie
    └── cloudbuild.yaml   # Google Cloud deployment
```

## Functionaliteit

### Chrome Extensie
- **Content Extraction**: Automatische herkenning en extractie van artikel-inhoud
- **Side Panel**: Moderne UI voor analyse resultaten
- **Usage Tracking**: Bijhouden van maandelijks verbruik (5 gratis analyses/maand)
- **Auto-detection**: Herkent nieuwsartikelen automatisch

### Backend API
- **GPT-4 Integration**: Gebruikt OpenAI voor intelligente analyse
- **Structured Output**: JSON responses met claim, vragen, impact en bronnen
- **Word Counting**: Tracking voor billing purposes
- **Error Handling**: Robuuste error handling en validatie

## Installatie & Setup

### Lokale Development

#### 1. Backend Setup

```bash
cd backend

# Installeer dependencies
pip install -r requirements.txt

# Set OpenAI API key
export OPENAI_API_KEY="your-openai-api-key"
# Set Gemini API key
export GEMINI_API_KEY="your-gemini-api-key"

# Start de server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

De API is nu beschikbaar op `http://localhost:8000`

#### 2. Chrome Extensie Setup

1. Open Chrome en ga naar `chrome://extensions/`
2. Enable "Developer mode" (rechtsboven)
3. Klik "Load unpacked"
4. Selecteer de `chrome-extension` folder
5. Update de `API_BASE_URL` in `background.js` naar `http://localhost:8000`

### Google Cloud Deployment

#### 1. Voorbereiding

```bash
# Set your Google Cloud project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
```

#### 2. Deploy Backend

```bash
cd backend

# Build en deploy naar Cloud Run
gcloud builds submit --config cloudbuild.yaml \
  --substitutions _OPENAI_API_KEY="your-openai-api-key"
```

#### 3. Update Extensie

Na deployment, update de `API_BASE_URL` in `background.js`:

```javascript
const API_BASE_URL = 'https://impact-lens-api-HASH-ew.a.run.app';
```

## API Endpoints

### POST /analyze

Analyseert nieuwsartikel content.

**Request:**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "text": "Article content..."
}
```

**Response:**
```json
{
  "claim_summary": "Korte samenvatting van hoofdclaim",
  "critical_questions": [
    "Kritische vraag 1",
    "Kritische vraag 2",
    "Kritische vraag 3"
  ],
  "impact_summary": [
    "Impact punt 1",
    "Impact punt 2",
    "Impact punt 3"
  ],
  "sources": [
    {"title": "Bron 1", "url": "https://example.com"}
  ],
  "word_count": 1500,
  "timestamp": "2024-01-01T12:00:00"
}
```

### GET /health

Health check endpoint.

## Usage Limits & Billing

### Free Tier
- **5 analyses per maand**
- Fair use policy
- Automatische reset elke maand

### Paid Plans (Future)
- **€5/maand**: Onbeperkt normaal gebruik
- **€1 per extra analyse**: Metered billing voor high-volume

## Development Notes

### Security
- CORS properly configured voor browser requests
- API key veilig opgeslagen in environment variables
- Geen logging van gevoelige data

### Performance
- **GPT-4o-mini** gebruikt voor kostefficiëntie
- Response caching in browser storage
- Word count limiting (max 5000 woorden per analyse)

### Error Handling
- Graceful fallbacks voor content extraction
- User-friendly error messages in Nederlands
- Automatic retry voor API failures

## Troubleshooting

### Common Issues

1. **"Geen voldoende inhoud gevonden"**
   - De pagina heeft te weinig tekst (< 100 karakters)
   - Content script kan de hoofdtekst niet vinden
   - Probeer handmatig te refreshen

2. **API Errors**
   - Check of OPENAI_API_KEY correct is ingesteld
   - Verify backend is running en bereikbaar
   - Check browser console voor network errors

3. **Extensie laadt niet**
   - Verify manifest.json syntax
   - Check alle bestanden zijn aanwezig
   - Enable "Developer mode" in Chrome

### Debug Tips

```bash
# Backend logs (local)
uvicorn main:app --reload --log-level debug

# Cloud Run logs
gcloud logs tail --service impact-lens-api

# Chrome extensie debug
# Ga naar chrome://extensions/, klik "Inspect views service worker"
```

## Next Steps

1. **Stripe Integration**: Payment processing toevoegen
2. **Data Sources**: Integrate met officiële datasets
3. **Multi-language**: Support voor Engels en andere talen
4. **Advanced Analytics**: Sentiment analysis en bias detection
5. **User Accounts**: Profile management en history

## License

Private project - All rights reserved.