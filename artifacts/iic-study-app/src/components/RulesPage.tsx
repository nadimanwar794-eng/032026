import React from 'react';
import { Shield, BookOpen, Lock, Coins, MessageCircle, Crown, Info, CheckCircle2, AlertTriangle, KeyRound, Languages, Trophy, Star, Mail } from 'lucide-react';
import { useAppLang } from '../utils/appLang';

interface Props {
  onBack: () => void;
  settings?: any;
}

export const RulesPage: React.FC<Props> = ({ onBack, settings }) => {
  const [lang, setLang] = useAppLang();

  const content = {
    EN: {
      title: "App Rules & Guide",
      sections: {
        syllabus: {
          title: "Syllabus & Locking System",
          points: [
            "Start at Chapter 1: You can only access the first chapter initially.",
            "The 100 MCQ Rule: To unlock Chapter 2, you must solve at least 100 MCQs in Chapter 1.",
            "Automatic Progression: Once you hit 100 correct attempts, the next chapter unlocks automatically."
          ]
        },
        credits: {
          title: "Credits & Economy",
          points: [
            "Free Notes (PDF): Basic chapter PDFs are always free for all students.",
            "Deep Dive / Write Mode: AI-styled HTML notes (admin-set cost, ~15 CR). Basic: 5 free/day. Ultra: 10 free/day.",
            "Premium Notes (PDF): Typically 2–5 CR per unlock. Basic/Ultra may get free daily views.",
            "Video Lectures: Usually 5 CR (admin-configurable). Basic/Ultra get free daily views.",
            "MCQ Test Mode (Mock Test): ~10 CR per test attempt.",
            "AI Chat Tutor: ~1 CR per message (admin-configurable). Ultra users get higher limits.",
            "Custom Theme Creator: 200 CR (one-time, permanent unlock).",
            "How to earn Credits: Daily Login Bonus (claim from Mail tab), Study Goal Timer, Login Streak, Spin Wheel, Gift Codes, Level-up bonuses, MCQ milestones, Referral."
          ]
        },
        chat: {
          title: "Chat & Community Rules",
          points: [
            "Global Chat: Open to all students — share study tips, ask questions, discuss topics.",
            "AI Chat cost: ~1 CR per message (admin-set). Ultra users enjoy higher daily message limits.",
            "Support Chat: Private 1-on-1 channel with admin. Use for payment, content, or account issues.",
            "Community MCQ: Share any MCQ to chat for group discussion and peer explanation.",
            "Admin Power: Admins can edit or delete any user message. Use respectful language — violations may result in ban."
          ]
        },
        language: {
          title: "Language & Features",
          points: [
            "BSEB Board: Content is generated strictly in Hindi.",
            "CBSE Board: Content is generated strictly in English.",
            "Language Toggle: Switch UI and AI responses between Hindi/English from the top bar (🌐 button).",
            "Audio Studio: Paste any text and have it read aloud in Hindi or English using device TTS.",
            "TTS (Read button): Available on all note pages — tap any line to start reading from there.",
            "Competition Mode: Lucent GK, NCERT, Speedy, Sar Sangrah — structured page reader for competitive exams. Ultra: unlimited. Free: limited/day."
          ]
        },
        levelSystem: {
          title: "Level & Score System",
          intro: "Activity Score is earned by completing tasks. It determines your Level (1–15) and unlocks Store discounts + Progress Bonus (starts at L4, max 45%).",
          levels: [
            { level: "L1 · Beginner 🌱",          pts: "0",          discount: "No discount", perks: "Basic access, daily login bonus" },
            { level: "L2 · Learner 🌿",            pts: "1,000",      discount: "No discount", perks: "Top bar shimmer, profile badge" },
            { level: "L3 · Active Learner 🔍",     pts: "2,500",      discount: "2% OFF",      perks: "2% store discount, glow effects" },
            { level: "L4 · Consistent Learner ✨", pts: "5,000",      discount: "3% OFF",      perks: "Progress Bonus unlocked (up to +15%)" },
            { level: "L5 · Dedicated Student ⚡",  pts: "10,000",     discount: "5% OFF",      perks: "Progress Bonus up to +22%" },
            { level: "L6 · Rising Achiever 🔥",    pts: "25,000",     discount: "8% OFF",      perks: "Progress Bonus up to +30%" },
            { level: "L7 · Expert Learner 💫",     pts: "75,000",     discount: "10% OFF",     perks: "Progress Bonus up to +38%, colored username" },
            { level: "L8 · Master Learner 💎",     pts: "2,00,000",   discount: "13% OFF",     perks: "Progress Bonus MAX 45%, sparkle effects · 📝 Smart Notes permanently FREE (no subscription needed)" },
            { level: "L9 · Elite 🌟",              pts: "5,00,000",    discount: "17% OFF",  perks: "⚡ Daily Limit Bonus (up to +100%), Elite Frame & Badge" },
            { level: "L10 · Champion 👑",           pts: "10,00,000",   discount: "20% OFF",  perks: "⚡ Daily Limit Bonus up to +200%, Champion Frame · 💡 Smart Notes + Explanation permanently FREE" },
            { level: "L11 · Legend 🏆",             pts: "25,00,000",   discount: "20% OFF",  perks: "⚡ Daily Limit Bonus up to +250%, Username Effects" },
            { level: "L12 · Mythic 🔮",             pts: "50,00,000",   discount: "22% OFF",  perks: "⚡ Daily Limit Bonus up to +320%, Mythic Theme Pack" },
            { level: "L13 · Supreme ⚜️",            pts: "1,00,00,000", discount: "25% OFF",  perks: "⚡ Daily Limit Bonus up to +400%, Supreme Crown" },
            { level: "L14 · Eternal 🌠",            pts: "2,50,00,000", discount: "28% OFF",  perks: "⚡ Daily Limit Bonus up to +500%, Eternal Frame" },
            { level: "L15 · Absolute Legend 💠",    pts: "5,00,00,000", discount: "30% OFF",  perks: "👑 Prestige: +500% Daily Limit Bonus (5× cap) + +45% Progress Bonus — Highest rank" },
          ],
          earningRules: [
            "Video / Audio / PDF / Notes: Milestone score (5–25 pts) at 20%, 40%, 60%, 80%, 100% completion.",
            "MCQ Practice: +2 pts per correct answer (up to daily limit).",
            "Daily Login: +10 pts every day you open the app.",
            "Redeem Code: +5 pts for every valid code you redeem.",
            "Credits Spent: +1 pt per credit you spend.",
            "Daily Limit: Free=1500 pts · Basic=2500 pts · Ultra=3500 pts per day.",
            "Subscription Multiplier: Free 1×, Basic 1.2×, Ultra 1.5× on all earned score.",
            "Score Boost Code: Redeem a special code to get extra % score for a limited time.",
            "Daily Limit Boost Code: Redeem to permanently increase your daily score limit by a % (stackable)."
          ]
        },
        leaderboard: {
          title: "Leaderboard",
          points: [
            "Top 100 students are shown on the Level Leaderboard.",
            "Categories: Level (Total Score), MCQ count, Videos watched, PDFs read, Write Mode sessions, Day Streak.",
            "Your rank is shown at the top of the leaderboard — track your progress daily.",
            "Tap any student card to view their full profile (level, activity stats, subscription).",
            "Admins and Sub-Admins are excluded from the leaderboard.",
            "Rankings update in real-time from the server. Offline fallback uses cached data.",
            "Earn more score to climb higher — Level 4+ users get a colored username in the leaderboard!"
          ]
        },
        mailbox: {
          title: "Mailbox (Inbox)",
          points: [
            "Admin can send special Broadcast Codes to all students (or selected plan users) via the Mailbox.",
            "Types of codes in inbox: Credits, Score Points, Score Boost, Daily Limit Boost, Subscription, Discount Coupon, Top Bar Effect.",
            "Codes in your inbox have an expiry — redeem before they expire!",
            "Visit the Store to receive a personal Discount Code in your inbox (sent automatically).",
            "Redeem any mailbox code from the 'Redeem Code' section — enter the code shown in the mail.",
            "Each code can only be redeemed once per user. Multi-use codes allow one-time use per user.",
            "Unread inbox messages show a red dot indicator on the Mailbox tab."
          ]
        }
      }
    },
    HI: {
      title: "ऐप नियम और गाइड",
      sections: {
        syllabus: {
          title: "पाठ्यक्रम और लॉकिंग सिस्टम",
          points: [
            "अध्याय 1 से शुरू करें: आप शुरुआत में केवल पहला अध्याय ही देख सकते हैं।",
            "100 MCQ नियम: अध्याय 2 खोलने के लिए, आपको अध्याय 1 में कम से कम 100 MCQ हल करने होंगे।",
            "ऑटोमैटिक प्रोग्रेशन: जैसे ही आप 100 MCQ हल करते हैं, अगला अध्याय अपने आप खुल जाएगा।"
          ]
        },
        credits: {
          title: "क्रेडिट और इकोनॉमी",
          points: [
            "Free Notes (PDF): सभी students के लिए हमेशा मुफ्त।",
            "Deep Dive / Write Mode: AI-styled HTML notes (~15 CR, admin-set)। Basic: 5 free/day, Ultra: 10 free/day।",
            "Premium Notes (PDF): आमतौर पर 2–5 CR। Basic/Ultra users को free daily views मिल सकते हैं।",
            "Video Lectures: लगभग 5 CR (admin-configurable)। Basic/Ultra users को free daily views।",
            "MCQ Test Mode (Mock Test): ~10 CR प्रति attempt।",
            "AI Chat: ~1 CR प्रति message। Ultra users को ज़्यादा daily limit।",
            "Custom Theme Creator: 200 CR (एक बार — permanent unlock)।",
            "Coins कैसे कमाएं: Daily Login Bonus (Mail tab से claim करें), Study Goal Timer, Login Streak, Spin Wheel, Gift Codes, Level-up bonus, Referral, MCQ milestones।"
          ]
        },
        chat: {
          title: "Chat और Community नियम",
          points: [
            "Global Chat: सभी students के लिए open — tips share करें, doubts पूछें।",
            "AI Chat cost: ~1 CR प्रति message (admin-set)। Ultra users को ज़्यादा limits।",
            "Support Chat: Admin से private 1-on-1 chat। Payment, content, account issues यहाँ report करें।",
            "Community MCQ: कोई भी MCQ chat में share करके group में discuss कर सकते हो।",
            "एडमिन पावर: एडमिन किसी भी message को delete/edit कर सकता है। अपशब्द का use करने पर ban हो सकता है।"
          ]
        },
        language: {
          title: "भाषा और सुविधाएँ",
          points: [
            "BSEB बोर्ड: सारी पढ़ाई हिंदी में होगी।",
            "CBSE बोर्ड: सारी पढ़ाई अंग्रेजी में होगी।",
            "Language Toggle: Top bar (🌐 button) से UI और AI responses Hindi/English में switch करें।",
            "Audio Studio: अपना कोई भी text paste करो — device TTS से Hindi या English में पढ़ा जाएगा।",
            "TTS (Read button): सभी notes pages पर available — किसी भी line पर tap करके वहीं से reading शुरू।",
            "Competition Mode: Lucent GK, NCERT, Speedy — structured reader। Ultra: unlimited। Free: limited chapters/day।"
          ]
        },
        levelSystem: {
          title: "Level और Score सिस्टम",
          intro: "Activity Score पढ़ाई करके कमाया जाता है। यह आपका Level (1–15) तय करता है, Store में Discount देता है और Level 4 से Progress Bonus मिलता है (max 45%)।",
          levels: [
            { level: "L1 · Beginner 🌱",          pts: "0",          discount: "कोई discount नहीं", perks: "Basic access, daily login bonus" },
            { level: "L2 · Learner 🌿",            pts: "1,000",      discount: "कोई discount नहीं", perks: "Top bar shimmer, profile badge" },
            { level: "L3 · Active Learner 🔍",     pts: "2,500",      discount: "2% OFF",            perks: "2% store discount, glow effects" },
            { level: "L4 · Consistent Learner ✨", pts: "5,000",      discount: "3% OFF",            perks: "Progress Bonus unlock (max +15%)" },
            { level: "L5 · Dedicated Student ⚡",  pts: "10,000",     discount: "5% OFF",            perks: "Progress Bonus max +22%" },
            { level: "L6 · Rising Achiever 🔥",    pts: "25,000",     discount: "8% OFF",            perks: "Progress Bonus max +30%" },
            { level: "L7 · Expert Learner 💫",     pts: "75,000",     discount: "10% OFF",           perks: "Progress Bonus max +38%, रंगीन username" },
            { level: "L8 · Master Learner 💎",     pts: "2,00,000",   discount: "13% OFF",           perks: "Progress Bonus MAX 45%, sparkle effects · 📝 Smart Notes हमेशा के लिए FREE (बिना subscription)" },
            { level: "L9 · Elite 🌟",              pts: "5,00,000",    discount: "17% OFF",  perks: "⚡ Daily Limit Bonus (max +100%), Elite Frame & Badge" },
            { level: "L10 · Champion 👑",           pts: "10,00,000",   discount: "20% OFF",  perks: "⚡ Daily Limit Bonus max +200%, Champion Frame · 💡 Smart Notes + Explanation हमेशा के लिए FREE" },
            { level: "L11 · Legend 🏆",             pts: "25,00,000",   discount: "20% OFF",  perks: "⚡ Daily Limit Bonus max +250%, Username Effects" },
            { level: "L12 · Mythic 🔮",             pts: "50,00,000",   discount: "22% OFF",  perks: "⚡ Daily Limit Bonus max +320%, Mythic Theme Pack" },
            { level: "L13 · Supreme ⚜️",            pts: "1,00,00,000", discount: "25% OFF",  perks: "⚡ Daily Limit Bonus max +400%, Supreme Crown" },
            { level: "L14 · Eternal 🌠",            pts: "2,50,00,000", discount: "28% OFF",  perks: "⚡ Daily Limit Bonus max +500%, Eternal Frame" },
            { level: "L15 · Absolute Legend 💠",    pts: "5,00,00,000", discount: "30% OFF",  perks: "👑 Prestige: Daily Limit Bonus 5× cap (+500%) + Progress Bonus +45% — app का सबसे बड़ा rank" },
          ],
          earningRules: [
            "Video / Audio / PDF / Notes: हर 20%, 40%, 60%, 80%, 100% completion पर milestone score (5–25 pts)।",
            "MCQ Practice: हर सही जवाब पर +1 pt (daily limit तक)।",
            "Daily Login: हर दिन app खोलने पर +10 pts।",
            "Redeem Code: हर valid code redeem करने पर +5 pts।",
            "Credits Spend: हर credit खर्च करने पर +1 pt।",
            "Daily Limit: Free=1500 pts · Basic=2500 pts · Ultra=3500 pts प्रति दिन।",
            "Subscription Multiplier: Free 1×, Basic 1.2×, Ultra 1.5× — सभी score पर।",
            "Score Boost Code: विशेष code से कुछ समय के लिए extra % score मिलता है।",
            "Daily Limit Boost Code: code redeem करके daily score limit permanently बढ़ाएं (stack होता है)।"
          ]
        },
        leaderboard: {
          title: "Leaderboard (रैंकिंग)",
          points: [
            "Top 100 छात्र Level Leaderboard में दिखते हैं।",
            "Category: Level (Total Score), MCQ count, Videos, PDFs, Write Mode, Day Streak।",
            "आपकी rank leaderboard के ऊपर दिखती है — रोज़ अपनी progress track करें।",
            "किसी भी student card पर tap करें उनका पूरा profile देखने के लिए।",
            "Admin और Sub-Admin leaderboard में नहीं दिखते।",
            "Rankings server से real-time update होती हैं।",
            "Level 4+ पर leaderboard में आपका username रंगीन दिखेगा! 🔥"
          ]
        },
        mailbox: {
          title: "Mailbox (इनबॉक्स)",
          points: [
            "Admin सभी छात्रों को Mailbox के ज़रिए Special Code भेज सकते हैं।",
            "Inbox में codes के प्रकार: Credits, Score Points, Score Boost, Daily Limit Boost, Subscription, Discount, Top Bar Effect।",
            "Inbox के codes की एक expiry date होती है — समय से पहले redeem करें!",
            "Store visit करने पर आपको auto-discount code mailbox में मिलता है।",
            "'Redeem Code' section में जाकर mail में दिखा code enter करें।",
            "हर code एक user एक बार ही use कर सकता है।",
            "अपठित messages पर Mailbox tab में लाल dot दिखता है।"
          ]
        }
      }
    }
  };

  const t = content[lang];

  const SectionCard: React.FC<{ icon: React.ReactNode; title: string; color: string; children: React.ReactNode }> = ({ icon, title, color, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100" style={{ background: `${color}08` }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
          {icon}
        </div>
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );

  const BulletList: React.FC<{ points: string[]; icon?: React.ReactNode }> = ({ points, icon }) => (
    <ul className="space-y-3">
      {points.map((point, i) => (
        <li key={i} className="flex gap-3 text-sm text-slate-600">
          <span className="shrink-0 mt-0.5">{icon || <CheckCircle2 size={16} className="text-emerald-500" />}</span>
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center">
          <button onClick={onBack} className="text-slate-600 hover:text-slate-800 transition-colors mr-4 font-bold flex items-center gap-1">
            &larr; Back
          </button>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <KeyRound className="text-yellow-500" /> {t.title}
          </h2>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
          <button onClick={() => setLang('HI')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${lang === 'HI' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Languages size={16} /> हिंदी
          </button>
          <button onClick={() => setLang('EN')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${lang === 'EN' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
            English
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* 1. Syllabus */}
        <SectionCard icon={<BookOpen size={16} className="text-emerald-600" />} title={t.sections.syllabus.title} color="#10b981">
          <BulletList points={t.sections.syllabus.points} />
        </SectionCard>

        {/* 2. Credits */}
        <SectionCard icon={<Coins size={16} className="text-yellow-500" />} title={t.sections.credits.title} color="#f59e0b">
          <ul className="space-y-3">
            <li className="flex gap-3 text-sm text-slate-600">
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 h-fit mt-0.5">Free</span>
              {t.sections.credits.points[0]}
            </li>
            <li className="flex gap-3 text-sm text-slate-600">
              <span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 h-fit mt-0.5 whitespace-nowrap">1 Credit</span>
              {t.sections.credits.points[1]}
            </li>
            <li className="flex gap-3 text-sm text-slate-600">
              <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 h-fit mt-0.5 whitespace-nowrap">1 Credit</span>
              {t.sections.credits.points[2]}
            </li>
            <li className="flex gap-3 text-sm text-slate-600">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              {t.sections.credits.points[3]}
            </li>
          </ul>
        </SectionCard>

        {/* 3. Chat Rules */}
        <SectionCard icon={<MessageCircle size={16} className="text-blue-600" />} title={t.sections.chat.title} color="#3b82f6">
          <BulletList points={t.sections.chat.points} icon={<AlertTriangle size={16} className="text-orange-500" />} />
        </SectionCard>

        {/* 4. Language */}
        <SectionCard icon={<Crown size={16} className="text-purple-600" />} title={t.sections.language.title} color="#8b5cf6">
          <BulletList points={t.sections.language.points} />
        </SectionCard>

        {/* 5. Level System — full width */}
        <div className="md:col-span-2">
          <SectionCard icon={<Star size={16} className="text-amber-500" />} title={t.sections.levelSystem.title} color="#f59e0b">
            <p className="text-sm text-slate-500 mb-4">{t.sections.levelSystem.intro}</p>

            {/* Level table */}
            <div className="rounded-xl overflow-hidden border border-slate-100 mb-5">
              <div className="grid grid-cols-4 bg-slate-50 px-3 py-2 border-b border-slate-100">
                {['Level', 'Required', 'Discount', 'Perks'].map(h => (
                  <p key={h} className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{h}</p>
                ))}
              </div>
              {t.sections.levelSystem.levels.map((l, i) => (
                <div key={i} className={`grid grid-cols-4 px-3 py-2.5 border-b border-slate-50 last:border-0 ${i % 2 === 0 ? '' : 'bg-slate-50/50'}`}>
                  <p className="text-[11px] font-black text-slate-800">{l.level}</p>
                  <p className="text-[11px] font-bold text-slate-600">{l.pts}</p>
                  <p className={`text-[11px] font-black ${l.discount.includes('MAX') ? 'text-emerald-600' : l.discount.includes('%') ? 'text-emerald-500' : 'text-slate-400'}`}>{l.discount}</p>
                  <p className="text-[10px] text-slate-500">{l.perks}</p>
                </div>
              ))}
            </div>

            {/* Earning rules */}
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Score Earning Rules</p>
            <ul className="space-y-2">
              {t.sections.levelSystem.earningRules.map((rule, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-slate-600">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{i + 1}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        {/* 6. Leaderboard */}
        <SectionCard icon={<Trophy size={16} className="text-yellow-500" />} title={t.sections.leaderboard.title} color="#f59e0b">
          <BulletList points={t.sections.leaderboard.points} icon={<Trophy size={14} className="text-yellow-400" />} />
        </SectionCard>

        {/* 7. Mailbox */}
        <SectionCard icon={<Mail size={16} className="text-indigo-600" />} title={t.sections.mailbox.title} color="#6366f1">
          <BulletList points={t.sections.mailbox.points} icon={<Mail size={14} className="text-indigo-400" />} />
        </SectionCard>

      </div>

      {settings?.showFooter !== false && (
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6 text-center">
          <p className="text-blue-700 font-bold text-sm">
            "Study daily, earn score, climb levels — your dedication unlocks real rewards! 🚀"
          </p>
        </div>
      )}
    </div>
  );
};
