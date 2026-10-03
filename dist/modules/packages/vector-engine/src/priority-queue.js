export class PriorityQueue {
    #items = [];
    #compare;
    constructor(compare) {
        this.#compare = compare;
    }
    get size() {
        return this.#items.length;
    }
    peek() {
        return this.#items[0];
    }
    push(value) {
        this.#items.push(value);
        this.#bubbleUp(this.#items.length - 1);
    }
    pop() {
        if (this.#items.length === 0)
            return undefined;
        const root = this.#items[0];
        const tail = this.#items.pop();
        if (this.#items.length > 0 && tail !== undefined) {
            this.#items[0] = tail;
            this.#sinkDown(0);
        }
        return root;
    }
    toArray() {
        return [...this.#items];
    }
    #bubbleUp(startIndex) {
        let index = startIndex;
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.#compare(this.#items[index], this.#items[parentIndex]) >= 0)
                break;
            [this.#items[index], this.#items[parentIndex]] = [this.#items[parentIndex], this.#items[index]];
            index = parentIndex;
        }
    }
    #sinkDown(startIndex) {
        let index = startIndex;
        while (true) {
            const leftIndex = index * 2 + 1;
            const rightIndex = leftIndex + 1;
            let best = index;
            if (leftIndex < this.#items.length && this.#compare(this.#items[leftIndex], this.#items[best]) < 0)
                best = leftIndex;
            if (rightIndex < this.#items.length && this.#compare(this.#items[rightIndex], this.#items[best]) < 0)
                best = rightIndex;
            if (best === index)
                return;
            [this.#items[index], this.#items[best]] = [this.#items[best], this.#items[index]];
            index = best;
        }
    }
}
//# sourceMappingURL=priority-queue.js.map