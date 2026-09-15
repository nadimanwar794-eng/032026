// Admin Audit Log — har admin action ka permanent RTDB record
import { rtdb } from '../firebase';
import { ref, push } from 'firebase/database';

export interface AuditEntry {
  action: string;       // e.g. USER_DELETE, CONTENT_DELETE, SETTINGS_UPDATE
  details: string;      // human-readable description
  targetId?: string;    // ID of the affected entity
  targetName?: string;  // display name of the affected entity
  adminId: string;
  adminName: string;
  timestamp: number;
}

/**
 * Ek admin action ka record RTDB ke `admin_audit_logs` node mein save karta hai.
 * Fire-and-forget — failure ko silently ignore karta hai taaki UI block na ho.
 */
export async function logAdminAction(
  action: string,
  details: string,
  admin: { id?: string; name?: string } | null,
  extra?: { targetId?: string; targetName?: string }
): Promise<void> {
  try {
    const entry: AuditEntry = {
      action,
      details,
      targetId:   extra?.targetId   || '',
      targetName: extra?.targetName || '',
      adminId:    admin?.id   || 'unknown',
      adminName:  admin?.name || 'Unknown Admin',
      timestamp:  Date.now(),
    };
    await push(ref(rtdb, 'admin_audit_logs'), entry);
  } catch {
    // Silently fail — audit log failure should never block the main operation
  }
}
