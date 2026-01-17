(function () {
  let initialized = false;
  let available = false;

  function loadSdk(key) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.amplitude.com/libs/analytics-browser-1.10.0-min.js.gz';
      script.async = true;
      script.onload = () => {
        if (!window.amplitude || !window.amplitude.init) return reject(new Error('Amplitude SDK missing'));
        window.amplitude.init(key);
        available = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function initFromServer() {
    if (initialized) return available;
    initialized = true;
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (data.amplitudeKey) {
        await loadSdk(data.amplitudeKey);
        return (available = true);
      }
    } catch (err) {
      console.warn('Amplitude disabled', err);
    }
    return false;
  }

  function track(event, props = {}) {
    if (!available || !window.amplitude) return;
    window.amplitude.track(event, props);
  }

  window.amplitudeClient = { initFromServer, track };
})();
