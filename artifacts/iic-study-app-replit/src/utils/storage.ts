import localforage from 'localforage';

localforage.config({
  name: 'nst_storage'
});

export const storage = {
  getItem: async <T = any>(key: string): Promise<T | null> => {
    try {
      return await localforage.getItem<T>(key);
    } catch (err) {
      console.error(`Error reading ${key} from localforage:`, err);
      return null;
    }
  },

  setItem: async (key: string, value: any): Promise<void> => {
    try {
      await localforage.setItem(key, value);
    } catch (err) {
      console.error(`Error writing ${key} to localforage:`, err);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await localforage.removeItem(key);
    } catch (err) {
      console.error(`Error removing ${key} from localforage:`, err);
    }
  },

  clearContentCache: async (): Promise<void> => {
    try {
      const keys = await localforage.keys();
      const contentKeys = keys.filter(k => k.startsWith('nst_content_'));
      await Promise.all(contentKeys.map(k => localforage.removeItem(k)));
      console.log(`[IIC] Content cache cleared: ${contentKeys.length} keys removed.`);
    } catch (err) {
      console.error('Error clearing content cache from localforage:', err);
    }
  },

  keys: async (): Promise<string[]> => {
    try {
      return await localforage.keys();
    } catch (err) {
      console.error('Error getting keys from localforage:', err);
      return [];
    }
  },

  clear: async (): Promise<void> => {
    // PROTECTED: Full wipe disabled — only content cache is cleared.
    // This prevents accidental deletion of user data stored in IndexedDB.
    try {
      const keys = await localforage.keys();
      const contentKeys = keys.filter(k => k.startsWith('nst_content_'));
      await Promise.all(contentKeys.map(k => localforage.removeItem(k)));
      console.log(`[IIC] storage.clear() → safe mode: ${contentKeys.length} content cache keys removed (user data preserved).`);
    } catch (err) {
      console.error('Error in storage.clear (safe mode):', err);
    }
  }
};
