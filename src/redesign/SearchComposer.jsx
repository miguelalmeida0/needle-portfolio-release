import { React, useState, useEffect, useRef } from '../../dist/modules/apps/web/src/shared/react.js';
import { Icon } from '../../dist/modules/apps/web/src/shared/icons.js';
import { useAppRuntime, useAppState } from '../../dist/modules/apps/web/src/app/app.context.js';
import { LoadingMark } from '../../dist/modules/apps/web/src/shared/ui/LoadingMark.js';
export function SearchComposer({ collectionName } = {}) {
    const runtime = useAppRuntime();
    const state = useAppState();
    const [draft, setDraft] = useState(state.draftQuery);
    const editingDuringBoot = useRef(false);
    const composing = useRef(false);
    useEffect(() => {
        if (state.corpus || !editingDuringBoot.current)
            setDraft(state.draftQuery);
        if (state.corpus)
            editingDuringBoot.current = false;
    }, [state.draftQuery]);
    const busy = state.status === 'searching' || state.status === 'truth-checking' || state.status === 'probing';
    const submit = () => {
        runtime.setDraft(draft);
        void runtime.submitDraft();
    };
    const edit = (value) => {
        if (!state.corpus)
            editingDuringBoot.current = true;
        setDraft(value);
        runtime.setDraft(value);
        if (!composing.current) {
            // Search the local index immediately; only Enter or the Search button
            // records a new entry in Recent Text Queries.
            void runtime.submitDraft(false);
        }
    };
    const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.isComposing && !composing.current) {
            event.preventDefault();
            submit();
        }
    };
    return (React.createElement("div", { className: "search-composer" },
        React.createElement("div", { className: "search-composer__field" },
            React.createElement(Icon, { name: "search", size: 16 }),
            React.createElement("input", { value: draft, onInput: (event) => edit(event.currentTarget.value), onCompositionStart: () => { composing.current = true; }, onCompositionEnd: (event) => { composing.current = false; edit(event.currentTarget.value); }, onKeyDown: onKeyDown, "aria-label": collectionName ? `Search in ${collectionName}` : "Describe something difficult to find", placeholder: collectionName ? "Search this collection" : "Describe something difficult to find", spellCheck: "true" }),
            draft && (React.createElement("button", { className: "icon-button search-composer__clear", type: "button", "aria-label": "Clear search", onClick: () => edit('') },
                React.createElement(Icon, { name: "close", size: 14 }))),
            React.createElement("button", { className: "search-composer__submit", type: "button", onClick: submit, disabled: !draft.trim(), "aria-label": collectionName ? "Search saved collection" : "Search the collection" }, busy ? React.createElement(LoadingMark, { label: "Searching" }) : React.createElement(Icon, { name: "arrow-enter", size: 16 }))),
        state.status === 'booting' && React.createElement("small", { role: "status", className: "search-startup-status" },
            "Preparing search",
            state.indexBuildProgress.total ? ` · ${Math.round(state.indexBuildProgress.completed / state.indexBuildProgress.total * 100)}%` : '',
            ". You can type now.")));
}
