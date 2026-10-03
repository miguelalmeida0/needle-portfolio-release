import { normalizeVector } from '../../vector-engine/src/distance.js';
import { VISUAL_VECTOR_LENGTH } from './embedding-schema.js';
const SAMPLE_SIZE = 48;
export async function describeImageFile(file) {
    const bitmap = await createImageBitmap(file);
    try {
        return describeBitmap(bitmap);
    }
    finally {
        bitmap.close();
    }
}
export async function describeImageUrl(url) {
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok)
        throw new Error(`Image request failed with ${response.status}`);
    return describeImageFile(await response.blob());
}
function describeBitmap(bitmap) {
    const canvas = createCanvas(SAMPLE_SIZE, SAMPLE_SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context)
        throw new Error('Canvas 2D is unavailable for visual indexing.');
    context.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const pixels = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const vector = new Float32Array(VISUAL_VECTOR_LENGTH);
    const luminance = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE);
    for (let pixel = 0; pixel < SAMPLE_SIZE * SAMPLE_SIZE; pixel += 1) {
        const offset = pixel * 4;
        const red = (pixels[offset] ?? 0) / 255;
        const green = (pixels[offset + 1] ?? 0) / 255;
        const blue = (pixels[offset + 2] ?? 0) / 255;
        const [hue, saturation, lightness] = rgbToHsl(red, green, blue);
        increment(vector, Math.min(7, Math.floor(hue * 8)), 1);
        increment(vector, 8 + Math.min(3, Math.floor(saturation * 4)), 1);
        increment(vector, 12 + Math.min(3, Math.floor(lightness * 4)), 1);
        luminance[pixel] = red * .2126 + green * .7152 + blue * .0722;
        const x = pixel % SAMPLE_SIZE;
        const y = Math.floor(pixel / SAMPLE_SIZE);
        const cellX = Math.min(3, Math.floor(x / (SAMPLE_SIZE / 4)));
        const cellY = Math.min(2, Math.floor(y / (SAMPLE_SIZE / 3)));
        increment(vector, 20 + cellY * 4 + cellX, luminance[pixel] ?? 0);
    }
    for (let y = 1; y < SAMPLE_SIZE - 1; y += 1) {
        for (let x = 1; x < SAMPLE_SIZE - 1; x += 1) {
            const index = y * SAMPLE_SIZE + x;
            const gx = (luminance[index + 1] ?? 0) - (luminance[index - 1] ?? 0);
            const gy = (luminance[index + SAMPLE_SIZE] ?? 0) - (luminance[index - SAMPLE_SIZE] ?? 0);
            const magnitude = Math.hypot(gx, gy);
            if (magnitude < .035)
                continue;
            const angle = (Math.atan2(gy, gx) + Math.PI) / (Math.PI * 2);
            increment(vector, 16 + Math.min(3, Math.floor(angle * 4)), magnitude);
        }
    }
    return normalizeVector(vector);
}
function increment(vector, index, amount) {
    vector[index] = (vector[index] ?? 0) + amount;
}
function createCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined')
        return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
function rgbToHsl(red, green, blue) {
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const lightness = (maximum + minimum) / 2;
    if (maximum === minimum)
        return [0, 0, lightness];
    const delta = maximum - minimum;
    const saturation = lightness > .5 ? delta / (2 - maximum - minimum) : delta / (maximum + minimum);
    let hue = 0;
    if (maximum === red)
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (maximum === green)
        hue = (blue - red) / delta + 2;
    else
        hue = (red - green) / delta + 4;
    return [hue / 6, saturation, lightness];
}
//# sourceMappingURL=visual-descriptor.js.map