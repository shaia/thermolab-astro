import { useEffect, useState } from 'preact/hooks';

/** True while the viewport is narrower than `px` CSS pixels (false on the server): figures stack their panels on a phone. */
export function useNarrow(px = 560): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [px]);
  return narrow;
}
