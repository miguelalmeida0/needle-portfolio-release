import { useEffect } from '../shared/react.js';
/** Reveal a submitted search without changing focus or the results viewport size. */
export function useDiscoveryReveal(items) {
    useEffect(() => {
        // Initial browsing, filters and inspector updates must not pull the reader away.
        if (!items.length || !document.activeElement?.closest('.search-composer'))
            return;
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
                const heading = document.getElementById('discovery-heading');
                const card = document.querySelector('.discovery-card');
                if (!heading || !card || !document.activeElement?.closest('.search-composer'))
                    return;
                const compact = window.matchMedia('(max-width: 980px)').matches;
                const inset = compact ? (document.querySelector('.search-sidebar')?.getBoundingClientRect().height ?? 0) + 16 : 16;
                const top = heading.getBoundingClientRect().top;
                const bottom = card.getBoundingClientRect().bottom;
                const delta = top < inset ? top - inset : Math.max(0, Math.min(top - inset, bottom - innerHeight + 24));
                if (Math.abs(delta) < 1)
                    return;
                window.scrollBy({ top: delta, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [items]);
}
//# sourceMappingURL=useDiscoveryReveal.js.map