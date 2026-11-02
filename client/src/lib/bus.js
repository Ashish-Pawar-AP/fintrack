const subs = new Set();
export const onRefresh = (f) => { subs.add(f); return () => subs.delete(f); };
export const refresh = () => subs.forEach((f) => f());
