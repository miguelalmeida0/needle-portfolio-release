import { React, useEffect, useMemo, useRef, useState } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
export function QueryFilterMenu(props) {
    const runtime = useAppRuntime();
    const state = useAppState();
    const [query, setQuery] = useState('');
    const menuRef = useRef(null);
    const searchRef = useRef(null);
    const closeRef = useRef(props.onClose);
    closeRef.current = props.onClose;
    const options = useMemo(() => buildOptions(state.corpus?.items ?? [], state.corpus?.clusters ?? []), [state.corpus]);
    const normalized = query.trim().toLowerCase();
    const visible = options.filter((option) => !normalized || `${option.label} ${option.group}`.toLowerCase().includes(normalized)).slice(0, 28);
    useEffect(() => {
        const menu = menuRef.current;
        const anchor = props.anchor;
        if (!menu || !anchor)
            return;
        const reposition = () => {
            const viewport = window.visualViewport;
            const width = viewport?.width ?? innerWidth;
            const height = viewport?.height ?? innerHeight;
            const left = viewport?.offsetLeft ?? 0;
            const top = viewport?.offsetTop ?? 0;
            const mobile = width <= 680;
            menu.classList.toggle('query-filter-menu--sheet', mobile);
            menu.setAttribute('aria-modal', String(mobile));
            menu.style.width = `${Math.min(304, width - 24)}px`;
            menu.style.maxHeight = `${Math.min(440, height - 24)}px`;
            const rect = anchor.getBoundingClientRect();
            const menuHeight = menu.getBoundingClientRect().height;
            let x = Math.max(left + 12, Math.min(rect.left, left + width - menu.offsetWidth - 12));
            let y = rect.bottom + 8;
            if (mobile) {
                menu.style.width = `${width - 24}px`;
                menu.style.maxHeight = `${Math.min(440, height * .72)}px`;
                x = left + 12;
                y = top + height - menu.getBoundingClientRect().height - 12;
            }
            else if (y + menuHeight > top + height - 12) {
                const above = rect.top - top - 20;
                const below = top + height - rect.bottom - 20;
                if (above > below) {
                    menu.style.maxHeight = `${Math.min(440, Math.max(120, above))}px`;
                    y = rect.top - menu.getBoundingClientRect().height - 8;
                }
                else {
                    menu.style.maxHeight = `${Math.min(440, Math.max(120, below))}px`;
                }
            }
            menu.style.left = `${x}px`;
            menu.style.top = `${Math.max(top + 12, Math.min(y, top + height - menu.getBoundingClientRect().height - 12))}px`;
        };
        const outside = (event) => {
            const target = event.target;
            if (!menu.contains(target) && !anchor.contains(target)) {
                // Prevent the pointer's default focus change from overriding focus return.
                event.preventDefault();
                closeRef.current();
            }
        };
        const keyboard = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closeRef.current();
            }
            else if (event.key === 'Tab') {
                const controls = Array.from(menu.querySelectorAll('button:not(:disabled), input'));
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                const buttons = Array.from(menu.querySelectorAll('.query-filter-menu__options button'));
                if (!buttons.length)
                    return;
                event.preventDefault();
                const index = buttons.indexOf(document.activeElement);
                const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
                buttons[next]?.focus();
            }
        };
        reposition();
        searchRef.current?.focus({ preventScroll: true });
        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('keydown', keyboard, true);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        window.visualViewport?.addEventListener('resize', reposition);
        window.visualViewport?.addEventListener('scroll', reposition);
        const observer = new ResizeObserver(reposition);
        observer.observe(anchor);
        observer.observe(menu);
        return () => {
            document.removeEventListener('pointerdown', outside, true);
            document.removeEventListener('keydown', keyboard, true);
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
            window.visualViewport?.removeEventListener('resize', reposition);
            window.visualViewport?.removeEventListener('scroll', reposition);
            observer.disconnect();
            if (anchor.isConnected)
                anchor.focus({ preventScroll: true });
        };
    }, [props.anchor]);
    const choose = (option) => {
        void runtime.addFilter(option.field, option.value, option.label);
        props.onClose();
    };
    return window.SHAP.ReactDOM.createPortal(React.createElement(React.Fragment, null,
        React.createElement("div", { className: "query-filter-backdrop", "aria-hidden": "true" }),
        React.createElement("div", { ref: menuRef, className: "query-filter-menu", role: "dialog", "aria-label": "Add a collection filter" },
            React.createElement("div", { className: "query-filter-menu__top" },
                React.createElement("strong", null, "Refine the collection"),
                React.createElement("button", { type: "button", className: "icon-button", onClick: props.onClose, "aria-label": "Close filter menu" },
                    React.createElement(Icon, { name: "close", size: 14 }))),
            React.createElement("label", { className: "query-filter-menu__search" },
                React.createElement(Icon, { name: "search", size: 14 }),
                React.createElement("input", { ref: searchRef, value: query, onInput: (event) => setQuery(event.currentTarget.value), placeholder: "Culture, medium, date\u2026", "aria-label": "Find a filter" })),
            React.createElement("div", { className: "query-filter-menu__options" }, visible.map((option) => (React.createElement("button", { type: "button", key: `${option.field}:${option.value}`, "aria-pressed": state.queryFilters.some(filter => filter.field === option.field && filter.value === option.value), onClick: () => choose(option) },
                React.createElement("span", null, option.label),
                React.createElement("small", null, option.group))))),
            visible.length === 0 && React.createElement("p", { className: "query-filter-menu__empty" }, "No matching filters"),
            state.queryFilters.length > 0 && (React.createElement("button", { type: "button", className: "query-filter-menu__clear", onClick: () => { void runtime.clearFilters(); props.onClose(); } }, "Clear all filters")))), document.body);
}
function buildOptions(items, clusters) {
    const options = [
        { field: 'before', value: 1900, label: 'Before 1900', group: 'Date' },
        { field: 'before', value: 1800, label: 'Before 1800', group: 'Date' },
        { field: 'after', value: 1900, label: 'After 1900', group: 'Date' },
        ...clusters.map((cluster) => ({ field: 'cluster', value: cluster.id, label: cluster.label, group: 'Neighborhood' }))
    ];
    const fields = [
        ['culture', 'Culture'],
        ['department', 'Department'],
        ['classification', 'Classification'],
        ['medium', 'Medium']
    ];
    for (const [field, group] of fields) {
        const counts = new Map();
        for (const item of items) {
            const value = String(item[field] ?? '').trim();
            if (!value)
                continue;
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, field === 'medium' ? 8 : 12);
        for (const [value] of common)
            options.push({ field, value, label: value, group });
    }
    return options;
}
//# sourceMappingURL=QueryFilterMenu.js.map