import { db } from "./firebase";

export async function adminGetCollection(collectionName: string) {
    try {
        const snap = await db.collection(collectionName).get();
        return snap.docs.map(d => ({ ...(d.data() as any), id: d.id }));
    } catch (e: any) {
        console.error("Admin Get Error", e);
        return [];
    }
}

export async function adminDeleteDoc(collectionName: string, docId: string) {
    try {
        await db.collection(collectionName).doc(docId).delete();
        return { success: true, message: "Deleted successfully" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function adminUpdateDoc(collectionName: string, docId: string, data: any) {
    try {
        await db.collection(collectionName).doc(docId).update(data);
        return { success: true, message: "Updated successfully" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}

export async function adminCreateDoc(collectionName: string, data: any, customId?: string) {
    try {
        if (customId) {
            await db.collection(collectionName).doc(customId).set(data);
        } else {
            await db.collection(collectionName).add(data);
        }
        return { success: true, message: "Created successfully" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
}