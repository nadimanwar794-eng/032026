import React, { useState } from 'react';
import {
    Search, ChevronDown, ChevronRight, X,
    Coins, Star, Zap, Trophy, Flame, BarChart3,
    BookOpen, FileText, Video, Headphones, BookMarked,
    ClipboardList, CheckSquare, Brain, Sparkles, Bot,
    MessageCircle, MessageSquare, Users,
    RefreshCw, Download, Wifi, WifiOff,
    Moon, Globe, Bell, ShoppingBag, Gift, Key,
    Home, Navigation, Layers, Lock, Unlock,
    Play, Volume2, RotateCcw, Info, GraduationCap,
    TrendingUp, Calendar, Award, Target, Dumbbell,
    ArrowRight, AlignLeft, Gamepad2, Medal
} from 'lucide-react';
import { User } from '../types';
import { useAppTheme } from '../utils/themeContext';

/* ── Tier gradient helper ── */
function getTierGrad(user?: User): { header: string; btn: string; focus: string; ring: string; shimmerMid: string; shimmerPeak: string } {
    const level = (user as any)?.subscriptionLevel || '';
    const active = user?.isPremium && user?.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
    if (active && (level === 'ULTRA' || level === 'PRO')) {
        return {
            header:      'linear-gradient(135deg,#0F172A 0%,#1E2A4A 50%,#1A2F5E 100%)',
            btn:         'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
            focus:       '#60a5fa',
            ring:        'rgba(96,165,250,0.25)',
            shimmerMid:  'rgba(30,58,95,0.55)',
            shimmerPeak: 'rgba(30,58,95,0.80)',
        };
    }
    if (active && level === 'BASIC') {
        return {
            header:      'linear-gradient(135deg,#1e3a8a 0%,#2563eb 55%,#1d4ed8 100%)',
            btn:         'linear-gradient(135deg,#2563eb,#3b82f6)',
            focus:       '#60a5fa',
            ring:        'rgba(96,165,250,0.25)',
            shimmerMid:  'rgba(59,130,246,0.40)',
            shimmerPeak: 'rgba(59,130,246,0.65)',
        };
    }
    // Free — sky
    return {
        header:      'linear-gradient(135deg,#0284c7 0%,#0ea5e9 55%,#38bdf8 100%)',
        btn:         'linear-gradient(135deg,#0284c7,#0ea5e9)',
        focus:       '#38bdf8',
        ring:        'rgba(56,189,248,0.25)',
        shimmerMid:  'rgba(14,165,233,0.38)',
        shimmerPeak: 'rgba(14,165,233,0.60)',
    };
}

interface HelpItem {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    desc: string;
    color: string;
    tags?: string[];
    warning?: string;
    tip?: string;
}

interface HelpSection {
    id: string;
    groupTitle: string;
    groupIcon: React.ReactNode;
    groupColor: string;
    groupDesc: string;
    items: HelpItem[];
}

