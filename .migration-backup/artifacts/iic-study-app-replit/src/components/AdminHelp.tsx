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
        groupDesc: 'The 3 buttons at the top of the admin dashboard — understand what each does',
        items: [
            {
                icon: <Moon size={16} />,
                title: 'Light / Black / Blue (Theme)',
                subtitle: 'Dark Mode Toggle',
                desc: 'This button changes the admin dashboard theme. Click once → Black Dark Mode. Click again → Blue Dark Mode. Third click → Back to Light Mode. Only visible to admin — no effect on students.',
                color: 'slate',
                tip: 'Use Black or Blue mode for late-night work — less eye strain.'
            },
            {
                icon: <RefreshCw size={16} />,
                title: 'Force Update',
                subtitle: 'Force reload the app for all students',
                desc: 'Pressing this button sends a force-reload command to all students\' devices. Use it when new content or settings have been updated and you want students to see the changes immediately. Asks for confirmation first.',
                color: 'red',
                warning: '⚠️ All users\' apps will reload immediately — any ongoing work (MCQ attempt, notes reading) will be interrupted. Use only when necessary.'
            },
            {
                icon: <Save size={16} />,
                title: 'Save Settings',
                subtitle: 'Save all changes to Firebase',
                desc: 'This is the most important button in the admin dashboard. Whenever you change any setting — pricing, limits, visibility, text, anything — you must press Save Settings. If you leave the page without saving, all changes will be lost.',
                color: 'indigo',
                warning: '⚠️ Don\'t forget to Save after every change! The button shows "Saving..." while saving — don\'t do anything else at that time.'
            },
        ]
    },
    {
        id: 'CORE',
        groupTitle: 'Core Management',
        groupIcon: <Users size={18} />,
        groupColor: 'blue',
        groupDesc: 'Manage users, subscriptions, store and subjects',
        items: [
            {
                icon: <Users size={16} />,
                title: 'Users',
                subtitle: 'Database of all students',
                desc: 'This section lists all registered students. Search any student by name or UID. View student name, email, and subscription plan. Manually change subscription (Free → Basic → Ultra). Add/remove credits. Block/unblock student accounts. Impersonate a student (view from their account) for debugging.',
                color: 'blue',
                tags: ['Students', 'Search', 'Edit', 'Subscription', 'Credits'],
                tip: 'A student paid but plan didn\'t update → manually update it here.'
            },
            {
                icon: <ShieldCheck size={16} />,
                title: 'Sub-Admins',
                subtitle: 'Create and manage helper admins',
                desc: 'If you want to give a teacher or helper limited admin access — create their Sub-Admin account here. Give each Sub-Admin specific permissions: content upload, view users, handle demands, etc. Main Admin has all permissions; Sub-Admins only have what you grant.',
                color: 'indigo',
                tags: ['Permissions', 'Teacher Access', 'Limited Admin'],
                tip: 'Give a teacher only Homework and Content upload access — not Store or Users.'
            },
            {
                icon: <GraduationCap size={16} />,
                title: 'Teachers',
                subtitle: 'Manage teacher accounts',
                desc: 'A dedicated section for teacher-specific features. Teachers can lock students (teacher lock feature), assign homework, and track students in their class.',
                color: 'purple',
                tags: ['Teacher Lock', 'Class Management']
            },
            {
                icon: <CreditCard size={16} />,
                title: 'Subscriptions',
                subtitle: 'Overview of active subscriptions and plans',
                desc: 'Lists all active subscriptions. See which students have Basic and which have Ultra. Manually change any plan. View subscription history. Track plans that are about to expire.',
                color: 'purple',
                tags: ['Basic Plan', 'Ultra Plan', 'Expiry', 'Manual Upgrade']
            },
            {
                icon: <Book size={16} />,
                title: 'Subjects',
                subtitle: 'Change subject names, icons and colors',
                desc: 'Change the name, icon and color of subjects shown in the app (Physics, Chemistry, History, etc.). Add a new subject or remove an old one. Set the syllabus mode (School or Competition) for each subject.',
                color: 'emerald',
                tags: ['Subject List', 'Icons', 'Colors', 'Add/Remove']
            },
            {
                icon: <ShoppingBag size={16} />,
                title: 'Store Manager',
                subtitle: 'Configure the coin store and subscription packages',
                desc: 'Configure what students see on the Store page. Set coin package prices (how many coins for how much money). Decide subscription plan pricing. Activate a special discount event with a countdown timer. Configure coin exchange rates.',
                color: 'purple',
                tags: ['Coins', 'Plans', 'Pricing', 'Discount Event'],
                tip: 'Activate a special discount event during Diwali or exam season — a countdown timer will appear in the Store.'
            },
        ]
    },
    {
        id: 'REQUESTS',
        groupTitle: 'User Requests',
        groupIcon: <Inbox size={18} />,
        groupColor: 'indigo',
        groupDesc: 'Handle student messages, demands and login requests',
        items: [
            {
                icon: <Megaphone size={16} />,
                title: 'Notify Users',
                subtitle: 'Send a notification to all students',
                desc: 'Use this feature to send an in-app notification to all students at once. Write a title and message. Optionally add an image or link. The notification appears in every student\'s "Notifications" tab. Useful for: exam alerts, new content announcements, holiday notices, etc.',
                color: 'pink',
                tags: ['Broadcast', 'Alert', 'Announcement'],
                tip: 'Send exam schedules, new content notices, or maintenance alerts from here.'
            },
            {
                icon: <Megaphone size={16} />,
                title: 'Demands',
                subtitle: 'View student content requests',
                desc: 'When a student requests a specific topic or content — it appears here as a demand. View pending demands. Mark demands as completed. Use popular demand counts to understand what content is most needed.',
                color: 'orange',
                tags: ['Content Requests', 'Pending', 'Student Feedback']
            },
            {
                icon: <MessageSquare size={16} />,
                title: 'Chat Hub',
                subtitle: 'Moderate global chat and student support',
                desc: 'Two sections: Global Chat (community chat for all students) and Support Chat (individual student messages to admin). Delete abusive messages in Global Chat. Answer student questions in Support. MCQ Community is also moderatable here.',
                color: 'blue',
                tags: ['Moderation', 'Global Chat', 'Support', 'Delete Messages'],
                tip: 'Each student\'s conversation in Support Chat is a separate thread — stays organized.'
            },
            {
                icon: <Key size={16} />,
                title: 'Login Requests',
                subtitle: 'Approve or reject new login requests',
                desc: 'If "One Device Login" or approval-based login is on — new students will be pending here. Admin must manually approve them. After approval, the student can log in. Rejected students won\'t get access. Useful for security — no one can access without permission.',
                color: 'purple',
                tags: ['Approval', 'Security', 'Access Control'],
                warning: 'If there are many pending requests, students can\'t log in — approve them quickly.'
            },
        ]
    },
    {
        id: 'CONTENT',
        groupTitle: 'Content & Analysis',
        groupIcon: <BarChart3 size={18} />,
        groupColor: 'purple',
        groupDesc: 'Manage notes, videos, audio, MCQs, homework and syllabus',
        items: [
            {
                icon: <FileText size={16} />,
                title: 'Main Notes (PDF)',
                subtitle: 'Upload chapter-wise notes',
                desc: 'Upload PDF or HTML notes for each chapter of every subject. Upload Free Notes (for everyone) and Premium Notes (for Basic/Ultra) separately. School Mode and Competition Mode notes are separate. Generate notes with AI. Save notes as draft — preview before publishing.',
                color: 'blue',
                tags: ['PDF Links', 'HTML Notes', 'Free Notes', 'Premium Notes', 'AI Generate', 'Draft'],
                tip: 'Save as draft first — preview once — then publish. Reduces the chance of mistakes.'
            },
            {
                icon: <Video size={16} />,
                title: 'Video Lectures',
                subtitle: 'Link YouTube/Google Drive videos',
                desc: 'Link a video lecture for each chapter. Free and Premium videos are separate. Set a credit cost for videos (how many coins students pay to watch). School and Competition mode videos are separate.',
                color: 'red',
                tags: ['YouTube Links', 'Google Drive', 'Credit Cost', 'Free/Premium']
            },
            {
                icon: <Headphones size={16} />,
                title: 'Audio Series',
                subtitle: 'Manage audio lectures and audio notes',
                desc: 'Audio format content — students can listen and learn. Add an audio file link for each chapter. Useful for students who prefer listening to notes or for visually impaired students.',
                color: 'pink',
                tags: ['Audio Links', 'TTS', 'Accessibility']
            },
            {
                icon: <ClipboardList size={16} />,
                title: 'Homework',
                subtitle: 'Assign daily homework to students',
                desc: 'Teachers or admins can assign daily homework to students. Send specific chapter content (notes, video, MCQ) as homework. It appears in students\' Homework tab. Set a deadline. Track Completed/Pending status.',
                color: 'indigo',
                tags: ['Assign', 'Deadline', 'Track', 'Content Link'],
                tip: 'Assigning homework keeps students disciplined — they get a daily reminder.'
            },
            {
                icon: <BookMarked size={16} />,
                title: 'Book Notes',
                subtitle: 'Page-by-page notes for books like Lucent and NCERT',
                desc: 'A special feature where you can upload page-by-page or chapter-by-chapter notes for a book (like Lucent GK). Students can read in a clean "Lucent Reader" edge-to-edge experience.',
                color: 'amber',
                tags: ['Lucent', 'Book Pages', 'Competition', 'Reader Mode']
            },
            {
                icon: <Book size={16} />,
                title: 'Daily GK',
                subtitle: 'Add new GK content every day',
                desc: 'Add a new GK (General Knowledge) question or article every day. Students see the daily GK on the Home screen. Current affairs, important events, facts — all managed here.',
                color: 'teal',
                tags: ['Current Affairs', 'Daily Update', 'GK Facts']
            },
            {
                icon: <TrendingUp size={16} />,
                title: 'Trending Notes',
                subtitle: 'Feature trending/important notes on the Home page',
                desc: 'Mark certain notes as "Trending" — they appear prominently on the Home page. Highlight important topics near exam time. Students can click trending notes directly to read them.',
                color: 'amber',
                tags: ['Featured', 'Home Page', 'Important Topics', 'Exam Ready']
            },
            {
                icon: <ListChecks size={16} />,
                title: 'Syllabus Manager',
                subtitle: 'Configure board, class and stream syllabus',
                desc: 'The app has School Mode and Competition Mode. In this section you set the syllabus for each class (6th–12th). Define subjects for each stream (Science, Commerce, Arts). Configure chapters for CBSE and BSEB boards. Switch between School and Competition mode.',
                color: 'indigo',
                tags: ['CBSE', 'BSEB', 'Class 6-12', 'Stream', 'Chapters'],
                warning: 'Super Admin only — Syllabus changes affect the entire navigation structure for students.'
            },
            {
                icon: <PlaySquare size={16} />,
                title: 'Universal Playlist',
                subtitle: 'Create a universal video playlist not tied to any subject',
                desc: 'Some videos don\'t belong to a specific subject — like motivational lectures or general tips. Add them to the Universal Playlist. Students can access them via direct link or from the home screen.',
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
        groupDesc: 'Configure games, rewards, prizes and challenges',
        items: [
            {
                icon: <Gamepad2 size={16} />,
                title: 'Game Config',
                subtitle: 'Set up the Spin Wheel game',
                desc: 'Students play the Spin Wheel to earn coins. Configure it here: Spin cost (how many coins per spin), Possible rewards (coin amounts), Probability of each reward, Win/Lose ratio.',
                color: 'orange',
                tags: ['Spin Wheel', 'Rewards', 'Probability', 'Coin Cost'],
                tip: 'To keep students more engaged, make rewards and probabilities attractive.'
            },
            {
                icon: <Gift size={16} />,
                title: 'Engagement Rewards',
                subtitle: 'Set daily login bonus and engagement rewards',
                desc: 'Students get a bonus for opening the app every day. Set how many coins they earn per daily login, the streak bonus (7 consecutive days), referral bonus, and task-completion rewards. These settings keep students motivated to use the app daily.',
                color: 'rose',
                tags: ['Daily Bonus', 'Streak', 'Referral', 'Login Reward']
            },
            {
                icon: <Trophy size={16} />,
                title: 'Prize Settings',
                subtitle: 'Configure competition prizes',
                desc: 'Set prizes for leaderboard or challenge winners. Define prize description, image and value. Set different prizes for top 3 or top 10. Physical prizes (gift vouchers, books) or digital prizes (coins, subscription).',
                color: 'yellow',
                tags: ['Leaderboard Prize', 'Winners', 'Challenge Reward']
            },
            {
                icon: <Trophy size={16} />,
                title: 'Challenge Config',
                subtitle: 'Basic setup for daily/weekly challenges',
                desc: 'General configuration for the challenge feature — how long to complete a challenge, challenge rewards, difficulty level. (Basic settings; use Challenge 2.0 for detailed challenge creation.)',
                color: 'red',
                tags: ['Challenge Rules', 'Time Limit', 'Difficulty']
            },
            {
                icon: <Rocket size={16} />,
                title: 'Challenge 2.0',
                subtitle: 'Advanced challenge creator — build detailed MCQ challenges',
                desc: 'A powerful tool to create custom MCQ-based challenges. Choose subject, topic, difficulty and time limit. Students compete on the leaderboard. Schedule weekly or daily challenges. Winners are automatically detected.',
                color: 'violet',
                tags: ['MCQ Challenge', 'Leaderboard', 'Schedule', 'Custom Questions'],
                tip: 'Create a mock challenge before exams — students get both practice and competition!'
            },
        ]
    },
    {
        id: 'NSTA_CONTROL',
        groupTitle: 'NSTA Control',
        groupIcon: <Sliders size={18} />,
        groupColor: 'violet',
        groupDesc: 'Core app identity, animations and advanced power settings',
        items: [
            {
                icon: <Sparkles size={16} />,
                title: 'Animations',
                subtitle: 'Configure top bar and splash screen effects',
                desc: 'Turn visual effects on/off in the app. Available effects: ❄️ Snow (snowflakes), 🎆 Fireworks, 🎊 Confetti. Adjust effect color and intensity. Effects also appear on the splash screen (loading screen). Turn on festive effects for special occasions.',
                color: 'violet',
                tags: ['Snow Effect', 'Fireworks', 'Confetti', 'Festive'],
                tip: 'Fireworks on Diwali, confetti on Independence Day — students love it!',
                warning: 'Super Admin only.'
            },
            {
                icon: <Monitor size={16} />,
                title: 'General Settings',
                subtitle: 'Configure app name, contact info and footer',
                desc: 'App name (shown on splash screen), version number, short name. Admin WhatsApp number (for the contact button). Official email address. Website link. Toggle footer text ("Developed by..."). Changes here affect the entire app identity.',
                color: 'blue',
                tags: ['App Name', 'WhatsApp', 'Email', 'Website', 'Footer'],
                warning: 'Changing the app name will immediately reflect on the splash screen.'
            },
            {
                icon: <Shield size={16} />,
                title: 'Security',
                subtitle: 'One-device login and access control',
                desc: 'One-Device Login toggle: When on, one account can only run on one device. Student Logout: Whether students can log out or not. Force logout: Admin can remotely log out any student. Secure API key storage is also here.',
                color: 'red',
                tags: ['One Device', 'Force Logout', 'API Keys', 'Access Control'],
                warning: 'Turning on One Device Login means students can\'t log in from another device — think before enabling.'
            },
            {
                icon: <Eye size={16} />,
                title: 'Visibility & Watermark',
                subtitle: 'Show/hide features and set watermark',
                desc: 'Use master switches to turn entire features on/off: hide the Notes section, MCQ section, Video section. Set watermark text (the student\'s name or custom text will appear on content). Use this to temporarily disable a feature.',
                color: 'amber',
                tags: ['Hide Features', 'Watermark', 'Master Toggle', 'Maintenance Mode']
            },
            {
                icon: <Settings size={16} />,
                title: 'Advanced Settings (Power Manager)',
                subtitle: 'Daily limits, pricing matrix and visibility toggles',
                desc: 'The most powerful settings section. 6 sub-tabs: 💰 Pricing — subscription plan pricing. 🎯 Daily Limits — MCQ, Notes, Video, PDF limits per plan. 👁️ Visibility — show/hide features. 📍 Top Bar — show/hide top bar buttons. 🗂️ Bottom Nav — bottom navigation tabs. 🏠 Home Grid — home page sections on/off.',
                color: 'slate',
                tags: ['Pricing', 'Daily Limits', 'Visibility', 'Navigation', 'Home Grid'],
                tip: 'Also read the detailed explanation of the 6 Power Manager sub-tabs below!'
            },
            {
                icon: <PenTool size={16} />,
                title: 'Blogger Hub',
                subtitle: 'Manage custom blog and external links',
                desc: 'If you have a separate blog or website — link it to the app. Redirect students from the Blogger Hub section to your blog. Add external app links (YouTube channel, Telegram, WhatsApp group) here.',
                color: 'orange',
                tags: ['Blog Link', 'External Apps', 'Telegram', 'YouTube'],
                warning: 'Super Admin only.'
            },
            {
                icon: <Bot size={16} />,
                title: 'AI Configuration',
                subtitle: 'Select AI model and manage API keys',
                desc: 'Configuration for AI features: Choose AI model (Llama 3.1 8B — fast, Llama 3.1 70B — smart, Mixtral — balanced). Add Groq API keys (add multiple keys for load balancing). Gemini API key as fallback. Test API keys — use the "Test Keys" button to check everything is working. Toggle AI Chat on/off.',
                color: 'teal',
                tags: ['Groq API', 'Gemini', 'Model Selection', 'Test Keys', 'AI Toggle'],
                tip: 'Add multiple Groq API keys — if one gets rate-limited, the next one is used automatically.'
            },
        ]
    },
    {
        id: 'ADVANCED',
        groupTitle: 'Advanced / Other Sections',
        groupIcon: <Settings size={18} />,
        groupColor: 'slate',
        groupDesc: 'Manage database, events, payments and codes',
        items: [
            {
                icon: <Calendar size={16} />,
                title: 'Event Manager',
                subtitle: 'Configure special discount events and countdown',
                desc: 'Activate a special event on the Store (e.g. Diwali Sale, Board Exam Offer). Set the event name, discount percentage (e.g. 30% off), start time and end time. A countdown timer automatically appears in the Store. As soon as the event is active, the discount applies to all plans.',
                color: 'rose',
                tags: ['Discount', 'Countdown', 'Sale Event', 'Store Pricing'],
                tip: 'Activate a 20–30% discount event during exam season — conversions go up!'
            },
            {
                icon: <Hash size={16} />,
                title: 'Codes',
                subtitle: 'Generate gift codes and teacher codes',
                desc: 'Generate redeemable codes here: 🎁 Gift Codes — students enter on any redeem page to get coins or a subscription. 👩‍🏫 Teacher Codes — give teachers special access. Content Unlock Codes — limited-time code to unlock specific notes or videos. Set maximum uses and expiry time for each code.',
                color: 'teal',
                tags: ['Gift Code', 'Teacher Code', 'Redeem', 'Expiry', 'Max Uses'],
                tip: 'Generate bulk codes for giveaways — each code can only be used once.'
            },
            {
                icon: <Bell size={16} />,
                title: 'Notices',
                subtitle: 'Configure the Home page notice bar',
                desc: 'A notice bar is shown on students\' Home page. Change its text here. For example: "Board exam starts 15 March" or "New batch registration is open". You can also enable/disable the notice bar.',
                color: 'yellow',
                tags: ['Notice Bar', 'Home Page Text', 'Announcement']
            },
            {
                icon: <Globe size={16} />,
                title: 'Database (Firebase)',
                subtitle: 'View/edit Firebase data directly',
                desc: 'An advanced tool — view and edit data directly in Firebase Realtime Database and Firestore. Useful for debugging technical errors. Use this when you need to check the raw data of a specific user or content.',
                color: 'slate',
                tags: ['Firebase', 'Realtime DB', 'Firestore', 'Raw Data', 'Debug'],
                warning: '⚠️ Directly editing data can crash the app. Only use this when you are certain.'
            },
        ]
    },
    {
        id: 'POWER_MANAGER',
        groupTitle: 'Power Manager — 6 Sub-Tabs Detail',
        groupIcon: <Settings size={18} />,
        groupColor: 'violet',
        groupDesc: 'Inside the "Advanced Settings" button are 6 sub-tabs — understand what each one does',
        items: [
            {
                icon: <DollarSign size={16} />,
                title: '💰 Pricing Tab',
                subtitle: 'Set the actual price for subscription plans',
                desc: 'Set monthly, quarterly and yearly pricing (in ₹) for Basic and Ultra subscriptions. Set coin package pricing (how many coins = how much money). These prices are shown to students on the Store page. Changes reflect on the Store immediately after saving.',
                color: 'emerald',
                tags: ['Basic Price', 'Ultra Price', 'Monthly', 'Yearly', 'Coin Packages']
            },
            {
                icon: <AlertCircle size={16} />,
                title: '🎯 Daily Limits Tab',
                subtitle: 'Set daily usage limits for each plan',
                desc: 'FREE USER: Unlocks content by spending coins. BASIC USER: X free views per day, then coins. ULTRA USER: More free views, or unlimited. Control here: Write Mode (HTML Notes) — Basic 5/day, Ultra 10/day. MCQ Practice — Free 50/day, Basic 70/day, Ultra 100/day. HTML Downloads — daily download limit per plan. Video Lectures — free videos/day for Basic and Ultra. PDF Access — free PDFs/day for Basic and Ultra.',
                color: 'amber',
                tags: ['MCQ Limit', 'HTML Notes Limit', 'Video Limit', 'PDF Limit', 'Credit Cost'],
                tip: 'Keep limits a bit lower to motivate students to upgrade.'
            },
            {
                icon: <Eye size={16} />,
                title: '👁️ Visibility Tab',
                subtitle: 'Toggle bottom nav and features (inside Power Manager)',
                desc: 'Show/hide major tabs like Revision Hub and App Store. Temporarily disable specific features from here. Useful during maintenance mode or feature rollout.',
                color: 'blue',
                tags: ['Feature Toggle', 'Tab Visibility', 'Maintenance']
            },
            {
                icon: <Zap size={16} />,
                title: '📍 Top Bar Tab',
                subtitle: 'Show/hide top bar buttons',
                desc: 'Control the buttons shown at the top of students\' screens: Language toggle button (Hindi/English switch), Coin/Credits display, Sale banner, Search button, Notification bell. Hide any button to keep the screen clean.',
                color: 'sky',
                tags: ['Language Button', 'Credits Button', 'Search', 'Notifications', 'Sale Badge']
            },
            {
                icon: <Navigation2 size={16} />,
                title: '🗂️ Bottom Nav Tab',
                subtitle: 'Control bottom navigation tabs',
                desc: 'Students have 4–5 navigation tabs at the bottom of their screen. Decide which tabs to show: Home, Study, MCQ, Store, Profile, Chat, Revision, etc. Tab order is also set here. Don\'t add too many tabs — 4–5 max gives the best experience.',
                color: 'indigo',
                tags: ['Home Tab', 'Study Tab', 'MCQ Tab', 'Profile Tab', 'Tab Order'],
                tip: 'Only keep tabs that students use regularly — reduces confusion.'
            },
            {
                icon: <LayoutGrid size={16} />,
                title: '🏠 Home Grid Tab',
                subtitle: 'Turn Home page sections on/off',
                desc: 'The Home page has several sections: Notice Bar (announcement text), Promo Banners (sliding images), Quick Action Buttons (Start Study, MCQ, etc.), Trending Notes section, Daily GK card, Homework reminder. Turn each section on/off individually as needed.',
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
                        <p className="text-indigo-200 text-[11px]">What every button does — in full detail</p>
                    </div>
                </div>
                <p className="text-indigo-100 text-[12px] leading-relaxed">
                    Full explanation of <strong>all sections, tabs and buttons</strong> in the admin dashboard is here.
                    If you don't understand anything — search for it here.
                </p>
            </div>

            {/* SEARCH */}
            <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search any button or feature..."
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
