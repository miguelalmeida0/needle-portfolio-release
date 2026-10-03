export class DeterministicRandom {
    #state;
    constructor(seed = 0x9e3779b9) {
        this.#state = seed >>> 0;
    }
    next() {
        let value = this.#state;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.#state = value >>> 0;
        return this.#state / 0x1_0000_0000;
    }
}
//# sourceMappingURL=random.js.map