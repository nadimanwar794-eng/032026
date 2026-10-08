import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Upload, X, Check, Trash2, AlertCircle, ZoomIn, ZoomOut, RotateCw, Move, Scissors } from 'lucide-react';
import { hapticMedium, hapticSuccess } from '../utils/haptic';

interface ProfileCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotoURL?: string;
  userName?: string;
  onSavePhoto: (photoDataUrl: string) => Promise<void> | void;
  onRemovePhoto?: () => Promise<void> | void;
}

export const ProfileCameraModal: React.FC<ProfileCameraModalProps> = ({
  isOpen,
  onClose,
  currentPhotoURL,
  userName = 'Student',
  onSavePhoto,
  onRemovePhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'CAMERA' | 'FILE'>('CAMERA');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [streamTimedOut, setStreamTimedOut] = useState(false);

  // Raw image loaded for cropping (DataURL) - ONLY used for Gallery/File
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  // Directly captured photo from Camera (Selfie)
  const [capturedCameraPreview, setCapturedCameraPreview] = useState<string | null>(null);
  // Cropper transform states
  const [cropZoom, setCropZoom] = useState<number>(1.0);
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropRotation, setCropRotation] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraTimeoutRef = useRef<any>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const frontCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Cropper canvas ref & drag state
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Keep currentPanRef in sync
  useEffect(() => {
    currentPanRef.current = cropPan;
  }, [cropPan]);

  // Stop camera stream safely - stable reference, no dependencies to prevent re-render loops
  const stopCamera = useCallback(() => {
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
    if (cameraStreamRef.current) {
      try {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraLoading(false);
  }, []);

  // Trigger Phone Native Front Camera directly (100% reliable selfie on all mobile devices)
  const triggerPhoneCamera = useCallback(() => {
    try { hapticMedium(); } catch (_) {}
    frontCameraInputRef.current?.click();
  }, []);

  // Start live front camera (selfie) stream inside the app
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setIsCameraLoading(true);
    setStreamTimedOut(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Aapke browser mein direct live camera support nahi hai.');
      }

      let stream: MediaStream | null = null;

      // Primary attempt: standard fast front camera without restrictive width/height
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });
      } catch (e1) {
        // Fallback: any video device
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e2) {
          throw new Error('Camera access nahi mila.');
        }
      }

      if (!stream) {
        throw new Error('Camera stream shuru nahi ho paya.');
      }

      cameraStreamRef.current = stream;
      if (videoRef.current) {
        const v = videoRef.current;
        v.srcObject = stream;
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', 'true');
        v.setAttribute('webkit-playsinline', 'true');
        v.play().catch(() => {});
      }
      setIsCameraLoading(false);
      setStreamTimedOut(false);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setIsCameraLoading(false);
      setCameraError('Camera start nahi ho saka. Browser me camera permission check karein.');
    }
  }, [stopCamera]);

  // Manage camera lifecycle
  useEffect(() => {
    if (isOpen && activeTab === 'CAMERA' && !imageToCrop && !capturedCameraPreview) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab, imageToCrop, capturedCameraPreview, startCamera, stopCamera]);

  // Snap photo from live Front Camera feed INSIDE THE APP (Never redirects to phone camera)
  const capturePhoto = () => {
    try { hapticMedium(); } catch (_) {}
    const video = videoRef.current;
    
    if (!video || !cameraStreamRef.current) {
      // Re-trigger live camera if not active
      startCamera();
      return;
    }

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    const size = Math.min(w, h);

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Center crop square from video feed
    const sx = Math.max(0, (w - size) / 2);
    const sy = Math.max(0, (h - size) / 2);

    // Front camera (selfie) mirror horizontally for natural feel
    ctx.translate(400, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

    const rawData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedCameraPreview(rawData);
    stopCamera();
    try { hapticSuccess(); } catch (_) {}
  };

  // Handle photo from Phone Native Camera (Selfie or Back) - DIRECT TO PREVIEW, NO CROPPING
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height);
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const sx = Math.max(0, (img.width - size) / 2);
          const sy = Math.max(0, (img.height - size) / 2);
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
          setCapturedCameraPreview(dataUrl);
          stopCamera();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Handle image selected from Gallery - ONLY GALLERY gets the Cropper!
  const handleGallerySelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        openCropperWithImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Confirm and Save directly captured camera photo
  const handleConfirmSaveCameraPhoto = async () => {
    if (!capturedCameraPreview) return;
    try {
      setIsSaving(true);
      await onSavePhoto(capturedCameraPreview);
      hapticSuccess();
      onClose();
    } catch (e) {
      console.error('Failed to save camera photo:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Open cropper with given image src (exclusively for Gallery photos)
  const openCropperWithImage = (src: string) => {
    const img = new Image();
    img.onload = () => {
      cropImageRef.current = img;
      setImageToCrop(src);
      setCropZoom(1.0);
      setCropPan({ x: 0, y: 0 });
      setCropRotation(0);
      stopCamera();
    };
    img.src = src;
  };

  // Draw the crop preview onto canvas (240x240 circular viewport)
  const renderCropCanvas = useCallback(() => {
    const canvas = cropCanvasRef.current;
    const img = cropImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const VIEW_SIZE = 240;
    canvas.width = VIEW_SIZE;
    canvas.height = VIEW_SIZE;

    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    // Calculate base scale so image covers the circle
    const baseScale = Math.max(VIEW_SIZE / img.width, VIEW_SIZE / img.height);
    const finalScale = baseScale * cropZoom;

    ctx.save();

    // Circular Clip Path for live preview
    ctx.beginPath();
    ctx.arc(VIEW_SIZE / 2, VIEW_SIZE / 2, VIEW_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Dark backdrop behind image
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, VIEW_SIZE, VIEW_SIZE);

    // Transform: Translate to center + pan, rotate, scale
    ctx.translate(VIEW_SIZE / 2 + cropPan.x, VIEW_SIZE / 2 + cropPan.y);
    ctx.rotate((cropRotation * Math.PI) / 180);
    ctx.scale(finalScale, finalScale);

    // Draw centered
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    ctx.restore();
  }, [cropZoom, cropPan, cropRotation]);

  useEffect(() => {
    if (imageToCrop) {
      renderCropCanvas();
    }
  }, [imageToCrop, renderCropCanvas]);

  // Touch and Mouse Drag handlers for panning the photo
  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: clientX - currentPanRef.current.x, y: clientY - currentPanRef.current.y };
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const newX = clientX - dragStartRef.current.x;
    const newY = clientY - dragStartRef.current.y;
    // Bound the pan slightly so image doesn't fly off screen
    const maxBound = 180 * cropZoom;
    const clampedX = Math.max(-maxBound, Math.min(maxBound, newX));
    const clampedY = Math.max(-maxBound, Math.min(maxBound, newY));
    setCropPan({ x: clampedX, y: clampedY });
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
  };

  // Perform Final Crop & Output high-res 400x400 Profile Photo
  const handleApplyCrop = async () => {
    const img = cropImageRef.current;
    if (!img) return;

    try {
      setIsSaving(true);
      const TARGET_SIZE = 400;
      const VIEW_SIZE = 240;
      const multiplier = TARGET_SIZE / VIEW_SIZE;

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = TARGET_SIZE;
      finalCanvas.height = TARGET_SIZE;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) return;

      // Base cover scale
      const baseScale = Math.max(VIEW_SIZE / img.width, VIEW_SIZE / img.height);
      const finalScale = baseScale * cropZoom * multiplier;

      // Circular clip on final avatar
      ctx.beginPath();
      ctx.arc(TARGET_SIZE / 2, TARGET_SIZE / 2, TARGET_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);

      // Translate to center + scaled pan
      ctx.translate(TARGET_SIZE / 2 + cropPan.x * multiplier, TARGET_SIZE / 2 + cropPan.y * multiplier);
      ctx.rotate((cropRotation * Math.PI) / 180);
      ctx.scale(finalScale, finalScale);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const croppedDataUrl = finalCanvas.toDataURL('image/jpeg', 0.88);
      await onSavePhoto(croppedDataUrl);
      hapticSuccess();
      onClose();
    } catch (e) {
      console.error('Failed to save cropped image:', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Remove Photo handler
  const handleConfirmRemove = async () => {
    if (!onRemovePhoto) return;
    try {
      setIsSaving(true);
      await onRemovePhoto();
      hapticSuccess();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="profile-camera-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center p-3.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-purple-500/30 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden Native File Inputs for 100% Reliable Native Camera & Gallery */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleGallerySelected}
        />
        <input
          ref={frontCameraInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={handleNativeCameraCapture}
        />

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-700 via-pink-600 to-amber-600 p-3.5 sm:p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              {imageToCrop ? <Scissors size={18} /> : <Camera size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">
                {capturedCameraPreview
                  ? 'Confirm Profile Photo'
                  : imageToCrop
                  ? 'Crop & Adjust Photo'
                  : 'Set Profile Picture'}
              </h3>
              <p className="text-[10px] text-purple-200 font-medium">
                {capturedCameraPreview
                  ? 'Apni photo check karein aur confirm karein'
                  : imageToCrop
                  ? 'Circle mein adjust karein aur crop karein'
                  : 'Front Camera (Selfie) ya Gallery se photo lagayein'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-black/20 hover:bg-black/40 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher (Only visible when NOT cropping and NOT previewing camera photo) */}
        {!imageToCrop && !capturedCameraPreview && (
          <div className="p-2.5 bg-slate-950/60 border-b border-white/5 flex gap-2">
            <button
              onClick={() => {
                setActiveTab('CAMERA');
                setImageToCrop(null);
                setCapturedCameraPreview(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'CAMERA'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Camera size={14} />
              <span>Live Camera</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('FILE');
                setImageToCrop(null);
                setCapturedCameraPreview(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'FILE'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Upload size={14} />
              <span>Gallery / File</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 flex flex-col items-center justify-center min-h-[300px]">
          {/* ======================================================== */}
          {/* 1. DIRECT CAMERA PHOTO PREVIEW (NO CROPPING FOR CAMERA)   */}
          {/* ======================================================== */}
          {capturedCameraPreview ? (
            <div className="flex flex-col items-center gap-3 w-full animate-in zoom-in-95 duration-150">
              {/* Circular Camera Preview */}
              <div className="relative w-52 h-52 rounded-full overflow-hidden border-4 border-purple-500 shadow-[0_0_35px_rgba(168,85,247,0.45)] bg-slate-950 flex items-center justify-center">
                <img
                  src={capturedCameraPreview}
                  alt="Camera Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="text-center">
                <p className="text-xs font-black text-slate-100 flex items-center justify-center gap-1.5">
                  <Check size={14} className="text-emerald-400" />
                  <span>Photo Captured Successfully!</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Isko apni Profile DP set karna chahte hain?
                </p>
              </div>

              {/* Action Buttons: Retake vs Crop vs Set as DP */}
              <div className="flex gap-2 w-full mt-1 max-w-[310px]">
                <button
                  type="button"
                  onClick={() => {
                    setCapturedCameraPreview(null);
                    if (activeTab === 'CAMERA') {
                      startCamera(facingMode);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  <span>Retake</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (capturedCameraPreview) {
                      openCropperWithImage(capturedCameraPreview);
                      setCapturedCameraPreview(null);
                    }
                  }}
                  className="py-2.5 px-3 rounded-xl border border-purple-500/40 text-purple-300 hover:bg-purple-950/30 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                  title="Crop / Zoom"
                >
                  <Scissors size={13} />
                  <span>Crop</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSaveCameraPhoto}
                  disabled={isSaving}
                  className="flex-[1.2] py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} />
                      <span>Set as DP</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : imageToCrop ? (
            <div className="flex flex-col items-center gap-3 w-full animate-in zoom-in-95 duration-150">
              {/* Circular Viewport with interactive Drag */}
              <div className="relative flex items-center justify-center">
                <div
                  className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.35)] bg-slate-950 cursor-grab active:cursor-grabbing touch-none select-none"
                  onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                  onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
                  onMouseUp={handleDragEnd}
                  onMouseLeave={handleDragEnd}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleDragStart(touch.clientX, touch.clientY);
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (touch) handleDragMove(touch.clientX, touch.clientY);
                  }}
                  onTouchEnd={handleDragEnd}
                >
                  <canvas ref={cropCanvasRef} className="w-full h-full pointer-events-none" />

                  {/* Alignment Crosshair / Grid overlay for precision */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
                    <div className="w-full h-px bg-white/40" />
                    <div className="h-full w-px bg-white/40 absolute" />
                  </div>
                </div>

                {/* Move Hint Pill */}
                <div className="absolute -bottom-2 bg-slate-950/90 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-amber-400/40 shadow flex items-center gap-1">
                  <Move size={10} /> Drag to adjust
                </div>
              </div>

              {/* Zoom & Rotate Control Bar */}
              <div className="w-full mt-2.5 p-2 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                {/* Zoom Slider */}
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => setCropZoom((z) => Math.max(1.0, Number((z - 0.15).toFixed(2))))}
                    className="p-1 rounded-lg bg-white/5 text-slate-300 hover:text-white"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <input
                    type="range"
                    min="1.0"
                    max="3.0"
                    step="0.05"
                    value={cropZoom}
                    onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setCropZoom((z) => Math.min(3.0, Number((z + 0.15).toFixed(2))))}
                    className="p-1 rounded-lg bg-white/5 text-slate-300 hover:text-white"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <span className="text-[10px] font-mono text-amber-300 w-8 text-right font-bold">
                    {cropZoom.toFixed(1)}x
                  </span>
                </div>

                {/* Quick Alignment Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-white/5 px-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      setCropRotation((r) => (r + 90) % 360);
                    }}
                    className="flex items-center gap-1 text-slate-300 hover:text-white font-medium py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <RotateCw size={12} className="text-purple-400" />
                    <span>Rotate 90°</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      setCropPan({ x: 0, y: 0 });
                      setCropZoom(1.0);
                    }}
                    className="text-slate-400 hover:text-slate-200 font-medium py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Center Reset
                  </button>
                </div>
              </div>

              {/* Action Buttons: Retake vs Crop & Save */}
              <div className="flex gap-2 w-full mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setImageToCrop(null);
                    if (activeTab === 'CAMERA') {
                      startCamera(facingMode);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 text-xs font-bold transition-all"
                >
                  ↩️ Badlein / Retake
                </button>

                <button
                  type="button"
                  onClick={handleApplyCrop}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white text-xs font-black shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Scissors size={14} />
                      <span>Crop & Set Profile</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : activeTab === 'CAMERA' ? (
            /* ======================================================== */
            /* 2. LIVE FRONT CAMERA (SELFIE) VIEW                       */
            /* ======================================================== */
            <div className="flex flex-col items-center gap-3 w-full">
              {/* Selfie Camera Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold shadow-sm">
                <span>🤳 Front Camera (Selfie Mode)</span>
              </div>

              {/* Camera Circular Feed Viewport - Snaps photo directly inside app */}
              <div
                onClick={capturePhoto}
                className="relative w-48 h-48 sm:w-52 sm:h-52 rounded-full overflow-hidden border-4 border-purple-500 shadow-[0_0_35px_rgba(168,85,247,0.45)] bg-slate-950 flex items-center justify-center cursor-pointer select-none group"
                title="Photo khinchne ke liye tap karein"
              >
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                      el.srcObject = cameraStreamRef.current;
                      el.muted = true;
                      el.playsInline = true;
                      el.setAttribute('playsinline', 'true');
                      el.setAttribute('webkit-playsinline', 'true');
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    el.play().catch(() => {});
                    setIsCameraLoading(false);
                    setStreamTimedOut(false);
                  }}
                  onPlaying={() => {
                    setIsCameraLoading(false);
                    setStreamTimedOut(false);
                  }}
                  className="w-full h-full object-cover pointer-events-none"
                  style={{
                    transform: 'scaleX(-1)', // Mirrored selfie view
                  }}
                />
                {/* Subtle target circle */}
                <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />

                {/* Loading overlay */}
                {isCameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-10 p-3 text-center pointer-events-none">
                    <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin mb-2" />
                    <p className="text-[11px] text-purple-200 font-bold">Front Camera Start Ho Raha Hai...</p>
                  </div>
                )}

                {/* Camera error or permission overlay with retry inside app */}
                {cameraError && !isCameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-10 p-3 text-center">
                    <AlertCircle size={22} className="text-amber-400 mb-1" />
                    <p className="text-[11px] text-white font-bold">Camera Permission Denied</p>
                    <p className="text-[9px] text-slate-300 mt-0.5">Browser me camera allow karein</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startCamera();
                      }}
                      className="mt-2 px-3 py-1 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold shadow-md cursor-pointer"
                    >
                      Dobara Koshish Karein
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Shutter & Quick Options */}
              <div className="flex flex-col items-center gap-2.5 w-full mt-2">
                {/* Large Prominent Click Selfie Button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-full max-w-[280px] py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-purple-600/35 active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <Camera size={16} />
                  <span>Click Selfie Photo</span>
                </button>

                {/* Direct Native Phone Selfie Camera and Gallery Options */}
                <div className="flex items-center gap-2 w-full max-w-[280px]">
                  <button
                    type="button"
                    onClick={triggerPhoneCamera}
                    className="flex-1 py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-purple-500/30 text-purple-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="Phone ke camera app se direct selfie kheinchein"
                  >
                    <Camera size={13} className="text-pink-400" />
                    <span>📱 Phone Selfie (Direct)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>Gallery</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* 3. CHOOSE FILE / GALLERY VIEW (Has Crop Tool)            */
            /* ======================================================== */
            <div className="flex flex-col items-center gap-3 w-full">
              <div
                onClick={() => galleryInputRef.current?.click()}
                className="w-full max-w-[270px] h-40 rounded-2xl border-2 border-dashed border-purple-400/50 hover:border-purple-400 bg-purple-950/20 hover:bg-purple-950/30 flex flex-col items-center justify-center p-4 cursor-pointer transition-colors text-center group"
              >
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <Upload size={22} />
                </div>
                <p className="text-xs font-bold text-slate-200">Gallery Se Photo Chunein</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                  Photo chunte hi aap use freely circular crop aur zoom kar payenge
                </p>
              </div>

              <div className="flex gap-2 w-full max-w-[270px]">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Upload size={13} />
                  <span>Browse File</span>
                </button>
                <button
                  type="button"
                  onClick={() => frontCameraInputRef.current?.click()}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-white/10 transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>🤳 Selfie</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Remove Photo option */}
        {currentPhotoURL && !imageToCrop && !capturedCameraPreview && (
          <div className="p-3 bg-slate-950/80 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400 font-medium">Custom photo hatana chahte hain?</span>
            <button
              type="button"
              onClick={handleConfirmRemove}
              disabled={isSaving}
              className="text-red-400 hover:text-red-300 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Default Logo Karein</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileCameraModal;

