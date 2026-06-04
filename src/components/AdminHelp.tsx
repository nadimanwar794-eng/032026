import React, { useState } from 'react';
import { useDebounce } from '../utils/useDebounce';
import {
    Search, ChevronDown, ChevronRight,
    Users, ShieldCheck, GraduationCap, CreditCard, Book, ShoppingBag,
    Megaphone, MessageSquare, Key, Inbox,
    FileText, Video, Headphones, ClipboardList, BookMarked, TrendingUp, ListChecks, PlaySquare,
    Gamepad2, Gift, Trophy, Rocket,
    Calendar, Sparkles, Monitor, Shield, Eye, Settings, PenTool,
    Bot, BarChart3, Globe, Bell,
    RefreshCw, Save, Moon,
    Sliders, Zap, LayoutGrid, Navigation2, Rows, DollarSign, AlertCircle,
    Info, Star, Lock, Unlock, Coins, Hash
} from 'lucide-react';

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
        id: 'TOP_BUTTONS',
        groupTitle: 'Top Bar Buttons',
        groupIcon: <Zap size={18} />,
        groupColor: 'amber',
        groupDesc: 'Admin dashboard ke upar jo 3 buttons hain — unka kaam samjhein',
        items: [
            {
                icon: <Moon size={16} />,
                title: 'Light / Black / Blue (Theme)',
                subtitle: 'Dark Mode Toggle',
                desc: 'Is button se admin dashboard ka theme badalta hai. Ek baar click karo → Black Dark Mode. Dubara click karo → Blue Dark Mode. Teesri baar → Wapas Light Mode. Sirf admin ko dikhta hai, students pe koi asar nahi.',
                color: 'slate',
                tip: 'Raat ko kaam karne ke liye Black ya Blue mode use karo — aankhon pe kam strain padti hai.'
            },
            {
                icon: <RefreshCw size={16} />,
                title: 'Force Update',
                subtitle: 'Sabhi students ke app forcefully reload karo',
                desc: 'Yeh button dabane par sabhi students ke devices pe ek force-reload command jaati hai. Jab koi naya content ya settings update ki ho aur students ko turant woh dekhna ho — tab use karo. Confirmation maangta hai pehle.',
                color: 'red',
                warning: '⚠️ Sabhi users ka app turant reload hoga — koi ongoing kaam (MCQ attempt, notes reading) interrupt ho sakta hai. Sirf zaroori hone par use karo.'
            },
            {
                icon: <Save size={16} />,
                title: 'Save Settings',
                subtitle: 'Sab changes Firebase pe save karo',
                desc: 'Yeh admin dashboard ka sabse important button hai. Jab bhi koi bhi setting change karo — pricing, limits, visibility, text, kuch bhi — Save Settings dabana zaroori hai. Bina save kiye page se jaoge toh saare changes kho jayenge.',
                color: 'indigo',
                warning: '⚠️ Har change ke baad Save karna mat bhoolein! Saving ke waqt button "Saving..." dikhata hai — tab kuch aur mat karo.'
            },
        ]
    },
    {
        id: 'CORE',
        groupTitle: 'Core Management',
        groupIcon: <Users size={18} />,
        groupColor: 'blue',
        groupDesc: 'Users, subscriptions, store aur subjects manage karo',
        items: [
            {
                icon: <Users size={16} />,
                title: 'Users',
                subtitle: 'Saare students ka database',
                desc: 'Yahan sabhi registered students ki list hoti hai. Kisi bhi student ko search kar sakte ho naam ya UID se. Student ka naam, email, subscription plan dekh sakte ho. Subscription manually badal sakte ho (Free → Basic → Ultra). Credits add/remove kar sakte ho. Student ka account block/unblock kar sakte ho. Student ke waqt impersonate (unke account se dekh sakte ho) kar sakte ho debug ke liye.',
                color: 'blue',
                tags: ['Students', 'Search', 'Edit', 'Subscription', 'Credits'],
                tip: 'Kisi student ne payment ki aur plan update nahi hua → yahan manually update karo.'
            },
            {
                icon: <ShieldCheck size={16} />,
                title: 'Sub-Admins',
                subtitle: 'Helper admins create aur manage karo',
                desc: 'Agar aap kisi teacher ya helper ko limited admin access dena chahte ho — toh yahan unka Sub-Admin account banao. Har Sub-Admin ko specific permissions do: content upload, users dekhna, demands handle karna, etc. Main Admin ke paas sab permissions hoti hain, Sub-Admins ke paas sirf woh joh aap dete ho.',
                color: 'indigo',
                tags: ['Permissions', 'Teacher Access', 'Limited Admin'],
                tip: 'Teacher ko sirf Homework aur Content upload ka access do — Store ya Users ka nahi.'
            },
            {
                icon: <GraduationCap size={16} />,
                title: 'Teachers',
                subtitle: 'Teacher accounts manage karo',
                desc: 'Teachers ka alag section jahan teacher-specific features manage hote hain. Teachers students ko lock kar sakte hain (teacher lock feature), homework assign kar sakte hain, aur apni class ke students track kar sakte hain.',
                color: 'purple',
                tags: ['Teacher Lock', 'Class Management']
            },
            {
                icon: <CreditCard size={16} />,
                title: 'Subscriptions',
                subtitle: 'Active subscriptions aur plans ka overview',
                desc: 'Yahan sabhi active subscriptions ki list hoti hai. Kaunse students ke paas Basic plan hai, kaunke paas Ultra. Manually kisi ka plan badal sakte ho. Subscription history dekh sakte ho. Expire hone wale plans track kar sakte ho.',
                color: 'purple',
                tags: ['Basic Plan', 'Ultra Plan', 'Expiry', 'Manual Upgrade']
            },
            {
                icon: <Book size={16} />,
                title: 'Subjects',
                subtitle: 'Subjects ka naam, icon aur color badlo',
                desc: 'App mein jo subjects dikhte hain (Physics, Chemistry, History, etc.) unka naam, icon aur color yahan se change kar sakte ho. Naya subject add kar sakte ho ya purana hataa sakte ho. Subject ka syllabus mode (School ya Competition) bhi yahan set hota hai.',
                color: 'emerald',
                tags: ['Subject List', 'Icons', 'Colors', 'Add/Remove']
            },
            {
                icon: <ShoppingBag size={16} />,
                title: 'Store Manager',
                subtitle: 'Coin store aur subscription packages configure karo',
                desc: 'Students jo Store page pe jaate hain — woh yahan se configure hota hai. Coin packages ka price set karo (kitne coins kitne rupees mein milenge). Subscription plans ka pricing decide karo. Special discount event activate karo countdown timer ke saath. Coin exchange rates configure karo.',
                color: 'purple',
                tags: ['Coins', 'Plans', 'Pricing', 'Discount Event'],
                tip: 'Diwali ya exam season pe special discount event activate karo — Store pe countdown timer dikhega.'
            },
        ]
    },
    {
        id: 'REQUESTS',
        groupTitle: 'User Requests',
        groupIcon: <Inbox size={18} />,
        groupColor: 'indigo',
        groupDesc: 'Students ke messages, demands aur login requests handle karo',
        items: [
            {
                icon: <Megaphone size={16} />,
                title: 'Notify Users',
                subtitle: 'Sabhi students ko notification bhejo',
                desc: 'Is feature se aap sabhi students ko ek saath in-app notification bhej sakte ho. Title aur message likho. Optional: image ya link bhi add kar sakte ho. Notification sabke "Notifications" tab mein dikhega. Useful for: Exam alerts, new content announcement, holiday notice, etc.',
                color: 'pink',
                tags: ['Broadcast', 'Alert', 'Announcement'],
                tip: 'Exam schedule, naya content, ya maintenance notice — sab yahan se bhejo.'
            },
            {
                icon: <Megaphone size={16} />,
                title: 'Demands',
                subtitle: 'Students ki content demands dekho',
                desc: 'Jab koi student koi specific topic ya content maangta hai — woh demand yahan aati hai. Pending demands dekh sakte ho. Demand ko mark as completed kar sakte ho. Popular demands count se samjho kaunsa content zyada chahiye.',
                color: 'orange',
                tags: ['Content Requests', 'Pending', 'Student Feedback']
            },
            {
                icon: <MessageSquare size={16} />,
                title: 'Chat Hub',
                subtitle: 'Global chat aur student support moderate karo',
                desc: 'Do sections hain: Global Chat (sabhi students ka community chat) aur Support Chat (individual student ne admin ko directly message kiya). Global Chat mein abusive messages delete kar sakte ho. Support mein students ke sawaalon ka jawab de sakte ho. MCQ Community bhi yahan moderatable hai.',
                color: 'blue',
                tags: ['Moderation', 'Global Chat', 'Support', 'Delete Messages'],
                tip: 'Support Chat mein har student ki baat alag thread mein hoti hai — organized rehta hai.'
            },
            {
                icon: <Key size={16} />,
                title: 'Login Requests',
                subtitle: 'Naye login requests approve/reject karo',
                desc: 'Agar "One Device Login" ya approval-based login on hai — toh naye students yahan pending rahenge. Admin ko manually approve karna hoga. Approve karne ke baad student login kar payega. Reject karne par unhe access nahi milega. Security ke liye useful — bina permission ke koi access nahi kar sakta.',
                color: 'purple',
                tags: ['Approval', 'Security', 'Access Control'],
                warning: 'Agar bahut saare pending requests hain toh students login nahi kar pa rahe hain — jaldi approve karo.'
            },
        ]
    },
    {
        id: 'CONTENT',
        groupTitle: 'Content & Analysis',
        groupIcon: <BarChart3 size={18} />,
        groupColor: 'purple',
        groupDesc: 'Notes, videos, audio, MCQs, homework aur syllabus manage karo',
        items: [
            {
                icon: <FileText size={16} />,
                title: 'Main Notes (PDF)',
                subtitle: 'Chapter-wise notes upload karo',
                desc: 'Har subject ke har chapter ke liye PDF ya HTML notes yahan upload hote hain. Free Notes (sabke liye) aur Premium Notes (Basic/Ultra ke liye) alag-alag upload kar sakte ho. School Mode aur Competition Mode ke notes alag hote hain. AI se notes generate bhi kar sakte ho. Notes ka draft save karo — publish karne se pehle preview karo.',
                color: 'blue',
                tags: ['PDF Links', 'HTML Notes', 'Free Notes', 'Premium Notes', 'AI Generate', 'Draft'],
                tip: 'Pehle draft mein save karo — ek baar preview karo — phir publish karo. Galti hone ki sambhavna kam hogi.'
            },
            {
                icon: <Video size={16} />,
                title: 'Video Lectures',
                subtitle: 'YouTube/Google Drive videos link karo',
                desc: 'Har chapter ke liye video lecture link karo. Free video alag, Premium video alag. Video ka credit cost set kar sakte ho (students kitne coins deke dekhenge). School aur Competition mode ke videos alag hote hain.',
                color: 'red',
                tags: ['YouTube Links', 'Google Drive', 'Credit Cost', 'Free/Premium']
            },
            {
                icon: <Headphones size={16} />,
                title: 'Audio Series',
                subtitle: 'Audio lectures aur audio notes manage karo',
                desc: 'Audio format mein content — students sunke padh sakte hain. Har chapter ke liye audio file ka link add karo. Useful for students jo notes sunna pasand karte hain ya visually impaired students ke liye.',
                color: 'pink',
                tags: ['Audio Links', 'TTS', 'Accessibility']
            },
            {
                icon: <ClipboardList size={16} />,
                title: 'Homework',
                subtitle: 'Daily homework assign karo students ko',
                desc: 'Teacher ya admin students ko daily homework assign kar sakta hai. Specific chapter ka content (notes, video, MCQ) homework ke roop mein bhejo. Students ke Homework tab mein dikhega. Deadline set kar sakte ho. Completed/Pending track kar sakte ho.',
                color: 'indigo',
                tags: ['Assign', 'Deadline', 'Track', 'Content Link'],
                tip: 'Homework assign karne se students disciplined rehte hain — daily reminder milta hai.'
            },
            {
                icon: <BookMarked size={16} />,
                title: 'Book Notes',
                subtitle: 'Lucent, NCERT jaise books ke page-by-page notes',
                desc: 'Yeh ek special feature hai jahan aap kisi book (jaise Lucent GK) ke page-by-page ya chapter-by-chapter notes upload kar sakte ho. Students "Lucent Reader" style mein padh sakte hain — edge-to-edge clean reading experience ke saath.',
                color: 'amber',
                tags: ['Lucent', 'Book Pages', 'Competition', 'Reader Mode']
            },
            {
                icon: <Book size={16} />,
                title: 'Daily GK',
                subtitle: 'Roz naya GK content add karo',
                desc: 'Har din ek naya GK (General Knowledge) question/article add karo. Students Home screen pe daily GK dekhenge. Current affairs, important events, facts — sab yahan manage hote hain.',
                color: 'teal',
                tags: ['Current Affairs', 'Daily Update', 'GK Facts']
            },
            {
                icon: <TrendingUp size={16} />,
                title: 'Trending Notes',
                subtitle: 'Home page pe trending/important notes feature karo',
                desc: 'Kuch notes ko "Trending" mark karo — woh Home page pe specially dikhenge. Exam ke nazdeek important topics ko highlight karo. Students seedha trending notes pe click karke padh sakte hain.',
                color: 'amber',
                tags: ['Featured', 'Home Page', 'Important Topics', 'Exam Ready']
            },
            {
                icon: <ListChecks size={16} />,
                title: 'Syllabus Manager',
                subtitle: 'Board, class aur stream ka syllabus configure karo',
                desc: 'App mein School Mode aur Competition Mode hote hain. Is section mein aap har class (6th-12th) ka syllabus set karte ho. Stream (Science, Commerce, Arts) ke subjects define karo. CBSE, BSEB board ke chapters configure karo. School aur Competition mode ke beech switch karo.',
                color: 'indigo',
                tags: ['CBSE', 'BSEB', 'Class 6-12', 'Stream', 'Chapters'],
                warning: 'Super Admin only — Syllabus changes students ke poore navigation structure ko affect karta hai.'
            },
            {
                icon: <PlaySquare size={16} />,
                title: 'Universal Playlist',
                subtitle: 'Bina subject ke universal video playlist banao',
                desc: 'Kuch videos kisi specific subject se nahi hote — jaise motivational lectures, general tips. Inhe Universal Playlist mein add karo. Students ko direct link se ya home screen se access mil sakta hai.',
                color: 'rose',
                tags: ['General Videos', 'Playlist', 'Non-subject']
            },
        ]
    },
    {
        id: 'GAME',
        groupTitle: 'Gamification',
        groupIcon: <Gamepad2 size={18} />,
        groupColor: 'orange',
        groupDesc: 'Games, rewards, prizes aur challenges configure karo',
        items: [
            {
                icon: <Gamepad2 size={16} />,
                title: 'Game Config',
                subtitle: 'Spin Wheel game setup karo',
                desc: 'Students coins earn karne ke liye Spin Wheel khelte hain. Yahan aap Spin Wheel configure karte ho: Spin karne ki cost (kitne coins lagenge), Possible rewards (coin amounts), Har reward ki probability (chance), Win/Lose ratio set karo.',
                color: 'orange',
                tags: ['Spin Wheel', 'Rewards', 'Probability', 'Coin Cost'],
                tip: 'Students ko zyada engage rakhna ho toh rewards aur probabilities attractive rakho.'
            },
            {
                icon: <Gift size={16} />,
                title: 'Engagement Rewards',
                subtitle: 'Daily login bonus aur engagement rewards set karo',
                desc: 'Students ko roz app kholne pe bonus milta hai. Yahan set karo kitne coins milenge daily login pe. Streak bonus (7 din lagatar) ka amount. Referral bonus. Task complete karne pe rewards. In settings se students daily app use karne ke liye motivated rehte hain.',
                color: 'rose',
                tags: ['Daily Bonus', 'Streak', 'Referral', 'Login Reward']
            },
            {
                icon: <Trophy size={16} />,
                title: 'Prize Settings',
                subtitle: 'Competition prizes configure karo',
                desc: 'Leaderboard ya challenge winners ke liye prizes set karo. Prize ki description, image, aur value define karo. Top 3 ya top 10 winners ke liye alag prizes. Physical prizes (gift vouchers, books) ya digital prizes (coins, subscription).',
                color: 'yellow',
                tags: ['Leaderboard Prize', 'Winners', 'Challenge Reward']
            },
            {
                icon: <Trophy size={16} />,
                title: 'Challenge Config',
                subtitle: 'Daily/Weekly challenges ka basic setup',
                desc: 'Challenge feature ka general configuration — kitne time mein challenge complete hona chahiye, challenge ke rewards, difficulty level. (Basic settings; detailed challenge creation ke liye Challenge 2.0 use karo.)',
                color: 'red',
                tags: ['Challenge Rules', 'Time Limit', 'Difficulty']
            },
            {
                icon: <Rocket size={16} />,
                title: 'Challenge 2.0',
                subtitle: 'Advanced challenge creator — detailed MCQ challenges banao',
                desc: 'Ek powerful tool jisse aap custom MCQ-based challenges create kar sakte ho. Subject, topic, difficulty aur time limit choose karo. Students compete karte hain leaderboard pe. Weekly ya daily challenges schedule karo. Winners automatically detect hote hain.',
                color: 'violet',
                tags: ['MCQ Challenge', 'Leaderboard', 'Schedule', 'Custom Questions'],
                tip: 'Exam se pehle mock challenge banao — students practice bhi karein aur compete bhi karein!'
            },
        ]
    },
    {
        id: 'NSTA_CONTROL',
        groupTitle: 'NSTA Control',
        groupIcon: <Sliders size={18} />,
        groupColor: 'violet',
        groupDesc: 'App ka core identity, animations aur advanced power settings',
        items: [
            {
                icon: <Sparkles size={16} />,
                title: 'Animations',
                subtitle: 'Top bar aur splash screen effects configure karo',
                desc: 'App mein visual effects on/off karo. Available effects: ❄️ Snow (snowflakes), 🎆 Fireworks, 🎊 Confetti. Effect ka color aur intensity adjust karo. Splash screen (loading screen) pe bhi effect dikhega. Special occasions pe festive effects on karo.',
                color: 'violet',
                tags: ['Snow Effect', 'Fireworks', 'Confetti', 'Festive'],
                tip: 'Diwali pe fireworks, 15 August pe confetti — students ko accha laga!',
                warning: 'Super Admin only.'
            },
            {
                icon: <Monitor size={16} />,
                title: 'General Settings',
                subtitle: 'App ka naam, contact info aur footer configure karo',
                desc: 'App ka naam (splash screen pe dikhne wala), version number, short name. Admin WhatsApp number (contact button pe). Official email address. Website link. Footer text ("Developed by...") toggle karo. Yahan changes karne par poori app ka identity badal jaata hai.',
                color: 'blue',
                tags: ['App Name', 'WhatsApp', 'Email', 'Website', 'Footer'],
                warning: 'App name change karne se splash screen pe turant change dikhega.'
            },
            {
                icon: <Shield size={16} />,
                title: 'Security',
                subtitle: 'One-device login aur access control',
                desc: 'One-Device Login toggle: On karne par ek account ek hi device pe chal sakta hai. Student Logout capability: Students logout kar sakte hain ya nahi. Force logout: Admin kisi bhi student ko remotely logout kar sakta hai. API keys secure storage yahan hoti hai.',
                color: 'red',
                tags: ['One Device', 'Force Logout', 'API Keys', 'Access Control'],
                warning: 'One Device Login on karne par students dusre device pe login nahi kar paenge — pehle soch lein.'
            },
            {
                icon: <Eye size={16} />,
                title: 'Visibility & Watermark',
                subtitle: 'Features show/hide karo aur watermark set karo',
                desc: 'Master switches se poori features on/off karo: Notes section hide karo, MCQ section hide karo, Video section hide karo. Watermark text set karo (content pe student ka naam ya custom text dikhega). Kisi feature ko temporarily disable karna ho toh yahan karein.',
                color: 'amber',
                tags: ['Hide Features', 'Watermark', 'Master Toggle', 'Maintenance Mode']
            },
            {
                icon: <Settings size={16} />,
                title: 'Advanced Settings (Power Manager)',
                subtitle: 'Daily limits, pricing matrix aur visibility toggles',
                desc: 'Yeh sabse powerful settings section hai. 6 sub-tabs hain: 💰 Pricing — subscription plan pricing. 🎯 Daily Limits — MCQ, Notes, Video, PDF limits per plan. 👁️ Visibility — features show/hide. 📍 Top Bar — top bar buttons show/hide. 🗂️ Bottom Nav — bottom navigation tabs. 🏠 Home Grid — home page sections on/off.',
                color: 'slate',
                tags: ['Pricing', 'Daily Limits', 'Visibility', 'Navigation', 'Home Grid'],
                tip: 'Niche Power Manager ke 6 sub-tabs ki detailed explanation bhi padho!'
            },
            {
                icon: <PenTool size={16} />,
                title: 'Blogger Hub',
                subtitle: 'Custom blog aur external links manage karo',
                desc: 'Agar aapka ek separate blog ya website hai — usse app se link karo. Students ko Blogger Hub section se redirect kar sakte ho aapke blog pe. External app links (YouTube channel, Telegram, WhatsApp group) yahan add karo.',
                color: 'orange',
                tags: ['Blog Link', 'External Apps', 'Telegram', 'YouTube'],
                warning: 'Super Admin only.'
            },
            {
                icon: <Bot size={16} />,
                title: 'AI Configuration',
                subtitle: 'AI model select karo aur API keys manage karo',
                desc: 'AI features ke liye yahan configuration hoti hai: AI Model choose karo (Llama 3.1 8B — fast, Llama 3.1 70B — smart, Mixtral — balanced). Groq API keys add karo (multiple keys add kar sakte ho for load balancing). Gemini API key as fallback. API key test karo — "Test Keys" button se check karo sab kaam kar rahe hain ya nahi. AI Chat feature on/off karo.',
                color: 'teal',
                tags: ['Groq API', 'Gemini', 'Model Selection', 'Test Keys', 'AI Toggle'],
                tip: 'Multiple Groq API keys add karo — agar ek rate-limited ho jaye toh dusri automatically use hogi.'
            },
        ]
    },
    {
        id: 'ADVANCED',
        groupTitle: 'Advanced / Other Sections',
        groupIcon: <Settings size={18} />,
        groupColor: 'slate',
        groupDesc: 'Database, events, payment aur codes manage karo',
        items: [
            {
                icon: <Calendar size={16} />,
                title: 'Event Manager',
                subtitle: 'Special discount events aur countdown configure karo',
                desc: 'Store pe special event (jaise Diwali Sale, Board Exam Offer) activate karo. Event ka naam, discount percentage (jaise 30% off), start time aur end time set karo. Store pe countdown timer automatically dikhega. Event active hote hi saare plans pe discount lag jaata hai.',
                color: 'rose',
                tags: ['Discount', 'Countdown', 'Sale Event', 'Store Pricing'],
                tip: 'Exam season mein 20-30% discount event activate karo — conversions badh jaate hain!'
            },
            {
                icon: <Hash size={16} />,
                title: 'Codes',
                subtitle: 'Gift codes aur teacher codes generate karo',
                desc: 'Yahan se redeemable codes generate karo: 🎁 Gift Codes — students kisi bhi redeem page pe enter karke coins ya subscription pa sakte hain. 👩‍🏫 Teacher Codes — teachers ko special access dene ke liye. Content Unlock Codes — kisi specific notes/video ko unlock karne ke liye limited-time code. Code ka maximum uses aur expiry time set karo.',
                color: 'teal',
                tags: ['Gift Code', 'Teacher Code', 'Redeem', 'Expiry', 'Max Uses'],
                tip: 'Giveaway ke liye bulk codes generate karo — har code ek baar hi use ho sakta hai.'
            },
            {
                icon: <Bell size={16} />,
                title: 'Notices',
                subtitle: 'Home page notice bar configure karo',
                desc: 'Students ke Home page pe ek notice bar dikhta hai. Uska text yahan se change karo. Jaise: "Board exam 15 March se start" ya "New batch joining open hai". Notice bar enable/disable bhi kar sakte ho.',
                color: 'yellow',
                tags: ['Notice Bar', 'Home Page Text', 'Announcement']
            },
            {
                icon: <Globe size={16} />,
                title: 'Database (Firebase)',
                subtitle: 'Direct Firebase data view/edit karo',
                desc: 'Yeh ek advanced tool hai — seedha Firebase Realtime Database aur Firestore ka data dekh aur edit kar sakte ho. Technical errors debug karne ke liye useful. Kisi specific user ya content ka raw data check karna ho toh yahan aao.',
                color: 'slate',
                tags: ['Firebase', 'Realtime DB', 'Firestore', 'Raw Data', 'Debug'],
                warning: '⚠️ Directly data edit karne se app crash ho sakta hai. Sirf tab use karo jab aap sure ho.'
            },
        ]
    },
    {
        id: 'POWER_MANAGER',
        groupTitle: 'Power Manager — 6 Sub-Tabs Detail',
        groupIcon: <Settings size={18} />,
        groupColor: 'violet',
        groupDesc: '"Advanced Settings" button ke andar 6 sub-tabs hain — har ek ka kaam yahan samjhein',
        items: [
            {
                icon: <DollarSign size={16} />,
                title: '💰 Pricing Tab',
                subtitle: 'Subscription plans ki actual price set karo',
                desc: 'Basic aur Ultra subscription ke liye monthly, quarterly aur yearly pricing set karo (₹ mein). Coin packages ki pricing (kitne coins = kitne rupees). Yeh price Store page pe students ko dikhti hai. Changes Save karne ke baad turant Store pe reflect hota hai.',
                color: 'emerald',
                tags: ['Basic Price', 'Ultra Price', 'Monthly', 'Yearly', 'Coin Packages']
            },
            {
                icon: <AlertCircle size={16} />,
                title: '🎯 Daily Limits Tab',
                subtitle: 'Har plan ke liye daily usage limits set karo',
                desc: 'FREE USER: Coins deke content unlock karta hai. BASIC USER: X free views per day, phir coins. ULTRA USER: Zyada free views, ya unlimited. Yahan control karo: Write Mode (HTML Notes) — Basic ko 5/day, Ultra ko 10/day. MCQ Practice — Free 50/day, Basic 70/day, Ultra 100/day. HTML Downloads — plan-wise daily download limit. Video Lectures — Basic aur Ultra ke liye free videos/day. PDF Access — Basic aur Ultra ke liye free PDFs/day.',
                color: 'amber',
                tags: ['MCQ Limit', 'HTML Notes Limit', 'Video Limit', 'PDF Limit', 'Credit Cost'],
                tip: 'Limits thodi kam rakho toh students upgrade karne ke liye motivated rehte hain.'
            },
            {
                icon: <Eye size={16} />,
                title: '👁️ Visibility Tab',
                subtitle: 'Bottom nav aur features toggle karo (Power Manager ke andar)',
                desc: 'Revision Hub, App Store, aur doosre major tabs ko show/hide karo. Yahan se specific features temporarily disable kar sakte ho. Maintenance mode ya feature rollout ke waqt useful.',
                color: 'blue',
                tags: ['Feature Toggle', 'Tab Visibility', 'Maintenance']
            },
            {
                icon: <Zap size={16} />,
                title: '📍 Top Bar Tab',
                subtitle: 'Top bar buttons show/hide karo',
                desc: 'Students ke screen ke upar jo buttons dikhte hain unhe control karo: Language toggle button (Hindi/English switch). Coin/Credits display. Sale banner. Search button. Notification bell. Koi bhi button hide karo agar chahte ho screen clean rakhna.',
                color: 'sky',
                tags: ['Language Button', 'Credits Button', 'Search', 'Notifications', 'Sale Badge']
            },
            {
                icon: <Navigation2 size={16} />,
                title: '🗂️ Bottom Nav Tab',
                subtitle: 'Bottom navigation ke tabs control karo',
                desc: 'Students ke screen ke neeche 4-5 navigation tabs hote hain. Yahan decide karo kaunse tabs dikhenge: Home, Study, MCQ, Store, Profile, Chat, Revision, etc. Tab ki order bhi yahan set hoti hai. Zyada tabs na rakhein — 4-5 max best experience dete hain.',
                color: 'indigo',
                tags: ['Home Tab', 'Study Tab', 'MCQ Tab', 'Profile Tab', 'Tab Order'],
                tip: 'Sirf woh tabs rakhein jo students regularly use karte hain — confusion kam hogi.'
            },
            {
                icon: <LayoutGrid size={16} />,
                title: '🏠 Home Grid Tab',
                subtitle: 'Home page ke sections on/off karo',
                desc: 'Home page pe kai sections hote hain: Notice Bar (announcement text). Promo Banners (sliding images). Quick Action Buttons (Start Study, MCQ, etc.). Trending Notes section. Daily GK card. Homework reminder. Har section ko alag se on/off karo apni zaroorat ke hisaab se.',
                color: 'teal',
                tags: ['Notice Bar', 'Promo Banners', 'Quick Actions', 'Trending Notes', 'Daily GK']
            },
        ]
    },
];

