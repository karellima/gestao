import { renderHook, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useItensDeMovimentacao from '../pages/depositos/useItensDeMovimentacao';

describe('useItensDeMovimentacao', () => {
  afterEach(() => vi.useRealTimers());

  it('adds an item once, clears the search and restores focus', () => {
    vi.useFakeTimers();
    const focus = vi.fn();
    const product = { product_id: 1, product_name: 'Arroz', unit_abbr: 'kg' };
    const { result } = renderHook(() => {
      const [items, setItems] = useState([]);
      const [searchQ, setSearchQ] = useState('ar');
      const controls = useItensDeMovimentacao({
        items,
        balance: [{ product_id: 1, balance: 2 }],
        setItems,
        setSearchQ,
        searchRef: useRef({ focus }),
      });
      return { items, searchQ, controls };
    });

    act(() => result.current.controls.addItem(product));
    act(() => result.current.controls.addItem(product));
    act(() => vi.advanceTimersByTime(50));

    expect(result.current.items).toEqual([{ ...product, quantity: 1 }]);
    expect(result.current.searchQ).toBe('');
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('changes, clamps and removes items using the available balance', () => {
    const { result } = renderHook(() => {
      const [items, setItems] = useState([{ product_id: 1, product_name: 'Arroz', quantity: 1, unit_abbr: 'kg' }]);
      const controls = useItensDeMovimentacao({
        items,
        balance: [{ product_id: 1, balance: 1.5 }],
        setItems,
        setSearchQ: vi.fn(),
        searchRef: useRef(null),
      });
      return { items, controls };
    });

    act(() => result.current.controls.changeQty(1, 1));
    expect(result.current.items[0].quantity).toBe(1.5);

    act(() => result.current.controls.updateQty(1, '3'));
    expect(result.current.items[0].quantity).toBe(1.5);

    act(() => result.current.controls.removeItem(1));
    expect(result.current.items).toEqual([]);
  });
});
