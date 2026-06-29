// @ts-nocheck
import React from "react";
import type { School } from "../../school-types";
import { GraduationCap, MapPin, Users, Shield, ChevronRight, RefreshCw } from "lucide-react";

interface Props {
  school: School;
  onOpen: () => void;
  onChangeSchool: () => void;
  card3D?: boolean;
}

export const SchoolHomeCard: React.FC<Props> = ({ school, onOpen, onChangeSchool }) => {
  const accent = school.bannerColor || "#4f46e5";

  // Derive a lighter tint from the accent for backgrounds
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  };
  const rgb = hexToRgb(accent.startsWith("#") && accent.length === 7 ? accent : "#4f46e5");

  const initial = school.name.trim().slice(0, 2).toUpperCase();

  return (
    <div className="w-full rounded-3xl overflow-hidden shadow-lg relative" style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 60%, ${accent}99 100%)` }}>

      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: "white", transform: "translate(30%, -30%)" }} />
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full opacity-10" style={{ background: "white", transform: "translate(-30%, 30%)" }} />

      {/* Top: IIC×NSTA badge */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2 relative z-10">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/70 bg-white/10 px-2.5 py-1 rounded-full">
          IIC × NSTA
        </span>
        {school.subscription?.status === "active" && (
          <span className="text-[10px] font-bold text-white/80 bg-white/15 px-2.5 py-1 rounded-full flex items-center gap-1">
            <Shield className="w-2.5 h-2.5" />
            {school.subscription.tier === "full" ? "Pro" : "Lite"} Plan
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="px-5 pb-4 relative z-10">
        <div className="flex items-center gap-4">
          {/* Logo / Initial */}
          <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "2px solid rgba(255,255,255,0.35)" }}>
            {school.logoUrl ? (
              <img src={school.logoUrl} alt={school.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-xl tracking-tight">{initial}</span>
            )}
          </div>

          {/* Name & tagline */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-lg leading-tight line-clamp-2 drop-shadow">
              {school.name}
            </p>
            {school.tagline && (
              <p className="text-white/75 text-[11px] font-medium mt-0.5 line-clamp-1">{school.tagline}</p>
            )}
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {school.principalName && (
            <span className="text-[10px] font-semibold text-white/80 bg-white/15 px-2.5 py-1 rounded-full flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              {school.principalName}
            </span>
          )}
          {school.address && (
            <span className="text-[10px] font-semibold text-white/80 bg-white/15 px-2.5 py-1 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {school.address.length > 28 ? school.address.slice(0, 28) + "…" : school.address}
            </span>
          )}
          {school.totalStudents ? (
            <span className="text-[10px] font-semibold text-white/80 bg-white/15 px-2.5 py-1 rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" />
              {school.totalStudents} Students
            </span>
          ) : null}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex relative z-10" style={{ background: "rgba(0,0,0,0.18)" }}>
        <button
          onClick={onOpen}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 font-black text-white text-sm tracking-wide active:opacity-80 transition-opacity"
        >
          School Kholein <ChevronRight className="w-4 h-4" />
        </button>
        <div className="w-px bg-white/20" />
        <button
          onClick={(e) => { e.stopPropagation(); onChangeSchool(); }}
          className="flex items-center justify-center gap-1.5 px-5 py-3.5 text-white/70 text-xs font-bold active:opacity-60 transition-opacity"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Badlo
        </button>
      </div>
    </div>
  );
};
