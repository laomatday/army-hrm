
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../shared/services/firebase';
import { kioskService, KioskSession } from './kiosk.service';
import QRCode from 'react-qr-code';

const KIOSK_ID = 'kiosk_01'; // Should be dynamic or stored in localStorage for unique kiosks

export default function KioskStation() {
    const [status, setStatus] = useState<KioskSession['status']>('active');
    const [qrValue, setQrValue] = useState<string>('');
    const [scannedEmployee, setScannedEmployee] = useState<{ id: string, name: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // 1. Initialize Kiosk Session
    useEffect(() => {
        kioskService.registerKiosk(KIOSK_ID, 'Main Reception Kiosk');
        
        const unsubscribe = db.collection('kiosk_sessions').doc(KIOSK_ID)
            .onSnapshot((doc: any) => {
                const data = doc.data() as KioskSession;
                if (data) {
                    setStatus(data.status);
                    setQrValue(data.qr_code_data);
                    
                    if (data.status === 'capturing' && data.employee_id) {
                         setScannedEmployee({ id: data.employee_id, name: data.employee_name || 'Unknown' });
                         startCamera();
                    } else if (data.status === 'completed') {
                         stopCamera();
                         // Reset after 3 seconds
                         setTimeout(() => resetKiosk(), 3000);
                    }
                }
            });
            
        // Token Rotation Timer
        const interval = setInterval(() => {
            if (status === 'active') {
                kioskService.regenerateToken(KIOSK_ID);
            }
        }, 15000); // Rotate every 15s

        return () => {
            unsubscribe();
            clearInterval(interval);
            stopCamera();
        };
    }, [status]);

    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err) {
            setError("Camera access denied");
            console.error(err);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const resetKiosk = async () => {
        setScannedEmployee(null);
        setError(null);
        await db.collection('kiosk_sessions').doc(KIOSK_ID).update({
            status: 'active',
            employee_id: null,
            employee_name: null,
            image_url: null
        });
    };

    const handleCapture = async () => {
        if (!videoRef.current || !scannedEmployee) return;

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);

        canvas.toBlob(async (blob) => {
            if (blob) {
                try {
                    // Upload Image
                    const url = await kioskService.uploadKioskPhoto(KIOSK_ID, blob);
                    
                    // Complete Check-in
                    await kioskService.completeCheckIn(KIOSK_ID, url, scannedEmployee.id);
                    
                } catch (e) {
                    setError("Upload failed");
                    console.error(e);
                }
            }
        }, 'image/jpeg', 0.8);
    };

    // Auto-capture after 3 seconds when in 'capturing' mode
    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (status === 'capturing' && stream) {
            timeout = setTimeout(() => {
                handleCapture();
            }, 3000);
        }
        return () => clearTimeout(timeout);
    }, [status, stream]);


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            
            {status === 'active' && (
                <div className="text-center animate-fade-in">
                    <h1 className="text-4xl font-bold mb-8">Quét mã để điểm danh</h1>
                    <div className="bg-white p-6 rounded-2xl shadow-xl inline-block mb-8">
                        {qrValue ? (
                            <QRCode value={qrValue} size={300} />
                        ) : (
                            <div className="w-[300px] h-[300px] flex items-center justify-center text-slate-400">Loading QR...</div>
                        )}
                    </div>
                    <p className="text-xl text-slate-400">Sử dụng App nhân viên để quét</p>
                </div>
            )}

            {status === 'capturing' && scannedEmployee && (
                <div className="w-full max-w-md animate-scale-in">
                    <h2 className="text-2xl font-bold mb-4 text-center">
                        Xin chào, <span className="text-emerald-400">{scannedEmployee.name}</span>
                    </h2>
                    <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black shadow-2xl mb-4">
                        <video 
                            ref={videoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover transform scale-x-[-1]" 
                        />
                        <div className="absolute inset-0 border-4 border-emerald-500/30 rounded-2xl pointer-events-none" />
                        <div className="absolute bottom-4 left-0 right-0 text-center">
                            <span className="bg-black/50 px-4 py-2 rounded-full text-sm">Đang chụp ảnh...</span>
                        </div>
                    </div>
                </div>
            )}

            {status === 'completed' && (
                <div className="text-center animate-slide-up">
                    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <i className="fa-solid fa-check text-4xl text-white"></i>
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Check-in Thành Công!</h2>
                    <p className="text-slate-400">Cảm ơn bạn, chúc một ngày làm việc vui vẻ.</p>
                </div>
            )}

            {error && (
                <div className="fixed bottom-8 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-up">
                    {error}
                </div>
            )}
            
            <div className="fixed bottom-4 text-xs text-slate-600">
                Kiosk ID: {KIOSK_ID} • Ver 2.0
            </div>
        </div>
    );
}
