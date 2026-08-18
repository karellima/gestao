import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureApiErrorHandler, formatApiError, handleApiError } from '../services/api';

const error = (response, request = {}) => ({ response, request });

describe('interceptor de erros da API', () => {
  const notify = vi.fn();

  beforeEach(() => {
    notify.mockReset();
    configureApiErrorHandler(notify);
    window.history.pushState({}, '', '/login');
    localStorage.setItem('token', 'token-de-teste');
  });

  it('usa o detalhe do servidor para erros 4xx', () => {
    const result = formatApiError(error({ status: 422, data: { detail: 'Campo inválido' } }));
    expect(result).toEqual({ type: 'erro', message: 'Campo inválido' });
  });

  it('inclui a referência nos erros 5xx', () => {
    const result = formatApiError(error({ status: 500, data: { reference_id: 'a3f9c1' } }));
    expect(result.message).toBe('Erro no servidor. Nada foi salvo. Referência: a3f9c1');
  });

  it('distingue ausência de resposta do servidor', () => {
    const result = formatApiError(error(undefined, { code: 'ERR_NETWORK' }));
    expect(result.message).toBe('Sem conexão com o servidor.');
  });

  it('preserva a limpeza do token e o tratamento de 401', async () => {
    await expect(handleApiError(error({ status: 401, data: {} }))).rejects.toBeDefined();
    expect(localStorage.getItem('token')).toBeNull();
    expect(notify).toHaveBeenCalledWith({
      type: 'erro', message: 'Sessão expirada. Faça login novamente.',
    });
  });
});
