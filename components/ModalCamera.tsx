import React, { useEffect, useRef, useState } from 'react';

interface Props {
  onClose: () => void;
  onCapture: (base64: string, lat: number, lng: number) => void;
  onError: (msg: string) => void;
}

const ModalCamera: React.FC<Props> = ({ onClose, onCapture, onError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isHighAccuracy, setIsHighAccuracy] = useState(true);

  useEffect(() => {
    const constraints = {
        video: { 
            facingMode: 'user',
            width: { ideal: 480 },
            height: { ideal: 480 }
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
        console.error("Lỗi Camera:", err);
        onError("Không thể truy cập camera. Vui lòng kiểm tra quyền và thử lại.");
      });

    // Lấy vị trí GPS
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.warn(`WARN: ${err.message}`);
        if (isHighAccuracy) {
          setIsHighAccuracy(false);
          navigator.geolocation.getCurrentPosition(
            (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (finalErr) => onError(`Không thể lấy vị trí GPS: ${finalErr.message}`)
          );
        } else {
          onError(`Không thể lấy vị trí GPS: ${err.message}`);
        }
      },
      { enableHighAccuracy: isHighAccuracy, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [isHighAccuracy, onError]);

  const handleCapture = () => {
    if (!videoRef.current || !location) {
        onError("Chưa có dữ liệu video hoặc vị trí.");
        return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        // Nén ảnh với chất lượng 80% để giảm dung lượng
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(base64Image, location.lat, location.lng);
    } else {
        onError("Không thể xử lý ảnh.");
    }
  };

  return (
    <div className="modal-camera">
      <video ref={videoRef} autoPlay playsInline muted />
      <div className="controls">
        <button onClick={onClose} className="btn-close">Hủy</button>
        <button onClick={handleCapture} className="btn-capture" disabled={!location}>
          {location ? 'Chụp ảnh' : 'Đang lấy GPS...'}
        </button>
      </div>
    </div>
  );
};

export default ModalCamera;