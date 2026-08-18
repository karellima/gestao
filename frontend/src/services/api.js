import axios from 'axios';

let apiErrorHandler = null;

export function configureApiErrorHandler(handler) {
  apiErrorHandler = handler;
}

function referenceCode(error) {
  return error.response?.data?.reference_id
    || error.response?.data?.request_id
    || error.response?.data?.error_id
    || `ERR-${Date.now().toString(36).slice(-6)}`;
}

export function formatApiError(error) {
  if (!error.response) return { type: 'erro', message: 'Sem conexão com o servidor.' };
  if (error.response.status === 401) {
    return { type: 'erro', message: 'Sessão expirada. Faça login novamente.' };
  }
  if (error.response.status >= 500) {
    return {
      type: 'erro',
      message: `Erro no servidor. Nada foi salvo. Referência: ${referenceCode(error)}`,
    };
  }
  return {
    type: 'erro',
    message: error.response.data?.detail || 'Não foi possível concluir a solicitação.',
  };
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export function handleApiError(error) {
    if (apiErrorHandler) apiErrorHandler(formatApiError(error));
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
}

api.interceptors.response.use((response) => response, handleApiError);

export default api;
