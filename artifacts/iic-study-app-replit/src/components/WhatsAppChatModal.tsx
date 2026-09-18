import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Search,
  Send,
  Smile,
  Paperclip,
  Mic,
  Check,
  CheckCheck,
  Users,
  MessageCircle,
  Plus,
  ArrowLeft,
  MoreVertical,
  Radio,
  Play,
  Pause,
  HelpCircle,
  BookOpen,
  Sparkles,
  Shield,
  UserPlus,
  UserCheck,
  Lock,
  Globe,
  Clock,
  Heart,
  Bell,
  UserX,
  Share2,
  LogOut,
  Ban,
  Trash2,
  AlertTriangle,
  Unlock,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Coins,
  Gem,
  TrendingUp,
  Reply,
  Loader2,
  Crown,
  Zap,
  Copy,
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Mail,
  Phone,
  Hash,
  Star,
  Camera,
  Image as ImageIcon,
  Crop,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  ChevronLeft,
  Archive,
} from 'lucide-react';
import JSZip from 'jszip';
import { User } from '../types';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import { saveUserToLive, auth } from '../firebase';
import { uploadImageToImgBB } from '../services/imgbbService';
import { ImageCropper } from './ImageCropper';
import { NstaChatLockPasswordModal } from './NstaChatLockPasswordModal';
import {
  ChatContact,
  ChatMessage,
  ChatGroup,
  FriendRequest,
  
  SEEDED_GROUPS,
  getDirectConversationId,
  sendPrivateMessage,
  sendGroupMessage,
  subscribeToDirectMessages,
  subscribeToGroupMessages,
  createWhatsAppGroup,
  reactToChatMessage,
  getLocalGroups,
  formatLastSeen,
  updateUserPresence,
  subscribeToUserPresence,
  fetchRegisteredStudents,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  subscribeToFriendRequests,
  subscribeToSentFriendRequests,
  subscribeToFriends,
  subscribeToFriendAccepted,
  sanitizeRtdbKey,
  joinPublicGroup,
  requestToJoinPrivateGroup,
  approveJoinGroupRequest,
  rejectJoinGroupRequest,
  addFriendToGroup,
  unfriendUser,
  blockUser,
  unblockUser,
  subscribeToBlockedUsers,
  leaveGroup,
  deleteWhatsAppGroup,
  clearChatHistory,
  deleteChatMessage,
  markMessagesAsRead,
  confirmFriendshipLocally,
  getDisappearingTimer,
  setDisappearingTimer,
  filterDisappearingMessages,
  clearSeenVanishMessages,
  toggleSaveChatMessage,
  isMessageSaved,
  isChatLocked,
  toggleChatLock,
  unlockChatInSession,
  lockChatInSession,
  verifyChatPin,
  setChatPin,
  getChatPin,
  hasChatPin,
  getDefaultChatPin,
  setDefaultChatPin,
  hasDefaultChatPin,
  getSpecialChatPin,
  setSpecialChatPin,
  removeSpecialChatPin,
  hasSpecialChatPin,
  verifyChatPinForContext,
  isChatStarred,
  toggleChatStarred,
  getSpecialChatCategoryPin,
  setSpecialChatCategoryPin,
  verifyChatCategoryPin,
  subscribeToAllPresence,
  isSameUser,
  isMessageDeletedForUser,
  updateGroupPrivacy,
  joinPrivateGroupByPassword,
  getLocalSentFriendRequests,
  getLocalFriends,
  getLocalFriendRequests,
} from '../services/whatsappChatService';

// Block limit tiers: Free user -> 10, Basic -> 20, Ultra -> 30
export const getUserBlockTier = (u: User): 'FREE' | 'BASIC' | 'ULTRA' => {
  if (u.role === 'ADMIN' || u.role === 'SUB_ADMIN') return 'ULTRA';
  const subLevel = u.subscriptionLevel?.toUpperCase();
  if (subLevel === 'ULTRA' || subLevel === 'PRO_MAX') return 'ULTRA';
  if (subLevel === 'BASIC') return 'BASIC';
  if (u.subscriptionTier === 'YEARLY' || u.subscriptionTier === 'LIFETIME') return 'ULTRA';
  if (u.isPremium || (u.subscriptionTier && u.subscriptionTier !== 'FREE')) return 'BASIC';
  return 'FREE';
};

// Subscription tier extractor for classmates/students
export const getStudentSubscriptionTier = (student: ChatContact): 'ULTRA' | 'BASIC' | 'FREE' => {
  if (student.subscriptionLevel) {
    const s = String(student.subscriptionLevel).toUpperCase();
    if (s === 'ULTRA' || s === 'PRO_MAX') return 'ULTRA';
    if (s === 'BASIC') return 'BASIC';
    if (s === 'FREE') return 'FREE';
  }
  const tier = (student.subscriptionTier || '').toUpperCase();
  if (tier.includes('ULTRA') || tier.includes('PRO_MAX') || tier.includes('LIFETIME') || tier.includes('YEARLY')) return 'ULTRA';
  if (tier.includes('BASIC') || tier.includes('PRO') || student.isPremium) return 'BASIC';
  return 'FREE';
};

// Daily message limit: Free -> 50, Basic -> 100, Ultra -> 300
export const getBaseDailyMessageLimit = (tier: 'FREE' | 'BASIC' | 'ULTRA'): number => {
  switch (tier) {
    case 'ULTRA':
      return 300;
    case 'BASIC':
      return 100;
    case 'FREE':
    default:
      return 50;
  }
};

// Friend limit: Free -> 10, Basic -> 20, Ultra -> 50 (capped at 50 max)
export const getBaseFriendLimit = (tier: 'FREE' | 'BASIC' | 'ULTRA'): number => {
  switch (tier) {
    case 'ULTRA':
      return 50;
    case 'BASIC':
      return 20;
    case 'FREE':
    default:
      return 10;
  }
};

export const calculateTotalDailyMsgLimit = (tier: 'FREE' | 'BASIC' | 'ULTRA', expansions: number): number => {
  const base = getBaseDailyMessageLimit(tier);
  let total = base;
  for (let i = 1; i <= expansions; i++) {
    if (tier === 'FREE') {
      total += (i === 1 ? 50 : 100);
    } else {
      total += 100;
    }
  }
  return Math.min(500, total);
};

export const getNextMessageExpansionAmount = (tier: 'FREE' | 'BASIC' | 'ULTRA', currentExpansions: number): number => {
  if (tier === 'FREE' && currentExpansions === 0) return 50;
  return 100;
};

// Block limit: Free -> 10, Basic -> 20, Ultra -> 40
export const getBaseBlockLimit = (tier: 'FREE' | 'BASIC' | 'ULTRA'): number => {
  switch (tier) {
    case 'ULTRA':
      return 40;
    case 'BASIC':
      return 20;
    case 'FREE':
    default:
      return 10;
  }
};

export const getNextExpansionCost = (expansionsCount: number): number => {
  return 100;
};

interface Props {
  user: User;
  onClose: () => void;
  onOpenGroupStudy?: () => void;
  targetPeer?: ChatContact;
  initialGroupId?: string;
  initialTab?: 'CHATS' | 'REQUESTS' | 'GROUPS' | 'BLOCKED' | 'PROFILE' | 'FIND_FRIENDS';
  themeColor?: string;
  onUpdateUser?: (updatedUser: User) => void;
}

