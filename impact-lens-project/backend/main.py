from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
import os
import json
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="Impact-Lens API", version="1.0.0")

# CORS middleware for browser requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class AnalyzeRequest(BaseModel):
    url: str
    title: str
    text: str
    language: Optional[str] = "nl"  # Default to Dutch

class Source(BaseModel):
    title: str
    url: str

class AnalyzeResponse(BaseModel):
    claim_summary: str
    critical_questions: List[str]
    impact_summary: List[str]
    sources: List[Source]
    word_count: int
    timestamp: str

@app.get("/")
async def root():
    return {"message": "Impact-Lens API", "version": "1.0.0"}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_content(request: AnalyzeRequest):
    try:
        # Log incoming request for debugging
        print(f"DEBUG - Received request:")
        print(f"  URL: {request.url}")
        print(f"  Title: {request.title}")
        print(f"  Text length: {len(request.text)} chars")
        print(f"  Text preview: {request.text[:100]}...")

        # Count words for billing
        word_count = len(request.text.split())
        print(f"  Word count: {word_count}")

        if word_count < 50:
            print(f"DEBUG - Text too short: {word_count} words (need 50+)")
            raise HTTPException(status_code=400, detail=f"Text too short for analysis: {word_count} words (minimum 50 required)")

        if word_count > 5000:
            # Truncate if too long
            words = request.text.split()[:5000]
            request.text = " ".join(words)
            word_count = 5000

        # Create the analysis prompt with language support
        analysis_prompt = create_analysis_prompt(request.title, request.text, request.language)

        # Call Gemini for initial analysis
        response = await call_gemini(analysis_prompt)

        # Parse the response
        print(f"Raw Gemini response: {response[:500]}...")
        analysis = parse_gemini_response(response)

        # Enhance answers with web search for questions that need more context
        enhanced_questions = []
        for question in analysis.get("critical_questions", []):
            # Handle both string and dict format questions
            if isinstance(question, dict):
                # Convert dict format to our string format
                vraag = question.get('vraag', '')
                antwoord = question.get('antwoord', 'Niet vermeld in artikel')

                # Check if this question needs web search enhancement
                if "Niet vermeld in artikel" in antwoord:
                    print(f"Searching for dict question: {vraag}")
                    search_result = await search_web_with_gemini(vraag, request.language)
                    if search_result and "Geen betrouwbare informatie gevonden" not in search_result and "tijdelijk niet beschikbaar" not in search_result:
                        formatted_question = f"Vraag: {vraag} | Antwoord: {search_result}"
                        enhanced_questions.append(formatted_question)
                        print(f"Enhanced dict question with: {search_result[:100]}...")
                    else:
                        formatted_question = f"Vraag: {vraag} | Antwoord: {antwoord}"
                        enhanced_questions.append(formatted_question)
                else:
                    formatted_question = f"Vraag: {vraag} | Antwoord: {antwoord}"
                    enhanced_questions.append(formatted_question)
                continue

            # Convert to string if needed
            question_str = str(question)

            # Check if the question needs enhancement
            needs_enhancement = (
                "Niet vermeld in artikel" in question_str or
                "niet beantwoord" in question_str.lower() or
                "geen informatie" in question_str.lower() or
                "niet duidelijk" in question_str.lower()
            )

            if needs_enhancement and "Vraag:" in question_str:
                # Extract the question part for search
                question_part = question_str.split("|")[0].replace("Vraag:", "").strip()

                # Search for additional context using Gemini with web search
                print(f"Searching for: {question_part}")
                search_result = await search_web_with_gemini(question_part, request.language)

                if search_result and "Geen betrouwbare informatie gevonden" not in search_result and "tijdelijk niet beschikbaar" not in search_result:
                    enhanced_answer = f"Vraag: {question_part} | Antwoord: Online informatie: {search_result}"
                    enhanced_questions.append(enhanced_answer)
                    print(f"Enhanced question with: {search_result[:100]}...")
                else:
                    # Keep original if search didn't help
                    enhanced_questions.append(question_str)
                    print(f"No enhancement found for: {question_part}")
            else:
                # Keep questions that already have good answers
                enhanced_questions.append(question_str)

        analysis["critical_questions"] = enhanced_questions

        return AnalyzeResponse(
            claim_summary=analysis["claim_summary"],
            critical_questions=analysis["critical_questions"],
            impact_summary=analysis["impact_summary"],
            sources=analysis["sources"],
            word_count=word_count,
            timestamp=datetime.now().isoformat()
        )

    except Exception as e:
        import traceback
        print(f"Analysis error details: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

def create_analysis_prompt(title: str, text: str, language: str = "nl") -> str:

    # Language-specific prompts and instructions
    prompts = {
        "nl": {
            "instruction": "Analyseer het volgende nieuwsartikel en geef een gestructureerde output in JSON formaat.",
            "fields": {
                "claim_summary": "Een korte, neutrale samenvatting van de hoofdclaim (max 3 zinnen) - leg afkortingen en technische termen uit, inclusief WHY en WHAT context",
                "critical_questions": "Kritische vragen en antwoorden uit het artikel",
                "impact_summary": "Concrete impact punten",
                "sources": "Relevante bronnen"
            },
            "question_format": "Vraag: De eerste kritische vraag | Antwoord: Het antwoord uit het artikel",
            "impact_format": "Impact punt 1: korte beschrijving van een concrete impact",
            "language_instruction": "Gebruik Nederlandse taal"
        },
        "en": {
            "instruction": "Analyze the following news article and provide a structured output in JSON format.",
            "fields": {
                "claim_summary": "A brief, neutral summary of the main claim (max 3 sentences) - explain abbreviations and technical terms, including WHY and WHAT context",
                "critical_questions": "Critical questions and answers from the article",
                "impact_summary": "Concrete impact points",
                "sources": "Relevant sources"
            },
            "question_format": "Question: The first critical question | Answer: The answer from the article",
            "impact_format": "Impact point 1: brief description of a concrete impact",
            "language_instruction": "Use English language"
        },
        "de": {
            "instruction": "Analysieren Sie den folgenden Nachrichtenartikel und geben Sie eine strukturierte Ausgabe im JSON-Format.",
            "fields": {
                "claim_summary": "Eine kurze, neutrale Zusammenfassung der Hauptbehauptung (max 3 Sätze) - erklären Sie Abkürzungen und Fachbegriffe, einschließlich WARUM und WAS Kontext",
                "critical_questions": "Kritische Fragen und Antworten aus dem Artikel",
                "impact_summary": "Konkrete Auswirkungspunkte",
                "sources": "Relevante Quellen"
            },
            "question_format": "Frage: Die erste kritische Frage | Antwort: Die Antwort aus dem Artikel",
            "impact_format": "Auswirkungspunkt 1: kurze Beschreibung einer konkreten Auswirkung",
            "language_instruction": "Verwenden Sie deutsche Sprache"
        },
        "es": {
            "instruction": "Analiza el siguiente artículo de noticias y proporciona una salida estructurada en formato JSON.",
            "fields": {
                "claim_summary": "Un resumen breve y neutral de la afirmación principal (máx 3 oraciones) - explica abreviaciones y términos técnicos, incluyendo contexto de POR QUÉ y QUÉ",
                "critical_questions": "Preguntas críticas y respuestas del artículo",
                "impact_summary": "Puntos de impacto concretos",
                "sources": "Fuentes relevantes"
            },
            "question_format": "Pregunta: La primera pregunta crítica | Respuesta: La respuesta del artículo",
            "impact_format": "Punto de impacto 1: breve descripción de un impacto concreto",
            "language_instruction": "Usa idioma español"
        }
    }

    # Get language config, default to Dutch
    lang_config = prompts.get(language, prompts["nl"])

    # Create the prompt in the specified language
    return f"""
{lang_config['instruction']}

Titel: {title}

Tekst: {text}

Geef de output in het volgende JSON formaat:
{{
    "claim_summary": "{lang_config['fields']['claim_summary']}",
    "critical_questions": [
        "{lang_config['question_format']}",
        "Question/Vraag: Second critical question | Answer/Antwoord: Answer from article",
        "Question/Vraag: Third critical question | Answer/Antwoord: Answer from article"
    ],
    "impact_summary": [
        "{lang_config['impact_format']}",
        "{lang_config['impact_format'].replace('1', '2')}",
        "{lang_config['impact_format'].replace('1', '3')}"
    ],
    "sources": [
        {{"title": "{lang_config['fields']['sources']} 1", "url": "https://example.com"}},
        {{"title": "{lang_config['fields']['sources']} 2", "url": "https://example.com"}}
    ]
}}

Instructies:
1. Wees kritisch en objectief
2. Focus op verificeerbare feiten en data
3. Stel vragen die helpen bij fact-checking EN beantwoord ze met beschikbare info
4. Impact punten moeten concreet en meetbaar zijn
5. Bronnen moeten echt bestaan en relevant zijn
6. {lang_config['language_instruction']}
7. BELANGRIJK: Leg alle afkortingen, technische termen en jargon uit zodat een gewone lezer het begrijpt
8. Framework voor complete context (ESSENTIEEL):
   - Bij gebeurtenissen: leg uit WAT er precies is gebeurd
   - Bij beslissingen: leg uit WAAROM deze beslissing is genomen
   - Bij controverses: leg uit WAT er gezegd/gedaan is dat tot controverse leidde
   - Bij sancties/straffen: leg uit het SPECIFIEKE gedrag dat tot de straf leidde
   - Bij conflicten: leg uit de CONCRETE aanleiding en wat beide partijen beweren
9. Framework voor vraag-antwoord (BELANGRIJK):
   - Stel relevante kritische vragen die lezers zouden moeten hebben
   - Beantwoord elke vraag zo volledig mogelijk met info uit het artikel
   - Als exacte info niet beschikbaar is, geef context of aanverwante info uit het artikel
   - Als echt geen relevante info in artikel staat, gebruik equivalent van 'Niet vermeld in artikel'
   - Probeer altijd een bruikbaar antwoord te geven op basis van beschikbare context
10. Antwoord ALLEEN met valide JSON, geen extra tekst
11. BELANGRIJK: critical_questions moet een array van strings zijn, GEEN objecten!
"""

async def search_web_with_gemini(query: str, language: str = "nl") -> str:
    """Answer question using Gemini's knowledge base"""
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')

        # Language-specific search prompts
        language_prompts = {
            "nl": f"Beantwoord deze vraag zo volledig mogelijk: \"{query}\"\n\nGeef een informatief, feitelijk antwoord van maximaal 3 zinnen in het Nederlands. Focus op concrete feiten, cijfers, en praktische informatie. Formatteer je antwoord kort en bondig, zonder inleidende zinnen.",
            "en": f"Answer this question as completely as possible: \"{query}\"\n\nProvide an informative, factual answer of maximum 3 sentences in English. Focus on concrete facts, figures, and practical information. Format your answer concisely, without introductory sentences.",
            "de": f"Beantworten Sie diese Frage so vollständig wie möglich: \"{query}\"\n\nGeben Sie eine informative, sachliche Antwort von maximal 3 Sätzen auf Deutsch. Konzentrieren Sie sich auf konkrete Fakten, Zahlen und praktische Informationen. Formatieren Sie Ihre Antwort prägnant, ohne einleitende Sätze.",
            "es": f"Responde a esta pregunta lo más completamente posible: \"{query}\"\n\nProporciona una respuesta informativa y fáctica de máximo 3 oraciones en español. Enfócate en hechos concretos, cifras e información práctica. Formatea tu respuesta de manera concisa, sin oraciones introductorias."
        }

        enhanced_prompt = language_prompts.get(language, language_prompts["nl"])

        response = await asyncio.to_thread(
            model.generate_content,
            enhanced_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1500,
                temperature=0.2
            )
        )

        result = response.text.strip()

        # Clean up common unwanted phrases
        unwanted_phrases = [
            "Deze vraag gaat over",
            "Het antwoord op deze vraag is",
            "Volgens mijn kennis",
            "Op basis van de informatie"
        ]

        for phrase in unwanted_phrases:
            if result.startswith(phrase):
                # Find the first sentence after the phrase
                sentences = result.split('.')
                if len(sentences) > 1:
                    result = '.'.join(sentences[1:]).strip()

        return result if result and len(result) > 10 else "Meer onderzoek nodig voor een volledig antwoord"

    except Exception as e:
        print(f"Gemini search error: {e}")
        return "Informatie tijdelijk niet beschikbaar"

