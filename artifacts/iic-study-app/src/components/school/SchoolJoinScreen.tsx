// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  getAllSchools, getSessions, getClasses,
  verifySchoolLockCode, saveSchoolUserProfile, linkStudentAccount
} from "../../school-firebase";
import type { School, SchoolSession, SchoolClass } from "../../school-types";
import type { SchoolUserProfile } from "../../school-types";
import {
  School as SchoolIcon, Lock, Unlock, ChevronRight, ChevronLeft,
  Loader2, Search, CheckCircle, ArrowLeft, BookOpen, Link2
} from "lucide-react";

interface Props {
  uid: string;
  displayName: string;
  email: string;
  onJoined: () => void;
  onBack?: () => void;
}

type Step = "pick_school" | "lock_code" | "pick_class" | "joining" | "link_account" | "link_form";
type Mode = "join" | "link";

export const SchoolJoinScreen: React.FC<Props> = ({ uid, displayName, email, onJoined, onBack }) => {
  const [mode, setMode] = useState<Mode>("join");
  const [step, setStep] = useState<Step>("pick_school");
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [lockCode, setLockCode] = useState("");
  const [lockError, setLockError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [sessions, setSessions] = useState<SchoolSession[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClass, setSelectedClass] = useState<SchoolClass | null>(null);
  const [activeSession, setActiveSession] = useState<SchoolSession | null>(null);

  // Link account state
  const [linkForm, setLinkForm] = useState({ name: displayName || "", rollNo: "", admissionNo: "", fatherName: "" });
  const [linking, setLinking] = useState(false);
  const [linkResult, setLinkResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    getAllSchools()
      .then(list => setSchools(list.filter(s => s.active)))
      .catch(() => {})
      .finally(() => setLoadingSchools(false));
  }, []);

  const filteredSchools = schools.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.address || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectSchool = (school: School) => {
    setSelectedSchool(school);
    if (mode === "link") {
      setStep("link_form");
      return;
    }
    if (school.lockCodeActive && school.lockCode) {
      setStep("lock_code");
    } else {
      loadClasses(school);
    }
  };

  const loadClasses = async (school: School) => {
    setLoadingClasses(true);
    setStep("pick_class");
    try {
      const sess = await getSessions(school.id);
      const active = sess.find(s => s.active) || sess[0] || null;
      setActiveSession(active);
      setSessions(sess);
      if (active) {
        const cls = await getClasses(school.id, active.id);
        setClasses(cls);
      }
    } catch (e) {}
    setLoadingClasses(false);
  };

  const handleVerifyLockCode = async () => {
    if (!selectedSchool || !lockCode.trim()) return;
    setVerifying(true);
    setLockError("");
    try {
      const ok = await verifySchoolLockCode(selectedSchool.id, lockCode.trim());
      if (ok) {
        await loadClasses(selectedSchool);
      } else {
        setLockError("Galat lock code. Dobara try karo.");
      }
    } catch (e) {
      setLockError("Error aaya. Dobara try karo.");
    }
    setVerifying(false);
  };

  const handleJoinWithClass = async (cls: SchoolClass) => {
    if (!selectedSchool || !activeSession) return;
    setStep("joining");
    const profile: SchoolUserProfile = {
      uid,
      schoolId: selectedSchool.id,
      role: "SCHOOL_STUDENT",
      name: displayName || email,
      email,
      classId: cls.id,
      sessionId: activeSession.id,
    };
    await saveSchoolUserProfile(profile);
    onJoined();
  };

  const handleLinkAccount = async () => {
    if (!selectedSchool) return;
    if (!linkForm.name.trim()) return setLinkResult({ success: false, message: "Apna naam daalo." });
    if (!linkForm.rollNo.trim() && !linkForm.admissionNo.trim()) {
      return setLinkResult({ success: false, message: "Roll number ya admission number mein se ek zaroor daalo." });
    }
    setLinking(true);
    setLinkResult(null);
    try {
      const result = await linkStudentAccount(
        selectedSchool.id, uid,
        linkForm.name.trim(),
        linkForm.rollNo.trim(),
        linkForm.admissionNo.trim(),
        linkForm.fatherName.trim()
      );
      setLinkResult(result);
      if (result.success) {
        setTimeout(() => onJoined(), 1500);
      }
    } catch (e) {
      setLinkResult({ success: false, message: "Error aaya. Dobara try karo." });
    }
    setLinking(false);
  };

  const goBack = () => {
    if (step === "lock_code" || step === "pick_class") {
      setStep("pick_school"); setSelectedSchool(null); setLockCode(""); setLockError(""); setClasses([]);
    } else if (step === "link_form") {
      setStep("pick_school"); setSelectedSchool(null); setLinkResult(null);
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-purple-900 px-4 py-5">
        {(step !== "pick_school" || mode !== "join") ? (
          <button onClick={goBack}
            className="flex items-center gap-1.5 text-indigo-300 hover:text-white text-sm font-medium mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /> {step === "pick_school" ? "Back" : "Schools"}
          </button>
        ) : onBack ? (
          <button onClick={onBack} className="flex items-center gap-1.5 text-indigo-300 hover:text-white text-sm font-medium mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Student Dashboard
          </button>
        ) : null}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            {mode === "link" ? <Link2 className="w-6 h-6 text-white" /> : <SchoolIcon className="w-6 h-6 text-white" />}
          </div>
          <div>
            <p className="text-indigo-300 text-xs font-medium uppercase tracking-wider">IIC×NSTA</p>
            <h1 className="text-xl font-bold text-white">
              {mode === "link" && step === "pick_school" && "School Chuno"}
              {mode === "link" && step === "link_form" && (selectedSchool?.name || "Link Account")}
              {mode === "join" && step === "pick_school" && "Apni School Chuno"}
              {mode === "join" && step === "lock_code" && selectedSchool?.name}
              {mode === "join" && step === "pick_class" && selectedSchool?.name}
              {step === "joining" && "Joining..."}
            </h1>
            {step === "pick_school" && mode === "join" && (
              <p className="text-slate-300 text-sm mt-0.5">School chunke uska content dekho</p>
            )}
            {step === "pick_school" && mode === "link" && (
              <p className="text-slate-300 text-sm mt-0.5">Apna school chuno, phir data verify karo</p>
            )}
            {step === "pick_class" && activeSession && (
              <p className="text-slate-300 text-sm mt-0.5">Session: {activeSession.name}</p>
            )}
            {step === "link_form" && (
              <p className="text-slate-300 text-sm mt-0.5">Apna admission data bharo</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Mode Toggle (only on pick_school) ── */}
      {step === "pick_school" && (
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-1 flex gap-1 shadow-sm mb-3">
            <button onClick={() => { setMode("join"); setLinkResult(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${mode === "join" ? "bg-indigo-600 text-white" : "text-slate-500"}`}>
              <SchoolIcon className="w-4 h-4" /> School Join Karo
            </button>
            <button onClick={() => { setMode("link"); setLinkResult(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${mode === "link" ? "bg-purple-600 text-white" : "text-slate-500"}`}>
              <Link2 className="w-4 h-4" /> Account Link Karo
            </button>
          </div>
          {mode === "link" && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-3 mb-3">
              <p className="text-xs text-purple-700 dark:text-purple-300 font-medium mb-1">📋 Account Link kya hai?</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">
                Agar school admin ne already aapka data system mein daala hai, to aap apna IIC account us record se link kar sakte ho. Iske liye apna naam, roll number aur father's name wahi dena hoga jo admission form mein diya tha.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 1: Pick School ── */}
      {step === "pick_school" && (
        <div className="p-4 pt-0 max-w-2xl mx-auto space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="School ka naam search karo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white shadow-sm"
            />
          </div>

          {loadingSchools ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <SchoolIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Koi school nahi mili</p>
            </div>
          ) : (
            filteredSchools.map(school => (
              <button
                key={school.id}
                onClick={() => handleSelectSchool(school)}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all text-left"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                  style={{ background: school.bannerColor || "#4f46e5" }}
                >
                  {school.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white truncate">{school.name}</p>
                  {school.address && <p className="text-xs text-slate-400 truncate">{school.address}</p>}
                  {school.tagline && <p className="text-xs text-indigo-500 truncate">{school.tagline}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {mode === "link"
                    ? <Link2 className="w-4 h-4 text-purple-500" />
                    : school.lockCodeActive
                      ? <Lock className="w-4 h-4 text-amber-500" />
                      : <Unlock className="w-4 h-4 text-green-500" />}
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Step 2: Lock Code ── */}
      {step === "lock_code" && selectedSchool && (
        <div className="p-4 max-w-md mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Lock Code Required</h2>
              <p className="text-sm text-slate-400 mt-1">
                <strong>{selectedSchool.name}</strong> ne lock code set kiya hai. Apne school admin se code lo.
              </p>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1.5 block font-medium">Lock Code</label>
              <input
                type="password"
                placeholder="Code daalo..."
                value={lockCode}
                onChange={e => { setLockCode(e.target.value); setLockError(""); }}
                onKeyDown={e => e.key === "Enter" && handleVerifyLockCode()}
                className="w-full px-4 py-3 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-base tracking-widest text-center font-bold"
              />
              {lockError && (
                <p className="text-xs text-red-500 mt-2 text-center">{lockError}</p>
              )}
            </div>

            <button
              onClick={handleVerifyLockCode}
              disabled={verifying || !lockCode.trim()}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {verifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking...</> : "✓ Verify & Continue"}
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Link Form ── */}
      {step === "link_form" && selectedSchool && (
        <div className="p-4 max-w-md mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ background: selectedSchool.bannerColor || "#4f46e5" }}>
                {selectedSchool.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">{selectedSchool.name}</p>
                <p className="text-xs text-slate-400">Admission data bharo</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
              Wahi data daalo jo <strong>admission form</strong> mein diya tha. System automatically verify karega aur aapka account link kar dega.
            </p>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Aapka Poora Naam *</label>
              <input value={linkForm.name} onChange={e => setLinkForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Rahul Kumar"
                className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Roll Number</label>
              <input value={linkForm.rollNo} onChange={e => setLinkForm(p => ({ ...p, rollNo: e.target.value }))}
                placeholder="e.g. 15"
                className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Admission Number</label>
              <input value={linkForm.admissionNo} onChange={e => setLinkForm(p => ({ ...p, admissionNo: e.target.value }))}
                placeholder="e.g. ADM-2024-015"
                className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Father's Name</label>
              <input value={linkForm.fatherName} onChange={e => setLinkForm(p => ({ ...p, fatherName: e.target.value }))}
                placeholder="e.g. Suresh Kumar"
                className="w-full px-3 py-2.5 border dark:border-slate-600 rounded-xl bg-transparent text-slate-800 dark:text-white text-sm" />
            </div>
            <p className="text-[11px] text-slate-400">Roll number ya admission number mein se ek zaroori hai.</p>

            {linkResult && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium ${linkResult.success ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"}`}>
                {linkResult.success ? "✓ " : "✗ "}{linkResult.message}
              </div>
            )}

            <button onClick={handleLinkAccount} disabled={linking}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              {linking ? <><Loader2 className="w-4 h-4 animate-spin" /> Verify kar raha hai...</> : <><Link2 className="w-4 h-4" /> Account Link Karo</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Pick Class ── */}
      {step === "pick_class" && selectedSchool && (
        <div className="p-4 max-w-2xl mx-auto space-y-3">
          <p className="text-sm text-slate-500 font-medium">Apni class chuno:</p>

          {loadingClasses ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400">Is school mein abhi koi class nahi hai.</p>
              <p className="text-xs text-slate-400 mt-1">School admin se contact karo.</p>
            </div>
          ) : (
            [...classes].sort((a, b) => {
              const na = parseInt(a.name.replace(/\D+/g, '')) || 0;
              const nb = parseInt(b.name.replace(/\D+/g, '')) || 0;
              return na !== nb ? na - nb : a.name.localeCompare(b.name);
            }).map(cls => (
              <button
                key={cls.id}
                onClick={() => handleJoinWithClass(cls)}
                className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 dark:text-white">
                    {cls.name}{cls.section ? ` (${cls.section})` : ""}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Step 4: Joining ── */}
      {step === "joining" && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-slate-500">School join ho rahi hai...</p>
          </div>
        </div>
      )}
    </div>
  );
};
