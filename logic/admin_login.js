const $ = (selector) => document.querySelector(selector);

const loginButton = $('#login-button');
const loginButtonText = $('#login-button-text');

const authOverlay = $('#auth-overlay');
const authClose = $('#auth-close');

const loginView = $('#login-view');
const registerView = $('#register-view');

const openRegisterButton = $('#open-register');
const openLoginButton = $('#open-login');

const adminlogform = $('#adminlogform');
const loginMessage = $('#admin-login-message');

const authTitle = $('#auth-title');

authOverlay?.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-password-toggle]');
  if (!toggle) {
    return;
  }

  const passwordInput = document.getElementById(toggle.getAttribute('aria-controls'));
  if (!passwordInput) {
    return;
  }

  const isVisible = passwordInput.type === 'password';
  passwordInput.type = isVisible ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(isVisible));
  toggle.setAttribute(
    'aria-label',
    isVisible ? 'Скрыть пароль' : 'Показать пароль'
  );
});

const openContactButton = $('#open-contact');
const contactOverlay = $('#contact-overlay');
const contactCloseButton = $('#contact-close');
const contactForm = $('#contact-form');
const contactNameInput = $('#contact-name');
const contactSubmitNote = $('#contact-submit-note');

const openContactModal = () => {
  if (!contactOverlay) {
    return;
  }

  contactOverlay.classList.remove('hidden');
  contactOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('contact-is-open');
  contactNameInput?.focus();
};

const closeContactModal = () => {
  if (!contactOverlay) {
    return;
  }

  contactOverlay.classList.add('hidden');
  contactOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('contact-is-open');
  openContactButton?.focus();
};

if (openContactButton) {
  openContactButton.addEventListener('click', (event) => {
    event.preventDefault();
    openContactModal();
  });
}

if (contactCloseButton) {
  contactCloseButton.addEventListener('click', closeContactModal);
}

if (contactOverlay) {
  contactOverlay.addEventListener('click', (event) => {
    if (event.target === contactOverlay) {
      closeContactModal();
    }
  });
}

if (contactForm && contactSubmitNote) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();
    contactSubmitNote.textContent =
      'Обращение не отправлено: онлайн-отправка пока не подключена. ' +
      'Позвоните нам по номеру +7 (473) 207-20-78.';
    contactSubmitNote.focus();
  });
}

const openAuthModal = () => {
  if (!authOverlay) {
    return;
  }

  authOverlay.classList.remove('hidden');
  authOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-is-open');
  showLoginView();

  const usernameInput = $('#login-username');

  if (usernameInput) {
    window.setTimeout(() => {
      usernameInput.focus();
    }, 100);
  }
};

const closeAuthModal = () => {
  if (!authOverlay) {
    return;
  }

  authOverlay.classList.add('hidden');
  authOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('auth-is-open');
};

const showLoginView = () => {
  if (loginView) {
    loginView.hidden = false;
  }

  if (registerView) {
    registerView.hidden = true;
  }

  if (authTitle) {
    authTitle.textContent = 'Вход';
  }
  if (loginMessage) {
    loginMessage.textContent = '';
  }
};

const showRegisterView = () => {
  if (loginView) {
    loginView.hidden = true;
  }

  if (registerView) {
    registerView.hidden = false;
  }

  if (authTitle) {
    authTitle.textContent = 'Регистрация';
  }
  if (registerMessage) {
    registerMessage.textContent = '';
  }
};

if (loginButton) {
  loginButton.addEventListener('click', (event) => {
    event.preventDefault();
    const authState = window.ZebraApi.getState();
    if (authState.authStatus === 'checking' || authState.authStatus === 'unknown') {
      return;
    }
    if (authState.authStatus === 'authenticated') {
      window.ZebraApi.logout().catch((error) => {
        window.alert(error.message);
      });
    } else if (authState.authStatus === 'error') {
      void window.ZebraApi.checkAuth();
    } else {
      openAuthModal();
    }
  });
}

if (authClose) {
  authClose.addEventListener('click', closeAuthModal);
}

if (authOverlay) {
  authOverlay.addEventListener('click', (event) => {
    if (event.target === authOverlay) {
      closeAuthModal();
    }
  });
}


if (openLoginButton) {
  openLoginButton.addEventListener(
    'click',
    showLoginView
  );
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAuthModal();
    closeContactModal();
  }
});

if (adminlogform) {
  adminlogform.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (loginMessage) {
      loginMessage.textContent = '';
    }

    const submitButton = adminlogform.querySelector('[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const name = $('#admin-username').value.trim().toLocaleLowerCase('ru-RU');
      const password = $('#admin-password').value;
      const user = await window.ZebraApi.adminLogin(name, password);
      if (user?.role !== 'admin') {
        await window.ZebraApi.logout();
        throw new Error('Нет доступа к админ-панели');
      }
      window.location.href = './adminmanufacturers.html';
    } catch (error) {
      if (loginMessage) {
        loginMessage.textContent = error.message ||
          'Не удалось выполнить вход. Попробуйте еще раз.';
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}