async def call_gemini(prompt: str) -> str:
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')

        full_prompt = f"""Je bent een kritische nieuwsanalist die helpt bij het verifiëren van claims en het identificeren van belangrijke vragen. Antwoord altijd in valide JSON formaat.

{prompt}"""

        response = await asyncio.to_thread(
            model.generate_content,
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=1500,
                temperature=0.3
            )
        )

        return response.text

    except Exception as e:
        raise Exception(f"Gemini API error: {str(e)}")

def parse_gemini_response(response: str) -> dict:
    try:
        # Clean the response and extract JSON
        response = response.strip()

        # Remove markdown code blocks
        if "```json" in response:
            start = response.find("```json") + 7
            end = response.find("```", start)
            if end != -1:
                response = response[start:end]
        elif "```" in response:
            start = response.find("```") + 3
            end = response.find("```", start)
            if end != -1:
                response = response[start:end]

        response = response.strip()

        # Find JSON object boundaries
        start_idx = response.find('{')
        end_idx = response.rfind('}')

        if start_idx != -1 and end_idx != -1:
            response = response[start_idx:end_idx+1]

        # Additional JSON cleaning for common issues
        response = response.replace('\n', ' ')  # Remove newlines
        response = response.replace('\t', ' ')  # Remove tabs

        # Fix common JSON errors
        # Remove trailing commas before closing brackets/braces
        import re
        response = re.sub(r',(\s*[}\]])', r'\1', response)

        # Ensure proper quote escaping within strings
        # This is a basic fix - for production use a proper JSON fixer

        print(f"Cleaned JSON: {response[:300]}...")

        try:
            analysis = json.loads(response)
        except json.JSONDecodeError as e:
            print(f"JSON parse error: {e}")
            print(f"Problematic JSON around error: {response[max(0, e.pos-50):e.pos+50]}")

            # Try multiple fixes
            fixed_response = response

            # Fix smart quotes
            fixed_response = fixed_response.replace('"', '"').replace('"', '"')
            fixed_response = fixed_response.replace(''', "'").replace(''', "'")

            # Fix problematic keys with | characters
            fixed_response = fixed_response.replace('"| Antwoord":', '"antwoord":')
            fixed_response = fixed_response.replace('"| antwoord":', '"antwoord":')

            # Try to fix malformed object in critical_questions array
            import re
            # Replace object format with string format in critical_questions
            pattern = r'\{\s*"Vraag":\s*"([^"]*)",?\s*"[|]?\s*[Aa]ntwoord":\s*"([^"]*)"\s*\}'
            fixed_response = re.sub(pattern, r'"Vraag: \1 | Antwoord: \2"', fixed_response)

            try:
                analysis = json.loads(fixed_response)
            except json.JSONDecodeError:
                # Last resort: try to extract just the basic structure
                print("Attempting basic fallback structure")
                analysis = {
                    "claim_summary": "Kon JSON niet verwerken - probeer opnieuw",
                    "critical_questions": ["Fout bij verwerken van vragen"],
                    "impact_summary": ["Fout bij verwerken van impact"],
                    "sources": []
                }

        # Validate required fields
        required_fields = ["claim_summary", "critical_questions", "impact_summary", "sources"]
        for field in required_fields:
            if field not in analysis:
                raise ValueError(f"Missing required field: {field}")

        # Fix critical_questions format if needed
        if isinstance(analysis["critical_questions"], list):
            fixed_questions = []
            for question in analysis["critical_questions"]:
                if isinstance(question, dict):
                    # Convert object format to string format
                    vraag = question.get('Vraag', question.get('vraag', 'Onbekende vraag'))
                    antwoord = question.get('Antwoord', question.get('antwoord', question.get('| Antwoord', 'Geen antwoord')))
                    fixed_questions.append(f"Vraag: {vraag} | Antwoord: {antwoord}")
                elif isinstance(question, str):
                    fixed_questions.append(question)
                else:
                    fixed_questions.append("Vraag: Onbekende vraag | Antwoord: Geen antwoord")
            analysis["critical_questions"] = fixed_questions

        # Ensure lists have content
        if not isinstance(analysis["critical_questions"], list) or len(analysis["critical_questions"]) == 0:
            analysis["critical_questions"] = ["Geen kritische vragen geïdentificeerd"]

        if not isinstance(analysis["impact_summary"], list) or len(analysis["impact_summary"]) == 0:
            analysis["impact_summary"] = ["Geen duidelijke impact geïdentificeerd"]

        if not isinstance(analysis["sources"], list):
            analysis["sources"] = []

        return analysis

    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse Gemini response as JSON: {str(e)}")
    except Exception as e:
        raise Exception(f"Error processing analysis: {str(e)}")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# Debug endpoint to check environment
@app.get("/debug")
async def debug_check():
    import os
    return {
        "gemini_key_present": bool(os.getenv("GEMINI_API_KEY")),
        "gemini_key_length": len(os.getenv("GEMINI_API_KEY", "")),
        "environment": "cloud_run"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)