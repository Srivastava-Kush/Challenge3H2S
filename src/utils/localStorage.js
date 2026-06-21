const KEY = 'carbonHistory';

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveMonthlyEntry(entry) {
  const history = getHistory();
  const idx = history.findIndex(e => e.month === entry.month);
  if (idx >= 0) {
    history[idx] = entry;
  } else {
    history.unshift(entry);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(history.slice(0, 12)));
  } catch {
    // storage quota exceeded — silently ignore
  }
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
