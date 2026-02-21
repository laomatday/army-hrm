
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onClose: () => void;
  onCapture: (base64: string, lat: number, lng: number) => void;
  onError: (msg: string) => void;
}

const ModalCamera: React.FC<Props> = ({ onClose, onCapture, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // GPS State
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gpsError, setGpsError] = useState<string>("");

  useEffect(() => {
    // 1. SETUP CAMERA
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

    // 2. PRE-FETCH GPS (Critical for speed)
    // Bắt đầu lấy vị trí ngay khi mở camera, không đợi bấm nút chụp
    const watchId = navigator.geolocation.watchPosition(
        (pos) => {
            setLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            });
            setGpsError("");
        },
        (err) => {
            console.warn("GPS Pre-fetch warning:", err);
            // Không báo lỗi ngay, đợi lúc chụp mới kiểm tra lại nếu chưa có vị trí
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  const takePicture = () => {
    if (!videoRef.current) return;

    // Kiểm tra GPS trước
    if (!location) {
        // Nếu chưa có vị trí từ watchPosition, thử gọi getCurrentPosition lần cuối
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                captureProcess(pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
                onError("Không thể định vị. Vui lòng bật GPS và thử lại.");
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
        return;
    }

    // Nếu đã có vị trí sẵn, xử lý ngay tức thì
    captureProcess(location.lat, location.lng);
  };

  const captureProcess = (lat: number, lng: number) => {
    if (!videoRef.current) return;

    const MAX_WIDTH = 640;
    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;
    
    const scale = videoWidth > MAX_WIDTH ? MAX_WIDTH / videoWidth : 1;
    const finalWidth = videoWidth * scale;
    const finalHeight = videoHeight * scale;

    const canvas = document.createElement('canvas');
    canvas.width = finalWidth;
    canvas.height = finalHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, finalWidth, finalHeight);
        
        // Tối ưu hóa: Giảm chất lượng xuống 0.4 (vẫn rõ nét nhưng nhẹ hơn nhiều)
        const base64 = canvas.toDataURL('image/webp', 0.4);
        onCapture(base64, lat, lng);
    }
  };

  return (
    <div className="fixed inset-0 z-[4000] bg-black flex flex-col animate-fade-in">
      <div className="relative flex-1 overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted></video>
          
          {/* Guide Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-64 border-2 border-white/30 rounded-full border-dashed"></div>
          </div>

          {/* GPS Indicator (UX Enhancement) */}
          <div className="absolute top-4 right-4 z-10">
              <div className={`px-3 py-1 rounded-full backdrop-blur-md flex items-center gap-2 ${location ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
                  <div className={`w-2 h-2 rounded-full ${location ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${location ? 'text-emerald-400' : 'text-red-400'}`}>
                      {location ? 'GPS Sẵn sàng' : 'Đang tìm GPS...'}
                  </span>
              </div>
          </div>
      </div>
      
      <div className="bg-black pb-safe pt-6 px-6">
          <div className="flex justify-between items-center max-w-sm mx-auto">
            <button onClick={onClose} className="w-14 h-14 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors">
              <i className="fa-solid fa-xmark text-xl"></i>
            </button>
            
            <button 
                onClick={takePicture} 
                disabled={!location}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${!location ? 'opacity-50 grayscale cursor-not-allowed bg-slate-700' : 'bg-white border-4 border-emerald-500 shadow-xl active:scale-95'}`}
            >
              <div className={`w-16 h-16 rounded-full border-2 border-white ${!location ? 'bg-slate-500' : 'bg-emerald-600'}`}></div>
            </button>
            
            <div className="w-14 h-14"></div> 
          </div>
          <p className="text-center text-slate-400 text-xs mt-4 mb-2">
              {location ? "Giữ khuôn mặt trong khung hình" : "Đang xác định vị trí..."}
          </p>
      </div>
    </div>
  );
};

export default ModalCamera;
