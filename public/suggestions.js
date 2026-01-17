window.suggestionsUI = (function () {
  const listEl = document.getElementById('suggestions-list');
  let handlers = { onPage: null, onAvailability: null };
  let current = [];

  function setHandlers(h) {
    handlers = { ...handlers, ...h };
  }

  async function fetchSuggestions() {
    const res = await fetch('/api/suggestions');
    if (!res.ok) {
      listEl.innerHTML = '<div class="muted">Suggestions unavailable</div>';
      return;
    }
    const data = await res.json();
    current = data.suggestions || [];
    render();
  }

  function render() {
    if (!current.length) {
      listEl.innerHTML = '<div class="muted">No suggestions right now</div>';
      return;
    }
    listEl.innerHTML = '';
    current.forEach((s) => {
      const card = document.createElement('div');
      card.className = 'suggestion-card';
      card.innerHTML = `
        <div><strong>${s.title}</strong></div>
        <div class="muted">${s.body}</div>
        <div class="actions">
          <button class="small" data-action="accept">Accept</button>
          <button class="small secondary" data-action="dismiss">Dismiss</button>
        </div>
      `;
      const [acceptBtn, dismissBtn] = card.querySelectorAll('button');
      acceptBtn.addEventListener('click', () => handleAction(s, 'accept'));
      dismissBtn.addEventListener('click', () => handleAction(s, 'dismiss'));
      listEl.appendChild(card);
    });
  }

  async function sendFeedback(suggestion, action) {
    await fetch('/api/suggestions/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestionKey: suggestion.suggestionKey,
        targetUserId: suggestion.targetUserId,
        action,
      }),
    });
    amplitudeClient.track('suggestion_feedback', {
      suggestionKey: suggestion.suggestionKey,
      action,
    });
  }

  async function handleAction(suggestion, action) {
    if (action === 'accept') {
      if (suggestion.action?.type === 'page' && handlers.onPage) {
        handlers.onPage(suggestion.action.payload.toUserId);
      }
      if (suggestion.action?.type === 'availability' && handlers.onAvailability) {
        handlers.onAvailability(suggestion.action.payload.available);
      }
    }
    await sendFeedback(suggestion, action);
    // refresh to reflect new weights
    setTimeout(fetchSuggestions, 200);
  }

  return { fetchSuggestions, setHandlers };
})();
