import { React, useState, useEffect, useRef } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { LoadingMark } from '../../shared/ui/LoadingMark.js';
export function SearchComposer() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const [draft, setDraft] = useState(state.draftQuery);
    const editingDuringBoot = useRef(false);
    useEffect(() => {
        if (!editingDuringBoot.current)
            setDraft(state.draftQuery);
        if (state.corpus)
            editingDuringBoot.current = false;
    }, [state.draftQuery]);
    const busy = state.status === 'searching' || state.status === 'truth-checking' || state.status === 'probing';
    const submit = () => {
        runtime.setDraft(draft);
        void runtime.submitDraft();
    };
    const onKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submit();
        }
    };
    return (React.createElement("div", { className: "search-composer" },
        React.createElement("div", { className: "search-composer__field" },
            React.createElement(Icon, { name: "search", size: 16 }),
            React.createElement("input", { value: draft, onInput: (event) => { if (!state.corpus)
                    editingDuringBoot.current = true; setDraft(event.currentTarget.value); }, onKeyDown: onKeyDown, "aria-label": "Describe something difficult to find", placeholder: "Describe something difficult to find", spellCheck: "true" }),
            draft && (React.createElement("button", { className: "icon-button search-composer__clear", type: "button", "aria-label": "Clear search", onClick: () => setDraft('') },
                React.createElement(Icon, { name: "close", size: 14 }))),
            React.createElement("button", { className: "search-composer__submit", type: "button", onClick: submit, disabled: !draft.trim(), "aria-label": "Search the collection" }, busy ? React.createElement(LoadingMark, { label: "Searching" }) : React.createElement(Icon, { name: "arrow-enter", size: 16 }))),
        state.status === 'booting' && React.createElement("small", { role: "status", className: "search-startup-status" },
            "Preparing search",
            state.indexBuildProgress.total ? ` · ${Math.round(state.indexBuildProgress.completed / state.indexBuildProgress.total * 100)}%` : '',
            ". You can type now.")));
}
//# sourceMappingURL=SearchComposer.js.map