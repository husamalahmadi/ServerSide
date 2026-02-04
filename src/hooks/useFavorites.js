import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "trueprice_favorites";

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveFavorites(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function useFavorites() {
  const [list, setList] = useState(loadFavorites);

  useEffect(() => {
    saveFavorites(list);
  }, [list]);

  const isFavorite = useCallback(
    (ticker) => list.includes(String(ticker).toUpperCase()),
    [list]
  );

  const toggleFavorite = useCallback((ticker) => {
    const key = String(ticker).toUpperCase();
    setList((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }, []);

  const addFavorite = useCallback((ticker) => {
    const key = String(ticker).toUpperCase();
    setList((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const removeFavorite = useCallback((ticker) => {
    const key = String(ticker).toUpperCase();
    setList((prev) => prev.filter((t) => t !== key));
  }, []);

  return { favorites: list, isFavorite, toggleFavorite, addFavorite, removeFavorite };
}
