export function getMovementSortValue(movement, key, getProductName, getDepositName) {
  if (key === 'product_id') return getProductName(movement.product_id);
  if (key === 'deposit_id') return getDepositName(movement.deposit_id);
  return movement[key];
}
