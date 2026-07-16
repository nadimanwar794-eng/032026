// @ts-nocheck
import React from "react";
import type { School } from "../../school-types";
import { MapPin, Users, Shield, ChevronRight, RefreshCw } from "lucide-react";

interface Props {
  school: School;
  onOpen: () => void;
  onChangeSchool: () => void;
  themeAccent?: string;
  card3D?: boolean;
}

export const SchoolHomeCard: React.FC<Props> = ({ school, onOpen, onChangeSchool, themeAccent, card3D = false }) => {
  const accent = themeAccent || school.bannerColor || "#6366f1";
  const initial = school.name.trim().slice(0, 2).toUpperCase();

  const cardStyle: React.CSSProperties = card3D
    ? {
        background: '#ffffff',
        border: `2px solid ${accent}`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 4px 0 ${accent}bb, 0 7px 18px ${accent}28`,
        transform: 'translateY(-1px)',
      }
    : {
        background: '#ffffff',
        border: `2px solid ${accent}`,
        boxShadow: `0 1px 4px rgba(0,0,0,0.06)`,
      };

  return (
    <div className="w-full rounded-2xl overflow-hidden transition-all" style={cardStyle}>

      {/* Main content */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        {/* Logo / Initial avatar */}
        <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-sm overflow-hidden"
          style={{ background: `${accent}18`, border: `1.5px solid ${accent}40` }}>
          {school.logoUrl ? (
            <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-black text-sm tracking-tight" style={{ color: accent }}>{initial}</span>
          )}
        </div>

        {/* Name & meta */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: accent }}>
            🏫 My School
          </p>
          <p className="font-black text-sm text-slate-800 leading-tight line-clamp-1">
            {school.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {school.address && (
              <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                <MapPin size={9} />
                {school.address.length > 22 ? school.address.slice(0, 22) + "…" : school.address}
              </span>
            )}
            {school.subscription?.status === "active" && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                style={{ background: `${accent}18`, color: accent }}>
                <Shield size={8} />
                {school.subscription.tier === "full" ? "Pro" : "Lite"}
              </span>
            )}
          </div>
        </div>

        {/* Right side — entry count / students */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {school.totalStudents ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: `${accent}12`, color: accent }}>
              <Users size={9} />
              {school.totalStudents}
            </span>
          ) : null}
          <ChevronRight size={16} style={{ color: accent }} />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex border-t" style={{ borderColor: `${accent}20` }}>
        <button
          onClick={onOpen}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 font-black text-sm tracking-wide active:opacity-70 transition-opacity"
          style={{ color: accent }}
        >
          School Kholein <ChevronRight size={14} />
        </button>
        <div className="w-px" style={{ background: `${accent}20` }} />
        <button
          onClick={(e) => { e.stopPropagation(); onChangeSchool(); }}
          className="flex items-center justify-center gap-1 px-5 py-3 text-xs font-bold active:opacity-60 transition-opacity"
          style={{ color: `${accent}99` }}
        >
          <RefreshCw size={12} />
          Badlo
        </button>
      </div>
    </div>
  );
};