const SECTIONS: HelpSection[] = [
    {
        id: 'CREDITS',
        groupTitle: 'Credits & Coins System',
        groupIcon: <Coins size={18} />,
        groupColor: 'amber',
        groupDesc: 'Coins kya hain, kaise milte hain, aur kahan kharach hote hain',
        items: [
            {
                icon: <Coins size={16} />,
                title: 'Credits (Coins) kya hote hain?',
                subtitle: 'App ki internal currency — sikken ki tarah',
                desc: 'Credits is app ki internal currency hai — jaise pocket money. Inhe "Coins" ya "CR" bhi kaha jaata hai. Kuch content free hota hai, kuch content unlock karne ke liye credits lagte hain jaise Premium PDF (2-5 CR), Write Mode (5-10 CR), Video Lecture (5 CR). Credits kabhi expire nahi hote jab tak aap khud use na karo. Apne credits top-right corner ya Profile tab mein dekh sakte ho.',
                color: 'amber',
                tags: ['CR', 'Coins', 'Currency', 'Balance'],
                tip: 'Roz login karo — daily bonus milta hai! 7+ din ka streak ho toh bonus aur zyada milta hai.'
            },
            {
                icon: <Gift size={16} />,
                title: 'Daily Login Bonus',
                subtitle: 'Roz app kholne pe free credits milte hain',
                desc: 'Har din app kholne pe aapko automatic credits milte hain — bina kuch kiye. Free users ko 2-3 CR, Basic users ko 5 CR, Ultra users ko 10 CR milte hain. Level system ke anusar aur bhi zyada mil sakta hai (L4: +10, L5: +15, L7: +25 extra). Ye bonus "Mail" tab → Rewards mein aata hai — wahan jaake "Claim" karo. Bonus 12 ghante ke liye valid hota hai.',
                color: 'amber',
                tags: ['Daily Bonus', 'Free Credits', 'Mail', 'Claim'],
                tip: 'Bonus claim karna mat bhoolein! Roz subah app khole, Mail → Rewards pe jaaye aur Claim karo.',
                warning: '⚠️ 12 ghante baad bonus expire ho jaata hai — sahi waqt pe claim karo.'
            },
            {
                icon: <Star size={16} />,
                title: 'Coins kaise earn karein?',
                subtitle: 'Padhne, practice karne aur khel khel mein credits kamao',
                desc: 'Coins kamaane ke kai tarike hain: 🎁 Daily Login Bonus — roz app kholne pe. 🔥 Login Streak — lagatar din login karne pe zyada bonus. 🎡 Spin Wheel — coins invest karke gambling-style game mein jeet sakte ho. 🏆 Level Up — level system pe aagte rahne se bonus milta hai (L3+). 📋 Homework/Task Complete — admin-assigned tasks poore karne pe. 🎁 Gift Codes — admin ya promotions ke zariye redeemable codes. 📲 Referral Bonus — kisi ko app use karwao toh bonus. 🏅 MCQ Milestones — certain MCQ counts pe bonus award hota hai.',
                color: 'emerald',
                tags: ['Earn', 'Spin Wheel', 'Streak', 'Homework', 'Gift Code', 'Milestones'],
                tip: 'Spin Wheel judiciously use karo — zyada win karne ke liye agar chances acche lage tabhi spin karo.'
            },
            {
                icon: <ShoppingBag size={16} />,
                title: 'Store se Credits kharidna',
                subtitle: 'Real money se coins ya subscription kharidein',
                desc: 'Agar coins khatam ho jaayein ya premium features chahiye ho toh Store (bottom nav mein) pe jaao. Coin Packages: ₹ deke credits kharidein. Subscription Plans: Basic ya Ultra plan lo — daily limits badh jaate hain, zyada free content milta hai. Plans milte hain: Monthly, Quarterly, Yearly (discount ke saath). Admin se directly WhatsApp pe baat karke bhi payment kar sakte ho.',
                color: 'purple',
                tags: ['Store', 'Buy Coins', 'Basic Plan', 'Ultra Plan', 'Payment'],
                tip: 'Ultra plan lene se Write Mode mein 10 free notes/day milte hain, zyada MCQ limit, aur zyada daily login bonus.'
            },
            {
                icon: <Key size={16} />,
                title: 'Gift Code Redeem karna',
                subtitle: 'Admin ya promotion ka code enter karke credits pao',
                desc: 'Kabhi kabhi admin special codes deta hai — promotions, contests ya giveaway mein. Code redeem karne ke liye: Profile tab → "Redeem Code" button dhundho. Code enter karo aur submit karo. Agar code valid hai toh credits ya subscription turant mil jaata hai. Ek code sirf ek baar use ho sakta hai — apna code doosron ko mat bataao.',
                color: 'teal',
                tags: ['Redeem', 'Gift Code', 'Promo Code', 'Free Credits'],
                warning: '⚠️ Code case-sensitive ho sakta hai — exactly waise enter karo jaise diya gaya ho.'
            },
        ]
    },
    {
        id: 'NOTES',
        groupTitle: 'Notes & Study Material',
        groupIcon: <BookOpen size={18} />,
        groupColor: 'blue',
        groupDesc: 'PDF notes, Write Mode, Lucent aur Deep Dive — har type ki reading',
        items: [
            {
                icon: <FileText size={16} />,
                title: 'Free Notes (PDF)',
                subtitle: 'Bilkul free — sab students ke liye',
                desc: 'Har chapter ke basic notes PDF format mein free hote hain. Kaise access karein: Home → Notes → Subject → Class/Chapter → "Free Notes" tab pe click. PDF full-screen mein khulta hai. Zoom in/out kar sakte ho. Rotate karo agar landscape better lage. Saath mein TTS (Text-to-Speech) bhi available hoti hai — sun ke padho.',
                color: 'blue',
                tags: ['PDF', 'Free', 'Zoom', 'TTS', 'Rotate'],
                tip: 'PDF ko offline save bhi kar sakte ho (agar admin ne allow kiya ho) — internet band hone pe bhi padh sako!'
            },
            {
                icon: <Lock size={16} />,
                title: 'Premium Notes (PDF)',
                subtitle: 'Advanced aur detailed notes — credits ya subscription chahiye',
                desc: 'Kuch chapters ke detailed, exam-focused PDF notes premium hote hain. Free users ko credits dene padenge (usually 2-5 CR). Basic/Ultra users ko ya toh free milte hain ya kam credits lagti hai. Access karne ka tarika: Chapter ke andar "Premium Notes" ya "PDF" tab pe click karo. Agar locked hai toh cost dikhega — "Unlock" karo. Ek baar unlock ho jaye toh us din neend tak access rahta hai.',
                color: 'indigo',
                tags: ['Premium', 'Unlock', 'Credits', 'Exam Notes'],
                tip: 'Ultra plan pe premium PDF daily limit free milti hai — bahut save hota hai agar regular use karo.'
            },
            {
                icon: <AlignLeft size={16} />,
                title: 'Write Mode (Deep Dive) — Styled Notes',
                subtitle: 'AI-generated beautiful HTML notes — parhne mein mazaa aata hai',
                desc: 'Ye app ka sabse powerful notes feature hai. Normal PDF se bilkul alag — yahan notes styled, colored, organized dikhte hain. Headings, tables, bullets, colored boxes — sab kuch formatted. Kaise use karein: Chapter ke andar "Deep Dive" tab → "Write" button press karo. Free users ko 5 CR per use lagta hai. Basic users ko 5 free/day milte hain phir 10 CR/use. Ultra users ko 10 free/day. Dark Mode (Ultra style) mein khulta hai — black background, white text, very premium feel. Zoom in/out bhi hai (A-/A+). TTS "Read" mode bhi available hai saath mein.',
                color: 'teal',
                tags: ['HTML Notes', 'Write Mode', 'Styled', 'Dark Mode', 'Deep Dive', 'AI'],
                tip: 'Exam se pehle Write Mode mein notes padho — visually attractive format mein concepts jaldi yaad hote hain!',
                warning: '⚠️ Free users: har baar 5 CR lagte hain. Apna balance check karo pehle.'
            },
            {
                icon: <BookMarked size={16} />,
                title: 'Lucent / Book Notes Reader',
                subtitle: 'Lucent GK jaisi books ke page-by-page notes',
                desc: 'Competition section mein ek special "Lucent" ya "Book Notes" reader milta hai. Yahan books (Lucent GK, NCERT, etc.) ke structured page-by-page notes hain. Edge-to-edge clean reading experience — bilkul asli book jaisa. Har page ko TTS se suna sakte ho. Notes star ⭐ karke save kar sakte ho. Search kar sakte ho specific topic. MCQs bhi associated hain kuch pages ke saath.',
                color: 'amber',
                tags: ['Lucent GK', 'Book Reader', 'Competition', 'Page Notes'],
                tip: 'Competition exam ki taiyaari ke liye Lucent reader bahut useful hai — roz ek chapter padho.'
            },
            {
                icon: <Download size={16} />,
                title: 'Notes Offline Save karna',
                subtitle: 'Internet band ho toh bhi padho — pehle save karo',
                desc: 'Kuch notes offline save kar sakte ho takei net nahi ho tab bhi access karo. Kaise save karein: Note/chapter page pe "Save Offline" ya download button dhoondho. Saved notes "Offline" section mein milenge. Yaad rakhein: PDF offline save alag tarah hota hai (browser download), app ke andar HTML notes separately cacheable hote hain. Admin ki taraf se limited saving allowed hai per day.',
                color: 'slate',
                tags: ['Offline', 'Save', 'Download', 'No Internet'],
                tip: 'Important chapters pehle se save kar lo — exam time pe internet na ho toh bhi padh sako.'
            },
            {
                icon: <Star size={16} />,
                title: 'Notes Star / Bookmark karna',
                subtitle: 'Important notes ko star karke jaldi dhundho',
                desc: 'Padhe hue ya important notes pe ⭐ (star) button press karo. Starred notes "Profile → Starred Notes" ya dedicated section mein milte hain. Exam se pehle sirf starred notes revise karo — time bachega. Notes chapters aur topics ke hisaab se organize hote hain.',
                color: 'yellow',
                tags: ['Star', 'Bookmark', 'Favorite', 'Quick Access'],
                tip: 'Har chapter ke 3-5 most important notes star karo — last-minute revision easy ho jaati hai.'
            },
        ]
    },
    {
        id: 'VIDEO_AUDIO',
        groupTitle: 'Video & Audio',
        groupIcon: <Video size={18} />,
        groupColor: 'red',
        groupDesc: 'Video lectures, audio series aur Text-to-Speech ki complete guide',
        items: [
            {
                icon: <Play size={16} />,
                title: 'Video Lectures',
                subtitle: 'Chapter-wise video lectures dekhein',
                desc: 'Har chapter ke liye video lecture available hai. Kaise dekhein: Home → Video → Subject → Chapter → Video pe click. Free users ko credit dena pad sakta hai (5 CR default). Basic/Ultra users ke liye pehle X videos free milti hain, phir credits. Video YouTube ya Google Drive pe hosted hai — directly full screen mein chalti hai. Player mein speed control bhi hota hai (0.5x, 1x, 1.5x, 2x). Video watching pe score bhi milta hai.',
                color: 'red',
                tags: ['Video', 'YouTube', 'Full Screen', 'Speed Control', 'Lecture'],
                tip: 'Ek baar dekha hua video phir se dekhne pe credits nahi lagte us session mein.'
            },
            {
                icon: <Headphones size={16} />,
                title: 'Audio Series / Lecture',
                subtitle: 'Sunke padho — aankhein thak jayen toh audio try karo',
                desc: 'Kuch chapters ke audio lectures available hain. Chalte phirte suno — car mein, market mein. Audio Series section mein jaao ya chapter ke andar "Audio" tab dhundho. Background mein bhi chalta rehta hai. Ye feature specially unke liye hai jo visually padh nahi sakte ya travel mein hain.',
                color: 'pink',
                tags: ['Audio', 'Podcast Style', 'Background Play', 'Accessibility'],
                tip: 'Raat ko neend se pehle audio lecture sunna bohot effective hota hai — relaxed mind concepts better absorb karta hai.'
            },
            {
                icon: <Volume2 size={16} />,
                title: 'Text-to-Speech (TTS) — "Read" Button',
                subtitle: 'Notes ko aawaz mein sunna — automatic reading',
                desc: 'Kisi bhi note page ya Write Mode mein upar "Read" button milega. Press karo — aur app note padhna start kar dega aawaz mein. Hindi aur English dono mein available hai — app ki language setting ke anusar. Notes ko chunks mein padhta hai — bahut lamba bhi ho toh achhe se kaam karta hai. Pause, stop ya agle section pe skip bhi kar sakte ho. Kisi bhi line pe tap karo — usi jagah se reading start ho jaati hai.',
                color: 'sky',
                tags: ['TTS', 'Text to Speech', 'Audio', 'Hindi', 'English', 'Tap to Read'],
                tip: 'Ek kaan mein earphone lagao, notes sun lo — yeh "passive learning" bahut effective technique hai!'
            },
            {
                icon: <Layers size={16} />,
                title: 'Universal Playlist',
                subtitle: 'Subject se alag general videos ka collection',
                desc: 'Kuch videos kisi specific chapter se nahi hote — jaise motivational talks, general study tips, board exam guidance. Ye "Playlist" section mein milte hain. Subject select karne ki zaroorat nahi — seedha playlist section mein milega. Useful for: Mock test guidance, Board exam tips, Science experiments, General knowledge videos.',
                color: 'orange',
                tags: ['General Videos', 'Playlist', 'Motivational', 'Tips'],
            },
        ]
    },
    {
        id: 'MCQ',
        groupTitle: 'MCQ Practice & Tests',
        groupIcon: <ClipboardList size={18} />,
        groupColor: 'violet',
        groupDesc: 'MCQ practice, test mode, marksheet aur mistake bank — sab ek jagah',
        items: [
            {
                icon: <CheckSquare size={16} />,
                title: 'MCQ Practice Mode',
                subtitle: 'Chapter-wise MCQ banao — bilkul free',
                desc: 'MCQ Practice sabse zyada use hone wala feature hai. Kaise use karein: Home → MCQ → Subject → Chapter → "Practice" mode. Ek-ek question aata hai — answer chuno. Turant pata chalta hai sahi/galat. Explanation bhi milti hai. Daily limit hai: Free = 50/day, Basic = 70/day, Ultra = 100/day. Level system se bonus limit milti hai. Galat jawab automatically "Mistake Bank" mein save hote hain.',
                color: 'violet',
                tags: ['MCQ', 'Practice', 'Daily Limit', 'Instant Feedback', 'Free'],
                tip: 'Roz 20-30 MCQ karo — consistency se aapka score level badhta rahega aur level system mein progress hogi!'
            },
            {
                icon: <Target size={16} />,
                title: 'MCQ Test Mode',
                subtitle: 'Timed full mock test — exam jaisa mahsoos karo',
                desc: 'Test Mode mein aate ho toh real exam jaisa experience hota hai. Saare questions ek saath — time limit ke saath. Submit karne pe detailed "Marksheet" milti hai. Kaise access: Chapter → "Test" mode ya "Mock Test" button. Basic credits lagte hain (10 CR). Timer chalta rehta hai — submit ya auto-submit hota hai time khatam hone pe. Score, accuracy, speed sab measure hota hai.',
                color: 'indigo',
                tags: ['Test Mode', 'Timer', 'Mock Test', 'Submit', 'Exam Prep'],
                tip: 'Exam se 2-3 din pehle Test Mode use karo — actual exam pressure feel karna bahut faydemand hai.',
                warning: '⚠️ Test submit hone ke baad change nahi kar sakte — dhyan se jawab chuno.'
            },
            {
                icon: <BarChart3 size={16} />,
                title: 'Smart Marksheet',
                subtitle: 'Test result ka full analysis — strengths aur weaknesses jaano',
                desc: 'Test submit karne ke baad automatically Marksheet milti hai. Kya dikhta hai marksheet mein: ✅ Total Score (correct/total). ⏱️ Time per question. 📊 Accuracy percentage. 📝 Topic-wise breakdown — kahan zyada galti ki. 🎯 Weak areas highlight. Marksheet offline save bhi hoti hai — bina net ke dekh sako. Share button se WhatsApp pe bhej sakte ho.',
                color: 'blue',
                tags: ['Marksheet', 'Score', 'Analysis', 'Offline', 'Share'],
                tip: 'Marksheet mein red/wrong answers dhyan se dekho — wohi topics agle baar zyada practice karo.'
            },
            {
                icon: <Brain size={16} />,
                title: 'AI Deep Analysis',
                subtitle: 'AI se personal weak area report banwao',
                desc: 'Ye ek premium feature hai jo AI se aapke test results ka deep analysis karta hai. Normal Marksheet se alag — AI batata hai: Kaunse specific concepts mein problem hai. Kis tarah ke questions galat karte ho. Kya improvement strategy adopt karein. Next kya padha jaaye. Kaise use: Test ke baad Marksheet mein "AI Analysis" button. Credits lagte hain (5 CR). Analysis kuch seconds mein ready ho jaata hai.',
                color: 'teal',
                tags: ['AI Analysis', 'Weak Areas', 'Personal Report', 'Strategy'],
                tip: 'Ek baar AI analysis karwao — bahut clear idea aata hai ki exactly kahan improvement chahiye.'
            },
            {
                icon: <Dumbbell size={16} />,
                title: 'Mistake Bank',
                subtitle: 'Apni galat jawab wali questions ki alag list',
                desc: 'Jo bhi MCQ galat karo — woh automatically "Mistake Bank" mein save ho jaata hai. Mistake Bank kahan milta hai: Profile tab → "Mistake Bank" ya dedicated section. Sirf apni galat questions practice karo — targeted learning. Sahi kar lene ke baad woh question bank se hata bhi sakta hai. Revision Hub se automatically link hota hai — weak areas track karta hai.',
                color: 'rose',
                tags: ['Mistakes', 'Wrong Answers', 'Targeted Practice', 'Weak Areas'],
                tip: 'Mistake Bank ki MCQs ko week mein ek baar zaroor practice karo — yahi galtiyan exam mein repeat hoti hain!'
            },
            {
                icon: <MessageSquare size={16} />,
                title: 'MCQ Community Chat',
                subtitle: 'MCQ share karo, discuss karo, jawab poocho',
                desc: 'MCQ practice karte waqt koi question samajh na aaye? Community Chat mein share karo. MCQ ke "Share to Chat" button press karo — question community mein jaata hai. Baaki students jawab de sakte hain, vote kar sakte hain. Wrong answer ke baare mein clarification maango. Teachers bhi yahan jawab dete hain. Chat section mein "MCQ" tab milega.',
                color: 'purple',
                tags: ['Community', 'MCQ Share', 'Discussion', 'Doubt Clearing'],
            },
        ]
    },
    {
        id: 'AI',
        groupTitle: 'AI Features — AI Tutor Hub',
        groupIcon: <Bot size={18} />,
        groupColor: 'teal',
        groupDesc: 'AI Chat, Deep Dive aur study assistance — 24/7 available personal tutor',
        items: [
            {
                icon: <Bot size={16} />,
                title: 'AI Chat Tutor',
                subtitle: 'Koi bhi sawaal poocho — AI 24/7 jawab deta hai',
                desc: 'App mein ek intelligent AI tutor built-in hai (Groq/Gemini powered). Koi bhi subject ka sawaal poocho — Hindi ya English mein. Math problems, science concepts, history facts — sab kuch samjhaata hai. Kaise access: Bottom navigation → "AI" tab ya Home → Chat icon. Cost: 1 CR per message (ya admin setting ke anusar). Conversation history save hoti hai — pehle ke sawaal dobara dekh sako. Notes pe bhi context-aware jawab milta hai.',
                color: 'teal',
                tags: ['AI Tutor', 'Chat', 'Any Subject', 'Hindi', 'Groq', 'Gemini'],
                tip: 'Complicated concepts directly AI se explain karwao — "Mujhe simple Hindi mein samjhao" likhne se aur achha explanation milta hai!'
            },
            {
                icon: <Sparkles size={16} />,
                title: 'Universal AI Chat',
                subtitle: 'Global AI assistant — koi bhi topic, koi bhi sawaal',
                desc: 'Ye ek general-purpose AI chat hai jo sirf study tak limited nahi. Career guidance, general knowledge, current affairs, exam strategy — sab kuch poocho. Notes aur content se linked questions bhi kar sakte ho. Multiple AI models available hain (admin configure karta hai). Response quality bahut high hoti hai — real teacher jaisi explanation milti hai.',
                color: 'cyan',
                tags: ['Universal Chat', 'Career Guidance', 'General AI', 'Multi-model'],
                tip: 'Exam stress feel ho raha ho toh AI se study plan banwao — "Mera exam 10 din mein hai, Physics weak hai, plan banaao" likhne se detailed plan milega.'
            },
            {
                icon: <FileText size={16} />,
                title: 'AI se Notes Generate',
                subtitle: 'Kisi bhi topic pe AI se notes banwao',
                desc: 'Agar kisi topic pe content nahi mila ya aur detail chahiye — AI se custom notes generate karwao. Deep Dive section mein "AI Generate" option. Topic name daalo — AI beautiful styled HTML notes banata hai. Turant ready ho jaate hain — download ya save bhi kar sakte ho.',
                color: 'emerald',
                tags: ['AI Generate', 'Custom Notes', 'Topic Notes', 'Instant'],
                tip: 'Job Interview ya competitive exam ke liye custom topic notes banwao jo app mein available na ho!'
            },
        ]
    },
    {
        id: 'REVISION',
        groupTitle: 'Revision Hub & Tracking',
        groupIcon: <RotateCcw size={18} />,
        groupColor: 'indigo',
        groupDesc: 'Smart revision schedule, spaced repetition aur progress tracking',
        items: [
            {
                icon: <RefreshCw size={16} />,
                title: 'Revision Hub V2',
                subtitle: 'Smart spaced-repetition se sahi waqt pe revision karo',
                desc: 'Revision Hub app ka ek special feature hai jo science-backed "Spaced Repetition" method use karta hai. Kaam kaise karta hai: Jo MCQ galat karoge → Revision Hub mein save hota hai. Jab revision ka time aata hai → Hub remind karta hai. "Due Today" ke notes/MCQs revise karo → Next due date automatically set hoti hai. Agar sahi karo → interval badh jaata hai. Agar phir galat karo → jaldi dobara aata hai. Isse padha hua zyada yaad rehta hai exam tak.',
                color: 'indigo',
                tags: ['Spaced Repetition', 'Due Today', 'Smart Revision', 'Memory'],
                tip: 'Roz sirf 10-15 minute Revision Hub mein do — exam se pehle sab kuch yaad rehega bina mahnat ke!'
            },
            {
                icon: <Calendar size={16} />,
                title: 'Revision Schedule',
                subtitle: 'Due dates aur upcoming revisions ka calendar',
                desc: 'Revision Hub mein ek schedule milta hai jo batata hai: Aaj kya revise karna hai. Kal kya aane wala hai. Is week ki due notes/MCQs. Subject-wise breakdown. Isse aap plan kar sakte ho ki kab kaunsa chapter revise karna hai. Overdue items red mein highlight hote hain.',
                color: 'sky',
                tags: ['Schedule', 'Calendar', 'Due Today', 'Overdue', 'Planning'],
            },
            {
                icon: <Target size={16} />,
                title: 'Weak Area Identifier',
                subtitle: 'App khud batata hai kahan aap weak ho',
                desc: 'Revision Hub automatically track karta hai aapke weak areas: Kin subjects mein zyada galtiyan. Kaunse topics repeatedly wrong aate hain. Kis chapter pe zyada time spend karna chahiye. Ye data MCQ mistakes, test results aur reading history se aata hai. Weak areas pe auto-focus hota hai revision scheduling mein.',
                color: 'rose',
                tags: ['Weak Areas', 'Auto Track', 'Subject Analysis', 'Focus'],
                tip: 'Weak area tracker ko ignore mat karo — ye exactly wahi batata hai jo exam mein aane ki probability zyada hai.'
            },
            {
                icon: <WifiOff size={16} />,
                title: 'Offline Mode',
                subtitle: 'Internet nahi hai? Pehle se save content padho',
                desc: 'App offline bhi kaam karta hai agar pehle se data load ho. Kya offline accessible hai: Pehle se dekhe gaye notes (cache mein). Saved/downloaded PDFs. Revision Hub data. MCQ practice history. Kya karne ke liye internet chahiye: Nayi content load karna. AI Chat. Video streaming. Naye MCQ load karna. Settings update karna.',
                color: 'slate',
                tags: ['Offline', 'Cache', 'No Internet', 'PWA'],
                tip: 'App ko "PWA" ke roop mein phone pe install karo (browser → "Add to Home Screen") — better offline experience milti hai!'
            },
        ]
    },
    {
        id: 'GAMES',
        groupTitle: 'Games, Level System & Rewards',
        groupIcon: <Gamepad2 size={18} />,
        groupColor: 'orange',
        groupDesc: 'Spin Wheel, levels, leaderboard aur daily streak — study pe game feel!',
        items: [
            {
                icon: <Gamepad2 size={16} />,
                title: 'Spin Wheel',
                subtitle: 'Coins invest karo aur zyada coins jeetne ki koshish karo',
                desc: 'Spin Wheel ek mini-game hai. Kaise khelein: Home pe ya dedicated Game section mein jaao. "Spin" button press karo — credits lagte hain (admin set karta hai). Wheel ghoomti hai aur koi prize ya zero milta hai. Jeet gaye toh credited; lose kiye toh woh coins chale gaye. Har spin mein defined prizes hain — alag-alag probabilities ke saath. Ye purely luck-based game hai.',
                color: 'orange',
                tags: ['Spin Wheel', 'Luck Game', 'Earn Coins', 'Prize'],
                warning: '⚠️ Guaranteed nahi hai ki hamesha jeetoge — sirf extra credits hone pe hi spin karo, zarori credits mat lagao.'
            },
            {
                icon: <TrendingUp size={16} />,
                title: 'Level System',
                subtitle: 'MCQ karo, padho aur level up karo — rewards milte hain',
                desc: 'App mein 11 levels hain — Level 1 (Beginner 🌱) se Level 11 (Supreme 🏆) tak. Score kaise milta hai: MCQ sahi karna (+points), Daily login (+10), Notes padha (+points), Video dekha (+points). Level up hone ke fayde: Higher levels pe zyada daily login bonus milta hai. Discount store pe milti hai (L3: 2%, L7: 10%, L11: 20%). MCQ daily limit badhti hai. Write Mode ke free uses badhte hain. Apna level Profile tab mein dekhein.',
                color: 'violet',
                tags: ['Level 1-11', 'Score', 'XP', 'Rewards', 'Daily Login Bonus', 'Discount'],
                tip: 'Roz MCQ karo aur daily login karo — slow aur steady level badhta rehega, aur rewards automatically milte rahenge!'
            },
            {
                icon: <Trophy size={16} />,
                title: 'Level Leaderboard',
                subtitle: 'Dusre students se apna comparison karo',
                desc: 'Leaderboard mein dekho app ke saare students ka ranking. Top pe woh students hain jinka totalScore sabse zyada hai. Tabs hain: 🏆 Level (score ke hisaab se), 📝 MCQ (daily MCQ count), 🎬 Video, 📄 PDF, ✍️ Write, 🔥 Streak. Kisi bhi student ke naam pe click karo — unka profile card dekhoge. Apna rank dekh sakte ho list mein.',
                color: 'yellow',
                tags: ['Leaderboard', 'Rank', 'Top Students', 'Competition'],
                tip: 'Leaderboard se motivation milti hai! Top 10 mein aane ki koshish karo — study bhi hogi, game bhi feel hoga.'
            },
            {
                icon: <Flame size={16} />,
                title: 'Daily Login Streak',
                subtitle: 'Lagatar din login karo — streak badge aur bonus pao',
                desc: 'Streak matlab lagatar kitne din aapne app kholaa. Kaise dikhta hai: Top bar mein 🔥 icon ke saath number (jaise 🔥7d). 3+ days pe gold badge milta hai. 7+ days pe "On Fire" banner. 30+ days pe legendary trophy 🏆. Streak ke fayde: Zyada daily login bonus milta hai. Score aur level tez badhta hai. New record hone pe 100 CR bonus milta hai! Ek din bhi miss kiya toh streak TUT JAATA HAI.',
                color: 'red',
                tags: ['Streak', 'Daily Login', 'Fire', 'Record', 'Bonus'],
                warning: '⚠️ Streak break hone pe score bhi thoda gir sakta hai. Ek din miss karna avoid karo.',
                tip: 'Raat ko sone se pehle app kholo — sirf 5 second ke liye bhi kholna streak banaye rakhega!'
            },
            {
                icon: <Award size={16} />,
                title: 'Score Points System',
                subtitle: 'Har activity pe XP-jaise points milte hain — level badhta hai',
                desc: 'Haarikoi activity pe score milti hai: +10 — daily login. +points — MCQ sahi karna. +points — notes padha. +points — video dekha. -penalty — streak tootna. Score ek baar milne ke baad wapas nahi jaati (sirf streak break pe). Score se level determine hota hai — jitna zyada score utna zyada level.',
                color: 'emerald',
                tags: ['Score', 'XP', 'Activity Points', 'Level Progress'],
            },
        ]
    },
    {
        id: 'COMMUNITY',
        groupTitle: 'Community & Chat',
        groupIcon: <MessageCircle size={18} />,
        groupColor: 'blue',
        groupDesc: 'Students se baat karo, doubts clear karo, admin se madad maango',
        items: [
            {
                icon: <Users size={16} />,
                title: 'Global Chat',
                subtitle: 'Saare students ek jagah — padho, share karo, baat karo',
                desc: 'Global Chat ek community space hai jahan sabhi students ek saath baat kar sakte hain. Study tips share karo. Exam news discuss karo. Motivation lelo. Notes recommendations maango. MCQs share karo. Chat access: Bottom nav → "Chat" ya Home → Chat icon. Abusive ya inappropriate messages admin delete kar sakta hai.',
                color: 'blue',
                tags: ['Global Chat', 'Community', 'Students', 'Share', 'Discussion'],
                tip: 'Chat mein active raho — dusron ki notes recommendations se naye resources milte hain!',
                warning: '⚠️ Inappropriate language bilkul use mat karo — admin ban kar sakta hai.'
            },
            {
                icon: <MessageSquare size={16} />,
                title: 'Support Chat (Admin se baat)',
                subtitle: 'Seedha admin ko private message karo',
                desc: 'Agar koi problem hai — technical ya content related — admin ko seedha message karo. Chat → "Support" tab. Aapka message sirf aap aur admin ke beech hoga — private. Payment issues, content request, account problems — sab yahan report karo. Admin usually jaldi reply karta hai. Ek dedicated thread hoti hai aapke messages ke liye.',
                color: 'green',
                tags: ['Support', 'Admin Chat', 'Private', 'Help', 'Report Issue'],
                tip: 'Screenshots attach karo agar technical error aa raha ho — admin ko faster samajh aata hai.'
            },
            {
                icon: <Bell size={16} />,
                title: 'Notifications',
                subtitle: 'Admin ke important alerts aur announcements',
                desc: 'Admin kabhi kabhi important notifications bhejta hai sab students ko: New content added. Exam schedule. App updates. Special offers. Notifications top bar ke "Bell" icon pe milenge. Red dot dikhta hai agar unread notifications hain. Purani notifications bhi history mein dekh sakte ho.',
                color: 'rose',
                tags: ['Notifications', 'Announcements', 'Alerts', 'Bell'],
                tip: 'Notifications ignore mat karo — exam dates ya new content announcements yahan aate hain.'
            },
        ]
    },
    {
        id: 'PROFILE',
        groupTitle: 'Profile, Settings & Navigation',
        groupIcon: <GraduationCap size={18} />,
        groupColor: 'slate',
        groupDesc: 'Profile card, theme, language, homework aur navigation ka poora guide',
        items: [
            {
                icon: <GraduationCap size={16} />,
                title: 'Profile Tab',
                subtitle: 'Aapka sab kuch ek jagah — stats, settings, credits',
                desc: 'Profile tab (neeche wale nav bar mein 👤 icon) mein ye sab milega: Aapka naam, email, subscription plan. Total credits balance. Login streak aur longest streak. Level badge aur score. MCQ, video, PDF stats. Theme change. Language toggle. Starred notes. Mistake bank. Redeem code. Rules aur plans. Logout button. Yahan se apni poori app journey dekh sakte ho.',
                color: 'slate',
                tags: ['Profile', 'Stats', 'Credits', 'Settings', 'Level'],
            },
            {
                icon: <Moon size={16} />,
                title: 'Theme Change (Light / Dark / Blue)',
                subtitle: 'App ka color theme apni pasand ke anusar badlo',
                desc: 'App ke 3 themes hain: ☀️ Light Mode — default white theme. 🌑 Dark Mode — pure black background — aankhon ke liye better raat ko. 🔵 Blue Dark Mode — blue-dark theme — elegant look. Theme change karne ke liye: Profile tab → "Theme" button. Ya top bar mein direct icon. Theme change turant hoti hai — reload ki zaroorat nahi.',
                color: 'slate',
                tags: ['Theme', 'Dark Mode', 'Light Mode', 'Blue Mode'],
                tip: 'Raat ko padho toh Dark Mode use karo — aankhon pe strain bahut kam hoti hai.'
            },
            {
                icon: <Globe size={16} />,
                title: 'Language Toggle (Hindi / English)',
                subtitle: 'App ki language badlo — Hindi ya English',
                desc: 'App Hindi aur English dono mein kaam karta hai. Language button top bar mein milega (🌐 ya "HI/EN" likhaa hoga). Toggle karne pe app ki menus, buttons aur AI responses us language mein shift ho jaate hain. Notes ki content admin ne jo language mein upload ki hai — woh nahi badlegi. Sirf UI aur AI responses ki language badlti hai.',
                color: 'teal',
                tags: ['Hindi', 'English', 'Language', 'Toggle'],
            },
            {
                icon: <ClipboardList size={16} />,
                title: 'Homework Tab',
                subtitle: 'Teacher ne jo assign kiya hai — deadline ke saath dekho',
                desc: 'Agar aapke teacher ya admin ne homework assign kiya hai toh Homework tab mein milega. Homework mein hota hai: Notes padho, Video dekho, MCQ karo — specific chapter ka. Deadline bhi show hoti hai. Complete karne pe mark as done. Incomplete homework reminder deta hai. Homework pe completion bonus bhi ho sakta hai (admin ke settings pe depend).',
                color: 'indigo',
                tags: ['Homework', 'Assignment', 'Deadline', 'Teacher', 'Complete'],
                tip: 'Homework ignore mat karo — teacher assigned content exam mein aane ki probability zyada hoti hai!'
            },
            {
                icon: <Home size={16} />,
                title: 'Home Tab — Quick Actions',
                subtitle: 'Home page ka sabse zyada use hone wala area',
                desc: 'Home tab pe ye sab milta hai: 📢 Notice Bar — admin ka important announcement. 🖼️ Promo Banners — sliding images. ⚡ Quick Action Buttons — Study Start, MCQ, Video, etc. 🔥 Trending Notes — important chapters. 📅 Daily GK — roz naya current affairs. 📚 Homework reminder. 📊 Your streak aur level — glance karke dekhein. Sab kuch ek jagah taaki fast navigate kar sako.',
                color: 'amber',
                tags: ['Home', 'Notice Bar', 'Trending', 'Daily GK', 'Quick Actions'],
            },
            {
                icon: <Navigation size={16} />,
                title: 'Bottom Navigation Bar',
                subtitle: 'Neeche ke 4-5 tabs — puri app navigate karo',
                desc: 'Screen ke neeche 4-5 navigation tabs milti hain (admin control karta hai kaun si dikhein). Common tabs: 🏠 Home — home page. 📚 Study — chapters aur notes. 📝 MCQ — practice. 💰 Store — subscription aur coins. 👤 Profile — settings aur stats. Aur bhi ho sakte hain: Chat, Revision Hub, History, etc. Unread count red dot ke roop mein dikhta hai (jaise unread notifications).',
                color: 'blue',
                tags: ['Navigation', 'Bottom Bar', 'Tabs', 'Home', 'Study', 'Profile'],
            },
            {
                icon: <ArrowRight size={16} />,
                title: 'Dots Menu (⋮) — Extra Options',
                subtitle: 'Top right corner ka 3-dot menu — hidden features',
                desc: 'Top bar mein teen dots (⋮) ya hamburger menu milta hai — isey dabane pe extra options aate hain: Profile pe jaao. Rules / Feature Comparison page. Settings. App Guide. Logout. Kuch shortcuts jo bottom nav mein nahi hain — yahan milte hain. Useful jab screen chhoti ho aur sab icons fit na karein.',
                color: 'slate',
                tags: ['Dots Menu', 'Extra Options', 'Shortcuts', 'Rules', 'Logout'],
            },
        ]
    },
    {
        id: 'TIPS',
        groupTitle: 'Pro Tips — App ko Max Use karo',
        groupIcon: <Zap size={18} />,
        groupColor: 'emerald',
        groupDesc: 'Expert tips jo aapki study efficiency aur coins earning kaafi badha denge',
        items: [
            {
                icon: <Zap size={16} />,
                title: 'Top 5 Cheats — Coins Bachane ke Liye',
                subtitle: 'Smart students ye karte hain — credits waste nahi hote',
                desc: '1️⃣ Basic/Ultra plan lo — daily free views milte hain, baar baar coins nahi lagte. 2️⃣ Roz login karo — bonus claim karna bilkul mat bhoolna. 3️⃣ Level badhao — L4 se free daily bonuses start hote hain. 4️⃣ Write Mode ka use Free views khatam hone ke pehle karo, phir credits. 5️⃣ Gift codes dhundo — admin ka Telegram/WhatsApp group follow karo jahan codes milte hain.',
                color: 'emerald',
                tags: ['Save Coins', 'Pro Tips', 'Efficiency', 'Strategy'],
                tip: 'Plan comparison "Rules" page pe dekho — exactly pata chalega kaunsa plan aapke use ke hisaab se best value deta hai.'
            },
            {
                icon: <Medal size={16} />,
                title: 'Study Routine — Best Practice',
                subtitle: 'Iss routine se roz consistent progress hogi',
                desc: '📅 Daily Routine jo work karta hai: ☀️ Subah — App khole (streak + bonus). 📚 10 min — Revision Hub ke "Due Today" karein. 📝 20-30 MCQ practice (level score badhta hai). 🎬 Ek video lecture (difficult chapter ka). 🌙 Raat — Write Mode mein ek chapter ke notes padho. Ye routine follow karne se: Level tezi se badhta hai, Mistakes yaad hoti hain, Exam preparation solid hoti hai.',
                color: 'sky',
                tags: ['Daily Routine', 'Study Plan', 'Consistency', 'Level Up'],
                tip: 'Pomodoro Technique try karo — 25 min study, 5 min break. App ki TTS se notes suno break mein!'
            },
            {
                icon: <Info size={16} />,
                title: 'Frequently Asked Questions (FAQ)',
                subtitle: 'Common problems aur unke solutions',
                desc: '❓ Credits kaise badhaun? → Daily login, streak maintain karo, spin wheel try karo. ❓ Premium notes nahi khul raha? → Credits check karo, internet check karo. ❓ Video play nahi ho raha? → YouTube/Drive link hai — YouTube blocked mat ho. ❓ AI chat slow hai? → AI server busy hoga — thodi der baad try karo. ❓ Level up nahi hua? → Thresholds zyada hain higher levels pe — consistent rahein. ❓ Streak toot gaya? → Ek din miss hone pe toot jaata hai — ab se roz kholein.',
                color: 'slate',
                tags: ['FAQ', 'Common Issues', 'Troubleshooting', 'Help'],
                tip: 'Koi bhi problem ho jo yahan solve na ho → Chat → Support mein admin ko seedha message karo.'
            },
        ]
    },
];

