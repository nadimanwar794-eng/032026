import { storage } from './storage';

const OFFLINE_KEY = 'nst_offline_downloads';
const OFFLINE_DATA_PREFIX = 'nst_offline_data_';

export type OfflineItemType = 'NOTE' | 'MCQ' | 'ANALYSIS';

export interface OfflineItem {
  id: string;
  type: OfflineItemType;
  title: string;
  subtitle?: string;
  timestamp: number;
  data: any;
}

export const saveOfflineItem = async (item: Omit<OfflineItem, 'timestamp'>): Promise<void> => {
    try {
        await storage.setItem(`${OFFLINE_DATA_PREFIX}${item.id}`, item.data);

        const rawItems = await storage.getItem<OfflineItem[]>(OFFLINE_KEY) || [];

        const migratedMetas = await Promise.all(rawItems.map(async (existing) => {
            if (existing.data != null && existing.id !== item.id) {
                await storage.setItem(`${OFFLINE_DATA_PREFIX}${existing.id}`, existing.data);
            }
            const { data: _stripped, ...meta } = existing;
            return { ...meta, data: null };
        }));

        const filteredMetas = migratedMetas.filter(i => i.id !== item.id);
        const { data: _d, ...itemMeta } = item as any;
        const newMeta: OfflineItem = { ...itemMeta, data: null, timestamp: Date.now() };
        filteredMetas.push(newMeta);
        filteredMetas.sort((a, b) => b.timestamp - a.timestamp);

        await storage.setItem(OFFLINE_KEY, filteredMetas);
    } catch (error) {
        console.error('Error saving offline item:', error);
        throw error;
    }
};

export const getOfflineItems = async (): Promise<OfflineItem[]> => {
    try {
        const items = await storage.getItem<OfflineItem[]>(OFFLINE_KEY);
        return items || [];
    } catch (error) {
        console.error('Error fetching offline items:', error);
        return [];
    }
};

export const getOfflineItemData = async (id: string): Promise<any> => {
    try {
        const data = await storage.getItem(`${OFFLINE_DATA_PREFIX}${id}`);
        if (data !== null && data !== undefined) return data;

        const items = await storage.getItem<OfflineItem[]>(OFFLINE_KEY);
        if (items) {
            const found = items.find(i => i.id === id);
            if (found?.data != null) return found.data;
        }
        return null;
    } catch (error) {
        console.error('Error fetching offline item data:', error);
        return null;
    }
};

export const removeOfflineItem = async (id: string): Promise<void> => {
    try {
        await storage.removeItem(`${OFFLINE_DATA_PREFIX}${id}`);
        const existingItems = await getOfflineItems();
        const filteredItems = existingItems.filter(item => item.id !== id);
        await storage.setItem(OFFLINE_KEY, filteredItems);
    } catch (error) {
        console.error('Error removing offline item:', error);
    }
};

export const clearAllOfflineItems = async (): Promise<void> => {
    try {
        const items = await getOfflineItems();
        await Promise.all(items.map(item => storage.removeItem(`${OFFLINE_DATA_PREFIX}${item.id}`)));
        await storage.removeItem(OFFLINE_KEY);
    } catch (error) {
        console.error('Error clearing offline items:', error);
    }
};
