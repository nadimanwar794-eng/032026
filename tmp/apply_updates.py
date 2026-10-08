import sys

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# 1. Update save handler in BOOK_NOTES_MANAGER
old_save = '''                                       <button onClick={() => {
                                           if (!newLucent.lessonTitle.trim()) return alert('Lesson name nahi diya.');
                                           const validPages = newLucent.pages.filter(p => p.pageNo.trim() && (p.chunkNotes?.trim() || p.htmlNotes?.trim() || p.content?.trim() || (p.mcqs && p.mcqs.length > 0) || (p as any).videoUrl?.trim() || (p as any).pdfUrl?.trim() || (p as any).audioUrl?.trim()));
                                           if (validPages.length === 0) return alert('Kam se kam ek page ke notes ya MCQ add karein.');
                                           const target2 = LUCENT_CLASS_TARGETS.find(t => t.id === newLucent.classLevel)?.label || newLucent.classLevel;
                                           let bnLucentUpdated: LucentNoteEntry[];
                                           let bnSaveMsg: string;
                                           let bnUpdatedNotifs: any[] | undefined;
                                           let finalEntryToSync: LucentNoteEntry;
                                           if (cn612EditingId) {
                                               finalEntryToSync = { id: cn612EditingId, subject: newLucent.subject, bookName: newLucent.bookName.trim() || undefined, classLevel: newLucent.classLevel, lessonTitle: newLucent.lessonTitle.trim(), pages: validPages, mcqOnly: newLucent.mcqOnly || undefined, createdAt: new Date().toISOString() };
                                               bnLucentUpdated = (localSettings.lucentNotes || []).map((n: LucentNoteEntry) => n.id === cn612EditingId ? finalEntryToSync : n);
                                               bnSaveMsg = `✅ Lesson Updated!`;
                                               setCn612EditingId(null);
                                           } else {
                                               finalEntryToSync = { id: Date.now().toString(), subject: newLucent.subject, bookName: newLucent.bookName.trim() || undefined, classLevel: newLucent.classLevel, lessonTitle: newLucent.lessonTitle.trim(), pages: validPages, mcqOnly: newLucent.mcqOnly || undefined, createdAt: new Date().toISOString() };
                                               bnLucentUpdated = [...(localSettings.lucentNotes || []), finalEntryToSync];
                                               const newNotif = { id: `lucent-${Date.now()}`, title: `📚 New Lucent Entry: ${newLucent.lessonTitle.trim()}`, body: `Naya Lucent lesson add ho gaya hai. Abhi padho!`, type: 'CONTENT', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
                                               const currentNotifs = localSettings.notifications || [];
                                               bnUpdatedNotifs = [newNotif, ...currentNotifs].slice(0, 30);
                                               bnSaveMsg = `✅ Lesson saved → ${target2}!`;
                                           }
                                           const subjName = LUCENT_SUBJECT_OPTIONS_BASE.find(o => o.id === newLucent.subject)?.name || newLucent.subject;
                                           syncClassNotesMcqsToRevisionHub(finalEntryToSync, subjName).catch(console.error);
                                           setNewLucent({ subject: newLucent.subject, bookName: '', classLevel: newLucent.classLevel, board: newLucent.board, lessonTitle: '', mcqOnly: false, pages: [{ id: Date.now().toString(), pageNo: '1', content: '', chunkNotes: '', htmlNotes: '' }] });
                                           saveLucentEntryDirectly(bnLucentUpdated, bnSaveMsg, bnUpdatedNotifs);
                                       }} disabled={isSavingLucent} className={`w-full mt-2 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${cn612EditingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>'''

