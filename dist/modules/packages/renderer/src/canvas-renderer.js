export class CanvasSpatialRenderer {
    kind = 'canvas2d';
    #canvas;
    #context;
    constructor(canvas) {
        const context = canvas.getContext('2d');
        if (!context)
            throw new Error('Canvas 2D is unavailable.');
        this.#canvas = canvas;
        this.#context = context;
    }
    render(scene) {
        const { width, height, devicePixelRatio } = scene;
        const pixelWidth = Math.max(1, Math.floor(width * devicePixelRatio));
        const pixelHeight = Math.max(1, Math.floor(height * devicePixelRatio));
        if (this.#canvas.width !== pixelWidth || this.#canvas.height !== pixelHeight) {
            this.#canvas.width = pixelWidth;
            this.#canvas.height = pixelHeight;
            this.#canvas.style.width = `${width}px`;
            this.#canvas.style.height = `${height}px`;
        }
        const context = this.#context;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.fillStyle = '#f8f7f2';
        context.fillRect(0, 0, width, height);
        for (const connection of scene.connections) {
            context.beginPath();
            context.moveTo(connection.fromX * width, connection.fromY * height);
            context.lineTo(connection.toX * width, connection.toY * height);
            context.strokeStyle = connection.emphasis === 'neighbor'
                ? 'rgba(72, 116, 255, .52)'
                : connection.emphasis === 'trace'
                    ? 'rgba(66, 108, 236, .25)'
                    : 'rgba(71, 83, 78, .045)';
            context.lineWidth = connection.emphasis === 'neighbor' ? 1.25 : 0.75;
            context.stroke();
        }
        for (const point of scene.points) {
            const x = point.x * width;
            const y = point.y * height;
            context.beginPath();
            context.arc(x, y, point.highlighted ? 3.2 : point.visited ? 1.9 : .85, 0, Math.PI * 2);
            context.fillStyle = point.highlighted
                ? 'rgba(72, 116, 255, .78)'
                : point.visited
                    ? 'rgba(72, 116, 255, .32)'
                    : 'rgba(54, 62, 58, .075)';
            context.fill();
        }
    }
    destroy() {
        this.#context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
}
//# sourceMappingURL=canvas-renderer.js.map