export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return formatDateTime(timestamp);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function generateId(prefix: string = 'item'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

export const PRESET_COLORS = [
  { label: 'Blue', value: '#3b82f6', bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500' },
  { label: 'Emerald', value: '#10b981', bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500' },
  { label: 'Purple', value: '#8b5cf6', bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500' },
  { label: 'Amber', value: '#f59e0b', bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500' },
  { label: 'Rose', value: '#f43f5e', bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500' },
  { label: 'Cyan', value: '#06b6d4', bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500' },
  { label: 'Indigo', value: '#6366f1', bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500' },
];
