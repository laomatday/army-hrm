import React, { useState, useRef } from 'react';

interface Props {
  imageSrc: string;
  onCancel: () => void;
  onCropComplete: (base64: string) => void;
}

const ImageCropper: React.FC<Props> = ({ imageSrc, onCancel, onCropComplete }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const [displaySize, setDisplaySize] = useState<{width: number, height: number} | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);

  const VIEWPORT_SIZE = 280; 
  const OUTPUT_SIZE = 500;

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { naturalWidth, naturalHeight } = e.currentTarget;
      const ratio = naturalWidth / naturalHeight;
      
      let width, height;
      
      if (ratio < 1) {
          width = VIEWPORT_SIZE;
          height = VIEWPORT_SIZE / ratio;
      } else {
          height = VIEWPORT_SIZE;
          width = VIEWPORT_SIZE * ratio;
      }
      
      setDisplaySize({ width, height });
      setImageLoaded(true);
  };

  const handlePointerDown = (e: React.PointerEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
    
    setPan({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const processCrop = () => {
    if (!imgRef.current || !displaySize) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const scaleRatio = OUTPUT_SIZE / VIEWPORT_SIZE;
      
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      
      ctx.translate(pan.x * scaleRatio, pan.y * scaleRatio);
      ctx.scale(zoom * scaleRatio, zoom * scaleRatio);
      
      ctx.drawImage(
        imgRef.current,
        -displaySize.width / 2,
        -displaySize.height / 2,
        displaySize.width,
        displaySize.height
      );

      const base64 = canvas.toDataURL('image/webp', 0.8);
      onCropComplete(base64);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-black flex flex-col animate-fade-in touch-none">
      
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden w-full bg-black">
         
         <div 
            className="relative z-20"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
         >
             <div 
                className="absolute inset-0 z-30 cursor-move"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onTouchStart={handlePointerDown}
                onTouchMove={handlePointerMove}
                onTouchEnd={handlePointerUp}
             ></div>
         </div>

          <div 
            className="absolute top-1/2 left-1/2 flex items-center justify-center pointer-events-none z-10"
            style={{ 
                width: VIEWPORT_SIZE, 
                height: VIEWPORT_SIZE,
                transform: 'translate(-50%, -50%)'
            }}
          >
             <div className="relative w-full h-full flex items-center justify-center">
                <img 
                    ref={imgRef}
                    src={imageSrc}
                    alt="Crop"
                    onLoad={onImgLoad}
                    draggable={false}
                    className="max-w-none select-none"
                    style={{
                        width: displaySize ? displaySize.width : 'auto',
                        height: displaySize ? displaySize.height : 'auto',
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        opacity: imageLoaded ? 1 : 0,
                        transition: 'opacity 0.2s'
                    }}
                />
             </div>
          </div>
          
          <p className="absolute bottom-10 text-white/50 text-[10px] font-bold uppercase tracking-widest pointer-events-none z-30">
             Di chuyển và Thu phóng
          </p>
      </div>

      <div className="bg-slate-900 border-t border-slate-800 pb-safe pt-6 px-6 z-40 w-full rounded-t-3xl">
          
          <div className="flex items-center gap-4 justify-center mb-8">
              <i className="fa-solid fa-image text-slate-500 text-xs"></i>
              <input 
                type="range" 
                min="1" 
                max="3" 
                step="0.05" 
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full max-w-[240px] h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <i className="fa-solid fa-image text-white text-lg"></i>
          </div>

          <div className="flex gap-4">
               <button 
                  onClick={onCancel} 
                  className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-2xl font-bold text-base border border-slate-700 active:scale-95 transition-all"
               >
                   Hủy
               </button>
               <button 
                  onClick={processCrop}
                  disabled={!imageLoaded}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-base active:scale-95 transition-all disabled:opacity-50"
               >
                   Xong
               </button>
          </div>
      </div>
    </div>
  );
};

export default ImageCropper;
