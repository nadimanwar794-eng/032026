import { User, SystemSettings } from '../types';

export type AdminAiResponse = {
    type: 'TEXT' | 'LIST_USERS' | 'LIST_MCQ' | 'ACTION_CONFIRMATION';
    message: string;
    data?: any;
    actionType?: string;
};

interface AdminContext {
    users: User[];
    settings: SystemSettings;
    setSettings: (s: SystemSettings) => void;
}

export const processAdminCommand = async (
    _command: string, 
    _context: AdminContext
): Promise<AdminAiResponse> => {
    return {
        type: 'TEXT',
        message: "⚠️ AI Assistant is currently disabled."
    };
};