const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    teal: 'bg-teal-50 border-teal-200 text-teal-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
    pink: 'bg-pink-50 border-pink-200 text-pink-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
};

const groupHeaderMap: Record<string, string> = {
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    purple: 'bg-purple-600',
    emerald: 'bg-emerald-600',
    teal: 'bg-teal-600',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    orange: 'bg-orange-500',
    red: 'bg-red-600',
    rose: 'bg-rose-500',
    pink: 'bg-pink-500',
    violet: 'bg-violet-600',
    yellow: 'bg-yellow-500',
    slate: 'bg-slate-600',
};

const AdminHelp: React.FC = () => {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [expanded, setExpanded] = useState<Set<string>>(new Set(['TOP_BUTTONS', 'CORE']));
    const [selectedItem, setSelectedItem] = useState<{ sectionId: string; itemIndex: number } | null>(null);

    const toggle = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const q = debouncedSearch.toLowerCase().trim();

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

    return (
        <div className="max-w-3xl mx-auto pb-20">
            {/* HEADER */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 mb-5 text-white shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <Info size={22} />
                    </div>
                    <div>
                        <h1 className="text-lg font-black">Admin Help Guide</h1>
                        <p className="text-indigo-200 text-[11px]">Har button ka kaam — full details mein</p>
                    </div>
                </div>
                <p className="text-indigo-100 text-[12px] leading-relaxed">
                    Admin dashboard ke <strong>saare sections, tabs aur buttons</strong> ka poora explanation yahan milega.
                    Kuch bhi samajh na aaye — yahan dhundho.
                </p>
            </div>

            {/* SEARCH */}
            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Koi bhi button ya feature search karo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-medium"
                />
                {q && (
                    <button onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                        ✕ Clear
                    </button>
                )}
            </div>

            {/* TOTAL COUNT */}
            {q && (
                <p className="text-xs text-slate-500 mb-3 px-1">
                    🔍 "{search}" ke liye {filteredSections.reduce((acc, s) => acc + s.items.length, 0)} results mile
                </p>
            )}

            {/* SECTIONS */}
            <div className="space-y-3">
                {filteredSections.map(section => {
                    const isOpen = expanded.has(section.id) || !!q;
                    return (
                        <div key={section.id} className="rounded-2xl overflow-hidden border border-slate-100 shadow-sm bg-white">
                            {/* Group Header */}
                            <button
                                onClick={() => toggle(section.id)}
                                className={`w-full flex items-center justify-between px-4 py-3 ${groupHeaderMap[section.groupColor]} text-white`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                                        {section.groupIcon}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-sm">{section.groupTitle}</p>
                                        <p className="text-white/70 text-[10px]">{section.groupDesc}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {section.items.length}
                                    </span>
                                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                            </button>

                            {/* Items */}
                            {isOpen && (
                                <div className="divide-y divide-slate-50">
                                    {section.items.map((item, idx) => {
                                        const isSelected = selectedItem?.sectionId === section.id && selectedItem.itemIndex === idx;
                                        const cardColor = colorMap[item.color] || colorMap['slate'];
                                        return (
                                            <div key={idx}
                                                className={`transition-all ${isSelected ? 'bg-slate-50' : 'bg-white hover:bg-slate-50/60'}`}>
                                                {/* Item Header */}
                                                <button
                                                    onClick={() => setSelectedItem(isSelected ? null : { sectionId: section.id, itemIndex: idx })}
                                                    className="w-full text-left px-4 py-3.5 flex items-start gap-3"
                                                >
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cardColor}`}>
                                                        {item.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <p className="font-black text-sm text-slate-800">{item.title}</p>
                                                            {item.warning && (
                                                                <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">⚠️ Caution</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">{item.subtitle}</p>
                                                        {/* Tags */}
                                                        {item.tags && (
                                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                                {item.tags.map(tag => (
                                                                    <span key={tag} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                                                                        {tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 text-slate-300 mt-1">
                                                        {isSelected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </div>
                                                </button>

                                                {/* Expanded Detail */}
                                                {isSelected && (
                                                    <div className="px-4 pb-4 space-y-2.5">
                                                        {/* Main description */}
                                                        <div className={`rounded-xl p-3.5 border ${cardColor}`}>
                                                            <p className="text-[10px] font-black uppercase tracking-wide mb-1.5 opacity-70">📋 Yeh kya karta hai</p>
                                                            <p className="text-[12px] leading-relaxed font-medium text-slate-700">{item.desc}</p>
                                                        </div>

                                                        {/* Warning */}
                                                        {item.warning && (
                                                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                                                <p className="text-[11px] text-red-700 font-bold leading-relaxed">{item.warning}</p>
                                                            </div>
                                                        )}

                                                        {/* Tip */}
                                                        {item.tip && (
                                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                                                <p className="text-[10px] font-black text-emerald-700 uppercase mb-1">💡 Pro Tip</p>
                                                                <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">{item.tip}</p>
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
            </div>

            {/* Footer */}
            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-[11px] text-slate-500 font-medium">
                    💾 <strong>Yaad rahe:</strong> Har change ke baad upar <strong>"Save Settings"</strong> button zaroor dabao.
                    Bina save kiye changes kho jaate hain.
                </p>
            </div>
        </div>
    );
};

export default AdminHelp;
