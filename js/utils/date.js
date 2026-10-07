/* Date and id helpers. Pure functions, no app state. */

const pad2 = (n) => String(n).padStart(2, "0");

/** "YYYY-MM" key used to store a month. */
export function monthKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthLabel(d) {
  return { month: d.toLocaleString("en-GB", { month: "long" }), year: d.getFullYear() };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Today as "YYYY-MM-DD" in local time. */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Move a stored date onto targetMonthDate's month/year, keeping the same
 * day-of-month (clamped so e.g. the 31st in Feb becomes the 28th/29th).
 */
export function shiftDateToMonth(dateStr, targetMonthDate) {
  const old = new Date(dateStr);
  if (isNaN(old)) return dateStr;
  const y = targetMonthDate.getFullYear();
  const mo = targetMonthDate.getMonth();
  const lastDay = new Date(y, mo + 1, 0).getDate();
  const day = Math.min(old.getDate(), lastDay);
  const d = new Date(y, mo, day);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Whole days from today until dateStr (negative = past). null if no date. */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(todayISO());
  const target = new Date(dateStr);
  return Math.round((target - today) / 86400000);
}

export function ordinalSuffix(n) {
  n = Number(n);
  if (n % 10 === 1 && n !== 11) return "st";
  if (n % 10 === 2 && n !== 12) return "nd";
  if (n % 10 === 3 && n !== 13) return "rd";
  return "th";
}
