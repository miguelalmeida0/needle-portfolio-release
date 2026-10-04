import { hexToRgba } from './color.js';
const SHADER = `
struct VertexInput {
  @location(0) position: vec2f,
  @location(1) color: vec4f,
};
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
};
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(input.position, 0.0, 1.0);
  output.color = input.color;
  return output;
}
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`;
export class WebGpuSpatialRenderer {
    kind = 'webgpu';
    #canvas;
    #device;
    #context;
    #pipeline;
    #format;
    #vertexBuffer = null;
    #bufferCapacity = 0;
    constructor(canvas, device, context, pipeline, format) {
        this.#canvas = canvas;
        this.#device = device;
        this.#context = context;
        this.#pipeline = pipeline;
        this.#format = format;
    }
    static async create(canvas) {
        const gpu = navigator.gpu;
        if (!gpu)
            throw new Error('WebGPU is unavailable.');
        const adapter = await gpu.requestAdapter({ powerPreference: 'low-power' });
        if (!adapter)
            throw new Error('No WebGPU adapter was found.');
        const device = await adapter.requestDevice();
        const context = canvas.getContext('webgpu');
        if (!context)
            throw new Error('WebGPU canvas context is unavailable.');
        const format = gpu.getPreferredCanvasFormat();
        const module = device.createShaderModule({ code: SHADER });
        const pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module,
                entryPoint: 'vertexMain',
                buffers: [{
                        arrayStride: 24,
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x2' },
                            { shaderLocation: 1, offset: 8, format: 'float32x4' }
                        ]
                    }]
            },
            fragment: {
                module,
                entryPoint: 'fragmentMain',
                targets: [{
                        format,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        }
                    }]
            },
            primitive: { topology: 'line-list' }
        });
        return new WebGpuSpatialRenderer(canvas, device, context, pipeline, format);
    }
    render(scene) {
        const pixelWidth = Math.max(1, Math.floor(scene.width * scene.devicePixelRatio));
        const pixelHeight = Math.max(1, Math.floor(scene.height * scene.devicePixelRatio));
        if (this.#canvas.width !== pixelWidth || this.#canvas.height !== pixelHeight) {
            this.#canvas.width = pixelWidth;
            this.#canvas.height = pixelHeight;
            this.#canvas.style.width = `${scene.width}px`;
            this.#canvas.style.height = `${scene.height}px`;
            this.#context.configure({ device: this.#device, format: this.#format, alphaMode: 'opaque' });
        }
        const vertices = [];
        const push = (x, y, color) => {
            vertices.push(x * 2 - 1, 1 - y * 2, color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 1);
        };
        for (const connection of scene.connections) {
            const color = connection.emphasis === 'neighbor'
                ? hexToRgba(scene.selectionColor, 0.40)
                : connection.emphasis === 'trace'
                    ? hexToRgba(scene.selectionColor, 0.16)
                    : [0.22, 0.26, 0.24, 0.045];
            push(connection.fromX, connection.fromY, color);
            push(connection.toX, connection.toY, color);
        }
        const dx = 0.9 / Math.max(1, scene.width);
        const dy = 0.9 / Math.max(1, scene.height);
        for (const point of scene.points) {
            const color = point.highlighted
                ? hexToRgba(scene.selectionColor, 0.8)
                : point.visited
                    ? hexToRgba(scene.selectionColor, 0.28)
                    : hexToRgba(point.clusterColor, 0.075);
            push(point.x - dx, point.y, color);
            push(point.x + dx, point.y, color);
            push(point.x, point.y - dy, color);
            push(point.x, point.y + dy, color);
        }
        const data = new Float32Array(vertices);
        const usage = globalThis.GPUBufferUsage;
        if (!usage)
            throw new Error('WebGPU buffer constants are unavailable.');
        if (!this.#vertexBuffer || data.byteLength > this.#bufferCapacity) {
            this.#vertexBuffer?.destroy?.();
            this.#bufferCapacity = Math.max(data.byteLength, 4096);
            this.#vertexBuffer = this.#device.createBuffer({
                size: this.#bufferCapacity,
                usage: usage.VERTEX | usage.COPY_DST
            });
        }
        this.#device.queue.writeBuffer(this.#vertexBuffer, 0, data);
        const encoder = this.#device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                    view: this.#context.getCurrentTexture().createView(),
                    clearValue: { r: 0.973, g: 0.969, b: 0.949, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }]
        });
        pass.setPipeline(this.#pipeline);
        pass.setVertexBuffer(0, this.#vertexBuffer);
        if (data.length > 0)
            pass.draw(data.length / 6);
        pass.end();
        this.#device.queue.submit([encoder.finish()]);
    }
    destroy() {
        this.#vertexBuffer?.destroy?.();
        this.#vertexBuffer = null;
    }
}
