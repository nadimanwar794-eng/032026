/**
 * PaginatedPdfViewer
 * Shows ONE page at a time, scaled to fill the screen (contain-fit).
 * Swipe left/right to navigate. No scroll — one page, one screen.
 *
 * Loading strategy for Google Drive PDFs:
 *   1. Fetch the raw bytes client-side via corsproxy.io (adds CORS headers)
 *   2. Pass the ArrayBuffer to react-pdf so pdf.js never does a cross-origin request
 *   3. If that fails, call onLoadError → parent shows its own fallback
 */
import React, {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up worker once
if (!pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc =
    `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

/** Fetch a PDF URL as raw bytes, bypassing CORS via a proxy when needed. */
async function fetchPdfBytes(url: string): Promise<ArrayBuffer> {
  // Convert Google Drive view/edit links to direct download
  let fetchUrl = url;
  if (url.includes('drive.google.com')) {
    const m = url.match(/\/file\/d\/([^/?#]+)/);
    if (m) {
      fetchUrl = `https://drive.google.com/uc?export=download&id=${m[1]}&confirm=t`;
    }
  }

  // Strategy 1: Try direct fetch (works for non-Google-Drive URLs with CORS)
  try {
    const res = await fetch(fetchUrl, { mode: 'cors' });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const magic = new Uint8Array(buf.slice(0, 4));
      if (magic[0] === 0x25 && magic[1] === 0x50) return buf; // %PDF
    }
  } catch { /* CORS blocked — fall through to proxy */ }

  // Strategy 2: corsproxy.io — fetches any public URL with CORS headers
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(fetchUrl)}`;
  const res2 = await fetch(proxyUrl);
  if (!res2.ok) throw new Error(`corsproxy ${res2.status}`);
  const buf2 = await res2.arrayBuffer();
  const magic2 = new Uint8Array(buf2.slice(0, 4));
  if (magic2[0] !== 0x25 || magic2[1] !== 0x50) {
    throw new Error('Not a valid PDF');
  }
  return buf2;
}

export interface PaginatedPdfHandle {
  scrollToPage: (page: number) => void;
}

interface Props {
  url: string;
  nightFilter?: string;
  onLoadSuccess?: (numPages: number) => void;
  onPageChange?: (page: number) => void;
  onLoadError?: () => void;
}

export const PaginatedPdfViewer = forwardRef<PaginatedPdfHandle, Props>(
  ({ url, nightFilter = 'none', onLoadSuccess, onPageChange, onLoadError }, ref) => {
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [containerW, setContainerW] = useState(0);
    const [containerH, setContainerH] = useState(0);
    const [pageNaturalW, setPageNaturalW] = useState(0);
    const [pageNaturalH, setPageNaturalH] = useState(0);
    const [loadFailed, setLoadFailed] = useState(false);
    // pdfFile holds the raw bytes once fetched
    const [pdfFile, setPdfFile] = useState<{ data: ArrayBuffer } | null>(null);
    const [fetching, setFetching] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    /* ── Fetch PDF bytes once on mount / URL change ── */
    useEffect(() => {
      let cancelled = false;
      setFetching(true);
      setPdfFile(null);
      setLoadFailed(false);
      setNumPages(0);
      setCurrentPage(1);
      setPageNaturalW(0);
      setPageNaturalH(0);

      fetchPdfBytes(url)
        .then((buf) => {
          if (!cancelled) {
            setPdfFile({ data: buf });
            setFetching(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoadFailed(true);
            setFetching(false);
            onLoadError?.();
          }
        });

      return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url]);

    /* ── Measure container (ResizeObserver + window resize for rotation) ── */
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const measure = () => {
        setContainerW(el.clientWidth);
        setContainerH(el.clientHeight);
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      window.addEventListener('resize', measure, { passive: true });
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', measure);
      };
    }, []);

    /* ── Page navigation ── */
    const goToPage = useCallback((page: number) => {
      if (numPages === 0) return;
      const clamped = Math.max(1, Math.min(numPages, page));
      setCurrentPage(clamped);
      onPageChange?.(clamped);
    }, [numPages, onPageChange]);

    /* ── Expose scrollToPage via ref ── */
    useImperativeHandle(ref, () => ({
      scrollToPage(page: number) { goToPage(page); },
    }));

    /* ── Swipe to navigate ── */
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }, []);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx < 0) goToPage(currentPage + 1);
        else         goToPage(currentPage - 1);
      }
    }, [currentPage, goToPage]);

    /* ── Block pinch-zoom (browser level) ── */
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const block = (e: TouchEvent) => {
        if (e.touches.length > 1) e.preventDefault();
      };
      el.addEventListener('touchmove', block, { passive: false });
      return () => el.removeEventListener('touchmove', block);
    }, []);

    if (loadFailed) return null;

    /* ── "Contain" fit: page fills screen on its limiting side, no clipping ── */
    let renderW: number | undefined;
    if (containerW > 0 && containerH > 0 && pageNaturalW > 0 && pageNaturalH > 0) {
      const scaleByW = containerW / pageNaturalW;
      const scaleByH = containerH / pageNaturalH;
      renderW = Math.floor(pageNaturalW * Math.min(scaleByW, scaleByH));
    } else if (containerW > 0) {
      renderW = containerW;
    }

    return (
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: '#000',
          filter: nightFilter,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          touchAction: 'manipulation',
        }}
      >
        {fetching && (
          <div style={{ color: '#aaa', fontSize: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            PDF load ho raha hai…
          </div>
        )}

        {pdfFile && (
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages: n }) => {
              setNumPages(n);
              onLoadSuccess?.(n);
              onPageChange?.(1);
            }}
            onLoadError={() => { setLoadFailed(true); onLoadError?.(); }}
            loading={null}
            error={null}
          >
            {containerW > 0 && (
              <Page
                key={currentPage}
                pageNumber={currentPage}
                width={renderW}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={<div style={{ color: '#aaa', fontSize: 14 }}>…</div>}
                onLoadSuccess={(page) => {
                  if (pageNaturalW === 0) {
                    setPageNaturalW(page.originalWidth);
                    setPageNaturalH(page.originalHeight);
                  }
                }}
              />
            )}
          </Document>
        )}
      </div>
    );
  },
);

PaginatedPdfViewer.displayName = 'PaginatedPdfViewer';
