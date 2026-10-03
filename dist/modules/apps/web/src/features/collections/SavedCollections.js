import { React } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
export function SavedCollections(props) {
    const runtime = useAppRuntime();
    const state = useAppState();
    return (React.createElement("section", { ref: props.sectionRef, className: "saved-collections", "aria-labelledby": "saved-collections-title" },
        React.createElement("div", { className: "saved-collections__heading" },
            React.createElement("h2", { id: "saved-collections-title" }, "Saved collections")),
        React.createElement("div", { className: "saved-collections__list" },
            state.savedCollections.slice(0, 4).map((collection) => (React.createElement("button", { type: "button", key: collection.id, className: state.scopedCollectionId === collection.id ? 'is-active' : '', onClick: () => void runtime.scopeCollection(state.scopedCollectionId === collection.id ? null : collection.id) },
                React.createElement("span", { className: "saved-collection__swatch", style: { backgroundColor: collection.color } }),
                React.createElement("span", null, collection.name),
                React.createElement("small", null, collection.artworkIds.length)))),
            state.savedCollections.length === 0 && React.createElement("p", null, "Save a result neighborhood to keep it close.")),
        React.createElement("button", { className: "saved-collections__new", type: "button", onClick: () => void runtime.saveCurrentCollection(), disabled: !state.approximate },
            React.createElement(Icon, { name: "plus", size: 13 }),
            React.createElement("span", null, "New collection"))));
}
//# sourceMappingURL=SavedCollections.js.map