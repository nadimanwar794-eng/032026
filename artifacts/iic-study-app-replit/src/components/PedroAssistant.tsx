import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Volume2, VolumeX, X, Sparkles, ChevronRight, ChevronDown, ChevronUp, RotateCcw, 
  ArrowLeft, Move, HelpCircle, Compass, Gift, Crown, Clock, Flame, Calendar, Bell, 
  AlertTriangle, Check, Zap, Shield, Battery, BatteryCharging, Moon, Sun, BookOpen, 
  Trophy, Award, Lock, Unlock, CheckCircle2, AlertCircle, Info 
} from 'lucide-react';
import { Pedro3DMascot, type PedroMascotPose } from './Pedro3DMascot';
import type { PedroItemDetail, PedroCategory, PedroPageConfig } from '../types';
import { loadRoutineData } from '../utils/routineStorage';
import { PedroEngine, PEDRO_LEVELS, type PedroLevelConfig, type PedroEnergyStatus, type PedroPenaltyState } from '../utils/engines/pedroEngine';
import { pedroSpeak, stopPedroVoice, playSoftChime } from '../utils/pedroVoiceManager';

export type { PedroItemDetail, PedroCategory, PedroPageConfig };

// ══════════════════ COMPREHENSIVE KNOWLEDGE HIERARCHY ══════════════════
export const PEDRO_PAGE_KNOWLEDGE: Record<string, PedroPageConfig> = {
  HOME: {
    pageId: 'HOME',
    pageTitle: 'Home Screen',
    pageIcon: '🏠',
    introSpeech: 'Bataiye dost, kya madad karun?',
    categories: [
      {
        id: 'TOP_BAR',
        title: 'Top Bar',
        icon: '🔝',
        description: 'Brand logo, events, connection dots, 3-dots aur settings tools.',
        targetSelector: '#top-banner-container',
        speechText: 'Yeh Top Bar hai, yahan se important shortcuts milte hain.',
        items: [
          {
            id: 'APP_NAME_ASSEMBLE',
            title: 'App Logo & Naam',
            icon: '✨',
            summary: 'App logo aur brand title par tap karke home page assemble animation replay karein.',
            speechText: 'Isse home assemble replay hoga.',
            bullets: ['App logo aur verified badge.', 'Tap karne par majestic assemble animation trigger hota hai.'],
            targetSelector: '#nsta-header-brand-btn',
            actionKey: 'SIMULATE_APP_LOGO',
          },
          {
            id: 'ROW2_USER_GREETING',
            title: 'User Greeting & Naam (Row 2)',
            icon: '👋',
            summary: 'Top Bar Row 2 par aapka naam aur greeting: Hey, student name!',
            speechText: 'Yeh Row 2 par aapka naam aur personalized greeting hai.',
            bullets: ['Row 2 student greeting.', 'Pedro isse padhkar aapka swagat karta hai.'],
            targetSelector: '#topbar-row2-greeting',
            actionKey: 'READ_ROW2_NAME',
          },
          {
            id: 'WHATS_NEW_BADGE',
            title: "What's New & Updates",
            icon: '🎖️',
            summary: 'Logo ke bagal wala blue badge naye updates aur feature releases ka hai.',
            speechText: 'Yahan naye updates aur features milte hain.',
            bullets: ['What\'s New direct shortcut.', 'Latest features and announcements.'],
            targetSelector: '#top-banner-container',
            actionKey: 'GO_UPDATES',
          },
          {
            id: 'EVENTS_STATUS',
            title: 'Live Events & Booster Drawer',
            icon: '⚡',
            summary: 'Active score boosts, discount sales aur booster countdowns drawer.',
            speechText: 'Yahan active score boosts aur discount events hain.',
            bullets: ['Active events countdown.', 'Score booster details drawer.'],
            targetSelector: '#topbar-events-btn',
            actionKey: 'SIMULATE_EVENTS',
          },
          {
            id: 'STATUS_DOTS',
            title: 'System Health 5 Dots',
            icon: '🛰️',
            summary: 'Network, Connection, Account, Settings aur Content status indicators.',
            speechText: 'Yeh 5 dots live system status dikhate hain.',
            bullets: ['5 Cloud connection indicators.', 'Live system health monitor.'],
            targetSelector: '#topbar-status-dots-btn',
            actionKey: 'SIMULATE_STATUS_DOTS',
          },
          {
            id: 'DOCKED_PEDRO',
            title: 'Top Bar Docked Pedro Mascot',
            icon: '🤖',
            summary: 'Pedro robot on standby in top bar.',
            speechText: 'Pedro paused, tap karke wapis bulayein.',
            bullets: ['Pedro mascot standby.', 'Tap to summon Pedro anytime.'],
            targetSelector: '#topbar-docked-pedro-btn',
            actionKey: 'SIMULATE_PEDRO_RESTORE',
          },
          {
            id: 'THREE_DOTS',
            title: '3-Dot Menu Overview',
            icon: '⋮',
            summary: 'Board switcher, mailbox, score history aur theme changer menu.',
            speechText: 'Yahan Board switch aur settings hain.',
            bullets: ['All top bar shortcuts in one place.', 'Board switcher aur luxury themes.'],
            targetSelector: '#topbar-3dots-btn',
            actionKey: 'SIMULATE_3DOTS',
          },
          {
            id: 'BOARD_SWITCHER',
            title: 'Board Switcher (NCERT / BSEB)',
            icon: '🎓',
            summary: 'NCERT English, NCERT Hindi aur BSEB Bihar Board switch karein.',
            speechText: 'Yahan se NCERT aur Bihar Board switch karein.',
            bullets: ['NCERT English & Hindi mediums.', 'BSEB state board support.'],
            targetSelector: '#topbar-3dots-btn',
            actionKey: 'SIMULATE_BOARD_DROPDOWN',
          },
          {
            id: 'MAILBOX_TOOL',
            title: 'Mail Box & Free Rewards',
            icon: '📬',
            summary: 'Unread circulars, notices aur daily claimable free gift rewards.',
            speechText: 'Yahan circulars aur free gift rewards hain.',
            bullets: ['Official notices & study alerts.', 'Free coins aur daily rewards.'],
            targetSelector: '#topbar-3dots-btn',
            actionKey: 'SIMULATE_MAILBOX',
          },
          {
            id: 'SCORE_HISTORY',
            title: 'Score History & Level',
            icon: '📊',
            summary: 'Apne total score points, daily XP aur level tracking ledger.',
            speechText: 'Yahan aapka daily XP aur score ledger hai.',
            bullets: ['Daily points ledger.', 'Level progression overview.'],
            targetSelector: '#topbar-3dots-btn',
            actionKey: 'SIMULATE_3DOTS',
          },
          {
            id: 'THEMES_TOOL',
            title: 'Luxury Themes (Day / Night / Blue)',
            icon: '🌙',
            summary: 'Day mode, Dark black mode aur Midnight Blue themes.',
            speechText: 'Yahan se Day aur Night themes badlein.',
            bullets: ['Eye-comfort night themes.', 'Midnight Blue luxury styling.'],
            targetSelector: '#topbar-3dots-btn',
            actionKey: 'SIMULATE_3DOTS',
          }
        ]
      },
      {
        id: 'CLASS_6_12',
        title: 'Class 6-12 Card',
        icon: '🏫',
        description: 'School classes 6th to 12th ka full syllabus aur chapters.',
        targetSelector: '#home-class-6-12-card',
        actionKey: 'SPOTLIGHT_CLASS_6_12',
        speechText: 'Class 6 se 12 ke subjects chun lijiye.',
        items: [
          {
            id: 'CLASS_6_12_ITEM',
            title: 'Class 6-12 Desk',
            icon: '🏫',
            summary: 'Select your class from 6th to 12th.',
            speechText: 'Class 6 se 12 ke subjects chun lijiye.',
            bullets: ['Class 6th se 12th tak sabhi classes.', 'NCERT aur State Board syllabus.'],
            targetSelector: '#home-class-6-12-card',
            actionKey: 'SPOTLIGHT_CLASS_6_12'
          }
        ]
      },
      {
        id: 'COMPETITION',
        title: 'Competition Card',
        icon: '🎯',
        description: 'Competitive · Govt. Exams preparation desk.',
        targetSelector: '#home-competition-card',
        actionKey: 'SIMULATE_COMPETITION',
        speechText: 'Govt exams aur specialized tests yahan hain.',
        items: [
          {
            id: 'COMPETITION_ITEM',
            title: 'Competitive Exams',
            icon: '🎯',
            summary: 'SSC, Railway, Banking, Defense exams.',
            speechText: 'Govt exams aur specialized tests yahan hain.',
            bullets: ['SSC, Railway, Banking, Defense exams.', 'Previous year papers aur full notes.'],
            targetSelector: '#home-competition-card',
            actionKey: 'SIMULATE_COMPETITION'
          }
        ]
      },
      {
        id: 'ROUTINE',
        title: 'Routine Card',
        icon: '⏰',
        description: 'Daily timetable, study targets aur habit streak.',
        targetSelector: '#home-routine-card',
        actionKey: 'SIMULATE_ROUTINE',
        speechText: 'Yahan aapka daily timetable aur targets hain.',
        items: [
          {
            id: 'ROUTINE_ITEM',
            title: 'My Routine Planner',
            icon: '⏰',
            summary: 'Daily timetable & study targets.',
            speechText: 'Yahan aapka daily timetable aur targets hain.',
            bullets: ['Daily study timetable.', 'Study target hours.', 'Habit streak.'],
            targetSelector: '#home-routine-card',
            actionKey: 'SIMULATE_ROUTINE'
          }
        ]
      },
      {
        id: 'REVISION_HUB',
        title: 'Revision Hub Card',
        icon: '⚡',
        description: 'Fast revision, Lucent GK aur one-liner recall.',
        targetSelector: '#home-revision-card',
        actionKey: 'SIMULATE_REVISION',
        speechText: 'Fast revision aur quick formulas yahan hain.',
        items: [
          {
            id: 'REVISION_HUB_ITEM',
            title: 'Revision Hub',
            icon: '⚡',
            summary: 'Lucent GK & fast revision points.',
            speechText: 'Fast revision aur quick formulas yahan hain.',
            bullets: ['Lucent GK high-yield points.', 'Fast chapter summaries.'],
            targetSelector: '#home-revision-card',
            actionKey: 'SIMULATE_REVISION'
          }
        ]
      },
      {
        id: 'FUTURE_WHEEL',
        title: 'Future Wheel',
        icon: '🎡',
        description: 'Screen par 3 seconds hold karne par NSTA Quick Wheel aayega.',
        targetSelector: '#home-selected-class-card',
        actionKey: 'SIMULATE_WHEEL',
        speechText: 'Home screen par teen second dabaye rakhne par Quick Wheel khulega. Baaki pages par do second hold karne par focus mode toggle hoga.',
        items: [
          {
            id: 'FUTURE_WHEEL_ITEM',
            title: 'NSTA Quick Wheel & Gestures',
            icon: '🎡',
            summary: 'Screen hold gesture se instant quick tools aur focus study mode.',
            speechText: 'Home screen par 3s hold se NSTA wheel aayega, aur notes ya mcq me 2s hold se study mode toggle hoga. Pedro ko pause karne ke liye Pedro par 2 baar tap karein.',
            bullets: [
              'Home page par 3 seconds hold karne par 10 tools ka quick wheel.',
              'Notes & MCQ me 2s hold se study mode toggle aur cancel.',
              'Pedro ko pause / hide karne ke liye Pedro par 2 baar tap karein.'
            ],
            targetSelector: '#home-selected-class-card',
            actionKey: 'SIMULATE_WHEEL'
          }
        ]
      }
    ]
  },

  PRO: {
    pageId: 'PRO',
    pageTitle: 'Pro & Updates Page',
    pageIcon: '🚀',
    introSpeech: 'Pro aur Updates screen par aapka swagat hai! Yahan app ki advance study utilities aur official updates milti hain. Kiske baare me dekhna chahte hain?',
    categories: [
      {
        id: 'UPDATES_TOP_BAR',
        title: 'Top Bar & Navigation',
        icon: '🔙',
        description: 'Screen back button aur navigation.',
        targetSelector: '#updates-back-btn',
        speechText: 'Yeh Top Bar hai! Is back button par tap karke aap seedhe wapas Home screen par laut sakte hain.',
        items: [
          {
            id: 'UPDATES_BACK',
            title: 'Back to Home',
            icon: '🔙',
            summary: 'Wapas Home Screen par jayein.',
            speechText: 'Is back button par tap karke aap seedhe wapas Home screen par laut sakte hain.',
            targetSelector: '#updates-back-btn',
            bullets: ['Instant return to Home screen.', 'Smooth transition.']
          }
        ]
      },
      {
        id: 'UPDATES_SECTIONS',
        title: 'Section Switcher Tabs',
        icon: '📑',
        description: 'Advance Tools aur Events & Updates ke beech switch karein.',
        targetSelector: '#updates-tabs-container',
        speechText: 'Yeh dono main tabs hain — Advance Tools aur Events & Updates. Kaunsa section dekhna chahte hain?',
        items: [
          {
            id: 'TAB_ADVANCE_TOOLS',
            title: 'Advance Tools Tab',
            icon: '🛠️',
            summary: 'Daily Challenge, Messenger, Study Room aur Demand tools.',
            speechText: 'Advance Tools tab me Daily Challenge, Student Messenger, Group Study Room aur Demand Content jaise power tools milte hain.',
            targetSelector: '#updates-tab-advance-tools',
            bullets: ['Daily challenge & targets.', 'Messenger & Study Room.']
          },
          {
            id: 'TAB_EVENTS_UPDATES',
            title: 'Events & Updates Tab',
            icon: '📢',
            summary: 'Live school notices, exam events aur system announcements.',
            speechText: 'Events and Updates tab me school ki official notices, test series events aur app ke updates ki list dikhti hai.',
            targetSelector: '#updates-tab-events-updates',
            bullets: ['Official circulars.', 'Upcoming live tests.']
          }
        ]
      },
      {
        id: 'DAILY_CHALLENGE',
        title: 'Daily Study Challenge',
        icon: '🏆',
        description: 'Roz naye questions aur targets complete karke reward payein.',
        targetSelector: '#updates-daily-challenge-card',
        speechText: 'Yeh Daily Challenge card hai! Roz yahan naye questions aur target tasks aate hain. Inhe poora karne se aapko bonus XP aur extra coins milte hain!',
        items: [
          {
            id: 'DAILY_CHALLENGE_ITEM',
            title: 'Daily Challenge Hub',
            icon: '🏆',
            summary: 'Complete daily targets for bonus XP.',
            speechText: 'Yeh Daily Challenge card hai! Roz yahan naye questions aur target tasks aate hain. Inhe poora karne se aapko bonus XP aur extra coins milte hain!',
            targetSelector: '#updates-daily-challenge-card',
            bullets: ['Roz naye questions.', 'Extra bonus XP aur coins.']
          }
        ]
      },
      {
        id: 'MESSENGER',
        title: 'Student Messenger',
        icon: '💬',
        description: 'Doston aur batchmates ke sath peer-to-peer study chat.',
        targetSelector: '#updates-messenger-card',
        speechText: 'Yeh Student Messenger card hai! Isme aap apne batchmates aur doston ke sath direct study chat kar sakte hain, doubt discuss kar sakte hain aur notes share kar sakte hain.',
        items: [
          {
            id: 'MESSENGER_ITEM',
            title: 'Study Messenger',
            icon: '💬',
            summary: 'Chat with classmates & study partners.',
            speechText: 'Yeh Student Messenger card hai! Isme aap apne batchmates aur doston ke sath direct study chat kar sakte hain, doubt discuss kar sakte hain aur notes share kar sakte hain.',
            targetSelector: '#updates-messenger-card',
            bullets: ['Direct peer chat.', 'Study discussions & notes sharing.']
          }
        ]
      },
      {
        id: 'STUDY_ROOM',
        title: 'Live Study Room',
        icon: '👥',
        description: 'Group study, live study timer aur silent focus sessions.',
        targetSelector: '#updates-study-room-card',
        speechText: 'Yeh Live Study Room card hai! Yahan students ek sath virtual library ki tarah live timer ke sath silent study karte hain. Free users roz 2 study rooms bana sakte hain, aur VIP members unlimited rooms bana sakte hain!',
        items: [
          {
            id: 'STUDY_ROOM_ITEM',
            title: 'Virtual Study Room',
            icon: '👥',
            summary: 'Group focus sessions with live timer.',
            speechText: 'Yeh Live Study Room card hai! Yahan students ek sath virtual library ki tarah live timer ke sath silent study karte hain. Free users roz 2 study rooms bana sakte hain, aur VIP members unlimited rooms bana sakte hain!',
            targetSelector: '#updates-study-room-card',
            bullets: [
              'Free User: Roz 2 study rooms create karein (Max 30 min).',
              'VIP User: Unlimited study rooms aur extended time.',
              'Pomodoro timer, silent study aur live classmates.'
            ]
          }
        ]
      },
      {
        id: 'CONTENT_DEMAND',
        title: 'Content Demand Desk',
        icon: '📝',
        description: 'Kisi bhi book, chapter ya coaching material ki direct demand karein.',
        targetSelector: '#updates-content-demand-card',
        speechText: 'Yeh Content Demand Desk hai! Agar aapko koi specific chapter, coaching notes ya previous year question bank chahiye jo app me nahi mil raha, toh yahan request karein. Admin team 24 ghante me verified material upload karti hai!',
        items: [
          {
            id: 'CONTENT_DEMAND_ITEM',
            title: 'Request New Material',
            icon: '📝',
            summary: 'Direct request to app admin team.',
            speechText: 'Yeh Content Demand Desk hai! Agar aapko koi specific chapter, coaching notes ya previous year question bank chahiye jo app me nahi mil raha, toh yahan request karein. Admin team 24 ghante me verified material upload karti hai!',
            targetSelector: '#updates-content-demand-card',
            bullets: ['24 hour fast upload.', 'Verified authentic notes.']
          }
        ]
      },
      {
        id: 'OFFLINE_STORAGE',
        title: 'Offline Storage Desk',
        icon: '📥',
        description: 'Downloaded books, audio notes aur offline access.',
        targetSelector: '#updates-offline-card',
        speechText: 'Yeh Offline Storage card hai! Aapne jo bhi chapter notes, offline PDFs aur audio lectures download kiye hain, wo bina internet ke yahan se chalte hain.',
        items: [
          {
            id: 'OFFLINE_STORAGE_ITEM',
            title: 'Zero-Data Offline Vault',
            icon: '📥',
            summary: 'Access downloaded notes without internet.',
            speechText: 'Yeh Offline Storage card hai! Aapne jo bhi chapter notes, offline PDFs aur audio lectures download kiye hain, wo bina internet ke yahan se chalte hain.',
            targetSelector: '#updates-offline-card',
            bullets: ['Save mobile data.', 'Instant offline reading.']
          }
        ]
      },
      {
        id: 'INSTITUTE_CONNECT',
        title: 'School & Coaching Connect',
        icon: '🏫',
        description: 'Apne school aur coaching institute ka portal connect karein.',
        targetSelector: '#updates-school-card',
        speechText: 'Yeh School aur Coaching connection cards hain! Inse aapke institute ka official timetable, attendance aur assigned test series synchronize hoti hai.',
        items: [
          {
            id: 'SCHOOL_CARD',
            title: 'School Desk',
            icon: '🏫',
            summary: 'School timetable, notices aur exams.',
            speechText: 'School Desk par tap karke aap apne school ke official circulars, routine aur class tests dekh sakte hain.',
            targetSelector: '#updates-school-card',
            bullets: ['School notices & timetable.', 'Official calendar.']
          },
          {
            id: 'COACHING_CARD',
            title: 'Coaching Desk',
            icon: '🎓',
            summary: 'Coaching batches, mock tests aur DPPs.',
            speechText: 'Coaching Desk se aapke coaching batches, daily practice problems aur rank tests link hote hain.',
            targetSelector: '#updates-coaching-card',
            bullets: ['Coaching test series.', 'DPP daily practice problems.']
          }
        ]
      }
    ]
  },

  MCQ: {
    pageId: 'MCQ',
    pageTitle: 'MCQ Arena & Battles',
    pageIcon: '⚔️',
    introSpeech: 'MCQ Arena me aapka swagat hai! Yahan speed tests, official 100 MCQs aur 1v1 battle practice hoti hai. Kiske baare me dekhna chahte hain?',
    categories: [
      {
        id: 'MCQ_TOP_BAR',
        title: 'Top Bar & Back',
        icon: '🔙',
        description: 'Test exit button aur top status.',
        targetSelector: '#mcq-back-btn',
        speechText: 'Yeh Top Bar hai! Is back button se aap bina data lose kiye test arena se wapas ja sakte hain.',
        items: [
          {
            id: 'MCQ_BACK',
            title: 'Back Button',
            icon: '🔙',
            summary: 'Test se bahar nikal kar wapas jayein.',
            speechText: 'Is back button se aap bina data lose kiye test arena se wapas ja sakte hain.',
            targetSelector: '#mcq-back-btn',
            bullets: ['Safe exit from test arena.']
          }
        ]
      },
      {
        id: 'MCQ_MODES',
        title: 'Test Modes Switcher',
        icon: '🎯',
        description: 'Official 100 MCQs aur 1v1 Live Battle mode.',
        targetSelector: '#mcq-mode-tabs',
        speechText: 'Yahan se aap test mode chun sakte hain — Official 100 questions ka standard test ya phir dusre students ke sath 1v1 battle!',
        items: [
          {
            id: 'MODE_OFFICIAL',
            title: 'Official 100 MCQs Mode',
            icon: '📋',
            summary: '100 questions ka full exam pattern mock test.',
            speechText: 'Official 100 MCQs mode me complete exam syllabus ke 100 questions timer ke sath aate hain, jisse real exam ka time management banta hai.',
            targetSelector: '#mcq-tab-official',
            bullets: ['100 real exam questions.', 'Timer & Accuracy score.']
          },
          {
            id: 'MODE_BATTLE',
            title: '1v1 Live MCQ Battle',
            icon: '⚔️',
            summary: 'Real-time live battle with batchmates.',
            speechText: 'MCQ Battle me aap live doosre students ke sath compete karte hain. Jo sabse tez aur sahi answer dega, wahi battle jeetega aur rank badhegi!',
            targetSelector: '#mcq-tab-battle',
            bullets: ['Real-time live multiplayer.', 'Instant rank points.']
          }
        ]
      },
      {
        id: 'CLASS_DRAWER',
        title: 'Class & Subject Selector',
        icon: '📚',
        description: 'Class 6th se 12th aur subject choose karein.',
        targetSelector: '#mcq-class-drawer-trigger-official',
        speechText: 'Yeh Class aur Subject Selector drawer hai! Is par tap karke aap apni class aur chapter badal kar kisi bhi subject ka MCQ test shuru kar sakte hain.',
        items: [
          {
            id: 'CLASS_DRAWER_ITEM',
            title: 'Change Class & Subject',
            icon: '📚',
            summary: 'Select any class from 6th to 12th.',
            speechText: 'Yeh Class aur Subject Selector drawer hai! Is par tap karke aap apni class aur chapter badal kar kisi bhi subject ka MCQ test shuru kar sakte hain.',
            targetSelector: '#mcq-class-drawer-trigger-official',
            bullets: ['Class 6th se 12th.', 'All subjects & chapters.']
          }
        ]
      },
      {
        id: 'TEST_CONTROLS',
        title: 'Test Controls & Audio',
        icon: '⚙️',
        description: 'Review grid, restart test aur sound toggle.',
        targetSelector: '#mcq-controls-bar',
        speechText: 'Yeh aapke test controls hain! Review All, Restart aur Sound effect switch. Kaunsa tool dekhna hai?',
        items: [
          {
            id: 'BTN_REVIEW',
            title: 'Review All Questions',
            icon: '👁️',
            summary: 'Sabhi 100 questions ka summary grid dekhein.',
            speechText: 'Review All button se test ke sabhi questions ka bird-eye grid khulta hai, jisme attempted, skipped aur doubtful questions saaf dikhte hain.',
            targetSelector: '#mcq-btn-review-all',
            bullets: ['Full question grid palette.', 'Jump to any question.']
          },
          {
            id: 'BTN_RESTART',
            title: 'Restart Test',
            icon: '🔄',
            summary: 'Test ko zero se restart karein.',
            speechText: 'Restart button par click karke aap test ko fresh state me dobara shuru kar sakte hain.',
            targetSelector: '#mcq-btn-restart',
            bullets: ['Fresh start.', 'Reset timer and score.']
          },
          {
            id: 'BTN_SOUND',
            title: 'Sound FX Toggle',
            icon: '🔊',
            summary: 'Correct/wrong answer sound effect.',
            speechText: 'Sound toggle button se right ya wrong answer par bajne wale audio effects ko on ya off kar sakte hain.',
            targetSelector: '#mcq-btn-sound',
            bullets: ['Haptic audio cues.', 'Mute option available.']
          }
        ]
      },
      {
        id: 'ACTIVE_QUESTION',
        title: 'Question Arena & Options',
        icon: '❓',
        description: 'Active question card, timer aur answer options.',
        targetSelector: '#mcq-question-card',
        speechText: 'Yeh aapka main Question Card hai! Question dhyan se padhein, 4 options me se sahi option select karein aur har question ke baad instant formula explanation check karein.',
        items: [
          {
            id: 'ACTIVE_QUESTION_ITEM',
            title: 'Question Card',
            icon: '❓',
            summary: 'Interactive options and detailed solutions.',
            speechText: 'Yeh aapka main Question Card hai! Question dhyan se padhein, 4 options me se sahi option select karein aur har question ke baad instant formula explanation check karein.',
            targetSelector: '#mcq-question-card',
            bullets: ['High quality questions.', 'Instant explanation & KaTeX formulas.']
          }
        ]
      }
    ]
  },

  ROUTINE: {
    pageId: 'ROUTINE',
    pageTitle: 'Routine & Timetable Planner',
    pageIcon: '⏰',
    introSpeech: 'My Routine screen par aapka swagat hai! Yeh aapka personal study time-table aur habit coach hai. Kiske baare me janna chahte hain?',
    categories: [
      {
        id: 'ROUTINE_HEADER',
        title: 'Header & Back',
        icon: '🔙',
        description: 'Routine header aur back button.',
        targetSelector: '#routine-back-btn',
        speechText: 'Yeh routine header hai! Is back button par tap karke aap wapas dashboard par ja sakte hain.',
        items: [
          {
            id: 'ROUTINE_BACK',
            title: 'Back Button',
            icon: '🔙',
            summary: 'Wapas dashboard par lautne ke liye.',
            speechText: 'Is back button par tap karke aap Dashboard par wapas ja sakte hain.',
            targetSelector: '#routine-back-btn',
            bullets: ['Instant return to dashboard.']
          }
        ]
      },
      {
        id: 'ROUTINE_TOGGLE',
        title: 'Routine Master Switch',
        icon: '⚡',
        description: 'Daily routine tracking on ya off karein.',
        targetSelector: '#routine-toggle-switch',
        speechText: 'Yeh Routine Master Switch hai! Isko ON rakhne par aapke study targets active rehte hain aur time par alert aate hain.',
        items: [
          {
            id: 'ROUTINE_TOGGLE_ITEM',
            title: 'Master Power Toggle',
            icon: '⚡',
            summary: 'Activate or pause daily routine tracking.',
            speechText: 'Yeh Routine Master Switch hai! Isko ON rakhne par aapke study targets active rehte hain aur time par alert aate hain.',
            targetSelector: '#routine-toggle-switch',
            bullets: ['Master tracking on/off.', 'Preserves saved targets.']
          }
        ]
      },
      {
        id: 'ROUTINE_TABS',
        title: 'Planner View Tabs',
        icon: '📑',
        description: 'Daily Hub, Subjects aur My Syllabus tabs.',
        targetSelector: '#routine-tabs-bar',
        speechText: 'Yahan 3 main tabs hain — Daily Hub, Subjects aur My Syllabus. Kisko explore karna hai?',
        items: [
          {
            id: 'TAB_DAILY_HUB',
            title: 'Daily Hub Tab',
            icon: '📅',
            summary: 'Morning se evening tak ke daily study slots.',
            speechText: 'Daily Hub tab me aapke din bhar ke subah se raat tak ke study slots, ongoing target aur complete kiye gaye ghante dikhte hain.',
            targetSelector: '#routine-tab-daily-hub',
            bullets: ['Daily slot timeline.', 'Target study hours meter.']
          },
          {
            id: 'TAB_SUBJECTS',
            title: 'Subjects Allotment Tab',
            icon: '📚',
            summary: 'Har subject ke time and priority breakdown.',
            speechText: 'Subjects tab me har subject ko kitna time mila hai aur kis subject me zyada revision ki zaroorat hai, yeh analyze hota hai.',
            targetSelector: '#routine-tab-subjects',
            bullets: ['Subject-wise hours.', 'High-priority tags.']
          },
          {
            id: 'TAB_SYLLABUS',
            title: 'My Syllabus Tab',
            icon: '📊',
            summary: 'Chapter completion percentage tracker.',
            speechText: 'My Syllabus tab me aapki class ke sabhi chapters ka progress graph dikhta hai ki kitne chapters padh liye aur kitne baaki hain.',
            targetSelector: '#routine-tab-syllabus',
            bullets: ['Syllabus completion percentage.', 'Pending chapter checklist.']
          }
        ]
      },
      {
        id: 'ROUTINE_SETTINGS',
        title: 'Class & Target Settings',
        icon: '⚙️',
        description: 'Class, waking hours aur routine slots customize karein.',
        targetSelector: '#routine-settings-btn',
        speechText: 'Yeh Routine Settings button hai! Yahan se aap apni class, school timing aur daily self-study hours customize kar sakte hain.',
        items: [
          {
            id: 'ROUTINE_SETTINGS_ITEM',
            title: 'Custom Routine Setup',
            icon: '⚙️',
            summary: 'Configure sleep, school & study time.',
            speechText: 'Yeh Routine Settings button hai! Yahan se aap apni class, school timing aur daily self-study hours customize kar sakte hain.',
            targetSelector: '#routine-settings-btn',
            bullets: ['Custom sleep and study hours.', 'Category distribution.']
          }
        ]
      },
      {
        id: 'ROUTINE_SLOTS',
        title: 'Active Daily Study Slots',
        icon: '🕒',
        description: 'Timeline par lage daily time slots aur tasks.',
        targetSelector: '#routine-slots-container',
        speechText: 'Yeh aapka study slots timeline hai! Har slot me target chapter likha hota hai. Padhai poori hone par checkmark dabayein taaki streak maintain rahe!',
        items: [
          {
            id: 'ROUTINE_SLOTS_ITEM',
            title: 'Study Slots Timeline',
            icon: '🕒',
            summary: 'Slot checklist with checkmarks.',
            speechText: 'Yeh aapka study slots timeline hai! Har slot me target chapter likha hota hai. Padhai poori hone par checkmark dabayein taaki streak maintain rahe!',
            targetSelector: '#routine-slots-container',
            bullets: ['Slot completion checkmarks.', 'Dynamic break reminders.']
          }
        ]
      }
    ]
  },

  REVISION_HUB: {
    pageId: 'REVISION_HUB',
    pageTitle: 'Revision Hub & Lucent GK',
    pageIcon: '⚡',
    introSpeech: 'Revision Hub me aapka swagat hai! Yeh exam se theek pehle fast recall aur high-yield revision ke liye bana hai. Kiske baare me dekhna chahte hain?',
    categories: [
      {
        id: 'REVISION_HEADER',
        title: 'Header & Back',
        icon: '🔙',
        description: 'Back navigation button.',
        targetSelector: '#revision-hub-back-btn',
        speechText: 'Is back button se aap Revision Hub se wapas Dashboard par laut sakte hain.',
        items: [
          {
            id: 'REVISION_BACK',
            title: 'Back to Dashboard',
            icon: '🔙',
            summary: 'Dashboard par wapas jayein.',
            speechText: 'Is button se aap Revision Hub se wapas Dashboard par laut sakte hain.',
            targetSelector: '#revision-hub-back-btn',
            bullets: ['Instant return to home.']
          }
        ]
      },
      {
        id: 'REVISION_TABS',
        title: 'Revision Navigation Tabs',
        icon: '📑',
        description: 'MCQ Revision, Performance Analytics aur Test History tabs.',
        targetSelector: '#revision-hub-tabs-bar',
        speechText: 'Yahan Revision Hub ke 3 main sections hain — MCQ Revision, Performance aur History. Kaunsa section samjhna hai?',
        items: [
          {
            id: 'TAB_REV_MCQ',
            title: 'MCQ Revision Tab',
            icon: '🎯',
            summary: 'Fast high-yield questions practice.',
            speechText: 'MCQ Revision tab me direct exam questions ka rapid practice set hota hai taaki facts aur formulas jaldi dimag me set ho sakein.',
            targetSelector: '#revision-hub-tab-mcq',
            bullets: ['High yield fast questions.', 'Exam-focused points.']
          },
          {
            id: 'TAB_REV_PERFORMANCE',
            title: 'Performance & Analytics',
            icon: '📈',
            summary: 'Accuracy graph aur weak points report.',
            speechText: 'Performance tab me aapka revision accuracy rate, speed per question aur kaunse chapters me marks kat rahe hain, sab dikhta hai.',
            targetSelector: '#revision-hub-tab-performance',
            bullets: ['Accuracy breakdown.', 'Weak subject alerts.']
          },
          {
            id: 'TAB_REV_HISTORY',
            title: 'Revision Test History',
            icon: '📜',
            summary: 'Pichle sabhi revision tests ka record.',
            speechText: 'History tab me aapke diye gaye sabhi purane revision tests ke scorecards aur solutions save rehte hain.',
            targetSelector: '#revision-hub-tab-history',
            bullets: ['Past scorecards.', 'Re-attempt mistakes.']
          }
        ]
      },
      {
        id: 'NSTA_FAB',
        title: 'NSTA Floating Bar Controller',
        icon: '🔘',
        description: 'Screen par bottom navigation bar ko show ya hide karein.',
        targetSelector: '#revision-hub-nsta-fab',
        speechText: 'Yeh NSTA Floating Button hai! Revision karte waqt agar aapko full screen view chahiye toh is button se bottom navigation bar hide ya show kar sakte hain.',
        items: [
          {
            id: 'NSTA_FAB_ITEM',
            title: 'Fullscreen Nav Toggle',
            icon: '🔘',
            summary: 'Toggle bottom navigation bar visibility.',
            speechText: 'Yeh NSTA Floating Button hai! Revision karte waqt agar aapko full screen view chahiye toh is button se bottom navigation bar hide ya show kar sakte hain.',
            targetSelector: '#revision-hub-nsta-fab',
            bullets: ['Distraction-free fullscreen mode.', 'Easy tap toggle.']
          }
        ]
      }
    ]
  },

  STUDY_MODE: {
    pageId: 'STUDY_MODE',
    pageTitle: 'Study Mode & Chapter Studio',
    pageIcon: '📖',
    introSpeech: 'Welcome to Study Mode! Yahan aapko padhai ke 9 powerful study modes, live timer aur smart reading tools milte hain.',
    categories: [
      {
        id: 'ALL_NINE_MODES',
        title: '9 Core Study Modes',
        icon: '🎯',
        description: 'Reading, Writing, MCQ, Projector, Flashcard, Q&A, PDF, Video aur Audio.',
        items: [
          {
            id: 'MODE_READING',
            title: '1. Reading Mode',
            icon: '📖',
            summary: 'Distraction-free chunked reading.',
            speechText: 'Reading mode me chapter ke saare notes step-by-step chunked format me khulte hain, zero distraction ke sath!',
            bullets: ['Chunked reading.', 'KaTeX formulas.']
          },
          {
            id: 'MODE_WRITING',
            title: '2. Writing Mode & Digital Slate',
            icon: '✍️',
            summary: 'Likh kar practice karein.',
            speechText: 'Writing mode me aap khud definitions aur formula likh kar practice karte hain aur smart correction marks deta hai!',
            bullets: ['Digital handwriting practice.', 'WriteModeCorrection engine.']
          },
          {
            id: 'MODE_MCQ',
            title: '3. MCQ Practice Mode',
            icon: '🧠',
            summary: 'Har question ka instant explanation.',
            speechText: 'MCQ practice mode me chapter ke important questions aate hain. Option select karte hi answer aur explanation samne aata hai!',
            bullets: ['Instant explanation.', 'Negative marking.']
          },
          {
            id: 'MODE_FLASHCARD',
            title: '4. Flashcard Mode',
            icon: '🗂️',
            summary: 'Rapid formula recall cards.',
            speechText: 'Flashcard mode me quick flip cards hote hain. 5 minute me pure chapter ke 50 formulas refresh ho jate hain!',
            bullets: ['Interactive card flip.', 'Spaced repetition.']
          }
        ]
      }
    ]
  },

  STORE: {
    pageId: 'STORE',
    pageTitle: 'Store, Currencies & VIP',
    pageIcon: '💎',
    introSpeech: 'Store me aapka swagat hai! Yahan VIP plans, Coins, Diamonds aur exciting study perks milte hain. Kiske baare me dekhna chahte hain?',
    categories: [
      {
        id: 'STORE_HEADER',
        title: 'Header & Back',
        icon: '🔙',
        description: 'Store se bahar jane ke liye back button.',
        targetSelector: '#store-back-btn',
        speechText: 'Yeh Store header hai! Is button par tap karke aap Store se wapas Dashboard par laut sakte hain.',
        items: [
          {
            id: 'STORE_BACK',
            title: 'Back to Dashboard',
            icon: '🔙',
            summary: 'Wapas dashboard par jayein.',
            speechText: 'Is button par tap karke aap Store se wapas Dashboard par laut sakte hain.',
            targetSelector: '#store-back-btn',
            bullets: ['Instant back navigation.']
          }
        ]
      },
      {
        id: 'STORE_CURRENCIES',
        title: 'Diamonds & Credits Wallets',
        icon: '🪙',
        description: 'Aapke Diamonds aur Study Credits ka live balance.',
        targetSelector: '#store-diamonds-pill',
        speechText: 'Yeh aapka wallet balance hai — Diamonds aur Credits! Kiske baare me janna chahte hain?',
        items: [
          {
            id: 'WALLET_DIAMONDS',
            title: 'Diamonds Balance 💎',
            icon: '💎',
            summary: 'Permanent premium content unlock currency.',
            speechText: 'Diamonds app ki sabse premium currency hain! Inse tests, locked PDF notes aur exclusive perks permanently unlock hote hain. Tap karke Diamond Store khol sakte hain.',
            targetSelector: '#store-diamonds-pill',
            bullets: ['Permanent unlock power.', 'Never expires.']
          },
          {
            id: 'WALLET_CREDITS',
            title: 'Coins / Credits Balance 🪙',
            icon: '🪙',
            summary: 'Daily study, streak & test coins.',
            speechText: 'Credits aapki study currency hai! Roz padhai karne, streaks banaye rakhne aur challenges jeetne par free milte hain. Tap karke Credit Store khol sakte hain.',
            targetSelector: '#store-credits-pill',
            bullets: ['Earn by studying.', 'Spend on practice tests.']
          }
        ]
      },
      {
        id: 'STORE_TABS',
        title: 'Store Sections & VIP Plans',
        icon: '👑',
        description: 'VIP Plans, Free vs VIP Compare, Credits, Diamonds aur Exchange.',
        targetSelector: '#store-tab-subscription',
        speechText: 'Store ke sabhi sections yahan hain — VIP Subscriptions, Free vs VIP Table, Credits, Diamonds aur History. Kiske baare me samjhoon?',
        items: [
          {
            id: 'TAB_VIP_SUB',
            title: 'VIP Subscriptions',
            icon: '👑',
            summary: 'Pro & Max plans with 2.0x XP Boost.',
            speechText: 'VIP Subscriptions me Pro aur Max plans aate hain, jisme unlimited MCQs, PDF notes, 2.0x Super XP Boost aur Golden Crown badge milta hai.',
            targetSelector: '#store-tab-subscription',
            bullets: ['2.0X XP multiplier.', 'Unlimited reading notes & tests.']
          },
          {
            id: 'TAB_COMPARE',
            title: 'Free vs VIP Compare',
            icon: '⚖️',
            summary: 'Detailed feature-by-feature comparison table.',
            speechText: 'Comparison table me aap dekh sakte hain ki Free student aur VIP student ko kya kya extra features aur daily limits milti hain.',
            targetSelector: '#store-tab-compare',
            bullets: ['Feature comparison chart.', 'Transparent benefits.']
          },
          {
            id: 'TAB_CREDITS_STORE',
            title: 'Credits Store',
            icon: '🪙',
            summary: 'Instant coin packs aur Daily Credit pass.',
            speechText: 'Credits store se aap instant coin packages ya Daily Credit Pass le sakte hain jisse roz automatic coins aate hain.',
            targetSelector: '#store-tab-credits',
            bullets: ['Instant coin packs.', 'Daily pass bonuses.']
          },
          {
            id: 'TAB_DIAMONDS_STORE',
            title: 'Diamonds Store',
            icon: '💎',
            summary: 'Exclusive Diamond packs & Daily drops.',
            speechText: 'Diamonds store me exclusive Diamond bundles aur Daily Diamond subscriptions milti hain.',
            targetSelector: '#store-tab-diamonds',
            bullets: ['Exclusive packs.', 'Daily diamond drops.']
          },
          {
            id: 'TAB_EXCHANGE',
            title: 'Currency Exchange',
            icon: '🔄',
            summary: 'Diamonds ko instant credits me swap karein.',
            speechText: 'Exchange counter par aap apne unused Diamonds ko instant Study Credits me swap kar sakte hain.',
            targetSelector: '#store-tab-exchange',
            bullets: ['Instant currency swap.', 'Flexible conversion.']
          },
          {
            id: 'TAB_HISTORY',
            title: 'Purchase History',
            icon: '📜',
            summary: 'Sabhi invoices aur plan validity.',
            speechText: 'History tab me aapke pichle sabhi active plans, recharge receipts aur transaction history rehti hai.',
            targetSelector: '#store-tab-history',
            bullets: ['Past transactions.', 'Plan validity status.']
          }
        ]
      }
    ]
  },

  PROFILE: {
    pageId: 'PROFILE',
    pageTitle: 'Profile, Level & Settings',
    pageIcon: '👤',
    introSpeech: 'Aapki Profile screen par aapka swagat hai! Yahan aapka rank level, rewards, security aur effects customize hote hain. Kiske baare me dekhna hai?',
    categories: [
      {
        id: 'PROFILE_HERO',
        title: 'Identity Card & Rank Level',
        icon: '🪪',
        description: 'Level status, badge, XP progress aur discount.',
        targetSelector: '#profile-user-card',
        speechText: 'Yeh aapka main Identity Card hai! Isme aapka current level, badge emoji, XP meter aur level discount dikhta hai. Tap karne par poora level ladder khulta hai!',
        items: [
          {
            id: 'PROFILE_HERO_ITEM',
            title: 'Level Rank Hero Card',
            icon: '🪪',
            summary: 'Current rank level & XP progress bar.',
            speechText: 'Yeh aapka main Identity Card hai! Isme aapka current level, badge emoji, XP meter aur level discount dikhta hai. Tap karne par poora level ladder khulta hai!',
            targetSelector: '#profile-user-card',
            bullets: ['Level 1 se 15 ladder.', 'XP progress bar.', 'Level discount perks.']
          },
          {
            id: 'PROFILE_CAMERA_ITEM',
            title: 'Profile Camera & Photo',
            icon: '📸',
            summary: 'Camera se live photo ya gallery se profile picture lagayein.',
            speechText: 'Camera button par tap karke aap apni live photo ya gallery photo ko profile pic bana sakte hain!',
            targetSelector: '#profile-camera-btn',
            bullets: ['Live camera capture option.', 'Gallery selection.', 'Instant profile photo update.'],
            actionKey: 'OPEN_CAMERA'
          }
        ]
      },
      {
        id: 'PROFILE_STATS',
        title: 'Student Stats Row',
        icon: '📊',
        description: 'Diamonds, Credits, Streak flame aur Total XP.',
        targetSelector: '#profile-diamonds-btn',
        speechText: 'Yeh aapka live stats row hai! Diamonds, Credits, Study Streak aur XP Score. Kiske baare me janna chahte hain?',
        items: [
          {
            id: 'STAT_DIAMONDS',
            title: 'Diamonds Wallet',
            icon: '💎',
            summary: 'Tap karke Diamond Store kholein.',
            speechText: 'Aapke pass kitne 💎 Diamonds hain yeh yahan dikhta hai. Tap karke aap turant Diamond Store me ja sakte hain.',
            targetSelector: '#profile-diamonds-btn',
            bullets: ['Diamond balance.', 'Direct store link.']
          },
          {
            id: 'STAT_CREDITS',
            title: 'Credits Balance',
            icon: '🪙',
            summary: 'Tap karke Coin Store kholein.',
            speechText: 'Aapka 🪙 Credits balance yahan hai. Test unlock karne ya study pass ke liye use hota hai.',
            targetSelector: '#profile-credits-btn',
            bullets: ['Credit balance.', 'Direct coin store link.']
          },
          {
            id: 'STAT_STREAK',
            title: 'Study Streak Flame',
            icon: '🔥',
            summary: 'Roz padhne par badhne wali flame.',
            speechText: 'Yeh aapki Study Streak hai! Agar aap roz bina break ke padhai karte hain, toh yeh flame badhti hai aur reward milte hain.',
            targetSelector: '#profile-streak-btn',
            bullets: ['Daily streak count.', 'Streak protection.']
          },
          {
            id: 'STAT_XP',
            title: 'Total XP Score',
            icon: '⭐',
            summary: 'Total accumulated experience score.',
            speechText: 'Yeh aapka Total XP Score hai! Har test dene, answer likhne aur video dekhne par XP milta hai jo aapki rank badhata hai.',
            targetSelector: '#profile-xp-btn',
            bullets: ['Total earned XP.', 'Leaderboard rank booster.']
          }
        ]
      },
      {
        id: 'PROFILE_RECOVERY',
        title: 'Account Recovery Card',
        icon: '🔐',
        description: 'Mobile, Email aur Security Question.',
        targetSelector: '#profile-recovery-card',
        speechText: 'Yeh Account Recovery Card hai! Yahan aapka registered mobile number, email aur secret security question save hota hai taaki phone khone ya badalne par aapka account hamesha safe rahe.',
        items: [
          {
            id: 'PROFILE_RECOVERY_ITEM',
            title: 'Security & Recovery',
            icon: '🔐',
            summary: 'Keep your student account safe.',
            speechText: 'Yeh Account Recovery Card hai! Yahan aapka registered mobile number, email aur secret security question save hota hai taaki phone khone ya badalne par aapka account hamesha safe rahe.',
            targetSelector: '#profile-recovery-card',
            bullets: ['Mobile & Email verification.', 'Security question backup.', 'Account protection.']
          }
        ]
      },
      {
        id: 'PROFILE_EFFECTS',
        title: 'Visual Effects & Toggles',
        icon: '✨',
        description: 'Name effect, Card glow aur Level animations.',
        targetSelector: '#profile-name-fx-toggle-btn',
        speechText: 'Yahan se aap app ke glowing visual effects customize kar sakte hain — Name Effect, Card Effect aur Level Animation. Kaunsa option dekhna hai?',
        items: [
          {
            id: 'FX_NAME',
            title: 'Name Glow Effect',
            icon: '✨',
            summary: 'Profile me naam par glowing animation.',
            speechText: 'Is switch se aap apne naam ke animated glowing effect ko on ya off kar sakte hain.',
            targetSelector: '#profile-name-fx-toggle-btn',
            bullets: ['Animated gradient text.', 'Battery saving static toggle.']
          },
          {
            id: 'FX_CARD',
            title: 'Card Glow Effect',
            icon: '🃏',
            summary: 'Profile card ke glowing borders.',
            speechText: 'Is switch se profile identity card ke border glow aur aura effect ko control kiya jata hai.',
            targetSelector: '#profile-card-fx-toggle-btn',
            bullets: ['Level aura border.', 'Simple clean mode.']
          },
          {
            id: 'FX_LEVEL_ANIM',
            title: 'Level Animation Toggle',
            icon: '⚡',
            summary: 'Top Bar aur Profile card level animations.',
            speechText: 'Is switch se Top Bar aur Profile Card ke level animation ko on ya off (static) kiya ja sakta hai.',
            targetSelector: '#profile-level-anim-toggle-btn',
            bullets: ['Dynamic vs static level animations.']
          }
        ]
      }
    ]
  },

  COMMUNITY: {
    pageId: 'COMMUNITY',
    pageTitle: 'Community & Chat',
    pageIcon: '💬',
    introSpeech: 'Community me students ek dusre ki doubts solve karte hain aur study tips share karte hain. Option chunein!',
    categories: [
      {
        id: 'DOUBTS',
        title: 'Doubt Solving Desk',
        icon: '❓',
        description: 'Apne sawal post karein aur mentors se solution payein.',
        items: [
          {
            id: 'POST_DOUBT',
            title: 'Doubt Kaise Poochein',
            icon: '📸',
            summary: 'Question image ya text post karein.',
            speechText: 'Community me kisi sawal me fas gaye hain toh post karein. Seniors aur verified mentors step-by-step solution dete hain!',
            bullets: ['Image upload support.', 'Verified mentor badges.']
          }
        ]
      }
    ]
  }
};

