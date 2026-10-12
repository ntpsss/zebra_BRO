(() => {
  const API_BASE_URL = 'https://server-zebrabro.onrender.com/api';
  const listeners = new Set();
  const pendingMutations = new Map();
  let authRevision = 0;
  let authCheckPromise = null;
  let cartRefreshPromise = null;
  let state = {
    authStatus: 'unknown',
    user: null,
    authError: '',
    cart: {
      items: [],
      totalQuantity: 0,
      totalPrice: 0
    },
    cartStatus: 'idle',
    cartError: ''
  };

  class ApiError extends Error {
    constructor(message, type, status = null) {
      super(message);
      this.name = 'ApiError';
      this.type = type;
      this.status = status;
    }
  }

  const notify = () => {
    listeners.forEach((listener) => listener(state));
    window.dispatchEvent(new CustomEvent('zebra:api-state', { detail: state }));
  };

  const setState = (patch) => {
    state = { ...state, ...patch };
    notify();
  };

  const readResponse = async (response) => {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 240) };
    }
  };

  const request = async (path, options = {}) => {
    const {
      authRequired = false,
      expectedRevision,
      ...fetchOptions
    } = options;
    let response;

    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...fetchOptions,
        credentials: 'include'
      });
    } catch {
      throw new ApiError(
        'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.',
        'network'
      );
    }

    let result;
    try {
      result = await readResponse(response);
    } catch {
      throw new ApiError(
        'Не удалось прочитать ответ сервера. Попробуйте ещё раз.',
        'response',
        response.status
      );
    }

    if (!response.ok) {
      const detail = typeof result?.message === 'string'
        ? result.message
        : typeof result?.error === 'string'
          ? result.error
          : response.status === 401 && path === '/auth'
            ? 'Неверный логин или пароль.'
            : `Сервер вернул ошибку ${response.status}.`;

      if (response.status === 401 && authRequired) {
        if (expectedRevision === undefined || expectedRevision === authRevision) {
          invalidateAuth('Сессия завершена. Войдите в аккаунт снова.');
        }
        throw new ApiError(
          'Сессия завершена. Войдите в аккаунт снова.',
          'unauthorized',
          response.status
        );
      }

      throw new ApiError(
        response.status === 401 && path === '/auth'
          ? (detail || 'Проверьте логин и пароль.')
          : detail,
        'http',
        response.status
      );
    }

    return result;
  };

  const clearCart = () => ({
    items: [],
    totalQuantity: 0,
    totalPrice: 0
  });

  function invalidateAuth(message = '') {
    authRevision += 1;
    authCheckPromise = null;
    cartRefreshPromise = null;
    pendingMutations.clear();
    setState({
      authStatus: 'unauthenticated',
      user: null,
      authError: message,
      cart: clearCart(),
      cartStatus: 'idle',
      cartError: ''
    });
  }

  const normalizeCart = (result) => {
    if (!result || !Array.isArray(result.items)) {
      throw new ApiError('Сервер вернул корзину в неизвестном формате.', 'response');
    }

    const items = result.items.map((item) => {
      const productId = item.productId ?? item.product_id ?? item.product?.id ?? item.id;
      const quantity = Number(item.quantity);

      if (
        (typeof productId !== 'string' && typeof productId !== 'number') ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        throw new ApiError('Сервер вернул некорректную позицию корзины.', 'response');
      }

      return {
        productId,
        name: typeof item.name === 'string' ? item.name : '',
        price: item.price !== null &&
          item.price !== undefined &&
          Number.isFinite(Number(item.price))
          ? Number(item.price)
          : null,
        quantity,
        image: typeof item.image === 'string' ? item.image : ''
      };
    });

    const calculatedQuantity = items.reduce((total, item) => total + item.quantity, 0);
    const hasAllPrices = items.every((item) => item.price !== null);
    const calculatedPrice = items.reduce(
      (total, item) => total + (item.price === null ? 0 : item.price * item.quantity),
      0
    );

    return {
      items,
      totalQuantity: result.totalQuantity !== null &&
        result.totalQuantity !== undefined &&
        Number.isSafeInteger(Number(result.totalQuantity))
        ? Number(result.totalQuantity)
        : calculatedQuantity,
      totalPrice: result.totalPrice !== null &&
        result.totalPrice !== undefined &&
        Number.isFinite(Number(result.totalPrice))
        ? Number(result.totalPrice)
        : hasAllPrices
          ? calculatedPrice
          : null
    };
  };

  const isValidUser = (user) =>
    user &&
    (typeof user.id === 'string' || typeof user.id === 'number') &&
    typeof user.email === 'string';

  const checkAuth = (force = false) => {
    if (authCheckPromise && !force) {
      return authCheckPromise;
    }
    if (force) {
      authRevision += 1;
      cartRefreshPromise = null;
      pendingMutations.clear();
    }

    const requestRevision = authRevision;
    setState({
      authStatus: 'checking',
      user: null,
      authError: '',
      cart: clearCart(),
      cartStatus: 'idle',
      cartError: ''
    });

    authCheckPromise = request('/auth/me')
      .then((result) => {
        if (requestRevision !== authRevision) {
          return state.user;
        }
        if (!isValidUser(result?.user)) {
          throw new ApiError('Сервер вернул некорректные данные аккаунта.', 'response');
        }
        setState({
          authStatus: 'authenticated',
          user: result.user,
          authError: ''
        });
        void refreshCart().catch(() => {});
        return result.user;
      })
      .catch((error) => {
        if (requestRevision !== authRevision) {
          return null;
        }
        if (error.status === 401 || error.type === 'unauthorized') {
          invalidateAuth('');
          return null;
        }
        setState({
          authStatus: 'error',
          user: null,
          authError: error.message,
          cart: clearCart(),
          cartStatus: 'idle',
          cartError: ''
        });
        return null;
      })
      .finally(() => {
        if (requestRevision === authRevision) {
          authCheckPromise = null;
        }
      });

    return authCheckPromise;
  };

  const refreshCart = () => {
    if (state.authStatus !== 'authenticated') {
      return Promise.resolve(clearCart());
    }
    if (cartRefreshPromise) {
      return cartRefreshPromise;
    }

    const requestRevision = authRevision;
    setState({ cartStatus: 'loading', cartError: '' });
    cartRefreshPromise = request('/cart', {
      authRequired: true,
      expectedRevision: requestRevision
    })
      .then((result) => {
        if (requestRevision !== authRevision) {
          return state.cart;
        }
        const cart = normalizeCart(result);
        setState({ cart, cartStatus: 'ready', cartError: '' });
        return cart;
      })
      .catch((error) => {
        if (requestRevision === authRevision && error.type !== 'unauthorized') {
          setState({ cartStatus: 'error', cartError: error.message });
        }
        throw error;
      })
      .finally(() => {
        if (requestRevision === authRevision) {
          cartRefreshPromise = null;
        }
      });

    return cartRefreshPromise;
  };

  const mutateCart = async (productId, operation) => {
    if (state.authStatus !== 'authenticated') {
      throw new ApiError('Войдите в аккаунт, чтобы изменить корзину.', 'unauthorized', 401);
    }
    const key = String(productId);
    if (pendingMutations.has(key)) {
      return;
    }

    const requestRevision = authRevision;
    pendingMutations.set(key, requestRevision);
    notify();

    try {
      await operation();
      if (requestRevision === authRevision) {
        await refreshCart();
      }
    } finally {
      if (pendingMutations.get(key) === requestRevision) {
        pendingMutations.delete(key);
      }
      notify();
    }
  };

  const addCartItem = (productId, quantity = 1) => {
    if (!Number.isSafeInteger(quantity) || quantity < 1) {
      return Promise.reject(new ApiError('Укажите корректное количество товара.', 'input'));
    }
    return mutateCart(productId, () => request('/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
      authRequired: true,
      expectedRevision: authRevision
    }));
  };

  const setCartItemQuantity = (productId, quantity) => {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      return Promise.reject(new ApiError('Укажите корректное количество товара.', 'input'));
    }
    return mutateCart(productId, () => quantity === 0
      ? request(`/cart/items/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          authRequired: true,
          expectedRevision: authRevision
        })
      : request(`/cart/items/${encodeURIComponent(productId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity }),
          authRequired: true,
          expectedRevision: authRevision
        }));
  };

  const logout = async () => {
    if (state.authStatus !== 'authenticated') {
      return;
    }
    const requestRevision = authRevision;
    await request('/auth/logout', {
      method: 'POST',
      authRequired: true,
      expectedRevision: requestRevision
    });
    if (requestRevision === authRevision) {
      invalidateAuth('');
    }
  };

  const login = async (name, password) => {
    authRevision += 1;
    authCheckPromise = null;
    cartRefreshPromise = null;
    pendingMutations.clear();
    const requestRevision = authRevision;
    setState({
      authStatus: 'checking',
      user: null,
      authError: '',
      cart: clearCart(),
      cartStatus: 'idle',
      cartError: ''
    });

    try {
      await request('/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, registration: false })
      });
      if (requestRevision !== authRevision) {
        return null;
      }

      const result = await request('/auth/me');
      if (!isValidUser(result?.user)) {
        throw new ApiError('Сервер вернул некорректные данные аккаунта.', 'response');
      }
      if (requestRevision !== authRevision) {
        return null;
      }

      setState({
        authStatus: 'authenticated',
        user: result.user,
        authError: '',
        cart: clearCart(),
        cartStatus: 'loading',
        cartError: ''
      });
      try {
        await refreshCart();
      } catch {
        // The signed-in state remains valid; the cart view exposes its own retryable error.
      }
      return result.user;
    } catch (error) {
      if (requestRevision === authRevision) {
        setState({
          authStatus: 'unauthenticated',
          user: null,
          authError: '',
          cart: clearCart(),
          cartStatus: 'idle',
          cartError: ''
        });
      }
      throw error;
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.authStatus === 'authenticated') {
      void refreshCart().catch(() => {});
    }
  });

  window.ZebraApi = {
    ApiError,
    request,
    checkAuth,
    refreshCart,
    addCartItem,
    setCartItemQuantity,
    login,
    logout,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    getState: () => state,
    isMutating: (productId) => pendingMutations.has(String(productId))
  };
})();