export const WhatsAppChatModal: React.FC<Props> = ({
  user,
  onClose,
  onOpenGroupStudy,
  targetPeer,
  initialGroupId,
  initialTab,
  onUpdateUser,
}) => {
  // Navigation State: CHATS, FIND_FRIENDS, REQUESTS, GROUPS, BLOCKED, PROFILE
  const [activeTab, setActiveTab] = useState<'CHATS' | 'FIND_FRIENDS' | 'REQUESTS' | 'GROUPS' | 'BLOCKED' | 'PROFILE'>(
    (initialTab as any) || (targetPeer ? 'CHATS' : 'CHATS')
  );
  const [requestsSubTab, setRequestsSubTab] = useState<'RECEIVED' | 'SENT' | 'FIND_FRIENDS'>('RECEIVED');
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>(() =>
    getLocalSentFriendRequests(user?.id || '')
  );
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(targetPeer || null);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);

  // Synchronize activeTab if initialTab changes
  useEffect(() => {
    if (initialTab && initialTab !== ('STUDENTS' as any)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // User state kept in sync for coin deductions
  const [currentUser, setCurrentUser] = useState<User>(user);
  useEffect(() => {
    setCurrentUser(user);
  }, [user]);

  const effectiveUserId = String(user?.id || (user as any)?.uid || currentUser?.id || (currentUser as any)?.uid || '').trim();

  // Real-time user presence tracking (Online & Last Seen in Nsta Messenger)
  useEffect(() => {
    if (!effectiveUserId) return;
    updateUserPresence(effectiveUserId, true);
    const interval = setInterval(() => {
      updateUserPresence(effectiveUserId, true);
    }, 45000);
    return () => {
      clearInterval(interval);
      updateUserPresence(effectiveUserId, false);
    };
  }, [effectiveUserId]);

  // Real-time global presence map from RTDB for accurate online status
  const [presenceMap, setPresenceMap] = useState<Record<string, { isOnline: boolean; lastSeen: number }>>({});

  useEffect(() => {
    const unsub = subscribeToAllPresence((map) => {
      setPresenceMap(map);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const isUserCurrentlyOnline = useCallback(
    (contactId: string): boolean => {
      if (!contactId) return false;
      // Simulated/seeded directory contacts are not online in the live app
      if (contactId.startsWith('student_') || contactId.startsWith('mock_')) return false;
      const clean = sanitizeRtdbKey(contactId);
      const p = presenceMap[contactId] || presenceMap[clean];
      if (p) {
        return !!p.isOnline && (Date.now() - (p.lastSeen || 0)) < 2 * 60 * 1000;
      }
      return false;
    },
    [presenceMap]
  );

  // Real-time presence listener for the active contact (Online status & Last Seen updates)
  useEffect(() => {
    if (!selectedContact?.id) return;
    const unsubPresence = subscribeToUserPresence(selectedContact.id, (presence) => {
      setSelectedContact((prev) => {
        if (!prev || prev.id !== selectedContact.id) return prev;
        return {
          ...prev,
          isOnline: presence.isOnline,
          lastSeen: presence.lastSeen,
        };
      });
    });
    return () => {
      unsubPresence();
    };
  }, [selectedContact?.id]);

  const currentBlockTier = getUserBlockTier(currentUser);
  const currentTier = currentBlockTier;

  // 1. Purchased +10 block limit expansions count
  const [blockExpansions, setBlockExpansions] = useState<number>(() => {
    if (typeof user.blockLimitExpansions === 'number') return user.blockLimitExpansions;
    try {
      const saved = localStorage.getItem(`nsta_block_expansions_${user.id}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const baseBlockLimit = getBaseBlockLimit(currentBlockTier);
  const extraBlockSlots = blockExpansions * 10;
  const totalBlockLimit = baseBlockLimit + extraBlockSlots;
  const nextExpansionCost = getNextExpansionCost(blockExpansions);
  const userCoins = getTotalCredits(currentUser);
  const userDiamonds = currentUser.diamonds || 0;

  // 2. Purchased +10 friend limit expansions count (Free: 10, Basic: 20, Ultra: 40)
  const [friendExpansions, setFriendExpansions] = useState<number>(() => {
    if (typeof (user as any).friendLimitExpansions === 'number') return (user as any).friendLimitExpansions;
    try {
      const saved = localStorage.getItem(`nsta_friend_expansions_${user.id}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const baseFriendLimit = getBaseFriendLimit(currentTier);
  const totalFriendLimit = Math.min(50, baseFriendLimit + friendExpansions * 10);
  const [showFriendLimitModal, setShowFriendLimitModal] = useState(false);

  // 3. Daily message tracking & expansions (Free: 50, Basic: 100, Ultra: 300, max 500)
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const [dailyMessagesSent, setDailyMessagesSent] = useState<number>(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = localStorage.getItem(`nsta_daily_msg_${user.id}_${today}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const [dailyMsgExpansions, setDailyMsgExpansions] = useState<number>(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const saved = localStorage.getItem(`nsta_msg_expansions_${user.id}_${today}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });
  const baseDailyMsgLimit = getBaseDailyMessageLimit(currentTier);
  const totalDailyMsgLimit = calculateTotalDailyMsgLimit(currentTier, dailyMsgExpansions);
  const isDailyMsgLimitReached = totalDailyMsgLimit !== Infinity && dailyMessagesSent >= totalDailyMsgLimit;
  const [showMessageLimitModal, setShowMessageLimitModal] = useState(false);

  // Expansion loading state & limit reached modal state
  const [isExpandingLimit, setIsExpandingLimit] = useState(false);
  const [showLimitReachedModal, setShowLimitReachedModal] = useState(false);
  const [attemptingBlockUser, setAttemptingBlockUser] = useState<{ id: string; name: string } | null>(null);

  // Search inside blocked users directory & Quick student block picker
  const [blockedSearchQuery, setBlockedSearchQuery] = useState('');
  const [showQuickBlockPicker, setShowQuickBlockPicker] = useState(false);
  const [quickBlockSearch, setQuickBlockSearch] = useState('');

  // Lists
  const [friends, setFriends] = useState<ChatContact[]>(() =>
    getLocalFriends(user?.id || '')
  );
  const [students, setStudents] = useState<ChatContact[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>(() =>
    getLocalFriendRequests()
  );
  const [groups, setGroups] = useState<ChatGroup[]>(getLocalGroups());
  const [newAcceptedFriend, setNewAcceptedFriend] = useState<ChatContact | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  const isUserFriend = (contactOrId: string | ChatContact | { id?: string; uid?: string; email?: string } | null | undefined): boolean => {
    if (!contactOrId) return false;
    if (typeof contactOrId === 'string') {
      if (contactOrId === 'peer_iic_ai_tutor') return true;
      return friends.some((f) =>
        isSameUser(f.id, contactOrId) ||
        (f.uid && isSameUser(f.uid, contactOrId)) ||
        (f.email && isSameUser(f.email, contactOrId))
      );
    }
    const tId = contactOrId.id;
    const tUid = (contactOrId as any).uid;
    const tEmail = (contactOrId as any).email;
    if (tId === 'peer_iic_ai_tutor') return true;

    return friends.some((f) => {
      if (tId && isSameUser(f.id, tId)) return true;
      if (tUid && (isSameUser(f.id, tUid) || (f.uid && isSameUser(f.uid, tUid)))) return true;
      if (tId && f.uid && isSameUser(f.uid, tId)) return true;
      if (tEmail && (isSameUser(f.email, tEmail) || isSameUser(f.id, tEmail))) return true;
      if (tId && f.email && isSameUser(f.email, tId)) return true;
      return false;
    });
  };

  const chatInputRef = useRef<HTMLInputElement>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  const handleInitiateReply = (msg: ChatMessage) => {
    setReplyingTo(msg);
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 50);
  };

  const handleScrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(msgId);
      setTimeout(() => setHighlightedMsgId(null), 2200);
    }
  };

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [findFriendQuery, setFindFriendQuery] = useState('');
  const [findFriendClassFilter, setFindFriendClassFilter] = useState<string>('ALL');

  // Active chat messages & input
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Deduplicate repeat/consecutive system notifications (e.g., "Friend request accept ho gayi")
  const displayMessages = React.useMemo(() => {
    const seenSystemEvents = new Set<string>();
    return messages.filter((msg) => {
      if (msg.type === 'SYSTEM') {
        const text = (msg.text || '').trim();
        if (text.includes('Friend request accept ho gayi')) {
          if (seenSystemEvents.has('SYSTEM_FRIEND_ACCEPTED')) return false;
          seenSystemEvents.add('SYSTEM_FRIEND_ACCEPTED');
        } else if (text.includes('friend request bheji hai')) {
          if (seenSystemEvents.has('SYSTEM_FRIEND_REQUEST')) return false;
          seenSystemEvents.add('SYSTEM_FRIEND_REQUEST');
        }
      }
      return true;
    });
  }, [messages]);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);

  // Friend Requirement Notice Dialog
  const [friendReqPromptStudent, setFriendReqPromptStudent] = useState<ChatContact | null>(null);

  // New Group Form State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubject, setNewGroupSubject] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('📚');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupIsPrivate, setNewGroupIsPrivate] = useState(false);
  const [newGroupPassword, setNewGroupPassword] = useState('');

  // Tier Filter for Student directory (Ultra, Basic, Free)
  const [findFriendTierFilter, setFindFriendTierFilter] = useState<'ALL' | 'ULTRA' | 'BASIC' | 'FREE'>('ALL');

  // Free User Group Creation Restriction Modal
  const [showFreeGroupBlockModal, setShowFreeGroupBlockModal] = useState(false);

  // Private Group Direct Password Join Modal State
  const [joinPrivateGroupTarget, setJoinPrivateGroupTarget] = useState<ChatGroup | null>(null);
  const [joinPrivatePasswordInput, setJoinPrivatePasswordInput] = useState('');
  const [joinPrivateError, setJoinPrivateError] = useState('');
  const [joinPrivateLoading, setJoinPrivateLoading] = useState(false);

  // Admin Privacy & Password Management Modal
  const [showPrivacyChangeModal, setShowPrivacyChangeModal] = useState(false);
  const [privacyToggleIsPrivate, setPrivacyToggleIsPrivate] = useState(false);
  const [privacyTogglePassword, setPrivacyTogglePassword] = useState('');
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  // Playing voice message state (for listening to previous voice notes)
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Quick 1-tap friend request sending state
  const [sendingReqIds, setSendingReqIds] = useState<Set<string>>(new Set());

  // Blocked users list
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string; blockedAt: number }[]>([]);
  // Menu dropdown toggles
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [openFriendMenuId, setOpenFriendMenuId] = useState<string | null>(null);
  const [showBlockedListModal, setShowBlockedListModal] = useState(false);

  // Unified Confirmation Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'UNFRIEND' | 'BLOCK' | 'UNBLOCK' | 'LEAVE_GROUP' | 'CLEAR_CHAT' | 'DELETE_GROUP';
    title: string;
    description: string;
    targetId: string;
    targetName: string;
    groupId?: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Action status toast/banner
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Message Deletion Dialog State (Delete for me vs Delete for everyone)
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);

  // Multi-select & Batch Delete State
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState<boolean>(false);
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState<boolean>(false);

  // Floating Emoji Reaction Picker for Double Tap
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);

  // Swipe-to-reply gesture state
  const [activeSwipeMsgId, setActiveSwipeMsgId] = useState<string | null>(null);
  const [activeSwipeOffset, setActiveSwipeOffset] = useState<number>(0);

  // Gesture & interaction refs
  const touchStartPosRef = useRef<{ x: number; y: number; msgId: string; time: number } | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const lastTapTimeRef = useRef<{ id: string; time: number } | null>(null);

  // Disappearing Messages State (24h, 7d, 30d, 90d, Snapchat Vanish Mode)
  const [showDisappearingModal, setShowDisappearingModal] = useState<boolean>(false);
  const [currentDisappearingTimer, setCurrentDisappearingTimer] = useState<number>(0);

  // Chat Lock & PIN Protection State (Snapchat-style locking on back/exit)
  const [isCurrentChatLocked, setIsCurrentChatLocked] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [showPinVisibility, setShowPinVisibility] = useState<boolean>(false);
  const [pendingUnlockContext, setPendingUnlockContext] = useState<{
    contact?: ChatContact;
    group?: ChatGroup;
    contextId: string;
  } | null>(null);

  // Settings Modal for Chat Passwords (Default & Special Password Management)
  const [showPinSettingsModal, setShowPinSettingsModal] = useState<boolean>(false);
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [newPinError, setNewPinError] = useState<string | null>(null);
  const [pinSettingsTab, setPinSettingsTab] = useState<'SPECIAL' | 'DEFAULT'>('SPECIAL');
  const [specialPinInput, setSpecialPinInput] = useState<string>('');
  const [specialPinError, setSpecialPinError] = useState<string | null>(null);
  const [oldDefaultPinInput, setOldDefaultPinInput] = useState<string>('');
  const [newDefaultPinInput, setNewDefaultPinInput] = useState<string>('');
  const [defaultPinError, setDefaultPinError] = useState<string | null>(null);
  const [showBlockedInProfile, setShowBlockedInProfile] = useState<boolean>(false);

  // Star Mark State & Category Filter in CHATS tab (ALL, SPECIAL, DEFAULT)
  const [chatCategoryFilter, setChatCategoryFilter] = useState<'ALL' | 'SPECIAL' | 'DEFAULT'>('ALL');
  const [starredStateTick, setStarredStateTick] = useState<number>(0);

  // Nsta Dual Password Modal (Default & Special Passwords)
  const [showDualPasswordModal, setShowDualPasswordModal] = useState<boolean>(false);

  // Image Upload & Lightbox State (Cloud CDN integration & Multi-photo batch up to 10)
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  const [selectedImagesToSend, setSelectedImagesToSend] = useState<File[]>([]);
  const [activePreviewImageIndex, setActivePreviewImageIndex] = useState<number>(0);
  const [imagePreviewModalOpen, setImagePreviewModalOpen] = useState<boolean>(false);
  const [isHdQuality, setIsHdQuality] = useState<boolean>(false);
  const [imageCaptionInput, setImageCaptionInput] = useState<string>('');
  const [isCroppingImage, setIsCroppingImage] = useState<boolean>(false);
  const [imageToCropUrl, setImageToCropUrl] = useState<string | null>(null);
  const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxImagesList, setLightboxImagesList] = useState<string[]>([]);
  const [lightboxActiveIndex, setLightboxActiveIndex] = useState<number>(0);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [lightboxRotation, setLightboxRotation] = useState<number>(0);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState<boolean>(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const addMoreImageInputRef = useRef<HTMLInputElement>(null);

  // Maintain stable object URLs for all selected photos in batch (prevents broken thumbnails and preview blanks)
  useEffect(() => {
    if (selectedImagesToSend.length === 0) {
      setSelectedImageUrls((prev) => {
        prev.forEach((u) => {
          try { URL.revokeObjectURL(u); } catch {}
        });
        return [];
      });
      return;
    }

    const urls = selectedImagesToSend.map((file) => URL.createObjectURL(file));
    setSelectedImageUrls(urls);

    return () => {
      urls.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      });
    };
  }, [selectedImagesToSend]);

  const handleStartCrop = () => {
    const activeFile = selectedImagesToSend[activePreviewImageIndex];
    if (!activeFile) return;
    const objectUrl = selectedImageUrls[activePreviewImageIndex] || URL.createObjectURL(activeFile);
    setImageToCropUrl(objectUrl);
    setIsCroppingImage(true);
  };

  const handleCropComplete = async (croppedBase64: string) => {
    try {
      let blob: Blob;
      if (croppedBase64.startsWith('data:')) {
        const parts = croppedBase64.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const b64Data = parts[1];
        const byteCharacters = atob(b64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mime });
      } else {
        const res = await fetch(croppedBase64);
        blob = await res.blob();
      }

      const activeFile = selectedImagesToSend[activePreviewImageIndex];
      const fileName = activeFile ? `cropped_${activeFile.name}` : `cropped_${Date.now()}.jpg`;
      const newFile = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      setSelectedImagesToSend((prev) => {
        const next = [...prev];
        next[activePreviewImageIndex] = newFile;
        return next;
      });
      setIsCroppingImage(false);
      if (imageToCropUrl) {
        URL.revokeObjectURL(imageToCropUrl);
        setImageToCropUrl(null);
      }
      showToast('✂️ Photo crop ho gayi!');
    } catch (err) {
      console.error('Failed to apply cropped image:', err);
      setIsCroppingImage(false);
    }
  };

  const handleCropCancel = () => {
    setIsCroppingImage(false);
    if (imageToCropUrl) {
      URL.revokeObjectURL(imageToCropUrl);
      setImageToCropUrl(null);
    }
  };

  const handleRemoveImageFromBatch = (indexToRemove: number) => {
    setSelectedImagesToSend((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length === 0) {
        setImagePreviewModalOpen(false);
        setImageCaptionInput('');
        return [];
      }
      if (activePreviewImageIndex >= next.length) {
        setActivePreviewImageIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  const handleAddMoreImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 10 - selectedImagesToSend.length;
    if (remainingSlots <= 0) {
      showToast('⚠️ Maximum 10 photos ki limit reach ho chuki hai!');
      return;
    }

    const validFiles: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        showToast(`⚠️ ${f.name} ka size 10MB se bada hai, skip kiya gaya.`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length > remainingSlots) {
      showToast(`⚠️ Sirf ${remainingSlots} aur photo(s) add kiye gaye (Maximum 10 limit).`);
    }

    const filesToAdd = validFiles.slice(0, remainingSlots);
    if (filesToAdd.length > 0) {
      setSelectedImagesToSend((prev) => [...prev, ...filesToAdd]);
      showToast(`📸 ${filesToAdd.length} aur photo(s) jud gaye!`);
    }

    if (addMoreImageInputRef.current) {
      addMoreImageInputRef.current.value = '';
    }
  };

  const openImageLightbox = (url: string, albumUrls?: string[], initialIndex: number = 0) => {
    const list = albumUrls && albumUrls.length > 0 ? albumUrls : [url];
    const validIndex = Math.max(0, Math.min(initialIndex, list.length - 1));
    setLightboxImagesList(list);
    setLightboxActiveIndex(validIndex);
    setLightboxImageUrl(list[validIndex] || url);
    setLightboxZoom(1);
    setLightboxRotation(0);
    setIsLightboxFullscreen(false);
  };

  const closeImageLightbox = () => {
    setLightboxImageUrl(null);
    setLightboxImagesList([]);
    setLightboxActiveIndex(0);
    setLightboxZoom(1);
    setLightboxRotation(0);
    setIsLightboxFullscreen(false);
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const goToNextLightboxImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (lightboxImagesList.length <= 1) return;
    const nextIdx = (lightboxActiveIndex + 1) % lightboxImagesList.length;
    setLightboxActiveIndex(nextIdx);
    setLightboxImageUrl(lightboxImagesList[nextIdx]);
    setLightboxZoom(1);
    setLightboxRotation(0);
  };

  const goToPrevLightboxImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (lightboxImagesList.length <= 1) return;
    const prevIdx = (lightboxActiveIndex - 1 + lightboxImagesList.length) % lightboxImagesList.length;
    setLightboxActiveIndex(prevIdx);
    setLightboxImageUrl(lightboxImagesList[prevIdx]);
    setLightboxZoom(1);
    setLightboxRotation(0);
  };

  const handleDownloadImage = async (url: string) => {
    try {
      setBannerNotice('📥 Photo save ho rahi hai...');
      if (url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `photo_${Date.now()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      }
      setBannerNotice('✅ Photo device par save ho gayi!');
      setTimeout(() => setBannerNotice(null), 3000);
    } catch {
      // Fallback direct open/save
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.download = `photo_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setBannerNotice('✅ Photo download trigger ho gayi!');
      setTimeout(() => setBannerNotice(null), 3000);
    }
  };

  // ── Ek Saath Saare Download Karein (Batch Download as ZIP or Multi-file) ──
  const handleDownloadAllImages = async (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    try {
      setBannerNotice(`📥 ${urls.length} photos ki ZIP file ban rahi hai...`);
      const zip = new JSZip();
      let addedCount = 0;

      for (let i = 0; i < urls.length; i++) {
        const u = urls[i];
        try {
          if (u.startsWith('data:')) {
            const parts = u.split(',');
            const base64 = parts[1];
            zip.file(`photo_${i + 1}.jpg`, base64, { base64: true });
            addedCount++;
          } else {
            const res = await fetch(u);
            if (res.ok) {
              const blob = await res.blob();
              zip.file(`photo_${i + 1}.jpg`, blob);
              addedCount++;
            }
          }
        } catch (e) {
          console.warn(`Error packaging image ${i + 1} for zip:`, e);
        }
      }

      if (addedCount > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        const blobUrl = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `nsta_photos_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
        setBannerNotice(`✅ Sabhi ${addedCount} photos ZIP file me download ho gayi!`);
      } else {
        // Fallback: sequential download
        for (let i = 0; i < urls.length; i++) {
          await handleDownloadImage(urls[i]);
          await new Promise((r) => setTimeout(r, 250));
        }
        setBannerNotice(`✅ Sabhi ${urls.length} photos download ho gayi!`);
      }
      setTimeout(() => setBannerNotice(null), 3500);
    } catch (err) {
      console.error('Download all failed:', err);
      for (let i = 0; i < urls.length; i++) {
        await handleDownloadImage(urls[i]);
        await new Promise((r) => setTimeout(r, 250));
      }
      setBannerNotice('✅ Sabhi photos download ho gayi!');
      setTimeout(() => setBannerNotice(null), 3000);
    }
  };

  const toggleLightboxFullscreen = () => {
    const nextState = !isLightboxFullscreen;
    setIsLightboxFullscreen(nextState);
    if (nextState) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(null), 3500);
  };

  // Unified Limit Expansion: 100 Credits OR 20 Diamonds for Messages (+50 limit), 100 Credits OR 10 Diamonds for Friends/Blocks (+10)
  const handleExpandLimit = async (
    type: 'MESSAGE' | 'FRIEND' | 'BLOCK',
    currency: 'CREDITS' | 'DIAMONDS'
  ): Promise<boolean> => {
    const costCredits = 100;
    const costDiamonds = 20;
    const curCredits = getTotalCredits(currentUser);
    const curDiamonds = currentUser.diamonds || 0;

    if (currency === 'CREDITS') {
      if (curCredits < costCredits) {
        showToast(`⚠️ Credits kam hain! Zaroorat: ${costCredits} 🪙, Aapke paas: ${curCredits} 🪙.`);
        return false;
      }
    } else {
      if (curDiamonds < costDiamonds) {
        showToast(`⚠️ Diamonds kam hain! Zaroorat: ${costDiamonds} 💎, Aapke paas: ${curDiamonds} 💎.`);
        return false;
      }
    }

    setIsExpandingLimit(true);
    try {
      const baseDeducted: User | null =
        currency === 'CREDITS'
          ? applyDeduction(currentUser, costCredits)
          : {
              ...currentUser,
              diamonds: Math.max(0, curDiamonds - costDiamonds),
            };

      if (!baseDeducted) {
        showToast('Payment poora nahi ho saka. Kripya punah koshish karein.');
        return false;
      }

      let updated: User = { ...baseDeducted };

      if (type === 'MESSAGE') {
        const today = getTodayStr();
        const nextExp = dailyMsgExpansions + 1;
        const addedAmount = getNextMessageExpansionAmount(currentTier, dailyMsgExpansions);
        const newLimit = calculateTotalDailyMsgLimit(currentTier, nextExp);
        setDailyMsgExpansions(nextExp);
        updated = {
          ...updated,
          dailyMessageLimitExpansions: nextExp,
        };
        try {
          localStorage.setItem(`nsta_msg_expansions_${user.id}_${today}`, String(nextExp));
        } catch {}
        showToast(`🎉 +${addedAmount} Daily Messages unlock ho gaye! Aaj ka naya limit: ${newLimit} msgs (Max 500).`);
        setShowMessageLimitModal(false);
      } else if (type === 'FRIEND') {
        const nextExp = friendExpansions + 1;
        setFriendExpansions(nextExp);
        updated = {
          ...updated,
          friendLimitExpansions: nextExp,
        };
        try {
          localStorage.setItem(`nsta_friend_expansions_${user.id}`, String(nextExp));
        } catch {}
        showToast(`🎉 +10 Friends limit unlock ho gaya! Naya limit: ${baseFriendLimit + nextExp * 10} friends.`);
        setShowFriendLimitModal(false);
      } else if (type === 'BLOCK') {
        const nextExp = blockExpansions + 1;
        setBlockExpansions(nextExp);
        updated = {
          ...updated,
          blockLimitExpansions: nextExp,
        };
        try {
          localStorage.setItem(`nsta_block_expansions_${user.id}`, String(nextExp));
        } catch {}
        showToast(`🎉 +10 Block slots unlock ho gaye! Naya limit: ${baseBlockLimit + nextExp * 10} slots.`);
        setShowLimitReachedModal(false);
        if (attemptingBlockUser) {
          setConfirmDialog({
            type: 'BLOCK',
            title: 'User Block Karein',
            description: `Limit badh gayi hai! Kya aap sach me ${attemptingBlockUser.name} ko block karna chahte hain?`,
            targetId: attemptingBlockUser.id,
            targetName: attemptingBlockUser.name,
          });
          setAttemptingBlockUser(null);
        }
      }

      const finalUser: User = updated;
      setCurrentUser(finalUser);
      try {
        localStorage.setItem('nst_current_user', JSON.stringify(finalUser));
        window.dispatchEvent(new CustomEvent('user-updated', { detail: finalUser }));
        window.dispatchEvent(new Event('storage'));
      } catch {}

      await saveUserToLive(finalUser).catch((err) => {
        console.warn('[Nsta Messenger] saveUserToLive notice:', err);
      });

      if (onUpdateUser) {
        onUpdateUser(finalUser);
      }
      return true;
    } catch (err) {
      console.error('Failed to expand limit:', err);
      showToast('Limit badhane me samasya aayi.');
      return false;
    } finally {
      setIsExpandingLimit(false);
    }
  };

  // Handle +10 Block Limit Expansion with Coins (Backward compatible wrapper)
  const handleExpandBlockLimit = async (): Promise<boolean> => {
    return handleExpandLimit('BLOCK', 'CREDITS');
  };

  // Safe Block Initiator (checks limit and prompts coin expansion if quota is full)
  const handleInitiateBlock = (target: { id: string; name: string }) => {
    if (blockedUsers.length >= totalBlockLimit) {
      setAttemptingBlockUser(target);
      setShowLimitReachedModal(true);
      return;
    }
    setConfirmDialog({
      type: 'BLOCK',
      title: 'User Block Karein',
      description: `Kya aap sach me ${target.name} ko block karna chahte hain? Block karne ke baad na wo aapko message bhej sakenge na aap unhe (${blockedUsers.length + 1}/${totalBlockLimit} slots).`,
      targetId: target.id,
      targetName: target.name,
    });
  };

  // Comprehensive list of all identity aliases for the current user (ID, UID, email, displayId, mobile)
  const currentUid = auth?.currentUser?.uid || '';
  const currentEmail = auth?.currentUser?.email || '';

  const allMyUserIdsKey = React.useMemo(() => {
    const raw = [
      user?.id,
      (user as any)?.uid,
      currentUid,
      user?.email,
      currentEmail,
      user?.displayId,
      (user as any)?.displayId,
      user?.mobile,
      (user as any)?.phone,
      effectiveUserId,
    ];
    return Array.from(new Set(raw.filter(Boolean).map(String))).sort().join(',');
  }, [
    user?.id,
    (user as any)?.uid,
    currentUid,
    user?.email,
    currentEmail,
    user?.displayId,
    (user as any)?.displayId,
    user?.mobile,
    (user as any)?.phone,
    effectiveUserId,
  ]);

  const allMyUserIds = React.useMemo(() => {
    return allMyUserIdsKey ? allMyUserIdsKey.split(',') : [];
  }, [allMyUserIdsKey]);

  // Check if a message was authored by the current user across all user aliases
  const isMsgSentByMe = (msg?: ChatMessage | null): boolean => {
    if (!msg) return false;
    if (isSameUser(msg.senderId, effectiveUserId) || isSameUser(msg.senderId, user?.id)) return true;
    return allMyUserIds.some((id) => isSameUser(msg.senderId, id));
  };

  // 1. Subscribe to confirmed friends
  useEffect(() => {
    const unsub = subscribeToFriends(effectiveUserId || user.id, (list) => {
      setFriends(list);
    }, allMyUserIds);
    return () => unsub();
  }, [user?.id, effectiveUserId, allMyUserIdsKey]);

  // 1b. Subscribe to blocked users
  useEffect(() => {
    const unsub = subscribeToBlockedUsers(effectiveUserId || user.id, (list) => {
      setBlockedUsers(list);
    });
    return () => unsub();
  }, [user?.id, effectiveUserId]);

  // 2. Subscribe to incoming friend requests (Zero-latency real-time sync across all aliases)
  useEffect(() => {
    const unsub = subscribeToFriendRequests(effectiveUserId || user.id, (reqs) => {
      setFriendRequests(reqs);
    }, allMyUserIds);
    return () => unsub();
  }, [user?.id, effectiveUserId, allMyUserIdsKey]);

  // Subscribe to outgoing sent requests
  useEffect(() => {
    const unsub = subscribeToSentFriendRequests(effectiveUserId || user.id, (sent) => {
      setSentRequests(sent);
    }, allMyUserIds);
    return () => unsub();
  }, [user?.id, effectiveUserId, allMyUserIdsKey]);

  // Redundant detection tracking refs
  const prevFriendIdsRef = useRef<Set<string>>(new Set());
  const isFriendsFirstMountRef = useRef<boolean>(true);
  const notifiedFriendAcceptedIdsRef = useRef<Set<string>>(new Set());

  // Subscribe to Friend Request Accepted events (Real-time alert for the sender!)
  useEffect(() => {
    const unsub = subscribeToFriendAccepted(
      effectiveUserId || user.id,
      (event) => {
        if (!event?.friend) return;
        const acceptedFriend = event.friend;
        if (notifiedFriendAcceptedIdsRef.current.has(acceptedFriend.id)) return;
        notifiedFriendAcceptedIdsRef.current.add(acceptedFriend.id);

        // 1. Immediately update friends list in React state
        setFriends((prev) => {
          if (prev.some((f) => isSameUser(f.id, acceptedFriend.id))) return prev;
          return [acceptedFriend, ...prev];
        });

        // 2. Remove from sent requests list in React state
        setSentRequests((prev) => prev.filter((r) => !isSameUser(r.toId, acceptedFriend.id)));

        // 3. Audio notification chime
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}

        // 4. Set state for interactive banner & toast
        setNewAcceptedFriend(acceptedFriend);
        showToast(`🎉 ${acceptedFriend.name} ne aapki friend request accept kar li! Chat unlock ho chuki hai.`);
      },
      allMyUserIds
    );
    return () => unsub();
  }, [user?.id, effectiveUserId, allMyUserIdsKey]);

  // Redundant detection: If a student we sent a request to is now in our friends list, notify once
  useEffect(() => {
    if (friends.length === 0) return;
    const currentFriendIds = new Set(friends.map((f) => f.id));

    if (isFriendsFirstMountRef.current) {
      isFriendsFirstMountRef.current = false;
      prevFriendIdsRef.current = currentFriendIds;
      return;
    }

    friends.forEach((f) => {
      if (!prevFriendIdsRef.current.has(f.id) && !notifiedFriendAcceptedIdsRef.current.has(f.id)) {
        notifiedFriendAcceptedIdsRef.current.add(f.id);
        const wasInSent = sentRequests.some((r) => isSameUser(r.toId, f.id));
        if (wasInSent) {
          setNewAcceptedFriend(f);
          showToast(`🎉 ${f.name} ne aapki friend request accept kar li! Chat unlock ho chuki hai.`);
          setSentRequests((prev) => prev.filter((r) => !isSameUser(r.toId, f.id)));
        }
      }
    });

    prevFriendIdsRef.current = currentFriendIds;
  }, [friends]);

  // 3. Fetch all registered students from Firebase & seeds
  useEffect(() => {
    fetchRegisteredStudents(effectiveUserId || user.id).then((list) => {
      if (list && list.length > 0) {
        setStudents(list);
      }
    });
  }, [user.id, effectiveUserId]);

  // 4. Initialize selected group if passed in props
  useEffect(() => {
    if (initialGroupId) {
      const found = groups.find((g) => g.id === initialGroupId);
      if (found) {
        setSelectedGroup(found);
        setSelectedContact(null);
      }
    }
  }, [initialGroupId, groups]);

  // Helper: Active chat context ID
  const activeChatContextId = selectedContact
    ? getDirectConversationId(effectiveUserId || user.id, selectedContact.id)
    : selectedGroup
    ? selectedGroup.id
    : '';

  // 5. Subscribe to messages when selectedContact or selectedGroup changes
  useEffect(() => {
    let unsub: (() => void) | undefined;

    if (selectedContact && effectiveUserId) {
      const convId = getDirectConversationId(effectiveUserId, selectedContact.id);
      setCurrentDisappearingTimer(getDisappearingTimer(convId));
      setIsCurrentChatLocked(isChatLocked(convId));
      markMessagesAsRead(false, convId, effectiveUserId);

      unsub = subscribeToDirectMessages(effectiveUserId, selectedContact.id, (msgs) => {
        const filtered = filterDisappearingMessages(msgs, convId, effectiveUserId);
        setMessages(filtered);
        markMessagesAsRead(false, convId, effectiveUserId);

        // Auto-reconciliation: If contact has replied or sent any messages, friend status is active!
        const hasContactReplied = filtered.some(
          (m) => !isSameUser(m.senderId, effectiveUserId) && m.type !== 'SYSTEM'
        );
        if (hasContactReplied) {
          confirmFriendshipLocally(effectiveUserId || user.id, selectedContact);
          setFriends((prev) => {
            if (prev.some((f) => isSameUser(f.id, selectedContact.id))) return prev;
            return [selectedContact, ...prev];
          });
          setSentRequests((prev) => prev.filter((r) => !isSameUser(r.toId, selectedContact.id)));
        }
      });
    } else if (selectedGroup && effectiveUserId) {
      const grpId = selectedGroup.id;
      setCurrentDisappearingTimer(getDisappearingTimer(grpId));
      setIsCurrentChatLocked(isChatLocked(grpId));
      markMessagesAsRead(true, grpId, effectiveUserId);

      unsub = subscribeToGroupMessages(selectedGroup.id, (msgs) => {
        const filtered = filterDisappearingMessages(msgs, grpId, effectiveUserId);
        setMessages(filtered);
      }, effectiveUserId);
    } else {
      setMessages([]);
      setCurrentDisappearingTimer(0);
      setIsCurrentChatLocked(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [selectedContact, selectedGroup, effectiveUserId]);

  // Handle exiting chat (Back button or modal close): Clear Snapchat vanish messages and lock chat if enabled
  const handleExitChat = () => {
    if (activeChatContextId) {
      clearSeenVanishMessages(activeChatContextId, !!selectedGroup, user.id);
      lockChatInSession(activeChatContextId);
    }
    setSelectedContact(null);
    setSelectedGroup(null);
    setIsSelectMode(false);
    setSelectedMsgIds(new Set());
    setReactionPickerMsgId(null);
    setActiveSwipeMsgId(null);
    setActiveSwipeOffset(0);
  };

  // Auto-lock open chat when app is minimized or user navigates/switches away
  useEffect(() => {
    const handleAutoLockOnMinimize = () => {
      if (document.hidden) {
        if (selectedContact || selectedGroup) {
          handleExitChat();
        }
      }
    };
    document.addEventListener('visibilitychange', handleAutoLockOnMinimize);
    window.addEventListener('blur', handleAutoLockOnMinimize);
    return () => {
      document.removeEventListener('visibilitychange', handleAutoLockOnMinimize);
      window.removeEventListener('blur', handleAutoLockOnMinimize);
    };
  }, [selectedContact, selectedGroup, activeChatContextId]);

  // Open Contact chat with PIN check
  const handleOpenContactChat = (contact: ChatContact) => {
    const convId = getDirectConversationId(effectiveUserId || user.id, contact.id);
    if (isChatLocked(convId)) {
      setPendingUnlockContext({ contact, contextId: convId });
      setPinInput('');
      setPinError(null);
      setShowPinModal(true);
    } else {
      setSelectedContact(contact);
      setSelectedGroup(null);
    }
  };

  // Open Group chat with PIN check
  const handleOpenGroupChat = (group: ChatGroup) => {
    if (isChatLocked(group.id)) {
      setPendingUnlockContext({ group, contextId: group.id });
      setPinInput('');
      setPinError(null);
      setShowPinModal(true);
    } else {
      setSelectedGroup(group);
      setSelectedContact(null);
    }
  };

  // ── First time default password set handler ──
  const handleSetInitialDefaultPin = () => {
    const targetPin = pinInput.trim();
    if (!targetPin) {
      setPinError('Kripya apna default password ya PIN darj karein');
      return;
    }
    setDefaultChatPin(targetPin, effectiveUserId || user.id);
    if (pendingUnlockContext?.contextId) {
      unlockChatInSession(pendingUnlockContext.contextId);
      if (pendingUnlockContext.contact) {
        setSelectedContact(pendingUnlockContext.contact);
        setSelectedGroup(null);
      } else if (pendingUnlockContext.group) {
        setSelectedGroup(pendingUnlockContext.group);
        setSelectedContact(null);
      }
      setPendingUnlockContext(null);
    }
    setShowPinModal(false);
    setPinInput('');
    setPinError(null);
    showToast('🔒 Default Chat Password set ho gaya aur chat unlock ho gayi!');
  };

  const handleDirectSetPin = () => {
    const target = pinInput.trim();
    if (!target) {
      setPinError('Kripya apna password ya PIN darj karein');
      return;
    }
    const contextId = pendingUnlockContext?.contextId || '';
    const isStarred = contextId ? isChatStarred(contextId, effectiveUserId || user.id) : false;
    if (isStarred) {
      setSpecialChatCategoryPin(target, effectiveUserId || user.id);
      showToast('⭐ Special Chat Password set ho gaya aur chat unlock ho gayi!');
    } else {
      setDefaultChatPin(target, effectiveUserId || user.id);
      showToast('🔒 Default Chat Password set ho gaya aur chat unlock ho gayi!');
    }
    if (pendingUnlockContext?.contextId) {
      unlockChatInSession(pendingUnlockContext.contextId);
      if (pendingUnlockContext.contact) {
        setSelectedContact(pendingUnlockContext.contact);
        setSelectedGroup(null);
      } else if (pendingUnlockContext.group) {
        setSelectedGroup(pendingUnlockContext.group);
        setSelectedContact(null);
      }
      setPendingUnlockContext(null);
    }
    setShowPinModal(false);
    setPinInput('');
    setPinError(null);
  };

  const handleChangePin = () => {
    const target = newPinInput.trim();
    if (!target) {
      setNewPinError('Kripya naya password ya PIN darj karein');
      return;
    }
    setDefaultChatPin(target, effectiveUserId || user.id);
    setShowChangePinModal(false);
    setNewPinInput('');
    setNewPinError(null);
    showToast('🔒 Naya Chat Password save ho gaya!');
  };

  // ── Verify PIN / Password to unlock chat (Strict 2-Category Check) ──
  const handleVerifyPin = () => {
    const contextId = pendingUnlockContext?.contextId || '';
    const isStarred = contextId ? isChatStarred(contextId, effectiveUserId || user.id) : false;
    if (verifyChatCategoryPin(pinInput, isStarred, contextId, effectiveUserId || user.id)) {
      if (contextId) {
        unlockChatInSession(contextId);
      }
      setShowPinModal(false);
      if (pendingUnlockContext?.contact) {
        setSelectedContact(pendingUnlockContext.contact);
        setSelectedGroup(null);
      } else if (pendingUnlockContext?.group) {
        setSelectedGroup(pendingUnlockContext.group);
        setSelectedContact(null);
      }
      setPendingUnlockContext(null);
      setPinInput('');
      setPinError(null);
    } else {
      setPinError(
        isStarred
          ? 'Galat Special Password! Yeh chat Star Marked hai, Special Password darj karein.'
          : 'Galat Default Password! Yeh chat Default category mein hai, Default Password darj karein.'
      );
    }
  };

  // ── Special chat password management (inside active chat) ──
  const handleSaveSpecialPin = () => {
    if (!activeChatContextId) return;
    const trimmed = specialPinInput.trim();
    if (!trimmed) {
      setSpecialPinError('Kripya special password darj karein');
      return;
    }
    setSpecialChatPin(activeChatContextId, trimmed, effectiveUserId || user.id);
    setSpecialPinInput('');
    setSpecialPinError(null);
    setShowPinSettingsModal(false);
    showToast('🔒 Is chat ke liye special password set ho gaya!');
  };

  const handleResetToDefaultPin = () => {
    if (!activeChatContextId) return;
    removeSpecialChatPin(activeChatContextId, effectiveUserId || user.id);
    setSpecialPinInput('');
    setSpecialPinError(null);
    setShowPinSettingsModal(false);
    showToast('🔄 Special password hata diya gaya. Ab yeh chat default password use karegi.');
  };

  const handleChangeDefaultPin = () => {
    const oldTrimmed = oldDefaultPinInput.trim();
    const newTrimmed = newDefaultPinInput.trim();
    const currentDefault = getDefaultChatPin(effectiveUserId || user.id);

    if (currentDefault && oldTrimmed !== currentDefault) {
      setDefaultPinError('Purana (current) default password galat hai!');
      return;
    }
    if (!newTrimmed) {
      setDefaultPinError('Kripya naya default password darj karein');
      return;
    }
    setDefaultChatPin(newTrimmed, effectiveUserId || user.id);
    setOldDefaultPinInput('');
    setNewDefaultPinInput('');
    setDefaultPinError(null);
    setShowPinSettingsModal(false);
    showToast('🔒 Sabhi chats ke liye Default Password update ho gaya!');
  };

  // ── Handle single message deletion (Strict sender-only delete for everyone) ──
  const handleDeleteMessage = async (mode: 'FOR_ME' | 'FOR_EVERYONE') => {
    if (!deletingMessage || !activeChatContextId) return;

    const targetMsgId = deletingMessage.id;
    const canDeleteEveryone =
      isMsgSentByMe(deletingMessage) ||
      (selectedGroup && isSameUser(selectedGroup.creatorId, effectiveUserId || user.id));

    // Enforce: Only the author of the message (or group creator) can delete for everyone!
    const effectiveMode = mode === 'FOR_EVERYONE' && !canDeleteEveryone ? 'FOR_ME' : mode;

    // 1. Immediately close the delete popup modal so it never lingers
    setDeletingMessage(null);

    // 2. Instantly remove message from UI state so it completely vanishes from screen
    setMessages((prev) => prev.filter((m) => m.id !== targetMsgId));

    if (effectiveMode === 'FOR_ME') {
      showToast('🗑️ Message deleted for you');
    } else {
      showToast('🗑️ Message deleted for everyone');
    }

    // 3. Persist deletion in background
    await deleteChatMessage(
      !!selectedGroup,
      activeChatContextId,
      targetMsgId,
      effectiveUserId || user.id,
      effectiveMode,
      allMyUserIds
    );
  };

  // ── Handle batch deletion of selected messages (Strict sender-only delete for everyone) ──
  const handleBatchDelete = async (mode: 'FOR_ME' | 'FOR_EVERYONE') => {
    if (selectedMsgIds.size === 0 || !activeChatContextId) return;
    const idsToDelete = Array.from(selectedMsgIds);
    const selectedList = displayMessages.filter((m) => selectedMsgIds.has(m.id));

    const isGroupCreator =
      !!selectedGroup && isSameUser(selectedGroup.creatorId, effectiveUserId || user.id);
    const allSentByMe = selectedList.length > 0 && selectedList.every((m) => isMsgSentByMe(m));
    const canBatchDeleteEveryone = isGroupCreator || allSentByMe;

    const effectiveBatchMode =
      mode === 'FOR_EVERYONE' && !canBatchDeleteEveryone ? 'FOR_ME' : mode;

    // 1. Immediately close dialog & exit multi-select mode
    setShowBatchDeleteDialog(false);
    setIsSelectMode(false);
    setSelectedMsgIds(new Set());

    // 2. Instantly remove selected messages from screen so they vanish
    setMessages((prev) => prev.filter((m) => !idsToDelete.includes(m.id)));

    if (effectiveBatchMode === 'FOR_ME') {
      showToast(`🗑️ ${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''} deleted for you`);
    } else {
      showToast(`🗑️ ${idsToDelete.length} message${idsToDelete.length > 1 ? 's' : ''} deleted for everyone`);
    }

    const promises = idsToDelete.map(async (msgId) => {
      const targetMsg =
        selectedList.find((m) => m.id === msgId) || messages.find((m) => m.id === msgId);
      if (!targetMsg) return;
      const targetCanDeleteEveryone = isMsgSentByMe(targetMsg) || isGroupCreator;
      const singleMode =
        effectiveBatchMode === 'FOR_EVERYONE' && targetCanDeleteEveryone ? 'FOR_EVERYONE' : 'FOR_ME';
      return deleteChatMessage(
        !!selectedGroup,
        activeChatContextId,
        msgId,
        effectiveUserId || user.id,
        singleMode,
        allMyUserIds
      );
    });

    await Promise.all(promises);
  };

  // Copy selected messages to clipboard (single or batch)
  const handleCopySelectedMessages = async () => {
    if (selectedMsgIds.size === 0) return;
    const selectedList = messages.filter((m) => selectedMsgIds.has(m.id));
    if (selectedList.length === 0) return;

    let textToCopy = '';
    if (selectedList.length === 1) {
      textToCopy = selectedList[0].text || '';
    } else {
      textToCopy = selectedList
        .map((m) => {
          const timeStr = formatTime(m.timestamp);
          return `[${timeStr}] ${m.senderName}: ${m.text || ''}`;
        })
        .join('\n\n');
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const ta = document.createElement('textarea');
        ta.value = textToCopy;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast(
        `📋 ${selectedList.length > 1 ? `${selectedList.length} messages` : 'Message'} copy ho gaya!`
      );
    } catch {
      showToast('📋 Message copy ho gaya!');
    }

    setIsSelectMode(false);
    setSelectedMsgIds(new Set());
    setReactionPickerMsgId(null);
  };

  // Save / Unsave selected messages (Snapchat-style Save in Chat)
  // "save kìya gaya message snapchart wala mode me delete na hoga unsave hone pe hi delete hoga"
  const handleToggleSaveSelectedMessages = async (targetMsgId?: string) => {
    if (!activeChatContextId) return;

    let targetIds: string[] = [];
    if (targetMsgId) {
      targetIds = [targetMsgId];
    } else {
      targetIds = Array.from(selectedMsgIds);
    }

    if (targetIds.length === 0) return;
    const selectedList = messages.filter((m) => targetIds.includes(m.id));
    if (selectedList.length === 0) return;

    const allAreSaved = selectedList.every((m) => isMessageSaved(m, effectiveUserId));
    const nextSavedState = !allAreSaved;

    // Optimistic UI state update
    setMessages((prev) =>
      prev.map((m) => {
        if (targetIds.includes(m.id)) {
          const savedBy = { ...(m.savedBy || {}) };
          if (nextSavedState) {
            savedBy[effectiveUserId] = true;
          } else {
            delete savedBy[effectiveUserId];
          }
          return {
            ...m,
            isSaved: nextSavedState,
            savedBy,
          };
        }
        return m;
      })
    );

    // Save in storage & RTDB
    for (const msgId of targetIds) {
      await toggleSaveChatMessage(
        !!selectedGroup,
        activeChatContextId,
        msgId,
        effectiveUserId,
        nextSavedState
      );
    }

    if (nextSavedState) {
      showToast(
        `📌 ${targetIds.length > 1 ? `${targetIds.length} messages` : 'Message'} saved in chat! (Snapchat Vanish Mode me delete nahi hoga)`
      );
    } else {
      showToast(
        `📌 ${targetIds.length > 1 ? `${targetIds.length} messages` : 'Message'} unsaved.`
      );
    }

    setIsSelectMode(false);
    setSelectedMsgIds(new Set());
    setReactionPickerMsgId(null);
  };

  // Touch & Mouse Gesture Handlers for Swipe-to-Reply, Long-Press Multi-Select & Emoji Reaction
  const handleMessageTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (isSelectMode) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, msgId: msg.id, time: Date.now() };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
      setIsSelectMode(true);
      setSelectedMsgIds((prev) => new Set(prev).add(msg.id));
      if (!msg.isDeletedForEveryone) {
        setReactionPickerMsgId(msg.id);
      }
      touchStartPosRef.current = null;
      setActiveSwipeMsgId(null);
      setActiveSwipeOffset(0);
    }, 380);
  };

  const handleMessageTouchMove = (e: React.TouchEvent, msg: ChatMessage) => {
    if (!touchStartPosRef.current || touchStartPosRef.current.msgId !== msg.id) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartPosRef.current.x;
    const diffY = touch.clientY - touchStartPosRef.current.y;

    // Cancel long press on movement
    if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Horizontal swipe gesture for reply
    if (!isSelectMode && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
      const clamped = diffX > 0 ? Math.min(diffX, 65) : Math.max(diffX, -65);
      setActiveSwipeMsgId(msg.id);
      setActiveSwipeOffset(clamped);
    }
  };

  const handleMessageTouchEnd = (_e: React.TouchEvent, msg: ChatMessage) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (activeSwipeMsgId === msg.id) {
      if (Math.abs(activeSwipeOffset) >= 35) {
        if (!msg.isDeletedForEveryone) {
          if (navigator.vibrate) {
            try { navigator.vibrate(25); } catch {}
          }
          handleInitiateReply(msg);
        }
      }
      setActiveSwipeMsgId(null);
      setActiveSwipeOffset(0);
    }

    // Double tap detection for reaction popup
    if (!isSelectMode && !msg.isDeletedForEveryone) {
      const now = Date.now();
      const lastTap = lastTapTimeRef.current;
      if (lastTap && lastTap.id === msg.id && now - lastTap.time < 320) {
        setReactionPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
        if (navigator.vibrate) {
          try { navigator.vibrate(30); } catch {}
        }
        lastTapTimeRef.current = null;
      } else {
        lastTapTimeRef.current = { id: msg.id, time: now };
      }
    }
  };

  const handleMessageMouseDown = (_e: React.MouseEvent, msg: ChatMessage) => {
    if (isSelectMode) return;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch {}
      }
      setIsSelectMode(true);
      setSelectedMsgIds((prev) => new Set(prev).add(msg.id));
      if (!msg.isDeletedForEveryone) {
        setReactionPickerMsgId(msg.id);
      }
    }, 420);
  };

  const handleMessageMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Helper: format disappearing duration
  const formatDisappearingDuration = (ms: number): string => {
    if (ms === 86400000) return '24 Hours';
    if (ms === 604800000) return '7 Days (1 Week)';
    if (ms === 2592000000) return '30 Days';
    if (ms === 7776000000) return '90 Days';
    if (ms === -1) return 'Snapchat Vanish Mode';
    return 'Off';
  };

  // Auto scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper: check if a user is a confirmed friend
  const isFriendWith = (targetUserId: string): boolean => {
    return isUserFriend(targetUserId);
  };

  // Helper: check if a user is blocked
  const isUserBlocked = (targetUserId: string): boolean => {
    return blockedUsers.some((b) => isSameUser(b.id, targetUserId));
  };

  // Helper: check if outgoing request is pending
  const hasPendingSentRequest = (targetUserId: string): boolean => {
    if (isUserFriend(targetUserId)) return false;
    const cleanTarget = sanitizeRtdbKey(targetUserId);
    if (sentRequests.some((r) => (isSameUser(r.toId, targetUserId) || sanitizeRtdbKey(r.toId) === cleanTarget) && (r.status === 'PENDING' || !r.status))) {
      return true;
    }
    const raw = localStorage.getItem('nsta_friend_requests');
    if (!raw) return false;
    try {
      const all: FriendRequest[] = JSON.parse(raw);
      return all.some((r) => isSameUser(r.fromId, effectiveUserId || user.id) && (isSameUser(r.toId, targetUserId) || sanitizeRtdbKey(r.toId) === cleanTarget) && (r.status === 'PENDING' || !r.status));
    } catch {
      return false;
    }
  };

  // Helper: check if incoming request exists
  const hasIncomingRequest = (targetUserId: string): FriendRequest | undefined => {
    const cleanTarget = sanitizeRtdbKey(targetUserId);
    return friendRequests.find(
      (r) => (r.fromId === targetUserId || sanitizeRtdbKey(r.fromId) === cleanTarget) && r.status === 'PENDING'
    );
  };

  // Execute Action from Confirmation Modal
  const handleExecuteConfirmAction = async () => {
    if (!confirmDialog) return;
    const { type, targetId, targetName, groupId } = confirmDialog;
    setActionLoading(true);

    try {
      if (type === 'UNFRIEND') {
        await unfriendUser(user.id, targetId);
        setFriends((prev) => prev.filter((f) => f.id !== targetId));
        if (selectedContact?.id === targetId) {
          setSelectedContact(null);
        }
        showToast(`❌ ${targetName} ko friend list se hata diya gaya hai.`);
      } else if (type === 'BLOCK') {
        if (blockedUsers.length >= totalBlockLimit) {
          setAttemptingBlockUser({ id: targetId, name: targetName });
          setShowLimitReachedModal(true);
          return;
        }
        await blockUser(user.id, { id: targetId, name: targetName });
        setBlockedUsers((prev) => [...prev, { id: targetId, name: targetName, blockedAt: Date.now() }]);
        setFriends((prev) => prev.filter((f) => f.id !== targetId));
        showToast(`🚫 ${targetName} ko block kar diya gaya hai (${blockedUsers.length + 1}/${totalBlockLimit} slots).`);
      } else if (type === 'UNBLOCK') {
        await unblockUser(user.id, targetId);
        setBlockedUsers((prev) => prev.filter((b) => b.id !== targetId));
        showToast(`✅ ${targetName} ko unblock kar diya gaya hai.`);
      } else if (type === 'LEAVE_GROUP') {
        const gId = groupId || targetId;
        await leaveGroup(gId, { id: user.id, name: user.name || 'Student' });
        setGroups((prev) =>
          prev.map((g) => {
            if (g.id === gId) {
              const nextMembers = { ...(g.members || {}) };
              delete nextMembers[user.id];
              return {
                ...g,
                memberCount: Math.max(0, Object.keys(nextMembers).length),
                members: nextMembers,
              };
            }
            return g;
          })
        );
        if (selectedGroup?.id === gId) {
          setSelectedGroup(null);
        }
        setShowGroupInfo(false);
        showToast(`👋 '${targetName}' group se aap bahar aa gaye hain.`);
      } else if (type === 'DELETE_GROUP') {
        const gId = groupId || targetId;
        await deleteWhatsAppGroup(gId, { id: user.id, name: user.name || 'Student' });
        setGroups((prev) => prev.filter((g) => g.id !== gId));
        if (selectedGroup?.id === gId) {
          setSelectedGroup(null);
        }
        setShowGroupInfo(false);
        showToast(`🗑️ '${targetName}' group permanently delete ho gaya.`);
      } else if (type === 'CLEAR_CHAT') {
        if (selectedGroup) {
          clearChatHistory(selectedGroup.id, true);
          setMessages([]);
          showToast('Group chat messages cleared.');
        } else if (selectedContact) {
          const convId = getDirectConversationId(user.id, selectedContact.id);
          clearChatHistory(convId, false);
          setMessages([]);
          showToast('Direct chat messages cleared.');
        }
      }
    } catch (err) {
      console.error('Action failed:', err);
      showToast('Koshish asafal rahi. Kripya punah prayas karein.');
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  // Handle student card click: Must be a friend to start chatting!
  const handleStudentClick = (student: ChatContact) => {
    if (isFriendWith(student.id)) {
      setSelectedContact(student);
      setSelectedGroup(null);
    } else {
      setFriendReqPromptStudent(student);
    }
  };

  // Handle Send Friend Request with INSTANT OPTIMISTIC UI (Zero delay)
  const handleSendFriendRequest = async (targetStudent: ChatContact) => {
    if (
      !targetStudent ||
      isSameUser(targetStudent.id, user.id) ||
      isSameUser(targetStudent.id, effectiveUserId) ||
      sendingReqIds.has(targetStudent.id)
    )
      return;

    if (friends.length >= totalFriendLimit) {
      setShowFriendLimitModal(true);
      return;
    }

    const reqId = `${effectiveUserId}_${targetStudent.id}`;
    const optimisticReq: FriendRequest = {
      id: reqId,
      fromId: effectiveUserId,
      fromName: user.name || 'Student',
      fromPhoto: user.photoURL || (user as any).avatarUrl || '',
      fromRole: user.role || 'STUDENT',
      fromUid: (user as any).uid || auth.currentUser?.uid || '',
      fromEmail: user.email || auth.currentUser?.email || '',
      toId: targetStudent.id,
      toName: targetStudent.name,
      toPhoto: targetStudent.photoURL || '',
      toUid: targetStudent.uid || '',
      toEmail: targetStudent.email || '',
      status: 'PENDING',
      timestamp: Date.now(),
    };

    // ⚡ INSTANT OPTIMISTIC FEEDBACK: UI updates immediately without waiting for network!
    setSentRequests((prev) => [optimisticReq, ...prev.filter((r) => !isSameUser(r.toId, targetStudent.id))]);
    setFriendReqPromptStudent(null);
    showToast(`🚀 Friend request sent to ${targetStudent.name}!`);
    setSendingReqIds((prev) => new Set(prev).add(targetStudent.id));

    try {
      await sendFriendRequest(
        {
          id: effectiveUserId,
          name: user.name || 'Student',
          photoURL: user.photoURL || (user as any).avatarUrl || '',
          role: user.role || 'STUDENT',
          uid: (user as any).uid || auth.currentUser?.uid || '',
          email: user.email || auth.currentUser?.email || '',
          displayId: user.displayId || '',
          mobile: user.mobile || '',
        },
        {
          id: targetStudent.id,
          name: targetStudent.name,
          photoURL: targetStudent.photoURL || '',
          uid: targetStudent.uid || '',
          email: targetStudent.email || '',
          displayId: targetStudent.displayId || '',
          mobile: targetStudent.mobile || '',
        }
      );
    } catch (err) {
      console.warn('Error sending friend request:', err);
    } finally {
      setSendingReqIds((prev) => {
        const next = new Set(prev);
        next.delete(targetStudent.id);
        return next;
      });
    }
  };

  // Handle Cancel Sent Request
  const handleCancelSentRequest = async (toUserId: string, toName: string) => {
    setSentRequests((prev) => prev.filter((r) => !isSameUser(r.toId, toUserId)));
    showToast(`Request to ${toName} cancelled.`);
    try {
      await cancelFriendRequest(effectiveUserId || user.id, toUserId, allMyUserIds);
    } catch (err) {
      console.warn('[Nsta Messenger] cancel friend request error:', err);
    }
  };

  // Handle Accept Friend Request (Instantly unlocks chat and atomically updates both profiles)
  const handleAcceptRequest = async (req: FriendRequest) => {
    if (friends.length >= totalFriendLimit) {
      setShowFriendLimitModal(true);
      return;
    }

    const requesterStudent = students.find((s) => isSameUser(s.id, req.fromId));

    // 1. Optimistic friends list update immediately so Chat unlocks with ZERO delay
    const newFriendContact: ChatContact = {
      id: req.fromId,
      name: req.fromName,
      photoURL: req.fromPhoto || requesterStudent?.photoURL || '',
      isOnline: true,
      statusText: 'Friend 🤝 · Available to chat',
      classLevel: 'Friend',
      uid: (req as any).fromUid || requesterStudent?.uid || '',
      email: (req as any).fromEmail || requesterStudent?.email || '',
    };

    setFriends((prev) => {
      if (prev.some((f) => isSameUser(f.id, req.fromId))) return prev;
      return [newFriendContact, ...prev];
    });
    setFriendRequests((prev) => prev.filter((r) => r.id !== req.id && !isSameUser(r.fromId, req.fromId)));
    setSentRequests((prev) => prev.filter((r) => !isSameUser(r.toId, req.fromId)));

    // 2. Instantly open chat with new friend
    handleOpenContactChat(newFriendContact);
    showToast(`🎉 ${req.fromName} ke sath dosti ho gayi! Chat unlock ho chuki hai.`);

    // 3. Persist to Firebase in background atomically
    try {
      await acceptFriendRequest(
        {
          id: effectiveUserId || user.id,
          name: user.name || 'Student',
          photoURL: user.photoURL || (user as any).avatarUrl,
          uid: (user as any).uid || auth.currentUser?.uid || '',
          email: user.email || auth.currentUser?.email || '',
          displayId: user.displayId || '',
        },
        {
          id: req.fromId,
          name: req.fromName,
          photoURL: req.fromPhoto || requesterStudent?.photoURL || '',
          uid: (req as any).fromUid || requesterStudent?.uid || '',
          email: (req as any).fromEmail || requesterStudent?.email || '',
          displayId: (req as any).fromDisplayId || requesterStudent?.displayId || '',
        }
      );
    } catch (e) {
      console.warn('[Nsta Messenger] acceptFriendRequest error:', e);
    }
  };

  // In-chat 1-tap friend request acceptance
  const handleAcceptFromChat = async (reqData?: FriendRequest) => {
    if (!selectedContact) return;
    const req: FriendRequest = reqData || {
      id: `${selectedContact.id}_${effectiveUserId}`,
      fromId: selectedContact.id,
      fromName: selectedContact.name,
      fromPhoto: selectedContact.photoURL || '',
      fromRole: selectedContact.role || 'STUDENT',
      toId: effectiveUserId,
      toName: user.name || 'Student',
      status: 'PENDING',
      timestamp: Date.now(),
    };
    await handleAcceptRequest(req);
  };

  // Handle Decline Friend Request
  const handleRejectRequest = async (req: FriendRequest) => {
    try {
      await rejectFriendRequest(effectiveUserId || user.id, req.fromId, allMyUserIds);
    } catch {}
    setFriendRequests((prev) => prev.filter((r) => r.id !== req.id && !isSameUser(r.fromId, req.fromId)));
    showToast(`Friend Request declined.`);
  };

  // Handle Send Text Message (Optimistic update with reply support)
  const handleSendMessage = async () => {
    if (!inputText.trim()) return;
    if (totalDailyMsgLimit !== Infinity && dailyMessagesSent >= totalDailyMsgLimit) {
      setShowMessageLimitModal(true);
      return;
    }
    const textToSend = inputText;
    const currentReply = replyingTo
      ? {
          id: replyingTo.id,
          senderName: replyingTo.senderName || 'Student',
          text: (replyingTo.text || (replyingTo.type === 'VOICE' ? '🎤 Voice message' : '📎 Attachment')).slice(0, 150),
        }
      : undefined;

    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowAttachmentMenu(false);

    if (totalDailyMsgLimit !== Infinity) {
      const today = getTodayStr();
      const nextSent = dailyMessagesSent + 1;
      setDailyMessagesSent(nextSent);
      try {
        localStorage.setItem(`nsta_daily_msg_${user.id}_${today}`, String(nextSent));
      } catch {}
    }

    const userPhoto = user.photoURL || (user as any).avatarUrl;

    if (selectedContact) {
      if (isUserBlocked(selectedContact.id)) {
        showToast('Aapne is user ko block kiya hua hai. Pehle unblock karein.');
        return;
      }

      // Optimistic message addition: initial status is strictly SENT (single tick), not READ
      const optimisticMsg: ChatMessage = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: effectiveUserId,
        senderName: user.name || 'Student',
        ...(userPhoto ? { senderPhoto: userPhoto } : {}),
        text: textToSend.trim(),
        timestamp: Date.now(),
        type: 'TEXT',
        status: 'SENT',
        seen: false,
        delivered: false,
        readByRecipient: false,
        ...(currentReply ? { replyTo: currentReply } : {}),
      };
      setMessages((prev) => [
        ...prev.filter((m) => !isMessageDeletedForUser(effectiveUserId, m)),
        optimisticMsg,
      ]);

      await sendPrivateMessage(
        effectiveUserId,
        user.name || 'Student',
        userPhoto,
        selectedContact.id,
        textToSend,
        'TEXT',
        currentReply ? { replyTo: currentReply } : undefined
      );
    } else if (selectedGroup) {
      const optimisticMsg: ChatMessage = {
        id: `local_grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: effectiveUserId,
        senderName: user.name || 'Student',
        ...(userPhoto ? { senderPhoto: userPhoto } : {}),
        text: textToSend.trim(),
        timestamp: Date.now(),
        type: 'TEXT',
        status: 'SENT',
        seen: false,
        delivered: false,
        ...(currentReply ? { replyTo: currentReply } : {}),
      };
      setMessages((prev) => [
        ...prev.filter((m) => !isMessageDeletedForUser(effectiveUserId, m)),
        optimisticMsg,
      ]);

      await sendGroupMessage(
        selectedGroup.id,
        effectiveUserId,
        user.name || 'Student',
        userPhoto,
        textToSend,
        'TEXT',
        currentReply ? { replyTo: currentReply } : undefined
      );
    }
  };

  // ── Handle Image Selection & ImgBB Upload (Up to 10 photos at once) ──
  const handleSelectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        showToast(`⚠️ ${f.name} ka size 10MB se zyada hai, skip kiya gaya.`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    if (validFiles.length > 10) {
      showToast('⚠️ Ek baar me maximum 10 photos bhej sakte hain. Pehli 10 photos select ki gayi hain.');
    }

    const finalBatch = validFiles.slice(0, 10);
    const initialUrls = finalBatch.map((f) => URL.createObjectURL(f));
    setSelectedImageUrls(initialUrls);
    setSelectedImagesToSend(finalBatch);
    setActivePreviewImageIndex(0);
    setImageCaptionInput('');
    setImagePreviewModalOpen(true);

    if (e.target) {
      e.target.value = '';
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  const handleSendImageMessage = async () => {
    if (selectedImagesToSend.length === 0) return;
    if (totalDailyMsgLimit !== Infinity && dailyMessagesSent >= totalDailyMsgLimit) {
      setShowMessageLimitModal(true);
      return;
    }

    if (selectedContact && isUserBlocked(selectedContact.id)) {
      showToast('Aapne is user ko block kiya hua hai. Pehle unblock karein.');
      return;
    }

    setIsUploadingImage(true);
    setUploadProgressText(`Photos prepare ho rahi hain (0/${selectedImagesToSend.length})...`);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < selectedImagesToSend.length; i++) {
        setUploadProgressText(
          `Photo ${i + 1} of ${selectedImagesToSend.length} ${isHdQuality ? '(HD Quality)' : ''} bhej rahe hain...`
        );
        const file = selectedImagesToSend[i];
        const uploadedUrl = await uploadImageToImgBB(
          file,
          `nsta_chat_${effectiveUserId}_${Date.now()}_${i}`,
          { isHd: isHdQuality }
        );
        if (uploadedUrl) {
          uploadedUrls.push(uploadedUrl);
        }
      }

      if (uploadedUrls.length === 0) {
        throw new Error('Photo link taiyaar nahi ho saki. Dobara koshish karein.');
      }

      const userPhoto = user.photoURL || (user as any).avatarUrl;
      const captionText = imageCaptionInput.trim();

      if (totalDailyMsgLimit !== Infinity) {
        const today = getTodayStr();
        const nextSent = dailyMessagesSent + 1;
        setDailyMessagesSent(nextSent);
        try {
          localStorage.setItem(`nsta_daily_msg_${user.id}_${today}`, String(nextSent));
        } catch {}
      }

      if (selectedContact) {
        const optimisticMsg: ChatMessage = {
          id: `local_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId: effectiveUserId,
          senderName: user.name || 'Student',
          ...(userPhoto ? { senderPhoto: userPhoto } : {}),
          text: captionText,
          timestamp: Date.now(),
          type: 'IMAGE',
          mediaUrl: uploadedUrls[0],
          mediaUrls: uploadedUrls,
          status: 'SENT',
          seen: false,
          delivered: false,
          readByRecipient: false,
          isHd: isHdQuality,
        };

        setMessages((prev) => [
          ...prev.filter((m) => !isMessageDeletedForUser(effectiveUserId, m)),
          optimisticMsg,
        ]);

        await sendPrivateMessage(
          effectiveUserId,
          user.name || 'Student',
          userPhoto,
          selectedContact.id,
          captionText,
          'IMAGE',
          { mediaUrl: uploadedUrls[0], mediaUrls: uploadedUrls, isHd: isHdQuality }
        );
      } else if (selectedGroup) {
        const optimisticMsg: ChatMessage = {
          id: `local_grp_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          senderId: effectiveUserId,
          senderName: user.name || 'Student',
          ...(userPhoto ? { senderPhoto: userPhoto } : {}),
          text: captionText,
          timestamp: Date.now(),
          type: 'IMAGE',
          mediaUrl: uploadedUrls[0],
          mediaUrls: uploadedUrls,
          status: 'SENT',
          seen: false,
          delivered: false,
          isHd: isHdQuality,
        };

        setMessages((prev) => [
          ...prev.filter((m) => !isMessageDeletedForUser(effectiveUserId, m)),
          optimisticMsg,
        ]);

        await sendGroupMessage(
          selectedGroup.id,
          effectiveUserId,
          user.name || 'Student',
          userPhoto,
          captionText,
          'IMAGE',
          { mediaUrl: uploadedUrls[0], mediaUrls: uploadedUrls, isHd: isHdQuality }
        );
      }

      showToast(`📷 ${uploadedUrls.length} photo(s) ${isHdQuality ? '(HD Quality) ' : ''}safaltapoorvak bhej di gayi!`);
      setImagePreviewModalOpen(false);
      setSelectedImagesToSend([]);
      setActivePreviewImageIndex(0);
      setImageCaptionInput('');
      setIsCroppingImage(false);
      setUploadProgressText('');
      setIsHdQuality(false);
    } catch (err: any) {
      console.error('[WhatsAppChatModal] Image upload/send failed:', err);
      showToast(`❌ Photo bhejte samay samasya aayi: ${err.message || 'Network error'}`);
    } finally {
      setIsUploadingImage(false);
      setUploadProgressText('');
    }
  };

  // Handle Quick Attachment
  const handleSendQuickAttachment = async (type: 'DOUBT' | 'NOTE' | 'MCQ', content: string) => {
    if (totalDailyMsgLimit !== Infinity && dailyMessagesSent >= totalDailyMsgLimit) {
      setShowMessageLimitModal(true);
      return;
    }
    setShowAttachmentMenu(false);

    if (totalDailyMsgLimit !== Infinity) {
      const today = getTodayStr();
      const nextSent = dailyMessagesSent + 1;
      setDailyMessagesSent(nextSent);
      try {
        localStorage.setItem(`nsta_daily_msg_${user.id}_${today}`, String(nextSent));
      } catch {}
    }

    const userPhoto = user.photoURL || (user as any).avatarUrl;
    const msgType = type === 'NOTE' ? 'NOTE' : 'DOUBT';

    if (selectedContact) {
      const optimisticMsg: ChatMessage = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: effectiveUserId,
        senderName: user.name || 'Student',
        ...(userPhoto ? { senderPhoto: userPhoto } : {}),
        text: content,
        timestamp: Date.now(),
        type: msgType as any,
        status: 'SENT',
        seen: false,
        delivered: false,
        readByRecipient: false,
      };
      setMessages((prev) => [
        ...prev.filter((m) => !isMessageDeletedForUser(effectiveUserId, m)),
        optimisticMsg,
      ]);

      await sendPrivateMessage(
        effectiveUserId,
        user.name || 'Student',
        userPhoto,
        selectedContact.id,
        content,
        msgType as any
      );
    } else if (selectedGroup) {
      const optimisticMsg: ChatMessage = {
        id: `local_grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: effectiveUserId,
        senderName: user.name || 'Student',
        ...(userPhoto ? { senderPhoto: userPhoto } : {}),
        text: content,
        timestamp: Date.now(),
        type: msgType as any,
        status: 'SENT',
        seen: false,
        delivered: false,
      };
      setMessages((prev) => [
        ...prev.filter((m) => !isMessageDeletedForUser(effectiveUserId, m)),
        optimisticMsg,
      ]);

      await sendGroupMessage(
        selectedGroup.id,
        effectiveUserId,
        user.name || 'Student',
        userPhoto,
        content,
        msgType as any
      );
    }
  };

  // Handle Reaction
  const handleReaction = async (msgId: string, emoji: string) => {
    if (selectedContact) {
      const convId = getDirectConversationId(user.id, selectedContact.id);
      await reactToChatMessage(false, convId, msgId, user.id, emoji);
    } else if (selectedGroup) {
      await reactToChatMessage(true, selectedGroup.id, msgId, user.id, emoji);
    }
  };

  // Helper to open new group modal with Tier check (Basic/Ultra allowed, Free blocked)
  const handleOpenNewGroupModal = () => {
    const tier = getUserBlockTier(user);
    if (tier === 'FREE') {
      setShowFreeGroupBlockModal(true);
      return;
    }
    setNewGroupName('');
    setNewGroupSubject('');
    setNewGroupDesc('');
    setNewGroupIsPrivate(false);
    setNewGroupPassword('');
    setShowNewGroupModal(true);
  };

  // Handle New Group Creation
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const tier = getUserBlockTier(user);
    if (tier === 'FREE') {
      setShowNewGroupModal(false);
      setShowFreeGroupBlockModal(true);
      return;
    }
    if (!newGroupName.trim()) return;

    const created = await createWhatsAppGroup(user.id, user.name || 'Student', {
      name: newGroupName,
      emoji: newGroupEmoji,
      subject: newGroupSubject || 'General Study',
      description: newGroupDesc || 'Study discussion group',
      isPrivate: newGroupIsPrivate,
      password: newGroupIsPrivate && newGroupPassword.trim() ? newGroupPassword.trim() : undefined,
    });

    setGroups((prev) => [created, ...prev]);
    setSelectedGroup(created);
    setSelectedContact(null);
    setShowNewGroupModal(false);
    setNewGroupName('');
    setNewGroupSubject('');
    setNewGroupDesc('');
    setNewGroupIsPrivate(false);
    setNewGroupPassword('');
    showToast(`🎉 Group "${created.name}" created (${created.isPrivate ? 'Private' : 'Public'})!`);
  };

  // Handle Opening Private Group Join Modal
  const handleOpenPrivateGroupJoinModal = (group: ChatGroup) => {
    setJoinPrivateGroupTarget(group);
    setJoinPrivatePasswordInput('');
    setJoinPrivateError('');
    setJoinPrivateLoading(false);
  };

  // Handle Joining Private Group with Password
  const handleSubmitPrivateGroupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinPrivateGroupTarget) return;
    if (!joinPrivatePasswordInput.trim()) {
      setJoinPrivateError('Kripya password dalein ya neeche Request to Join bhejein.');
      return;
    }

    setJoinPrivateLoading(true);
    setJoinPrivateError('');

    const res = await joinPrivateGroupByPassword(joinPrivateGroupTarget.id, joinPrivatePasswordInput, {
      id: user.id,
      name: user.name || 'Student',
      photoURL: user.photoURL || (user as any).avatarUrl,
    });

    setJoinPrivateLoading(false);

    if (res.success) {
      joinPrivateGroupTarget.members = joinPrivateGroupTarget.members || {};
      joinPrivateGroupTarget.members[user.id] = {
        id: user.id,
        name: user.name || 'Student',
        role: 'MEMBER',
        joinedAt: Date.now(),
      };
      joinPrivateGroupTarget.memberCount = Object.keys(joinPrivateGroupTarget.members).length;
      if (joinPrivateGroupTarget.joinRequests) {
        delete joinPrivateGroupTarget.joinRequests[user.id];
      }
      setGroups([...groups]);
      setSelectedGroup(joinPrivateGroupTarget);
      setSelectedContact(null);
      setJoinPrivateGroupTarget(null);
      showToast(`🎉 Sahi password! Aap "${joinPrivateGroupTarget.name}" group me jud gaye.`);
    } else {
      setJoinPrivateError(res.error || 'Galat password! Dobara koshish karein ya Request to Join bhejein.');
    }
  };

  // Handle Admin updating Group Privacy & Password
  const handleSaveGroupPrivacy = async () => {
    if (!selectedGroup) return;
    setIsSavingPrivacy(true);
    const updated = await updateGroupPrivacy(
      selectedGroup.id,
      privacyToggleIsPrivate,
      privacyToggleIsPrivate ? privacyTogglePassword.trim() : undefined,
      user.name || 'Admin'
    );
    selectedGroup.isPrivate = privacyToggleIsPrivate;
    selectedGroup.password = privacyToggleIsPrivate ? privacyTogglePassword.trim() : undefined;
    setGroups((prev) =>
      prev.map((g) =>
        g.id === selectedGroup.id
          ? { ...g, isPrivate: privacyToggleIsPrivate, password: selectedGroup.password }
          : g
      )
    );
    setIsSavingPrivacy(false);
    setShowPrivacyChangeModal(false);
    showToast(
      privacyToggleIsPrivate
        ? '🔒 Group Private ho gaya! Naye users password ya approval se judenge.'
        : '🌐 Group Public ho gaya! Ab sabhi students direct join kar sakte hain.'
    );
  };

  // Handle Join Public Group
  const handleJoinPublic = async (group: ChatGroup) => {
    await joinPublicGroup(group.id, {
      id: user.id,
      name: user.name || 'Student',
      photoURL: user.photoURL || (user as any).avatarUrl,
    });
    // Refresh group state
    group.members = group.members || {};
    group.members[user.id] = { id: user.id, name: user.name || 'Student', role: 'MEMBER', joinedAt: Date.now() };
    group.memberCount = Object.keys(group.members).length;
    setGroups([...groups]);
    setSelectedGroup(group);
    setSelectedContact(null);
    showToast(`Joined ${group.name}! 🎉`);
  };

  // Handle Request to Join Private Group
  const handleRequestPrivateJoin = async (group: ChatGroup) => {
    await requestToJoinPrivateGroup(group.id, {
      id: user.id,
      name: user.name || 'Student',
      photoURL: user.photoURL || (user as any).avatarUrl,
    });
    group.joinRequests = group.joinRequests || {};
    group.joinRequests[user.id] = {
      userId: user.id,
      userName: user.name || 'Student',
      requestedAt: Date.now(),
    };
    setGroups([...groups]);
    showToast(`Join request sent to group admin! ⏳`);
  };

  // Handle Admin Approve Join Request
  const handleApproveJoin = async (reqUser: { userId: string; userName: string; userPhoto?: string }) => {
    if (!selectedGroup) return;
    await approveJoinGroupRequest(
      selectedGroup.id,
      reqUser,
      { id: user.id, name: user.name || 'Admin' }
    );
    // Update local group view
    if (selectedGroup.joinRequests) {
      delete selectedGroup.joinRequests[reqUser.userId];
    }
    selectedGroup.members[reqUser.userId] = {
      id: reqUser.userId,
      name: reqUser.userName,
      role: 'MEMBER',
      joinedAt: Date.now(),
    };
    selectedGroup.memberCount = Object.keys(selectedGroup.members).length;
    setGroups([...groups]);
    showToast(`Approved ${reqUser.userName}! ✅`);
  };

  // Handle Admin Reject Join Request
  const handleRejectJoin = async (reqUserId: string) => {
    if (!selectedGroup) return;
    await rejectJoinGroupRequest(selectedGroup.id, reqUserId);
    if (selectedGroup.joinRequests) {
      delete selectedGroup.joinRequests[reqUserId];
    }
    setGroups([...groups]);
    showToast(`Request rejected.`);
  };

  // Friend adds friend directly to the group
  const handleAddFriendToCurrentGroup = async (friendContact: ChatContact) => {
    if (!selectedGroup) return;
    await addFriendToGroup(
      selectedGroup.id,
      { id: friendContact.id, name: friendContact.name, photoURL: friendContact.photoURL },
      { id: user.id, name: user.name || 'Student' }
    );
    selectedGroup.members = selectedGroup.members || {};
    selectedGroup.members[friendContact.id] = {
      id: friendContact.id,
      name: friendContact.name,
      role: 'MEMBER',
      joinedAt: Date.now(),
    };
    selectedGroup.memberCount = Object.keys(selectedGroup.members).length;
    setGroups([...groups]);
    setShowAddFriendModal(false);
    showToast(`🎉 ${friendContact.name} ko group me add kar diya gaya!`);
  };

  // Filtering
  const filteredFriends = friends.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.classLevel && c.classLevel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredStudents = students.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.classLevel && c.classLevel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const renderFindFriendsSection = () => {
    const candidateStudents = students.filter((st) => {
      if (isSameUser(st.id, user.id) || isSameUser(st.id, effectiveUserId)) return false;
      if (findFriendQuery.trim()) {
        const q = findFriendQuery.toLowerCase();
        const matchesName = st.name.toLowerCase().includes(q);
        const matchesClass = (st.classLevel || '').toLowerCase().includes(q);
        const matchesStatus = (st.statusText || '').toLowerCase().includes(q);
        const matchesTier = getStudentSubscriptionTier(st).toLowerCase().includes(q);
        if (!matchesName && !matchesClass && !matchesStatus && !matchesTier) return false;
      }
      if (findFriendTierFilter !== 'ALL') {
        const sTier = getStudentSubscriptionTier(st);
        if (sTier !== findFriendTierFilter) return false;
      }
      if (findFriendClassFilter !== 'ALL') {
        if (findFriendClassFilter === 'ONLINE') {
          if (!isUserCurrentlyOnline(st.id)) return false;
        } else if (findFriendClassFilter === 'OFFLINE') {
          if (isUserCurrentlyOnline(st.id)) return false;
        } else {
          const cl = (st.classLevel || '').toLowerCase();
          if (!cl.includes(findFriendClassFilter.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    });

    const onlineCount = students.filter((s) => !isSameUser(s.id, user.id) && !isSameUser(s.id, effectiveUserId) && isUserCurrentlyOnline(s.id)).length;
    const offlineCount = students.filter((s) => !isSameUser(s.id, user.id) && !isSameUser(s.id, effectiveUserId) && !isUserCurrentlyOnline(s.id)).length;
    const ultraCount = students.filter((s) => s.id !== user.id && getStudentSubscriptionTier(s) === 'ULTRA').length;
    const basicCount = students.filter((s) => s.id !== user.id && getStudentSubscriptionTier(s) === 'BASIC').length;
    const freeCount = students.filter((s) => s.id !== user.id && getStudentSubscriptionTier(s) === 'FREE').length;

    return (
      <div className="space-y-3 p-1">
        {/* Header Section */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('CHATS')}
                className="p-1 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Back to Chats"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <span className="text-base leading-none select-none">👨‍🦱</span>
              </div>
              <h3 className="font-bold text-xs md:text-sm">Classmates & Batchmates</h3>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full font-bold">
              {onlineCount} Online · {offlineCount} Offline
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              value={findFriendQuery}
              onChange={(e) => setFindFriendQuery(e.target.value)}
              placeholder="Search classmate (e.g. Rohit, Ultra, Basic, Class 10)..."
              className="w-full bg-slate-950 text-white placeholder-slate-400 rounded-xl px-8 py-2 text-xs border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            {findFriendQuery && (
              <button
                onClick={() => setFindFriendQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Tier Filters Bar (Ultra, Basic, Free users clearly separated) */}
          <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'ALL', label: 'Sabhi Users' },
              { id: 'ULTRA', label: `👑 Ultra (${ultraCount})` },
              { id: 'BASIC', label: `⚡ Basic (${basicCount})` },
              { id: 'FREE', label: `🌱 Free (${freeCount})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFindFriendTierFilter(t.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all border ${
                  findFriendTierFilter === t.id
                    ? t.id === 'ULTRA'
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                      : t.id === 'BASIC'
                      ? 'bg-blue-600 text-white border-blue-400 shadow-xs'
                      : 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Class Filters */}
          <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Classes' },
              { id: 'ONLINE', label: `🟢 Online (${onlineCount})` },
              { id: 'OFFLINE', label: `⚪ Offline (${offlineCount})` },
              { id: '9', label: 'Class 9' },
              { id: '10', label: 'Class 10' },
              { id: '11', label: 'Class 11' },
              { id: '12', label: 'Class 12' },
              { id: 'COMPETITION', label: 'Competition' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFindFriendClassFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                  findFriendClassFilter === f.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Student Cards List */}
        {candidateStudents.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-2 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
              🔍
            </div>
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
              Koi student nahi mila
            </h4>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
              {findFriendQuery
                ? `"${findFriendQuery}" se match karta koi classmate nahi mila.`
                : 'Filter change karke check karein.'}
            </p>
            {(findFriendQuery || findFriendTierFilter !== 'ALL' || findFriendClassFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setFindFriendQuery('');
                  setFindFriendTierFilter('ALL');
                  setFindFriendClassFilter('ALL');
                }}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline pt-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <span>Classmates Directory ({candidateStudents.length})</span>
              <span>1-Tap Connect</span>
            </div>

            {candidateStudents.map((student) => {
              const isFriend = isUserFriend(student);
              const isBlocked = isUserBlocked(student.id);
              const isSent = !isFriend && sentRequests.some((r) => isSameUser(r.toId, student.id));
              const incomingReq = !isFriend && friendRequests.find((r) => isSameUser(r.fromId, student.id));
              const isSending = sendingReqIds.has(student.id);
              const sTier = getStudentSubscriptionTier(student);

              return (
                <div
                  key={student.id}
                  className={`p-3 rounded-2xl border shadow-xs flex items-center justify-between gap-3 transition-all ${
                    sTier === 'ULTRA'
                      ? 'bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-white dark:to-slate-900 border-amber-300 dark:border-amber-700/80 hover:border-amber-400'
                      : sTier === 'BASIC'
                      ? 'bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-white dark:to-slate-900 border-blue-200 dark:border-blue-900/70 hover:border-blue-400'
                      : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700/70 hover:border-slate-400 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full p-[2px] ${
                          sTier === 'ULTRA'
                            ? 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600 shadow-sm'
                            : sTier === 'BASIC'
                            ? 'bg-gradient-to-tr from-blue-500 to-indigo-600 shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      >
                        <div className="w-full h-full rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs overflow-hidden">
                          {student.photoURL ? (
                            <img src={student.photoURL} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            student.name.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>
                      {isUserFriend(student.id) ? (
                        isUserCurrentlyOnline(student.id) ? (
                          <div
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"
                            title="Online"
                          />
                        ) : (
                          <div
                            className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-400 border-2 border-white dark:border-slate-900 rounded-full"
                            title="Offline"
                          />
                        )
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                        <p
                          className={`text-xs font-bold truncate whitespace-nowrap ${
                            sTier === 'ULTRA'
                              ? 'text-amber-950 dark:text-amber-300 font-black'
                              : sTier === 'BASIC'
                              ? 'text-blue-950 dark:text-blue-300 font-bold'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {student.name}
                        </p>

                        {/* Subscription Tier Badge */}
                        {sTier === 'ULTRA' && (
                          <span className="text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-600 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5 shrink-0">
                            <Crown size={10} /> ULTRA VIP
                          </span>
                        )}
                        {sTier === 'BASIC' && (
                          <span className="text-[9px] font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5 shrink-0">
                            <Zap size={10} /> BASIC
                          </span>
                        )}
                        {sTier === 'FREE' && (
                          <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full shrink-0">
                            FREE
                          </span>
                        )}

                        {student.classLevel && (
                          <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-1.5 py-0.2 rounded-md shrink-0 whitespace-nowrap">
                            {student.classLevel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {isUserFriend(student.id) ? (
                          isUserCurrentlyOnline(student.id) ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                              <span>Online</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                              <span>Offline • last seen {formatLastSeen(student.lastSeen)}</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <span>Private Profile</span>
                          </span>
                        )}
                        {student.statusText && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[150px] sm:max-w-xs">
                            • {student.statusText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="shrink-0">
                    {isBlocked ? (
                      <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-xl text-xs font-bold flex items-center gap-1">
                        <Ban size={12} /> Blocked
                      </span>
                    ) : isFriend ? (
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold flex items-center gap-1">
                          <Check size={12} /> Dost 🤝
                        </span>
                        <button
                          onClick={() => handleOpenContactChat(student)}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle size={13} />
                          <span>Chat 💬</span>
                        </button>
                      </div>
                    ) : isSent ? (
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs font-bold flex items-center gap-1">
                          <Clock size={12} /> Sent ⏳
                        </span>
                        <button
                          onClick={() => handleCancelSentRequest(student.id, student.name)}
                          className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900/40"
                          title="Cancel Request"
                        >
                          ✕
                        </button>
                      </div>
                    ) : incomingReq ? (
                      <button
                        onClick={() => handleAcceptRequest(incomingReq)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1 transition-all"
                      >
                        <Check size={13} /> Accept ✅
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendFriendRequest(student)}
                        disabled={isSending}
                        className="px-3 py-1.5 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        {isSending ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Bhej rahe...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={13} />
                            <span>Send Request 🚀</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const isCurrentChatActive = selectedContact || selectedGroup;
  const isGroupAdmin = selectedGroup ? (selectedGroup.creatorId === user.id || selectedGroup.members?.[user.id]?.role === 'ADMIN') : false;
  const isGroupMember = selectedGroup ? !!selectedGroup.members?.[user.id] : false;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full h-full md:max-w-2xl md:h-[92vh] md:rounded-3xl bg-slate-100 dark:bg-slate-950 flex flex-col shadow-2xl overflow-hidden border border-purple-500/20">

        {/* ─── TOAST BANNER ────────────────────────────────────────── */}
        {bannerNotice && (
          <div className="bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white text-xs font-bold px-4 py-2 text-center shadow-lg animate-in slide-in-from-top duration-300 z-50 flex items-center justify-between">
            <span className="flex-1 text-center">{bannerNotice}</span>
            <button onClick={() => setBannerNotice(null)} className="p-0.5 hover:bg-black/20 rounded">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ─── NSTA MESSENGER MAIN HEADER ──────────────────────────── */}
        {!isCurrentChatActive ? (
          <div className="bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 text-white px-4 pt-3 pb-0 shadow-lg border-b border-purple-500/20">
            {/* Top row */}
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2.5">
                {/* Nsta Messenger Gradient Icon */}
                <div className="w-10 h-10 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md">
                  <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                    <MessageCircle size={20} className="text-pink-400 fill-pink-500/20" />
                  </div>
                </div>
                <div>
                  <h2 className="font-black text-lg tracking-tight leading-none flex items-center gap-1.5">
                    <span className="bg-gradient-to-r from-rose-400 via-purple-300 to-indigo-300 bg-clip-text text-transparent font-black">
                      Nsta Messenger
                    </span>
                    <span className="text-[10px] bg-purple-500/30 text-purple-300 border border-purple-400/40 px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider">
                      ⚡ LIVE
                    </span>
                  </h2>
                  <p className="text-[11px] text-purple-200/80 font-medium mt-0.5">
                    Friends, Direct Chats & Study Groups
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSearchInput(!showSearchInput)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors"
                  title="Search"
                >
                  <Search size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('FIND_FRIENDS')}
                  className={`p-2 rounded-full transition-all flex items-center justify-center cursor-pointer ${
                    activeTab === 'FIND_FRIENDS'
                      ? 'bg-white/20 ring-2 ring-purple-300 text-white shadow-xs'
                      : 'hover:bg-white/10 text-white/90'
                  }`}
                  title="Find Classmates & Students"
                >
                  <span className="text-xl leading-none select-none">👨‍🦱</span>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowMainMenu(!showMainMenu)}
                    className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors"
                    title="Menu"
                  >
                    <MoreVertical size={18} />
                  </button>
                  {showMainMenu && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95">
                      <button
                        onClick={() => {
                          setShowMainMenu(false);
                          setActiveTab('FIND_FRIENDS');
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <UserPlus size={15} className="text-emerald-500" />
                        <span>Find Classmates</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMainMenu(false);
                          setShowNewGroupModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Plus size={15} className="text-purple-500" />
                        <span>New Study Group</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMainMenu(false);
                          setActiveTab('BLOCKED');
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Ban size={15} className="text-rose-500" />
                        <span>Blocked Contacts ({blockedUsers.length})</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowMainMenu(false);
                          setShowChangePinModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                      >
                        <Lock size={15} className="text-amber-500" />
                        <span>Chat PIN Lock</span>
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors ml-1"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Expandable Search Input */}
            {showSearchInput && (
              <div className="pb-3 pt-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search friends, students or study groups..."
                    className="w-full bg-slate-800/90 text-white placeholder-purple-200/50 rounded-xl px-9 py-2 text-xs md:text-sm border border-purple-500/30 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    autoFocus
                  />
                  <Search size={15} className="absolute left-3 top-2.5 text-purple-300/70" />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-purple-300/70 hover:text-white"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Tabs (WhatsApp 4 Clean Tabs) */}
            <div className="flex text-center border-t border-purple-900/50">
              <button
                onClick={() => setActiveTab('CHATS')}
                className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors relative flex items-center justify-center gap-1.5 ${
                  activeTab === 'CHATS'
                    ? 'text-white border-b-2 border-emerald-400 bg-purple-950/40'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                <MessageCircle size={14} />
                <span>CHATS</span>
                {friends.length > 0 && (
                  <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                    {friends.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('GROUPS')}
                className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors relative flex items-center justify-center gap-1.5 ${
                  activeTab === 'GROUPS'
                    ? 'text-white border-b-2 border-emerald-400 bg-purple-950/40'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                <Users size={14} />
                <span>GROUPS</span>
                <span className="bg-purple-800 text-purple-200 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                  {groups.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('REQUESTS')}
                className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors relative flex items-center justify-center gap-1.5 ${
                  activeTab === 'REQUESTS'
                    ? 'text-white border-b-2 border-emerald-400 bg-purple-950/40'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                <UserCheck size={14} />
                <span>REQUESTS</span>
                {friendRequests.length > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                    {friendRequests.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PROFILE')}
                className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors relative flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === 'PROFILE'
                    ? 'text-white border-b-2 border-emerald-400 bg-purple-950/40'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                <UserIcon size={14} />
                <span>PROFILE</span>
              </button>
            </div>
          </div>
        ) : isSelectMode ? (
          /* ─── MULTI-SELECT ACTION BAR HEADER (COPY, SAVE, DELETE, SELECT ALL) ─── */
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 text-white px-3 py-2.5 flex items-center justify-between shadow-lg border-b border-purple-500/40 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedMsgIds(new Set());
                  setReactionPickerMsgId(null);
                }}
                className="p-1.5 rounded-full hover:bg-white/15 text-white transition-colors cursor-pointer"
                title="Cancel Selection (X)"
              >
                <X size={20} />
              </button>
              <div>
                <h3 className="font-black text-sm text-white flex items-center gap-1.5">
                  <span>{selectedMsgIds.size} Selected</span>
                </h3>
                <p className="text-[10px] text-purple-200/80 leading-none">Tap message to select/deselect</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Select or Deselect All */}
              <button
                type="button"
                onClick={() => {
                  if (selectedMsgIds.size === displayMessages.length) {
                    setSelectedMsgIds(new Set());
                  } else {
                    setSelectedMsgIds(new Set(displayMessages.map((m) => m.id)));
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                title="Select or Deselect All"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">{selectedMsgIds.size === displayMessages.length ? 'Deselect All' : 'Select All'}</span>
              </button>

              {/* Copy Selected Messages */}
              <button
                type="button"
                onClick={handleCopySelectedMessages}
                disabled={selectedMsgIds.size === 0}
                className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                  selectedMsgIds.size > 0
                    ? 'bg-purple-600/80 hover:bg-purple-600 text-white shadow-sm cursor-pointer active:scale-95'
                    : 'opacity-40 cursor-not-allowed text-slate-400 bg-white/5'
                }`}
                title="Copy Selected Messages (Clipboard me copy karein)"
              >
                <Copy size={15} />
                <span className="hidden xs:inline">Copy</span>
              </button>

              {/* Save / Unsave Selected Messages (Snapchat-style Save in Chat) */}
              {(() => {
                const selectedList = messages.filter((m) => selectedMsgIds.has(m.id));
                const allSaved = selectedList.length > 0 && selectedList.every((m) => isMessageSaved(m, effectiveUserId));
                return (
                  <button
                    type="button"
                    onClick={() => handleToggleSaveSelectedMessages()}
                    disabled={selectedMsgIds.size === 0}
                    className={`px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                      selectedMsgIds.size > 0
                        ? allSaved
                          ? 'bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border border-amber-400/40 shadow-sm cursor-pointer active:scale-95'
                          : 'bg-emerald-600/80 hover:bg-emerald-600 text-white shadow-sm cursor-pointer active:scale-95'
                        : 'opacity-40 cursor-not-allowed text-slate-400 bg-white/5'
                    }`}
                    title={
                      allSaved
                        ? 'Unsave message (Snapchat mode me seen ke baad delete hoga)'
                        : 'Save message (Snapchat Vanish Mode me kabhi delete na hoga unsave hone tak)'
                    }
                  >
                    {allSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                    <span className="hidden xs:inline">{allSaved ? 'Unsave' : 'Save'}</span>
                  </button>
                );
              })()}

              {/* Delete Selected Messages */}
              <button
                type="button"
                onClick={() => {
                  if (selectedMsgIds.size > 0) setShowBatchDeleteDialog(true);
                }}
                disabled={selectedMsgIds.size === 0}
                className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                  selectedMsgIds.size > 0
                    ? 'bg-rose-600/80 hover:bg-rose-600 text-white shadow-sm cursor-pointer active:scale-95'
                    : 'opacity-40 cursor-not-allowed text-slate-400 bg-white/5'
                }`}
                title="Delete Selected Messages"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* ─── ACTIVE CHAT CONVERSATION HEADER ──────────────────────── */
          <div className="bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 text-white px-3 py-2 flex items-center justify-between shadow-md border-b border-purple-500/20">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={handleExitChat}
                className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
                title="Back to Chats (Locks chat if enabled)"
              >
                <ArrowLeft size={20} />
              </button>

              {/* Avatar with Instagram-style story ring */}
              <div
                onClick={() => {
                  if (selectedGroup) setShowGroupInfo(true);
                }}
                className="relative cursor-pointer flex-shrink-0"
              >
                {selectedContact ? (
                  <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-md">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
                      {selectedContact.photoURL ? (
                        <img
                          src={selectedContact.photoURL}
                          alt={selectedContact.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        selectedContact.name.charAt(0).toUpperCase()
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-800 to-indigo-900 flex items-center justify-center text-lg shadow-inner border border-purple-400/40">
                    {selectedGroup?.emoji || '👥'}
                  </div>
                )}
                {(selectedContact && isUserFriend(selectedContact.id) && isUserCurrentlyOnline(selectedContact.id)) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950" />
                )}
              </div>

              {/* Contact/Group Name & Subtitle */}
              <div
                onClick={() => {
                  if (selectedGroup) setShowGroupInfo(true);
                }}
                className="cursor-pointer flex-1 min-w-0"
              >
                <h3 className="font-bold text-sm text-white truncate leading-tight flex items-center gap-1.5">
                  <span>{selectedContact?.name || selectedGroup?.name}</span>
                  {activeChatContextId && (
                    isChatStarred(activeChatContextId, effectiveUserId || user.id) ? (
                      <span title="Special Category (Special Password se open hogi)" className="text-[10px] bg-amber-400/25 border border-amber-400/70 px-1.5 py-0.2 rounded text-amber-300 font-bold flex items-center gap-0.5">
                        <Star size={9} className="fill-amber-400 text-amber-400" /> Special
                      </span>
                    ) : (
                      <span title="Default Category (Default Password se open hogi)" className="text-[10px] bg-white/10 border border-white/20 px-1.5 py-0.2 rounded text-purple-200 font-normal">
                        Default
                      </span>
                    )
                  )}
                  {isCurrentChatLocked && (
                    <span title="Chat is Locked with PIN" className="text-[11px] bg-rose-950/80 border border-rose-500/50 px-1 py-0.2 rounded text-rose-300 flex items-center gap-0.5">
                      <Lock size={10} /> Lock
                    </span>
                  )}
                  {currentDisappearingTimer !== 0 && (
                    <span title={`Disappearing messages: ${formatDisappearingDuration(currentDisappearingTimer)}`} className="text-[11px] bg-amber-950/80 border border-amber-500/50 px-1 py-0.2 rounded text-amber-300 flex items-center gap-0.5">
                      <Clock size={10} /> {currentDisappearingTimer === -1 ? 'Vanish' : formatDisappearingDuration(currentDisappearingTimer).split(' ')[0]}
                    </span>
                  )}
                  {selectedContact?.role === 'SUB_ADMIN' && (
                    <Shield size={12} className="text-purple-300 fill-purple-400" />
                  )}
                  {selectedGroup?.isPrivate ? (
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded font-bold flex items-center gap-0.5">
                      <Lock size={9} /> Private
                    </span>
                  ) : selectedGroup ? (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1 py-0.2 rounded font-bold flex items-center gap-0.5">
                      <Globe size={9} /> Public
                    </span>
                  ) : null}
                </h3>
                <p className="text-[11px] text-purple-200/80 truncate">
                  {selectedContact ? (
                    isUserCurrentlyOnline(selectedContact.id) ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                        <span>Online</span>
                      </span>
                    ) : (
                      <span className="text-purple-200/90 font-medium">
                        last seen {formatLastSeen(selectedContact.lastSeen)}
                      </span>
                    )
                  ) : (
                    `${selectedGroup?.memberCount || 1} members · tap for info`
                  )}
                </p>
              </div>
            </div>

            {/* Quick action buttons on chat header */}
            <div className="flex items-center gap-1">
              {/* Star / Special Category Button */}
              {activeChatContextId && (
                <button
                  type="button"
                  onClick={() => {
                    const next = toggleChatStarred(activeChatContextId, effectiveUserId || user.id);
                    showToast(
                      next
                        ? '⭐ Special Category mein add ho gaya! (Special Password lagega)'
                        : '⭐ Special Category se hata diya (Default Password lagega)'
                    );
                    setStarredStateTick((v) => v + 1);
                  }}
                  className={`p-2 rounded-full transition-colors cursor-pointer ${
                    isChatStarred(activeChatContextId, effectiveUserId || user.id)
                      ? 'text-amber-400 bg-amber-400/20 hover:bg-amber-400/30'
                      : 'text-white/80 hover:text-amber-300 hover:bg-white/10'
                  }`}
                  title={
                    isChatStarred(activeChatContextId, effectiveUserId || user.id)
                      ? '⭐ Star Marked (Special Category) - Click karein Default category banane ke liye'
                      : 'Star Mark karein (Special Category me add karne ke liye)'
                  }
                >
                  <Star
                    size={17}
                    className={
                      isChatStarred(activeChatContextId, effectiveUserId || user.id)
                        ? 'fill-amber-400 text-amber-400'
                        : ''
                    }
                  />
                </button>
              )}

              {/* Disappearing Messages Quick Button */}
              <button
                onClick={() => setShowDisappearingModal(true)}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors relative ${
                  currentDisappearingTimer !== 0 ? 'bg-amber-500/25 text-amber-300' : 'text-white'
                }`}
                title={`Disappearing Messages: ${formatDisappearingDuration(currentDisappearingTimer)}`}
              >
                <Clock size={17} />
                {currentDisappearingTimer !== 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                )}
              </button>

              {/* If group is selected, quick friend add button */}
              {selectedGroup && (
                <button
                  onClick={() => setShowAddFriendModal(true)}
                  className="px-2 py-1 bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-colors border border-purple-400/40"
                  title="Add Friend to Group"
                >
                  <UserPlus size={13} />
                  <span className="hidden sm:inline">Add Friend</span>
                </button>
              )}
              {selectedGroup && (
                <div className="relative">
                  <button
                    onClick={() => setShowContactMenu(!showContactMenu)}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Group Options"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showContactMenu && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95">
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setShowGroupInfo(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Users size={14} className="text-purple-500" />
                        <span>Group Information</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setShowDisappearingModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-amber-500" />
                          <span>Disappearing Messages</span>
                        </div>
                        <span className="text-[10px] text-amber-500 font-bold">
                          {formatDisappearingDuration(currentDisappearingTimer)}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setSpecialPinInput('');
                          setSpecialPinError(null);
                          setOldDefaultPinInput('');
                          setNewDefaultPinInput('');
                          setDefaultPinError(null);
                          setShowPinSettingsModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <KeyRound size={14} className="text-purple-500" />
                          <span>Chat Password Settings</span>
                        </div>
                        {hasSpecialChatPin(selectedGroup.id, effectiveUserId || user.id) ? (
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded">Special 🔒</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Default 🔒</span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setShowAddFriendModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                      >
                        <UserPlus size={14} className="text-indigo-500" />
                        <span>Add Friend to Group</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setConfirmDialog({
                            type: 'CLEAR_CHAT',
                            title: 'Group Chat Clear Karein',
                            description: `Kya aap is group ki messages clear karna chahte hain?`,
                            targetId: selectedGroup.id,
                            targetName: selectedGroup.name,
                          });
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Trash2 size={14} className="text-slate-500" />
                        <span>Clear Messages</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setConfirmDialog({
                            type: 'LEAVE_GROUP',
                            title: 'Group se Bahar Niklein',
                            description: `Kya aap sach me '${selectedGroup.name}' group chhodna chahte hain?`,
                            targetId: selectedGroup.id,
                            targetName: selectedGroup.name,
                            groupId: selectedGroup.id,
                          });
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                      >
                        <LogOut size={14} />
                        <span>Leave Group (Group Chhodein)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedContact && (
                <div className="relative">
                  <button
                    onClick={() => setShowContactMenu(!showContactMenu)}
                    className="p-2 rounded-full hover:bg-white/10 text-white transition-colors"
                    title="Chat Options"
                  >
                    <MoreVertical size={18} />
                  </button>

                  {showContactMenu && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-in fade-in zoom-in-95">
                      {/* Disappearing Messages */}
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setShowDisappearingModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Clock size={14} className="text-amber-500" />
                          <span>Disappearing Messages</span>
                        </div>
                        <span className="text-[10px] text-amber-500 font-bold">
                          {formatDisappearingDuration(currentDisappearingTimer)}
                        </span>
                      </button>

                      {/* Set / Change PIN */}
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setSpecialPinInput('');
                          setSpecialPinError(null);
                          setOldDefaultPinInput('');
                          setNewDefaultPinInput('');
                          setDefaultPinError(null);
                          setShowPinSettingsModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <KeyRound size={14} className="text-purple-500" />
                          <span>Chat Password Settings</span>
                        </div>
                        {hasSpecialChatPin(getDirectConversationId(effectiveUserId || user.id, selectedContact.id), effectiveUserId || user.id) ? (
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded">Special 🔒</span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Default 🔒</span>
                        )}
                      </button>

                      {/* Clear Chat */}
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setConfirmDialog({
                            type: 'CLEAR_CHAT',
                            title: 'Chat Clear Karein',
                            description: `Kya aap ${selectedContact.name} ke sath apni chat messages saaf (clear) karna chahte hain?`,
                            targetId: selectedContact.id,
                            targetName: selectedContact.name,
                          });
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                      >
                        <Trash2 size={14} className="text-slate-500" />
                        <span>Clear Chat Messages</span>
                      </button>

                      {/* Unfriend */}
                      {isFriendWith(selectedContact.id) && selectedContact.id !== 'peer_iic_ai_tutor' && (
                        <button
                          onClick={() => {
                            setShowContactMenu(false);
                            setConfirmDialog({
                              type: 'UNFRIEND',
                              title: 'Friend Unfriend Karein',
                              description: `Kya aap sach me ${selectedContact.name} ko unfriend karna chahte hain? Unfriend karne par direct messaging band ho jayegi.`,
                              targetId: selectedContact.id,
                              targetName: selectedContact.name,
                            });
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                        >
                          <UserX size={14} />
                          <span>Unfriend Dost</span>
                        </button>
                      )}

                      {/* Block / Unblock */}
                      {selectedContact.id !== 'peer_iic_ai_tutor' && (
                        isUserBlocked(selectedContact.id) ? (
                          <button
                            onClick={() => {
                              setShowContactMenu(false);
                              setConfirmDialog({
                                type: 'UNBLOCK',
                                title: 'User Unblock Karein',
                                description: `Kya aap ${selectedContact.name} ko unblock karna chahte hain?`,
                                targetId: selectedContact.id,
                                targetName: selectedContact.name,
                              });
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                          >
                            <Check size={14} />
                            <span>Unblock Karein</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setShowContactMenu(false);
                              handleInitiateBlock({ id: selectedContact.id, name: selectedContact.name });
                            }}
                            className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                          >
                            <Ban size={14} />
                            <span>Block User</span>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors ml-1"
                title="Close"
              >
                <X size={19} />
              </button>
            </div>
          </div>
        )}

        {/* ─── BODY CONTAINER ─────────────────────────────────────────── */}
        {!isCurrentChatActive ? (
          <div className="flex-1 overflow-y-auto relative bg-white dark:bg-slate-900">
            {/* Real-time Friend Request Accepted Banner for Sender */}
            {newAcceptedFriend && (
              <div className="mx-3 mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 text-white shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300 z-30">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shrink-0">
                    🤝
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black truncate">
                      🎉 {newAcceptedFriend.name} ne aapki friend request accept kar li!
                    </p>
                    <p className="text-[11px] text-emerald-100 truncate">
                      Aap dono ab dost ban chuke hain. Direct chat unlock ho chuki hai.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      handleOpenContactChat(newAcceptedFriend);
                      setNewAcceptedFriend(null);
                    }}
                    className="px-3.5 py-1.5 bg-white text-emerald-800 rounded-xl text-xs font-black shadow-md hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle size={14} />
                    <span>Chat Shuru Karein 💬</span>
                  </button>
                  <button
                    onClick={() => setNewAcceptedFriend(null)}
                    className="p-1 hover:bg-black/20 rounded-lg text-emerald-100 cursor-pointer"
                    title="Dismiss"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: CONFIRMED CHATS (FRIENDS ONLY) */}
            {activeTab === 'CHATS' && (
              <div className="relative min-h-full pb-20">
                {/* Blocked Users Notice Bar */}
                {blockedUsers.length > 0 && (
                  <div className="mx-4 mt-2.5 p-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Ban size={13} className="text-rose-500 flex-shrink-0" />
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {blockedUsers.length} Blocked {blockedUsers.length === 1 ? 'Contact' : 'Contacts'}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('BLOCKED')}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Manage
                    </button>
                  </div>
                )}
                {/* Category Filter Chips: All, Special (⭐ Star), Default */}
                {filteredFriends.length > 0 && (
                  <div className="mx-4 mt-2 mb-1 flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setChatCategoryFilter('ALL')}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        chatCategoryFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Sabhi Chats</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        {filteredFriends.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChatCategoryFilter('SPECIAL')}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        chatCategoryFilter === 'SPECIAL'
                          ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                      }`}
                    >
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span>Special</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 font-bold">
                        {
                          filteredFriends.filter((c) =>
                            isChatStarred(
                              getDirectConversationId(effectiveUserId || user.id, c.id),
                              effectiveUserId || user.id
                            )
                          ).length
                        }
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChatCategoryFilter('DEFAULT')}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        chatCategoryFilter === 'DEFAULT'
                          ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>Default</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        {
                          filteredFriends.filter(
                            (c) =>
                              !isChatStarred(
                                getDirectConversationId(effectiveUserId || user.id, c.id),
                                effectiveUserId || user.id
                              )
                          ).length
                        }
                      </span>
                    </button>
                  </div>
                )}

                {/* Friends Chat List */}
                {filteredFriends.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 flex items-center justify-center text-3xl mx-auto shadow-inner">
                      🤝
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      Abhi koi direct friend add nahi hai!
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Nsta Messenger par kisi bhi classmate se baat karne ke liye unhe Friend Request bhejein. Jaise hi wo accept karenge, baat start ho jayegi!
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      <button
                        onClick={() => setActiveTab('FIND_FRIENDS')}
                        className="px-4 py-2 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 transition-transform flex items-center gap-1.5"
                      >
                        <UserPlus size={14} />
                        <span>Friend Request Bhejein 🚀</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('REQUESTS')}
                        className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                      >
                        Requests Check Karein
                      </button>
                    </div>
                  </div>
                ) : (() => {
                  const filteredByCategory = filteredFriends.filter((c) => {
                    const convId = getDirectConversationId(effectiveUserId || user.id, c.id);
                    const starred = isChatStarred(convId, effectiveUserId || user.id);
                    if (chatCategoryFilter === 'SPECIAL') return starred;
                    if (chatCategoryFilter === 'DEFAULT') return !starred;
                    return true;
                  });

                  if (filteredByCategory.length === 0) {
                    return (
                      <div className="text-center py-10 px-4 space-y-2">
                        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-500 flex items-center justify-center mx-auto">
                          <Star size={24} className="fill-amber-400 text-amber-400" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          {chatCategoryFilter === 'SPECIAL'
                            ? 'Koi Special Chat nahi mili'
                            : 'Koi Default Chat nahi mili'}
                        </h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          {chatCategoryFilter === 'SPECIAL'
                            ? 'Kisi bhi contact ke bagal me bane ⭐ Star icon par tap karein taaki wo Special Category me shift ho jaye (jiska alag Special Password hota hai).'
                            : 'Sabhi chats ko aapne Star Mark karke Special Category me shift kiya hua hai.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredByCategory.map((contact) => {
                        const convId = getDirectConversationId(effectiveUserId || user.id, contact.id);
                        const isLocked = isChatLocked(convId);
                        const disTimer = getDisappearingTimer(convId);
                        const isStarred = isChatStarred(convId, effectiveUserId || user.id);

                        return (
                          <div
                            key={contact.id}
                            className="px-4 py-3 hover:bg-purple-50/50 dark:hover:bg-slate-800/60 flex items-center gap-3 transition-colors"
                          >
                            {/* Avatar & Info Clickable to open chat */}
                            <div
                              onClick={() => handleOpenContactChat(contact)}
                              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                            >
                              <div className="relative flex-shrink-0">
                                <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 shadow-sm">
                                  <div className="w-full h-full rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-base overflow-hidden">
                                    {contact.photoURL ? (
                                      <img
                                        src={contact.photoURL}
                                        alt={contact.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      contact.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                </div>
                                {isUserCurrentlyOnline(contact.id) && (
                                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                    <span>{contact.name}</span>
                                    {isStarred ? (
                                      <span
                                        title="Special Category (Special Password)"
                                        className="text-[9px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-0.5"
                                      >
                                        <Star size={8} className="fill-amber-400 text-amber-500" /> Special
                                      </span>
                                    ) : (
                                      <span
                                        title="Default Category (Default Password)"
                                        className="text-[9px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded"
                                      >
                                        Default
                                      </span>
                                    )}
                                    {isLocked && (
                                      <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1 py-0.2 rounded border border-rose-200 dark:border-rose-900 flex items-center gap-0.5">
                                        <Lock size={9} /> Lock
                                      </span>
                                    )}
                                    {disTimer !== 0 && (
                                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-200 dark:border-amber-900 flex items-center gap-0.5">
                                        <Clock size={9} /> {disTimer === -1 ? 'Vanish' : formatDisappearingDuration(disTimer).split(' ')[0]}
                                      </span>
                                    )}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    {isUserCurrentlyOnline(contact.id) ? (
                                      <span className="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        Online
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400">
                                        last seen {formatLastSeen(contact.lastSeen)}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                                  <CheckCheck size={14} className="text-purple-500 flex-shrink-0" />
                                  <span>{contact.statusText || 'Tap to chat privately...'}</span>
                                </p>
                              </div>
                            </div>

                            {/* ⭐ Star Button (Toggle Special Category) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = toggleChatStarred(convId, effectiveUserId || user.id);
                                showToast(
                                  next
                                    ? '⭐ Star Marked! Special Category me shift ho gaya (Special Password lagega)'
                                    : '⭐ Star un-marked. Ab Default Category me hai (Default Password lagega)'
                                );
                                setStarredStateTick((v) => v + 1);
                              }}
                              className={`p-2 rounded-xl transition-all cursor-pointer ${
                                isStarred
                                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-500 border border-amber-300 dark:border-amber-700'
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              title={
                                isStarred
                                  ? '⭐ Star Marked (Special Category) - Click karein Default category me shift karne ke liye'
                                  : 'Star Mark karein (Special Category me add karne ke liye)'
                              }
                            >
                              <Star size={16} className={isStarred ? 'fill-amber-400 text-amber-400' : ''} />
                            </button>

                            {/* Direct Chat Action Button */}
                            <button
                              onClick={() => handleOpenContactChat(contact)}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
                            >
                              <MessageCircle size={13} />
                              <span>Chat</span>
                            </button>

                            {/* More Options Menu: Unfriend / Block */}
                            {contact.id !== 'peer_iic_ai_tutor' && (
                              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => setOpenFriendMenuId(openFriendMenuId === contact.id ? null : contact.id)}
                                  className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                  title="Options"
                                >
                                  <MoreVertical size={16} />
                                </button>

                                {openFriendMenuId === contact.id && (
                                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 py-1 z-30 animate-in fade-in zoom-in-95">
                                    <button
                                      onClick={() => {
                                    setOpenFriendMenuId(null);
                                    setConfirmDialog({
                                      type: 'UNFRIEND',
                                      title: 'Friend Unfriend Karein',
                                      description: `Kya aap sach me ${contact.name} ko unfriend karna chahte hain? Unfriend karne ke baad direct messaging band ho jayegi.`,
                                      targetId: contact.id,
                                      targetName: contact.name,
                                    });
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2"
                                >
                                  <UserX size={14} />
                                  <span>Unfriend Dost</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenFriendMenuId(null);
                                    handleInitiateBlock({ id: contact.id, name: contact.name });
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                                >
                                  <Ban size={14} />
                                  <span>Block User</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                  );
                })()}

                {/* Search Results: Classmates to send friend requests to */}
                {searchQuery.trim() && (
                  <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-900/50">
                    <div className="px-4 pb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus size={13} />
                        <span>Classmates & Students (Friend Request Bhejein)</span>
                      </span>
                    </div>
                    {filteredStudents.filter((st) => !isSameUser(st.id, effectiveUserId || user.id)).length === 0 ? (
                      <p className="text-center py-3 text-xs text-slate-400">
                        "{searchQuery}" se koi aur student nahi mila.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredStudents
                          .filter((st) => !isSameUser(st.id, effectiveUserId || user.id))
                          .map((st) => {
                            const isFriend = isUserFriend(st);
                            const isBlocked = isUserBlocked(st.id);
                            const isSent = !isFriend && sentRequests.some((r) => isSameUser(r.toId, st.id));
                            const incomingReq = !isFriend && friendRequests.find((r) => isSameUser(r.fromId, st.id));
                            const isSending = sendingReqIds.has(st.id);

                            return (
                              <div
                                key={st.id}
                                className="px-4 py-2.5 hover:bg-purple-50/40 dark:hover:bg-slate-800/40 flex items-center justify-between gap-2 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="relative shrink-0">
                                    <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs overflow-hidden">
                                      {st.photoURL ? (
                                        <img src={st.photoURL} alt={st.name} className="w-full h-full object-cover" />
                                      ) : (
                                        st.name.charAt(0).toUpperCase()
                                      )}
                                    </div>
                                    {st.isOnline && (
                                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate whitespace-nowrap">
                                      {st.name}
                                    </p>
                                    {st.classLevel && (
                                      <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40 px-1.5 py-0.2 rounded-md shrink-0 whitespace-nowrap">
                                        {st.classLevel}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0">
                                  {isBlocked ? (
                                    <span className="text-[11px] text-rose-500 font-bold">Blocked</span>
                                  ) : isFriend ? (
                                    <button
                                      onClick={() => handleOpenContactChat(st)}
                                      className="px-2.5 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                                    >
                                      <MessageCircle size={12} />
                                      <span>Chat 💬</span>
                                    </button>
                                  ) : isSent ? (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">Sent ⏳</span>
                                  ) : incomingReq ? (
                                    <button
                                      onClick={() => handleAcceptRequest(incomingReq)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                                    >
                                      Accept ✅
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSendFriendRequest(st)}
                                      disabled={isSending}
                                      className="px-2.5 py-1 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                    >
                                      {isSending ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <UserPlus size={12} />
                                      )}
                                      <span>Request</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: FIND FRIENDS & SEND FRIEND REQUEST DIRECTORY */}
            {activeTab === 'FIND_FRIENDS' && (
              <div className="p-4 space-y-4">
                {renderFindFriendsSection()}
              </div>
            )}

            {/* TAB 2: FRIEND REQUESTS HUB (RECEIVED & SENT) */}
            {activeTab === 'REQUESTS' && (
              <div className="p-4 space-y-4">
                {/* Segmented Pill Selector (Received vs Sent) */}
                <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setRequestsSubTab('RECEIVED')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      requestsSubTab === 'RECEIVED'
                        ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <UserCheck size={14} />
                    <span>Received</span>
                    {friendRequests.length > 0 && (
                      <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                        {friendRequests.length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setRequestsSubTab('SENT')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      requestsSubTab === 'SENT'
                        ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Clock size={14} />
                    <span>Sent</span>
                    {sentRequests.length > 0 && (
                      <span className="bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                        {sentRequests.length}
                      </span>
                    )}
                  </button>
                </div>

                {/* SUBTAB 1: RECEIVED REQUESTS */}
                {requestsSubTab === 'RECEIVED' && (
                  <div>
                    {friendRequests.length === 0 ? (
                      <div className="text-center py-10 px-4 space-y-2">
                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
                          📭
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Koi Pending Incoming Request nahi hai
                        </h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Jab koi student aapko friend request bhejega, to wo yahan dikhegi!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {friendRequests.map((req) => {
                          const senderStudent = students.find((s) => s.id === req.fromId);
                          const senderTier = senderStudent ? getStudentSubscriptionTier(senderStudent) : 'FREE';

                          return (
                          <div
                            key={req.id}
                            className={`p-3.5 rounded-2xl border shadow-sm flex items-center justify-between gap-3 ${
                              senderTier === 'ULTRA'
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                                : senderTier === 'BASIC'
                                ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-11 h-11 rounded-full p-[2px] flex-shrink-0 ${
                                  senderTier === 'ULTRA'
                                    ? 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600'
                                    : senderTier === 'BASIC'
                                    ? 'bg-gradient-to-tr from-blue-500 to-indigo-600'
                                    : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              >
                                <div className="w-full h-full rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm overflow-hidden">
                                  {req.fromPhoto ? (
                                    <img src={req.fromPhoto} alt={req.fromName} className="w-full h-full object-cover" />
                                  ) : (
                                    req.fromName.charAt(0)
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                    {req.fromName}
                                  </h4>
                                  {senderTier === 'ULTRA' && (
                                    <span className="text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-600 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                                      <Crown size={9} /> ULTRA VIP
                                    </span>
                                  )}
                                  {senderTier === 'BASIC' && (
                                    <span className="text-[9px] font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                                      <Zap size={9} /> BASIC
                                    </span>
                                  )}
                                  {senderTier === 'FREE' && (
                                    <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full">
                                      FREE
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Aapse dosti aur direct chat start karna chahte hain
                                </p>
                                <span className="text-[9px] text-purple-500 font-semibold">
                                  {formatTime(req.timestamp)}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleAcceptRequest(req)}
                                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-sm active:scale-95"
                              >
                                Accept ✅
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: SENT REQUESTS */}
                {requestsSubTab === 'SENT' && (
                  <div>
                    {sentRequests.length === 0 ? (
                      <div className="text-center py-10 px-4 space-y-2">
                        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto text-2xl">
                          📤
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Koi Sent Request pending nahi hai
                        </h4>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto">
                          Aapki bheji gayi requests jinki confirmation baki hai wo yahan dikhengi.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sentRequests.map((req) => {
                          const recipientStudent = students.find((s) => isSameUser(s.id, req.toId));
                          const recipientTier = recipientStudent ? getStudentSubscriptionTier(recipientStudent) : 'FREE';
                          const isAcceptedFriend = isUserFriend(req.toId) || (req as any).status === 'ACCEPTED';

                          return (
                          <div
                            key={req.id}
                            className={`p-3.5 rounded-2xl border shadow-sm flex items-center justify-between gap-3 ${
                              isAcceptedFriend
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60'
                                : recipientTier === 'ULTRA'
                                ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/60'
                                : recipientTier === 'BASIC'
                                ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-11 h-11 rounded-full p-[2px] flex-shrink-0 ${
                                  recipientTier === 'ULTRA'
                                    ? 'bg-gradient-to-tr from-amber-400 via-yellow-500 to-amber-600'
                                    : recipientTier === 'BASIC'
                                    ? 'bg-gradient-to-tr from-blue-500 to-indigo-600'
                                    : 'bg-slate-200 dark:bg-slate-700'
                                }`}
                              >
                                <div className="w-full h-full rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm overflow-hidden">
                                  {req.toPhoto ? (
                                    <img src={req.toPhoto} alt={req.toName || 'User'} className="w-full h-full object-cover" />
                                  ) : (
                                    (req.toName || 'U').charAt(0).toUpperCase()
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                    {req.toName || 'Student'}
                                  </h4>
                                  {recipientTier === 'ULTRA' && (
                                    <span className="text-[9px] font-black bg-gradient-to-r from-amber-500 to-yellow-600 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                                      <Crown size={9} /> ULTRA VIP
                                    </span>
                                  )}
                                  {recipientTier === 'BASIC' && (
                                    <span className="text-[9px] font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-0.5">
                                      <Zap size={9} /> BASIC
                                    </span>
                                  )}
                                  {recipientTier === 'FREE' && (
                                    <span className="text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full">
                                      FREE
                                    </span>
                                  )}
                                </div>
                                {isAcceptedFriend ? (
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                                    <span>✅ Request Accepted! Dost ban chuke hain</span>
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                    ⏳ Request pending approval
                                  </p>
                                )}
                                <span className="text-[9px] text-slate-400">
                                  {formatTime(req.timestamp)}
                                </span>
                              </div>
                            </div>

                            {isAcceptedFriend ? (
                              <button
                                onClick={() => handleOpenContactChat({
                                  id: req.toId,
                                  name: req.toName || recipientStudent?.name || 'Student',
                                  photoURL: req.toPhoto || recipientStudent?.photoURL,
                                  isOnline: true,
                                  statusText: 'Friend 🤝 · Available to chat',
                                  uid: (req as any).toUid || recipientStudent?.uid || '',
                                  email: (req as any).toEmail || recipientStudent?.email || '',
                                })}
                                className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                              >
                                <MessageCircle size={13} />
                                <span>Chat Shuru Karein 💬</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCancelSentRequest(req.toId, req.toName || 'User')}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all border border-rose-200 dark:border-rose-900/50 cursor-pointer"
                              >
                                Cancel ✕
                              </button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: STUDY GROUPS (PUBLIC & PRIVATE) */}
            {activeTab === 'GROUPS' && (
              <div className="relative min-h-full pb-20">
                {/* Groups List */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredGroups.map((group) => {
                    const isMember = !!group.members?.[user.id];
                    const isCreator = group.creatorId === user.id;
                    const hasPendingJoinReq = !!group.joinRequests?.[user.id];
                    const isLocked = isChatLocked(group.id);
                    const disTimer = getDisappearingTimer(group.id);

                    return (
                      <div
                        key={group.id}
                        className="px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 transition-colors"
                      >
                        {/* Group Info Clickable */}
                        <div
                          onClick={() => {
                            if (isMember) {
                              handleOpenGroupChat(group);
                            } else {
                              setShowGroupInfo(true);
                              setSelectedGroup(group);
                            }
                          }}
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-200 dark:from-purple-950 dark:to-indigo-950 flex items-center justify-center text-2xl shadow-sm border border-purple-300/40 dark:border-purple-800/50 flex-shrink-0">
                            {group.emoji}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                <span>{group.name}</span>
                                {isCreator && (
                                  <span className="text-[9px] bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.2 rounded border border-purple-300/60 dark:border-purple-800 flex items-center gap-0.5">
                                    👑 Admin
                                  </span>
                                )}
                                {isLocked && (
                                  <span className="text-[9px] bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold px-1.5 py-0.2 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-0.5">
                                    <Lock size={9} /> Lock
                                  </span>
                                )}
                                {disTimer !== 0 && (
                                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                    <Clock size={9} /> {disTimer === -1 ? 'Vanish' : formatDisappearingDuration(disTimer).split(' ')[0]}
                                  </span>
                                )}
                                {group.isPrivate ? (
                                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-0.5">
                                    <Lock size={9} /> Private
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5">
                                    <Globe size={9} /> Public
                                  </span>
                                )}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {group.lastMessageTime ? formatTime(group.lastMessageTime) : 'Today'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {group.lastMessage || `${group.subject} discussion`}
                              </p>
                              <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-2">
                                {group.memberCount} members
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Join / Chat Action Button */}
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          {isMember ? (
                            <>
                              <button
                                onClick={() => handleOpenGroupChat(group)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                              >
                                Open Chat
                              </button>
                              {isCreator ? (
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      type: 'DELETE_GROUP',
                                      title: 'Group Delete Karein',
                                      description: `Kya aap sach me '${group.name}' group ko permanently delete karna chahte hain? Sabhi members aur chats delete ho jayenge.`,
                                      targetId: group.id,
                                      targetName: group.name,
                                      groupId: group.id,
                                    });
                                  }}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 hover:dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition-all"
                                  title="Delete Group (Permanently Delete Karein)"
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setConfirmDialog({
                                      type: 'LEAVE_GROUP',
                                      title: 'Group se Bahar Niklein',
                                      description: `Kya aap sach me '${group.name}' group chhodna chahte hain?`,
                                      targetId: group.id,
                                      targetName: group.name,
                                      groupId: group.id,
                                    });
                                  }}
                                  className="p-1.5 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 hover:dark:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all"
                                  title="Leave Group (Group Chhodein)"
                                >
                                  <LogOut size={14} />
                                </button>
                              )}
                            </>
                          ) : group.isPrivate ? (
                            hasPendingJoinReq ? (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-xl text-[10px] font-bold flex items-center gap-1">
                                <Clock size={11} />
                                <span>Requested ⏳</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRequestPrivateJoin(group)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                              >
                                <Lock size={12} />
                                <span>Request to Join</span>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => handleJoinPublic(group)}
                              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Plus size={13} />
                              <span>Join Group</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            )}

            {/* TAB 5: BLOCK LIST & CAPACITY MANAGEMENT */}
            {activeTab === 'BLOCKED' && (
              <div className="p-4 space-y-4 pb-24 overflow-y-auto">
                {/* Clean WhatsApp-Style Header for Blocked Contacts */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('CHATS')}
                      className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                      title="Back to Chats"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">Blocked Contacts</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Blocked contacts cannot call or send you direct messages
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowQuickBlockPicker(!showQuickBlockPicker)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                    title="Search and Block Student"
                  >
                    <UserX size={13} />
                    <span>+ Block Contact</span>
                  </button>
                </div>

                {/* Search Filter */}
                <div className="relative">
                  <input
                    type="text"
                    value={blockedSearchQuery}
                    onChange={(e) => setBlockedSearchQuery(e.target.value)}
                    placeholder="Blocked contacts me khojein..."
                    className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl px-8 py-2 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  {blockedSearchQuery && (
                    <button
                      onClick={() => setBlockedSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Quick Student Picker Dropdown / Box */}
                {showQuickBlockPicker && (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-rose-300 dark:border-rose-900/60 shadow-lg space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wide flex items-center gap-1">
                        <Ban size={13} />
                        <span>Block karne ke liye student chunein:</span>
                      </span>
                      <button
                        onClick={() => {
                          setShowQuickBlockPicker(false);
                          setQuickBlockSearch('');
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={quickBlockSearch}
                      onChange={(e) => setQuickBlockSearch(e.target.value)}
                      placeholder="Student ka naam search karein..."
                      className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500"
                      autoFocus
                    />

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {students
                        .filter(
                          (st) =>
                            st.id !== user.id &&
                            !isUserBlocked(st.id) &&
                            st.name.toLowerCase().includes(quickBlockSearch.toLowerCase())
                        )
                        .slice(0, 10)
                        .map((student) => (
                          <div
                            key={student.id}
                            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {student.photoURL ? (
                                  <img src={student.photoURL} alt={student.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  student.name.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate whitespace-nowrap">
                                  {student.name}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded-md shrink-0 whitespace-nowrap">
                                  {student.classLevel || 'Student'}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setShowQuickBlockPicker(false);
                                setQuickBlockSearch('');
                                handleInitiateBlock({ id: student.id, name: student.name });
                              }}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0"
                            >
                              Block
                            </button>
                          </div>
                        ))}
                      {students.filter(
                        (st) =>
                          st.id !== user.id &&
                          !isUserBlocked(st.id) &&
                          st.name.toLowerCase().includes(quickBlockSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="text-center py-4 text-xs text-slate-400">
                          Koi student nahi mila ya sabhi already blocked hain.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Blocked Users List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Blocked Contacts ({blockedUsers.length})
                    </h4>
                  </div>

                  {blockedUsers.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 flex items-center justify-center mx-auto text-2xl shadow-inner">
                        <ShieldCheck size={32} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Koi User Block Nahi Hai
                        </p>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                          Aapke paas abhi {totalBlockLimit} block slots uplabdh hain. Kisi bhi user ko block karne par wo na aapse chat kar sakenge aur na call.
                        </p>
                      </div>
                    </div>
                  ) : blockedUsers.filter((b) => b.name.toLowerCase().includes(blockedSearchQuery.toLowerCase())).length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      "{blockedSearchQuery}" naam se koi blocked contact nahi mila.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {blockedUsers
                        .filter((b) => b.name.toLowerCase().includes(blockedSearchQuery.toLowerCase()))
                        .map((bUser) => (
                          <div
                            key={bUser.id}
                            className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/70 shadow-xs flex items-center justify-between gap-3 transition-all hover:border-rose-400 dark:hover:border-rose-700"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-slate-600">
                                  {bUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[8px] border border-white dark:border-slate-900">
                                  🚫
                                </div>
                              </div>

                              {/* 1 Single Row for Name & Block Status */}
                              <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
                                <span className="text-xs font-bold text-slate-900 dark:text-white truncate whitespace-nowrap">
                                  {bUser.name}
                                </span>
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                                  Blocked {bUser.blockedAt ? `• ${new Date(bUser.blockedAt).toLocaleDateString()}` : ''}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setConfirmDialog({
                                  type: 'UNBLOCK',
                                  title: 'User Unblock Karein',
                                  description: `Kya aap ${bUser.name} ko unblock karna chahte hain? Unblock karne ke baad aap dono dobara friend ban kar baatcheet kar sakenge.`,
                                  targetId: bUser.id,
                                  targetName: bUser.name,
                                });
                              }}
                              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1"
                            >
                              <Check size={12} />
                              <span>Unblock</span>
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Subtle Quota & Expand Status */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
                  <span>
                    Quota: <strong className="text-slate-800 dark:text-slate-200">{blockedUsers.length}</strong> / {totalBlockLimit} slots
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-amber-500 font-semibold">🪙 {userCoins} Coins</span>
                    {userCoins >= nextExpansionCost && (
                      <button
                        onClick={handleExpandBlockLimit}
                        disabled={isExpandingLimit}
                        className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                      >
                        <Plus size={12} />
                        <span>+10 Slots ({nextExpansionCost} 🪙)</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: USER PROFILE, QUOTAS & BLOCKED USERS */}
            {activeTab === 'PROFILE' && (
              <div className="p-4 space-y-4 pb-24 overflow-y-auto">
                {/* 1. Profile Identity Card */}
                <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white rounded-3xl p-4.5 border border-purple-500/30 shadow-xl relative overflow-hidden">
                  <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-purple-600/15 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3.5 relative z-10">
                    <div className="relative shrink-0">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.name || 'User'}
                          className="w-15 h-15 rounded-2xl object-cover border-2 border-purple-400/80 shadow-md"
                        />
                      ) : (
                        <div className="w-15 h-15 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[2px] shadow-md">
                          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl font-black text-white">
                            {(user?.name || 'S').charAt(0).toUpperCase()}
                          </div>
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full shadow-xs" title="Active" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-white truncate">
                          {user?.name || 'Student'}
                        </h3>
                        {currentTier === 'ULTRA' ? (
                          <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 px-2 py-0.5 rounded-full font-black flex items-center gap-1 shadow-xs">
                            <Crown size={11} className="fill-slate-950" />
                            <span>ULTRA</span>
                          </span>
                        ) : currentTier === 'BASIC' ? (
                          <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                            <Zap size={11} className="fill-white" />
                            <span>BASIC</span>
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 px-2 py-0.5 rounded-full font-bold">
                            FREE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-purple-200/80 mt-0.5 truncate flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
                        <span>{user?.role || 'IIC Verified Student'}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-purple-500/20 text-[11px] text-purple-200">
                        <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                          <Coins size={12} className="text-amber-400" />
                          <strong className="text-white">{userCoins}</strong> Coins
                        </span>
                        <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md">
                          <Gem size={12} className="text-cyan-400" />
                          <strong className="text-white">{userDiamonds}</strong> Diamonds
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="mt-3.5 pt-3 border-t border-purple-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-purple-200/80">
                    <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-2 rounded-xl">
                      <Hash size={13} className="text-purple-400 shrink-0" />
                      <span className="truncate">ID: <strong className="text-white">{user?.displayId || user?.id || '—'}</strong></span>
                    </div>
                    {user?.email && (
                      <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-2 rounded-xl">
                        <Mail size={13} className="text-purple-400 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                    )}
                    {(user?.mobile || (user as any)?.phone) && (
                      <div className="flex items-center gap-2 bg-slate-950/40 px-3 py-2 rounded-xl">
                        <Phone size={13} className="text-purple-400 shrink-0" />
                        <span className="truncate">{user.mobile || (user as any)?.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Message Limit Quota Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-300 flex items-center justify-center shadow-xs">
                        <MessageCircle size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Message Limit</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded font-semibold">
                            {currentTier}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Har din messages bhejne ki daily quota
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-purple-700 dark:text-purple-300">
                        {dailyMessagesSent}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        {' '}/ {totalDailyMsgLimit === Infinity ? '∞' : totalDailyMsgLimit}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {totalDailyMsgLimit !== Infinity && (
                    <div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            dailyMessagesSent >= totalDailyMsgLimit
                              ? 'bg-rose-500'
                              : dailyMessagesSent / totalDailyMsgLimit > 0.8
                              ? 'bg-amber-500'
                              : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.round((dailyMessagesSent / totalDailyMsgLimit) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-medium">
                        <span>{dailyMessagesSent} messages sent today</span>
                        <span>{Math.max(0, totalDailyMsgLimit - dailyMessagesSent)} bache hain</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowMessageLimitModal(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Plus size={14} />
                    <span>+10 Daily Messages Badhayein</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">100 🪙 / 20 💎</span>
                  </button>
                </div>

                {/* 3. Friend Limit Quota Card */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shadow-xs">
                        <Users size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Friend Limit</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded font-semibold">
                            {currentTier} (Max {totalFriendLimit})
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Direct chat ke liye confirmed friends capacity
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        {friends.length}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">
                        {' '}/ {totalFriendLimit}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          friends.length >= totalFriendLimit
                            ? 'bg-rose-500'
                            : friends.length / totalFriendLimit > 0.8
                            ? 'bg-amber-500'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((friends.length / totalFriendLimit) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-medium">
                      <span>{friends.length} friends connected</span>
                      <span>{Math.max(0, totalFriendLimit - friends.length)} slots bache hain</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFriendLimitModal(true)}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Plus size={14} />
                    <span>+10 Friends Limit Badhayein</span>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-semibold">100 🪙 / 20 💎</span>
                  </button>
                </div>

                {/* 4. Block Users Button & Expandable List */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowBlockedInProfile(!showBlockedInProfile)}
                    className="w-full p-4 flex items-center justify-between hover:bg-rose-50/40 dark:hover:bg-rose-950/20 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
                        <Ban size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>Blocked Users</span>
                          <span className="text-[11px] font-black px-2 py-0.5 bg-rose-500 text-white rounded-full">
                            {blockedUsers.length}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {showBlockedInProfile ? 'Tap karke list chhupayein' : 'Tap karein aur blocked users dekhein'}
                        </p>
                      </div>
                    </div>
                    <div className="text-slate-400 p-1">
                      {showBlockedInProfile ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>

                  {/* Collapsible Blocked Users List */}
                  {showBlockedInProfile && (
                    <div className="p-4 pt-0 border-t border-rose-100 dark:border-rose-900/40 space-y-3 animate-in fade-in">
                      {blockedUsers.length === 0 ? (
                        <div className="text-center py-6 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-slate-500 dark:text-slate-400 text-xs">
                          <ShieldCheck size={28} className="mx-auto mb-1.5 text-emerald-500" />
                          <p className="font-bold text-slate-700 dark:text-slate-200">Aapki Block List Khali Hai</p>
                          <p className="text-[11px] mt-0.5">Aapne abhi kisi bhi student ko block nahi kiya hai.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {blockedUsers.map((bUser) => (
                            <div
                              key={bUser.id}
                              className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="relative shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-slate-600">
                                    {(bUser.name || 'U').charAt(0).toUpperCase()}
                                  </div>
                                  <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[8px] border border-white dark:border-slate-900">
                                    🚫
                                  </div>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {bUser.name}
                                  </p>
                                  <span className="text-[10px] text-rose-500 font-semibold flex items-center gap-1">
                                    <Ban size={10} /> Blocked
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDialog({
                                    type: 'UNBLOCK',
                                    title: 'User Unblock Karein',
                                    description: `Kya aap ${bUser.name} ko unblock karna chahte hain? Unblock karne ke baad aap dono dobara baatcheet kar sakenge.`,
                                    targetId: bUser.id,
                                    targetName: bUser.name,
                                  });
                                }}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Check size={12} />
                                <span>Unblock</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setActiveTab('BLOCKED')}
                          className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>Full Block Manager Kholein</span>
                          <ChevronRight size={13} />
                        </button>
                        <span className="text-[11px] text-slate-400">
                          Capacity: {blockedUsers.length} / {totalBlockLimit}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Dual Category Chat Security & Password Settings */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4.5 border border-purple-200 dark:border-purple-900/60 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-sm">
                        <Lock size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>2-Tier Chat Lock & Passwords</span>
                          <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold px-2 py-0.5 rounded-full">Nsta Security</span>
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Special (Star Marked) aur Default chats ke alag alag passwords
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Summary grid of both passwords */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Default category card */}
                    <div className="p-3 bg-purple-50/60 dark:bg-purple-950/40 rounded-2xl border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyRound size={16} className="text-purple-600 dark:text-purple-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Default Password</p>
                          <p className="text-[10px] text-slate-500">Normal non-starred chats ke liye</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-700">
                        {hasChatPin() ? '•••• Set' : '1234'}
                      </span>
                    </div>

                    {/* Special category card */}
                    <div className="p-3 bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star size={16} className="text-amber-500 fill-amber-500" />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Special Password</p>
                          <p className="text-[10px] text-slate-500">⭐ Star marked chats ke liye</p>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-amber-200 dark:border-amber-700">
                        •••• Set
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                    💡 <strong>Kaise Kaam Karta Hai:</strong> Aap chats me kisi ko bhi <strong className="text-amber-600 dark:text-amber-400">⭐ Star Mark</strong> kar sakte hain. Star marked chats ke liye <strong>Special Password</strong> lagega. Baaki saari chats ke liye <strong>Default Password</strong> lagega. Dono passwords aap yahan badal sakte hain.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDualPasswordModal(true)}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      <KeyRound size={15} />
                      <span>Passwords Badalna / Change Karein</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPinSettingsModal(true)}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer text-center"
                    >
                      PIN Advanced
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp-Style Floating Action Button */}
            {activeTab === 'CHATS' && (
              <div className="absolute bottom-5 right-5 z-20">
                <button
                  onClick={() => setActiveTab('FIND_FRIENDS')}
                  className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xl transition-all active:scale-95 hover:scale-105"
                  title="Find Classmates to Chat"
                >
                  <MessageCircle size={22} />
                </button>
              </div>
            )}
            {activeTab === 'GROUPS' && (
              <div className="absolute bottom-5 right-5 z-20">
                <button
                  onClick={() => setShowNewGroupModal(true)}
                  className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xl transition-all active:scale-95 hover:scale-105"
                  title="Create New Study Group"
                >
                  <Users size={22} />
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── ACTIVE CHAT MESSAGE THREAD & INPUT ─────────────────────── */
          <div className="flex-1 flex flex-col min-h-0 bg-[#faf5ff] dark:bg-[#090d16] relative">
            {/* Subtle background doodle pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(#a855f7 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }}
            />

            {/* Message Feed Area */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2.5 z-10">
              {/* Date Header Pill */}
              <div className="flex justify-center my-1">
                <span className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-600 dark:text-slate-300 text-[11px] font-semibold px-3 py-1 rounded-lg shadow-sm">
                  TODAY
                </span>
              </div>

              {/* Encryption Notice */}
              <div className="flex justify-center my-1">
                <p className="bg-purple-100/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 text-[10px] px-3 py-1.5 rounded-lg shadow-xs text-center max-w-sm leading-tight border border-purple-200/50">
                  🔒 Nsta Messenger chats are secure. Direct messages sirf confirmed friends ke beech share hote hain.
                </p>
              </div>

              {/* Message List */}
              {displayMessages.map((msg) => {
                const isMe = isMsgSentByMe(msg);
                const isSelected = selectedMsgIds.has(msg.id);
                const isSwipingThis = activeSwipeMsgId === msg.id;
                const currentSwipe = isSwipingThis ? activeSwipeOffset : 0;

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`flex items-center gap-2 w-full transition-all duration-200 ${
                      isMe ? 'justify-end' : 'justify-start'
                    } ${
                      highlightedMsgId === msg.id ? 'scale-[1.02] -translate-y-0.5' : ''
                    }`}
                  >
                    {/* If in Select Mode and message is received (on left), show checkbox */}
                    {isSelectMode && !isMe && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMsgIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(msg.id)) next.delete(msg.id);
                            else next.add(msg.id);
                            return next;
                          });
                        }}
                        className="p-1 shrink-0 cursor-pointer text-purple-600 transition-transform active:scale-90"
                        title={isSelected ? 'Deselect message' : 'Select message'}
                      >
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shadow-xs">
                            <Check size={13} className="stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-500 hover:border-purple-500 transition-colors" />
                        )}
                      </button>
                    )}

                    {/* Interactive Message Bubble Container */}
                    <div
                      className="relative max-w-[85%] md:max-w-[70%] select-none touch-pan-y"
                      onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                      onTouchMove={(e) => handleMessageTouchMove(e, msg)}
                      onTouchEnd={(e) => handleMessageTouchEnd(e, msg)}
                      onMouseDown={(e) => handleMessageMouseDown(e, msg)}
                      onMouseUp={handleMessageMouseUp}
                      onMouseLeave={handleMessageMouseUp}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (navigator.vibrate) {
                          try { navigator.vibrate(40); } catch {}
                        }
                        setIsSelectMode(true);
                        setSelectedMsgIds((prev) => new Set(prev).add(msg.id));
                        if (!msg.isDeletedForEveryone) {
                          setReactionPickerMsgId(msg.id);
                        }
                      }}
                      onClick={() => {
                        if (isSelectMode) {
                          setSelectedMsgIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(msg.id)) next.delete(msg.id);
                            else next.add(msg.id);
                            return next;
                          });
                        }
                      }}
                      onDoubleClick={() => {
                        if (!isSelectMode && !msg.isDeletedForEveryone) {
                          setReactionPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
                        }
                      }}
                    >
                      {/* Swipe-to-reply visual indicator */}
                      {isSwipingThis && Math.abs(currentSwipe) > 10 && (
                        <div
                          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full bg-purple-600 text-white shadow-md transition-all duration-75 pointer-events-none z-10 ${
                            currentSwipe > 0 ? '-left-10' : '-right-10'
                          }`}
                          style={{
                            opacity: Math.min(1, Math.abs(currentSwipe) / 35),
                            transform: `translateY(-50%) scale(${Math.min(1.15, Math.abs(currentSwipe) / 32)})`,
                          }}
                        >
                          <Reply size={14} className={currentSwipe < 0 ? 'scale-x-[-1]' : ''} />
                        </div>
                      )}

                      {/* Floating Emoji Reaction Popover on Long Press / Double Tap */}
                      {reactionPickerMsgId === msg.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute -top-11 z-40 flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800 rounded-full shadow-2xl border border-purple-200/80 dark:border-purple-800/80 animate-in zoom-in-90 duration-150 max-w-[92vw] overflow-x-auto no-scrollbar ${
                            isMe ? 'right-0' : 'left-0'
                          }`}
                        >
                          {['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '🎉'].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReaction(msg.id, emoji);
                                setReactionPickerMsgId(null);
                              }}
                              className="text-lg hover:scale-130 active:scale-95 transition-transform px-1 py-0.5 cursor-pointer leading-none"
                            >
                              {emoji}
                            </button>
                          ))}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReactionPickerMsgId(null);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-0.5 cursor-pointer"
                            title="Close"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      )}

                      {/* Message Bubble Body */}
                      <div
                        style={{
                          transform: isSwipingThis ? `translateX(${currentSwipe}px)` : 'translateX(0)',
                          transition: isSwipingThis ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)',
                        }}
                        className={`rounded-2xl px-3 py-2 shadow-xs relative text-slate-900 dark:text-white transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-purple-100 dark:ring-offset-purple-950 scale-[0.99] opacity-95'
                            : highlightedMsgId === msg.id
                            ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-purple-50 dark:ring-offset-slate-950 shadow-md'
                            : ''
                        } ${
                          isMessageSaved(msg, effectiveUserId)
                            ? isMe
                              ? 'border-2 border-amber-300/80 shadow-md shadow-amber-500/10'
                              : 'border-2 border-amber-400/90 shadow-md shadow-amber-500/10 bg-amber-50/20 dark:bg-amber-950/20'
                            : ''
                        } ${
                          isMe
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-xs'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-tl-xs'
                        }`}
                      >
                      {/* Sender Name for Group Chats */}
                      {selectedGroup && !isMe && msg.type !== 'SYSTEM' && (
                        <p
                          className="text-[11px] font-bold mb-0.5 leading-none text-purple-600 dark:text-purple-400"
                        >
                          {msg.senderName}
                        </p>
                      )}

                      {/* Quoted Reply Banner */}
                      {msg.replyTo && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScrollToMessage(msg.replyTo!.id);
                          }}
                          className={`mb-2 p-2 rounded-xl border-l-4 text-xs cursor-pointer transition-opacity hover:opacity-90 select-none ${
                            isMe
                              ? 'bg-black/25 border-white text-white'
                              : 'bg-purple-50 dark:bg-purple-950/70 border-purple-500 text-slate-800 dark:text-slate-200'
                          }`}
                          title="Original message par jaane ke liye click karein"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-[11px] mb-0.5 opacity-90">
                            <Reply size={11} className="shrink-0" />
                            <span className="truncate">{msg.replyTo.senderName || 'Message'}</span>
                          </div>
                          <p className="line-clamp-2 text-[11px] opacity-85 leading-snug">
                            {msg.replyTo.text || 'Message'}
                          </p>
                        </div>
                      )}

                      {/* System Message */}
                      {msg.type === 'SYSTEM' ? (
                        <div className="py-1 text-center">
                          <p className="text-[11px] italic opacity-90">{msg.text}</p>
                          {msg.text?.includes('friend request bheji hai') &&
                            selectedContact &&
                            !isUserFriend(selectedContact.id) &&
                            !messages.some((m) => (m.text || '').includes('Friend request accept ho gayi')) &&
                            !messages.some((m) => !isSameUser(m.senderId, effectiveUserId) && m.type !== 'SYSTEM') && (
                              <div className="mt-2 inline-flex flex-col items-center p-2.5 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-xl max-w-xs shadow-xs">
                                <span className="text-[11px] font-semibold text-purple-900 dark:text-purple-200">
                                  {isMe
                                    ? 'Aapne friend request bheji hai (Pending ⏳)'
                                    : `🤝 ${selectedContact.name} ne request bheji hai`}
                                </span>
                                {!isMe && (
                                  <div className="flex items-center gap-2 mt-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptFromChat((msg as any).friendRequestData)}
                                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center gap-1"
                                    >
                                      <Check size={12} />
                                      <span>Accept ✅</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        rejectFriendRequest(effectiveUserId || user.id, selectedContact.id, allMyUserIds);
                                        showToast('Request decline kar di gayi.');
                                      }}
                                      className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium active:scale-95 transition-all"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                        </div>
                      ) : msg.type === 'VOICE' ? (
                        <div className="flex items-center gap-3 py-1 min-w-[180px]">
                          <button
                            onClick={() => {
                              setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id);
                            }}
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0 ${
                              isMe ? 'bg-white/20' : 'bg-purple-600'
                            }`}
                          >
                            {playingVoiceId === msg.id ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                          </button>
                          <div className="flex-1">
                            <div className="flex items-center gap-0.5 h-6">
                              {[4, 8, 14, 20, 12, 18, 10, 16, 8, 14, 18, 10, 6].map((h, i) => (
                                <span
                                  key={i}
                                  className={`w-1 rounded-full transition-all ${
                                    playingVoiceId === msg.id
                                      ? 'bg-pink-400 animate-pulse'
                                      : isMe
                                      ? 'bg-white/70'
                                      : 'bg-purple-400'
                                  }`}
                                  style={{ height: `${h}px` }}
                                />
                              ))}
                            </div>
                            <div className={`flex justify-between items-center text-[10px] ${isMe ? 'text-white/80' : 'text-slate-500'}`}>
                              <span>0:{msg.voiceDuration || '15'}</span>
                              <Mic size={11} />
                            </div>
                          </div>
                        </div>
                      ) : msg.isDeletedForEveryone ? (
                        <p className="text-xs italic opacity-75 flex items-center gap-1.5 py-0.5">
                          <Ban size={12} className="opacity-70" />
                          <span>This message was deleted</span>
                        </p>
                      ) : (msg.type === 'IMAGE' || !!msg.mediaUrl || (msg.mediaUrls && msg.mediaUrls.length > 0)) ? (
                        <div className="space-y-2">
                          {msg.mediaUrls && msg.mediaUrls.length > 1 ? (
                            <div className="space-y-1.5">
                              {/* Multi-Photo Grid (WhatsApp Style Album supporting up to 10 photos) */}
                              <div
                                className={`relative grid gap-1 rounded-2xl overflow-hidden bg-black/10 ${
                                  msg.mediaUrls.length === 2
                                    ? 'grid-cols-2 max-w-[280px]'
                                    : msg.mediaUrls.length === 3
                                    ? 'grid-cols-2 max-w-[280px]'
                                    : 'grid-cols-2 max-w-[280px]'
                                }`}
                              >
                                {msg.isHd && (
                                  <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs text-white rounded text-[9px] font-black border border-white/20 flex items-center gap-0.5 pointer-events-none shadow-xs">
                                    <span className="text-amber-300 text-[8px]">✨</span> HD
                                  </div>
                                )}
                                {msg.mediaUrls.slice(0, 4).map((url, idx) => {
                                  const isFourth = idx === 3 && msg.mediaUrls!.length > 4;
                                  const extraCount = msg.mediaUrls!.length - 4;
                                  const isSpan2 = msg.mediaUrls!.length === 3 && idx === 0;

                                  return (
                                    <div
                                      key={idx}
                                      className={`relative overflow-hidden cursor-pointer group select-none ${
                                        isSpan2 ? 'col-span-2 h-36' : 'h-28'
                                      } bg-slate-900/40`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openImageLightbox(url, msg.mediaUrls, idx);
                                      }}
                                    >
                                      <img
                                        src={url}
                                        alt={`Photo ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform"
                                        loading="lazy"
                                      />
                                      {isFourth && (
                                        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center text-white font-black text-lg">
                                          <span>+{extraCount}</span>
                                          <span className="text-[10px] font-medium opacity-85">aur photos</span>
                                        </div>
                                      )}
                                      {!isFourth && (
                                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">
                                          🔍
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Prominent "Ek Saath Saare Download Karein" Bulk Download Button */}
                              <div className="pt-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadAllImages(msg.mediaUrls || []);
                                  }}
                                  className={`w-full px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98 ${
                                    isMe
                                      ? 'bg-white/25 hover:bg-white/35 text-white'
                                      : 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300'
                                  }`}
                                  title="Sabhi photos ek saath ZIP file me download karein"
                                >
                                  <Download size={13} />
                                  <span>📥 Ek Saath Saare Download Karein ({msg.mediaUrls.length})</span>
                                </button>
                              </div>
                            </div>
                          ) : (msg.mediaUrl || msg.mediaUrls?.[0]) ? (
                            /* Single Photo Layout */
                            <div className="space-y-1">
                              <div
                                className="relative overflow-hidden rounded-xl max-h-72 cursor-pointer bg-black/10 group select-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImageLightbox(msg.mediaUrl || msg.mediaUrls?.[0] || '');
                                }}
                              >
                                {msg.isHd && (
                                  <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-black/75 backdrop-blur-xs text-white rounded text-[9px] font-black border border-white/20 flex items-center gap-0.5 pointer-events-none shadow-xs">
                                    <span className="text-amber-300 text-[8px]">✨</span> HD
                                  </div>
                                )}
                                <img
                                  src={msg.mediaUrl || msg.mediaUrls?.[0]}
                                  alt="Photo attachment"
                                  className="w-full max-h-72 object-cover object-center group-hover:scale-[1.01] transition-transform rounded-xl"
                                  loading="lazy"
                                />
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 backdrop-blur-xs text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold">
                                  <Maximize2 size={12} />
                                  <span>View Full</span>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadImage(msg.mediaUrl || msg.mediaUrls?.[0] || '');
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity cursor-pointer ${
                                    isMe ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                  title="Download Photo"
                                >
                                  <Download size={11} />
                                  <span>Download</span>
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {msg.text && (
                            <p className="text-xs whitespace-pre-wrap leading-relaxed px-0.5">{msg.text}</p>
                          )}
                        </div>
                      ) : msg.type === 'DOUBT' ? (
                        <div className="space-y-1">
                          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                            isMe ? 'bg-white/20 text-white' : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60'
                          }`}>
                            <HelpCircle size={11} />
                            <span>STUDY QUESTION / DOUBT</span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                      ) : msg.type === 'NOTE' ? (
                        <div className="space-y-1">
                          <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded ${
                            isMe ? 'bg-white/20 text-white' : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60'
                          }`}>
                            <Bookmark size={11} />
                            <span>STUDY NOTE</span>
                          </div>
                          <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                        </div>
                      ) : (
                        <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}

                      {/* Footer: Timestamp, Disappearing status, Saved status, and Read Receipts (Sent / Delivered / Seen) */}
                      <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
                        {isMessageSaved(msg, effectiveUserId) && (
                          <span
                            title="📌 Saved in Chat (Snapchat style: Vanish Mode me tab tak delete nahi hoga jab tak unsave na karein)"
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-bold mr-0.5 ${
                              isMe
                                ? 'bg-amber-400/30 text-amber-200 border border-amber-300/40'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/50'
                            }`}
                          >
                            <Bookmark size={9} className="fill-amber-400 stroke-amber-400" />
                            <span>Saved</span>
                          </span>
                        )}
                        {msg.disappearingExpiresAt && (
                          <span title="Disappearing message timer active" className="flex items-center gap-0.5 text-[9px] opacity-80">
                            <Clock size={10} />
                          </span>
                        )}
                        <span>{formatTime(msg.timestamp)}</span>
                        {isMe && !msg.isDeletedForEveryone && (() => {
                          // Accurate Read Receipts:
                          // SENDER's own viewing NEVER counts towards "Seen"!
                          // ONLY when the recipient or another group member explicitly opened the chat:
                          const isGroupChat = !!selectedGroup;
                          let isSeen = false;

                          if (isGroupChat) {
                            // In a group, seen if at least one OTHER member read it
                            isSeen = !!(
                              msg.readBy &&
                              Object.keys(msg.readBy).some((uid) => !isSameUser(uid, effectiveUserId))
                            );
                          } else {
                            // In 1-on-1 direct chat, seen ONLY when the recipient peer actually opened and read it:
                            const hasPeerRead =
                              (msg.readBy && Object.keys(msg.readBy).some((uid) => !isSameUser(uid, effectiveUserId))) ||
                              msg.readByRecipient === true ||
                              (msg.status === 'READ' && msg.seen === true && msg.readByRecipient !== false && !!msg.readAt);

                            isSeen = !!hasPeerRead;
                          }

                          // Delivered: Received by server/RTDB (or delivered flag true), but recipient has not seen yet
                          const isDelivered = !isSeen && (msg.delivered || msg.status === 'DELIVERED' || !!msg.deliveredAt || !msg.id.startsWith('local_'));

                          return (
                            <span
                              title={
                                isSeen
                                  ? 'Seen / Recipient ne message dekh liya'
                                  : isDelivered
                                  ? 'Delivered / Pahunch gaya'
                                  : 'Sent / Message chala gaya'
                              }
                              className="flex items-center gap-0.5 ml-0.5"
                            >
                              {isSeen ? (
                                <span className="flex items-center text-cyan-300" title="Seen (User ne message dekh liya)">
                                  <CheckCheck size={14} className="stroke-[2.5]" />
                                </span>
                              ) : isDelivered ? (
                                <span className="flex items-center text-white/90" title="Delivered (Pahunch gaya)">
                                  <CheckCheck size={14} className="stroke-[2]" />
                                </span>
                              ) : (
                                <span className="flex items-center text-white/70" title="Sent (Bheja gaya)">
                                  <Check size={14} className="stroke-[2]" />
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Reactions Display */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="absolute -bottom-2 right-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-[11px] flex items-center gap-0.5 pointer-events-none">
                          {Object.values(msg.reactions).map((emoji, idx) => (
                            <span key={idx}>{emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* If in Select Mode and message is sent by me (on right), show checkbox */}
                  {isSelectMode && isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMsgIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(msg.id)) next.delete(msg.id);
                          else next.add(msg.id);
                          return next;
                        });
                      }}
                      className="p-1 shrink-0 cursor-pointer text-purple-600 transition-transform active:scale-90"
                      title={isSelected ? 'Deselect message' : 'Select message'}
                    >
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs shadow-xs">
                          <Check size={13} className="stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-400 dark:border-slate-500 hover:border-purple-500 transition-colors" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Doubt / Notes / Photo Attachment Flyout */}
            {showAttachmentMenu && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto z-20">
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachmentMenu(false);
                    if (imageInputRef.current) {
                      imageInputRef.current.value = '';
                      imageInputRef.current.click();
                    }
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-xs flex-shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 select-none"
                  title="Mobile Storage / Gallery se 10 photos tak chunein"
                >
                  <ImageIcon size={14} />
                  <span>📱 Gallery (10 Photos)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachmentMenu(false);
                    if (cameraInputRef.current) {
                      cameraInputRef.current.value = '';
                      cameraInputRef.current.click();
                    }
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-xs flex-shrink-0 flex items-center gap-1.5 cursor-pointer active:scale-95 select-none"
                  title="Direct Camera se photo capture karein"
                >
                  <Camera size={14} />
                  <span>📷 Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendQuickAttachment('DOUBT', '📐 Mujhe is question ke formula calculation me doubt hai. Koi step explain kar sakta hai?')}
                  className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold border border-amber-200 flex-shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <span>💡 Ask Doubt</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendQuickAttachment('NOTE', '📚 Chapter ke key short notes maine review kar liye hain. Kisi ko chahiye toh batayein!')}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-800 dark:text-blue-200 rounded-xl text-xs font-bold border border-blue-200 flex-shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <span>📝 Share Note</span>
                </button>
              </div>
            )}

            {/* Emoji Quick Bar */}
            {showEmojiPicker && (
              <div className="p-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto z-20">
                {['👍', '❤️', '🔥', '📚', '💡', '✅', '🙏', '🎯', '💯', '👏'].map((em) => (
                  <button
                    key={em}
                    onClick={() => {
                      setInputText((prev) => prev + em);
                      setShowEmojiPicker(false);
                    }}
                    className="p-1 text-lg hover:scale-125 transition-transform"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom Input Controls */}
            <div className="p-2 md:p-3 bg-white dark:bg-slate-900 border-t border-purple-500/20 z-20">
              {/* Replying To Preview Banner */}
              {replyingTo && (
                <div className="mb-2 p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/60 dark:to-slate-900 border-l-4 border-purple-600 rounded-r-2xl flex items-center justify-between shadow-xs animate-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg bg-purple-600/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                      <Reply size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          Replying to
                        </span>
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {isSameUser(replyingTo.senderId, effectiveUserId) ? 'Yourself' : replyingTo.senderName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5 font-medium">
                        {replyingTo.text || (replyingTo.type === 'VOICE' ? '🎤 Voice message' : '📎 Attachment')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1.5 hover:bg-purple-200/50 dark:hover:bg-purple-900/50 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shrink-0 ml-2 cursor-pointer"
                    title="Cancel Reply"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {selectedContact && isUserBlocked(selectedContact.id) ? (
                <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60">
                  <div className="flex items-center gap-2.5">
                    <Ban size={18} className="text-rose-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                        {selectedContact.name} is blocked
                      </p>
                      <p className="text-[10px] text-rose-600 dark:text-rose-400">
                        Message bhejne ke liye pehle inhein unblock karein
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmDialog({
                        type: 'UNBLOCK',
                        title: 'User Unblock Karein',
                        description: `Kya aap ${selectedContact.name} ko unblock karna chahte hain?`,
                        targetId: selectedContact.id,
                        targetName: selectedContact.name,
                      });
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    Unblock Karein
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                    title="Emojis"
                  >
                    <Smile size={20} />
                  </button>

                  <button
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className="p-2 text-slate-500 hover:text-purple-600 transition-colors cursor-pointer"
                    title="Share Doubt or Notes"
                  >
                    <Paperclip size={20} />
                  </button>

                  {/* Dedicated Photo / Gallery / Camera Button */}
                  <label
                    htmlFor="nsta-chat-image-input"
                    id="nsta-chat-camera-button"
                    className="p-2 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer flex items-center justify-center rounded-lg active:scale-95 select-none"
                    title="Mobile Gallery ya Camera se Photos Bhejein (10 tak)"
                    aria-label="Mobile Gallery ya Camera se Photos Bhejein"
                    onClick={() => {
                      if (imageInputRef.current) {
                        imageInputRef.current.value = '';
                      }
                    }}
                  >
                    <Camera size={20} />
                  </label>
                  {/* File Selection Dialog (Gallery / Camera on Mobile) */}
                  <input
                    id="nsta-chat-image-input"
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    onChange={handleSelectImageFile}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                  {/* Direct Camera Hardware Access */}
                  <input
                    id="nsta-chat-camera-input"
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    tabIndex={-1}
                    onChange={handleSelectImageFile}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />
                  {/* Add More Photos Input for Batch */}
                  <input
                    id="nsta-chat-add-more-input"
                    ref={addMoreImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    onChange={handleAddMoreImages}
                    onClick={(e) => {
                      (e.target as HTMLInputElement).value = '';
                    }}
                  />

                  <div className="flex-1 relative">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      placeholder={
                        replyingTo
                          ? `Replying to ${isSameUser(replyingTo.senderId, effectiveUserId) ? 'yourself' : replyingTo.senderName}...`
                          : selectedGroup
                          ? `Message ${selectedGroup.name}...`
                          : `Message ${selectedContact?.name.split(' ')[0]}...`
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl px-4 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all flex-shrink-0 ${
                      inputText.trim()
                        ? 'bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white active:scale-95 cursor-pointer'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                    }`}
                    title="Send"
                  >
                    <Send size={18} className="ml-0.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── MODAL: FRIEND REQUEST REQUIRED NOTICE ─────────────────── */}
        {friendReqPromptStudent && (
          <div className="fixed inset-0 z-[360] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-purple-500/20 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[2px] mx-auto mb-3">
                <div className="w-full h-full rounded-full bg-slate-900 text-white flex items-center justify-center text-xl font-bold">
                  🤝
                </div>
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                Friend Request Zaroori Hai!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                Nsta Messenger par <span className="font-bold text-purple-600 dark:text-purple-400">{friendReqPromptStudent.name}</span> se baat karne ke liye pehle unhe Friend Request bhejni hogi. Unke accept karne par hi baat start hogi.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleSendFriendRequest(friendReqPromptStudent)}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <UserPlus size={15} />
                  <span>Friend Request Bhejein 🚀</span>
                </button>
                <button
                  onClick={() => setFriendReqPromptStudent(null)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: CREATE NEW STUDY GROUP (PUBLIC OR PRIVATE) ─────── */}
        {showNewGroupModal && (
          <div className="fixed inset-0 z-[350] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-rose-500 to-purple-600 text-white flex items-center justify-center font-bold">
                    <Users size={16} />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    New Nsta Study Group
                  </h3>
                </div>
                <button
                  onClick={() => setShowNewGroupModal(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-3.5 mt-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Physics Numerical Doubt Cell"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {/* Privacy Toggle: Public vs Private */}
                <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/60 space-y-2">
                  <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                    Group Privacy Settings *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewGroupIsPrivate(false)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        !newGroupIsPrivate
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Globe size={13} className="text-emerald-500" />
                        <span>Public Group</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Koi bhi student seedha join kar sakta hai.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewGroupIsPrivate(true)}
                      className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                        newGroupIsPrivate
                          ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-200 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <Lock size={13} className="text-purple-500" />
                        <span>Private Group</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Admin ke approve karne par hi user judega.
                      </span>
                    </button>
                  </div>

                  {newGroupIsPrivate && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                          <KeyRound size={13} className="text-amber-600" />
                          <span>Private Group Password (Optional)</span>
                        </label>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Direct Join or Request</span>
                      </div>
                      <input
                        type="text"
                        value={newGroupPassword}
                        onChange={(e) => setNewGroupPassword(e.target.value)}
                        placeholder="e.g. physics2025 (Password set karein)"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        Agar aap password set karenge, toh students password daal kar seedha join kar sakenge ya fir Request to Join bhej sakenge.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Subject / Topic
                    </label>
                    <input
                      type="text"
                      value={newGroupSubject}
                      onChange={(e) => setNewGroupSubject(e.target.value)}
                      placeholder="e.g. Science / Maths"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      Group Emoji
                    </label>
                    <div className="flex gap-1.5 items-center">
                      {['📚', '🔬', '📐', '🔥', '🏆', '💡'].map((em) => (
                        <button
                          key={em}
                          type="button"
                          onClick={() => setNewGroupEmoji(em)}
                          className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center border transition-transform ${
                            newGroupEmoji === em
                              ? 'border-purple-600 bg-purple-50 scale-110'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Group Description
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Describe group rules and topic discussion..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewGroupModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                  >
                    Create Group
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── MODAL: ADD FRIEND TO GROUP ────────────────────────────── */}
        {showAddFriendModal && selectedGroup && (
          <div className="fixed inset-0 z-[360] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Dost ko Group me Add Karein
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      Apne confirmed friends ko "{selectedGroup.name}" me direct add karein
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddFriendModal(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-2 flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {friends.filter((f) => !selectedGroup.members?.[f.id]).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                    <p>Aapke sabhi friends pehle se hi is group me jud chuke hain ya koi friend nahi hai.</p>
                  </div>
                ) : (
                  friends
                    .filter((f) => !selectedGroup.members?.[f.id])
                    .map((friend) => (
                      <div
                        key={friend.id}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">
                            {friend.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                              {friend.name}
                            </h4>
                            <p className="text-[10px] text-slate-500">Confirmed Friend 🤝</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddFriendToCurrentGroup(friend)}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-xs"
                        >
                          + Add to Group
                        </button>
                      </div>
                    ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => setShowAddFriendModal(false)}
                  className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: GROUP INFO & ADMIN APPROVAL SECTION ────────────── */}
        {showGroupInfo && selectedGroup && (
          <div className="fixed inset-0 z-[350] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Group Information</h3>
                <button
                  onClick={() => setShowGroupInfo(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 rounded-3xl bg-purple-100 dark:bg-purple-950 text-3xl flex items-center justify-center mx-auto mb-2 border border-purple-300 dark:border-purple-800">
                  {selectedGroup.emoji}
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                  {selectedGroup.name}
                  {selectedGroup.isPrivate ? (
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                      Private 🔒
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                      Public 🌐
                    </span>
                  )}
                </h4>
                <p className="text-xs text-purple-600 font-semibold">{selectedGroup.subject}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                  {selectedGroup.description}
                </p>
              </div>

              {/* Action: Add friend to group button */}
              {isGroupMember && (
                <button
                  onClick={() => {
                    setShowGroupInfo(false);
                    setShowAddFriendModal(true);
                  }}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <UserPlus size={14} />
                  <span>Apne Dost ko Group me Add Karein</span>
                </button>
              )}

              {/* ADMIN ONLY: Pending Join Requests for Private Groups */}
              {isGroupAdmin && selectedGroup.isPrivate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                      <Lock size={12} />
                      Pending Join Requests ({selectedGroup.joinRequests ? Object.keys(selectedGroup.joinRequests).length : 0})
                    </h5>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                      Admin Approval
                    </span>
                  </div>

                  {(!selectedGroup.joinRequests || Object.keys(selectedGroup.joinRequests).length === 0) ? (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                      Abhi koi join request pending nahi hai.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {Object.values(selectedGroup.joinRequests).map((req) => (
                        <div
                          key={req.userId}
                          className="p-2 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-between border border-amber-200 dark:border-amber-800"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{req.userName}</p>
                            <p className="text-[10px] text-slate-400">Join request sent</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleApproveJoin(req)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs"
                            >
                              Approve ✅
                            </button>
                            <button
                              onClick={() => handleRejectJoin(req.userId)}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div>
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Group Members ({selectedGroup.memberCount})
                </h5>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedGroup.members &&
                    Object.values(selectedGroup.members).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center">
                            {m.name.charAt(0)}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {m.name} {m.id === user.id ? '(You)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {m.role === 'ADMIN' && (
                            <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.2 rounded">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Leave Group Button */}
              {isGroupMember && (
                <button
                  onClick={() => {
                    setShowGroupInfo(false);
                    setConfirmDialog({
                      type: 'LEAVE_GROUP',
                      title: 'Group se Bahar Niklein',
                      description: `Kya aap sach me '${selectedGroup.name}' group chhodna chahte hain?`,
                      targetId: selectedGroup.id,
                      targetName: selectedGroup.name,
                      groupId: selectedGroup.id,
                    });
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 hover:dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LogOut size={14} />
                  <span>Leave Group (Group Chhodein)</span>
                </button>
              )}

              {/* ADMIN ONLY: Change Group Privacy & Password */}
              {isGroupAdmin && (
                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/60 space-y-2">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Lock size={13} className="text-purple-600" />
                      <span>Group Privacy & Access Settings</span>
                    </h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {selectedGroup.isPrivate ? '🔒 Private Group (Password / Approval Required)' : '🌐 Public Group (Direct Joining Allowed)'}
                      {selectedGroup.isPrivate && selectedGroup.password && (
                        <span className="ml-1 font-mono font-bold text-purple-700 dark:text-purple-300">
                          · Password: {selectedGroup.password}
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setPrivacyToggleIsPrivate(!!selectedGroup.isPrivate);
                      setPrivacyTogglePassword(selectedGroup.password || '');
                      setShowPrivacyChangeModal(true);
                    }}
                    className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300/80 dark:border-purple-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Lock size={12} />
                    <span>{selectedGroup.isPrivate ? 'Public Me Badlein / Password Edit Karein' : 'Private Me Badlein (Password Set Karein)'}</span>
                  </button>
                </div>
              )}

              {/* ADMIN ONLY: Delete Group Permanently Button */}
              {isGroupAdmin && (
                <button
                  onClick={() => {
                    setShowGroupInfo(false);
                    setConfirmDialog({
                      type: 'DELETE_GROUP',
                      title: 'Group Delete Karein',
                      description: `Kya aap sach me '${selectedGroup.name}' group ko permanently delete karna chahte hain? Sabhi members aur chat messages hamesha ke liye delete ho jayenge.`,
                      targetId: selectedGroup.id,
                      targetName: selectedGroup.name,
                      groupId: selectedGroup.id,
                    });
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <Trash2 size={14} />
                  <span>Delete Group (Permanently Delete Karein)</span>
                </button>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowGroupInfo(false)}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: BLOCKED USERS MANAGEMENT ─────────────────────────── */}
        {showBlockedListModal && (
          <div className="fixed inset-0 z-[370] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                    <Ban size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Blocked Users
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {blockedUsers.length} blocked contacts
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBlockedListModal(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              {blockedUsers.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto text-xl">
                    ✅
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Koi user block nahi hai!
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Sabhi contacts ke sath aap message exchange kar sakte hain.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {blockedUsers.map((bUser) => (
                    <div
                      key={bUser.id}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center shrink-0">
                          {bUser.name.charAt(0).toUpperCase()}
                        </div>
                        {/* 1 Single Row for Name & Block Status */}
                        <div className="min-w-0 flex-1 flex items-center gap-2 overflow-hidden">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate whitespace-nowrap">
                            {bUser.name}
                          </span>
                          <span className="text-[10px] text-rose-500 font-medium bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 px-1.5 py-0.2 rounded-md shrink-0 whitespace-nowrap">
                            Blocked
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setConfirmDialog({
                            type: 'UNBLOCK',
                            title: 'User Unblock Karein',
                            description: `Kya aap ${bUser.name} ko unblock karna chahte hain?`,
                            targetId: bUser.id,
                            targetName: bUser.name,
                          });
                        }}
                        className="px-3 py-1 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold shadow-xs transition-colors flex-shrink-0"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button
                  onClick={() => {
                    setShowBlockedListModal(false);
                    setActiveTab('BLOCKED');
                  }}
                  className="w-full py-2 bg-gradient-to-r from-rose-600 to-purple-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Ban size={13} />
                  <span>Open Full Block Directory ({blockedUsers.length}/{totalBlockLimit})</span>
                </button>

                <button
                  onClick={() => setShowBlockedListModal(false)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: DAILY MESSAGE LIMIT REACHED / EXPAND (+10) ─────────── */}
        {showMessageLimitModal && (
          <div className="fixed inset-0 z-[385] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-purple-300 dark:border-purple-900/60 space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-purple-100 dark:bg-purple-950/70 text-purple-600 shadow-inner">
                <MessageCircle size={30} />
              </div>

              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300">
                  Daily Limit Reached
                </span>
                <h3 className="font-black text-base text-slate-900 dark:text-white mt-1.5">
                  Daily Messages Limit Poori Ho Gayi!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Aapne aaj ki <strong>{totalDailyMsgLimit} messages</strong> ki limit poori kar li hai ({currentTier} plan).
                </p>
                <div className="mt-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/60 py-1.5 px-2 rounded-xl">
                  Free: 50/day · Basic: 100/day · Ultra: 300/day
                </div>
              </div>

              {/* Expansion Deal Box */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-purple-900 dark:text-purple-200 uppercase tracking-wide">
                    <Zap size={14} className="text-amber-500" />
                    <span>+{getNextMessageExpansionAmount(currentTier, dailyMsgExpansions)} Daily Messages Unlock Karein</span>
                  </div>
                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md">
                    Max 500/day
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-purple-200 dark:border-purple-800/60 text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Aapke Credits:</span>
                  <span className={userCoins >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    🪙 {userCoins} Credits
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Aapke Diamonds:</span>
                  <span className={userDiamonds >= 20 ? 'text-cyan-600 dark:text-cyan-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    💎 {userDiamonds} Diamonds
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {totalDailyMsgLimit >= 500 ? (
                  <p className="text-xs font-bold text-amber-500 py-2">
                    Aapne maximum 500 messages/day ki limit reach kar li hai!
                  </p>
                ) : (
                  <>
                    {/* Option 1: 100 Credits */}
                    <button
                      type="button"
                      onClick={() => handleExpandLimit('MESSAGE', 'CREDITS')}
                      disabled={isExpandingLimit || userCoins < 100}
                      className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        userCoins >= 100
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Coins size={14} />
                      <span>100 Credits se Unlock Karein (+{getNextMessageExpansionAmount(currentTier, dailyMsgExpansions)} Messages)</span>
                    </button>

                    {/* Option 2: 20 Diamonds */}
                    <button
                      type="button"
                      onClick={() => handleExpandLimit('MESSAGE', 'DIAMONDS')}
                      disabled={isExpandingLimit || userDiamonds < 20}
                      className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        userDiamonds >= 20
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Gem size={14} />
                      <span>20 Diamonds se Unlock Karein (+{getNextMessageExpansionAmount(currentTier, dailyMsgExpansions)} Messages)</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowMessageLimitModal(false)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Band Karein
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: FRIEND LIMIT REACHED / EXPAND (+10) ─────────── */}
        {showFriendLimitModal && (
          <div className="fixed inset-0 z-[385] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-indigo-300 dark:border-indigo-900/60 space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 shadow-inner">
                <UserCheck size={30} />
              </div>

              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300">
                  Friend Limit Reached
                </span>
                <h3 className="font-black text-base text-slate-900 dark:text-white mt-1.5">
                  Friend List Full Ho Gayi Hai!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Aapki <strong>{totalFriendLimit} friends</strong> ki limit poori ho chuki hai ({currentTier} plan).
                </p>
                <div className="mt-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/60 py-1.5 px-2 rounded-xl">
                  Free: 10 friends · Basic: 20 friends · Ultra: 50 friends (Max 50)
                </div>
              </div>

              {/* Expansion Deal Box */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-indigo-900 dark:text-indigo-200 uppercase tracking-wide">
                    <UserPlus size={14} className="text-indigo-600" />
                    <span>+10 Friend Slots Unlock Karein</span>
                  </div>
                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded-md">
                    Max 50
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-indigo-200 dark:border-indigo-800/60 text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Aapke Credits:</span>
                  <span className={userCoins >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    🪙 {userCoins} Credits
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Aapke Diamonds:</span>
                  <span className={userDiamonds >= 20 ? 'text-cyan-600 dark:text-cyan-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    💎 {userDiamonds} Diamonds
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {totalFriendLimit >= 50 ? (
                  <p className="text-xs font-bold text-amber-500 py-2">
                    Aapne maximum 50 friends ki limit reach kar li hai!
                  </p>
                ) : (
                  <>
                    {/* Option 1: 100 Credits */}
                    <button
                      type="button"
                      onClick={() => handleExpandLimit('FRIEND', 'CREDITS')}
                      disabled={isExpandingLimit || userCoins < 100}
                      className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        userCoins >= 100
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Coins size={14} />
                      <span>100 Credits se Unlock Karein (+10 Friends)</span>
                    </button>

                    {/* Option 2: 20 Diamonds */}
                    <button
                      type="button"
                      onClick={() => handleExpandLimit('FRIEND', 'DIAMONDS')}
                      disabled={isExpandingLimit || userDiamonds < 20}
                      className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                        userDiamonds >= 20
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <Gem size={14} />
                      <span>20 Diamonds se Unlock Karein (+10 Friends)</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowFriendLimitModal(false)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Band Karein
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: BLOCK LIMIT REACHED / EXPAND (100 CREDITS OR 10 DIAMONDS) ─────────── */}
        {showLimitReachedModal && (
          <div className="fixed inset-0 z-[385] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-rose-300 dark:border-rose-900/60 space-y-4">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-rose-100 dark:bg-rose-950/70 text-rose-600 shadow-inner">
                <Ban size={30} />
              </div>

              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300">
                  Block Limit Reached
                </span>
                <h3 className="font-black text-base text-slate-900 dark:text-white mt-1.5">
                  Block List Full Ho Gayi Hai!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {attemptingBlockUser?.name ? (
                    <>
                      Aap <strong>{attemptingBlockUser.name}</strong> ko block nahi kar sakte kyunki aapki {totalBlockLimit} user block limit poori ho chuki hai.
                    </>
                  ) : (
                    <>
                      Aapki {totalBlockLimit} user block limit poori ho chuki hai ({currentBlockTier} plan).
                    </>
                  )}
                </p>
                <div className="mt-2 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800/60 py-1.5 px-2 rounded-xl">
                  Free: 10 · Basic: 20 · Ultra: 40 block slots
                </div>
              </div>

              {/* Expansion Deal Box */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                    <span>🛡️</span>
                    <span>+10 Block Slots Unlock Karein</span>
                  </div>
                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-md">
                    Permanent
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-amber-200 dark:border-amber-800 text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Aapke Credits:</span>
                  <span className={userCoins >= 100 ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    🪙 {userCoins} Credits
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-600 dark:text-slate-300">Aapke Diamonds:</span>
                  <span className={userDiamonds >= 10 ? 'text-cyan-600 dark:text-cyan-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    💎 {userDiamonds} Diamonds
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {/* Option 1: 100 Credits */}
                <button
                  type="button"
                  onClick={() => handleExpandLimit('BLOCK', 'CREDITS')}
                  disabled={isExpandingLimit || userCoins < 100}
                  className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    userCoins >= 100
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Coins size={14} />
                  <span>100 Credits se Unlock Karein (+10 Slots)</span>
                </button>

                {/* Option 2: 10 Diamonds */}
                <button
                  type="button"
                  onClick={() => handleExpandLimit('BLOCK', 'DIAMONDS')}
                  disabled={isExpandingLimit || userDiamonds < 10}
                  className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    userDiamonds >= 10
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Gem size={14} />
                  <span>10 Diamonds se Unlock Karein (+10 Slots)</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLimitReachedModal(false);
                      setActiveTab('BLOCKED');
                    }}
                    className="w-full py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Manage Block List
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowLimitReachedModal(false);
                      setAttemptingBlockUser(null);
                    }}
                    className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: UNIFIED CONFIRMATION DIALOG (UNFRIEND / BLOCK / LEAVE) ─── */}
        {confirmDialog && (
          <div className="fixed inset-0 z-[380] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
                confirmDialog.type === 'BLOCK'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'
                  : confirmDialog.type === 'UNFRIEND'
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600'
                  : confirmDialog.type === 'LEAVE_GROUP'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600'
                  : confirmDialog.type === 'UNBLOCK'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
              }`}>
                {confirmDialog.type === 'BLOCK' && <Ban size={28} />}
                {confirmDialog.type === 'UNFRIEND' && <UserX size={28} />}
                {confirmDialog.type === 'LEAVE_GROUP' && <LogOut size={28} />}
                {confirmDialog.type === 'UNBLOCK' && <Check size={28} />}
                {confirmDialog.type === 'CLEAR_CHAT' && <Trash2 size={28} />}
              </div>

              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  {confirmDialog.description}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  disabled={actionLoading}
                  onClick={handleExecuteConfirmAction}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-1.5 ${
                    confirmDialog.type === 'UNBLOCK'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : confirmDialog.type === 'UNFRIEND'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {actionLoading ? (
                    <span>Please wait...</span>
                  ) : (
                    <span>
                      {confirmDialog.type === 'BLOCK' && 'Haan, Block Karein'}
                      {confirmDialog.type === 'UNBLOCK' && 'Haan, Unblock Karein'}
                      {confirmDialog.type === 'UNFRIEND' && 'Haan, Unfriend Karein'}
                      {confirmDialog.type === 'LEAVE_GROUP' && 'Haan, Group Chhodein'}
                      {confirmDialog.type === 'CLEAR_CHAT' && 'Haan, Clear Karein'}
                    </span>
                  )}
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => setConfirmDialog(null)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}


        {/* ─── MODAL 1: MESSAGE DELETION (DELETE FOR ME vs DELETE FOR EVERYONE) ─── */}
        {deletingMessage && (
          <div className="fixed inset-0 z-[370] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-2">
                  <Trash2 size={24} />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Message</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Aap is message ko kis tarah se delete karna chahte hain?
                </p>
                <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300 italic truncate max-w-xs mx-auto">
                  "{deletingMessage.text}"
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {/* Delete for everyone (Allowed ONLY if sender is current user or group creator) */}
                {(isMsgSentByMe(deletingMessage) || (selectedGroup && isSameUser(selectedGroup.creatorId, effectiveUserId || user.id))) ? (
                  <button
                    onClick={() => handleDeleteMessage('FOR_EVERYONE')}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Ban size={15} />
                    <span>Delete for Everyone (Sabke liye delete karein)</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300 text-center leading-tight font-medium">
                    🔒 Friend ka bheja hua message sirf aapke chat se delete ho sakta hai (Delete for Me). Delete for Everyone sirf bhejne wale ke paas hota hai.
                  </div>
                )}

                {/* Delete for me */}
                <button
                  onClick={() => handleDeleteMessage('FOR_ME')}
                  className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 size={15} />
                  <span>Delete for Me (Sirf mere liye delete karein)</span>
                </button>

                <button
                  onClick={() => setDeletingMessage(null)}
                  className="w-full py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 1B: BATCH DELETE MESSAGES (MULTI-SELECT) ─── */}
        {showBatchDeleteDialog && selectedMsgIds.size > 0 && (
          <div className="fixed inset-0 z-[370] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-2">
                  <Trash2 size={24} />
                </div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Delete {selectedMsgIds.size} Selected Message{selectedMsgIds.size > 1 ? 's' : ''}?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Aap in {selectedMsgIds.size} messages ko kis tarah se delete karna chahte hain?
                </p>
              </div>

              {(() => {
                const selectedBatchMessages = displayMessages.filter((m) => selectedMsgIds.has(m.id));
                const isGroupCreator = !!selectedGroup && isSameUser(selectedGroup.creatorId, effectiveUserId || user.id);
                const canBatchDeleteEveryone = isGroupCreator || (selectedBatchMessages.length > 0 && selectedBatchMessages.every((m) => isMsgSentByMe(m)));

                return (
                  <div className="space-y-2 pt-1">
                    {/* Delete for everyone */}
                    {canBatchDeleteEveryone ? (
                      <button
                        onClick={() => handleBatchDelete('FOR_EVERYONE')}
                        className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Ban size={15} />
                        <span>Delete for Everyone ({selectedMsgIds.size})</span>
                      </button>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300 text-center leading-tight font-medium">
                        🔒 Selected messages me friend ke messages shamil hain. Aap unhe sirf apne liye delete kar sakte hain (Delete for Me).
                      </div>
                    )}

                    {/* Delete for me */}
                    <button
                      onClick={() => handleBatchDelete('FOR_ME')}
                      className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={15} />
                      <span>Delete for Me ({selectedMsgIds.size})</span>
                    </button>

                    <button
                      onClick={() => setShowBatchDeleteDialog(false)}
                      className="w-full py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ─── MODAL 2: DISAPPEARING MESSAGES (24H, 7D, 30D, 90D, SNAPCHAT VANISH) ─── */}
        {showDisappearingModal && (
          <div className="fixed inset-0 z-[370] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">Disappearing Messages</h3>
                    <p className="text-[11px] text-slate-500">Naye messages select kiye gaye time ke baad gayab ho jayenge</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDisappearingModal(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Jab yeh feature on hoga, is chat me bheje gaye sabhi naye messages chuni hui muddat ke baad apne aap delete ho jayenge.
              </p>

              <div className="space-y-2">
                {[
                  { label: '24 Hours', ms: 86400000, desc: 'Bhejne ke 24 ghante baad gayab ho jayega' },
                  { label: '7 Days (1 Week)', ms: 604800000, desc: '1 week ke baad sabhi messages delete ho jayenge' },
                  { label: '30 Days', ms: 2592000000, desc: '30 din baad messages saaf ho jayenge' },
                  { label: '90 Days', ms: 7776000000, desc: '90 din baad messages automatically delete honge' },
                  { label: 'Snapchat Vanish Mode', ms: -1, desc: 'Chat dekhne ke baad aur exit par delete! (Saved in Chat messages unsave hone tak safe rahenge)' },
                  { label: 'Off', ms: 0, desc: 'Messages hamesha safe rahenge' },
                ].map((opt) => {
                  const isSelected = currentDisappearingTimer === opt.ms;

                  return (
                    <button
                      key={opt.ms}
                      onClick={() => {
                        if (activeChatContextId) {
                          setDisappearingTimer(activeChatContextId, opt.ms);
                          setCurrentDisappearingTimer(opt.ms);
                          showToast(`⏱️ Disappearing messages set to: ${opt.label}`);
                        }
                        setShowDisappearingModal(false);
                      }}
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2">
                          <span>{opt.label}</span>
                          {opt.ms === -1 && (
                            <span className="text-[10px] bg-yellow-400 text-slate-950 font-black px-1.5 py-0.2 rounded">
                              Snapchat 👻
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowDisappearingModal(false)}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 3: CHAT LOCK PIN PROMPT (DIRECT PASSWORD SET & UNLOCK) ─────── */}
        {showPinModal && (
          <div className="fixed inset-0 z-[380] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Lock size={30} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {hasChatPin() ? 'Chat Locked 🔒' : 'Set Chat Password 🔒'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {hasChatPin()
                    ? 'Yeh chat password se protected hai. Kholne ke liye password darj karein:'
                    : 'Koi default password nahi hai. Is chat ko protect karne ke liye apna custom password direct set karein:'}
                </p>
              </div>

              <div className="py-2">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (hasChatPin()) {
                        handleVerifyPin();
                      } else {
                        handleDirectSetPin();
                      }
                    }
                  }}
                  placeholder={hasChatPin() ? "Password / PIN" : "Apna Naya Password / PIN"}
                  className="w-56 text-center text-base font-bold py-2.5 px-4 bg-slate-100 dark:bg-slate-800 border-2 border-purple-400 dark:border-purple-600 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mx-auto block"
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs text-rose-500 font-bold mt-2 animate-bounce">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {hasChatPin() ? (
                  <button
                    onClick={handleVerifyPin}
                    className="w-full py-2.5 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Unlock size={14} />
                    <span>Chat Unlock Karein</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleDirectSetPin()}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <KeyRound size={14} />
                    <span>Password Set Karein & Chat Kholein</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPendingUnlockContext(null);
                    setPinInput('');
                    setPinError(null);
                  }}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 4: SET / CHANGE CHAT PIN / PASSWORD ─────────────────────────── */}
        {showChangePinModal && (
          <div className="fixed inset-0 z-[380] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound size={26} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Direct Password Set / Change Karein</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Apna naya custom password ya PIN darj karein:
                </p>
              </div>

              <div className="py-1">
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => {
                    setNewPinInput(e.target.value);
                    setNewPinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleChangePin();
                  }}
                  placeholder="Naya Password / PIN"
                  className="w-56 text-center text-base font-bold py-2.5 px-3 bg-slate-100 dark:bg-slate-800 border-2 border-indigo-400 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mx-auto block"
                  autoFocus
                />
                {newPinError && (
                  <p className="text-xs text-rose-500 font-bold mt-2">
                    {newPinError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleChangePin}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Save Naya Password
                </button>
                <button
                  onClick={() => {
                    setShowChangePinModal(false);
                    setNewPinInput('');
                    setNewPinError(null);
                  }}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 5: DUAL PASSWORD (DEFAULT & SPECIAL) MANAGER ─────── */}
        <NstaChatLockPasswordModal
          isOpen={showDualPasswordModal}
          onClose={() => setShowDualPasswordModal(false)}
          userId={effectiveUserId || user.id}
          onPasswordChanged={() => {
            setStarredStateTick((v) => v + 1);
            showToast('✅ Passwords successfully update ho gaye!');
          }}
        />

        {/* ─── MODAL 6: SEND PHOTO / IMAGE PREVIEW MODAL (UP TO 10 PHOTOS) ─── */}
        {imagePreviewModalOpen && selectedImagesToSend.length > 0 && (
          <div className="fixed inset-0 z-[390] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 animate-in zoom-in-95">
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                    <Camera size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        Photos Bhejein
                      </h3>
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-full text-[11px] font-extrabold">
                        {selectedImagesToSend.length}/10
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate max-w-[200px]">
                      {selectedImagesToSend[activePreviewImageIndex]?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* WhatsApp-Style HD Quality Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextVal = !isHdQuality;
                      setIsHdQuality(nextVal);
                      showToast(
                        nextVal
                          ? '✨ HD Quality ON: Photo high-resolution (3200px) me bhejegi, formula aur notes crystal-clear dikhenge!'
                          : '⚡ Standard Quality: Fast transfer active.'
                      );
                    }}
                    disabled={isUploadingImage}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1 transition-all cursor-pointer select-none active:scale-95 ${
                      isHdQuality
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs ring-1 ring-emerald-400'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                    }`}
                    title={isHdQuality ? 'HD Active: High Resolution (Notes aur formula crystal clear)' : 'HD button tap karke High Quality me bhejein'}
                  >
                    <Sparkles size={13} className={isHdQuality ? 'text-amber-300 animate-pulse' : 'text-slate-400'} />
                    <span>HD</span>
                    {isHdQuality && (
                      <span className="text-[9px] bg-emerald-800/80 px-1 py-0.2 rounded text-white font-black">
                        ON
                      </span>
                    )}
                  </button>

                  {/* Quick Crop button in header */}
                  <button
                    type="button"
                    onClick={handleStartCrop}
                    disabled={isUploadingImage}
                    className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    title="Active photo crop karein ya adjust karein"
                  >
                    <Crop size={14} />
                    <span>Crop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isUploadingImage) {
                        setImagePreviewModalOpen(false);
                        setSelectedImagesToSend([]);
                        setActivePreviewImageIndex(0);
                        setImageCaptionInput('');
                        setIsCroppingImage(false);
                      }
                    }}
                    disabled={isUploadingImage}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* HD Helper Tip Bar */}
              {isHdQuality ? (
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Sparkles size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>HD Quality Active: High-resolution clear upload for notes & formulas</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHdQuality(false)}
                    className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer ml-2 shrink-0"
                  >
                    Switch to Standard
                  </button>
                </div>
              ) : (
                <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 rounded-xl flex items-center justify-between text-[11px] text-slate-500">
                  <span>💡 Formula ya handwritten notes bhej rahe hain?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsHdQuality(true);
                      showToast('✨ HD Quality ON: Photo high-resolution me send hogi!');
                    }}
                    className="font-bold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer flex items-center gap-0.5 ml-2"
                  >
                    <Sparkles size={11} /> Turn HD ON
                  </button>
                </div>
              )}

              {/* Main Image Preview with Interactive Crop Overlay */}
              <div className="relative rounded-2xl overflow-hidden h-64 sm:h-72 bg-slate-950 flex items-center justify-center group">
                {selectedImageUrls[activePreviewImageIndex] ? (
                  <img
                    src={selectedImageUrls[activePreviewImageIndex]}
                    alt={`Preview ${activePreviewImageIndex + 1}`}
                    className="max-h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2 p-8">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Photo taiyar ho rahi hai...</span>
                  </div>
                )}

                {/* Active Photo Badge & HD Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <div className="px-2.5 py-1 bg-black/70 text-white rounded-lg text-[10px] font-bold backdrop-blur-xs flex items-center gap-1">
                    <span>Photo {activePreviewImageIndex + 1} of {selectedImagesToSend.length}</span>
                  </div>
                  {isHdQuality && (
                    <div className="px-2 py-1 bg-emerald-600/90 text-white rounded-lg text-[10px] font-black backdrop-blur-xs flex items-center gap-1 shadow-xs border border-emerald-400/50">
                      <Sparkles size={10} className="text-amber-300" />
                      <span>HD</span>
                    </div>
                  )}
                </div>

                {/* Overlay Crop Button on top-right of image */}
                {!isUploadingImage && (
                  <button
                    type="button"
                    onClick={handleStartCrop}
                    className="absolute top-2 right-2 px-3 py-1.5 bg-black/75 hover:bg-purple-600 text-white rounded-xl text-xs font-bold backdrop-blur-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
                    title="Active Photo Crop ya Rotate karein"
                  >
                    <Crop size={14} />
                    <span>Crop / Adjust</span>
                  </button>
                )}

                {/* Upload Progress Overlay */}
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 p-4 text-center">
                    <div className="w-9 h-9 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-bold animate-pulse text-purple-300">
                      {uploadProgressText || 'Photos upload ho rahi hain...'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Kripya intezar karein, sabhi photos bhej rahe hain...
                    </p>
                  </div>
                )}
              </div>

              {/* Multi-Photo Thumbnail Strip (up to 10 photos) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-0.5">
                  <span className="font-semibold">Selected Photos ({selectedImagesToSend.length}/10):</span>
                  {selectedImagesToSend.length < 10 && (
                    <label
                      htmlFor="nsta-chat-add-more-input"
                      className="text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center gap-1 cursor-pointer active:scale-95 select-none"
                      onClick={() => {
                        if (addMoreImageInputRef.current) {
                          addMoreImageInputRef.current.value = '';
                        }
                      }}
                    >
                      <Plus size={12} />
                      <span>Aur Photos Jodein ({10 - selectedImagesToSend.length} bachi)</span>
                    </label>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  {selectedImagesToSend.map((f, idx) => {
                    const isActive = idx === activePreviewImageIndex;
                    const thumbUrl = selectedImageUrls[idx];
                    return (
                      <div
                        key={`${f.name}_${idx}`}
                        className={`relative group shrink-0 w-14 h-14 rounded-xl overflow-hidden cursor-pointer transition-all ${
                          isActive
                            ? 'ring-2 ring-purple-600 ring-offset-2 dark:ring-offset-slate-900 scale-105'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        onClick={() => setActivePreviewImageIndex(idx)}
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={f.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white text-xs">
                            📷
                          </div>
                        )}
                        <div className="absolute top-0.5 left-1 text-[9px] font-black text-white bg-black/60 px-1 rounded">
                          {idx + 1}
                        </div>
                        {!isUploadingImage && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImageFromBatch(idx);
                            }}
                            className="absolute top-0.5 right-0.5 w-4 h-4 bg-rose-600/90 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] shadow-xs cursor-pointer"
                            title="Hataayein"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add more photo card */}
                  {selectedImagesToSend.length < 10 && (
                    <label
                      htmlFor="nsta-chat-add-more-input"
                      className="shrink-0 w-14 h-14 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-800 hover:border-purple-500 dark:hover:border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 flex flex-col items-center justify-center text-purple-600 dark:text-purple-400 gap-0.5 cursor-pointer transition-colors active:scale-95 select-none"
                      title="Aur photos jodein (Maximum 10)"
                    >
                      <Plus size={16} />
                      <span className="text-[9px] font-bold">+Add</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Caption Input */}
              <div>
                <input
                  type="text"
                  value={imageCaptionInput}
                  onChange={(e) => setImageCaptionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isUploadingImage) handleSendImageMessage();
                  }}
                  disabled={isUploadingImage}
                  placeholder="Photo ke sath message ya caption likhein (optional)..."
                  className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!isUploadingImage) {
                      setImagePreviewModalOpen(false);
                      setSelectedImagesToSend([]);
                      setActivePreviewImageIndex(0);
                      setImageCaptionInput('');
                      setIsCroppingImage(false);
                    }
                  }}
                  disabled={isUploadingImage}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleStartCrop}
                  disabled={isUploadingImage}
                  className="flex-1 py-2.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Crop size={14} />
                  <span>Crop Active</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendImageMessage}
                  disabled={isUploadingImage}
                  className="flex-2 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  {isUploadingImage ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="truncate">{uploadProgressText || 'Bhej rahe hain...'}</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Bhejein ({selectedImagesToSend.length} Photos) 🚀</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL: IN-APP INTERACTIVE IMAGE CROPPER ─────────────────── */}
        {isCroppingImage && imageToCropUrl && (
          <ImageCropper
            imageSrc={imageToCropUrl}
            title="Photo Crop & Rotate Karein"
            saveButtonText="Crop Apply Karein ✅"
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
          />
        )}

        {/* ─── MODAL 7: FULLSCREEN IN-APP IMAGE LIGHTBOX (NO EXTERNAL NAVIGATION / NO URL EXPOSURE) ─── */}
        {lightboxImageUrl && (
          <div
            className={`fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between transition-all select-none ${
              isLightboxFullscreen ? 'p-0' : 'p-2 sm:p-4'
            } animate-in fade-in`}
            onClick={() => closeImageLightbox()}
          >
            {/* Sleek Top Controls Bar (In-App Only - No URLs Exposed) */}
            <div
              className="w-full flex items-center justify-between px-3 py-2.5 z-20 bg-gradient-to-b from-black/80 to-transparent"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-white">
                <span className="text-xs sm:text-sm font-black tracking-wide">
                  📷 {lightboxImagesList.length > 1 ? `Photo ${lightboxActiveIndex + 1} of ${lightboxImagesList.length}` : 'Photo Viewer'}
                </span>
                {lightboxZoom > 1 && (
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded-full text-white">
                    {Math.round(lightboxZoom * 100)}%
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                {/* Bulk Download Button in Lightbox when multiple photos */}
                {lightboxImagesList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDownloadAllImages(lightboxImagesList)}
                    className="px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer mr-1"
                    title="Sabhi photos ek saath ZIP file me download karein"
                  >
                    <Download size={14} />
                    <span>Download All ({lightboxImagesList.length})</span>
                  </button>
                )}

                {/* Zoom Out */}
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                  className="p-2 sm:p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>

                {/* Zoom In */}
                <button
                  type="button"
                  onClick={() => setLightboxZoom((z) => Math.min(3.5, +(z + 0.25).toFixed(2)))}
                  className="p-2 sm:p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>

                {/* Rotate */}
                <button
                  type="button"
                  onClick={() => setLightboxRotation((r) => (r + 90) % 360)}
                  className="p-2 sm:p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
                  title="Rotate"
                >
                  <RotateCw size={16} />
                </button>

                {/* In-App Fullscreen Toggle */}
                <button
                  type="button"
                  onClick={() => toggleLightboxFullscreen()}
                  className="p-2 sm:p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
                  title={isLightboxFullscreen ? 'Chhoti Screen' : 'Puri Screen Karein (Full Screen)'}
                >
                  {isLightboxFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                {/* Save Current Photo to Device */}
                <button
                  type="button"
                  onClick={() => handleDownloadImage(lightboxImageUrl)}
                  className="p-2 sm:p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer"
                  title="Current Photo Save Karein"
                >
                  <Download size={16} />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => closeImageLightbox()}
                  className="p-2 sm:p-2.5 bg-white/20 hover:bg-rose-600 text-white rounded-full transition-colors cursor-pointer ml-1"
                  title="Close (Band Karein)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Central Fullscreen Image Viewport with Previous & Next navigation */}
            <div
              className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative cursor-default"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={() => setLightboxZoom((z) => (z > 1 ? 1 : 2))}
            >
              {/* Previous Image Arrow */}
              {lightboxImagesList.length > 1 && (
                <button
                  type="button"
                  onClick={goToPrevLightboxImage}
                  className="absolute left-2 sm:left-4 z-30 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-purple-600 text-white backdrop-blur-xs transition-all shadow-lg cursor-pointer active:scale-95"
                  title="Pichli Photo (Previous Photo)"
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              {lightboxImageUrl ? (
                <img
                  src={lightboxImageUrl}
                  alt={`Photo ${lightboxActiveIndex + 1}`}
                  style={{
                    transform: `scale(${lightboxZoom}) rotate(${lightboxRotation}deg)`,
                    transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                  }}
                  className={`select-none max-w-full max-h-full object-contain pointer-events-auto transition-all ${
                    isLightboxFullscreen ? 'w-full h-full p-0' : 'max-w-[96vw] max-h-[82vh] rounded-2xl shadow-2xl p-1'
                  }`}
                  draggable={false}
                />
              ) : null}

              {/* Next Image Arrow */}
              {lightboxImagesList.length > 1 && (
                <button
                  type="button"
                  onClick={goToNextLightboxImage}
                  className="absolute right-2 sm:right-4 z-30 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-purple-600 text-white backdrop-blur-xs transition-all shadow-lg cursor-pointer active:scale-95"
                  title="Agli Photo (Next Photo)"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>

            {/* Bottom Strip: Mini Carousel / Dots if multiple images */}
            {lightboxImagesList.length > 1 && (
              <div
                className="w-full flex items-center justify-center gap-2 py-2 px-3 z-20 bg-gradient-to-t from-black/85 to-transparent overflow-x-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {lightboxImagesList.map((url, idx) => {
                  const isActive = idx === lightboxActiveIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setLightboxActiveIndex(idx);
                        setLightboxImageUrl(url);
                        setLightboxZoom(1);
                        setLightboxRotation(0);
                      }}
                      className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 transition-all cursor-pointer ${
                        isActive
                          ? 'ring-2 ring-purple-500 scale-110 shadow-lg'
                          : 'opacity-50 hover:opacity-90'
                      }`}
                    >
                      <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* In-App Subtle Hint Bar */}
            <div className="w-full text-center py-1.5 z-10 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
              <p className="text-[10px] text-white/60 font-medium select-none">
                Double tap to zoom • Left/Right arrows se photos badlein • App ke andar hi puri picture dikhegi
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Also export alias as NstaMessengerModal for seamless modern naming
export const NstaMessengerModal = WhatsAppChatModal;