// ══════════════════ SMART GREETING HELPER ══════════════════
export const formatTimeMinSecHindi = (seconds: number): string => {
  const safeSec = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  if (mins > 0 && secs > 0) {
    return `${mins} minute ${secs} second`;
  } else if (mins > 0) {
    return `${mins} minute`;
  } else {
    return `${secs} second`;
  }
};

export const getRoutineSpeechSummary = (userId?: string, user?: any): string => {
  const routineLines: string[] = [];

  if (userId) {
    try {
      const routineData = loadRoutineData(userId);
      if (routineData?.routineCategories && routineData.routineCategories.length > 0) {
        routineData.routineCategories.forEach((cat) => {
          const sub = cat.subjects?.[cat.currentSubjectIndex ?? 0];
          if (sub) {
            routineLines.push(`${cat.categoryName || sub.displayName}: Lesson ${sub.currentLessonIndex + 1}`);
          }
        });
      } else if (routineData?.routineSlots && routineData.routineSlots.length > 0) {
        routineData.routineSlots.forEach((slot) => {
          routineLines.push(`${slot.displayName || slot.bookName}: Lesson ${slot.currentLessonIndex + 1}`);
        });
      }
    } catch {}
  }

  const dailyTasks = user?.dailyRoutine?.tasks;
  const taskDescriptions: string[] = [];
  if (Array.isArray(dailyTasks) && dailyTasks.length > 0) {
    dailyTasks.slice(0, 3).forEach((t: any) => {
      taskDescriptions.push(`${t.title} (${t.duration} min)`);
    });
  }

  if (routineLines.length > 0) {
    return `Routine ke anusaar, aaj aapke yeh study tracks scheduled hain: ${routineLines.join(', ')}. ${
      taskDescriptions.length > 0 ? `Saath hi daily practice tasks: ${taskDescriptions.join(', ')}.` : ''
    } Routine poora karke maximum XP aur coins boost karein!`;
  } else if (taskDescriptions.length > 0) {
    return `Aaj aapke routine mein yeh tasks scheduled hain: ${taskDescriptions.join(', ')}. Routine ke anusaar padhai jaari rakhein!`;
  } else {
    return `Aapka Routine page open hai. Yahan daily timetable aur scheduled lessons set karke apni padhai ko track karein!`;
  }
};