const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
};

const groupHeaderMap: Record<string, string> = {
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    purple: 'bg-purple-600',
    violet: 'bg-violet-600',
    emerald: 'bg-emerald-600',
    teal: 'bg-teal-600',
    cyan: 'bg-cyan-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    red: 'bg-red-600',
    rose: 'bg-rose-500',
    pink: 'bg-pink-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-600',
    slate: 'bg-slate-600',
};

interface Props {
    onClose: () => void;
    user?: User;
}

export const UserGuide: React.FC<Props> = ({ onClose, user }) => {
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['CREDITS', 'NOTES']));
    const [selectedItem, setSelectedItem] = useState<{ sectionId: string; itemIndex: number } | null>(null);

    const appTheme = useAppTheme();
    const tierGrad = {
        header: appTheme.topBarGrad,
        btn:    appTheme.btnGrad,
        focus:  appTheme.primary,
        ring:   `${appTheme.primary}18`,
        shimmerMid:  `${appTheme.primary}40`,
        shimmerPeak: `${appTheme.primary}65`,
    };

    // Detect dark mode from document classes (UserGuide mounts fresh each time)
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark-mode');
    const isBlue = typeof document !== 'undefined' && document.documentElement.classList.contains('dark-mode-blue');

    const C = {
        rootBg:        isDark ? (isBlue ? '#060d1e'  : '#0a0a0f')  : '#f8fafc',
        cardBg:        isDark ? (isBlue ? '#0b1628'  : '#111118')  : '#ffffff',
        itemBg:        isDark ? (isBlue ? '#0b1628'  : '#111118')  : '#ffffff',
        itemSelBg:     isDark ? (isBlue ? '#0f2040'  : '#18181f')  : '#ffffff',
        divider:       isDark ? (isBlue ? '#1a2a44'  : '#1e1e2a')  : '#f1f5f9',
        titleColor:    isDark ? (isBlue ? '#e2eeff'  : '#e2e8f0')  : '#1e293b',
        subtitleColor: isDark ? (isBlue ? '#7b95c4'  : '#94a3b8')  : '#64748b',
        labelColor:    isDark ? (isBlue ? '#4a6a94'  : '#475569')  : '#94a3b8',
        descBg:        isDark ? (isBlue ? '#0f2040'  : '#16161e')  : '#ffffff',
        descBdr:       isDark ? (isBlue ? '#1e3a66'  : '#2a2a3a')  : tierGrad.focus,
        descText:      isDark ? (isBlue ? '#b8d0f0'  : '#cbd5e1')  : '#334155',
        tagBg:         isDark ? (isBlue ? '#0f1e38'  : '#1a1a22')  : '#f1f5f9',
        tagText:       isDark ? (isBlue ? '#7b95c4'  : '#8a9aaa')  : '#64748b',
        tagBorder:     isDark ? (isBlue ? '#1e3050'  : '#252530')  : '#e2e8f0',
        footerBg:      isDark ? (isBlue ? '#060d1e'  : '#0a0a0f')  : '#ffffff',
        footerBorder:  isDark ? (isBlue ? '#1a2a44'  : '#1e1e2a')  : '#e2e8f0',
        searchBarBg:   isDark ? (isBlue ? '#060d1e'  : '#0a0a0f')  : '#ffffff',
        searchBarBdr:  isDark ? (isBlue ? '#1a2a44'  : '#1e1e2a')  : '#e2e8f0',
        searchInputBg: isDark ? (isBlue ? '#0a1428'  : '#111118')  : '#f8fafc',
        searchInputBdr:isDark ? (isBlue ? '#1a2a44'  : '#1e1e2a')  : '#e2e8f0',
        searchText:    isDark ? '#e2e8f0' : '#1e293b',
        noResultIcon:  isDark ? (isBlue ? '#0a1428'  : '#111118')  : '#f1f5f9',
        noResultBdr:   isDark ? (isBlue ? '#1a2a44'  : '#1e1e2a')  : '#e2e8f0',
    };

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const q = search.toLowerCase().trim();

    const filteredSections = SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item =>
            !q ||
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            (item.tags || []).some(t => t.toLowerCase().includes(q))
        )
    })).filter(s => s.items.length > 0);

    const totalItems = SECTIONS.reduce((acc, s) => acc + s.items.length, 0);

    return (
        <div className="fixed inset-0 z-[9998] flex flex-col"
            style={{ fontFamily:'system-ui,-apple-system,sans-serif', background: C.rootBg }}>

            {/* ════════════════════════════════
                HEADER
            ════════════════════════════════ */}
            <div className="shrink-0 relative overflow-hidden px-5 pt-6 pb-5" style={{ background: tierGrad.header }}>
                <div className="relative z-10 flex items-center gap-4">
                    <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center">
                        <GraduationCap size={23} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black tracking-tight text-white">App Guide</h1>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30 tracking-wider">
                                FULL
                            </span>
                        </div>
                        <p className="text-[11px] font-medium mt-0.5 text-blue-100">
                            {totalItems} features · complete reference guide
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="shrink-0 w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center active:scale-90 transition-transform">
                        <X size={16} className="text-white" />
                    </button>
                </div>
            </div>

            {/* ════════════════════════════════
                SEARCH
            ════════════════════════════════ */}
            <div className="shrink-0 px-4 py-3 border-b" style={{ background: C.searchBarBg, borderColor: C.searchBarBdr }}>
                <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search — coins, MCQ, video, streak, AI..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full py-2.5 pl-9 pr-9 text-[13px] font-medium rounded-xl focus:outline-none transition-all"
                        style={{ background: C.searchInputBg, border: `1px solid ${C.searchInputBdr}`, color: C.searchText }}
                        onFocus={e => { e.currentTarget.style.borderColor = tierGrad.focus; e.currentTarget.style.boxShadow = `0 0 0 3px ${tierGrad.ring}`; }}
                        onBlur={e => { e.currentTarget.style.borderColor = C.searchInputBdr; e.currentTarget.style.boxShadow = ''; }}
                    />
                    {q && (
                        <button onClick={() => setSearch('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black bg-slate-200 text-slate-500 transition-all active:scale-90">✕</button>
                    )}
                </div>
                {q && (
                    <p className="text-[10.5px] mt-1.5 px-1 font-medium text-slate-500">
                        {filteredSections.reduce((a, s) => a + s.items.length, 0)} results — "{search}"
                    </p>
                )}
            </div>

            {/* ════════════════════════════════
                CONTENT
            ════════════════════════════════ */}
            <div className="flex-1 overflow-y-auto px-3 pt-3 pb-24 space-y-2.5" style={{ background: C.rootBg }}>

                {filteredSections.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto mb-4">
                            <Search size={22} className="text-slate-400" />
                        </div>
                        <p className="font-bold text-sm text-slate-600">Koi result nahi mila</p>
                        <p className="text-xs mt-1 text-slate-400">Dusra keyword try karo</p>
                    </div>
                )}

                {filteredSections.map(section => {
                    const isOpen = expanded.has(section.id) || !!q;
                    return (
                        <div key={section.id} className="rounded-2xl overflow-hidden shadow-sm" style={{ background: C.cardBg, border: `1px solid ${tierGrad.focus}28` }}>

                            {/* ── Section header ── */}
                            <button onClick={() => toggle(section.id)}
                                className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all relative overflow-hidden"
                                style={{
                                    background: isOpen
                                        ? `linear-gradient(90deg, ${tierGrad.ring} 0%, ${C.cardBg} 100%)`
                                        : C.cardBg,
                                }}>
                                {/* icon */}
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: tierGrad.ring, color: tierGrad.focus, border: `1px solid ${tierGrad.focus}44` }}>
                                    {section.groupIcon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-[13px]" style={{ color: C.titleColor }}>
                                        {section.groupTitle}
                                    </p>
                                    <p className="text-[10px] font-medium mt-0.5 truncate" style={{ color: C.subtitleColor }}>
                                        {section.groupDesc}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wide"
                                        style={{ background: `${tierGrad.focus}18`, color: tierGrad.focus }}>
                                        {section.items.length}
                                    </span>
                                    <div style={{ transition:'transform 0.2s', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                        <ChevronDown size={15} style={{ color: tierGrad.focus }} />
                                    </div>
                                </div>
                            </button>

                            {/* ── Items ── */}
                            {isOpen && (
                                <div className="border-t" style={{ borderColor: C.divider }}>
                                    {section.items.map((item, idx) => {
                                        const isSelected = selectedItem?.sectionId === section.id && selectedItem.itemIndex === idx;
                                        return (
                                            <div key={idx} className={`${idx > 0 ? 'border-t' : ''} transition-all`}
                                                style={{
                                                    background: isSelected ? C.itemSelBg : C.itemBg,
                                                    borderColor: C.divider,
                                                    borderLeft: isSelected ? `3px solid ${tierGrad.focus}` : 'none',
                                                    paddingLeft: isSelected ? '0' : '3px',
                                                }}>
                                                {/* item row */}
                                                <button
                                                    onClick={() => setSelectedItem(isSelected ? null : { sectionId: section.id, itemIndex: idx })}
                                                    className="w-full text-left px-4 py-3.5 flex items-start gap-3 transition-all">
                                                    {/* item icon — single tier color */}
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                                        style={{ background: tierGrad.ring, color: tierGrad.focus, border: `1px solid ${tierGrad.focus}44` }}>
                                                        {item.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-black text-[13px]" style={{ color: C.titleColor }}>
                                                                {item.title}
                                                            </p>
                                                            {item.warning && (
                                                                <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 tracking-wide">
                                                                    ⚠ LIMIT
                                                                </span>
                                                            )}
                                                            {item.tip && !item.warning && (
                                                                <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 tracking-wide">
                                                                    💡 TIP
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] font-medium mt-0.5" style={{ color: C.subtitleColor }}>
                                                            {item.subtitle}
                                                        </p>
                                                        {item.tags && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {item.tags.map(tag => (
                                                                    <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: C.tagBg, color: C.tagText, border: `1px solid ${C.tagBorder}` }}>
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 mt-1" style={{ transition:'transform 0.15s', transform: isSelected ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                                                        <ChevronDown size={14} style={{ color: isSelected ? tierGrad.focus : '#cbd5e1' }} />
                                                    </div>
                                                </button>

                                                {/* ── Expanded detail ── */}
                                                {isSelected && (
                                                    <div className="px-4 pb-4 space-y-2.5">
                                                        <div className="h-px mb-2" style={{ background: C.divider }} />

                                                        {/* description card — tier colored */}
                                                        <div className="rounded-xl p-4 border"
                                                            style={{ background: C.descBg, borderColor: C.descBdr }}>
                                                            <p className="text-[8.5px] font-black uppercase tracking-widest mb-2.5" style={{ letterSpacing:'0.12em', color: C.labelColor }}>
                                                                ◆ KYA HAI · KAISE USE KAREIN
                                                            </p>
                                                            <p className="text-[12.5px] leading-[1.7] font-medium" style={{ color: C.descText }}>
                                                                {item.desc}
                                                            </p>
                                                        </div>

                                                        {/* warning / limit — always red (semantic) */}
                                                        {item.warning && (
                                                            <div className="rounded-xl p-3.5 flex gap-3 bg-red-50 border border-red-200">
                                                                <div className="w-7 h-7 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center shrink-0 text-[13px]">⚠️</div>
                                                                <div>
                                                                    <p className="text-[8.5px] font-black uppercase tracking-widest mb-1.5 text-red-500" style={{ letterSpacing:'0.1em' }}>LIMIT · DHYAN DO</p>
                                                                    <p className="text-[11.5px] font-medium leading-relaxed text-red-700">
                                                                        {item.warning}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* tip / bonus — always green (semantic) */}
                                                        {item.tip && (
                                                            <div className="rounded-xl p-3.5 flex gap-3 bg-emerald-50 border border-emerald-200">
                                                                <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 text-[13px]">💡</div>
                                                                <div>
                                                                    <p className="text-[8.5px] font-black uppercase tracking-widest mb-1.5 text-emerald-600" style={{ letterSpacing:'0.1em' }}>BONUS TIP</p>
                                                                    <p className="text-[11.5px] font-medium leading-relaxed text-emerald-700">
                                                                        {item.tip}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* footer */}
                <div className="rounded-2xl p-4 text-center" style={{ background: C.cardBg, border: `1px solid ${C.footerBorder}` }}>
                    <p className="text-[11px] font-medium" style={{ color: C.subtitleColor }}>
                        💬 <span className="font-bold" style={{ color: C.titleColor }}>Aur koi sawaal ho?</span>{' '}
                        Chat → Support mein admin ko message karo.
                    </p>
                </div>
            </div>

            {/* ════════════════════════════════
                CLOSE BUTTON
            ════════════════════════════════ */}
            <div className="shrink-0 px-4 py-3.5 border-t" style={{ background: C.footerBg, borderColor: C.footerBorder }}>
                <button onClick={onClose}
                    className="w-full py-3.5 rounded-2xl font-black text-sm tracking-wide text-white active:scale-[0.98] transition-all shadow-md"
                    style={{ background: tierGrad.btn }}>
                    ✕  Guide Banda Karo
                </button>
            </div>
        </div>
    );
};