new_save = '''                                       <button onClick={() => {
                                           if (!newLucent.lessonTitle.trim()) return alert('Lesson name nahi diya.');
                                           const validPages = newLucent.pages.filter(p => p.pageNo.trim() && (p.chunkNotes?.trim() || p.htmlNotes?.trim() || p.content?.trim() || (p.mcqs && p.mcqs.length > 0) || (p as any).videoUrl?.trim() || (p as any).pdfUrl?.trim() || (p as any).audioUrl?.trim()));
                                           if (validPages.length === 0 && !newLucent.videoUrl?.trim() && !newLucent.pdfUrl?.trim() && !newLucent.audioUrl?.trim()) return alert('Kam se kam ek page ke notes, MCQ, ya media (video/pdf/audio) add karein.');
                                           const finalPages = validPages.length > 0 ? validPages : [{ id: Date.now().toString(), pageNo: '1', content: '', chunkNotes: '', htmlNotes: '' }];
                                           const target2 = LUCENT_CLASS_TARGETS.find(t => t.id === newLucent.classLevel)?.label || newLucent.classLevel;
                                           let bnLucentUpdated: LucentNoteEntry[];
                                           let bnSaveMsg: string;
                                           let bnUpdatedNotifs: any[] | undefined;
                                           let finalEntryToSync: LucentNoteEntry;
                                           if (cn612EditingId) {
                                               finalEntryToSync = {
                                                   id: cn612EditingId,
                                                   subject: newLucent.subject,
                                                   bookName: newLucent.bookName.trim() || undefined,
                                                   classLevel: newLucent.classLevel,
                                                   board: newLucent.board || undefined,
                                                   lessonTitle: newLucent.lessonTitle.trim(),
                                                   pages: finalPages,
                                                   mcqOnly: newLucent.mcqOnly || undefined,
                                                   videoUrl: newLucent.videoUrl?.trim() || undefined,
                                                   pdfUrl: newLucent.pdfUrl?.trim() || undefined,
                                                   audioUrl: newLucent.audioUrl?.trim() || undefined,
                                                   createdAt: new Date().toISOString()
                                               };
                                               bnLucentUpdated = (localSettings.lucentNotes || []).map((n: LucentNoteEntry) => n.id === cn612EditingId ? finalEntryToSync : n);
                                               bnSaveMsg = `✅ Lesson Updated!`;
                                               setCn612EditingId(null);
                                           } else {
                                               finalEntryToSync = {
                                                   id: Date.now().toString(),
                                                   subject: newLucent.subject,
                                                   bookName: newLucent.bookName.trim() || undefined,
                                                   classLevel: newLucent.classLevel,
                                                   board: newLucent.board || undefined,
                                                   lessonTitle: newLucent.lessonTitle.trim(),
                                                   pages: finalPages,
                                                   mcqOnly: newLucent.mcqOnly || undefined,
                                                   videoUrl: newLucent.videoUrl?.trim() || undefined,
                                                   pdfUrl: newLucent.pdfUrl?.trim() || undefined,
                                                   audioUrl: newLucent.audioUrl?.trim() || undefined,
                                                   createdAt: new Date().toISOString()
                                               };
                                               bnLucentUpdated = [...(localSettings.lucentNotes || []), finalEntryToSync];
                                               const newNotif = { id: `lucent-${Date.now()}`, title: `📚 New Lucent Entry: ${newLucent.lessonTitle.trim()}`, body: `Naya Lucent lesson add ho gaya hai. Abhi padho!`, type: 'CONTENT', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() };
                                               const currentNotifs = localSettings.notifications || [];
                                               bnUpdatedNotifs = [newNotif, ...currentNotifs].slice(0, 30);
                                               bnSaveMsg = `✅ Lesson saved → ${target2}!`;
                                           }
                                           const subjName = LUCENT_SUBJECT_OPTIONS_BASE.find(o => o.id === newLucent.subject)?.name || newLucent.subject;
                                           syncClassNotesMcqsToRevisionHub(finalEntryToSync, subjName).catch(console.error);
                                           setNewLucent({ subject: newLucent.subject, bookName: '', classLevel: newLucent.classLevel, board: newLucent.board, lessonTitle: '', mcqOnly: false, videoUrl: '', pdfUrl: '', audioUrl: '', pages: [{ id: Date.now().toString(), pageNo: '1', content: '', chunkNotes: '', htmlNotes: '' }] });
                                           saveLucentEntryDirectly(bnLucentUpdated, bnSaveMsg, bnUpdatedNotifs);
                                       }} disabled={isSavingLucent} className={`w-full mt-2 text-white px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${cn612EditingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>'''

if old_save not in content:
    print('ERROR: old_save not found!')
    sys.exit(1)
content = content.replace(old_save, new_save, 1)

