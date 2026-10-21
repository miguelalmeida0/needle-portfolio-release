import { gsap } from 'gsap';
import { Flip } from 'gsap/Flip';
import { useEffect, useLayoutEffect, useRef } from '../../shared/react.js';
import { useAppRuntime } from '../../app/app.context.js';
import { featuredTextMatch } from '../../app/app.selectors.js';
import { discoveryMotion } from '../../shared/discovery-motion.js';
gsap.registerPlugin(Flip);
/** Capture the two real graph nodes before React swaps their presentation.
 * Their catalogue identities and the camera stay fixed; only their card roles move. */
export function useFeaturedTransition(container, featuredId) {
    const runtime = useAppRuntime();
    const pending = useRef(null);
    useEffect(() => {
        let previous = runtime.store.getSnapshot();
        return runtime.store.subscribe(() => {
            const next = runtime.store.getSnapshot();
            if (previous.featuredArtworkId !== next.featuredArtworkId) {
                pending.current = null;
                const from = featuredTextMatch(previous)?.id;
                const to = featuredTextMatch(next)?.id;
                if (from && to && from !== to && previous.approximate === next.approximate && container.current
                    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    const ids = [from, to];
                    const nodes = [...container.current.querySelectorAll('[data-flip-id]')].filter(node => ids.includes(node.dataset.flipId));
                    pending.current = { state: Flip.getState(nodes), ids };
                }
            }
            previous = next;
        });
    }, [runtime]);
    useLayoutEffect(() => {
        const captured = pending.current;
        pending.current = null;
        const element = container.current;
        if (!captured || !element)
            return;
        return discoveryMotion(() => {
            const targets = [...element.querySelectorAll('[data-flip-id]')].filter(node => captured.ids.includes(node.dataset.flipId));
            Flip.from(captured.state, { targets, scale: true, duration: .48, ease: 'power3.inOut', prune: true });
        }, element);
    }, [featuredId]);
}
//# sourceMappingURL=useFeaturedTransition.js.map