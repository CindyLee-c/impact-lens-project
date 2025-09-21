document.getElementById('openSidebar').addEventListener('click', async () => {
  const windows = await chrome.windows.getCurrent();
  chrome.sidePanel.open({ windowId: windows.id });
  window.close();
});

// Update status
chrome.storage.local.get(['usage'], (result) => {
  const usage = result.usage || { monthly: 0 };
  document.getElementById('status').textContent =
    `${usage.monthly}/5 analyses gebruikt deze maand`;
});
