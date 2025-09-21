// Content script to extract page content
(function() {
  'use strict';

  function extractPageContent() {
    // Remove script and style elements
    const clonedDoc = document.cloneNode(true);
    const scripts = clonedDoc.querySelectorAll('script, style, nav, header, footer, aside');
    scripts.forEach(el => el.remove());

    // Extract main content
    const title = document.title;
    const url = window.location.href;

    // Try to find main content area
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.content',
      '.article-body',
      '.post-content',
      '.entry-content'
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        mainContent = element.innerText;
        break;
      }
    }

    // Fallback to body text if no main content found
    if (!mainContent) {
      mainContent = document.body.innerText;
    }

    // Clean up text
    const text = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .slice(0, 15000); // Limit to ~15k characters (supports ~2000+ words)

    // Count words
    const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;

    console.log(`Content extracted: ${text.length} chars, ${wordCount} words`);
    console.log(`Text preview: ${text.substring(0, 200)}...`);

    return {
      url,
      title,
      text,
      wordCount,
      timestamp: Date.now()
    };
  }

  // Listen for messages from popup/sidebar
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
      const content = extractPageContent();
      sendResponse(content);
    }
  });

  // Auto-extract on page load for news sites
  const newsSelectors = [
    'article',
    '.article',
    '.news-article',
    '.post',
    '.story'
  ];

  const hasNewsContent = newsSelectors.some(selector =>
    document.querySelector(selector)
  );

  if (hasNewsContent && document.readyState === 'complete') {
    setTimeout(() => {
      const content = extractPageContent();
      if (content.text.length > 500) { // Only for substantial articles
        chrome.runtime.sendMessage({
          action: 'contentReady',
          content: content
        });
      }
    }, 1000);
  }
})();