import React, { useRef, useState, useEffect } from 'react';
import { Square, RotateCcw, Check } from 'lucide-react';
import { useLanguage } from '../utils/LanguageContext';

interface SignaturePadProps {
  id: string;
  label: string;
  onSave: (base64Data: string) => void;
  onClear?: () => void;
  savedDataUrl?: string;
  signerName?: string;
  confirmLabel?: string;
}

export default function SignaturePad({ id, label, onSave, onClear, savedDataUrl, signerName, confirmLabel }: SignaturePadProps) {
  const { language } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(!!savedDataUrl);
  const [isSaved, setIsSaved] = useState(!!savedDataUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Handle resizing / high DPI
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      ctx.strokeStyle = '#0f172a'; // slate-900
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    // If there's already a saved signature, draw it (or just show it as an overlay)
    if (savedDataUrl) {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        }
      };
      img.src = savedDataUrl;
    }
  }, [savedDataUrl]);

  // Handle canvas drawings
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (isSaved) return; // Prevent editing once saved
    setIsDrawing(true);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getEventCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isSaved) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent default scrolling on mobile touch
    if (e.cancelable) {
      e.preventDefault();
    }

    const coords = getEventCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const getEventCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    
    if ('touches' in e) {
      // Touch event
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      // Mouse event
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Reset properties
    setIsSaved(false);
    setHasSigned(false);
    if (onClear) onClear();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!hasSigned) return;

    // Capture the base64 png
    const dataUrl = canvas.toDataURL('image/png');
    setIsSaved(true);
    onSave(dataUrl);
  };

  return (
    <div className="flex flex-col space-y-2 w-full" id={`sig-pad-container-${id}`}>
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</label>
        {isSaved && (
          <span className="inline-flex items-center text-xs text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-xl font-bold border border-emerald-200">
            <Check size={12} className="mr-1" /> {language === 'ES' ? 'Guardada' : 'Saved'}
          </span>
        )}
      </div>

      {signerName && (
        <div className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold flex items-center space-x-1.5 shadow-sm">
          <span className="font-bold text-slate-400">{language === 'ES' ? 'Firmante:' : 'Signer:'}</span>
          <span className="text-slate-800 font-extrabold">{signerName}</span>
        </div>
      )}

      <div className="relative border border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-32 block touch-none cursor-crosshair ${isSaved ? 'opacity-80 bg-slate-50' : 'bg-white'}`}
          id={`canvas-${id}`}
        />
        
        {!hasSigned && !savedDataUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic font-semibold">
            {language === 'ES' ? 'Firme aquí con el dedo o stylus' : 'Sign here using your finger or stylus'}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasSigned}
          className="inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          id={`btn-clear-sig-${id}`}
        >
          <RotateCcw size={14} className="mr-1.5" /> {language === 'ES' ? 'Borrar' : 'Clear'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasSigned || isSaved}
          className="inline-flex min-h-11 items-center justify-center px-5 py-2.5 text-sm font-bold text-white bg-blue-600 border border-transparent rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          id={`btn-save-sig-${id}`}
        >
          <Square size={14} className="mr-1.5 fill-current" /> {confirmLabel || (language === 'ES' ? 'Confirmar Firma' : 'Confirm Signature')}
        </button>
      </div>
    </div>
  );
}
