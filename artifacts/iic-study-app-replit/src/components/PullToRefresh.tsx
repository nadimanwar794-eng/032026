import React from "react";

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => void | Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ children }) => {
  return <>{children}</>;
};
