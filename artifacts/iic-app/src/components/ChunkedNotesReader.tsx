// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Volume2, Square, BookOpen, Star, Palette, Check, Type, RotateCcw, Search, Monitor, X, LayoutGrid, MoreVertical, ChevronRight, WifiOff, Flame, Lightbulb, Pencil, Presentation } from 'lucide-react';
import { AdminWhiteBoard } from './AdminWhiteBoard';
import { rotateScreen, isDesktopModeOn, setDesktopMode } from '../utils/displayPrefs';
import { saveSuggestion, auth, findDuplicateSuggestionByPoint, incrementSuggestionReportCount, updateSuggestionLeaderboard } from '../firebase';
import { speakText, stopSpeech } from '../utils/textToSpeech';
import { splitIntoTopics, NotesTopic as Topic } from '../utils/notesSplitter';
import { READING_FONTS, TOP_10_READING_FONTS, ensureReadingFontLoaded, getReadingFontById, ReadingFont } from '../utils/notesFonts';
import { ReadingStylePopover } from './ReadingStylePopover';
import { ReadingScoreSession, ReadingScoreState, ReadingScoreConfig } from '../utils/readingScoreEngine';
import { ReadingScoreHUD } from './ReadingScoreHUD';
import { getLevelInfo, LEVEL_INFO } from '../utils/levelSystem';
import { renderMathInHtml } from '../utils/mathUtils';

const FONT_SIZES = [13, 15, 17, 20, 24, 28, 32, 36, 40] as const;
const FONT_SIZE_KEY = 'nst_reading_font_size';
const FONT_FAMILY_KEY = 'nst_reading_font_family';
const FONT_WEIGHT_KEY = 'nst_reading_font_weight';

const getStoredFontWeight = (): number => {
  try {
    const v = parseInt(localStorage.getItem(FONT_WEIGHT_KEY) || '400', 10);
    return [400, 600, 800, 900].includes(v) ? v : 400;
  } catch { return 400; }
};
const VOICE_SPEED_KEY = 'nst_tts_speed';
const VOICE_SPEEDS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
const SPEED_LABELS = ['0.75x', '1x', '1.25x', '1.5x', '1.75x', '2x'] as const;
const getStoredSpeedIdx = (): number => {
  try {
    const v = parseInt(localStorage.getItem(VOICE_SPEED_KEY) || '1', 10);
    return isNaN(v) || v < 0 || v > 5 ? 1 : v;
  } catch { return 1; }
};

const getStoredFontFamilyId = (): string | null => {
  try { return localStorage.getItem(FONT_FAMILY_KEY); } catch { return null; }
};

const getStoredFontIdx = (): number => {
  try {
    const v = parseInt(localStorage.getItem(FONT_SIZE_KEY) || '1', 10);
    return isNaN(v) || v < 0 || v > 8 ? 1 : v;
  } catch { return 1; }
};

/* ─────────  Reading-text colour palettes (per app theme)  ─────────
   For each theme we curate 6 colours that stay readable on that theme's
   background. The first entry of every palette is the recommended one
   (marked with a ★ in the picker UI). Selection is persisted per-theme
   so switching dark↔light keeps a sensible default in each theme.        */
