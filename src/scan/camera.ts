import type { RGB } from '../app/session';
import { sampleGrid } from './sample';

// Share of the visible square that the 3x3 guide covers. scan.css insets the grid to match.
export const GRID_FRACTION = 0.84;

// Back camera, played in-page (iOS Safari needs playsinline and muted for that).
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('No camera on this device or page');
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  video.setAttribute('playsinline', '');
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.muted = true;
  video.srcObject = stream;
  await video.play().catch(() => undefined); // autoplay attribute still starts it if play() is refused
  return stream;
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

// Draws the part of the video under the guide grid into a size x size canvas and samples its 9 cells.
// The video fills a square box with object-fit: cover, so the visible part is the centered square.
export function grabCells(video: HTMLVideoElement, canvas: HTMLCanvasElement, size: number): RGB[] | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  const side = Math.min(vw, vh) * GRID_FRACTION;
  if (canvas.width !== size) canvas.width = size;
  if (canvas.height !== size) canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
  return sampleGrid(ctx.getImageData(0, 0, size, size).data, size, size);
}
