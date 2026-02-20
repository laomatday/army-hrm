
import React, { useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
  onCapture: (base64: string, lat: number, lng: number) => void;
  onError: (msg: string) => void;
}

const ModalCamera: React.FC<Props> = ({ onClose, onCapture, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Ưu tiên camera trước, độ phân giải vừa đủ 720p để giảm tải xử lý ban đầu
    const constraints = {
        video: { 
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        onError("Không thể truy cập camera: " + err);
        onClose();
      });

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const takePicture = () => {
    if (!videoRef.current) return;
    
    // --- OPTIMIZATION LOGIC ---
    // Thay vì lấy full resolution của camera (có thể lên tới 4K), 
    // ta resize ngay lập tức xuống mức đủ dùng cho chấm công (640px width).
    const MAX_WIDTH = 640;
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    
    // Tính toán tỷ lệ scale
    const scale = videoWidth > MAX_WIDTH ? MAX_WIDTH / videoWidth : 1;
    const finalWidth = videoWidth * scale;
    const finalHeight = videoHeight * scale;

    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Vẽ ảnh đã resize lên canvas
        ctx.drawImage(videoRef.current, 0, 0, finalWidth, finalHeight);
        
        // Nén ảnh sang WebP với chất lượng 50% (0.5)
        // WebP thường nhỏ hơn 25-34% so với JPEG ở cùng chất lượng
        const base64 = canvas.toDataURL('image/webp', 0.5);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            onCapture(base64, pos.coords.latitude, pos.coords.longitude);
          },
          (err) => {
            onError("Lỗi định vị GPS: " + err.message);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col">
      <div className="relative flex-1 overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
          {/* Guide Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/30 rounded-full border-dashed"></div>
          </div>
      </div>
      
      <div className="bg-black pb-safe pt-6 px-6">
          <div className="flex justify-between items-center max-w-sm mx-auto">
            <button onClick={onClose} className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            
            <button onClick={takePicture} className="w-20 h-20 rounded-full bg-white border-4 border-emerald-500 shadow-xl flex items-center justify-center active:scale-95 transition-transform">
              <div className="w-16 h-16 bg-emerald-600 rounded-full border-2 border-white"></div>
            </button>
            
            <div className="w-14 h-14"></div> {/* Spacer for alignment */}
          </div>
          <p className="text-center text-slate-400 text-xs mt-4 mb-2">Giữ khuôn mặt trong khung hình</p>
      </div>
    </div>
  );
};

export default ModalCamera;
