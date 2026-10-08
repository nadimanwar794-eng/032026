// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Check,
  RotateCw,
  Crop as CropIcon,
  RefreshCw,
  Maximize2,
} from 'lucide-react';

export interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImage: string) => void;
  onCancel: () => void;
  title?: string;
  saveButtonText?: string;
  initialAspect?: number | null;
}

interface CropRect {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized
  width: number; // 0 to 1 normalized
  height: number; // 0 to 1 normalized
}

const DEFAULT_CROP: CropRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

async function getCroppedImg(
  imageSrc: string,
  crop: CropRect,
  rotation = 0
): Promise<string | null> {
  const image = await createImage(imageSrc);
  const rad = (rotation * Math.PI) / 180;

  // Normalized crop bounds clamped to [0, 1]
  const clampedX = clamp(crop.x, 0, 1);
  const clampedY = clamp(crop.y, 0, 1);
  const clampedW = clamp(crop.width, 0.01, 1 - clampedX);
  const clampedH = clamp(crop.height, 0.01, 1 - clampedY);

  const isRotated90or270 = rotation % 180 !== 0;
  const rotatedW = isRotated90or270 ? image.naturalHeight : image.naturalWidth;
  const rotatedH = isRotated90or270 ? image.naturalWidth : image.naturalHeight;

  // Intermediate canvas for rotation at natural source resolution
  const intermediateCanvas = document.createElement('canvas');
  intermediateCanvas.width = rotatedW;
  intermediateCanvas.height = rotatedH;
  const intCtx = intermediateCanvas.getContext('2d');
  if (!intCtx) return null;

  intCtx.translate(rotatedW / 2, rotatedH / 2);
  intCtx.rotate(rad);
  intCtx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  // Target cropped canvas
  const targetX = Math.round(clampedX * rotatedW);
  const targetY = Math.round(clampedY * rotatedH);
  const targetW = Math.max(1, Math.round(clampedW * rotatedW));
  const targetH = Math.max(1, Math.round(clampedH * rotatedH));

  const targetCanvas = document.createElement('canvas');
  targetCanvas.width = targetW;
  targetCanvas.height = targetH;
  const targetCtx = targetCanvas.getContext('2d');
  if (!targetCtx) return null;

  targetCtx.drawImage(
    intermediateCanvas,
    targetX,
    targetY,
    targetW,
    targetH,
    0,
    0,
    targetW,
    targetH
  );

  return targetCanvas.toDataURL('image/jpeg', 0.92);
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  imageSrc,
  onCropComplete,
  onCancel,
  title = 'Photo Crop Karein',
  saveButtonText = 'Crop Apply Karein ✅',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState<CropRect>(DEFAULT_CROP);
  const [rotation, setRotation] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);

  // Display box dimensions in CSS pixels inside the container
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Drag state
  const dragStateRef = useRef<{
    active: boolean;
    handle: string;
    startX: number;
    startY: number;
    startCrop: CropRect;
  }>({
    active: false,
    handle: '',
    startX: 0,
    startY: 0,
    startCrop: DEFAULT_CROP,
  });

  // Load source image
  useEffect(() => {
    let isMounted = true;
    createImage(imageSrc)
      .then((img) => {
        if (!isMounted) return;
        imageObjRef.current = img;
        setImgLoaded(true);
      })
      .catch((err) => {
        console.error('Failed to load image for cropping:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [imageSrc]);

  // Compute fitted display dimensions whenever container or rotation changes
  const updateDisplaySize = useCallback(() => {
    if (!containerRef.current || !imageObjRef.current) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const img = imageObjRef.current;
    const isRot = rotation % 180 !== 0;
    const effW = isRot ? img.naturalHeight : img.naturalWidth;
    const effH = isRot ? img.naturalWidth : img.naturalHeight;

    const pad = 24;
    const maxW = Math.max(100, cw - pad);
    const maxH = Math.max(100, ch - pad);

    const scale = Math.min(maxW / effW, maxH / effH);
    const dispW = Math.round(effW * scale);
    const dispH = Math.round(effH * scale);

    setDisplaySize({ width: dispW, height: dispH });
  }, [rotation]);

  useEffect(() => {
    if (imgLoaded) {
      updateDisplaySize();
    }
  }, [imgLoaded, rotation, updateDisplaySize]);

  // Observe container resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateDisplaySize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateDisplaySize]);

  // Render rotated image to display canvas
  useEffect(() => {
    if (!canvasRef.current || !imageObjRef.current || displaySize.width === 0) return;
    const canvas = canvasRef.current;
    const img = imageObjRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = displaySize.width * dpr;
    canvas.height = displaySize.height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize.width, displaySize.height);

    ctx.translate(displaySize.width / 2, displaySize.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const isRot = rotation % 180 !== 0;
    const dw = isRot ? displaySize.height : displaySize.width;
    const dh = isRot ? displaySize.width : displaySize.height;

    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }, [displaySize, rotation]);

  // Start drag handler for corner, edge, or move
  const startDrag = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragStateRef.current = {
      active: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStateRef.current.active || displaySize.width === 0) return;
    const { handle, startX, startY, startCrop } = dragStateRef.current;

    const deltaX = (e.clientX - startX) / displaySize.width;
    const deltaY = (e.clientY - startY) / displaySize.height;

    const minW = Math.max(0.04, 32 / displaySize.width);
    const minH = Math.max(0.04, 32 / displaySize.height);

    setCrop(() => {
      let { x, y, width, height } = startCrop;

      switch (handle) {
        case 'move': {
          x = clamp(startCrop.x + deltaX, 0, 1 - startCrop.width);
          y = clamp(startCrop.y + deltaY, 0, 1 - startCrop.height);
          break;
        }
        case 'se': {
          width = clamp(startCrop.width + deltaX, minW, 1 - startCrop.x);
          height = clamp(startCrop.height + deltaY, minH, 1 - startCrop.y);
          break;
        }
        case 'nw': {
          const maxDx = startCrop.width - minW;
          const dx = clamp(deltaX, -startCrop.x, maxDx);
          x = startCrop.x + dx;
          width = startCrop.width - dx;

          const maxDy = startCrop.height - minH;
          const dy = clamp(deltaY, -startCrop.y, maxDy);
          y = startCrop.y + dy;
          height = startCrop.height - dy;
          break;
        }
        case 'ne': {
          const maxDy = startCrop.height - minH;
          const dy = clamp(deltaY, -startCrop.y, maxDy);
          y = startCrop.y + dy;
          height = startCrop.height - dy;
          width = clamp(startCrop.width + deltaX, minW, 1 - startCrop.x);
          break;
        }
        case 'sw': {
          const maxDx = startCrop.width - minW;
          const dx = clamp(deltaX, -startCrop.x, maxDx);
          x = startCrop.x + dx;
          width = startCrop.width - dx;
          height = clamp(startCrop.height + deltaY, minH, 1 - startCrop.y);
          break;
        }
        case 'n': {
          const maxDy = startCrop.height - minH;
          const dy = clamp(deltaY, -startCrop.y, maxDy);
          y = startCrop.y + dy;
          height = startCrop.height - dy;
          break;
        }
        case 's': {
          height = clamp(startCrop.height + deltaY, minH, 1 - startCrop.y);
          break;
        }
        case 'w': {
          const maxDx = startCrop.width - minW;
          const dx = clamp(deltaX, -startCrop.x, maxDx);
          x = startCrop.x + dx;
          width = startCrop.width - dx;
          break;
        }
        case 'e': {
          width = clamp(startCrop.width + deltaX, minW, 1 - startCrop.x);
          break;
        }
      }

      return { x, y, width, height };
    });
  };

  const stopDrag = (e?: React.PointerEvent) => {
    if (dragStateRef.current.active) {
      if (e) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {}
      }
      dragStateRef.current.active = false;
    }
  };

  const handleReset = () => {
    setCrop(DEFAULT_CROP);
    setRotation(0);
  };

  const handleRotate90 = () => {
    setRotation((r) => (r + 90) % 360);
    setCrop(DEFAULT_CROP);
  };

  const handleSave = async () => {
    try {
      setIsProcessing(true);
      const croppedImage = await getCroppedImg(imageSrc, crop, rotation);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error('Failed to crop image:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert crop normalized to pixel values for overlay rendering
  const boxLeft = crop.x * displaySize.width;
  const boxTop = crop.y * displaySize.height;
  const boxWidth = crop.width * displaySize.width;
  const boxHeight = crop.height * displaySize.height;

  return (
    <div
      className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-2 sm:p-4 select-none animate-in fade-in"
      onClick={(e) => e.stopPropagation()}
      onPointerUp={stopDrag}
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[92vh] max-h-[660px]">
        {/* Header */}
        <div className="bg-slate-950 text-white px-4 py-3 flex justify-between items-center border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
              <CropIcon size={16} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wide flex items-center gap-2">
                <span>{title}</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold rounded-md border border-emerald-500/30">
                  Free Size
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Corners ya edges ko drag karke apni pasand ka size chunein
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs"
              title="Full Reset"
            >
              <RefreshCw size={15} />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Cancel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Freeform Cropper Viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-slate-950 overflow-hidden flex items-center justify-center p-3 select-none touch-none"
          onPointerMove={onPointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          {imgLoaded && displaySize.width > 0 ? (
            <div
              style={{
                width: displaySize.width,
                height: displaySize.height,
              }}
              className="relative select-none touch-none shadow-2xl"
            >
              {/* Image Canvas with rotation applied */}
              <canvas
                ref={canvasRef}
                style={{
                  width: displaySize.width,
                  height: displaySize.height,
                }}
                className="block pointer-events-none rounded-sm"
              />

              {/* Outside Dark Overlay (4 sides surrounding the crop box) */}
              {/* Top Mask */}
              <div
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: Math.max(0, boxTop),
                }}
                className="absolute bg-black/65 backdrop-blur-[0.5px] pointer-events-none"
              />
              {/* Bottom Mask */}
              <div
                style={{
                  top: boxTop + boxHeight,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
                className="absolute bg-black/65 backdrop-blur-[0.5px] pointer-events-none"
              />
              {/* Left Mask */}
              <div
                style={{
                  top: boxTop,
                  height: boxHeight,
                  left: 0,
                  width: Math.max(0, boxLeft),
                }}
                className="absolute bg-black/65 backdrop-blur-[0.5px] pointer-events-none"
              />
              {/* Right Mask */}
              <div
                style={{
                  top: boxTop,
                  height: boxHeight,
                  left: boxLeft + boxWidth,
                  right: 0,
                }}
                className="absolute bg-black/65 backdrop-blur-[0.5px] pointer-events-none"
              />

              {/* Active Crop Box with Draggable Handles */}
              <div
                style={{
                  left: boxLeft,
                  top: boxTop,
                  width: boxWidth,
                  height: boxHeight,
                }}
                className="absolute border-2 border-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.6)] touch-none"
              >
                {/* Center Move Area */}
                <div
                  className="absolute inset-0 cursor-move"
                  onPointerDown={(e) => startDrag(e, 'move')}
                  title="Drag karke position change karein"
                />

                {/* Rule of Thirds Grid Lines (dashed white) */}
                <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-r border-b border-white/30" />
                  <div className="border-b border-white/30" />
                  <div className="border-r border-white/30" />
                  <div className="border-r border-white/30" />
                  <div />
                </div>

                {/* ── 4 CORNER HANDLES (WhatsApp Style L-Brackets) ── */}
                {/* Top-Left Corner */}
                <div
                  onPointerDown={(e) => startDrag(e, 'nw')}
                  className="absolute -top-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize touch-none z-20 group"
                  title="Top-Left corner drag karein"
                >
                  <div className="w-4 h-4 border-t-[3.5px] border-l-[3.5px] border-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-125" />
                </div>

                {/* Top-Right Corner */}
                <div
                  onPointerDown={(e) => startDrag(e, 'ne')}
                  className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize touch-none z-20 group"
                  title="Top-Right corner drag karein"
                >
                  <div className="w-4 h-4 border-t-[3.5px] border-r-[3.5px] border-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-125" />
                </div>

                {/* Bottom-Left Corner */}
                <div
                  onPointerDown={(e) => startDrag(e, 'sw')}
                  className="absolute -bottom-3 -left-3 w-8 h-8 flex items-center justify-center cursor-nesw-resize touch-none z-20 group"
                  title="Bottom-Left corner drag karein"
                >
                  <div className="w-4 h-4 border-b-[3.5px] border-l-[3.5px] border-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-125" />
                </div>

                {/* Bottom-Right Corner */}
                <div
                  onPointerDown={(e) => startDrag(e, 'se')}
                  className="absolute -bottom-3 -right-3 w-8 h-8 flex items-center justify-center cursor-nwse-resize touch-none z-20 group"
                  title="Bottom-Right corner drag karein"
                >
                  <div className="w-4 h-4 border-b-[3.5px] border-r-[3.5px] border-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] transition-transform group-hover:scale-125" />
                </div>

                {/* ── 4 EDGE HANDLES (White Pill Bars) ── */}
                {/* Top Edge */}
                <div
                  onPointerDown={(e) => startDrag(e, 'n')}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center cursor-ns-resize touch-none z-20 group"
                  title="Upar se drag karein"
                >
                  <div className="w-6 h-1.5 bg-white rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                {/* Bottom Edge */}
                <div
                  onPointerDown={(e) => startDrag(e, 's')}
                  className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-12 h-6 flex items-center justify-center cursor-ns-resize touch-none z-20 group"
                  title="Neeche se drag karein"
                >
                  <div className="w-6 h-1.5 bg-white rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                {/* Left Edge */}
                <div
                  onPointerDown={(e) => startDrag(e, 'w')}
                  className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 flex items-center justify-center cursor-ew-resize touch-none z-20 group"
                  title="Left se drag karein"
                >
                  <div className="w-1.5 h-6 bg-white rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" />
                </div>

                {/* Right Edge */}
                <div
                  onPointerDown={(e) => startDrag(e, 'e')}
                  className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-12 flex items-center justify-center cursor-ew-resize touch-none z-20 group"
                  title="Right se drag karein"
                >
                  <div className="w-1.5 h-6 bg-white rounded-full drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] group-hover:scale-125 transition-transform" />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Photo taiyar ho rahi hai...</span>
            </div>
          )}
        </div>

        {/* Bottom Bar: Action Controls */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Rotate 90 Button */}
            <button
              type="button"
              onClick={handleRotate90}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Photo ko 90 degree rotate karein"
            >
              <RotateCw size={15} className="text-purple-400" />
              <span>Rotate 90°</span>
            </button>

            {/* Fit Full Button */}
            <button
              type="button"
              onClick={() => setCrop(DEFAULT_CROP)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Poori image select karein"
            >
              <Maximize2 size={15} className="text-emerald-400" />
              <span>Poori Photo</span>
            </button>

            <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
              Free Size (Apni marzi se cut karein)
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 py-2.5 text-slate-300 font-bold border border-slate-700 rounded-xl hover:bg-slate-800 text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing || !imgLoaded}
              className="flex-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Crop ho rahi hai...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>{saveButtonText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