export const speakPedroVoice = (text: string, customPitch?: number, customRate?: number, isAutomated?: boolean) => {
  pedroSpeak(text, {
    isAutomated,
    pitch: customPitch ?? 1.15,
    rate: customRate ?? 1.08,
    showBubble: true
  });
};

const getSmartGreeting = (
  _robotName?: string,
  _pageTitle?: string,
  _pageIntro?: string,
  _userName?: string,
  _streak?: number
): { speech: string; isFirstToday: boolean } => {
  return {
    speech: 'Bataiye dost, kya madad karun?',
    isFirstToday: false
  };
};

// ══════════════════ INTERFACES ══════════════════
interface PedroAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  isSystemGuideOpen?: boolean;
  onCloseSystemGuide?: () => void;
  activeTab?: string;
  currentPageContext?: string;
  onNavigateTab?: (tab: string) => void;
  onTriggerAction?: (actionKey: string) => void;
  customKnowledge?: Record<string, PedroPageConfig>;
  customRobotName?: string;
  defaultPitch?: number;
  defaultRate?: number;
  user?: any;
  onOpenInbox?: () => void;
  onAutoClaimRewards?: () => void;
  studyTimerSeconds?: number;
  dailyGoalSeconds?: number;
  activeGroupStudyRoomsCount?: number;
  onOpenStudyRoom?: () => void;
  onOpenRoutine?: () => void;
  settings?: any;
  activeStudySession?: {
    isStudying: boolean;
    lessonTitle?: string;
    pageNumber?: number;
    totalPages?: number;
    requiredSeconds?: number;
    timeSpentSeconds?: number;
    countdownSeconds?: number;
    mode?: string;
  };
}

