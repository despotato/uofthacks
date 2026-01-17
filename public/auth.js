window.authUI = (function () {
  const userInfoEl = document.getElementById('user-info');
  const googleBtn = document.getElementById('google-login');
  const logoutBtn = document.getElementById('logout-btn');
  const devLoginBtn = document.getElementById('dev-login-btn');
  const devEmail = document.getElementById('dev-email');
  const devName = document.getElementById('dev-name');
  let currentUser = null;

  function render() {
    if (currentUser) {
      userInfoEl.textContent = `Logged in as ${currentUser.name || currentUser.email}`;
      googleBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      userInfoEl.textContent = 'Not logged in';
      googleBtn.classList.remove('hidden');
      logoutBtn.classList.add('hidden');
    }
  }

  googleBtn?.addEventListener('click', () => {
    window.location.href = '/auth/google';
  });

  logoutBtn?.addEventListener('click', async () => {
    await fetch('/auth/logout', { method: 'POST' });
    currentUser = null;
    render();
    window.location.reload();
  });

  devLoginBtn?.addEventListener('click', async () => {
    const email = devEmail.value.trim();
    const name = devName.value.trim();
    if (!email) return alert('Enter email');
    const res = await fetch('/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      amplitudeClient.track('login_success');
      render();
    } else {
      const err = await res.json();
      alert(err.error || 'Login failed');
    }
  });

  function setUser(user) {
    currentUser = user;
    render();
  }

  return { setUser, getUser: () => currentUser };
})();