# 2. In BOOK_NOTES_MANAGER entry list: edit button & media button & badges
old_entry_actions = '''                                                       <button onClick={() => {
                                                           setNewLucent({ subject: entry.subject, bookName: entry.bookName || '', classLevel: entry.classLevel, board: (entry as any).board || '', lessonTitle: entry.lessonTitle, pages: entry.pages.map((p: any) => ({ ...p })), mcqOnly: entry.mcqOnly || false });
                                                           setNewBookNote((prev: any) => ({ ...prev, targetSubject: 'lucent' }));
                                                           setCn612EditingId(entry.id);
                                                           setBookNotesTab('ADD');
                                                       }} className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors" title="Edit lesson"><Edit3 size={13}/></button>'''

new_entry_actions = '''                                                       {((entry.videoUrl || entry.pages?.some((p: any) => p.videoUrl)) || (entry.pdfUrl || entry.pages?.some((p: any) => p.pdfUrl)) || (entry.audioUrl || entry.pages?.some((p: any) => p.audioUrl))) && (
                                                           <span className="flex items-center gap-1 text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full shrink-0">
                                                               {(entry.videoUrl || entry.pages?.some((p: any) => p.videoUrl)) && <span title="Video available">🎬</span>}
                                                               {(entry.pdfUrl || entry.pages?.some((p: any) => p.pdfUrl)) && <span title="PDF available">📄</span>}
                                                               {(entry.audioUrl || entry.pages?.some((p: any) => p.audioUrl)) && <span title="Audio available">🎵</span>}
                                                           </span>
                                                       )}
                                                       <button onClick={() => {
                                                           setAdminLucentMediaModalEntry(entry);
                                                           setAdminLucentMediaModalPageIndex(-1);
                                                       }} className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded transition-colors flex items-center gap-0.5 text-xs font-black" title="Manage Video / PDF / Audio Media"><Video size={13}/><span className="hidden sm:inline text-[10px]">Media</span></button>
                                                       <button onClick={() => {
                                                           setNewLucent({ subject: entry.subject, bookName: entry.bookName || '', classLevel: entry.classLevel, board: (entry as any).board || '', lessonTitle: entry.lessonTitle, videoUrl: entry.videoUrl || '', pdfUrl: entry.pdfUrl || '', audioUrl: entry.audioUrl || '', pages: entry.pages.map((p: any) => ({ ...p })), mcqOnly: entry.mcqOnly || false });
                                                           setNewBookNote((prev: any) => ({ ...prev, targetSubject: 'lucent' }));
                                                           setCn612EditingId(entry.id);
                                                           setBookNotesTab('ADD');
                                                       }} className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors" title="Edit lesson"><Edit3 size={13}/></button>'''

if old_entry_actions not in content:
    print('ERROR: old_entry_actions not found!')
    sys.exit(1)
content = content.replace(old_entry_actions, new_entry_actions, 1)

# 3. In Class 6-12 Notes entry list: edit button & media button
old_cls_actions = '''                                                  <button
                                                      onClick={() => {
                                                          // Load this entry into the form for editing
                                                          setCn612EditingId(entry.id);
                                                          setNewLucent({
                                                              subject: entry.subject,
                                                              bookName: entry.bookName || '',
                                                              classLevel: (entry.classLevel && entry.classLevel !== 'COMPETITION' ? entry.classLevel : '6') as any,
                                                              board: (entry as any).board || '',
                                                              lessonTitle: entry.lessonTitle,
                                                              pages: entry.pages || [],
                                                          });
                                                          // Scroll to top of form
                                                          document.querySelector('.animate-in.slide-in-from-right')?.scrollTo({ top: 0, behavior: 'smooth' });
                                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                                      }}
                                                      className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                                                      title="Edit"
                                                  ><Edit3 size={14}/></button>'''

new_cls_actions = '''                                                  <button
                                                      onClick={() => {
                                                          setAdminLucentMediaModalEntry(entry);
                                                          setAdminLucentMediaModalPageIndex(-1);
                                                      }}
                                                      className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg"
                                                      title="Media (Video/PDF/Audio)"
                                                  ><Video size={14}/></button>
                                                  <button
                                                      onClick={() => {
                                                          // Load this entry into the form for editing
                                                          setCn612EditingId(entry.id);
                                                          setNewLucent({
                                                              subject: entry.subject,
                                                              bookName: entry.bookName || '',
                                                              classLevel: (entry.classLevel && entry.classLevel !== 'COMPETITION' ? entry.classLevel : '6') as any,
                                                              board: (entry as any).board || '',
                                                              lessonTitle: entry.lessonTitle,
                                                              videoUrl: entry.videoUrl || '',
                                                              pdfUrl: entry.pdfUrl || '',
                                                              audioUrl: entry.audioUrl || '',
                                                              pages: entry.pages || [],
                                                          });
                                                          // Scroll to top of form
                                                          document.querySelector('.animate-in.slide-in-from-right')?.scrollTo({ top: 0, behavior: 'smooth' });
                                                          window.scrollTo({ top: 0, behavior: 'smooth' });
                                                      }}
                                                      className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                                                      title="Edit"
                                                  ><Edit3 size={14}/></button>'''

