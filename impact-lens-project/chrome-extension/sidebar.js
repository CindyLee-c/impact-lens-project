// Sidebar functionality
document.addEventListener('DOMContentLoaded', function() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loading = document.getElementById('loading');
  const results = document.getElementById('results');
  const error = document.getElementById('error');
  const noContent = document.getElementById('noContent');
  const usage = document.getElementById('usage');

  // Initialize ExtensionPay
  const extpay = ExtPay('impact-lens-news'); // Replace with your actual extension ID

  // --- TRANSLATION DATA ---
  const translations = {
    nl: {
      analyze: 'Analyseer artikel',
      analyzing: 'Analyseren...',
      mainClaim: 'Hoofdclaim',
      impactSummary: 'Impact samenvatting',
      criticalQuestions: 'Kritische vragen',
      noContent: 'Ga naar een nieuwsartikel om te beginnen met analyseren.',
      usage: 'gebruikt',
      upgrade: 'Upgrade voor meer',
      limitReached: 'Limiet bereikt!',
      limitReachedText: 'Je hebt je 5 gratis analyses gebruikt deze maand.',
      upgradeToPremium: 'Upgrade naar Premium - €5/maand',
      premiumBenefits: 'Onbeperkte analyses + prioriteit support',
      premiumAccount: 'Premium Account',
      unlimitedAnalyses: 'Onbeperkte analyses',
      manage: 'Beheren',
      answer: 'Antwoord',
      questionNotAnswered: 'Deze vraag werd niet beantwoord in de analyse',
      sources: 'Bronnen',
      noClaim: 'Geen claim gevonden',
      insufficientContent: 'Geen voldoende inhoud gevonden op deze pagina'
    },
    en: {
      analyze: 'Analyze Article',
      analyzing: 'Analyzing...',
      mainClaim: 'Main Claim',
      impactSummary: 'Impact Summary',
      criticalQuestions: 'Critical Questions',
      noContent: 'Navigate to a news article to start analyzing.',
      usage: 'used',
      upgrade: 'Upgrade for more',
      limitReached: 'Limit Reached!',
      limitReachedText: 'You have used your 5 free analyses for this month.',
      upgradeToPremium: 'Upgrade to Premium - €5/month',
      premiumBenefits: 'Unlimited analyses + priority support',
      premiumAccount: 'Premium Account',
      unlimitedAnalyses: 'Unlimited analyses',
      manage: 'Manage',
      answer: 'Answer',
      questionNotAnswered: 'This question was not answered in the analysis',
      sources: 'Sources',
      noClaim: 'No claim found',
      insufficientContent: 'Not enough content found on this page'
    },
    de: {
      analyze: 'Artikel analysieren',
      analyzing: 'Analysiere...',
      mainClaim: 'Hauptanspruch',
      impactSummary: 'Auswirkungszusammenfassung',
      criticalQuestions: 'Kritische Fragen',
      noContent: 'Gehen Sie zu einem Nachrichtenartikel, um die Analyse zu starten.',
      usage: 'verwendet',
      upgrade: 'Upgrade für mehr',
      limitReached: 'Limit erreicht!',
      limitReachedText: 'Sie haben Ihre 5 kostenlosen Analysen für diesen Monat aufgebraucht.',
      upgradeToPremium: 'Upgrade auf Premium - 5 €/Monat',
      premiumBenefits: 'Unbegrenzte Analysen + Prioritätssupport',
      premiumAccount: 'Premium-Konto',
      unlimitedAnalyses: 'Unbegrenzte Analysen',
      manage: 'Verwalten',
      answer: 'Antwort',
      questionNotAnswered: 'Diese Frage wurde in der Analyse nicht beantwortet',
      sources: 'Quellen',
      noClaim: 'Kein Anspruch gefunden',
      insufficientContent: 'Nicht genügend Inhalt auf dieser Seite gefunden'
    },
    es: {
      analyze: 'Analizar artículo',
      analyzing: 'Analizando...',
      mainClaim: 'Reclamación principal',
      impactSummary: 'Resumen de impacto',
      criticalQuestions: 'Preguntas críticas',
      noContent: 'Vaya a un artículo de noticias para comenzar a analizar.',
      usage: 'usado',
      upgrade: 'Actualizar para más',
      limitReached: '¡Límite alcanzado!',
      limitReachedText: 'Ha utilizado sus 5 análisis gratuitos de este mes.',
      upgradeToPremium: 'Actualizar a Premium - 5 €/mes',
      premiumBenefits: 'Análisis ilimitados + soporte prioritario',
      premiumAccount: 'Cuenta Premium',
      unlimitedAnalyses: 'Análisis ilimitados',
      manage: 'Gestionar',
      answer: 'Respuesta',
      questionNotAnswered: 'Esta pregunta no fue respondida en el análisis',
      sources: 'Fuentes',
      noClaim: 'No se encontró ninguna reclamación',
      insufficientContent: 'No se encontró suficiente contenido en esta página'
    }
  };
  // --- END TRANSLATION DATA ---

  let selectedLanguage = 'nl'; // Default to Dutch

  initializeLanguageSelector();
  updateUsageDisplay();

  const manageBtn = document.getElementById('manageBtn');
  if (manageBtn) {
    manageBtn.addEventListener('click', function() {
      // This can still point to extpay or a custom management page
      extpay.openPaymentPage();
    });
  }

  analyzeBtn.addEventListener('click', async function() {
    try {
      showLoading();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });

      if (!response || !response.text || response.text.length < 100) {
        throw new Error(translations[selectedLanguage].insufficientContent);
      }

      const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'analyzeContent',
          content: { ...response, language: selectedLanguage }
        }, (msg) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (msg.success) {
            resolve(msg.data);
          } else {
            reject(new Error(msg.error));
          }
        });
      });

      displayResults(result);
      updateUsageDisplay();

    } catch (err) {
      if (err.message === 'USAGE_LIMIT_EXCEEDED') {
        showUpgradePrompt();
      } else {
        showError(err.message);
      }
    }
  });

  function showLoading() {
    analyzeBtn.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';
    error.style.display = 'none';
    noContent.style.display = 'none';
  }

  function hideLoading() {
    analyzeBtn.disabled = false;
    loading.style.display = 'none';
  }

  function showError(message) {
    hideLoading();
    error.textContent = message;
    error.style.display = 'block';
    results.style.display = 'none';
    noContent.style.display = 'none';
  }

  function displayResults(data) {
    hideLoading();
    const lang = translations[selectedLanguage];

    document.getElementById('claim').textContent = data.claim_summary || lang.noClaim;

    const questionsList = document.getElementById('questions');
    questionsList.innerHTML = '';
    if (data.critical_questions && data.critical_questions.length > 0) {
      data.critical_questions.forEach((question, index) => {
        const li = document.createElement('li');
        li.className = 'question-item';

        const qSeparator = 'Vraag:';
        const aSeparator = 'Antwoord:';
        const pipeSeparator = '|';

        let questionPart = question;
        let answerPart = lang.questionNotAnswered;

        if (question.includes(pipeSeparator)) {
            const parts = question.split(pipeSeparator);
            questionPart = parts[0].replace(qSeparator, '').trim();
            answerPart = parts[1] ? parts[1].replace(aSeparator, '').trim() : lang.questionNotAnswered;
        }

        li.innerHTML = `
          <div class="accordion-header" data-index="${index}">
            <span class="question-text">${questionPart}</span>
            <span class="accordion-arrow">▼</span>
          </div>
          <div class="accordion-content" id="answer-${index}" style="display: none;">
            <div class="answer-part"><strong>${lang.answer}:</strong> ${answerPart}</div>
          </div>
        `;
        questionsList.appendChild(li);
      });

      questionsList.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
          toggleAccordion(header.dataset.index);
        });
      });
    }

    const impactList = document.getElementById('impactPoints');
    impactList.innerHTML = '';
    if (data.impact_summary && data.impact_summary.length > 0) {
      data.impact_summary.forEach(point => {
        const li = document.createElement('li');
        li.textContent = point;
        impactList.appendChild(li);
      });
    }

    const sourcesDiv = document.getElementById('sources');
    if (data.sources && data.sources.length > 0) {
      sourcesDiv.innerHTML = `<strong>${lang.sources}:</strong> ` +
        data.sources.map(source =>
          `<a href="${source.url}" target="_blank">${source.title}</a>`
        ).join(', ');
    } else {
      sourcesDiv.innerHTML = '';
    }

    results.style.display = 'block';
    error.style.display = 'none';
    noContent.style.display = 'none';
  }

  async function updateUsageDisplay() {
    try {
      const user = await extpay.getUser();
      const subscriptionPanel = document.getElementById('subscriptionPanel');
      const lang = translations[selectedLanguage];

      if (user.paid) {
        usage.textContent = 'Premium ✓';
        usage.style.background = '#4caf50';
        usage.style.color = 'white';
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = lang.analyze;
        analyzeBtn.style.background = '#1a73e8';
        subscriptionPanel.style.display = 'block';
        analyzeBtn.onclick = null;
      } else {
        subscriptionPanel.style.display = 'none';
        const result = await chrome.storage.local.get({ usage: { monthly: 0 } });
        const usageData = result.usage;

        usage.textContent = `${usageData.monthly}/5 ${lang.usage}`;
        usage.style.background = 'white';
        usage.style.color = '#666';

        if (usageData.monthly >= 5) {
          analyzeBtn.disabled = false; // Make it clickable to open subscription page
          analyzeBtn.textContent = lang.upgrade;
          analyzeBtn.style.background = '#ff9800';
          analyzeBtn.onclick = function() {
            chrome.tabs.create({ url: chrome.runtime.getURL('subscription.html') });
          };
        } else {
          analyzeBtn.disabled = false;
          analyzeBtn.textContent = lang.analyze;
          analyzeBtn.style.background = '#1a73e8';
          analyzeBtn.onclick = null;
        }
      }
    } catch (err) {
      console.error('Error updating usage:', err);
    }
  }

  function showUpgradePrompt() {
    hideLoading();
    const lang = translations[selectedLanguage];
    error.innerHTML = `
      <div style="text-align: center;">
        <h3 style="margin-top: 0; color: #ff9800;">${lang.limitReached}</h3>
        <p>${lang.limitReachedText}</p>
        <button id="upgradeBtn" style="
          background: #ff9800; color: white; border: none; padding: 10px 20px;
          border-radius: 6px; cursor: pointer; font-weight: 500; margin-top: 10px;
        ">
          ${lang.upgradeToPremium}
        </button>
        <div style="font-size: 12px; color: #666; margin-top: 8px;">
          ${lang.premiumBenefits}
        </div>
      </div>
    `;
    error.style.display = 'block';
    results.style.display = 'none';
    noContent.style.display = 'none';

    document.getElementById('upgradeBtn').addEventListener('click', function() {
      chrome.tabs.create({ url: chrome.runtime.getURL('subscription.html') });
    });
  }

  function toggleAccordion(index) {
    const content = document.getElementById(`answer-${index}`);
    const arrow = content.previousElementSibling.querySelector('.accordion-arrow');
    if (content.style.display === 'none') {
      content.style.display = 'block';
      arrow.textContent = '▲';
    } else {
      content.style.display = 'none';
      arrow.textContent = '▼';
    }
  }

  function initializeLanguageSelector() {
    const langButtons = document.querySelectorAll('.lang-flag');
    chrome.storage.local.get(['selectedLanguage'], (result) => {
      if (result.selectedLanguage) {
        selectedLanguage = result.selectedLanguage;
      }
      updateLanguageUI();
    });

    langButtons.forEach(button => {
      button.addEventListener('click', function() {
        selectedLanguage = this.dataset.lang;
        chrome.storage.local.set({ selectedLanguage: selectedLanguage });
        updateLanguageUI();
      });
    });
  }

  function updateLanguageUI() {
    const langButtons = document.querySelectorAll('.lang-flag');
    langButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.lang === selectedLanguage);
    });
    updateTranslations();
    updateUsageDisplay(); // Also update usage text
  }

  function updateTranslations() {
    const lang = translations[selectedLanguage];
    document.getElementById('analyzeBtn').textContent = lang.analyze;
    document.getElementById('loadingText').textContent = lang.analyzing;
    document.getElementById('mainClaimTitle').textContent = lang.mainClaim;
    document.getElementById('impactSummaryTitle').textContent = lang.impactSummary;
    document.getElementById('criticalQuestionsTitle').textContent = lang.criticalQuestions;
    document.getElementById('noContentText').textContent = lang.noContent;
    document.getElementById('unlimitedAccountTitle').textContent = lang.unlimitedAccount;
    document.getElementById('unlimitedAnalysesTitle').textContent = lang.unlimitedAnalyses;
    document.getElementById('manageBtn').textContent = lang.manage;
  }

  // Initial load check
  chrome.storage.local.get(['latestAnalysis', 'analysisTimestamp'], (result) => {
    if (result.latestAnalysis && result.analysisTimestamp > Date.now() - 3600000) {
      displayResults(result.latestAnalysis);
    } else {
      noContent.style.display = 'block';
    }
  });
});  }
  });
});