import React, { useRef, useState, useEffect, useCallback, ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimatedItemHeight?: number;
  overscan?: number;
  className?: string;
  keyExtractor?: (item: T, index: number) => string | number;
}

function VirtualListItem({
  children,
  estimatedHeight,
}: {
  children: ReactNode;
  estimatedHeight: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '200px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={visible ? undefined : { minHeight: estimatedHeight, contentVisibility: 'auto', containIntrinsicSize: `0 ${estimatedHeight}px` } as React.CSSProperties}
    >
      {visible ? children : null}
    </div>
  );
}

export function VirtualList<T>({
  items,
  renderItem,
  estimatedItemHeight = 80,
  className = '',
  keyExtractor,
}: VirtualListProps<T>) {
  const getKey = useCallback(
    (item: T, index: number) =>
      keyExtractor ? keyExtractor(item, index) : index,
    [keyExtractor]
  );

  if (items.length <= 20) {
    return (
      <div className={className}>
        {items.map((item, i) => (
          <React.Fragment key={getKey(item, i)}>
            {renderItem(item, i)}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {items.map((item, i) => (
        <VirtualListItem key={getKey(item, i)} estimatedHeight={estimatedItemHeight}>
          {renderItem(item, i)}
        </VirtualListItem>
      ))}
    </div>
  );
}
