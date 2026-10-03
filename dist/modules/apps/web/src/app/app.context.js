import { React, createContext, useContext, useSyncExternalStore, useRef } from '../shared/react.js';
const RuntimeContext = createContext(null);
export function AppRuntimeProvider(props) {
    return React.createElement(RuntimeContext.Provider, { value: props.runtime }, props.children);
}
export function useAppRuntime() {
    const runtime = useContext(RuntimeContext);
    if (!runtime)
        throw new Error('AppRuntimeProvider is missing.');
    return runtime;
}
export function useAppState() {
    const runtime = useAppRuntime();
    return useSyncExternalStore(runtime.store.subscribe, runtime.store.getSnapshot, runtime.store.getSnapshot);
}
export function useAppSelector(select) {
    const runtime = useAppRuntime();
    const previous = useRef(null);
    const snapshot = () => {
        const state = runtime.store.getSnapshot();
        if (previous.current?.state === state)
            return previous.current.value;
        const value = select(state);
        if (!previous.current || !Object.is(previous.current.value, value))
            previous.current = { state, value };
        return previous.current.value;
    };
    return useSyncExternalStore(runtime.store.subscribe, snapshot, snapshot);
}
export function useGalleryState() {
    const previous = useRef(null);
    return useAppSelector(state => {
        const last = previous.current;
        const ignored = new Set(['draftQuery', 'corpusImageProgress', 'indexBuildProgress', 'visualIndexProgress', 'feedbackMessage']);
        if (last && Object.keys(state).every(key => ignored.has(key) || Object.is(last[key], state[key])))
            return last;
        previous.current = state;
        return state;
    });
}
//# sourceMappingURL=app.context.js.map