/**
 * maintenanceManager.ts
 * Smart Crash Protection System — Firebase RTDB helpers.
 * Usable in both class and functional components (no React hooks here).
 */
import { rtdb } from '../firebase';
import { ref, set, onValue } from 'firebase/database';

export type MaintenanceTarget =
  | 'ALL'
  | 'STUDENT_DASHBOARD'
  | 'ADMIN_DASHBOARD'
  | 'ROUTINE'
  | 'REVISION_HUB'
  | 'MCQ'
  | 'VIDEOS';

export interface MaintenanceConfig {
  active: boolean;
  title: string;
  message: string;
  retryMinutes: number;
  target: MaintenanceTarget;
  updatedAt: number;
}

export interface CrashInfo {
  detected: boolean;
  errorMessage: string;
  crashedAt: number;
  fixed: boolean;
}

export interface MaintenanceState {
  config: MaintenanceConfig | null;
  crashes: {
    studentDashboard: CrashInfo | null;
    adminDashboard: CrashInfo | null;
  };
}

const PATH = 'admin_maintenance';

/** Write a crash record to RTDB. Called from ErrorBoundary (class component). */
export async function reportCrash(
  target: 'studentDashboard' | 'adminDashboard',
  errorMessage: string
): Promise<void> {
  try {
    await set(ref(rtdb, `${PATH}/crashes/${target}`), {
      detected: true,
      errorMessage: String(errorMessage).slice(0, 300),
      crashedAt: Date.now(),
      fixed: false,
    });
  } catch {
    // silent fail — we're already in an error state
  }
}

/** Clear a crash record (admin marks it fixed). */
export async function markCrashFixed(
  target: 'studentDashboard' | 'adminDashboard'
): Promise<void> {
  try {
    await set(ref(rtdb, `${PATH}/crashes/${target}`), {
      detected: false,
      errorMessage: '',
      crashedAt: 0,
      fixed: true,
    });
  } catch {}
}

/** Save maintenance config (admin sets title/message/timer). */
export async function saveMaintenance(
  config: Omit<MaintenanceConfig, 'updatedAt'>
): Promise<void> {
  try {
    await set(ref(rtdb, `${PATH}/config`), {
      ...config,
      updatedAt: Date.now(),
    });
  } catch {}
}

/** Deactivate maintenance (admin marks everything fixed). */
export async function clearMaintenance(): Promise<void> {
  try {
    await set(ref(rtdb, `${PATH}/config`), {
      active: false,
      title: '',
      message: '',
      retryMinutes: 30,
      target: 'ALL' as MaintenanceTarget,
      updatedAt: Date.now(),
    });
  } catch {}
}

/** Subscribe to the entire maintenance node. Returns an unsubscribe fn. */
export function subscribeToMaintenance(
  callback: (state: MaintenanceState) => void
): () => void {
  const unsubscribe = onValue(ref(rtdb, PATH), (snap) => {
    if (!snap.exists()) {
      callback({
        config: null,
        crashes: { studentDashboard: null, adminDashboard: null },
      });
      return;
    }
    const data = snap.val() as {
      config?: MaintenanceConfig;
      crashes?: {
        studentDashboard?: CrashInfo;
        adminDashboard?: CrashInfo;
      };
    };
    callback({
      config: data.config ?? null,
      crashes: {
        studentDashboard: data.crashes?.studentDashboard ?? null,
        adminDashboard: data.crashes?.adminDashboard ?? null,
      },
    });
  });
  return unsubscribe;
}
