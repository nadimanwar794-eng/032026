import { SystemSettings } from '../types';

export const getStudentGuideData = (settings?: SystemSettings) => {
    // Dynamic costs from admin settings
    const costs = {
        video:       settings?.defaultVideoCost ?? 5,
        pdf:         settings?.defaultPdfCost ?? 2,
        mcqTest:     settings?.mcqTestCost ?? 10,
        mcqPractice: settings?.mcqLimitFree ? 'Free (Daily Limit applies)' : 'Free',
        aiChat:      settings?.chatCost ?? 1,
        aiAnalysis:  settings?.mcqAnalysisCost ?? 5,
        aiPlan:      'Free / Subscription',
        game:        settings?.gameCost ?? 0,
        deepDive:    settings?.deepDiveCost ?? 15,
        audioSlide:  settings?.audioSlideCost ?? 10,
    };

    return {
        overview: {
            title: `Welcome to ${settings?.appName || 'IDEAL INSPIRATION CLASSES'}`,
            subtitle: "Your Complete Guide to Smart Learning & AI Tools",
            content: "Welcome to the future of education. This app combines high-quality study materials with advanced AI technology to personalize your learning journey. From interactive Deep Dive notes and offline Smart Marksheets to your NSTA AI Assistant, Daily Challenges, Competition Mode, and Custom Themes — every feature is designed to help you study smarter, track progress, and achieve your goals."
        },
        features: [
            {
                title: "📚 Study Materials & Notes",
                description: "Multiple note types for every learning style.",
                items: [
                    { name: "Quick Revision (Queek)", cost: "Free / Included", details: "Fast-paced summary points and recap cards. Revise chapters in minutes before exams." },
                    { name: "Deep Dive Notes (Write Mode)", cost: `${costs.deepDive} Coins`, details: "AI-generated beautiful styled HTML notes with headings, tables, and color-coded boxes. Dark mode premium feel. Basic: 5 free/day. Ultra: 10 free/day. TTS reading also available." },
                    { name: "Premium Notes (PDF)", cost: `${costs.pdf} Coins`, details: "Expert-crafted PDFs with TTS. Basic/Ultra may get free daily views. Once unlocked, valid for the day." },
                    { name: "Free Notes (PDF)", cost: "Free", details: "Basic chapter notes in PDF format. Full-screen, zoom, rotate. Available to all students." },
                    { name: "Competition Mode (Book Reader)", cost: "Ultra / Limited Free", details: "Lucent GK, NCERT, Speedy, Sar Sangrah — page-by-page structured reader. Competition MCQ sets included. Ultra: unlimited. Free: limited chapters/day." },
                    { name: "Bookmark / Star Notes", cost: "Free", details: "Star important notes for quick access later. Find them in Profile → Starred Notes. Great for last-minute revision." }
                ]
            },
            {
                title: "🎬 Video, Audio & TTS",
                description: "Learn through sight and sound — anytime, anywhere.",
                items: [
                    { name: "Video Lectures", cost: `${costs.video} Coins / Free (plan-based)`, details: "Chapter-wise YouTube or Drive-hosted lectures. Speed control (0.5x–2x). Score earned on watching. Basic/Ultra get free daily views." },
                    { name: "Audio Series / Lectures", cost: "Free / Plan-based", details: "Background-playable audio lessons for commuting or relaxing. Available in select chapters." },
                    { name: "Text-to-Speech (TTS)", cost: "Free", details: "'Read' button on any note or Deep Dive page. Hindi & English support. Tap any line to start reading from there. Pause/stop anytime." },
                    { name: "Audio Studio", cost: "Free", details: "Paste your own custom text and have it read aloud in Hindi or English. Not limited to app content — use with any text." },
                    { name: "Universal Playlist", cost: "Free", details: "General videos: motivation, study tips, board guidance, science experiments. No subject selection needed." },
                    { name: "Premium Video & Audio Slides", cost: `${costs.video} / ${costs.audioSlide} Coins`, details: "Advanced lectures and synchronized audio-visual slides. Ultra subscription recommended." }
                ]
            },
            {
                title: "📝 MCQ Practice, Tests & Challenges",
                description: "Practice, test, compete — track every answer.",
                items: [
                    { name: "MCQ Practice (Chapter-wise)", cost: costs.mcqPractice, details: "Chapter-wise MCQ with instant feedback and explanation. Wrong answers auto-saved to Mistake Bank. Daily limit: Free=50, Basic=70, Ultra=100 (level bonuses add more)." },
                    { name: "MCQ Test Mode (Mock Test)", cost: `${costs.mcqTest} Coins`, details: "Timed full-chapter mock test. Detailed marksheet after submit — score, accuracy, topic-wise breakdown. Cannot change answers after submit." },
                    { name: "Weekly Test", cost: "Free / Scheduled", details: "Admin-assigned timed weekly exams. Timer persists in background — finish in one go. Marksheet + Mistake Bank integration." },
                    { name: "Daily Challenge", cost: "Free / Prize Reward", details: "100-question timed competition daily. Class-wise leaderboard. Win premium access or special rewards. One attempt per day." },
                    { name: "Smart Marksheet", cost: "Included", details: "Offline-ready performance report. Total score, accuracy %, time per question, topic-wise breakdown. Shareable to WhatsApp." },
                    { name: "Mistake Bank", cost: "Free", details: "All wrong MCQ answers auto-saved here. Practice only your mistakes — targeted improvement. Linked to Revision Hub." },
                    { name: "AI Deep Analysis", cost: `${costs.aiAnalysis} Coins`, details: "AI-powered personal weak area report after a test. Tells exactly which concepts are weak and what to do next." }
                ]
            },
            {
                title: "🤖 AI Hub — NSTA AI Features",
                description: "Your 24/7 personal tutor, planner, and note generator.",
                items: [
                    { name: "AI Chat Tutor", cost: `${costs.aiChat} Coin / Msg`, details: "Ask any subject question in Hindi or English. AI explains like a patient real teacher. Conversation history saved. Ultra users get higher limits." },
                    { name: "Universal AI Chat", cost: `${costs.aiChat} Coin / Msg`, details: "General-purpose AI — career guidance, current affairs, exam strategy. Not limited to study topics. Context-aware responses." },
                    { name: "AI Study Planner", cost: "Free / Subscription", details: "Enter your exam dates, weak subjects, and available hours. AI generates an optimized daily timetable. Updates as you progress." },
                    { name: "AI Notes Generator", cost: `Included in Deep Dive`, details: "AI creates styled HTML notes on any topic you enter — even if not in the app. Custom topic notes instantly." },
                    { name: "Study Goal Timer", cost: "Earn Coins", details: "Set a daily study goal (e.g. 2 hours). Start the timer when you study. Completing the goal earns engagement reward coins automatically." }
                ]
            },
            {
                title: "🔄 Revision Hub V2",
                description: "Science-backed spaced repetition for long-term memory.",
                items: [
                    { name: "Aaj Ka Kaam (Due Today)", cost: "Free", details: "Shows exactly which notes and MCQs are due for revision today based on spaced repetition algorithm. Do them daily — 10 mins is enough." },
                    { name: "Spaced Repetition Engine", cost: "Free", details: "Wrong MCQ → revision due tomorrow → if correct, interval doubles → if wrong again, comes back sooner. Science-backed memory method." },
                    { name: "Schedule Tab", cost: "Free", details: "See full upcoming revision schedule — what's due today, tomorrow, this week. Color-coded by subject. Overdue items shown in red." },
                    { name: "Local Note Search", cost: "Free", details: "Revision Hub automatically finds relevant notes from your cached chapters by matching wrong-answer keywords — no AI needed." }
                ]
            },
            {
                title: "🏆 Rewards, Levels & Games",
                description: "Earn while you learn — 15-level system with real perks.",
                items: [
                    { name: "Level System (L1–L15)", cost: "Earn by studying", details: "15 levels from Beginner 🌱 to Absolute Legend 💠. Each level unlocks store discounts (2%–30%), Progress Bonus, Daily Limit Bonus, special frames, colored username, and exclusive themes." },
                    { name: "Daily Login Bonus", cost: "Free — Claim daily", details: "Open app every day to get free coins. Free: 2-3 CR, Basic: 5 CR, Ultra: 10 CR + level bonuses. Claim from Mail → Rewards. Expires in 12 hours." },
                    { name: "Daily Login Streak 🔥", cost: "Earn Rewards", details: "Consecutive days of login. 3+ days: gold badge. 7+ days: On Fire banner. 30+ days: legendary trophy. New record = 100 CR bonus. Missing one day resets streak." },
                    { name: "Spin Wheel", cost: "Costs coins to spin", details: "Luck-based mini-game. Invest coins for a chance to win more. Prizes have different probabilities. Only spin with spare coins." },
                    { name: "Daily Challenge", cost: "Free / Prize", details: "100 timed MCQs daily. Class-wise leaderboard. Win premium access. One attempt per day — best performance wins." },
                    { name: "Engagement Reward", cost: "Earn automatically", details: "Study consistently (Study Timer, daily login, goal completion) and get periodic popup reward bonuses — coins claimed from the popup." }
                ]
            },
            {
                title: "💰 Credits, Store & Economy",
                description: "How coins work, how to earn them, and where to spend.",
                items: [
                    { name: "Credits (Coins) System", cost: "Internal currency", details: "Credits never expire unless spent. Visible in top-right corner or Profile tab. Used to unlock premium content, AI chat, custom themes, etc." },
                    { name: "Earn Coins — Multiple Ways", cost: "Free methods", details: "Daily login bonus, Login streak, Study Goal Timer, Gift codes (from admin), Level-up bonuses, Spin Wheel wins, Referral bonus, MCQ milestones." },
                    { name: "Gift Code / Redeem Code", cost: "Free", details: "Admin issues codes in promotions/contests. Profile → Redeem Code. Codes give coins, subscription, score boost, or discount coupons. One use per user. Case-sensitive." },
                    { name: "Mailbox (Inbox) Codes", cost: "Free", details: "Admin sends personal codes to your inbox. Types: Credits, Score Points, Score Boost, Daily Limit Boost, Subscription, Discount Coupon, Top Bar Effect. Redeem before expiry." },
                    { name: "Store — Plans & Coin Packs", cost: "Real money (₹)", details: "Buy coin packages or subscribe to Basic/Ultra plans. Plans: Monthly, Quarterly, Yearly. Higher plans = more daily limits, more free content, bigger login bonus." }
                ]
            },
            {
                title: "⚙️ Profile, Settings & Customization",
                description: "Make the app truly yours.",
                items: [
                    { name: "Profile Tab", cost: "Free", details: "Your stats hub: name, plan, credits, streak, level, score, MCQ/video/PDF counts, starred notes, mistake bank, redeem code, theme, language, logout." },
                    { name: "Theme (Light / Dark / Blue)", cost: "Free", details: "3 built-in themes. Profile → Theme or top bar icon. Dark mode for night study. Blue Dark for elegant look. Instant switch, no reload." },
                    { name: "Custom Theme Creator", cost: "200 Coins (one-time)", details: "Fully personalize top bar, nav, buttons, cards, text colors, accent glow. Give your theme a name and emoji. Saved permanently — no repeat cost." },
                    { name: "Language Toggle (HI/EN)", cost: "Free", details: "Switch app UI and AI responses between Hindi and English. Note content stays in admin-uploaded language. Toggle from top bar or Profile." },
                    { name: "Homework Tab", cost: "Free", details: "Teacher-assigned tasks with deadlines. Complete notes/video/MCQ as assigned. Bonus on completion. Reminder shown on home screen." },
                    { name: "Offline Mode", cost: "Free", details: "Previously viewed notes and PDFs work offline (cached). Revision Hub data is available offline too. AI Chat and new content need internet." }
                ]
            }
        ],
        faq: [
            { q: "Coins kaise earn karein bina paisa kharch kiye?", a: "Roz login karo aur Mail → Rewards se bonus claim karo. Study Goal Timer use karo — goal complete hone pe automatic coins milte hain. Streak maintain karo — jitna lamba streak utna zyada bonus. Gift codes ke liye admin ka WhatsApp/Telegram group follow karo." },
            { q: "Free, Basic, aur Ultra mein kya fark hai?", a: "Free: limited daily MCQ (50), limited notes/video access, basic AI. Basic: zyada daily limits, premium notes daily free views, better AI access. Ultra: unlimited competition mode, max AI chat, highest MCQ limit, 10 free Deep Dive/day, all premium features without per-item payment." },
            { q: "Daily Limit khatam ho gaya — ab kya karein?", a: "Daily limits 24 ghante baad reset hote hain. Immediate access chahiye toh coins spend karo limit bypass karne ke liye. Ya phir subscription upgrade karo — Basic/Ultra pe limits kaafi zyada hain. Level badhane se bhi bonus limit milti hai." },
            { q: "Streak toot gaya — dobara kaise banayein?", a: "Aaj se roz app kholne ki aadat banao. Raat ko neend se pehle bhi app kholo — 5 second ke liye bhi chalega. Notification on rakho taaki reminder mile. Ek baar streak toot jaata hai toh woh reset ho jaata hai — naya streak shuru hota hai." },
            { q: "Competition Mode kya hai aur kaise kaam karta hai?", a: "Competition Mode specifically competitive exams (SSC, Railway, BPSC, etc.) ke liye hai. Yahan Lucent GK jaise books ka structured page-by-page reader milta hai. Competition MCQ practice sets bhi hain. Ultra subscription se unlimited access milta hai. Free users ke liye limited chapters/day." },
            { q: "Daily Challenge aur normal MCQ Test mein kya fark hai?", a: "Daily Challenge ek competition format hai — 100 questions, fixed timer, class-wise leaderboard. Ek din mein sirf ek baar de sakte ho. Normal MCQ Test aap kabhi bhi de sakte ho apni convenience se, lekin leaderboard nahi hota." },
            { q: "Smart Marksheet offline kaise dekhein?", a: "Test submit karne ke baad Marksheet automatically save hoti hai local storage mein. Internet band hone pe bhi dekh sakte ho. Profile ya History section mein pichle test ke marksheets milenge." },
            { q: "Custom Theme banane ke liye kitne coins chahiye?", a: "200 Coins ek baar lagti hain. Iske baad theme permanently save hoti hai — dobara charge nahi hoga. Theme Customizer mein pura top bar, buttons, navigation, cards sab customize kar sakte ho." },
            { q: "AI Chat slow ya offline hai toh kya karein?", a: "AI server busy ho sakta hai — thodi der baad try karo. Internet connection check karo. Agar message bheja aur response nahi aaya toh coins waste nahi hote. Doosra sawaal try karo ya app restart karo." },
            { q: "Revision Hub V2 kaise use karein effectively?", a: "Roz subah pehle 'Aaj Ka Kaam' section dekho. Jo MCQ/notes due hain unhe pehle complete karo. Galat jawab hone pe interval chhota ho jaata hai — baar baar aayega jab tak sahi ho. Sahi karo toh interval double hota hai. Roz 10-15 minute kaafi hai." }
        ]
    };
};
