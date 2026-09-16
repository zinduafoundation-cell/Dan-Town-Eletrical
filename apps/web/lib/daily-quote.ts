const DAILY_QUOTES = [
  "Small progress is still progress. Keep moving forward.",
  "The work you do today is building the strength of tomorrow.",
  "Stay consistent; every good project starts with one solid step.",
  "Your effort matters, even when the results take time to show.",
  "Choose progress over perfection and keep your momentum.",
  "A reliable foundation makes every next step easier.",
  "You have everything you need to make today count."
] as const;

export function getDailyQuote(date = new Date()) {
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
      Date.UTC(date.getFullYear(), 0, 0)) /
      86_400_000
  );

  return DAILY_QUOTES[(dayOfYear - 1) % DAILY_QUOTES.length];
}
