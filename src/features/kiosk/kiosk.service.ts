
import { db, storage } from '../../shared/services/firebase';
import { Employee } from '../../shared/types';

const KIOSK_COLLECTION = 'kiosk_sessions';
const ATTENDANCE_COLLECTION = 'attendance_records';

export interface KioskSession {
  id: string;
  name: string;
  token: string;
  qr_code_data: string; // The data encoded in the QR
  status: 'active' | 'scanning' | 'capturing' | 'processing' | 'completed' | 'error';
  employee_id?: string; // The employee currently interacting
  employee_name?: string;
  image_url?: string; // The captured photo
  last_active: any;
  created_at: any;
  updated_at: any;
}

export const kioskService = {
  // --- KIOSK SIDE ---
  
  // Register a new kiosk session (e.g., on app load in Kiosk mode)
  async registerKiosk(kioskId: string, name: string): Promise<void> {
    const sessionRef = db.collection(KIOSK_COLLECTION).doc(kioskId);
    await sessionRef.set({
      id: kioskId,
      name: name,
      token: this.generateToken(),
      qr_code_data: '', // Will be updated by regenerateToken
      status: 'active',
      last_active: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    }, { merge: true });
    
    // Start token rotation loop or rely on frontend to call regenerateToken
  },

  // Update the QR token (should be called periodically by the Kiosk)
  async regenerateToken(kioskId: string): Promise<string> {
    const newToken = this.generateToken();
    const qrData = JSON.stringify({ kioskId, token: newToken, type: 'kiosk_checkin' });
    
    await db.collection(KIOSK_COLLECTION).doc(kioskId).update({
      token: newToken,
      qr_code_data: qrData,
      last_active: new Date(),
      updated_at: new Date()
      // Reset state if needed, but be careful not to interrupt an active flow if this runs too often
      // status: 'active' // Only reset if idle? Logic to be handled in component
    });
    
    return qrData;
  },

  // Upload the captured image from Kiosk
  async uploadKioskPhoto(kioskId: string, blob: Blob): Promise<string> {
    const filename = `kiosk/${kioskId}_${Date.now()}.jpg`;
    const storageRef = storage.ref().child(filename);
    await storageRef.put(blob);
    return await storageRef.getDownloadURL();
  },

  // Complete the check-in process from Kiosk side
  async completeCheckIn(kioskId: string, imageUrl: string, employeeId: string): Promise<void> {
      // 1. Update Kiosk State to show success
      await db.collection(KIOSK_COLLECTION).doc(kioskId).update({
          status: 'completed',
          image_url: imageUrl,
          updated_at: new Date()
      });

      // 2. Create Attendance Record
      const today = new Date().toISOString().split('T')[0];
      const timestamp = new Date().toISOString();
      const timeString = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      
      const recordId = `${employeeId}_${today}_${Date.now()}`; // Unique ID
      
      // We need employee details, ideally passed or fetched. 
      // For now assume we have ID. Fetching name might be needed if not in Kiosk state.
      
      await db.collection(ATTENDANCE_COLLECTION).doc(recordId).set({
          id: recordId,
          employee_id: employeeId,
          date: today,
          time: timeString,
          timestamp: timestamp,
          type: 'check_in', // Or determine based on time
          method: 'kiosk_face_id',
          image_url: imageUrl,
          kiosk_id: kioskId,
          status: 'valid', // Pending approval logic?
          location: 'Kiosk Station',
          is_late: false // Logic to calculate lateness
      });
      
      // Reset Kiosk after a delay (handled by frontend)
  },

  // --- MOBILE SIDE ---

  // Validate the QR code scanned by the employee
  async scanKioskQR(employee: Employee, qrDataString: string): Promise<boolean> {
      try {
          const data = JSON.parse(qrDataString);
          if (data.type !== 'kiosk_checkin' || !data.kioskId || !data.token) {
              return false;
          }

          const kioskRef = db.collection(KIOSK_COLLECTION).doc(data.kioskId);
          const doc = await kioskRef.get();
          
          if (!doc.exists) return false;
          
          const kioskData = doc.data() as KioskSession;
          
          // Verify token matches (simple security)
          if (kioskData.token !== data.token) {
              console.log("Token mismatch or expired");
              return false;
          }

          // Verify Kiosk is in a state to accept check-in
          if (kioskData.status !== 'active' && kioskData.status !== 'scanning') {
               // Allow 'scanning' if multiple people are scanning rapidly? 
               // Better to require 'active'.
               // return false; 
          }

          // UPDATE Kiosk State -> Trigger Camera UI on Kiosk
          await kioskRef.update({
              status: 'capturing',
              employee_id: employee.employee_id,
              employee_name: employee.full_name,
              updated_at: new Date()
          });

          return true;
      } catch (e) {
          console.error("Invalid QR", e);
          return false;
      }
  },
  
  generateToken(): string {
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
};
