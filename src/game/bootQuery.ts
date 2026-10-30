export interface BootQuery {
  debug: boolean;
  startLevel: number;
}

export function parseBootQuery(): BootQuery {
  const q = new URLSearchParams(location.search);
  const raw = Number(q.get('level'));
  const startLevel = Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  return { debug: q.has('debug'), startLevel };
}
