// Background service worker
const API_BASE_URL = 'https://impact-lens-api-602723277830.europe-west1.run.app';

// Import ExtensionPay
importScripts('ExtPay.js');
const extpay = ExtPay('impact-lens-news'); // Replace with your actual extension ID from ExtensionPay

chrome.runtime.onInstalled.addListener(() => {
  console.log('Impact-Lens extension installed');

  // Start the user's ExtPay session
  extpay.startBackground();
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeContent') {
    analyzeContent(request.content)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the messaging channel open for async response
  }

  if (request.action === 'contentReady') {
    // Store content for sidebar access
    chrome.storage.local.set({
      latestContent: request.content,
      contentTimestamp: Date.now()
    });
  }

  if (request.action === 'openSidePanel') {
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
});

async function analyzeContent(content) {
  try {
    // Log content details for debugging
    const wordCount = content.text.split(/\s+/).filter(word => word.length > 0).length;
    console.log(`Analyzing content: ${content.text.length} chars, ${wordCount} words`);
    console.log(`Text preview: ${content.text.substring(0, 200)}...`);

    // Check if content is long enough
    if (wordCount < 50) {
      throw new Error(`Artikel te kort voor analyse: ${wordCount} woorden (minimaal 50 vereist)`);
    }

    // Check user's payment status
    const user = await extpay.getUser();

    // Check if user can make analysis
    if (!user.paid) {
      // Check free usage limit
      const { usage = { monthly: 0 } } = await chrome.storage.local.get('usage');

      if (usage.monthly >= 5) {
        throw new Error('USAGE_LIMIT_EXCEEDED');
      }
    }

    const requestBody = {
      url: content.url,
      title: content.title,
      text: content.text,
      language: content.language || 'nl' // Default to Dutch if not specified
    };

    console.log('Sending API request:', requestBody);

    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('API error response:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // Track usage for free users
    if (!user.paid) {
      await trackUsage(result.word_count);
    }

    // Store result for sidebar
    chrome.storage.local.set({
      latestAnalysis: result,
      analysisTimestamp: Date.now()
    });

    return result;
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Track usage for billing
async function trackUsage(wordCount) {
  const { usage = { monthly: 0, words: 0 } } = await chrome.storage.local.get('usage');

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${now.getMonth()}`;

  if (usage.month !== currentMonth) {
    usage.monthly = 0;
    usage.month = currentMonth;
  }

  usage.monthly += 1;
  usage.words += wordCount;

  await chrome.storage.local.set({ usage });
  return usage;
}