export const PedroAssistant: React.FC<PedroAssistantProps> = ({
  isOpen,
  onClose,
  isSystemGuideOpen,
  onCloseSystemGuide,
  activeTab = 'HOME',
  currentPageContext,
  onNavigateTab,
  onTriggerAction,
  customKnowledge,
  customRobotName = 'Pedro',
  defaultPitch = 1.48,
  defaultRate = 1.05,
  user,
  onOpenInbox,
  onAutoClaimRewards,
  studyTimerSeconds = 0,
  dailyGoalSeconds = 1800,
  activeGroupStudyRoomsCount = 0,
  onOpenStudyRoom,
  onOpenRoutine,
  settings,
  activeStudySession,
}) => {
  // Controlled or event-driven System Guide open state (3-dot menu)
  const [internalSystemGuideOpen, setInternalSystemGuideOpen] = useState(false);
  const effectiveSystemGuideOpen = isSystemGuideOpen !== undefined ? isSystemGuideOpen : internalSystemGuideOpen;
  const [systemGuideTab, setSystemGuideTab] = useState<'LEVELS' | 'POWERS' | 'ENERGY'>('LEVELS');

  useEffect(() => {
    const handleOpenSystemGuide = () => {
      setInternalSystemGuideOpen(true);
    };
    window.addEventListener('nst-open-pedro-system-guide', handleOpenSystemGuide);
    return () => window.removeEventListener('nst-open-pedro-system-guide', handleOpenSystemGuide);
  }, []);

  const handleCloseSystemGuide = () => {
    setInternalSystemGuideOpen(false);
    onCloseSystemGuide?.();
  };

  // Merge static knowledge with Admin customized knowledge
  const activeKnowledge = useMemo(() => {
    if (!customKnowledge) return PEDRO_PAGE_KNOWLEDGE;
    const merged: Record<string, PedroPageConfig> = { ...PEDRO_PAGE_KNOWLEDGE };
    Object.keys(customKnowledge).forEach(k => {
      const custom = customKnowledge[k];
      if (custom) {
        merged[k] = {
          ...PEDRO_PAGE_KNOWLEDGE[k],
          ...custom,
          categories: custom.categories && custom.categories.length > 0
            ? custom.categories
            : (PEDRO_PAGE_KNOWLEDGE[k]?.categories || [])
        };
      }
    });
    return merged;
  }, [customKnowledge]);

  // Determine current page key
  const pageKey = useMemo(() => {
    if (currentPageContext && activeKnowledge[currentPageContext]) {
      return currentPageContext;
    }
    const tabUpper = (activeTab || 'HOME').toUpperCase();
    if (tabUpper.includes('PRO') || tabUpper.includes('UPDATE')) return 'PRO';
    if (tabUpper.includes('MCQ')) return 'MCQ';
    if (tabUpper.includes('COMMUNITY') || tabUpper.includes('CHAT')) return 'COMMUNITY';
    if (tabUpper.includes('ROUTINE')) return 'ROUTINE';
    if (tabUpper.includes('LUCENT') || tabUpper.includes('REVISION')) return 'REVISION_HUB';
    if (tabUpper.includes('STUDY') || tabUpper.includes('LESSON')) return 'STUDY_MODE';
    if (tabUpper.includes('STORE')) return 'STORE';
    if (tabUpper.includes('PROFILE')) return 'PROFILE';
    return 'HOME';
  }, [currentPageContext, activeTab, activeKnowledge]);

  const pageConfig = activeKnowledge[pageKey] || activeKnowledge.HOME;

  // Selected Category / Sub-items state
  const [selectedCategory, setSelectedCategory] = useState<PedroCategory | null>(null);
  const [activeItemTitle, setActiveItemTitle] = useState<string | null>(null);
  const [showAskMoreChip, setShowAskMoreChip] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Navigation tabs inside Pedro Dialog: Guide (Default), Powers, Rules, Energy (4 pages)
  const [activeMainTab, setActiveMainTab] = useState<'GUIDE' | 'POWERS' | 'RULES' | 'ENERGY'>('GUIDE');
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);

  // Pedro Action Options: "Kya karna hai & Kaise karna hai"
  const pedroActionOptions = useMemo(() => [
    {
      id: 'STUDY_NOTES',
      title: 'Padhai Shuru Karni Hai (Notes & Chapters)',
      badge: 'Study & Notes',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      icon: '📖',
      kyaKarnaHai: 'Apni class aur subject ke chapters, theory aur formulas padhein.',
      kaiseKarnaHai: [
        '1. Home screen par apni Class (6th–12th) choose karein.',
        '2. Subject (Science, Math, Social etc.) par tap karein.',
        '3. Chapter khol kar padhna shuru karein — har page padhne par study coins unlock honge!',
      ],
      speechText: 'Padhai shuru karne ke liye Home screen par Class aur Subject chuniye, aur chapter khol kar padhein!',
      buttonText: 'Padhai Kholein ➔',
      action: () => {
        onClose();
        onNavigateTab?.('HOME');
      },
    },
    {
      id: 'MCQ_QUIZ',
      title: 'MCQ Test & Speed Quiz Dena Hai',
      badge: 'Quiz & XP',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      icon: '⚔️',
      kyaKarnaHai: 'MCQs practice karke time speed aur accuracy badhayein, rank score earn karein.',
      kaiseKarnaHai: [
        '1. MCQ Arena tab par jayein.',
        '2. Speed Test ya Practice Mode select karein.',
        '3. Sahi uttar par +XP aur Medals milenge, Leaderboard par top rank payein!',
      ],
      speechText: 'MCQ test ke liye Arena me jayein, Speed test ya Practice mode chun kar sawal solve karein!',
      buttonText: 'MCQ Arena Kholein ➔',
      action: () => {
        onClose();
        onNavigateTab?.('MCQ');
      },
    },
    {
      id: 'ROUTINE_SLOTS',
      title: 'Study Routine / Time-table Set Karna Hai',
      badge: 'Time-Table',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      icon: '⏰',
      kyaKarnaHai: 'Apne din bhar ka study time-table set karein aur regular padhai karein.',
      kaiseKarnaHai: [
        '1. Routine button par tap karke apna study slot banayein.',
        '2. Morning aur Evening study target select karein.',
        '3. Pedro aapko padhai ke samay auto reminder alert dega!',
      ],
      speechText: 'Study routine set karne ke liye Routine drawer me jayein aur apne daily study slots add karein!',
      buttonText: 'Routine Kholein ➔',
      action: () => {
        onClose();
        onOpenRoutine?.();
      },
    },
    {
      id: 'LIVE_ROOM',
      title: 'Live Group Study Room Join Karna Hai',
      badge: 'Live Room',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      icon: '🎙️',
      kyaKarnaHai: 'Live study room me sabhi students ke sath silent ya voice study session karein.',
      kaiseKarnaHai: [
        '1. Live Study Room button par tap karein.',
        '2. Apna audio mic on karein ya Silent Focus mode laga kar padhein.',
        '3. Group timer ke sath bina distraction focused study karein!',
      ],
      speechText: 'Live Study room join karne ke liye Live room button tap karein aur sath milkar focused study karein!',
      buttonText: 'Live Room Kholein ➔',
      action: () => {
        onClose();
        onOpenStudyRoom?.();
      },
    },
    {
      id: 'STORE_REWARDS',
      title: 'Store, Free Rewards & VIP Plans',
      badge: 'Coins & Store',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      icon: '💎',
      kyaKarnaHai: 'Apne earned coins se plans lein aur inbox me aaye free rewards claim karein.',
      kaiseKarnaHai: [
        '1. Store tab me jakar coins aur diamonds balance check karein.',
        '2. Mailbox me aaye daily gifts aur bonus rewards claim karein.',
        '3. VIP plan lekar unlimited features access karein!',
      ],
      speechText: 'Store tab me jayein, apne coins se VIP pass lein aur inbox se daily free rewards claim karein!',
      buttonText: 'Store Kholein ➔',
      action: () => {
        onClose();
        onNavigateTab?.('STORE');
      },
    },
    {
      id: 'BOOST_RANK',
      title: 'Pedro Level & Apni Rank Boost Karni Hai',
      badge: 'XP & Powers',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      icon: '⚡',
      kyaKarnaHai: 'Pedro ke Level 1 se Level 10 tak ke powers unlock karein aur rank badhayein.',
      kaiseKarnaHai: [
        '1. Roz 15+ minute padhai karein taaki streak bane.',
        '2. Streak tutne par Pedro naraj hota hai, isliye daily active rahein.',
        '3. Powers tab me jakar dekhein kaun se superpowers unlock huye hain!',
      ],
      speechText: 'Pedro level badhane ke liye roz kam se kam 15 minute padhai karein taaki aapki streak bane aur naye powers unlock hon!',
      buttonText: 'Pedro Powers Dekhein ➔',
      action: () => {
        setActiveMainTab('POWERS');
      },
    },
    {
      id: 'SCREEN_GUIDE',
      title: 'Is Screen Ke Sabhi Features Samajhna Hai',
      badge: 'Screen Guide',
      badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      icon: '🧭',
      kyaKarnaHai: 'Abhi jo screen khuli hai, uske sabhi hidden buttons aur options ka tutorial dekhein.',
      kaiseKarnaHai: [
        '1. Screen Guide tab par tap karein.',
        '2. Screen ke har section par spotlight highlight ke sath Pedro explain karega.',
        '3. Kisi bhi feature ko directly trigger karke demo dekh sakte hain!',
      ],
      speechText: 'Screen guide tab me jakar aap is screen ke sabhi tools aur features ka live demo dekh sakte hain!',
      buttonText: 'Screen Guide Dekhein ➔',
      action: () => {
        setActiveMainTab('GUIDE');
      },
    },
  ], [onClose, onNavigateTab, onOpenRoutine, onOpenStudyRoom]);

  // Pedro Mascot Level & Energy Engine status
  const effectiveLevel = useMemo(() => PedroEngine.getEffectiveLevel(user), [user]);
  const levelConfig = useMemo(() => PedroEngine.getLevelConfig(effectiveLevel), [effectiveLevel]);

  // Level 8 Color Change Scheme ("level 8 pe color change karne ka option milega 2 color milenge")
  const [pedroColorScheme, setPedroColorScheme] = useState<'classic' | 'cyber'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pedro_color_scheme');
      if (saved === 'classic' || saved === 'cyber') return saved;
    }
    return 'classic';
  });

  const handleSetColorScheme = (scheme: 'classic' | 'cyber') => {
    setPedroColorScheme(scheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pedro_color_scheme', scheme);
      window.dispatchEvent(new CustomEvent('pedro-color-scheme-change', { detail: { scheme } }));
    }
  };

  const [energyStatus, setEnergyStatus] = useState<PedroEnergyStatus>(() => PedroEngine.getEnergyStatus(user, studyTimerSeconds));

  useEffect(() => {
    setEnergyStatus(PedroEngine.getEnergyStatus(user, studyTimerSeconds));
  }, [user, studyTimerSeconds]);

  useEffect(() => {
    const handleEnergyRefresh = () => {
      setEnergyStatus(PedroEngine.getEnergyStatus(user, studyTimerSeconds));
    };
    const handleOpenEnergyTab = () => {
      setActiveMainTab('ENERGY');
      setIsMinimized(false);
    };
    const handleOpenPowersTab = () => {
      setActiveMainTab('POWERS');
      setIsMinimized(false);
    };
    const handleOpenRulesTab = () => {
      setActiveMainTab('RULES');
      setIsMinimized(false);
    };
    window.addEventListener('nst-pedro-energy-change', handleEnergyRefresh);
    window.addEventListener('nst-pedro-open-energy', handleOpenEnergyTab);
    window.addEventListener('nst-pedro-open-powers', handleOpenPowersTab);
    window.addEventListener('nst-pedro-open-rules', handleOpenRulesTab);
    return () => {
      window.removeEventListener('nst-pedro-energy-change', handleEnergyRefresh);
      window.removeEventListener('nst-pedro-open-energy', handleOpenEnergyTab);
      window.removeEventListener('nst-pedro-open-powers', handleOpenPowersTab);
      window.removeEventListener('nst-pedro-open-rules', handleOpenRulesTab);
    };
  }, [user, studyTimerSeconds]);

  // User tier & mailbox rewards state
  const isUltraUser = user?.subscriptionTier === 'ULTRA' || user?.subscriptionTier === 'LIFETIME';

  // Level 8 Overdrive state (24h active window, 6-7 day recharge cycle, 2x XP + credits)
  const [l8Overdrive, setL8Overdrive] = useState<PedroL8OverdriveInfo>(() =>
    PedroEngine.getL8OverdriveState(user?.id, user?.level, isUltraUser)
  );

  useEffect(() => {
    const updateL8 = () => {
      setL8Overdrive(PedroEngine.getL8OverdriveState(user?.id, user?.level, isUltraUser));
    };
    updateL8();
    const timer = setInterval(updateL8, 1000);
    window.addEventListener('nst-pedro-overdrive-change', updateL8);
    return () => {
      clearInterval(timer);
      window.removeEventListener('nst-pedro-overdrive-change', updateL8);
    };
  }, [user?.id, user?.level, isUltraUser]);

  const handleActivateL8Overdrive = () => {
    if (!user?.id) return;
    const ok = PedroEngine.activateL8Overdrive(user.id, user.level);
    if (ok) {
      setL8Overdrive(PedroEngine.getL8OverdriveState(user.id, user.level, isUltraUser));
      speakText('Pedro Level 8 Overdrive active ho gaya hai! Agle 24 ghante tak primary study mode me 2x XP aur bonus credits milenge!');
    }
  };

  // Pedro Streak Break Penalty ("Naraj") state
  const [penaltyState, setPenaltyState] = useState<PedroPenaltyState>(() =>
    PedroEngine.getPenaltyState(user?.id, user?.level)
  );

  useEffect(() => {
    const updatePenalty = () => {
      setPenaltyState(PedroEngine.getPenaltyState(user?.id, user?.level));
    };
    updatePenalty();
    window.addEventListener('nst-pedro-penalty-change', updatePenalty);
    window.addEventListener('nst-pedro-naraj', updatePenalty);
    return () => {
      window.removeEventListener('nst-pedro-penalty-change', updatePenalty);
      window.removeEventListener('nst-pedro-naraj', updatePenalty);
    };
  }, [user?.id, user?.level]);

  const rawInbox = user?.inbox || [];
  const now = Date.now();
  const pendingRewards = rawInbox.filter(
    (m: any) =>
      (m.type === 'REWARD' || m.type === 'GIFT' || m.type === 'STORE_DISCOUNT') &&
      !m.isClaimed &&
      (!m.expiresAt || new Date(m.expiresAt).getTime() > now)
  );

  // Detect expiring reward or store discount (< 24 hours)
  const expiringItem = pendingRewards.find((m: any) => {
    if (!m.expiresAt) return false;
    const diff = new Date(m.expiresAt).getTime() - now;
    return diff > 0 && diff <= 24 * 60 * 60 * 1000;
  });

  // Study Mode time calculations
  const studyMins = Math.floor((studyTimerSeconds || 0) / 60);
  const goalMins = Math.max(20, Math.floor((dailyGoalSeconds || 1800) / 60));
  const remainingStudyMins = Math.max(0, goalMins - studyMins);

  // Live Notification state
  const [liveAlert, setLiveAlert] = useState<{ title: string; message: string } | null>(null);
  const [hasAutoClaimed, setHasAutoClaimed] = useState(false);

  // Audio / Speech State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Spotlight State
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Simulation Countdown Toast
  const [simToast, setSimToast] = useState<{ message: string; countdown: number; onCancel: () => void } | null>(null);
  const simTimerRef = useRef<any>(null);

  // Pedro's physical floating coordinate (for opposite-side placement)
  const [pedroX, setPedroX] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('nst_pedro_position');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.x) return parsed.x;
        }
      } catch {}
      return window.innerWidth - 75;
    }
    return 300;
  });

  // Listen to Pedro position changes if user drags the floating logo
  useEffect(() => {
    const handlePosChange = () => {
      try {
        const saved = localStorage.getItem('nst_pedro_position');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.x) setPedroX(parsed.x);
        }
      } catch {}
    };
    window.addEventListener('nst-pedro-pos-change', handlePosChange);
    return () => window.removeEventListener('nst-pedro-pos-change', handlePosChange);
  }, []);

  // Popup is placed on OPPOSITE side of Pedro
  const isPedroOnRight = pedroX > (typeof window !== 'undefined' ? window.innerWidth / 2 : 200);

  // Voice speech synthesis
  const speakText = (text: string, onFinish?: () => void) => {
    if (isMuted) {
      if (onFinish) setTimeout(onFinish, 2000);
      return;
    }
    setIsSpeaking(true);
    pedroSpeak(text, {
      pitch: defaultPitch,
      rate: defaultRate,
      onEnd: () => {
        setIsSpeaking(false);
        if (onFinish) onFinish();
      },
      showBubble: true,
    });
  };

  const stopVoice = () => {
    stopPedroVoice();
    setIsSpeaking(false);
  };

  // Listen to live page notifications and announce them via voice
  useEffect(() => {
    const handleLiveNotif = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const title = detail.title || 'Notification';
      const message = detail.message || '';

      // User requested: Short Alert: "Naya circular aaya hai." (Poora content user khud padhega ya tap par sunega)
      if (!isMuted) {
        pedroSpeak('Naya circular aaya hai.', { rate: 1.1, showBubble: false });
      }
      setLiveAlert({ title, message });
      setTimeout(() => setLiveAlert(null), 8000);
    };
    window.addEventListener('nst_live_notification', handleLiveNotif);
    return () => window.removeEventListener('nst_live_notification', handleLiveNotif);
  }, [isMuted]);

  // On open: Single crisp sentence when user taps Pedro: "Bataiye dost, kya madad karun?"
  useEffect(() => {
    if (isOpen) {
      setActiveMainTab('OPTIONS');
      setSelectedCategory(null);
      setActiveItemTitle(null);
      setShowAskMoreChip(false);
      setSpotlightRect(null);

      // Auto-claim silently for ULTRA users if pending rewards exist
      if (isUltraUser && pendingRewards.length > 0 && !hasAutoClaimed) {
        onAutoClaimRewards?.();
        setHasAutoClaimed(true);
      }

      // User requirement: "bas option bolega itne ke jagah pe user jo option choose kare phir ushke bare me bataye par pehle itna na bolega"
      speakText('Option chuniye.');
    } else {
      stopVoice();
      setSpotlightRect(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
      }
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      setSimToast(null);
      setIsMinimized(false);
    }
  }, [isOpen]);

  // Count active Pro page events
  const activeProEventsCount = useMemo(() => {
    if (!settings) return 0;
    const curNow = Date.now();
    const chk = (en?: boolean, s?: string, e?: string) => {
      if (!en) return false;
      const st = s ? new Date(s).getTime() : 0;
      const en2 = e ? new Date(e).getTime() : Infinity;
      return curNow >= st && curNow < en2;
    };
    let count = 0;
    if (chk(settings?.scoreBoostEvent?.enabled, settings?.scoreBoostEvent?.startsAt, settings?.scoreBoostEvent?.endsAt)) count++;
    if (chk(settings?.specialDiscountEvent?.enabled, settings?.specialDiscountEvent?.startsAt, settings?.specialDiscountEvent?.endsAt)) count++;
    const gf = settings?.globalFreeAccessEvent?.enabled ?? (settings?.isGlobalFreeMode ?? false);
    if (chk(gf, settings?.globalFreeAccessEvent?.startsAt, settings?.globalFreeAccessEvent?.endsAt)) count++;
    const cf = settings?.creditFreeEvent?.enabled ?? (settings?.isCreditFreeEvent ?? false);
    if (chk(cf, (settings?.creditFreeEvent as any)?.startsAt, (settings?.creditFreeEvent as any)?.endsAt)) count++;
    if (chk((settings as any)?.dailyLimitBoostEvent?.enabled, (settings as any)?.dailyLimitBoostEvent?.startsAt, (settings as any)?.dailyLimitBoostEvent?.endsAt)) count++;
    if (chk(settings?.themeStudioEvent?.enabled, settings?.themeStudioEvent?.startsAt, settings?.themeStudioEvent?.endsAt)) count++;
    if (chk(settings?.creditBonusEvent?.enabled, settings?.creditBonusEvent?.startsAt, settings?.creditBonusEvent?.endsAt)) count++;
    return count;
  }, [settings]);

  // Pedro Smart Action Handlers
  const handleClaimOrInspectRewards = () => {
    if (isUltraUser) {
      onAutoClaimRewards?.();
      speakText(`Ultra VIP! Aapke sabhi mailbox rewards auto-claim ho chuke hain!`);
    } else {
      if (onOpenInbox) {
        onOpenInbox();
        onClose();
      }
      speakText(
        pendingRewards.length > 0
          ? `Aapke mailbox mein ${pendingRewards.length} rewards bache hain! Yahan se claim karein!`
          : `Aapka mailbox bilkul update hai!`
      );
    }
  };

  // Required Time: If user is studying inside a lesson, reads the exact page required time and progress
  const handleSpeakStudyModeRules = () => {
    if (activeStudySession?.mode === 'MCQS' || currentPageContext === 'MCQ') {
      speakText('MCQ Practice me koi required reading time nahi hai, bas har question ka sahi answer dekar points score karein!');
      return;
    }
    if (activeStudySession?.isStudying) {
      const reqSec = activeStudySession.requiredSeconds || 30;
      const spentSec = activeStudySession.timeSpentSeconds || 0;
      const remSec = Math.max(0, reqSec - spentSec);
      const title = activeStudySession.lessonTitle || 'is lesson';
      const pageNum = activeStudySession.pageNumber || 1;

      let speech = '';
      if (remSec > 0) {
        speech = `Aap abhi ${title} ke Page ${pageNum} par padh rahe hain. Is page ka required reading time ${reqSec} second hai. Aapne abhi tak ${spentSec} second padh liya hai, aur score unlock karne ke liye ${remSec} second aur dhyan se padhna zaroori hai!`;
      } else {
        speech = `Aap abhi ${title} ke Page ${pageNum} par hain. Is page ka required ${reqSec} second ka reading time poora ho chuka hai! Aapne kul ${spentSec} second padhai ki hai. Ab aap bina score loss ke agle page ya MCQ practice par ja sakte hain!`;
      }
      speakText(speech);
    } else {
      const speech = `Required Time Guide: Jab aap kisi lesson ya study page ko open karte hain, toh full XP aur score ke liye us page ke points ke anusaar minimum reading time zaroori hota hai. Jaise hi aap kisi lesson page par honge, main us page ka live timer aur required time dekh kar bataunga! Aaj ka total study time ${studyMins} minute hai, daily goal ${goalMins} minute ka hai.`;
      speakText(speech);
    }
  };

  // Aaj Ka Routine: Reads live scheduled subjects and tasks directly from routine storage / routine page
  const handleSpeakRoutine = () => {
    const routineLines: string[] = [];

    if (user?.id) {
      try {
        const routineData = loadRoutineData(user.id);
        if (routineData?.routineCategories && routineData.routineCategories.length > 0) {
          routineData.routineCategories.forEach((cat) => {
            const sub = cat.subjects?.[cat.currentSubjectIndex ?? 0];
            if (sub) {
              routineLines.push(`${cat.categoryName || sub.displayName}: Lesson ${sub.currentLessonIndex + 1}`);
            }
          });
        } else if (routineData?.routineSlots && routineData.routineSlots.length > 0) {
          routineData.routineSlots.forEach((slot) => {
            routineLines.push(`${slot.displayName || slot.bookName}: Lesson ${slot.currentLessonIndex + 1}`);
          });
        }
      } catch {}
    }

    const dailyTasks = user?.dailyRoutine?.tasks;
    const taskDescriptions: string[] = [];
    if (Array.isArray(dailyTasks) && dailyTasks.length > 0) {
      dailyTasks.slice(0, 3).forEach((t: any) => {
        taskDescriptions.push(`${t.title} (${t.duration} min)`);
      });
    }

    let speech = '';
    if (routineLines.length > 0) {
      speech = `Routine page ke anusaar, aaj aapke yeh study tracks scheduled hain: ${routineLines.join(', ')}. ${
        taskDescriptions.length > 0 ? `Saath hi practice tasks: ${taskDescriptions.join(', ')}.` : ''
      } Routine poora karke maximum XP aur coins boost karein!`;
    } else if (taskDescriptions.length > 0) {
      speech = `Aaj aapke daily routine mein yeh tasks scheduled hain: ${taskDescriptions.join(', ')}. Routine ke anusaar padhai jaari rakhein!`;
    } else {
      speech = `Aapne abhi tak Routine page par subjects ya slots set nahi kiye hain. Routine button par tap karke apna daily schedule set karein!`;
    }

    speakText(speech);
    if (onOpenRoutine) {
      setTimeout(() => {
        onOpenRoutine();
        onClose();
      }, 3500);
    }
  };

  // Live Events on Pro Page: Announces all live and upcoming events with discount % & perks
  const handleSpeakEvents = () => {
    const curTime = Date.now();
    const activeList: string[] = [];
    const upcomingList: string[] = [];

    const checkLive = (en?: boolean, start?: string, end?: string) => {
      if (!en) return false;
      const st = start ? new Date(start).getTime() : 0;
      const enTime = end ? new Date(end).getTime() : Infinity;
      return curTime >= st && curTime < enTime;
    };

    const checkUpcoming = (en?: boolean, start?: string, end?: string) => {
      if (!en || !start) return false;
      const st = new Date(start).getTime();
      const enTime = end ? new Date(end).getTime() : Infinity;
      return st > curTime && curTime < enTime;
    };

    // 1. Discount event
    const disc = settings?.specialDiscountEvent;
    if (checkLive(disc?.enabled, disc?.startsAt, disc?.endsAt)) {
      activeList.push(`Special Discount Sale (${disc?.eventName || 'Mega Sale'} - ${disc?.discountPercent || 20}% OFF)`);
    } else if (checkUpcoming(disc?.enabled, disc?.startsAt, disc?.endsAt)) {
      upcomingList.push(`Discount Sale (${disc?.eventName || 'Sale'})`);
    }

    // 2. Score Boost
    const sb = settings?.scoreBoostEvent;
    if (checkLive(sb?.enabled, sb?.startsAt, sb?.endsAt)) {
      activeList.push('Score Boost Event (2x Extra XP Multiplier)');
    } else if (checkUpcoming(sb?.enabled, sb?.startsAt, sb?.endsAt)) {
      upcomingList.push('Score Boost Event');
    }

    // 3. Global Free Access
    const gf = settings?.globalFreeAccessEvent?.enabled ?? (settings?.isGlobalFreeMode ?? false);
    if (checkLive(gf, settings?.globalFreeAccessEvent?.startsAt, settings?.globalFreeAccessEvent?.endsAt)) {
      activeList.push('Global Free Access Event (Sabhi content muft)');
    }

    // 4. Credit Free
    const cf = settings?.creditFreeEvent?.enabled ?? (settings?.isCreditFreeEvent ?? false);
    if (checkLive(cf, (settings?.creditFreeEvent as any)?.startsAt, (settings?.creditFreeEvent as any)?.endsAt)) {
      activeList.push('Credit Free Event (Bina coins kharch kiye unlock)');
    }

    // 5. Daily Limit Boost
    const lb = (settings as any)?.dailyLimitBoostEvent;
    if (checkLive(lb?.enabled, lb?.startsAt, lb?.endsAt)) {
      activeList.push('Daily Limit Boost Event (Extra practice limit)');
    }

    // 6. Theme Studio
    const ts = settings?.themeStudioEvent;
    if (checkLive(ts?.enabled, ts?.startsAt, ts?.endsAt)) {
      activeList.push(`Theme Studio Event (${ts?.eventName || 'Custom Themes'})`);
    }

    // 7. Credit Bonus
    const cb = settings?.creditBonusEvent;
    if (checkLive(cb?.enabled, cb?.startsAt, cb?.endsAt)) {
      activeList.push(`Credit Bonus Event (+${cb?.bonusPercent || 25}% Extra Coins)`);
    }

    let speech = '';
    if (activeList.length > 0) {
      speech = `Pro page par abhi yeh live events chal rahe hain: ${activeList.join(', ')}! Pro page par jakar in special discounts aur boosts ka turant fayda uthayein!`;
    } else if (upcomingList.length > 0) {
      speech = `Pro page par koi event abhi live nahi hai, lekin agle events jald shuru ho rahe hain: ${upcomingList.join(', ')}!`;
    } else {
      speech = `Filhaal Pro page par koi live discount ya boost event active nahi hai. Naye special events aate hi main aapko turant alert kar doonga!`;
    }

    speakText(speech);
    if (onNavigateTab) {
      setTimeout(() => {
        onNavigateTab('PRO');
        onClose();
      }, 3500);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopVoice();
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, []);

  // Spotlight and Pedro flight gesture helper ("jo bhi feature dikhayega khud ja ke dikhayega na ki ek hand alag se aayega")
  const pointAndSpotlight = (selector: string | undefined, callback?: () => void) => {
    if (!selector) {
      if (callback) callback();
      return;
    }
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      if (callback) callback();
      return;
    }

    // Smoothly center element into viewport
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });

      // Fly Pedro mascot himself directly to the target element
      const pedroSize = 72;
      let targetX = rect.right + 10;
      let targetY = rect.top + rect.height / 2 - pedroSize / 2;

      // If element is near right edge, place Pedro on the left
      if (targetX + pedroSize > window.innerWidth - 10) {
        targetX = Math.max(10, rect.left - pedroSize - 10);
      }
      // If element is wide (cards, banners), place Pedro below or above
      if (rect.width > 220) {
        targetX = Math.min(window.innerWidth - pedroSize - 16, Math.max(16, rect.left + rect.width / 2 - pedroSize / 2));
        targetY = rect.bottom + 10;
        if (targetY + pedroSize > window.innerHeight - 80) {
          targetY = Math.max(70, rect.top - pedroSize - 10);
        }
      }

      // Clamp to screen bounds
      targetX = Math.max(10, Math.min(window.innerWidth - pedroSize - 10, targetX));
      targetY = Math.max(65, Math.min(window.innerHeight - pedroSize - 80, targetY));

      // Dispatch event to smoothly fly Pedro over and point directly at the element!
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nst-pedro-fly-to', {
            detail: {
              x: targetX,
              y: targetY,
              isPointing: true,
              elementRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            }
          })
        );
      }

      // Allow Pedro time to arrive and gesture before speaking/acting
      setTimeout(() => {
        if (callback) callback();
      }, 450);
    }, 350);
  };

  // Helper to smoothly bring the menu back up after Pedro finishes explaining a feature
  const restoreMenuAfterDemo = (extraSpeech: string = 'Any doubt?') => {
    setIsMinimized(false);
    setShowAskMoreChip(true);
    if (extraSpeech) {
      speakText(extraSpeech);
    }
  };

  // Interactive Demonstration Handler
  const executeSimulation = (item: PedroItemDetail) => {
    const action = item.actionKey;

    if (action === 'SIMULATE_APP_LOGO') {
      pointAndSpotlight('#nsta-header-brand-btn', () => {
        onTriggerAction?.('DEMO_APP_LOGO');
        speakText(item.speechText, () => {
          restoreMenuAfterDemo('Any doubt?');
        });
      });
    } else if (action === 'READ_ROW2_NAME') {
      pointAndSpotlight('#topbar-row2-greeting', () => {
        const row2El = document.getElementById('topbar-row2-greeting');
        const stName = row2El?.getAttribute('data-student-name') || userName || 'Student';
        speakText(`Hey ${stName}! Yeh Row 2 par aapka greeting aur student naam hai.`, () => {
          restoreMenuAfterDemo('Any doubt?');
        });
      });
    } else if (action === 'SIMULATE_EVENTS') {
      pointAndSpotlight('#topbar-events-btn', () => {
        onTriggerAction?.('OPEN_EVENTS');
        speakText(item.speechText, () => {
          startCountdown('Auto-closing Live Events...', 4, () => {
            onTriggerAction?.('CLOSE_EVENTS');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Live Events drawer band ho gaya! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_STATUS_DOTS') {
      pointAndSpotlight('#topbar-status-dots-btn', () => {
        onTriggerAction?.('OPEN_STATUS_DOTS');
        speakText(item.speechText, () => {
          startCountdown('Auto-closing System Health...', 4, () => {
            onTriggerAction?.('CLOSE_STATUS_DOTS');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('System health status band ho gaya! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_BOARD_DROPDOWN') {
      pointAndSpotlight('#topbar-3dots-btn', () => {
        onTriggerAction?.('OPEN_BOARD_DROPDOWN');
        speakText(item.speechText, () => {
          startCountdown('Auto-closing Board Switcher...', 4, () => {
            onTriggerAction?.('CLOSE_BOARD_DROPDOWN');
            onTriggerAction?.('CLOSE_3DOTS');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Board switcher band ho gaya! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_PEDRO_RESTORE') {
      pointAndSpotlight('#topbar-docked-pedro-btn', () => {
        onTriggerAction?.('RESTORE_PEDRO');
        speakText(item.speechText, () => {
          restoreMenuAfterDemo('Any doubt?');
        });
      });
    } else if (action === 'SIMULATE_3DOTS') {
      // 1. Point at 3-dots button
      pointAndSpotlight('#topbar-3dots-btn', () => {
        // 2. Open drawer live
        onTriggerAction?.('OPEN_3DOTS');
        // 3. Speak explanation
        speakText(item.speechText, () => {
          // 4. Countdown to close
          startCountdown('Auto-closing 3-dot menu...', 4, () => {
            onTriggerAction?.('CLOSE_3DOTS');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('3-dot menu band ho gaya! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_APP_GUIDE') {
      pointAndSpotlight('#topbar-app-guide-btn', () => {
        onTriggerAction?.('OPEN_GUIDE');
        speakText(item.speechText, () => {
          startCountdown('Auto-closing App Guide...', 4, () => {
            onTriggerAction?.('CLOSE_GUIDE');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_MAILBOX') {
      pointAndSpotlight('#topbar-mail-btn', () => {
        onTriggerAction?.('OPEN_INBOX');
        speakText(item.speechText, () => {
          startCountdown('Auto-closing Mailbox...', 4, () => {
            onTriggerAction?.('CLOSE_INBOX');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_WHEEL') {
      pointAndSpotlight('#nsta-quick-fab', () => {
        onTriggerAction?.('OPEN_WHEEL');
        speakText(item.speechText, () => {
          startCountdown('Auto-closing Feature Wheel...', 4, () => {
            onTriggerAction?.('CLOSE_WHEEL');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Wheel band ho gaya! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_ROUTINE') {
      pointAndSpotlight('#home-routine-card', () => {
        onTriggerAction?.('DEMO_ROUTINE');
        speakText(item.speechText, () => {
          startCountdown('Home screen wapas ja rahe hain...', 4, () => {
            onTriggerAction?.('GO_HOME');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Home par wapas aa gaye! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_REVISION') {
      pointAndSpotlight('#home-revision-card', () => {
        onTriggerAction?.('DEMO_REVISION');
        speakText(item.speechText, () => {
          startCountdown('Home screen wapas ja rahe hain...', 4, () => {
            onTriggerAction?.('GO_HOME');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Home par wapas aa gaye! Any doubt?');
          });
        });
      });
    } else if (action === 'SIMULATE_COMPETITION') {
      pointAndSpotlight('#home-competition-card', () => {
        onTriggerAction?.('DEMO_COMPETITION');
        speakText(item.speechText, () => {
          startCountdown('Home screen wapas ja rahe hain...', 4, () => {
            onTriggerAction?.('GO_HOME');
            setSpotlightRect(null);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
            }
            restoreMenuAfterDemo('Home par wapas aa gaye! Any doubt?');
          });
        });
      });
    } else {
      // General item spotlight & speech
      pointAndSpotlight(item.targetSelector, () => {
        speakText(item.speechText, () => {
          restoreMenuAfterDemo('Any doubt?');
        });
      });
    }
  };

  // Countdown Helper for auto-returning
  const startCountdown = (message: string, durationSec: number, onComplete: () => void) => {
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    let remaining = durationSec;

    setSimToast({
      message,
      countdown: remaining,
      onCancel: () => {
        if (simTimerRef.current) clearInterval(simTimerRef.current);
        setSimToast(null);
        setSpotlightRect(null);
        setIsMinimized(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
        }
      }
    });

    simTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(simTimerRef.current);
        setSimToast(null);
        onComplete();
      } else {
        setSimToast(prev => prev ? { ...prev, countdown: remaining } : null);
      }
    }, 1000);
  };

  // Category Selection
  const handleSelectCategory = (cat: PedroCategory) => {
    setShowAskMoreChip(false);

    // Rule: "aur jab ek hi option higa tab bas wahi bata ke bolega aur kuvhh janna hai"
    if (cat.items.length === 1) {
      const singleItem = cat.items[0];
      setSelectedCategory(null);
      setActiveItemTitle(cat.title);
      setIsMinimized(true);
      executeSimulation(singleItem);
      return;
    }

    // Multiple sub-items (e.g. Top Bar)
    setSelectedCategory(cat);
    setActiveItemTitle(cat.title);
    setIsMinimized(false);

    // Spotlight the top-level element (e.g. #top-banner-container) and speak intro
    pointAndSpotlight(cat.targetSelector, () => {
      speakText(cat.speechText || `${cat.title}! Isme yeh options hain, kaunsa dekhna hai?`);
    });
  };

  // Sub-item Selection
  const handleSelectItem = (item: PedroItemDetail) => {
    setShowAskMoreChip(false);
    setActiveItemTitle(item.title);
    setIsMinimized(true);
    executeSimulation(item);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* ── 1. SPOTLIGHT RING OVER TARGET ELEMENT ── */}
      {spotlightRect && (
        <div
          className="fixed pointer-events-none z-[99990] transition-all duration-500 rounded-2xl"
          style={{
            top: `${Math.max(4, spotlightRect.top - 4)}px`,
            left: `${Math.max(4, spotlightRect.left - 4)}px`,
            width: `${spotlightRect.width + 8}px`,
            height: `${spotlightRect.height + 8}px`,
            boxShadow: '0 0 0 3px #f59e0b, 0 0 32px rgba(245, 158, 11, 0.85)',
            border: '2px solid #fbbf24',
            animation: 'pulse 1.8s infinite'
          }}
        >
          <div className="absolute -top-3.5 left-2 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-lg flex items-center gap-1 animate-bounce">
            <span>🎯</span>
            <span>Pedro Live Focus</span>
          </div>
        </div>
      )}

      {/* ── 2. STUDENT-FRIENDLY FLOATING PEDRO GUIDE MENU (SLIDES DOWN 95% WHEN VIEWING FEATURE) ── */}
      <div
        style={{
          position: 'fixed',
          bottom: isMinimized ? '0px' : '16px',
          left: '50%',
          transform: isMinimized
            ? 'translate(-50%, calc(100% - 46px))'
            : 'translate(-50%, 0)',
          width: 'calc(100vw - 20px)',
          maxWidth: '500px',
          zIndex: 99980,
          transition: 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.35s ease'
        }}
        className="pointer-events-auto select-none"
      >
        {/* Live Notification Pill (if any and not minimized) */}
        {!isMinimized && liveAlert && (
          <div className="mb-2 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/50 backdrop-blur-md flex items-center gap-2 text-xs text-amber-200 shadow-lg">
            <Bell size={13} className="text-amber-400 shrink-0" />
            <span className="font-bold text-[11px] truncate">{liveAlert.title}:</span>
            <span className="text-[10px] text-amber-100 truncate">{liveAlert.message}</span>
          </div>
        )}

        {/* Sim Countdown Bar (if running simulation countdown and not minimized) */}
        {!isMinimized && simToast && (
          <div className="mb-2 px-3.5 py-2 rounded-2xl bg-slate-900/95 border-2 border-amber-400 shadow-xl backdrop-blur-md flex items-center justify-between gap-2 text-xs text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div className="truncate">
                <span className="font-black text-amber-300 text-xs block truncate">{simToast.message}</span>
                <span className="text-[10px] text-slate-300">Wapas aane me: <b className="text-white">{simToast.countdown}s</b></span>
              </div>
            </div>
            <button
              onClick={simToast.onCancel}
              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 active:scale-95 transition-transform cursor-pointer"
            >
              Yahin Rahein
            </button>
          </div>
        )}

        {/* ── CARD CONTAINER ── */}
        <div className="bg-slate-950/95 text-white rounded-3xl border border-purple-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(168,85,247,0.25)] backdrop-blur-2xl p-3 sm:p-3.5 relative overflow-hidden">
          {/* ── 5% PEEK HANDLE (VISIBLE AT BOTTOM OF SCREEN WHEN MINIMIZED 95%) ── */}
          {isMinimized && (
            <div
              onClick={() => setIsMinimized(false)}
              className="h-10 px-3.5 flex items-center justify-between cursor-pointer bg-gradient-to-r from-amber-500/25 via-purple-600/30 to-amber-500/25 border-b border-amber-400/40 rounded-t-2xl -mx-3 -mt-3 sm:-mx-3.5 sm:-mt-3.5 mb-2 hover:bg-amber-500/35 active:scale-[0.99] transition-all"
              title="Tap karke menu wapis upar layein"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base animate-bounce">🤖</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <p className="text-xs font-black text-amber-300 truncate">
                    Pedro dikha raha hai: <span className="text-white font-bold">{activeItemTitle || selectedCategory?.title || 'Feature'}</span>
                    {simToast ? <span className="text-amber-200 text-[11px] ml-1.5 font-normal">({simToast.countdown}s)</span> : null}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(false);
                  }}
                  className="px-2.5 py-1 rounded-full text-[10.5px] font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 flex items-center gap-1 shadow cursor-pointer active:scale-95 transition-transform"
                >
                  <ChevronUp size={12} className="stroke-[3]" />
                  <span>Wapis Kholein</span>
                </button>
              </div>
            </div>
          )}

          {selectedCategory ? (
            /* ════════ SUB-MENU: LIST OF FEATURES FOR SELECTED CATEGORY (e.g. TOP BAR) ════════ */
            <div className="space-y-2 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setActiveItemTitle(null);
                      setSpotlightRect(null);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('nst-pedro-return-home'));
                      }
                      speakText('Home screen ke doosre options chuniye!');
                    }}
                    className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 text-xs font-bold flex items-center gap-1 shrink-0 border border-white/15 active:scale-95 transition-all cursor-pointer"
                    title="Wapas options par jayein"
                  >
                    <ArrowLeft size={13} />
                    <span>Wapas</span>
                  </button>

                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{selectedCategory.icon}</span>
                    <span className="font-black text-xs sm:text-sm text-white truncate">
                      {selectedCategory.title} ke Features
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-500/25 text-purple-300 border border-purple-400/30 shrink-0">
                      {selectedCategory.items.length}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Minimize button */}
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title="Niche karein (95% down)"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {/* Voice toggle */}
                  <button
                    onClick={() => {
                      if (isMuted) {
                        setIsMuted(false);
                        speakText('Voice chalu ho gaya!');
                      } else {
                        stopVoice();
                        setIsMuted(true);
                      }
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isMuted ? 'text-red-300 bg-red-500/20' : 'text-purple-200 bg-purple-500/20 hover:bg-purple-500/30'
                    }`}
                    title={isMuted ? "Unmute Voice" : "Mute Voice"}
                  >
                    {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Guide prompt */}
              <div className="px-1 text-[11px] text-slate-300 flex items-center justify-between">
                <span>🎯 Feature par tap karein, Pedro live point karega:</span>
                {activeItemTitle && (
                  <span className="text-[10px] font-bold text-amber-400 animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Live Dekh Rahe Hain
                  </span>
                )}
              </div>

              {/* Scrollable Features List */}
              <div className="max-h-56 sm:max-h-64 overflow-y-auto space-y-1.5 pr-0.5 nst-scrollbar-none">
                {(selectedCategory?.items || []).map((item, index) => {
                  const isActive = activeItemTitle === item.title;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`w-full text-left p-2 sm:p-2.5 rounded-2xl transition-all border flex items-center gap-2.5 active:scale-[0.98] cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500/25 via-purple-500/20 to-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
                      }`}
                    >
                      {/* Number & Icon badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          isActive ? 'bg-amber-400 text-slate-950 font-black' : 'bg-white/10 text-slate-400'
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-lg leading-none">{item.icon}</span>
                      </div>

                      {/* Title & Summary */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold text-xs sm:text-[13px] leading-tight truncate ${
                            isActive ? 'text-amber-300 font-black' : 'text-white'
                          }`}>
                            {item.title}
                          </p>
                        </div>
                        {item.summary && (
                          <p className="text-[10.5px] sm:text-[11px] text-slate-300/90 leading-tight mt-0.5 line-clamp-1">
                            {item.summary}
                          </p>
                        )}
                      </div>

                      {/* Status pill */}
                      <div className="shrink-0">
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                            Focus
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-slate-300 hover:text-white">
                            Dekhein ➔
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ════════ MAIN MENU: TABS (GUIDE, POWERS, RULES, ENERGY) ════════ */
            <div className="space-y-2 animate-in fade-in duration-200">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0 animate-pedro-hover">🤖</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-black text-xs sm:text-sm text-white leading-tight">
                        Pedro AI Assistant
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-sm flex items-center gap-1">
                        <span>⚡ L{effectiveLevel}</span>
                        <span>{levelConfig.badge}</span>
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-300 truncate">
                      {levelConfig.title} • {energyStatus.isSleeping ? '😴 Power Sleep' : '🔋 100% Active'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Minimize button */}
                  <button
                    onClick={() => setIsMinimized(true)}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title="Niche karein (95% down)"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {/* Voice toggle */}
                  <button
                    onClick={() => {
                      if (isMuted) {
                        setIsMuted(false);
                        speakText('Voice chalu ho gaya!');
                      } else {
                        stopVoice();
                        setIsMuted(true);
                      }
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isMuted ? 'text-red-300 bg-red-500/20' : 'text-purple-200 bg-purple-500/20 hover:bg-purple-500/30'
                    }`}
                    title={isMuted ? "Unmute Voice" : "Mute Voice"}
                  >
                    {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                  </button>

                  {/* Close button */}
                  <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Quick Info Pill: Pedro Guide moved to 3-Dot Menu */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-400/20 text-[11px] text-purple-200">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span>💡</span>
                  <span className="truncate">Pedro <b>Levels, Powers & Energy</b> Guide 3-Dot (⋮) Menu me hai</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setInternalSystemGuideOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold text-[10px] border border-amber-400/40 transition shrink-0 cursor-pointer"
                >
                  Kholein ➔
                </button>
              </div>

              {/* SCREEN FEATURE GUIDE CATEGORIES */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-52 sm:max-h-56 overflow-y-auto pr-0.5 nst-scrollbar-none">
                  {(pageConfig?.categories || []).map((cat) => {
                    const isActive = activeItemTitle === cat.title;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat)}
                        className={`p-2 rounded-2xl text-left border transition-all active:scale-95 flex flex-col justify-between cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-br from-purple-600/30 to-pink-600/30 border-purple-400 text-white shadow-md'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-100 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xl">{cat.icon}</span>
                          {(cat.items || []).length > 1 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/25 text-purple-300 border border-purple-400/25">
                              {(cat.items || []).length} features
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-xs leading-tight truncate text-white">
                          {cat.title}
                        </p>
                        {cat.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                            {cat.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>










            </div>
          )}
        </div>
      </div>

      {/* ══════════════════ PEDRO SYSTEM GUIDE MODAL (3-DOT MENU) ══════════════════ */}
      {effectiveSystemGuideOpen && (
        <div
          id="pedro-system-guide-modal-overlay"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseSystemGuide();
            }
          }}
        >
          <div
            id="pedro-system-guide-modal-card"
            className="relative w-full max-w-lg bg-slate-900/95 border border-purple-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-100"
          >
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-400 to-purple-600 flex items-center justify-center text-lg shadow-md border border-white/20 shrink-0">
                  🤖
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base text-white flex items-center gap-1.5">
                    <span>Pedro System Guide</span>
                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-black bg-purple-500/30 text-purple-200 border border-purple-400/30 uppercase">
                      3-Dot
                    </span>
                  </h4>
                  <p className="text-[10.5px] text-slate-400">
                    Pedro Levels, Powers & Energy system guide
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="close-pedro-system-guide-btn"
                onClick={handleCloseSystemGuide}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 3 Main Tabs: Levels, Powers, Energy */}
            <div className="grid grid-cols-3 p-1.5 bg-slate-950/70 border-b border-white/10 text-xs shrink-0 gap-1">
              <button
                type="button"
                id="system-guide-tab-levels"
                onClick={() => setSystemGuideTab('LEVELS')}
                className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  systemGuideTab === 'LEVELS'
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/50 text-amber-300 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>📈</span>
                <span className="truncate">Levels</span>
              </button>

              <button
                type="button"
                id="system-guide-tab-powers"
                onClick={() => setSystemGuideTab('POWERS')}
                className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  systemGuideTab === 'POWERS'
                    ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/50 text-purple-300 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>⚡</span>
                <span className="truncate">Powers</span>
              </button>

              <button
                type="button"
                id="system-guide-tab-energy"
                onClick={() => setSystemGuideTab('ENERGY')}
                className={`py-2 px-1 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  systemGuideTab === 'ENERGY'
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/50 text-emerald-300 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>🔋</span>
                <span className="truncate">Energy</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="p-3.5 sm:p-4 overflow-y-auto space-y-3.5 text-xs nst-scrollbar-none flex-1">
              {/* ═════════ TAB 1: PEDRO LEVELS (HOW THEY INCREASE) ═════════ */}
              {systemGuideTab === 'LEVELS' && (
                <div className="space-y-3">
                  {/* How Levels Increase Card */}
                  <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-950/40 via-purple-950/40 to-slate-950 border border-amber-400/30 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📈</span>
                      <h5 className="font-black text-xs sm:text-sm text-white">
                        Pedro Ka Level Kaise Badhta Hai?
                      </h5>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Pedro aapki study activity ka real-time companion hai. Jab aap app me padhte hain aur study tasks complete karte hain:
                    </p>
                    <ul className="text-[11px] text-slate-300 space-y-1 pl-4 list-disc">
                      <li><b>Study Hours & XP:</b> Notes, PDF, Video, Audio aur Study Modes me padhne par XP milta hai.</li>
                      <li><b>Tasks Completion:</b> Daily assignments aur quiz complete karne par Pedro ka progression speed up hota hai.</li>
                      <li><b>Level 1 se 8:</b> Jaise XP threshold cross hoti hai, Pedro level-up ho kar new looks aur powers unlock karta hai!</li>
                    </ul>
                  </div>

                  {/* Current Student Progress Card */}
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{levelConfig.icon}</span>
                        <div>
                          <h6 className="font-black text-white text-xs">
                            Aapka Current Pedro: Level {effectiveLevel} ({levelConfig.title})
                          </h6>
                          <p className="text-[10px] text-amber-200">{levelConfig.badge}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        {user?.studyXp || user?.totalScore || 0} XP
                      </span>
                    </div>

                    {levelConfig.nextLevelXp && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Next Level Target:</span>
                          <span className="text-white font-bold">{levelConfig.nextLevelXp} XP</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(100, Math.round(((user?.studyXp || user?.totalScore || 0) / levelConfig.nextLevelXp) * 100))}%`
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top Bar Migration Rules */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-cyan-400/20 space-y-1.5">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold">
                      <span>🔝</span>
                      <span>Level-Up Top Bar Automation:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      • <b>Level 1</b>: Top bar par Streak aur Mailbox dono buttons normal visible rehte hain.<br/>
                      • <b>Level 2</b>: Streak button top bar se gayab ho jata hai aur Pedro khud daily streak announce karta hai.<br/>
                      • <b>Level 5</b>: Mailbox button gayab ho jata hai kyunki Pedro background me automatic free mailbox rewards claim kar leta hai!
                    </p>
                  </div>

                  {/* Streak Break Penalty & Proportional Recovery */}
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-red-950/40 to-slate-900/60 border border-red-500/30 space-y-1.5">
                    <div className="flex items-center gap-2 text-red-300 font-bold">
                      <span>😠</span>
                      <span>Streak Break Penalty & Proportional Recovery:</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      • <b>24 Ghante Miss Hone Par</b>: Streak break hoti hai aur Pedro ka level 1 step drop hota hai.<br/>
                      • <b>Proportional Recovery Formula</b>: Wapas us level par pahuchne ke liye target level se 1 kam din (<b>Target Level - 1 din</b>) lagatar daily study karni hogi.<br/>
                      • <b>Naraj Look</b>: Penalty ke dauran Pedro naraj muh latka leta hai jab tak recovery complete na ho.
                    </p>
                  </div>

                  {/* All 8 Levels Roadmap */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      📜 All 8 Levels Progression Roadmap:
                    </span>
                    {(PEDRO_LEVELS || []).map((lvl) => {
                      const isUnlocked = effectiveLevel >= lvl.level;
                      return (
                        <div
                          key={lvl.level}
                          className={`p-2.5 rounded-xl border transition-all ${
                            isUnlocked
                              ? lvl.level === effectiveLevel
                                ? 'bg-amber-500/15 border-amber-400/60 shadow-sm'
                                : 'bg-white/5 border-emerald-500/30'
                              : 'bg-white/[0.02] border-white/5 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-base shrink-0">{lvl.icon}</span>
                              <span className="font-bold text-white text-xs truncate">
                                Level {lvl.level}: {lvl.title}
                              </span>
                            </div>
                            <span
                              className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 ${
                                isUnlocked
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                  : 'bg-slate-800 text-slate-400 border border-white/10'
                              }`}
                            >
                              {isUnlocked ? <Unlock size={10} /> : <Lock size={10} />}
                              <span>{isUnlocked ? 'Unlocked' : `${lvl.minXp || lvl.minScore || 0} XP`}</span>
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-300 leading-snug">
                            {lvl.description || lvl.summary}
                          </p>
                          {lvl.visualLook && (
                            <div className="mt-1 flex items-center gap-1 text-[9.5px] text-amber-300/90 font-medium">
                              <span className="shrink-0">🎨</span>
                              <span>Mascot Look: {lvl.visualLook}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═════════ TAB 2: POWERS (UNLOCKED POWERS & OVERDRIVE) ═════════ */}
              {systemGuideTab === 'POWERS' && (
                <div className="space-y-3">
                  {/* Current Active Powers */}
                  <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⚡</span>
                        <h5 className="font-black text-xs sm:text-sm text-white">
                          Level {effectiveLevel} Active Powers
                        </h5>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30">
                        {levelConfig.title}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {(levelConfig?.powers || (levelConfig as any)?.perks || []).map((perk: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-200">
                          <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                          <span className="truncate">{perk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Level 7: 3D Color Scheme Selector */}
                  <div className="p-3 rounded-2xl bg-slate-950/70 border border-cyan-400/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎨</span>
                        <span className="text-xs font-black text-white">Pedro 3D Color Scheme (Level 7 Perk)</span>
                      </div>
                      {effectiveLevel >= 7 ? (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          Unlocked
                        </span>
                      ) : (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10 flex items-center gap-1">
                          <Lock size={9} />
                          <span>Unlocks at Level 7</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10.5px] text-slate-300">
                      Level 7 aur Ultra VIP members Pedro ka 3D material color switch kar sakte hain:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={effectiveLevel < 7}
                        onClick={() => handleSetColorScheme('classic')}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                          pedroColorScheme === 'classic'
                            ? 'bg-purple-600/30 border-purple-400 shadow-md ring-1 ring-purple-400'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        } ${effectiveLevel < 7 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-400 border border-white/40 shrink-0" />
                        <div className="text-left min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">Cosmic Purple</div>
                          <div className="text-[9.5px] text-purple-200">Classic Theme</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        disabled={effectiveLevel < 7}
                        onClick={() => handleSetColorScheme('cyber')}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                          pedroColorScheme === 'cyber'
                            ? 'bg-cyan-600/30 border-cyan-400 shadow-md ring-1 ring-cyan-400'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        } ${effectiveLevel < 7 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-400 to-emerald-400 border border-white/40 shrink-0" />
                        <div className="text-left min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">Cyber Cyan</div>
                          <div className="text-[9.5px] text-cyan-200">Neon Future</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Level 8 Supreme Overdrive */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    l8Overdrive.isActive
                      ? 'bg-gradient-to-br from-amber-950/70 via-orange-950/60 to-red-950/70 border-amber-400/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-400/40'
                      : l8Overdrive.canActivate
                      ? 'bg-gradient-to-br from-emerald-950/70 via-slate-900/90 to-teal-950/70 border-emerald-400/60 shadow-lg shadow-emerald-500/10'
                      : 'bg-slate-900/90 border-slate-700/50'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xl shrink-0">
                          {l8Overdrive.isActive ? '🔥' : l8Overdrive.canActivate ? '⚡' : '🔋'}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-white">
                              Level 8: Supreme Overdrive
                            </span>
                            {l8Overdrive.isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider animate-pulse">
                                24H Boost Active
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-300">
                            Primary Study Mode: <b>2x XP (Double Score)</b> + <b>100% Free Credits</b>
                          </p>
                        </div>
                      </div>

                      <div>
                        {l8Overdrive.isActive ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                            Active
                          </span>
                        ) : l8Overdrive.canActivate ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                            Charged (100%)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-white/10">
                            Recharging
                          </span>
                        )}
                      </div>
                    </div>

                    {l8Overdrive.isActive && (
                      <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-amber-400/30 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-amber-200 font-bold flex items-center gap-1">
                            <span>⏱️</span>
                            <span>Overdrive Timer:</span>
                          </span>
                          <span className="font-mono font-black text-white bg-amber-500/20 px-2 py-0.5 rounded text-xs border border-amber-400/30">
                            {String(l8Overdrive.hoursRemaining).padStart(2, '0')}h : {String(l8Overdrive.minutesRemaining).padStart(2, '0')}m : {String(l8Overdrive.secondsRemaining % 60).padStart(2, '0')}s
                          </span>
                        </div>
                        <p className="text-[10px] text-amber-100/90 leading-relaxed">
                          ⚡ Saare study modes me har XP par <b>double XP</b> mil raha hai aur barabar <b>bonus credits</b> wallet me credit ho rahe hain!
                        </p>
                      </div>
                    )}

                    {l8Overdrive.isCharging && (
                      <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-300">Recharge Cycle:</span>
                          <span className="font-bold text-amber-300">
                            {l8Overdrive.chargePercent}% Charged ({l8Overdrive.chargeDaysRemaining} din baaki)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${l8Overdrive.chargePercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {l8Overdrive.canActivate && (
                      <div className="mt-2 p-2 rounded-xl bg-slate-950/70 border border-emerald-400/30 space-y-2">
                        <p className="text-[10.5px] text-emerald-200">
                          🌟 Overdrive 100% ready hai! Tap karke 24H boost shuru karein:
                        </p>
                        <button
                          type="button"
                          onClick={handleActivateL8Overdrive}
                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>🔥</span>
                          <span>Activate 24H Level 8 Overdrive Now</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═════════ TAB 3: ENERGY & POWER SLEEP ═════════ */}
              {systemGuideTab === 'ENERGY' && (
                <div className="space-y-3">
                  {/* Energy Battery Card */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    energyStatus.isSleeping
                      ? 'bg-gradient-to-br from-purple-950/70 to-slate-950 border-purple-500/50 shadow-lg'
                      : 'bg-gradient-to-br from-emerald-950/50 to-slate-950 border-emerald-500/50 shadow-lg'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl animate-bounce">
                          {energyStatus.isSleeping ? '😴' : '⚡'}
                        </span>
                        <div>
                          <h5 className="font-black text-sm text-white flex items-center gap-1.5">
                            <span>Pedro Energy:</span>
                            <span className={energyStatus.isSleeping ? 'text-amber-400' : 'text-emerald-400'}>
                              {energyStatus.isSleeping ? 'Power Sleep (Zzz)' : '100% Full Power'}
                            </span>
                          </h5>
                          <p className="text-[10.5px] text-slate-300">
                            {energyStatus.message}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider ${
                        energyStatus.isSleeping
                          ? 'bg-amber-400 text-slate-950 animate-pulse'
                          : 'bg-emerald-500 text-slate-950'
                      }`}>
                        {energyStatus.energyPercent}%
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10 mb-2">
                      <div
                        className={`h-full transition-all duration-500 ${
                          energyStatus.isSleeping
                            ? 'bg-gradient-to-r from-purple-600 to-amber-500'
                            : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
                        }`}
                        style={{ width: `${Math.max(5, energyStatus.energyPercent)}%` }}
                      />
                    </div>

                    {energyStatus.isSleeping && (
                      <div className="p-2 rounded-xl bg-purple-900/30 border border-purple-400/30 space-y-1">
                        <div className="flex items-center justify-between text-[10.5px]">
                          <span className="text-purple-200 font-bold">Wake Up Study Goal:</span>
                          <span className="font-black text-amber-300">
                            {energyStatus.reviveStudyMinsDone} / {energyStatus.reviveStudyMinsRequired} Mins
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
                          <div
                            className="h-full bg-amber-400 transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.round((energyStatus.reviveStudyMinsDone / energyStatus.reviveStudyMinsRequired) * 100))}%`
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-300">
                          Study Mode me 15 minute padhein ya neeche diye button se jagayein!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Energy Action Controls */}
                  <div className="grid grid-cols-2 gap-2">
                    {energyStatus.isSleeping ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            PedroEngine.revivePedro(user?.id);
                            setEnergyStatus(PedroEngine.getEnergyStatus(user, studyTimerSeconds));
                            speakText('Main jag gaya! Main bilkul energized hoon! Chalo study shuru karte hain!');
                          }}
                          className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                        >
                          <Zap size={14} className="fill-slate-950" />
                          <span>Wake Up Pedro ⚡</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleCloseSystemGuide();
                            onTriggerAction?.('NAVIGATE_STUDY_MODE');
                            speakText('Study Mode khol diya hai! 15 minute padhte hi main jag jaunga!');
                          }}
                          className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-black text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <BookOpen size={14} className="text-cyan-300" />
                          <span>Study 15 Mins 📖</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            PedroEngine.putPedroToSleep(user?.id, 'Student manual nap test');
                            setEnergyStatus(PedroEngine.getEnergyStatus(user, studyTimerSeconds));
                            speakText('Zzz... Pedro power nap par ja raha hai!');
                          }}
                          className="py-2.5 px-3 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/40 text-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <Moon size={14} />
                          <span>Power Nap Test 😴</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            speakText('Pedro 100% full stamina par hai aur aapke saath study karne ke liye tayyar hai!');
                          }}
                          className="py-2.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                        >
                          <BatteryCharging size={14} />
                          <span>Stamina Full ✅</span>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Ultra Auto-Shield Info */}
                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/10 flex items-start gap-2.5">
                    <Shield size={18} className={energyStatus.isUltraShielded ? 'text-amber-400 shrink-0 mt-0.5' : 'text-slate-400 shrink-0 mt-0.5'} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-white leading-tight">
                        {energyStatus.isUltraShielded
                          ? '👑 Ultra VIP Auto-Shield: Permanent Full Stamina Active'
                          : 'Ultra Membership waalo ko milta hai Unlimited Auto-Shield'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        {energyStatus.isUltraShielded
                          ? 'Aapki streak break hone par bhi Pedro sleep mode me nahi jayega.'
                          : 'Streak Freeze item ya daily 15 minute continuous study se Pedro ka stamina hamesha 100% rehta hai.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ══════════════════ DRAGGABLE FLOATING PEDRO WIDGET ══════════════════
interface FloatingPedroWidgetProps {
  onOpen: () => void;
  currentPageTitle?: string;
  currentPageIcon?: string;
  customRobotName?: string;
  hidden?: boolean;
  isActive?: boolean;
  userName?: string;
  user?: any;
  studyTimerSeconds?: number;
  guidePowerEnabled?: boolean;
}

export const FloatingPedroWidget: React.FC<FloatingPedroWidgetProps> = ({
  onOpen,
  currentPageTitle = 'Home',
  currentPageIcon = '🏠',
  customRobotName = 'Pedro',
  hidden = false,
  isActive = false,
  userName = 'Student',
  user,
  studyTimerSeconds = 0,
  guidePowerEnabled = true
}) => {
  // Pedro Level & Visual Look Progression (Levels 1 - 8)
  const effectiveLevel = useMemo(() => PedroEngine.getEffectiveLevel(user), [user]);

  // Pedro Streak Break Penalty ("Naraj") state in Floating Widget
  const [penaltyState, setPenaltyState] = useState<PedroPenaltyState>(() =>
    PedroEngine.getPenaltyState(user?.id, user?.level)
  );

  useEffect(() => {
    const updatePenalty = () => {
      setPenaltyState(PedroEngine.getPenaltyState(user?.id, user?.level));
    };
    updatePenalty();
    window.addEventListener('nst-pedro-penalty-change', updatePenalty);
    window.addEventListener('nst-pedro-naraj', updatePenalty);
    return () => {
      window.removeEventListener('nst-pedro-penalty-change', updatePenalty);
      window.removeEventListener('nst-pedro-naraj', updatePenalty);
    };
  }, [user?.id, user?.level]);

  // Level 8 Color Change Scheme ("level 8 pe color change karne ka option milega 2 color milenge")
  const [pedroColorScheme, setPedroColorScheme] = useState<'classic' | 'cyber'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pedro_color_scheme');
      if (saved === 'classic' || saved === 'cyber') return saved;
    }
    return 'classic';
  });

  useEffect(() => {
    const handleColorSchemeChange = (e: any) => {
      const scheme = e?.detail?.scheme || (typeof window !== 'undefined' ? localStorage.getItem('pedro_color_scheme') : null);
      if (scheme === 'classic' || scheme === 'cyber') {
        setPedroColorScheme(scheme);
      }
    };
    window.addEventListener('pedro-color-scheme-change', handleColorSchemeChange);
    window.addEventListener('storage', handleColorSchemeChange);
    return () => {
      window.removeEventListener('pedro-color-scheme-change', handleColorSchemeChange);
      window.removeEventListener('storage', handleColorSchemeChange);
    };
  }, []);

  // Energy state for Option 1: Power Sleep
  const [energyStatus, setEnergyStatus] = useState(() => {
    return PedroEngine.getEnergyStatus(user, studyTimerSeconds);
  });

  useEffect(() => {
    setEnergyStatus(PedroEngine.getEnergyStatus(user, studyTimerSeconds));
  }, [user, studyTimerSeconds]);

  useEffect(() => {
    const handleEnergyUpdate = () => {
      setEnergyStatus(PedroEngine.getEnergyStatus(user, studyTimerSeconds));
    };
    window.addEventListener('nst-pedro-refresh', handleEnergyUpdate);
    window.addEventListener('nst-pedro-energy-change', handleEnergyUpdate);
    return () => {
      window.removeEventListener('nst-pedro-refresh', handleEnergyUpdate);
      window.removeEventListener('nst-pedro-energy-change', handleEnergyUpdate);
    };
  }, [user, studyTimerSeconds]);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      const maxX = Math.max(10, window.innerWidth - 75);
      const maxY = Math.max(65, window.innerHeight - 95);
      try {
        const saved = localStorage.getItem('nst_pedro_position');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return {
              x: Math.min(Math.max(10, parsed.x), maxX),
              y: Math.min(Math.max(65, parsed.y), maxY)
            };
          }
        }
      } catch {}
      return {
        x: Math.max(10, window.innerWidth - 75),
        y: Math.max(80, window.innerHeight - 150)
      };
    }
    return { x: 280, y: 550 };
  });

  // Clamp position to visible viewport when window is resized or screen orientation changes
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const maxX = Math.max(10, window.innerWidth - 75);
        const maxY = Math.max(65, window.innerHeight - 95);
        const clampedX = Math.min(Math.max(10, prev.x), maxX);
        const clampedY = Math.min(Math.max(65, prev.y), maxY);
        if (clampedX !== prev.x || clampedY !== prev.y) {
          return { x: clampedX, y: clampedY };
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  // User request: "pedro bhi agar na hoga screen pe to aayega agar hoga to koi baat nahi aur pedro ko bhagana ho to pedro pe abhi ke jaisa tap karna hoga 2 baar"
  const [isHidden, setIsHidden] = useState<boolean>(() => {
    if (hidden) return true;
    return false;
  });
  const singleTapTimerRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const [speechBubbleText, setSpeechBubbleText] = useState<string | null>(null);
  const [isSpeakingLive, setIsSpeakingLive] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0
  });

  // Feature Demonstration Flight with Rocket Booster ("Booster tab kaam karega jab samjhega feature tab jaate time")
  const homePosRef = useRef<{ x: number; y: number }>(position);
  const [isDemonstrating, setIsDemonstrating] = useState<boolean>(false);
  const [isPointingPose, setIsPointingPose] = useState<boolean>(false);

  // ── 10-MINUTE EMOTE SLEEP SEQUENCE ──
  // "pedro 10 min emote jarne ke baad apne sar apne haatho se uthkhar je fidega aur sar jayega top baar me jahan wo rahta hai wahai chala jayega aur phir body boostbkaga ke ur ke ja yega aur set ho jayega aur phir bulana oafega pedro ko kguki so jayega ab wo"
  const [retirePhase, setRetirePhase] = useState<'none' | 'toss_head' | 'flying_head' | 'body_boost' | 'docked_sleep'>('none');
  const [flyingHeadPos, setFlyingHeadPos] = useState<{ x: number; y: number } | null>(null);
  const retireTimerRef = useRef<any>(null);

  // ── GRAND AUTH WELCOME CINEMATIC SEQUENCE ──
  // User Request: "Jab user auth use karega to home oage asambal dikhtabhai ushke baad dikhega petro wo bhi bas ushka mundi wo bhi 512×512 aur dekh ke smile karefa aankh matkayega aur phir real size me aayega aur ja ke ushka naam dekhega top baar oe ohir aayega bokega welcome ............. ußer ka naam padhega"
  type AuthWelcomePhase = 
    | 'none'
    | 'speak_welcome';  // Normal mascot speaks friendly greeting from companion position (NO giant head)

  const [authWelcomePhase, setAuthWelcomePhase] = useState<AuthWelcomePhase>('none');
  const [targetStudentName, setTargetStudentName] = useState<string>(userName || 'Student');

  const startPedroAuthWelcomeSequence = useCallback((customTargetName?: string) => {
    let row2Name = '';
    try {
      const row2El = document.getElementById('topbar-row2-greeting');
      if (row2El) {
        row2Name = row2El.getAttribute('data-student-name') || row2El.innerText.replace(/Hey,|\s*👋/g, '').trim() || '';
      }
    } catch {}
    const cleanName = (customTargetName || row2Name || userName || 'Student').trim();
    setTargetStudentName(cleanName);

    // 0. Ensure Pedro is awake & unhidden
    setIsHidden(false);
    setRetirePhase('none');
    try {
      localStorage.removeItem('nst_pedro_hidden');
      localStorage.removeItem('nst_pedro_sleeping');
      window.dispatchEvent(new CustomEvent('nst-pedro-hidden-change', { detail: { isHidden: false, isSleeping: false } }));
    } catch {}

    const companionX = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 80) : 280;
    const companionY = typeof window !== 'undefined' ? Math.max(80, window.innerHeight - 150) : 480;

    // Direct friendly greeting in normal companion position (NO giant 512 head, NO screen blackout!)
    setPosition({ x: companionX, y: companionY });
    setAuthWelcomePhase('speak_welcome');

    const shortName = cleanName.split(' ')[0] || 'Dost';
    const welcomeText = `Namaste ${shortName}! Main Pedro, aapki madad ke liye taiyar hoon! ✨`;
    setSpeechBubbleText(welcomeText);
    setIsSpeakingLive(true);

    pedroSpeak(`Namaste ${shortName}! Main Pedro, aapka study dost!`, {
      pitch: 1.15,
      rate: 1.1,
      onEnd: () => setIsSpeakingLive(false),
    });

    setTimeout(() => {
      setAuthWelcomePhase('none');
      setIsSpeakingLive(false);
      setTimeout(() => {
        setSpeechBubbleText(null);
      }, 3500);
    }, 4000);
  }, [userName]);

  // Listen for login/assembly auth welcome triggers and expose global test trigger
  useEffect(() => {
    const handleAuthWelcome = (e: any) => {
      const uName = e?.detail?.userName || userName;
      startPedroAuthWelcomeSequence(uName);
    };

    window.addEventListener('nst-trigger-pedro-auth-welcome', handleAuthWelcome);
    (window as any).__triggerPedroAuthWelcome = (customName?: string) => {
      startPedroAuthWelcomeSequence(customName);
    };

    return () => {
      window.removeEventListener('nst-trigger-pedro-auth-welcome', handleAuthWelcome);
      delete (window as any).__triggerPedroAuthWelcome;
    };
  }, [startPedroAuthWelcomeSequence, userName]);

  const startRetireToSleepSequence = () => {
    if (isHidden || isActive || retirePhase !== 'none') return;

    // Phase 1: Pedro unhooks head and docks silently
    // User request: MUTED (Audio 0%). Achanak aawaz nikaal kar darana nahi hai. Pedro silent animation ke sath chupke se top-bar me dock hokar so jaye.
    setRetirePhase('toss_head');
    setSpeechBubbleText(null);
    setIsSpeakingLive(false);

    const curX = position.x;
    const curY = position.y;
    const targetX = Math.max(10, (typeof window !== 'undefined' ? window.innerWidth : 400) - 72);
    const targetY = 16;

    // Phase 2: Detached head launches & flies towards top bar
    setTimeout(() => {
      setRetirePhase('flying_head');
      setFlyingHeadPos({ x: curX + 12, y: curY - 30 });
      requestAnimationFrame(() => {
        setFlyingHeadPos({ x: targetX, y: targetY });
      });
    }, 1400);

    // Phase 3: Body ignites boosters and rockets straight to top bar
    setTimeout(() => {
      setRetirePhase('body_boost');
      setPosition({ x: targetX, y: targetY });
    }, 2400);

    // Phase 4: Head & body settle together in top bar, Pedro goes to sleep
    setTimeout(() => {
      setRetirePhase('docked_sleep');
      setIsHidden(true);
      setFlyingHeadPos(null);
      setSpeechBubbleText(null);
      setIsSpeakingLive(false);

      if (typeof window !== 'undefined') {
        localStorage.setItem('nst_pedro_hidden', 'true');
        localStorage.setItem('nst_pedro_sleeping', 'true');
        window.dispatchEvent(new CustomEvent('nst-pedro-hidden-change', { detail: { isHidden: true, isSleeping: true } }));
      }
    }, 3600);
  };

  // Reset/arm 2-minute timer for Pedro sleep on Home screen (User request: "Aur 10 min wala jo system hai ab kato 2 min home screen pe rukne pe jayega")
  useEffect(() => {
    if (isHidden || isActive) {
      if (retireTimerRef.current) clearTimeout(retireTimerRef.current);
      return;
    }
    const TWO_MINUTES_MS = 2 * 60 * 1000;
    if (retireTimerRef.current) clearTimeout(retireTimerRef.current);
    retireTimerRef.current = setTimeout(() => {
      startRetireToSleepSequence();
    }, TWO_MINUTES_MS);

    return () => {
      if (retireTimerRef.current) clearTimeout(retireTimerRef.current);
    };
  }, [isHidden, isActive, position]);

  // Allow immediate manual testing or trigger via event
  useEffect(() => {
    const handleManualSleep = () => startRetireToSleepSequence();
    window.addEventListener('nst-pedro-trigger-sleep', handleManualSleep);
    (window as any).__triggerPedroSleep = startRetireToSleepSequence;
    return () => {
      window.removeEventListener('nst-pedro-trigger-sleep', handleManualSleep);
    };
  }, [position, isHidden, isActive, retirePhase]);

  useEffect(() => {
    setIsHidden(hidden);
  }, [hidden]);

  // Keep home position in sync when user isn't in demonstration mode or dragging
  useEffect(() => {
    if (!isDemonstrating && !isDragging && retirePhase === 'none') {
      homePosRef.current = position;
    }
  }, [position, isDemonstrating, isDragging, retirePhase]);

  // Listen to Pedro background speech bubbles
  useEffect(() => {
    let timer: any = null;
    const handleBubble = (e: any) => {
      const text = e.detail?.text;
      if (text) {
        setSpeechBubbleText(text);
        setIsSpeakingLive(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setSpeechBubbleText(null);
          setIsSpeakingLive(false);
        }, 7500);
      }
    };
    const handleBubbleEnd = () => {
      setIsSpeakingLive(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        setSpeechBubbleText(null);
      }, 3000);
    };
    window.addEventListener('nst_pedro_speech_bubble', handleBubble);
    window.addEventListener('nst_pedro_speaking_end', handleBubbleEnd);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('nst_pedro_speech_bubble', handleBubble);
      window.removeEventListener('nst_pedro_speaking_end', handleBubbleEnd);
    };
  }, []);

  // Listen to restore Pedro events (from top bar 3-dot docked Mascot, Wheel, or NSTA Logo)
  useEffect(() => {
    const handleRestore = () => {
      setIsHidden(false);
      setRetirePhase('none');
      setFlyingHeadPos(null);
      const safeX = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 75) : 280;
      const safeY = typeof window !== 'undefined' ? Math.max(80, window.innerHeight - 150) : 550;
      const targetX = homePosRef.current && homePosRef.current.y > 60
        ? Math.min(Math.max(10, homePosRef.current.x), typeof window !== 'undefined' ? window.innerWidth - 75 : 300)
        : safeX;
      const targetY = homePosRef.current && homePosRef.current.y > 60
        ? Math.min(Math.max(65, homePosRef.current.y), typeof window !== 'undefined' ? window.innerHeight - 95 : 550)
        : safeY;
      setPosition({ x: targetX, y: targetY });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('nst_pedro_hidden');
        localStorage.removeItem('nst_pedro_sleeping');
        window.dispatchEvent(new CustomEvent('nst-pedro-hidden-change', { detail: { isHidden: false, isSleeping: false } }));
      }
    };
    window.addEventListener('nst-restore-pedro', handleRestore);
    window.addEventListener('nst-show-pedro', handleRestore);
    return () => {
      window.removeEventListener('nst-restore-pedro', handleRestore);
      window.removeEventListener('nst-show-pedro', handleRestore);
    };
  }, []);

  // Listen to autonomous flight events ("jo bhi feature dikhayega khud ja ke dikhayega")
  useEffect(() => {
    const handleFlyTo = (e: any) => {
      const { x, y, isPointing } = e.detail || {};
      if (typeof x === 'number' && typeof y === 'number') {
        setIsDemonstrating(true);
        setIsPointingPose(!!isPointing);
        setPosition({ x, y });
      }
    };

    const handleReturnHome = () => {
      setIsDemonstrating(false);
      setIsPointingPose(false);
      if (homePosRef.current) {
        setPosition(homePosRef.current);
      }
    };

    window.addEventListener('nst-pedro-fly-to', handleFlyTo);
    window.addEventListener('nst-pedro-return-home', handleReturnHome);
    return () => {
      window.removeEventListener('nst-pedro-fly-to', handleFlyTo);
      window.removeEventListener('nst-pedro-return-home', handleReturnHome);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y
    };
    setIsDragging(true);
    setHasMoved(false);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      setHasMoved(true);
    }

    const newX = Math.min(Math.max(10, dragStartRef.current.initX + deltaX), window.innerWidth - 75);
    const newY = Math.min(Math.max(65, dragStartRef.current.initY + deltaY), window.innerHeight - 95);

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    // Persist position and notify
    if (typeof window !== 'undefined') {
      localStorage.setItem('nst_pedro_position', JSON.stringify(position));
      homePosRef.current = position;
      window.dispatchEvent(new Event('nst-pedro-pos-change'));
    }

    // Tap detected
    if (!hasMoved) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      // Double tap detected (within 380ms): Bhaga do Pedro ko!
      if (timeSinceLastTap < 380) {
        lastTapRef.current = 0;
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        setIsHidden(true);
        if (typeof window !== 'undefined') {
          localStorage.setItem('nst_pedro_hidden', 'true');
          window.dispatchEvent(new CustomEvent('nst-pedro-hidden-change', { detail: { isHidden: true } }));
          playSoftChime();
          pedroSpeak('Pedro paused.', { rate: 1.2, showBubble: false });
        }
        return;
      }

      lastTapRef.current = now;
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        if (guidePowerEnabled === false) {
          setSpeechBubbleText(`Namaste ${userName || 'Dost'}! Main aapka friendly study mascot hoon. Interactive App Guide abhi Admin dwara off hai.`);
          setIsSpeakingLive(true);
          playSoftChime();
          pedroSpeak(`Namaste! Main aapka Pedro study companion hoon. App guide abhi off hai.`, {
            rate: 1.15,
            showBubble: false,
            onEnd: () => setIsSpeakingLive(false)
          });
          setTimeout(() => {
            setSpeechBubbleText(null);
            setIsSpeakingLive(false);
          }, 3200);
          return;
        }

        if (energyStatus.isSleeping) {
          pedroSpeak('Zzz... Main thak gaya hoon, thoda aaram karne dijiye.');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('nst-pedro-open-energy'));
          }
          onOpen();
          return;
        }
        onOpen();
      }, 260);
    }
  };

  // Double tap backup for mouse double clicks
  const handleDoubleTapCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 380) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      setIsHidden(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nst_pedro_hidden', 'true');
        window.dispatchEvent(new CustomEvent('nst-pedro-hidden-change', { detail: { isHidden: true } }));
        playSoftChime();
        pedroSpeak('Pedro paused.', { rate: 1.2, showBubble: false });
      }
    }
    lastTapRef.current = now;
  };

  if (isHidden && authWelcomePhase === 'none') {
    return null;
  }

  const isRetiringFlight = retirePhase === 'body_boost';
  const effectiveBooster = isDemonstrating || isRetiringFlight;
  const isTransitioning = isDemonstrating || isRetiringFlight;

  const effectivePose: PedroMascotPose = retirePhase === 'toss_head'
    ? 'toss_head'
    : (retirePhase === 'flying_head' || retirePhase === 'body_boost')
    ? 'headless_booster'
    : isPointingPose
    ? 'pointing'
    : energyStatus.isSleeping
    ? 'sleep'
    : 'idle';

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 99998,
          touchAction: 'none',
          transition: isTransitioning
            ? 'left 0.95s cubic-bezier(0.34, 1.2, 0.64, 1), top 0.95s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.4s ease'
            : isDragging
            ? 'none'
            : 'transform 0.15s ease, opacity 0.4s ease'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleDoubleTapCheck}
        className={`group cursor-grab active:cursor-grabbing select-none ${
          isDragging ? 'scale-110 opacity-90' : 'hover:scale-105 active:scale-95'
        }`}
        title="Pedro Robot Guide — Tap karke koi bhi feature samjhein (Double tap karke top bar me bhejein)"
      >
        {/* Floating 3D Robot Mascot */}
        <div className="relative flex flex-col items-center justify-center">
          {/* Pedro Live Speech Bubble (when speaking while dialog is closed) */}
          {speechBubbleText && !isActive && (
            <div
              className={`absolute bottom-full mb-3 pointer-events-auto z-[99999] ${
                position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 200) ? 'right-0' : 'left-0'
              } w-64 max-w-[85vw] p-3 rounded-2xl bg-slate-950/95 border-2 border-purple-500/80 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200`}
              onClick={(e) => {
                e.stopPropagation();
                setSpeechBubbleText(null);
              }}
            >
              <div className="flex items-start gap-2">
                <span className="text-base shrink-0 animate-bounce">🤖</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-purple-300 uppercase tracking-wider leading-none mb-1 flex items-center gap-1">
                    <span>{customRobotName || 'Pedro'} Voice</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  </p>
                  <p className="text-[11.5px] font-semibold text-white leading-snug break-words">
                    {speechBubbleText}
                  </p>
                </div>
              </div>
              {/* Speech bubble pointer notch */}
              <div
                className={`absolute top-full w-2.5 h-2.5 bg-slate-950 border-r-2 border-b-2 border-purple-500/80 transform rotate-45 -mt-1.5 ${
                  position.x > (typeof window !== 'undefined' ? window.innerWidth / 2 : 200) ? 'right-5' : 'left-5'
                }`}
              />
            </div>
          )}

          {/* Outer Glow Halo: At Level 4+, background glow disappears ("level 4 background ka glow hat jayega aur bara ho jayega pedro") */}
          {effectiveLevel < 4 && (
            <div
              className={`absolute -inset-2 rounded-full transition-all duration-300 pointer-events-none ${
                isActive || isSpeakingLive || effectiveBooster
                  ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-purple-500 opacity-95 blur-[10px] animate-pulse'
                  : 'bg-gradient-to-r from-purple-500/70 to-indigo-500/70 opacity-60 blur-[6px] group-hover:opacity-90'
              }`}
            />
          )}

          {/* 3D Pedro Mascot Model */}
          <div className="relative">
            <Pedro3DMascot
              size={effectiveLevel >= 4 ? 84 : 70}
              pose={effectivePose}
              isSpeaking={isSpeakingLive}
              isPointing={isPointingPose || authWelcomePhase === 'inspect_name'}
              isDragging={isDragging}
              isBoosterActive={effectiveBooster}
              isNaraj={false}
              level={effectiveLevel}
              colorScheme={pedroColorScheme}
              className={effectiveBooster ? 'scale-110' : 'animate-pedro-hover'}
            />

            {/* Rocket Booster Exhaust Plume & Glow during feature flight */}
            {effectiveBooster && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 animate-in fade-in zoom-in duration-200">
                <div className="w-5 h-7 bg-gradient-to-b from-amber-400 via-orange-500 to-transparent rounded-full blur-[3px] opacity-90 animate-pulse" />
                <div className="w-2 h-4 -mt-5 bg-cyan-300 rounded-full blur-[1px] opacity-95 animate-ping" />
              </div>
            )}

            {/* Demonstration Guide Badge ("Yahan Dekhein!") */}
            {isPointingPose && authWelcomePhase === 'none' && (
              <div className="absolute -top-2 -right-3 pointer-events-none animate-bounce flex items-center gap-0.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black shadow-lg">
                  Yahan Dekhein! 👇
                </span>
              </div>
            )}

            {/* Energy Sleep Zzz Badge ("Option 1 Pedro Energy / Power Sleep") */}
            {energyStatus.isSleeping && authWelcomePhase === 'none' && (
              <div className="absolute -top-3.5 -right-2 pointer-events-none animate-bounce flex items-center gap-0.5 z-20">
                <span className="px-2 py-0.5 rounded-full bg-purple-950/95 border border-amber-400 text-amber-300 text-[10px] font-black shadow-xl flex items-center gap-1">
                  <span>😴</span>
                  <span>Zzz</span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detached Head Flying to Top Bar during 10-min sleep retirement */}
      {retirePhase === 'flying_head' && flyingHeadPos && (
        <div
          style={{
            position: 'fixed',
            left: `${flyingHeadPos.x}px`,
            top: `${flyingHeadPos.y}px`,
            zIndex: 999999,
            pointerEvents: 'none',
            transition: 'left 1.2s cubic-bezier(0.25, 1, 0.5, 1), top 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
        >
          <div className="relative flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-amber-300 p-0.5 shadow-2xl animate-spin-slow">
              <Pedro3DMascot size={44} isMini pose="idle" level={effectiveLevel} colorScheme={pedroColorScheme} />
            </div>
            <div className="absolute -inset-1.5 bg-cyan-400/60 rounded-2xl blur-md -z-10 animate-ping" />
            <span className="absolute -top-2 -right-2 text-xs animate-bounce">✨</span>
          </div>
        </div>
      )}
    </>
  );
};
