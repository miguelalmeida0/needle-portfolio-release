import { React, useEffect, useRef, useState } from '../shared/react.js';
import { useAppRuntime, useAppSelector } from './app.context.js';
import { discoveryItems } from './discovery.selectors.js';
import { gsap } from 'gsap';
import { discoveryMotion } from '../shared/discovery-motion.js';
import { SearchSidebar } from '../features/sidebar/SearchSidebar.js';
import { createDiscoveryCommands } from '../../../../src/core/commands/discovery.js';
import { CommandButton } from '../../../../src/ui/primitives/CommandButton.js';
import { DiscoveryShelf } from '../features/discovery/DiscoveryShelf.js';
import { InspectorPanel } from '../features/inspector/InspectorPanel.js';
export function DiscoverySlot() {
    const runtime = useAppRuntime();
    const items = useAppSelector(discoveryItems);
    const selected = useAppSelector(state => state.selectedArtworkId);
    const [origin, setOrigin] = useState(null);
    const panel = useRef(null);
    const sequence = useRef(0);
    const shelf = useRef(null);
    if (shelf.current !== items) {
        shelf.current = items;
        sequence.current++;
    }
    useEffect(() => { if (origin && selected !== origin)
        setOrigin(null); }, [selected, origin]);
    useEffect(() => {
        if (!origin || selected !== origin)
            return;
        const element = panel.current;
        if (!element)
            return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
        const stopMotion = discoveryMotion(() => {
            gsap.fromTo(element, { y: 8, clipPath: 'inset(0 0 3% 0 round 15px)' }, { y: 0, clipPath: 'inset(0 0 0% 0 round 15px)', duration: .3, ease: 'power3.out', clearProps: 'transform,clipPath' });
        }, element);
        const rect = element.getBoundingClientRect();
        const compact = window.matchMedia('(max-width: 980px)').matches;
        if (compact || rect.top < 0 || rect.bottom > innerHeight) {
            if (compact)
                element.querySelector('h2')?.focus({ preventScroll: true });
            element.scrollIntoView({ block: 'nearest', behavior: reduced.matches ? 'instant' : 'smooth' });
        }
        return stopMotion;
    }, [origin, selected]);
    const commands = createDiscoveryCommands({
        canSelect: id => discoveryItems(runtime.store.getSnapshot()).some(item => item.artwork.id === id),
        select: id => { runtime.activateRecommendation(id); setOrigin(id); },
        returnToShelf: () => {
            const target = [...document.querySelectorAll('.discovery-card')].find(card => card.dataset.artworkId === origin)
                ?? document.getElementById('discovery-heading') ?? document.querySelector('.search-composer input');
            target?.focus({ preventScroll: true });
            target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
            setOrigin(null);
        },
    });
    return React.createElement(React.Fragment, null,
        React.createElement(SearchSidebar, { discovery: items.length > 0 ? React.createElement(DiscoveryShelf, { key: sequence.current, items: items, selected: selected, select: commands.select }) : null }),
        React.createElement(InspectorPanel, { panelRef: panel, discoveryReturn: origin && selected === origin ?
                React.createElement(CommandButton, { command: commands.back(), label: "Back to recommendations", className: "discovery-return" }, "Back to recommendations") : null }));
}
//# sourceMappingURL=DiscoverySlot.js.map