type ColorSwatch = { hex: string; name: string };
const READING_PALETTE: Record<'light' | 'dark' | 'blue', ColorSwatch[]> = {
  light: [
    { hex: '#1e293b', name: 'Slate' },     // recommended
    { hex: '#0f172a', name: 'Ink' },
    { hex: '#1e3a8a', name: 'Navy' },
    { hex: '#3730a3', name: 'Indigo' },
    { hex: '#065f46', name: 'Forest' },
    { hex: '#7c2d12', name: 'Sienna' },
  ],
  dark: [
    { hex: '#f1f5f9', name: 'Soft White' }, // recommended
    { hex: '#fde68a', name: 'Amber' },
    { hex: '#a7f3d0', name: 'Mint' },
    { hex: '#bae6fd', name: 'Sky' },
    { hex: '#fecaca', name: 'Rose' },
    { hex: '#ffffff', name: 'Pure White' },
  ],
  blue: [
    { hex: '#e0f2fe', name: 'Ice' },        // recommended
    { hex: '#ffffff', name: 'White' },
    { hex: '#fde68a', name: 'Amber' },
    { hex: '#a7f3d0', name: 'Mint' },
    { hex: '#fbcfe8', name: 'Pink' },
    { hex: '#c7d2fe', name: 'Lavender' },
  ],
};
const COLOR_KEY = (mode: 'light' | 'dark' | 'blue') => `nst_text_color_${mode}`;
const detectMode = (): 'light' | 'dark' | 'blue' => {
  if (typeof document === 'undefined') return 'light';
  const cls = document.documentElement.classList;
  if (cls.contains('dark-mode-blue')) return 'blue';
  if (cls.contains('dark-mode')) return 'dark';
  return 'light';
};
const getStoredColor = (mode: 'light' | 'dark' | 'blue'): string => {
  try {
    const v = localStorage.getItem(COLOR_KEY(mode));
    if (v && /^#[0-9a-f]{6}$/i.test(v)) return v;
  } catch {}
  return READING_PALETTE[mode][0].hex;
};

interface Props {
  content: string;
  className?: string;
  language?: string;
  topBarLabel?: string;
  /** When true, the reader starts "Read All" automatically on mount / content change. */
  autoStart?: boolean;
  /** Fires after the last topic has finished being read aloud. */
  onComplete?: () => void;
  /** Fires the moment "Read All" / tap-to-read TTS begins (start of any read session).
   *  Used to immediately mark a note as "in progress" in Continue Reading. */
  onReadingStart?: () => void;
  /** When true, hides the sticky "Read All" top bar (use when parent renders controls externally). */
  hideTopBar?: boolean;
  /** Topic index to scroll to / highlight on mount (used to restore reading position
   *  after a tab switch unmounts and remounts the reader). */
  initialIndex?: number | null;
  /** Fired with the latest topic index the user is at (tap-to-read or auto-advance)
   *  so the parent can persist it for later restoration. */
  onPositionChange?: (idx: number) => void;
  /** Unique key for this note (e.g. "hw_abc123") to namespace saved stars. */
  noteKey?: string;
  /** Returns true if a topic text is currently starred. */
  isStarred?: (text: string) => boolean;
  /** Called when user taps the star on a topic. */
  onStarToggle?: (text: string) => void;
  /** Optional search phrase. When set, the reader finds the first topic that
   *  contains the phrase (case-insensitive), scrolls to it, highlights it,
   *  and auto-starts TTS from that line. Used by Home search → "click result
   *  → jump to exact line and read aloud" flow. */
  searchQuery?: string;
  /** Optional getter for the global "social proof" save count of a topic.
   *  When provided and >0, the topic shows a small "⭐ N" pill so students see
   *  how many other learners have marked the same line as Important. */
  getStarCount?: (topicText: string) => number;
  /** External text-colour override (hex). When set, this colour is applied to
   *  every topic line and the in-reader Palette colour picker is hidden — the
   *  parent component is fully in charge of reading colour (e.g. PdfView's
   *  inline Read More wrapper which lets the user pick a coherent background
   *  + text-colour preset together). */
  textColorOverride?: string;
  /** When true and content is HTML, defaults to tappable chunk/TTS reader mode
   *  (stripped plain text) instead of the styled HTML render. User can still
   *  switch to HTML view via a toggle button. */
  preferChunkMode?: boolean;
  /** Called whenever the user toggles Desktop Mode inside this reader, so the
   *  parent component can keep its own desktop-mode state in sync. */
  onDesktopModeChange?: (isOn: boolean) => void;
  /** Hide the Desktop Mode toggle in the top-bar (used by Competition mode) */
  hideDesktopToggle?: boolean;
  /** When true and `hideTopBar` is true, suppress the compact sticky Read All / small controls
   *  so the reader is truly minimal (used for immersive full-screen in Competition mode). */
  suppressStickyControls?: boolean;
  /** Separate HTML-formatted notes to show when user clicks the HTML button.
   *  Use this when the note has both plain chunkNotes (for TTS reading) AND
   *  htmlNotes (for styled view) — passing htmlNotes here keeps the HTML button
   *  visible even though `content` is plain text. */
  htmlContent?: string;
  /** When true, user is on Ultra plan. */
  isUltraUser?: boolean;
  /** How many free styled-note views are left today for Ultra users. */
  ultraHtmlRemaining?: number;
  /** Current credits balance of the user (for credits-based unlock). */
  userCredits?: number;
  /** Credits cost to unlock HTML view for this session (default: 5). */
  htmlUnlockCost?: number;
  /** Called when user spends credits to unlock HTML view. */
  onSpendCredits?: (amount: number) => void;
  /** Called whenever HTML view is successfully opened free (to consume daily quota). */
  onHtmlOpen?: () => void;
  /** Called when user taps "Upgrade" in the prompt. */
  onUpgradeClick?: () => void;
  /** True if the user is on the Basic plan (can view Ultra notes with daily limit). */
  isBasicUser?: boolean;
  /** How many free styled-note views are left today for Basic users. */
  basicHtmlRemaining?: number;
  /** Called whenever the user switches between chunk/html view inside the reader. */
  onHtmlViewChange?: (mode: 'chunk' | 'html') => void;
  /** Called when user taps the "More" / mode-switch button. Parent opens a content-picker popup. */
  onMoreOptions?: () => void;
  /** When provided, the parent can call `ref.current()` to open the controls bottom-sheet from outside
   *  (e.g. from a top-bar 3-dot button). The ref is populated on mount. */
  triggerControlsRef?: React.MutableRefObject<(() => void) | null>;
  /** When true, hides the 3-dot button inside the slim sticky bar so the parent's top-bar button is the sole trigger. */
  hideInline3dot?: boolean;
  /** When true, hides the Fix/Correction button from the controls panel (e.g. in school mode). */
  hideFix?: boolean;
  /** When provided, shows a ← back button in the slim READ MODE bar so the user can exit read mode. */
  onBack?: () => void;
  /** When provided, shows a Save Offline button in the slim READ MODE bar. */
  onSaveOffline?: () => void;
  /** When true, shows the Save Offline button in a saved/success state. */
  isSavedOffline?: boolean;
  /** Reading score config — when provided, activates time-based score tracking with HUD */
  readingScoreConfig?: ReadingScoreConfig;
  /** True if the current user is an admin (ADMIN or SUB_ADMIN role). */
  isAdmin?: boolean;
  /** When true and isAdmin, show Important Mark 2 button instead of the regular star button. */
  useImportantMark2?: boolean;
  /** Returns true if a topic text has been marked with Important Mark 2 by admin. */
  isMarked2?: (text: string) => boolean;
  /** Called when admin taps the Important Mark 2 button on a topic. */
  onMark2Toggle?: (text: string) => void;
  /** Returns true if admin has globally marked this topic as important (shown to all students). */
  isAdminImportant?: (text: string) => boolean;
  /** Source metadata — passed through to correction submissions so admin knows which lesson/page/mode */
  sourceMeta?: { lessonTitle?: string; pageNo?: string; subject?: string; classLevel?: string; };
  /** Called when admin taps the Edit button in the slim bar — opens content editor for this note. Admin/SubAdmin only. */
  onAdminEdit?: () => void;
}


export const ChunkedNotesReader: React.FC<Props> = ({ content, className, language = 'hi-IN', topBarLabel, autoStart, onComplete, onReadingStart, hideTopBar, initialIndex, onPositionChange, noteKey, isStarred, onStarToggle, searchQuery, getStarCount, textColorOverride, preferChunkMode, onDesktopModeChange, hideDesktopToggle, suppressStickyControls, htmlContent, isUltraUser, ultraHtmlRemaining, userCredits = 0, htmlUnlockCost = 5, onSpendCredits, onHtmlOpen, onUpgradeClick, isBasicUser = false, basicHtmlRemaining = 0, onHtmlViewChange, onMoreOptions, triggerControlsRef, hideInline3dot, hideFix, onBack, onSaveOffline, isSavedOffline, readingScoreConfig, isAdmin, useImportantMark2, isMarked2, onMark2Toggle, isAdminImportant, sourceMeta, onAdminEdit }) => {
  const topics = useMemo(() => splitIntoTopics(content), [content]);

  // ── Strips [span_N](start_span) / [span_N](end_span) TTS markers ──
  const stripSpanMarkers = (s: string) =>
    s.replace(/\[span_\d+\]\((start|end)_span\)/g, '');

  // ── Lightweight markdown → HTML for mixed-content notes ──
  // Converts headings / bold / italic / bullets / numbered lists in lines
  // that are NOT already HTML tags. Full <!DOCTYPE> docs skip this entirely.
  const inlineMd = (s: string): string => {
    // Protect math expressions ($...$  $$...$$  \(...\)  \[...\]) from markdown processing
    const saved: string[] = [];
    let r = s.replace(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$/g, m => {
      saved.push(m);
      return `\x00M${saved.length - 1}\x00`;
    });
    r = r
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<![*])\*(?![*\s])([^*\n]+?)(?<!\s)\*(?![*])/g, '<em>$1</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');
    // Restore math expressions
    return r.replace(/\x00M(\d+)\x00/g, (_, i) => saved[+i]);
  };

  const markdownToHtml = (text: string): string => {
    const lines = text.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;
    let tableRows: string[][] = [];
    let tableHasHeader = false;

    const closeList = () => {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (inOl) { out.push('</ol>'); inOl = false; }
    };
    const flushTable = () => {
      if (tableRows.length === 0) return;
      out.push('<div class="chnr-table-wrap"><table class="md-table">');
      tableRows.forEach((cells, ri) => {
        const tag = (ri === 0 && tableHasHeader) ? 'th' : 'td';
        out.push('<tr>' + cells.map(c => `<${tag}>${inlineMd(c.trim())}</${tag}>`).join('') + '</tr>');
      });
      out.push('</table></div>');
      tableRows = [];
      tableHasHeader = false;
    };

    for (const raw of lines) {
      const trimmed = raw.trim();
      // Existing HTML — preserve as-is
      if (trimmed.startsWith('<') || trimmed === '') {
        flushTable();
        closeList();
        out.push(raw);
        continue;
      }
      // Table row: | col | col |
      if (/^\|.+\|/.test(trimmed)) {
        closeList();
        // Separator row |---|---| → marks previous row as header
        if (/^\|[\s\-|:]+\|$/.test(trimmed)) {
          tableHasHeader = tableRows.length === 1;
          continue;
        }
        const cells = trimmed.replace(/^\||\|$/g, '').split('|');
        tableRows.push(cells);
        continue;
      }
      // Flush pending table before other elements
      flushTable();
      // Headings: ### text
      const hm = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        closeList();
        out.push(`<h${hm[1].length}>${inlineMd(hm[2])}</h${hm[1].length}>`);
        continue;
      }
      // Unordered list: * - + (any indent)
      const ulm = raw.match(/^(\s*)[*\-+]\s+(.+)$/);
      if (ulm) {
        if (inOl) { out.push('</ol>'); inOl = false; }
        if (!inUl) { out.push('<ul>'); inUl = true; }
        out.push(`<li>${inlineMd(ulm[2])}</li>`);
        continue;
      }
      // Ordered list: 1. 2. etc. (any indent)
      const olm = raw.match(/^(\s*)\d+[.)]\s+(.+)$/);
      if (olm) {
        if (inUl) { out.push('</ul>'); inUl = false; }
        if (!inOl) { out.push('<ol>'); inOl = true; }
        out.push(`<li>${inlineMd(olm[2])}</li>`);
        continue;
      }
      // Regular paragraph
      closeList();
      out.push(`<p>${inlineMd(trimmed)}</p>`);
    }
    flushTable();
    closeList();
    return out.join('\n');
  };

  // ── HTML / Markdown content detection ──
  // Returns true for HTML *and* for markdown so both go through markdownToHtml
  // and render as styled HTML instead of raw plain text.
  const isHtmlContent = useMemo(() => {
    const t = stripSpanMarkers((content || '')).trim();
    if ((t.startsWith('<') && (t.includes('</') || t.includes('/>'))) ||
      /^<(div|p|ul|ol|h[1-6]|table|section|article|span|b|strong|style|blockquote)/i.test(t))
      return true;
    // Note has <style> or obvious HTML tags anywhere in the first 400 chars
    if (/<style\b|<!DOCTYPE|<html\b|<div\b|<table\b|<h[1-6]\b/i.test(t.slice(0, 400)))
      return true;
    // When a separate htmlContent prop is provided, content is plain chunkNotes —
    // skip markdown detection to avoid incorrectly treating plain text as HTML.
    if (htmlContent?.trim()) return false;
    // Markdown detection — headings, bullets, tables, bold/italic
    const first800 = t.slice(0, 800);
    if (/^#{1,6}\s+\S/m.test(first800)) return true;   // ## Heading
    if (/^[*\-+]\s+\S/m.test(first800)) return true;    // * bullet
    if (/^\d+[.)]\s+\S/m.test(first800)) return true;   // 1. ordered list
    if (/^\|.+\|/m.test(first800)) return true;          // | table |
    if (/\*\*[^*\n]+\*\*/.test(first800)) return true;  // **bold**
    // LaTeX math blocks — force HTML path so multi-line equations are
    // captured before splitIntoTopics() breaks them across separate chunks.
    const first3k = t.slice(0, 3000);
    if (/\$\$[\s\S]{1,1000}?\$\$/.test(first3k)) return true;   // $$...$$
    if (/\\\[[\s\S]{1,500}?\\\]/.test(first3k)) return true;     // \[...\]
    if (/\\\([\s\S]{1,200}?\\\)/.test(first3k)) return true;     // \(...\)
    return false;
  }, [content, htmlContent]);

  // ── Extract <style> CSS text — runs on ALL content that has <style> blocks ──
  const extractedStyles = useMemo(() => {
    const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    const parts: string[] = [];
    let m;
    while ((m = styleRe.exec(content)) !== null) parts.push(m[1]);
    return parts.join('\n');
  }, [content]);

  // ── Inject extracted <style> into document <head>, clean up on unmount ──
  useEffect(() => {
    if (!isHtmlContent || !extractedStyles) return;
    const el = document.createElement('style');
    el.setAttribute('data-chnr-html', 'true');
    el.textContent = extractedStyles;
    document.head.appendChild(el);
    return () => { try { el.remove(); } catch {} };
  }, [extractedStyles, isHtmlContent]);

  // ── Build the clean HTML for rendering:
  //    1. For full HTML docs — extract <body> content only
  //    2. Strip <style>/<script> blocks (already injected separately)
  //    3. Strip orphaned closing tags from page-split notes
  //    4. Strip TTS span markers
  //    5. Tag inline-styled box divs with 'chnr-box' class (for scroll + TTS exclusion)
  // ──
  const processedHtmlContent = useMemo(() => {
    if (!isHtmlContent) return content;
    let result = content;
    const isFullHtmlDoc = /<!DOCTYPE|<html\b/i.test(result.trim());
    // Full HTML document → extract <body> only
    if (isFullHtmlDoc) {
      const bodyMatch = result.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) result = bodyMatch[1];
    }
    // Remove complete <style>/<script> blocks
    result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove orphaned closing tags (page-split notes)
    result = result.replace(/<\/style>/gi, '').replace(/<\/script>/gi, '');
    // Strip raw non-HTML text before first tag (leaked CSS) — only when
    // content actually has HTML tags; pure markdown must NOT be stripped.
    if (/<[a-zA-Z]/.test(result)) {
      result = result.replace(/^[^<]*/s, '');
    }
    // Strip TTS span markers
    result = stripSpanMarkers(result);
    // Render math FIRST — multi-line $$...$$ / \[...\] blocks must be captured
    // before markdownToHtml splits them into separate <p> lines.
    result = renderMathInHtml(result);
    // Mixed markdown+HTML notes AND pure markdown: convert to HTML.
    // Full HTML docs already have proper HTML — skip conversion for them.
    // KaTeX-rendered spans start with '<' so markdownToHtml will preserve them.
    if (!isFullHtmlDoc) {
      result = markdownToHtml(result);
    }
    // Tag inline-styled box divs with 'chnr-box' so they scroll independently
    // and are excluded from TTS. A "box" = has border-radius + (border or background).
    // Also wrap every <table> in a .chnr-table-wrap for horizontal scrolling.
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = result;
      tmp.querySelectorAll('div[style],section[style],aside[style]').forEach(el => {
        const s = (el.getAttribute('style') || '').toLowerCase();
        // Detect "box" style: any element with an explicit border shorthand (border:)
        // OR border-left/right/top/bottom with padding, OR border-radius + background.
        const isBox =
          /border\s*:/.test(s) ||
          (/border-(left|right|top|bottom)\s*:/.test(s) && s.includes('padding')) ||
          (s.includes('border-radius') && (s.includes('border') || s.includes('background')));
        if (isBox) {
          el.classList.add('chnr-box');
        }
      });
      // Wrap bare tables (not already inside .table-container/.chnr-table-wrap)
      tmp.querySelectorAll('table').forEach(tbl => {
        const parent = tbl.parentElement;
        if (!parent) return;
        const parentCls = (parent.className || '');
        if (parentCls.includes('table-container') || parentCls.includes('chnr-table-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'chnr-table-wrap';
        parent.insertBefore(wrap, tbl);
        wrap.appendChild(tbl);
      });
      result = tmp.innerHTML;
    } catch { /* ignore DOM errors */ }
    return result.trim();
  }, [content, isHtmlContent]);

  // ── Process external htmlContent prop ──
  // For fragment HTML: keep <style> blocks intact (they define visual formatting).
  // For full HTML docs: rescue <head> styles and prepend to body content.
  // Also strips <script>, orphaned closing tags, TTS markers, converts markdown,
  // tags box-divs and wraps tables — but NEVER removes <style> from fragments.
  const processedExternalHtml = useMemo(() => {
    const raw = htmlContent?.trim();
    if (!raw) return '';
    let result = raw;
    const isFullHtmlDoc = /<!DOCTYPE|<html\b/i.test(result.trim());
    if (isFullHtmlDoc) {
      // Rescue <style> blocks from <head> so they still apply when rendered inline
      const headStyles: string[] = [];
      const headMatch = result.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
      if (headMatch) {
        const styleRe = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
        let m;
        while ((m = styleRe.exec(headMatch[1])) !== null) headStyles.push(m[0]);
      }
      // Extract <body> content
      const bodyMatch = result.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
      result = bodyMatch ? bodyMatch[1] : result;
      // Prepend rescued head-styles so they apply inline
      if (headStyles.length > 0) result = headStyles.join('\n') + '\n' + result;
    }
    // Remove <script> blocks only — keep <style> blocks so CSS formatting stays
    result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    // Remove orphaned closing tags from page-split notes
    result = result.replace(/<\/script>/gi, '');
    // Strip raw non-HTML text before first tag (leaked CSS text)
    if (/<[a-zA-Z]/.test(result)) result = result.replace(/^[^<]*/s, '');
    // Strip TTS span markers
    result = stripSpanMarkers(result);
    // Render math FIRST — captures multi-line $$...$$ before markdownToHtml
    // splits lines into separate <p> tags.
    result = renderMathInHtml(result);
    // Pure markdown / mixed markdown+HTML: convert to HTML (skip for full HTML docs)
    if (!isFullHtmlDoc && !/<[a-zA-Z]/.test(result.trim().slice(0, 100))) {
      result = markdownToHtml(result);
    }
    // Tag box-divs with 'chnr-box' and wrap bare tables for horizontal scroll
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = result;
      tmp.querySelectorAll('div[style],section[style],aside[style]').forEach(el => {
        const s = (el.getAttribute('style') || '').toLowerCase();
        const isBox =
          /border\s*:/.test(s) ||
          (/border-(left|right|top|bottom)\s*:/.test(s) && s.includes('padding')) ||
          (s.includes('border-radius') && (s.includes('border') || s.includes('background')));
        if (isBox) el.classList.add('chnr-box');
      });
      tmp.querySelectorAll('table').forEach(tbl => {
        const parent = tbl.parentElement;
        if (!parent) return;
        const parentCls = (parent.className || '');
        if (parentCls.includes('table-container') || parentCls.includes('chnr-table-wrap')) return;
        const wrap = document.createElement('div');
        wrap.className = 'chnr-table-wrap';
        parent.insertBefore(wrap, tbl);
        wrap.appendChild(tbl);
      });
      result = tmp.innerHTML;
    } catch { /* ignore DOM errors */ }
    // Render LaTeX math equations ($$...$$ and $...$)
    result = renderMathInHtml(result);
    return result.trim();
  }, [htmlContent]);

  // ── Extract plain text from HTML content for TTS & chunked reader ──
  // All content (including box content) is included — chunked reader reads everything.
  // Only tables are excluded (visual data, not suitable for linear TTS).
  // When htmlContent prop is provided (separate htmlNotes), use it as TTS source
  // even when isHtmlContent=false (content is plain chunkNotes).
  const htmlPlainText = useMemo(() => {
    const htmlSrc = processedExternalHtml || (isHtmlContent ? processedHtmlContent : '');
    if (!htmlSrc) return '';
    try {
      const div = document.createElement('div');
      div.innerHTML = htmlSrc;
      div.querySelectorAll('style, script').forEach(el => el.remove());
      div.querySelectorAll('.chnr-table-wrap, .table-container, table').forEach(el => el.remove());
      return (div.textContent || div.innerText || '')
        .replace(/\[span_\d+\]\((start|end)_span\)/g, '')
        .replace(/\s+/g, ' ').trim();
    } catch {
      return htmlSrc
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\[span_\d+\]\((start|end)_span\)/g, '')
        .replace(/\s+/g, ' ').trim();
    }
  }, [content, processedHtmlContent, processedExternalHtml, isHtmlContent]);

  // ── HTML ↔ Chunk mode toggle ──
  // When preferChunkMode=true, HTML content defaults to tappable chunk reader.
  // User can still toggle to styled HTML view via a button.
  const [htmlViewMode, setHtmlViewMode] = useState<'chunk' | 'html'>(() => preferChunkMode ? 'chunk' : 'html');
  const [showHtmlUnlockPrompt, setShowHtmlUnlockPrompt] = useState(false);
  // Notify parent whenever the mode changes (so parent can sync download logic)
  React.useEffect(() => { onHtmlViewChange?.(htmlViewMode); }, [htmlViewMode]);
  // Compute chunk topics from the stripped plain text (for HTML content in chunk mode)
  const htmlChunkTopics = useMemo(() => {
    if (!isHtmlContent || !htmlPlainText) return [];
    return splitIntoTopics(htmlPlainText);
  }, [isHtmlContent, htmlPlainText]);
  // The active topic list: use stripped-text topics when showing HTML in chunk mode,
  // otherwise use the normal topics (from raw content).
  const activeTopicList = (isHtmlContent && htmlViewMode === 'chunk' && htmlChunkTopics.length > 0)
    ? htmlChunkTopics
    : topics;

  const [activeIdx, setActiveIdx] = useState<number | null>(initialIndex ?? null);
  const [isReading, setIsReading] = useState(false);
  const isReadingRef = useRef(false);
  useEffect(() => { isReadingRef.current = isReading; }, [isReading]);

  // ── Reading Score Session ───────────────────────────────────────────────────
  const scoreSessionRef = useRef<ReadingScoreSession | null>(null);
  const [scoreState, setScoreState] = useState<ReadingScoreState | null>(null);
  const maxTopicReachedRef = useRef<number>(0);

  // 🛡️ Touch Protection popup — opens only on icon tap
  const [showReadingActiveInfo, setShowReadingActiveInfo] = useState(false);
  const openReadingActiveInfo = () => setShowReadingActiveInfo(true);
  // 📖 Book icon tap → reading score info
  const [showScoreInfo, setShowScoreInfo] = useState(false);
  const openScoreInfo = () => setShowScoreInfo(true);
  // 💡 Suggestion panel (inline per-point mode)
  const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
  const [inlineCorrectionIdx, setInlineCorrectionIdx] = useState<number | null>(null);
  const [inlineCorrectionText, setInlineCorrectionText] = useState('');
  const [inlineCorrectionSubmitting, setInlineCorrectionSubmitting] = useState(false);
  const [inlineCorrectionDone, setInlineCorrectionDone] = useState(false);
  const [inlineCorrectionError, setInlineCorrectionError] = useState(false);
  // Track which point indices have already been submitted this session (prevents duplicate sends)
  const [submittedPointIndices, setSubmittedPointIndices] = useState<Set<number>>(new Set());
  // Reset submitted set when the note identity changes (component reused across different notes)
  useEffect(() => { setSubmittedPointIndices(new Set()); }, [noteKey]);

  // Smart TTS suggestion — detect rapid manual tapping
  const TTS_SUGGEST_KEY = 'iic_tts_suggest_seen';
  const [showTtsSuggestPopup, setShowTtsSuggestPopup] = useState(false);
  const manualTapTimestampsRef = useRef<number[]>([]);
  const ttsSuggestShownRef = useRef(false);

  // Tracks whether current TTS session was started via "Read All" / Smart Reading popup (AUTO)
  // or via a manual topic tap (MANUAL). Only AUTO sessions earn READ_TTS_HIGHLIGHT rewards.
  const ttsIsAutoRef = useRef(false);

  // Swipe-to-dismiss touch tracking for Reading Score banner and Touch Protection banner
  const scoreBannerSwipeX = useRef(0);
  const tpBannerSwipeX = useRef(0);

  // Called on every manual topic tap to check if we should suggest TTS
  const trackManualTap = useCallback(() => {
    const now = Date.now();
    const WINDOW_MS = 10_000;          // 10-second rolling window
    const RAPID_THRESHOLD = 10;        // 10+ taps in 10 sec triggers suggestion
    manualTapTimestampsRef.current = [
      ...manualTapTimestampsRef.current.filter(t => now - t < WINDOW_MS),
      now,
    ];
    if (manualTapTimestampsRef.current.length >= RAPID_THRESHOLD) {
      manualTapTimestampsRef.current = []; // reset so it can trigger again
      setShowTtsSuggestPopup(true);
    }
  }, []);

  useEffect(() => {
    if (!readingScoreConfig) return;
    const session = new ReadingScoreSession(readingScoreConfig, setScoreState);
    scoreSessionRef.current = session;
    session.start();
    return () => { session.stop(); scoreSessionRef.current = null; };
  }, [readingScoreConfig?.userId, readingScoreConfig?.userLevel]);

  // (Auto-show removed — popups only open on manual icon tap)

  // Update net-forward progress whenever activeIdx changes
  useEffect(() => {
    if (!scoreSessionRef.current || activeIdx === null) return;
    const total = Math.max(1, activeTopicList.length - 1);
    const pct = (activeIdx / total) * 100;
    if (activeIdx > maxTopicReachedRef.current) {
      maxTopicReachedRef.current = activeIdx;
    }
    scoreSessionRef.current.updateProgress(pct);
  }, [activeIdx, activeTopicList.length]);

  // Voice speed control
  const [speedIdx, setSpeedIdx] = useState<number>(getStoredSpeedIdx);
  const speedIdxRef = useRef(speedIdx);
  useEffect(() => { speedIdxRef.current = speedIdx; }, [speedIdx]);
  const cycleSpeed = () => {
    setSpeedIdx(prev => {
      const next = (prev + 1) % VOICE_SPEEDS.length;
      try { localStorage.setItem(VOICE_SPEED_KEY, String(next)); } catch {}
      speedIdxRef.current = next;
      return next;
    });
  };

  // Font scaling
  const [fontIdx, setFontIdx] = useState<number>(getStoredFontIdx);
  const [showFontMenu, setShowFontMenu] = useState(false);
  const fontSize = FONT_SIZES[fontIdx];

  // Font family — student can pick from 500+ Google Fonts. The chosen font
  // persists in localStorage and is loaded on demand. `null` means "default"
  // (the app's normal Inter / system font), which is also what the Reset
  // button restores to.
  const [fontFamilyId, setFontFamilyId] = useState<string | null>(getStoredFontFamilyId);
  const [fontWeight, setFontWeight] = useState<number>(getStoredFontWeight);
  const [showFontFamilyMenu, setShowFontFamilyMenu] = useState(false);
  const [fontSearch, setFontSearch] = useState('');
  const [fontCategory, setFontCategory] = useState<'all' | 'top10' | 'sans' | 'serif' | 'display' | 'handwriting' | 'mono' | 'indic'>('top10');
  const activeFont: ReadingFont | null = useMemo(() => getReadingFontById(fontFamilyId), [fontFamilyId]);
  // Whenever the active font changes, eagerly load its <link> tag so the page
  // can render with the right glyphs immediately.
  useEffect(() => {
    if (activeFont?.gfontParam) ensureReadingFontLoaded(activeFont.gfontParam);
  }, [activeFont]);
  const pickFontFamily = (id: string | null) => {
    setFontFamilyId(id);
    try {
      if (id) localStorage.setItem(FONT_FAMILY_KEY, id);
      else localStorage.removeItem(FONT_FAMILY_KEY);
    } catch {}
    try { window.dispatchEvent(new CustomEvent('nst-reading-style-changed')); } catch {}
    try { if (navigator.vibrate) navigator.vibrate(20); } catch {}
  };
  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    let pool: ReadingFont[];
    if (fontCategory === 'top10') pool = TOP_10_READING_FONTS;
    else if (fontCategory === 'all') pool = READING_FONTS;
    else pool = READING_FONTS.filter(f => f.category === fontCategory);
    if (!q) return pool;
    return pool.filter(f => f.label.toLowerCase().includes(q));
  }, [fontSearch, fontCategory]);

  // Reading text colour — per active theme. We watch the <html> class list so
  // when the user flips Light/Dark/Blue from the Settings sheet, the picker
  // and applied colour update instantly without a remount.
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'blue'>(detectMode);
  const [textColor, setTextColor] = useState<string>(() => getStoredColor(detectMode()));
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [inlineSearch, setInlineSearch] = useState(false);
  const [inlineQuery, setInlineQuery] = useState('');
  const [isDesktopMode, setIsDesktopModeLocal] = useState<boolean>(isDesktopModeOn);
  const [rotateToast, setRotateToast] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [showAdminBoard, setShowAdminBoard] = useState(false);
  const [showOnlyImportant, setShowOnlyImportant] = useState(false);
  // Stable ref so playFrom (memoised) can read the latest value without being re-created.
  const showOnlyImportantRef = useRef(false);
  useEffect(() => { showOnlyImportantRef.current = showOnlyImportant; }, [showOnlyImportant]);
  // Helper: is a given topic "important" (starred / mark2 / admin-important)?
  const isTopicImportant = useCallback((text: string) =>
    (isStarred && isStarred(text)) || (isMarked2 && isMarked2(text)) || (isAdminImportant && isAdminImportant(text)),
    [isStarred, isMarked2, isAdminImportant]);
  const lastScrollY = useRef(0);
  const [toolbarHidden, setToolbarHidden] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Expose setShowControls to parent via ref so top-bar 3-dot can trigger the sheet
  useEffect(() => {
    if (triggerControlsRef) triggerControlsRef.current = () => setShowControls(true);
    return () => { if (triggerControlsRef) triggerControlsRef.current = null; };
  }, [triggerControlsRef]);

  // Hide compact button row when user scrolls down; show again on scroll up
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    let parent = el.parentElement;
    while (parent) {
      const ov = window.getComputedStyle(parent).overflowY;
      if ((ov === 'auto' || ov === 'scroll') && parent.scrollHeight > parent.clientHeight + 10) break;
      parent = parent.parentElement;
    }
    const scrollEl = parent;
    if (!scrollEl) return;
    let lastTop = scrollEl.scrollTop;
    const onScroll = () => {
      const top = scrollEl.scrollTop;
      if (top > lastTop + 20 && top > 60) setToolbarHidden(true);
      else if (top < lastTop - 10) setToolbarHidden(false);
      lastTop = top;
    };
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  // When focus mode activates (hideTopBar=true), close the controls panel immediately
  // so neither the sticky nav row nor the bottom overlay appear in focus mode
  useEffect(() => {
    if (hideTopBar) setShowControls(false);
  }, [hideTopBar]);

  // Auto-collapse MORE panel when user scrolls down
  useEffect(() => {
    if (!showControls) return;
    const handleScroll = () => {
      const currentY = window.scrollY || document.documentElement.scrollTop;
      if (currentY > lastScrollY.current + 30) setShowControls(false);
      lastScrollY.current = currentY;
    };
    lastScrollY.current = window.scrollY || document.documentElement.scrollTop;
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showControls]);

  // Auto-dismiss all open banners/controls 10s after user scrolls away
  useEffect(() => {
    const anyOpen = showScoreInfo || showReadingActiveInfo || showControls;
    if (!anyOpen) return;
    let dismissTimer: ReturnType<typeof setTimeout> | null = null;
    let armed = false;
    const dismiss = () => {
      setShowScoreInfo(false);
      setShowReadingActiveInfo(false);
      setShowControls(false);
    };
    const arm = (scrollTop: number) => {
      if (scrollTop > 40 && !armed) {
        armed = true;
        dismissTimer = setTimeout(dismiss, 10000);
      }
    };
    // Listen on window scroll
    const onWindowScroll = () => arm(window.scrollY || document.documentElement.scrollTop);
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    // Also listen on the inner scroll container (same logic as toolbar-hidden effect)
    let innerScrollEl: HTMLElement | null = null;
    const onInnerScroll = () => arm(innerScrollEl?.scrollTop ?? 0);
    if (toolbarRef.current) {
      let p = toolbarRef.current.parentElement;
      while (p) {
        const ov = window.getComputedStyle(p).overflowY;
        if ((ov === 'auto' || ov === 'scroll') && p.scrollHeight > p.clientHeight + 10) { innerScrollEl = p; break; }
        p = p.parentElement;
      }
    }
    if (innerScrollEl) innerScrollEl.addEventListener('scroll', onInnerScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      if (innerScrollEl) innerScrollEl.removeEventListener('scroll', onInnerScroll);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [showScoreInfo, showReadingActiveInfo, showControls]);

  // Re-apply desktop mode on orientation/resize changes so it survives rotation
  useEffect(() => {
    const reapply = () => {
      setTimeout(() => {
        const current = isDesktopModeOn();
        setDesktopMode(current);
        setIsDesktopModeLocal(current);
      }, 400);
    };
    window.addEventListener('orientationchange', reapply);
    window.addEventListener('resize', reapply);
    return () => {
      window.removeEventListener('orientationchange', reapply);
      window.removeEventListener('resize', reapply);
    };
  }, []);

  const handleRotate = async () => {
    const desktopWasOn = isDesktopModeOn();
    const result = await rotateScreen();
    if (!result) {
      setRotateToast('Is device mein screen rotation supported nahi hai');
      setTimeout(() => setRotateToast(null), 2500);
    } else {
      // Re-apply desktop mode after rotation settles
      setTimeout(() => {
        if (desktopWasOn) {
          setDesktopMode(true);
          setIsDesktopModeLocal(true);
        }
      }, 500);
    }
  };

  const toggleDesktopMode = () => {
    const newVal = !isDesktopMode;
    setDesktopMode(newVal);
    setIsDesktopModeLocal(newVal);
    onDesktopModeChange?.(newVal);
  };
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const obs = new MutationObserver(() => {
      const m = detectMode();
      setThemeMode(prev => (prev !== m ? m : prev));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  // Theme flip — load the stored colour for the new theme (or its default)
  useEffect(() => { setTextColor(getStoredColor(themeMode)); }, [themeMode]);
  const pickColor = (hex: string) => {
    setTextColor(hex);
    try { localStorage.setItem(COLOR_KEY(themeMode), hex); } catch {}
    try { if (navigator.vibrate) navigator.vibrate(20); } catch {}
  };

  const changeFontSize = (delta: number) => {
    setFontIdx(prev => {
      const next = Math.max(0, Math.min(3, prev + delta));
      try { localStorage.setItem(FONT_SIZE_KEY, String(next)); } catch {}
      try { window.dispatchEvent(new CustomEvent('nst-reading-style-changed')); } catch {}
      return next;
    });
    try { if (navigator.vibrate) navigator.vibrate(30); } catch {}
  };

  // Stay in sync with external Reading-Style controls (e.g. PdfView's outer
  // "Aa" font popover). When the user changes size or family from outside,
  // every mounted reader re-reads the stored values so the change is visible
  // instantly without unmounting/remounting the topic list.
  useEffect(() => {
    const sync = () => {
      try {
        const v = parseInt(localStorage.getItem(FONT_SIZE_KEY) || '1', 10);
        if (!isNaN(v) && v >= 0 && v <= 8) setFontIdx(v);
      } catch {}
      try {
        const id = localStorage.getItem(FONT_FAMILY_KEY);
        setFontFamilyId(id);
      } catch {}
      try {
        const w = parseInt(localStorage.getItem(FONT_WEIGHT_KEY) || '400', 10);
        if ([400, 600, 800, 900].includes(w)) setFontWeight(w);
      } catch {}
    };
    window.addEventListener('nst-reading-style-changed', sync);
    return () => window.removeEventListener('nst-reading-style-changed', sync);
  }, []);

  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Notify parent whenever the active line changes so position can be persisted.
  const onPositionChangeRef = useRef(onPositionChange);
  useEffect(() => { onPositionChangeRef.current = onPositionChange; }, [onPositionChange]);
  useEffect(() => {
    if (activeIdx !== null && onPositionChangeRef.current) {
      onPositionChangeRef.current(activeIdx);
    }
  }, [activeIdx]);

  // On first mount, scroll the saved line into view (without auto-playing).
  useEffect(() => {
    if (initialIndex == null) return;
    const t = setTimeout(() => {
      itemRefs.current[initialIndex]?.scrollIntoView({ behavior: 'auto', block: 'center' });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a stable ref to the latest onComplete so playFrom (memoised) always
  // calls the freshest version without retriggering its dependencies.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const playFrom = useCallback((idx: number) => {
    if (!isReadingRef.current) return;
    if (idx >= activeTopicList.length) {
      isReadingRef.current = false;
      setIsReading(false);
      setActiveIdx(null);
      if (onCompleteRef.current) onCompleteRef.current();
      return;
    }
    // When important-only filter is on, skip topics that aren't important
    // (headings and non-important body lines) — advance to the next one silently.
    if (showOnlyImportantRef.current) {
      const t = activeTopicList[idx];
      if (t.isHeading || !isTopicImportant(t.text)) {
        playFrom(idx + 1);
        return;
      }
    }
    setActiveIdx(idx);
    // TTS highlight → +1 score per topic read aloud
    // Only fires in AUTO mode (Read All / Smart Reading popup). Manual topic taps
    // have their own separate reward (READ_MANUAL_TOPIC_10S +2) via Touch Protection.
    if (scoreSessionRef.current && !activeTopicList[idx]?.isHeading && ttsIsAutoRef.current) {
      scoreSessionRef.current.onTtsHighlight();
    }
    setTimeout(() => {
      itemRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 60);
    speakText(
      activeTopicList[idx].text,
      undefined,
      VOICE_SPEEDS[speedIdxRef.current] ?? 1.0,
      language,
      undefined,
      () => {
        if (isReadingRef.current) playFrom(idx + 1);
      }
    );
  }, [activeTopicList, language, isTopicImportant]);

  // Stable ref to the latest onReadingStart so we can call it from startFromIndex
  // without making the callback identity unstable.
  const onReadingStartRef = useRef(onReadingStart);
  useEffect(() => { onReadingStartRef.current = onReadingStart; }, [onReadingStart]);

  const startFromIndex = useCallback((startIdx: number) => {
    if (activeTopicList.length === 0) return;
    stopSpeech();
    isReadingRef.current = true;
    setIsReading(true);
    // Notify parent so it can flag this note as "in progress" right away.
    if (onReadingStartRef.current) {
      try { onReadingStartRef.current(); } catch {}
    }
    // Defer to next tick so cancel() flushes before speak()
    setTimeout(() => playFrom(startIdx), 80);
  }, [playFrom, activeTopicList.length]);

  const stopAll = useCallback(() => {
    isReadingRef.current = false;
    setIsReading(false);
    setActiveIdx(null);
    stopSpeech();
  }, []);

  // Stop on unmount — skip if background play mode is active
  useEffect(() => {
    return () => {
      if ((window as any).__nst_bg_tts__) return;
      isReadingRef.current = false;
      stopSpeech();
    };
  }, []);

  // Stop TTS when user switches browser tab — skip if background play mode is active
  // Also: when page becomes visible again while bg-TTS is on, resume any auto-paused utterance
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (isReadingRef.current && !(window as any).__nst_bg_tts__) {
          stopAll();
        }
        // On mobile, browsers often pause speechSynthesis when hidden.
        // Keep the queue alive so the onend callback still fires for the next chunk.
        if ((window as any).__nst_bg_tts__ && 'speechSynthesis' in window) {
          try { window.speechSynthesis.resume(); } catch {}
        }
      } else {
        // Page became visible — if bg-TTS is on and we're mid-reading, resume any paused utterance
        if ((window as any).__nst_bg_tts__ && isReadingRef.current && 'speechSynthesis' in window) {
          try { window.speechSynthesis.resume(); } catch {}
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [stopAll]);

  // Mobile background-play keepalive: browsers pause speechSynthesis ~30s after
  // the page is hidden. This periodic resume() forces the engine to keep running
  // so the onend → next-chunk chain continues even while the screen is off.
  useEffect(() => {
    const tick = () => {
      if ((window as any).__nst_bg_tts__ && isReadingRef.current && 'speechSynthesis' in window) {
        try { window.speechSynthesis.resume(); } catch {}
      }
    };
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // Reset position only when content actually changes after the first render
  // (so a fresh mount with restored initialIndex isn't immediately wiped).
  const contentChangedOnce = useRef(false);
  useEffect(() => {
    if (!contentChangedOnce.current) {
      contentChangedOnce.current = true;
      return;
    }
    stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Auto-start "Read All" when the autoStart prop is true (used by Lucent's
  // Auto-Read & Sync mode + the Concept-page Read All to chain pages/topics
  // together). Defer slightly so that the stopAll() above on content change
  // has a chance to flush first. When `autoStart` flips from true → false the
  // parent has cancelled chained playback, so we mirror that by stopping any
  // in-flight TTS in this reader so it doesn't keep advancing lines.
  useEffect(() => {
    if (!autoStart) {
      if (isReadingRef.current) stopAll();
      return;
    }
    if (activeTopicList.length === 0) return;
    const t = setTimeout(() => { ttsIsAutoRef.current = true; startFromIndex(0); }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, content]);

  // When a `searchQuery` is provided (Home search → click result), locate the
  // first topic that contains the phrase, scroll to it, highlight it, and
  // auto-start TTS from that line so the user instantly hears the matched part.
  const searchHandledRef = useRef<string>('');
  useEffect(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) return;
    if (activeTopicList.length === 0) return;
    // Avoid re-firing for the same query on incidental re-renders.
    const sig = `${q}::${activeTopicList.length}`;
    if (searchHandledRef.current === sig) return;
    searchHandledRef.current = sig;

    const matchIdx = activeTopicList.findIndex(t => (t.text || '').toLowerCase().includes(q));
    if (matchIdx < 0) return;
    const t = setTimeout(() => {
      itemRefs.current[matchIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ttsIsAutoRef.current = true;
      startFromIndex(matchIdx);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, content]);

  if (!isHtmlContent && activeTopicList.length === 0) {
    return (
      <div className={`text-center py-10 text-slate-400 ${className || ''}`}>
        <BookOpen size={36} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm font-medium">No readable text</p>
      </div>
    );
  }

  // ── HTML NOTES MODE — render HTML directly, no chunking ──
  // Only enter this path when htmlViewMode === 'html'. If 'chunk', fall through
  // to the normal tappable chunk reader (using stripped plain text topics).
  // Also enters this path when an external htmlContent prop is provided (note has
  // separate chunkNotes + htmlNotes fields) and user switches to HTML view.
  const hasHtmlToShow = isHtmlContent || !!htmlContent?.trim();
  if (hasHtmlToShow && htmlViewMode === 'html') {
    const handleHtmlReadAll = () => {
      if (isReading) {
        try { if (navigator.vibrate) navigator.vibrate(30); } catch {}
        stopSpeech();
        setIsReading(false);
      } else {
        try { if (navigator.vibrate) navigator.vibrate(50); } catch {}
        setIsReading(true);
        if (onReadingStart) onReadingStart();
        speakText(htmlPlainText, language)
          .then(() => { setIsReading(false); if (onComplete) onComplete(); })
          .catch(() => setIsReading(false));
      }
    };
    const readAllBtn = (
      <button
        onClick={handleHtmlReadAll}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm active:scale-95 transition shrink-0 ${isReading ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
      >
        {isReading ? <><Square size={13} /> Stop</> : <><Volume2 size={13} /> Read All</>}
      </button>
    );
    return (
      <div className={className || ''}>
        <style>{`
          .chnr-html{overflow-x:hidden;width:100%;box-sizing:border-box}
          :where(.chnr-html) *{min-width:0;box-sizing:border-box}
          :where(.chnr-html) h1{color:#7c3aed;font-size:1.08em;font-weight:900;margin:11px 0 5px;border-bottom:2px solid #e9d5ff;padding-bottom:3px}
          :where(.chnr-html) h2{color:#6d28d9;font-size:1em;font-weight:800;margin:10px 0 4px}
          :where(.chnr-html) h3{color:#7c3aed;font-size:0.93em;font-weight:700;margin:8px 0 3px}
          :where(.chnr-html) h4,:where(.chnr-html) h5,:where(.chnr-html) h6{color:#8b5cf6;font-size:0.88em;font-weight:700;margin:6px 0 2px}
          :where(.chnr-html) p{margin:3px 0;line-height:1.55;word-break:break-word;overflow-wrap:break-word}
          :where(.chnr-html) ul{padding-left:16px;margin:4px 0;list-style:disc}
          :where(.chnr-html) ol{padding-left:16px;margin:4px 0;list-style:decimal}
          :where(.chnr-html) li{margin:2px 0;line-height:1.55;word-break:break-word;overflow-wrap:break-word}
          :where(.chnr-html) .box,:where(.chnr-html) .note-box,:where(.chnr-html) .highlight-box{background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:7px;padding:5px 9px;margin:5px 0;font-size:0.82em;line-height:1.5;word-break:break-word;overflow-wrap:break-word}
          :where(.chnr-html) .warning-box{background:#fffbeb;border:1.5px solid #fde68a;border-radius:7px;padding:5px 9px;margin:5px 0;font-size:0.82em;line-height:1.5;word-break:break-word;overflow-wrap:break-word}
          :where(.chnr-html) .success-box{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:7px;padding:5px 9px;margin:5px 0;font-size:0.82em;line-height:1.5;word-break:break-word;overflow-wrap:break-word}
          :where(.chnr-html) strong,:where(.chnr-html) b{font-weight:800}
          :where(.chnr-html) hr{border:none;border-top:1.5px solid #e9d5ff;margin:9px 0}
          :where(.chnr-html) table{border-collapse:collapse;margin:6px 0;font-size:0.82em;width:100%}
          :where(.chnr-html) th{background:#7c3aed;color:white;padding:4px 8px;text-align:left;word-break:break-word;overflow-wrap:break-word}
          :where(.chnr-html) td{padding:3px 8px;border:1px solid #e2e8f0;word-break:break-word;overflow-wrap:break-word;vertical-align:top}
          :where(.chnr-html) tr:nth-child(even) td{background:#f8f5ff}
          :where(.chnr-html) .no-break{white-space:nowrap}
          :where(.chnr-html) .note-item{word-break:break-word;overflow-wrap:break-word;text-align:left}
          :where(.chnr-html) .chnr-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%;margin:8px 0}
          :where(.chnr-html) .table-container{overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%}
          :where(.chnr-html) img{max-width:100%;height:auto}
          :where(.chnr-html) div[style*="display:grid"],:where(.chnr-html) div[style*="display: grid"],:where(.chnr-html) div[style*="display:flex"],:where(.chnr-html) div[style*="display: flex"]{overflow:hidden}
          .chnr-html .container,.chnr-html [class*="container"]{max-width:100%!important;width:auto!important;box-sizing:border-box!important;margin-left:0!important;margin-right:0!important}
          .chnr-html body{max-width:100%!important}
        `}</style>
        {/* Toolbar with HTML badge + TTS Reader toggle */}
        {!hideTopBar && (
          <div className="sticky top-0 z-20 bg-white py-2 mb-3">
            <div className="flex items-center gap-2 min-w-0 px-1">
              <div className="text-xs font-bold text-slate-600 truncate flex-1 min-w-0">
                {topBarLabel || 'Notes'}
              </div>
              <span className="text-[9px] font-black text-violet-500 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full uppercase shrink-0">HTML</span>
              {/* Rotate button */}
              <button
                type="button"
                onClick={handleRotate}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-600 active:scale-90 transition shrink-0"
                title="Screen rotate karo"
              >
                <RotateCcw size={13} />
              </button>
              {preferChunkMode && (
                <button
                  onClick={() => { stopSpeech(); setIsReading(false); setHtmlViewMode('chunk'); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white border border-amber-600 shrink-0 active:scale-95 transition-all"
                  title="TTS tappable reader mein switch karo"
                >
                  <Volume2 size={10} /> TTS
                </button>
              )}
            </div>
          </div>
        )}
        {hideTopBar && preferChunkMode && (
          <div className="flex justify-end mb-1">
            <button
              onClick={() => { stopSpeech(); setIsReading(false); setHtmlViewMode('chunk'); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white border border-amber-600 active:scale-95 transition-all"
              title="TTS tappable reader mein switch karo"
            >
              <Volume2 size={10} /> TTS Reader
            </button>
          </div>
        )}
        {/* HTML content rendered directly — single render only, no duplicate below */}
        {/* processedExternalHtml = htmlContent prop run through full pipeline (body-extract,
            style-strip, table-wrap). processedHtmlContent = same pipeline on content prop.
            Both paths strip <style>/<script> and handle full-HTML docs safely. */}
        <div
          className="chnr-html notes-html-content px-1"
          dangerouslySetInnerHTML={{ __html: processedExternalHtml || processedHtmlContent }}
          style={{ fontSize: '13.5px', lineHeight: '1.55', color: '#1e293b' }}
        />
      </div>
    );
  }

  return (
    <>
    <div className={className || ''}>
      {/* Rotate toast — full-width top banner, same position as app top banners */}
      {rotateToast && (
        <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold pointer-events-none animate-in slide-in-from-top-2 fade-in duration-300"
          style={{ background: 'linear-gradient(90deg, #1e293b, #334155, #1e293b)', color: '#e2e8f0' }}>
          <RotateCcw size={12} className="shrink-0" />
          {rotateToast}
        </div>
      )}
      {/* Centered Reading Style popover (Portal-based, viewport-centred).
          Tapping the small Type ("T") button in the top bar opens this same
          popup — same as PdfView's outer "Aa" button — so the experience is
          consistent regardless of where the picker is launched from. */}
      <ReadingStylePopover isOpen={showFontFamilyMenu} onClose={() => setShowFontFamilyMenu(false)} />
      {/* Header with font controls + Read All.
          NOTE: Must be fully opaque (`bg-white`) — earlier `bg-white/95` +
          backdrop-blur let the scrolling notes content bleed visibly behind
          the READ ALL bar, which broke readability. We also bump z-index so
          this bar always sits above scrolled content.
          When hideTopBar=true, only the READ ALL button is shown (compact sticky bar). */}
      {!hideTopBar && (
        <div ref={toolbarRef} className="sticky top-0 z-20 bg-white mb-3" style={{ width: '100vw', marginLeft: 'calc(-1 * (100vw - 100%) / 2)', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
          {/* ── Slim bar — back + counter + icons ── */}
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-600 active:scale-90 transition shrink-0"
                title="Back"
              >
                <ChevronRight size={15} className="rotate-180" />
              </button>
            )}
            {/* Counter / READING ACTIVE label */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
              <span className="shrink-0 text-[11px] font-black tabular-nums text-slate-600 select-none">
                {isReading && activeIdx !== null
                  ? `${activeIdx + 1}/${activeTopicList.length}`
                  : activeTopicList.length > 0
                    ? `1/${activeTopicList.length}`
                    : ''}
              </span>
              {isReading && (
                <span className="shrink-0 text-[8px] font-black uppercase tracking-[0.14em] text-indigo-400 select-none">
                  READING ACTIVE
                </span>
              )}
              {/* Live session score */}
              {scoreState && scoreState.totalSessionScore > 0 && (
                <span
                  className="shrink-0 text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-full"
                  style={{
                    color: '#4ade80',
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  +{scoreState.totalSessionScore}
                </span>
              )}
            </div>
            {/* 📖 Book icon button — score info popup (hidden when popup is open) */}
            {readingScoreConfig && scoreState && !showScoreInfo && (
              <button
                type="button"
                onClick={openScoreInfo}
                title={scoreState.mode === 'writing' ? 'Writing score info' : 'Reading score info'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8,
                  background: scoreState.mode === 'writing'
                    ? 'rgba(16,185,129,0.15)'
                    : isReading ? 'rgba(99,102,241,0.15)' : 'rgba(100,116,139,0.10)',
                  border: scoreState.mode === 'writing'
                    ? '1.5px solid rgba(16,185,129,0.5)'
                    : isReading ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(100,116,139,0.2)',
                  cursor: 'pointer', flexShrink: 0,
                  animation: scoreState.mode === 'writing' ? 'pulse 1.5s ease-in-out infinite' : isReading ? 'pulse 1.5s ease-in-out infinite' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {scoreState.mode === 'writing'
                  ? <span style={{ fontSize: 14, lineHeight: 1 }}>✍️</span>
                  : <BookOpen size={13} style={{ color: isReading ? '#6366f1' : '#94a3b8' }} />
                }
              </button>
            )}
            {/* 🛡️ Touch Protection — icon-only compact button (hidden when popup is open) */}
            {readingScoreConfig && !showReadingActiveInfo && (
              <button
                type="button"
                onClick={openReadingActiveInfo}
                title="Touch Protection info"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(100,116,139,0.10)',
                  border: '1px solid rgba(100,116,139,0.2)',
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>🛡️</span>
              </button>
            )}
            {/* Admin Edit button — only for admin/subadmin when onAdminEdit provided */}
            {isAdmin && onAdminEdit && (
              <button
                type="button"
                onClick={onAdminEdit}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-orange-50 border border-orange-300 text-orange-600 active:scale-90 transition shrink-0"
                title="Edit / Delete Notes (Admin)"
              >
                <Pencil size={13} />
              </button>
            )}
            {/* Grid icon — parent more options */}
            {onMoreOptions && !hideInline3dot && (
              <button
                type="button"
                onClick={onMoreOptions}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 text-slate-500 active:scale-90 transition shrink-0"
                title="More options"
              >
                <LayoutGrid size={14} />
              </button>
            )}
            {/* Admin board button — only for admins */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminBoard(v => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 border border-slate-200 active:scale-90 transition shrink-0"
                title="Admin WhiteBoard"
              >
                <Presentation size={14} />
              </button>
            )}
            {/* 3-dot icon — opens full controls panel */}
            <button
              type="button"
              onClick={() => setShowControls(s => !s)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border active:scale-90 transition shrink-0 ${showControls ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-100 border-slate-200 text-slate-500'}`}
              title="Controls"
            >
              <MoreVertical size={14} />
            </button>
          </div>

          {/* ✏️ Correction Mode active indicator strip */}
          {showSuggestionPanel && (
            <div style={{ borderTop: '2px solid #f59e0b', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12 }}>✏️</span>
                <span style={{ fontSize: 9, fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Correction Mode — Kisi bhi point ke samne ✏️ tap karo</span>
              </div>
              <button type="button" onClick={() => { setShowSuggestionPanel(false); setInlineCorrectionIdx(null); setInlineCorrectionText(''); setInlineCorrectionDone(false); setInlineCorrectionError(false); }} style={{ background: 'rgba(146,64,14,0.1)', border: 'none', borderRadius: 6, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#92400e', fontSize: 11, fontWeight: 900 }}>✕</button>
            </div>
          )}

          {/* ── Reading Score banner — inline inside toolbar (row 1 or 2 depending on order) ── */}
          {showScoreInfo && scoreState && (
            <div
              onTouchStart={(e) => { scoreBannerSwipeX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const dx = scoreBannerSwipeX.current - e.changedTouches[0].clientX;
                if (dx > 60) setShowScoreInfo(false);
              }}
              style={{
                borderTop: '2px solid #6366f1',
                background: 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%)',
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px',
                animation: 'tp-banner-in 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                userSelect: 'none', touchAction: 'pan-y',
                boxShadow: '0 3px 10px rgba(99,102,241,0.13), inset 0 -1px 0 #c7d2fe',
              }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>{scoreState.mode === 'writing' ? '✍️' : '📖'}</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: scoreState.mode === 'writing' ? '#059669' : isReading ? '#6366f1' : '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                {scoreState.mode === 'writing' ? 'Writing Score' : isReading ? 'Reading Active' : 'Reading Score'}
              </span>
              <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Score</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#6366f1', lineHeight: 1.2 }}>+{scoreState.totalSessionScore}</span>
              </div>
              <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Progress</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#16a34a', lineHeight: 1.2 }}>{Math.round(scoreState.progressPercent)}%</span>
              </div>
              <div style={{ width: 1, height: 14, background: '#e2e8f0', flexShrink: 0 }} />
              {(() => {
                const _subMul = readingScoreConfig?.subscriptionLevel === 'ULTRA' ? 1.5
                  : readingScoreConfig?.subscriptionLevel === 'BASIC' ? 1.2 : 1;
                const _boostMul = 1 + (readingScoreConfig?.boostPercent || 0) / 100;
                const _base = scoreState.mode === 'reading' ? 5 : scoreState.mode === 'writing' ? 10 : 25;
                const _pts = Math.max(1, Math.round(_base * _subMul * _boostMul));
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>Next</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#f59e0b', lineHeight: 1.2 }}>
                      {!scoreState.isPaused ? `+${_pts} in ${scoreState.nextRewardInSec}s` : 'Paused'}
                    </span>
                  </div>
                );
              })()}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => setShowScoreInfo(false)}
                style={{
                  background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                  borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#94a3b8', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0, padding: 0,
                }}
                aria-label="Dismiss"
              >✕</button>
            </div>
          )}

          {/* ── Touch Protection banner — inline inside toolbar, stacks below Reading Score if both open ── */}
          {showReadingActiveInfo && (() => {
            const _subMul = readingScoreConfig?.subscriptionLevel === 'ULTRA' ? 1.5
              : readingScoreConfig?.subscriptionLevel === 'BASIC' ? 1.2 : 1;
            const _boostMul = 1 + (readingScoreConfig?.boostPercent || 0) / 100;
            const _tp2pts = Math.max(1, Math.round(2 * _subMul * _boostMul));
            return (
              <div
                onTouchStart={(e) => { tpBannerSwipeX.current = e.touches[0].clientX; }}
                onTouchEnd={(e) => {
                  const dx = tpBannerSwipeX.current - e.changedTouches[0].clientX;
                  if (dx > 60) setShowReadingActiveInfo(false);
                }}
                style={{
                  borderTop: '2px solid #0ea5e9',
                  background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px',
                  animation: 'tp-banner-in 0.22s cubic-bezier(0.34,1.56,0.64,1)',
                  userSelect: 'none', touchAction: 'pan-y',
                  boxShadow: '0 3px 10px rgba(14,165,233,0.12), inset 0 -1px 0 #bae6fd',
                }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>🛡️</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>
                  Touch Pro
                </span>
                <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>
                  10s ruko → <span style={{ color: '#16a34a', fontWeight: 800 }}>+{_tp2pts} milega</span>
                </span>
                <div style={{ flex: 1, height: 3, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', minWidth: 32 }}>
                  <div style={{
                    width: scoreState ? `${Math.round(((10 - (scoreState.touchProtectionCooldownSec ?? 0)) / 10) * 100)}%` : '0%',
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                    borderRadius: 99,
                    transition: 'width 0.9s linear',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#6366f1', flexShrink: 0, minWidth: 22, textAlign: 'right' }}>
                  {scoreState?.touchProtectionCooldownSec != null ? `${String(Math.max(0, Math.round(scoreState.touchProtectionCooldownSec))).padStart(2,'0')}s` : '--'}
                </span>
                <button
                  onClick={() => setShowReadingActiveInfo(false)}
                  style={{
                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#94a3b8', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0, padding: 0,
                  }}
                  aria-label="Dismiss"
                >✕</button>
              </div>
            );
          })()}

          {/* ── Controls panel — Row 1: bar style matching READING SCORE / TOUCH PRO ── */}
          {showControls && (
            <div style={{ borderTop: '2px solid #e2e8f0', background: 'linear-gradient(180deg, #f1f5f9 0%, #f8fafc 100%)', display: 'flex', alignItems: 'stretch', animation: 'tp-banner-in 0.18s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: '0 3px 10px rgba(0,0,0,0.07)' }}>
              {/* READ ALL / STOP */}
              <button
                type="button"
                onClick={() => {
                  if (isReading) { try { if (navigator.vibrate) navigator.vibrate(30); } catch {} stopAll(); }
                  else { try { if (navigator.vibrate) navigator.vibrate(50); } catch {} ttsIsAutoRef.current = true; startFromIndex(initialIndex ?? 0); }
                }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: isReading ? '#fef2f2' : '#eef2ff', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}
              >
                {isReading ? <Square size={12} style={{ color: '#ef4444' }} /> : <Volume2 size={12} style={{ color: '#6366f1' }} />}
                <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: isReading ? '#ef4444' : '#6366f1', lineHeight: 1 }}>
                  {isReading ? 'Stop' : (initialIndex ? 'Resume' : 'Read')}
                </span>
              </button>
              {/* A− */}
              <button type="button" onClick={() => changeFontSize(-1)} disabled={fontIdx === 0}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0', opacity: fontIdx === 0 ? 0.3 : 1 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#334155', lineHeight: 1 }}>A−</span>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Size</span>
              </button>
              {/* A+ */}
              <button type="button" onClick={() => changeFontSize(1)} disabled={fontIdx === 3}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0', opacity: fontIdx === 3 ? 0.3 : 1 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#334155', lineHeight: 1 }}>A+</span>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Size</span>
              </button>
              {/* Rotate */}
              <button type="button" onClick={handleRotate}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <RotateCcw size={12} style={{ color: '#64748b' }} />
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Reset</span>
              </button>
              {/* Offline Save */}
              {onSaveOffline && (
                <button type="button" onClick={() => { onSaveOffline(); setShowControls(false); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: isSavedOffline ? '#f0fdf4' : 'transparent', cursor: 'pointer', border: 'none', borderLeft: '1px solid #e2e8f0' }}>
                  <WifiOff size={12} style={{ color: isSavedOffline ? '#16a34a' : '#64748b' }} />
                  <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: isSavedOffline ? '#16a34a' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {isSavedOffline ? 'Saved' : 'Save'}
                  </span>
                </button>
              )}
              {/* 💡 Suggestion/Correction — hidden in school mode */}
              {!hideFix && (
                <button type="button" onClick={() => { setShowSuggestionPanel(s => !s); setShowControls(false); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: showSuggestionPanel ? '#fef3c7' : 'transparent', cursor: 'pointer', border: 'none', borderLeft: '1px solid #e2e8f0' }}>
                  <Lightbulb size={12} style={{ color: showSuggestionPanel ? '#d97706' : '#64748b' }} />
                  <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: showSuggestionPanel ? '#d97706' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Fix</span>
                </button>
              )}
            </div>
          )}

          {/* ── MORE panel — Row 2: bar style matching READING SCORE / TOUCH PRO ── */}
          {showControls && (
            <div style={{ borderTop: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #e8edf3 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'stretch', boxShadow: 'inset 0 -2px 0 #d1d9e0' }}>

              {/* Font Style */}
              <button type="button"
                onClick={() => { setShowFontFamilyMenu(true); setShowControls(false); TOP_10_READING_FONTS.forEach(f => ensureReadingFontLoaded(f.gfontParam)); }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: activeFont ? '#eef2ff' : 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <Type size={12} style={{ color: activeFont ? '#6366f1' : '#64748b' }} />
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: activeFont ? '#6366f1' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Style</span>
              </button>

              {/* Text Color */}
              {!textColorOverride ? (
                <div style={{ flex: 1, position: 'relative', borderRight: '1px solid #e2e8f0' }}>
                  <button type="button" onClick={() => setShowColorMenu(s => !s)}
                    style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: 'transparent', cursor: 'pointer', border: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Palette size={10} style={{ color: '#64748b' }} />
                      <span style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #cbd5e1', backgroundColor: textColor, display: 'inline-block' }} />
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Color</span>
                  </button>
                  {showColorMenu && (
                    <>
                      <div className="fixed inset-0 z-[310]" onClick={() => setShowColorMenu(false)} />
                      <div className="absolute left-0 top-full mt-1 z-[320] bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52 animate-in fade-in slide-in-from-top-2 duration-150">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                          Text Color
                        </p>
                        <div className="grid grid-cols-6 gap-2">
                          {READING_PALETTE['light'].map((sw, i) => {
                            const isSelected = sw.hex.toLowerCase() === textColor.toLowerCase();
                            const isRecommended = i === 0;
                            return (
                              <button key={sw.hex} type="button"
                                onClick={() => { pickColor(sw.hex); setShowColorMenu(false); }}
                                title={`${sw.name}${isRecommended ? ' · Recommended' : ''}`}
                                className={`relative aspect-square rounded-lg border-2 transition-all active:scale-90 ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-400'}`}
                                style={{ backgroundColor: sw.hex }}>
                                {isSelected && <span className="absolute inset-0 flex items-center justify-center"><Check size={12} className="text-white drop-shadow" strokeWidth={4} /></span>}
                                {isRecommended && !isSelected && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-[8px] font-black text-white flex items-center justify-center shadow">★</span>}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">★ = recommended for this mode</p>
                      </div>
                    </>
                  )}
                </div>
              ) : <div style={{ flex: 1, borderRight: '1px solid #e2e8f0' }} />}

              {/* Search */}
              <button type="button"
                onClick={() => { setInlineSearch(s => !s); setInlineQuery(''); setShowControls(false); }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: inlineSearch ? '#eff6ff' : 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <Search size={12} style={{ color: inlineSearch ? '#3b82f6' : '#64748b' }} />
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: inlineSearch ? '#3b82f6' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Search</span>
              </button>

              {/* Voice Speed */}
              <button type="button" onClick={cycleSpeed}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: '#334155', lineHeight: 1 }}>{SPEED_LABELS[speedIdx]}</span>
                <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Speed</span>
              </button>

              {/* Important Filter */}
              {(isStarred || isAdminImportant || isMarked2) ? (
                <button type="button"
                  onClick={() => { setShowOnlyImportant(s => !s); setShowControls(false); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: showOnlyImportant ? '#fef3c7' : 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                  <Star size={12} style={{ color: showOnlyImportant ? '#d97706' : '#64748b', fill: showOnlyImportant ? '#d97706' : 'none' }} />
                  <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: showOnlyImportant ? '#d97706' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Imp</span>
                </button>
              ) : <div style={{ flex: 1, borderRight: '1px solid #e2e8f0' }} />}

              {/* Ultra View */}
              {hasHtmlToShow ? (
                isUltraUser ? (
                  <button type="button"
                    onClick={() => { stopAll(); setHtmlViewMode('html'); onHtmlOpen?.(); setShowControls(false); }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: '#f5f3ff', cursor: 'pointer', border: 'none' }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>⚡</span>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#7c3aed', letterSpacing: '0.05em', lineHeight: 1 }}>Ultra</span>
                  </button>
                ) : (
                  <button type="button"
                    onClick={() => { setShowHtmlUnlockPrompt(true); setShowControls(false); }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '6px 4px', background: 'transparent', cursor: 'pointer', border: 'none' }}>
                    <span style={{ fontSize: 13, lineHeight: 1 }}>🔒</span>
                    <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Ultra</span>
                  </button>
                )
              ) : <div style={{ flex: 1 }} />}

            </div>
          )}

          {/* Ultra unlock prompt (portal-style) */}
          {showHtmlUnlockPrompt && (
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
              style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowHtmlUnlockPrompt(false)}
            >
              <div
                className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                style={{ boxShadow: '0 32px 64px -12px rgba(0,0,0,0.35)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-6 pt-7 pb-5 text-center">
                  <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">👑</div>
                  <h3 className="text-white font-black text-lg leading-tight">Ultra Plan Required</h3>
                  <p className="text-white/80 text-xs mt-1 font-medium">Styled HTML notes sirf Ultra subscribers ke liye hain</p>
                </div>
                <div className="px-6 py-5">
                  <div className="space-y-2.5 mb-5">
                    {['Beautifully styled notes with formatting', 'Diagrams, tables & rich content', 'Unlimited daily access'].map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                          <span className="text-violet-600 text-[10px] font-black">✓</span>
                        </div>
                        <p className="text-slate-600 text-xs font-medium">{f}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowHtmlUnlockPrompt(false); onUpgradeClick?.(); }}
                      className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-2xl font-black text-sm active:scale-95 transition shadow-md shadow-violet-200"
                    >
                      ⚡ Upgrade to Ultra
                    </button>
                    <button
                      onClick={() => setShowHtmlUnlockPrompt(false)}
                      className="px-5 py-3 bg-slate-100 text-slate-500 rounded-2xl font-black text-sm active:scale-95 transition"
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ── Controls overlay for school mode (hideTopBar=true) ── */}
      {hideTopBar && showControls && (
        <>
          <div className="fixed inset-0 z-[490]" onClick={() => setShowControls(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-[500] animate-in slide-in-from-bottom-2 duration-200" style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.12)' }}>
            {/* Row 1 */}
            <div style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #f8fafc 100%)', display: 'flex', alignItems: 'stretch', borderTop: '2px solid #e2e8f0' }}>
              <button type="button"
                onClick={() => { if (isReading) { try { if (navigator.vibrate) navigator.vibrate(30); } catch {} stopAll(); } else { try { if (navigator.vibrate) navigator.vibrate(50); } catch {} ttsIsAutoRef.current = true; startFromIndex(initialIndex ?? 0); } }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: isReading ? '#fef2f2' : '#eef2ff', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                {isReading ? <Square size={14} style={{ color: '#ef4444' }} /> : <Volume2 size={14} style={{ color: '#6366f1' }} />}
                <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: isReading ? '#ef4444' : '#6366f1', lineHeight: 1 }}>{isReading ? 'Stop' : (initialIndex ? 'Resume' : 'Read')}</span>
              </button>
              <button type="button" onClick={() => changeFontSize(-1)} disabled={fontIdx === 0}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0', opacity: fontIdx === 0 ? 0.3 : 1 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#334155', lineHeight: 1 }}>A−</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Size</span>
              </button>
              <button type="button" onClick={() => changeFontSize(1)} disabled={fontIdx === 3}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0', opacity: fontIdx === 3 ? 0.3 : 1 }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: '#334155', lineHeight: 1 }}>A+</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Size</span>
              </button>
              {onSaveOffline && (
                <button type="button" onClick={() => { onSaveOffline(); setShowControls(false); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: isSavedOffline ? '#f0fdf4' : 'transparent', cursor: 'pointer', border: 'none' }}>
                  <WifiOff size={14} style={{ color: isSavedOffline ? '#16a34a' : '#64748b' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: isSavedOffline ? '#16a34a' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>{isSavedOffline ? 'Saved' : 'Save'}</span>
                </button>
              )}
            </div>
            {/* Row 2 */}
            <div style={{ borderTop: '1px solid #e2e8f0', background: 'linear-gradient(180deg, #e8edf3 0%, #f1f5f9 100%)', display: 'flex', alignItems: 'stretch', boxShadow: 'inset 0 -2px 0 #d1d9e0' }}>
              <button type="button"
                onClick={() => { setShowFontFamilyMenu(true); setShowControls(false); TOP_10_READING_FONTS.forEach(f => ensureReadingFontLoaded(f.gfontParam)); }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: activeFont ? '#eef2ff' : 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <Type size={14} style={{ color: activeFont ? '#6366f1' : '#64748b' }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: activeFont ? '#6366f1' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Style</span>
              </button>
              <button type="button" onClick={cycleSpeed}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#334155', lineHeight: 1 }}>{SPEED_LABELS[speedIdx]}</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Speed</span>
              </button>
              <button type="button"
                onClick={() => { setInlineSearch(s => !s); setInlineQuery(''); setShowControls(false); }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: inlineSearch ? '#eff6ff' : 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                <Search size={14} style={{ color: inlineSearch ? '#3b82f6' : '#64748b' }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: inlineSearch ? '#3b82f6' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Search</span>
              </button>
              {/* Important Filter — school mode */}
              {(isStarred || isAdminImportant || isMarked2) && (
                <button type="button"
                  onClick={() => { setShowOnlyImportant(s => !s); setShowControls(false); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: showOnlyImportant ? '#fef3c7' : 'transparent', cursor: 'pointer', border: 'none', borderRight: '1px solid #e2e8f0' }}>
                  <Star size={14} style={{ color: showOnlyImportant ? '#d97706' : '#64748b', fill: showOnlyImportant ? '#d97706' : 'none' }} />
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: showOnlyImportant ? '#d97706' : '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Imp</span>
                </button>
              )}
              <button type="button" onClick={() => setShowControls(false)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 4px', background: 'transparent', cursor: 'pointer', border: 'none' }}>
                <X size={14} style={{ color: '#64748b' }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', lineHeight: 1 }}>Close</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Inline search panel */}
      {inlineSearch && (
        <div className="sticky top-[52px] z-10 bg-white border-b border-slate-100 px-0 pb-2 mb-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
            <input
              autoFocus
              type="text"
              value={inlineQuery}
              onChange={e => setInlineQuery(e.target.value)}
              placeholder="Koi topic ya line dhundho..."
              className="w-full pl-8 pr-8 py-2 text-sm border border-blue-200 rounded-xl bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 placeholder:text-slate-400"
            />
            {inlineQuery && (
              <button
                onClick={() => setInlineQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >✕</button>
            )}
          </div>
          {inlineQuery.trim() && (() => {
            const q = inlineQuery.trim().toLowerCase();
            const hits = activeTopicList
              .map((t, idx) => ({ t, idx }))
              .filter(({ t }) => !t.isHeading && (t.text || '').toLowerCase().includes(q) &&
                (!showOnlyImportant || isTopicImportant(t.text)))
              .slice(0, 10);
            if (hits.length === 0) return (
              <p className="text-center text-xs text-slate-400 py-2">Koi result nahi mila</p>
            );
            return (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {hits.map(({ t, idx }) => {
                  const txt = t.text || '';
                  const qi = txt.toLowerCase().indexOf(q);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setInlineSearch(false);
                        setInlineQuery('');
                        setTimeout(() => {
                          itemRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          ttsIsAutoRef.current = true;
                          startFromIndex(idx);
                        }, 100);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 transition text-xs text-slate-700 line-clamp-2"
                    >
                      <span className="text-[10px] text-blue-500 font-bold mr-1">#{idx + 1}</span>
                      {qi > 0 && <span>{txt.slice(0, qi)}</span>}
                      <mark className="bg-yellow-200 text-slate-800 rounded px-0.5">{txt.slice(qi, qi + q.length)}</mark>
                      <span>{txt.slice(qi + q.length)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}


      {/* Smart TTS Suggestion popup — compact, non-blocking, bottom-anchored */}
      {showTtsSuggestPopup && (
        <div
          style={{
            position: 'fixed', bottom: 132, left: 12, right: 12, zIndex: 9998,
            pointerEvents: 'none',
            animation: 'tp-banner-in 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <div
            style={{
              background: 'rgba(10,14,32,0.97)',
              border: '1px solid #38bdf830',
              borderRadius: 16,
              padding: '12px 14px 10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              pointerEvents: 'auto',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>🎧</span>
              <div style={{ flex: 1 }}>
                <span style={{ color: '#7dd3fc', fontSize: 12, fontWeight: 900 }}>Smart Reading Suggestion</span>
              </div>
              <button
                onClick={() => setShowTtsSuggestPopup(false)}
                style={{
                  background: 'rgba(99,102,241,0.15)', border: '1px solid #6366f133',
                  borderRadius: 8, padding: '2px 8px',
                  color: '#64748b', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                }}
              >✕</button>
            </div>

            {/* Body */}
            <div style={{ color: '#94a3b8', fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
              Aap topics me manually navigate kar rahe hain.{' '}
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>Auto TTS Reading</span> switch karo — hands-free padhai aur automatic progress tracking milegi.
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setShowTtsSuggestPopup(false);
                  const startIdx = activeIdx !== null ? activeIdx : 0;
                  ttsIsAutoRef.current = true;
                  startFromIndex(startIdx);
                }}
                style={{
                  flex: 2, padding: '8px 0', borderRadius: 10,
                  background: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
                  color: '#fff', fontWeight: 900, fontSize: 11, border: 'none',
                  cursor: 'pointer',
                }}
              >
                🎙️ TTS Reading Shuru Karo
              </button>
              <button
                onClick={() => setShowTtsSuggestPopup(false)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#64748b', fontWeight: 700, fontSize: 11,
                  border: '1px solid #ffffff15', cursor: 'pointer',
                }}
              >
                Abhi Nahi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reading Score HUD — smart floating icon, tap-to-reveal, auto reward/warning popups */}
      {readingScoreConfig && scoreState && (() => {
        const lvl = getLevelInfo(
          typeof readingScoreConfig.userLevel === 'number'
            ? LEVEL_INFO.find(l => l.level === readingScoreConfig.userLevel)?.minScore ?? 0
            : 0
        );
        return (
          <ReadingScoreHUD
            state={scoreState}
            visible={true}
            levelColor={lvl.color}
            levelLabel={`${lvl.label} L${lvl.level}`}
            hideFloatingButton={true}
          />
        );
      })()}


      {/* ⭐ Important Filter active banner */}
      {showOnlyImportant && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(90deg, #fef3c7, #fffbeb)',
            border: '1px solid #fcd34d',
            borderRadius: 10, padding: '7px 12px', marginBottom: 8,
          }}
        >
          <Star size={13} style={{ color: '#d97706', fill: '#d97706', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 900, color: '#92400e', flex: 1 }}>
            Sirf important points dikh rahe hain
          </span>
          <button
            type="button"
            onClick={() => setShowOnlyImportant(false)}
            style={{ fontSize: 10, fontWeight: 900, color: '#92400e', background: 'rgba(146,64,14,0.1)', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
          >
            Sabhi dikhao
          </button>
        </div>
      )}

      {/* Empty state when filter is on but no important points exist */}
      {showOnlyImportant && (() => {
        const hasAny = activeTopicList.some(t => !t.isHeading && (
          (isStarred && isStarred(t.text)) ||
          (isMarked2 && isMarked2(t.text)) ||
          (isAdminImportant && isAdminImportant(t.text))
        ));
        if (hasAny) return null;
        return (
          <div style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>Koi important point nahi mila</p>
            <p style={{ fontSize: 11, color: '#b45309' }}>Pehle kisi topic ko star karo ya admin se mark karwao</p>
            <button
              type="button"
              onClick={() => setShowOnlyImportant(false)}
              style={{ marginTop: 12, fontSize: 11, fontWeight: 900, color: '#fff', background: '#d97706', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}
            >
              Sabhi points dikhao
            </button>
          </div>
        );
      })()}

      {/* Topic list — tap any line to start TTS from that line */}
      <div className="space-y-1.5">
        {activeTopicList.map((topic, idx) => {
          const isActive = isReading && activeIdx === idx;

          // ── Important filter ── when active, skip headings and non-important topics
          if (showOnlyImportant) {
            if (topic.isHeading) return null;
            if (!isTopicImportant(topic.text)) return null;
          }

          // Headings are non-readable so keep them as static blocks.
          if (topic.isHeading) {
            return (
              <div
                key={`tp-${idx}`}
                ref={(el) => { itemRefs.current[idx] = el; }}
                className="mt-4 mb-2 px-3 py-2 rounded-lg bg-gradient-to-r from-indigo-50 to-transparent border-l-4 border-indigo-400"
              >
                <p
                  className="font-black text-indigo-800 uppercase tracking-wide"
                  style={{ fontSize: `${Math.min(fontSize + 2, 20)}px`, fontFamily: activeFont?.family }}
                  dangerouslySetInnerHTML={{ __html: renderMathInHtml(inlineMd(topic.text)) }}
                />
              </div>
            );
          }

          // Whole topic is a button so taps anywhere on the line start/stop TTS.
          const starred = isStarred ? isStarred(topic.text) : false;
          const starCount = getStarCount ? getStarCount(topic.text) : 0;
          const marked2 = isMarked2 ? isMarked2(topic.text) : false;
          const adminImportant = isAdminImportant ? isAdminImportant(topic.text) : false;
          return (
            <div
              key={`tp-${idx}`}
              ref={(el) => { itemRefs.current[idx] = el as any; }}
              className={`group relative w-full rounded-lg transition-colors ${
                isActive
                  ? 'bg-yellow-50 ring-2 ring-yellow-300'
                  : (marked2 && starred)
                    ? 'bg-purple-50 ring-1 ring-purple-300'
                    : marked2
                      ? 'bg-orange-50 ring-1 ring-orange-200'
                      : adminImportant
                        ? 'bg-amber-50 ring-1 ring-amber-300'
                        : starred
                          ? 'bg-amber-50'
                          : 'hover:bg-slate-50'
              }`}
            >
              {/* Admin-important permanent badge — always visible to all users */}
              {adminImportant && !isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4/5 rounded-r bg-amber-400 pointer-events-none"
                  aria-hidden="true"
                />
              )}
              {adminImportant && (
                <span
                  className="absolute right-1 top-1 text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-300 rounded px-1 py-0 leading-4 pointer-events-none select-none z-10"
                  title="Admin ne important mark kiya hai"
                >
                  ★ IMP
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  try { if (navigator.vibrate) navigator.vibrate(isActive ? 30 : 50); } catch {}
                  if (isActive) {
                    stopAll();
                  } else {
                    // Manual tap → Touch Protection (10 sec stay → +2)
                    // Auto TTS rewards are disabled for manual-tap sessions.
                    ttsIsAutoRef.current = false;
                    if (scoreSessionRef.current && !topic.isHeading && readingScoreConfig) {
                      scoreSessionRef.current.onManualTopicEnter(idx);
                      trackManualTap();
                    }
                    startFromIndex(idx);
                  }
                }}
                aria-label={isActive ? 'Stop reading this line' : 'Read from this line'}
                title={isActive ? 'Tap to stop' : 'Tap to read from here'}
                className="w-full text-left pl-4 pr-10 py-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                <p
                  className={`leading-relaxed ${isActive ? 'text-yellow-900' : ''}`}
                  style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: isActive ? Math.max(fontWeight, 600) : fontWeight,
                    color: isActive ? undefined : (textColorOverride || textColor),
                    fontFamily: activeFont?.family,
                  }}
                >
                  <span className={`font-bold mr-1.5 ${starred ? 'text-amber-400' : 'text-indigo-400'}`}>•</span>
                  <span dangerouslySetInnerHTML={{ __html: renderMathInHtml(inlineMd(topic.text)) }} />
                </p>
                {/* Save count badge intentionally hidden here — yeh ab sirf
                    "Important / Starred Notes" ke Global tab page par dikhega taa ki
                    reading view clean rahe. */}
              </button>
              {/* TTS active indicator */}
              {isActive && (
                <span
                  className="absolute right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-red-100 text-red-600 animate-pulse pointer-events-none"
                  aria-hidden="true"
                >
                  <Square size={12} fill="currentColor" />
                </span>
              )}
              {/* Star button — only visible on the line currently being read by
                  TTS. When TTS stops, the star disappears. The amber background
                  on already-starred lines still indicates "saved to Important
                  Notes". To un-star later, tap the line to start TTS again,
                  then tap the star. ~28px hit area for easy tapping. */}
              {/* Regular star button — hidden when admin is in Mark 2 mode */}
              {onStarToggle && isActive && !(isAdmin && useImportantMark2) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
                    onStarToggle(topic.text);
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  style={{ width: '28px', height: '28px', padding: 0 }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full inline-flex items-center justify-center transition-all shadow-sm border-2 z-10 ${
                    starred
                      ? 'text-amber-600 bg-amber-100 border-amber-400 hover:bg-amber-200'
                      : 'text-amber-500 bg-white border-amber-300 hover:bg-amber-50'
                  }`}
                  aria-label={starred ? 'Remove star' : 'Star this note'}
                  title={starred ? 'Tap to un-star' : 'Tap to add to Important Notes'}
                >
                  <Star size={15} className={starred ? 'fill-amber-500' : ''} />
                </button>
              )}
              {/* Important Mark 2 button — only visible to admins when Mark 2 mode is ON */}
              {isAdmin && useImportantMark2 && onMark2Toggle && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
                    onMark2Toggle(topic.text);
                  }}
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  style={{ width: '28px', height: '28px', padding: 0 }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full inline-flex items-center justify-center transition-all shadow-sm border-2 z-10 ${
                    marked2
                      ? 'text-orange-600 bg-orange-100 border-orange-400 hover:bg-orange-200'
                      : 'text-orange-400 bg-white border-orange-200 hover:bg-orange-50'
                  }`}
                  aria-label={marked2 ? 'Remove Important Mark 2' : 'Important Mark 2'}
                  title={marked2 ? 'Tap to remove Important Mark 2' : 'Tap to mark as Important 2 (changes background)'}
                >
                  <Flame size={13} className={marked2 ? 'fill-orange-500' : ''} />
                </button>
              )}
              {/* ✏️ Inline correction button — visible next to each point in correction mode */}
              {showSuggestionPanel && !isActive && !(isAdmin && useImportantMark2) && (
                <button
                  type="button"
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    try { if (navigator.vibrate) navigator.vibrate(30); } catch {}
                    if (inlineCorrectionIdx === idx) {
                      setInlineCorrectionIdx(null);
                      setInlineCorrectionText('');
                      setInlineCorrectionDone(false);
                      setInlineCorrectionError(false);
                    } else {
                      setInlineCorrectionIdx(idx);
                      setInlineCorrectionText('');
                      // If already submitted this session, show done state immediately
                      setInlineCorrectionDone(submittedPointIndices.has(idx));
                      setInlineCorrectionError(false);
                    }
                  }}
                  style={{ width: '26px', height: '26px', padding: 0 }}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center transition-all z-10 ${
                    inlineCorrectionIdx === idx
                      ? 'opacity-100 scale-110'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                  title={submittedPointIndices.has(idx) ? 'Report bhej diya ✅' : 'Is point mein galti report karo'}
                >
                  <span style={{ fontSize: 12, lineHeight: 1 }}>{submittedPointIndices.has(idx) ? '✅' : '✏️'}</span>
                </button>
              )}
              {/* ✏️ Inline correction box — opens below the point when pencil is tapped */}
              {showSuggestionPanel && inlineCorrectionIdx === idx && (
                <div
                  style={{
                    margin: '0 8px 6px 8px',
                    borderRadius: 10,
                    border: '1.5px solid #fcd34d',
                    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                    padding: '8px 10px',
                    animation: 'tp-banner-in 0.15s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {inlineCorrectionDone ? (
                    <div style={{ textAlign: 'center', padding: '6px 0' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
                      <p style={{ fontSize: 11, fontWeight: 900, color: '#15803d', marginBottom: 2 }}>Report bhej diya!</p>
                      <p style={{ fontSize: 10, color: '#78350f' }}>Admin review karega aur galti theek karega.</p>
                      <button
                        type="button"
                        onClick={() => { setInlineCorrectionIdx(null); setInlineCorrectionText(''); setInlineCorrectionDone(false); setInlineCorrectionError(false); }}
                        style={{ marginTop: 8, fontSize: 10, fontWeight: 900, color: '#92400e', background: 'rgba(146,64,14,0.1)', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                      >✕ Band karo</button>
                    </div>
                  ) : inlineCorrectionError ? (
                    <div style={{ textAlign: 'center', padding: '6px 0' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>❌</div>
                      <p style={{ fontSize: 11, fontWeight: 900, color: '#dc2626', marginBottom: 2 }}>Submit nahi hua!</p>
                      <p style={{ fontSize: 10, color: '#78350f' }}>Internet check karo ya dobara try karo.</p>
                      <button
                        type="button"
                        onClick={() => setInlineCorrectionError(false)}
                        style={{ marginTop: 8, fontSize: 10, fontWeight: 900, color: '#92400e', background: 'rgba(146,64,14,0.1)', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}
                      >↩ Wapas jao</button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 9, fontWeight: 900, color: '#d97706', marginBottom: 5 }}>
                        Point {idx + 1} — <span style={{ fontWeight: 700, color: '#78350f' }}>{topic.text.substring(0, 55)}{topic.text.length > 55 ? '…' : ''}</span>
                      </p>
                      <textarea
                        autoFocus
                        value={inlineCorrectionText}
                        onChange={e => setInlineCorrectionText(e.target.value)}
                        placeholder="Yahan galti likho… (kya hona chahiye tha?)"
                        rows={2}
                        style={{ width: '100%', fontSize: 11, padding: '5px 7px', borderRadius: 6, border: '1px solid #fde68a', background: '#fffbeb', color: '#78350f', resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 6 }}
                      />
                      <button
                        type="button"
                        disabled={inlineCorrectionSubmitting || !inlineCorrectionText.trim() || submittedPointIndices.has(idx)}
                        onClick={async () => {
                          // Guard: prevent duplicate submission for this point in this session
                          if (submittedPointIndices.has(idx)) {
                            setInlineCorrectionDone(true);
                            return;
                          }
                          setInlineCorrectionSubmitting(true);
                          setInlineCorrectionError(false);
                          try {
                            const firebaseUser = auth.currentUser;
                            // Duplicate check — if same point already reported by anyone, increment count
                            const chapterKeyForCheck = noteKey || '';
                            if (chapterKeyForCheck) {
                              const duplicate = await findDuplicateSuggestionByPoint(chapterKeyForCheck, idx);
                              if (duplicate) {
                                await incrementSuggestionReportCount(duplicate.id);
                                // Count this as a report even on duplicate (user found the same issue)
                                const dupUid = firebaseUser?.uid || readingScoreConfig?.userId || 'anonymous';
                                const dupName = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Student';
                                updateSuggestionLeaderboard(dupUid, dupName, 'reported').catch(() => {});
                                setSubmittedPointIndices(prev => new Set(prev).add(idx));
                                setInlineCorrectionDone(true);
                                return;
                              }
                            }
                            const reporterUid = firebaseUser?.uid || readingScoreConfig?.userId || 'anonymous';
                            const reporterName = firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'Student';
                            await saveSuggestion({
                              id: `corr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                              text: `Point ${idx + 1}: "${topic.text.substring(0, 80)}" | Galti: ${inlineCorrectionText}`,
                              uid: reporterUid,
                              userName: reporterName,
                              createdAt: new Date().toISOString(),
                              mode: 'reading',
                              lessonTitle: sourceMeta?.lessonTitle,
                              pageNo: sourceMeta?.pageNo,
                              subject: sourceMeta?.subject,
                              classLevel: sourceMeta?.classLevel,
                              chapterKey: chapterKeyForCheck || noteKey,
                              pointsData: [{ index: idx, originalText: topic.text }],
                              reportCount: 1,
                            });
                            // Update permanent leaderboard record
                            updateSuggestionLeaderboard(reporterUid, reporterName, 'reported').catch(() => {});
                            setSubmittedPointIndices(prev => new Set(prev).add(idx));
                            setInlineCorrectionDone(true);
                          } catch (e) {
                            console.error('Correction submit error:', e);
                            setInlineCorrectionError(true);
                          } finally {
                            setInlineCorrectionSubmitting(false);
                          }
                        }}
                        style={{
                          width: '100%', padding: '6px', borderRadius: 7, border: 'none', cursor: inlineCorrectionText.trim() ? 'pointer' : 'not-allowed',
                          background: inlineCorrectionText.trim() ? '#d97706' : '#fde68a',
                          color: inlineCorrectionText.trim() ? '#fff' : '#b45309',
                          fontSize: 11, fontWeight: 900, opacity: inlineCorrectionSubmitting ? 0.7 : 1, transition: 'all 0.15s',
                        }}
                      >
                        {inlineCorrectionSubmitting ? 'Bhej raha hai…' : '📤 Report Bhejo'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    {/* Admin WhiteBoard overlay */}
    {isAdmin && showAdminBoard && (
      <AdminWhiteBoard onClose={() => setShowAdminBoard(false)} />
    )}
    </>
  );
};
