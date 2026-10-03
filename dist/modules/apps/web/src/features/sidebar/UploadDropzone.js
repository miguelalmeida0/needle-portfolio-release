import { React, useRef, useState } from '../../shared/react.js';
import { Icon } from '../../shared/icons.js';
import { useAppRuntime, useAppState } from '../../app/app.context.js';
import { LoadingMark } from '../../shared/ui/LoadingMark.js';
export function UploadDropzone() {
    const runtime = useAppRuntime();
    const state = useAppState();
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const visualReady = state.indexPhase === 'hybrid';
    const indexing = state.indexPhase === 'visualizing';
    const disabled = !state.corpus || indexing;
    const progress = state.visualIndexProgress;
    if (!runtime.experimentalVisual)
        return null;
    const accept = (file) => {
        if (!disabled && file?.type.startsWith('image/'))
            void runtime.searchUpload(file);
    };
    const title = visualReady || (!indexing && state.corpus)
        ? 'Search with an image'
        : indexing
            ? 'Preparing image search'
            : 'Image search unavailable';
    const note = visualReady
        ? `drop or choose an image · ${progress.total || 0} visual references ready`
        : indexing
            ? `${progress.completed}/${progress.total} local artworks analyzed`
            : 'drop or choose an image';
    return (React.createElement("div", { className: `upload-dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`, onDragEnter: (event) => { event.preventDefault(); if (!disabled)
            setDragging(true); }, onDragOver: (event) => event.preventDefault(), onDragLeave: () => setDragging(false), onDrop: (event) => {
            event.preventDefault();
            setDragging(false);
            accept(event.dataTransfer.files?.[0]);
        } },
        React.createElement("input", { ref: inputRef, type: "file", accept: "image/*", disabled: disabled, onChange: (event) => accept(event.currentTarget.files?.[0]), tabIndex: -1, "aria-hidden": "true" }),
        React.createElement("button", { type: "button", disabled: disabled, onClick: () => inputRef.current?.click(), "aria-describedby": "upload-note" },
            indexing ? React.createElement(LoadingMark, { label: "Building the visual preview index" }) : React.createElement(Icon, { name: "image", size: 31 }),
            React.createElement("span", null, title),
            React.createElement("small", { id: "upload-note" }, note))));
}
//# sourceMappingURL=UploadDropzone.js.map