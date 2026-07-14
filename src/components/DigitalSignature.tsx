/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Trash2, Check, PenTool } from 'lucide-react';

interface DigitalSignatureProps {
  label: string;
  onSave: (base64: string) => void;
  initialValue?: string;
}

export default function DigitalSignature({ label, onSave, initialValue }: DigitalSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(!!initialValue);
  const [savedImage, setSavedImage] = useState<string | null>(initialValue || null);

  useEffect(() => {
    if (initialValue) {
      setSavedImage(initialValue);
      setHasSigned(true);
    }
  }, [initialValue]);

  // Setup Canvas Dimensions & Support High DPI Screens
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set display size
    canvas.style.width = '100%';
    canvas.style.height = '140px';

    // Set actual drawing buffer size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Brush style setup
    ctx.strokeStyle = '#10b981'; // Emerald Green
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Check if Touch Event
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Auto-save signature as base64 on draw complete
    saveSignature();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    setSavedImage(null);
    onSave('');
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return;

    const base64 = canvas.toDataURL('image/png');
    setSavedImage(base64);
    onSave(base64);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-bold text-slate-300 flex items-center gap-1.5">
          <PenTool className="h-4 w-4 text-emerald-400" />
          {label}
        </label>
        {hasSigned && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="relative bg-slate-950 border-2 border-slate-800 rounded-lg overflow-hidden h-36">
        {savedImage ? (
          <div className="absolute inset-0 bg-slate-950/90 flex items-center justify-center p-2">
            <img src={savedImage} alt="Captured Signature" className="max-h-28 max-w-full object-contain" />
            <div className="absolute top-2 right-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
              <Check className="h-3.5 w-3.5 stroke-[3]" /> Saved
            </div>
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </div>
      <p className="text-[11px] text-slate-500 font-medium">Use touch/finger or stylus to sign within the box. Consent is stored locally.</p>
    </div>
  );
}
