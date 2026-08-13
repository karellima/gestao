import { describe, expect, it } from 'vitest';
import { canFulfill, canManage, canReceive } from '../pages/requisicoes/permissoes';

const requisicao = {
  requester_id: 10,
  deposit_fulfilling_id: 20,
  deposit_requesting_id: 30,
};

describe('permissões de requisição', () => {
  it('permite todas as ações para administrador', () => {
    const admin = { id: 1, role: 'admin', deposit_ids: [] };

    expect(canManage(admin, requisicao)).toBe(true);
    expect(canFulfill(admin, requisicao)).toBe(true);
    expect(canReceive(admin, requisicao)).toBe(true);
  });

  it('permite ao requisitante gerenciar e receber, mas não atender', () => {
    const requester = { id: 10, role: 'user', deposit_ids: [] };

    expect(canManage(requester, requisicao)).toBe(true);
    expect(canReceive(requester, requisicao)).toBe(true);
    expect(canFulfill(requester, requisicao)).toBe(false);
  });

  it('permite ao usuário do depósito atender, mas nega as ações sem vínculo', () => {
    const warehouseUser = { id: 11, role: 'user', deposit_ids: [20] };

    expect(canFulfill(warehouseUser, requisicao)).toBe(true);
    expect(canManage(warehouseUser, requisicao)).toBe(false);
    expect(canReceive(warehouseUser, requisicao)).toBe(false);
  });
});
