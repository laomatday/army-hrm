import React, { useEffect, useRef } from 'react';

interface Props {
  onClose: () => void;
  onCapture: (base64: string, lat: number, lng: number) => void;
}

const ModalCamera: React.FC<Props> = ({ onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => {
        alert("Cannot access camera: " + err);
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
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.6);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onCapture(base64, pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        alert("GPS Error: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline></video>
      <div className="absolute bottom-10 left-0 w-full flex justify-center gap-10">
        <button onClick={onClose} className="w-16 h-16 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md">
          <i className="fa-solid fa-xmark text-2xl"></i>
        </button>
        <button onClick={takePicture} className="w-20 h-20 rounded-full bg-white border-4 border-emerald-500 shadow-xl flex items-center justify-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-full"></div>
        </button>
      </div>
    </div>
  );
};

export default ModalCamera;