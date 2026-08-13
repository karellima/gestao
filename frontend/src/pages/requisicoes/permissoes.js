const isAdmin = user => user?.role === 'admin';

export function canManage(user, requisicao) {
  return isAdmin(user) || user?.id === requisicao.requester_id;
}

export function canFulfill(user, requisicao) {
  return isAdmin(user) || (user?.deposit_ids || []).includes(requisicao.deposit_fulfilling_id);
}

export function canReceive(user, requisicao) {
  return isAdmin(user)
    || user?.id === requisicao.requester_id
    || (user?.deposit_ids || []).includes(requisicao.deposit_requesting_id);
}
