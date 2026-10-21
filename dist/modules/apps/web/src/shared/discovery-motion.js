import { gsap } from 'gsap';
/** Own both the timeline and its preference listener for this mounted surface. */
export function discoveryMotion(setup, scope) {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let context;
    const update = () => {
        context?.revert();
        context = undefined;
        if (!preference.matches)
            context = gsap.context(setup, scope);
    };
    update();
    preference.addEventListener('change', update);
    return () => { preference.removeEventListener('change', update); context?.revert(); };
}
//# sourceMappingURL=discovery-motion.js.map