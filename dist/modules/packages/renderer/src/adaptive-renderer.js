import { CanvasSpatialRenderer } from './canvas-renderer.js';
import { WebGpuSpatialRenderer } from './webgpu-renderer.js';
export async function createSpatialRenderer(canvas) {
    try {
        return await WebGpuSpatialRenderer.create(canvas);
    }
    catch {
        return new CanvasSpatialRenderer(canvas);
    }
}
//# sourceMappingURL=adaptive-renderer.js.map