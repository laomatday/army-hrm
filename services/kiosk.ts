import { db } from "./firebase";
import { Kiosk } from "../types";

const COLLECTION = 'kiosks';

export async function getAllKiosks(): Promise<Kiosk[]> {
    try {
        const snap = await db.collection(COLLECTION).get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kiosk));
    } catch (error) {
        console.error("Error getting kiosks:", error);
        return [];
    }
}

export async function getKioskById(kioskId: string): Promise<Kiosk | null> {
    try {
        const snap = await db.collection(COLLECTION).where('kiosk_id', '==', kioskId).limit(1).get();
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as Kiosk;
    } catch (error) {
        console.error("Error getting kiosk by id:", error);
        return null;
    }
}

export async function createKiosk(kiosk: Omit<Kiosk, 'id' | 'created_at'>): Promise<boolean> {
    try {
        const data = {
            ...kiosk,
            created_at: new Date().toISOString(),
            status: 'Active'
        };
        await db.collection(COLLECTION).add(data);
        return true;
    } catch (error) {
        console.error("Error creating kiosk:", error);
        return false;
    }
}

export async function updateKiosk(id: string, data: Partial<Kiosk>): Promise<boolean> {
    try {
        await db.collection(COLLECTION).doc(id).update(data);
        return true;
    } catch (error) {
        console.error("Error updating kiosk:", error);
        return false;
    }
}

export async function deleteKiosk(id: string): Promise<boolean> {
    try {
        await db.collection(COLLECTION).doc(id).delete();
        return true;
    } catch (error) {
        console.error("Error deleting kiosk:", error);
        return false;
    }
}

export async function getKiosksByCenter(centerId: string): Promise<Kiosk[]> {
    try {
        const snap = await db.collection(COLLECTION).where('center_id', '==', centerId).get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kiosk));
    } catch (error) {
        console.error("Error getting kiosks by center:", error);
        return [];
    }
}
