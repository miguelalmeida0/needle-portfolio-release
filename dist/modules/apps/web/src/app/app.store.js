import { appReducer, initialAppState } from './app.reducer.js';
export class AppStore {
    #state = initialAppState;
    #listeners = new Set();
    getSnapshot = () => this.#state;
    subscribe = (listener) => {
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    };
    dispatch(event) {
        const nextState = appReducer(this.#state, event);
        if (nextState === this.#state)
            return;
        this.#state = nextState;
        for (const listener of this.#listeners)
            listener();
    }
}
//# sourceMappingURL=app.store.js.map