if old_cls_actions not in content:
    print('ERROR: old_cls_actions not found!')
    sys.exit(1)
content = content.replace(old_cls_actions, new_cls_actions, 1)

# 4. In CLASS_NOTES_MANAGER save handler
old_cls_save = '''                              const validPages = newLucent.pages.filter(p => p.pageNo.trim() && (p.chunkNotes?.trim() || p.htmlNotes?.trim() || (p.mcqs && p.mcqs.length > 0)));'''
new_cls_save = '''                              const validPages = newLucent.pages.filter(p => p.pageNo.trim() && (p.chunkNotes?.trim() || p.htmlNotes?.trim() || (p.mcqs && p.mcqs.length > 0) || (p as any).videoUrl?.trim() || (p as any).pdfUrl?.trim() || (p as any).audioUrl?.trim()));'''

if old_cls_save in content:
    content = content.replace(old_cls_save, new_cls_save, 1)

old_cls_entry = '''                                      lessonTitle: titleTrimmed,
                                      pages: validPages,
                                      createdAt: new Date().toISOString(),
                                  };'''

new_cls_entry = '''                                      lessonTitle: titleTrimmed,
                                      pages: validPages,
                                      videoUrl: newLucent.videoUrl?.trim() || undefined,
                                      pdfUrl: newLucent.pdfUrl?.trim() || undefined,
                                      audioUrl: newLucent.audioUrl?.trim() || undefined,
                                      createdAt: new Date().toISOString(),
                                  };'''

if old_cls_entry in content:
    content = content.replace(old_cls_entry, new_cls_entry, 1)

old_cls_up = '''                                      lessonTitle: titleTrimmed,
                                      pages: validPages,
                                      updatedAt: new Date().toISOString(),
                                  } as LucentNoteEntry;'''

new_cls_up = '''                                      lessonTitle: titleTrimmed,
                                      pages: validPages,
                                      videoUrl: newLucent.videoUrl?.trim() || undefined,
                                      pdfUrl: newLucent.pdfUrl?.trim() || undefined,
                                      audioUrl: newLucent.audioUrl?.trim() || undefined,
                                      updatedAt: new Date().toISOString(),
                                  } as LucentNoteEntry;'''

if old_cls_up in content:
    content = content.replace(old_cls_up, new_cls_up, 1)

# 5. Render AdminLucentMediaModal in modal section
old_modal = '''      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
      />'''

new_modal = '''      {/* Admin Lucent Media (PDF / Video / Audio) Modal */}
      {adminLucentMediaModalEntry && (
        <AdminLucentMediaModal
          entry={adminLucentMediaModalEntry}
          initialPageIndex={adminLucentMediaModalPageIndex}
          onClose={() => {
            setAdminLucentMediaModalEntry(null);
            setAdminLucentMediaModalPageIndex(-1);
          }}
          onSaved={(updated) => {
            const updatedList = (localSettings.lucentNotes || []).map((n: LucentNoteEntry) => n.id === updated.id ? updated : n);
            setLocalSettings((prev: any) => ({ ...prev, lucentNotes: updatedList }));
            setAlertConfig({ isOpen: true, message: `✅ "${updated.lessonTitle}" media update ho gaya!` });
          }}
        />
      )}

      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
      />'''

if old_modal not in content:
    print('ERROR: old_modal not found!')
    sys.exit(1)
content = content.replace(old_modal, new_modal, 1)

with open('artifacts/iic-study-app-replit/src/components/AdminDashboard.tsx', 'w') as f:
    f.write(content)

print('ALL ADMIN DASHBOARD EDITS COMPLETED SUCCESSFULLY')
