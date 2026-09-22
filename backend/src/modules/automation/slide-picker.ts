export function randomSlideCount(available: number, rng: () => number = Math.random) {
  if (available < 2) return available;
  if (available === 2) return 2;
  const min = 3;
  const max = Math.min(8, available);
  return min + Math.floor(rng() * (max - min + 1));
}

export function pickRandomSlideSubset<T>(items: T[], rng: () => number = Math.random): T[] {
  if (items.length <= 2) return [...items];
  const shuffled = shuffle(items, rng);
  return shuffled.slice(0, randomSlideCount(items.length, rng));
}

export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
