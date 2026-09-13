import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { User } from '../types';
import { applyDeduction, getTotalCredits } from '../utils/creditSystem';
import { saveUserToLive } from '../firebase';
import {
  ChatContact,
  ChatMessage,
  ChatGroup,
  FriendRequest,
  SEEDED_CONTACTS,
  SEEDED_GROUPS,
  getDirectConversationId,
  sendPrivateMessage,
  sendGroupMessage,
  subscribeToDirectMessages,
  subscribeToGroupMessages,
  createWhatsAppGroup,
  reactToChatMessage,
  getLocalGroups,
  fetchRegisteredStudents,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  subscribeToFriendRequests,
  subscribeToSentFriendRequests,
  subscribeToFriends,
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
  getDisappearingTimer,
  setDisappearingTimer,
  filterDisappearingMessages,
  clearSeenVanishMessages,
  isChatLocked,
  toggleChatLock,
  verifyChatPin,
  setChatPin,
  getChatPin,
  isSameUser,
  isMessageDeletedForUser,
  updateGroupPrivacy,
  joinPrivateGroupByPassword,
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

// Daily message limit: Free -> 50, Basic -> 200, Ultra -> Unlimited (Infinity)
export const getBaseDailyMessageLimit = (tier: 'FREE' | 'BASIC' | 'ULTRA'): number => {
  switch (tier) {
    case 'ULTRA':
      return Infinity;
    case 'BASIC':
      return 200;
    case 'FREE':
    default:
      return 50;
  }
};

// Friend limit: Free -> 10, Basic -> 20, Ultra -> 40
export const getBaseFriendLimit = (tier: 'FREE' | 'BASIC' | 'ULTRA'): number => {
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
  initialTab?: 'CHATS' | 'REQUESTS' | 'GROUPS' | 'BLOCKED';
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
  // Navigation State: CHATS, FIND_FRIENDS, REQUESTS, GROUPS, BLOCKED
  const [activeTab, setActiveTab] = useState<'CHATS' | 'FIND_FRIENDS' | 'REQUESTS' | 'GROUPS' | 'BLOCKED'>(
    (initialTab as any) || (targetPeer ? 'CHATS' : 'CHATS')
  );
  const [requestsSubTab, setRequestsSubTab] = useState<'RECEIVED' | 'SENT' | 'FIND_FRIENDS'>('RECEIVED');
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
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
  const totalFriendLimit = baseFriendLimit + friendExpansions * 10;
  const [showFriendLimitModal, setShowFriendLimitModal] = useState(false);

  // 3. Daily message tracking & expansions (Free: 50, Basic: 200, Ultra: Unlimited)
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
  const totalDailyMsgLimit = baseDailyMsgLimit === Infinity ? Infinity : baseDailyMsgLimit + dailyMsgExpansions * 10;
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
  const [friends, setFriends] = useState<ChatContact[]>([]);
  const [students, setStudents] = useState<ChatContact[]>(SEEDED_CONTACTS);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>(getLocalGroups());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [findFriendQuery, setFindFriendQuery] = useState('');
  const [findFriendClassFilter, setFindFriendClassFilter] = useState<string>('ALL');

  // Active chat messages & input
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  // Voice note simulator state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
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

  // Disappearing Messages State (24h, 7d, 30d, 90d, Snapchat Vanish Mode)
  const [showDisappearingModal, setShowDisappearingModal] = useState<boolean>(false);
  const [currentDisappearingTimer, setCurrentDisappearingTimer] = useState<number>(0);

  // Chat Lock & PIN Protection State (Snapchat-style locking on back/exit)
  const [isCurrentChatLocked, setIsCurrentChatLocked] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingUnlockContext, setPendingUnlockContext] = useState<{
    contact?: ChatContact;
    group?: ChatGroup;
    contextId: string;
  } | null>(null);
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [newPinError, setNewPinError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(null), 3500);
  };

  // Unified Limit Expansion with 100 Credits OR 10 Diamonds (+10 limit)
  const handleExpandLimit = async (
    type: 'MESSAGE' | 'FRIEND' | 'BLOCK',
    currency: 'CREDITS' | 'DIAMONDS'
  ): Promise<boolean> => {
    const costCredits = 100;
    const costDiamonds = 10;
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
        setDailyMsgExpansions(nextExp);
        updated = {
          ...updated,
          dailyMessageLimitExpansions: nextExp,
        };
        try {
          localStorage.setItem(`nsta_msg_expansions_${user.id}_${today}`, String(nextExp));
        } catch {}
        showToast(`🎉 +10 Daily Messages unlock ho gaye! Aaj ka naya limit: ${baseDailyMsgLimit + nextExp * 10} msgs.`);
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

  // 1. Subscribe to confirmed friends
  useEffect(() => {
    const unsub = subscribeToFriends(user.id, (list) => {
      setFriends(list);
    });
    return () => unsub();
  }, [user.id]);

  // 1b. Subscribe to blocked users
  useEffect(() => {
    const unsub = subscribeToBlockedUsers(user.id, (list) => {
      setBlockedUsers(list);
    });
    return () => unsub();
  }, [user.id]);

  // 2. Subscribe to incoming friend requests
  useEffect(() => {
    const extraIds = [(user as any).uid, (user as any).displayId].filter(Boolean);
    const unsub = subscribeToFriendRequests(user.id, (reqs) => {
      setFriendRequests(reqs);
    }, extraIds);
    return () => unsub();
  }, [user.id, (user as any).uid, (user as any).displayId]);

  // Subscribe to outgoing sent requests
  useEffect(() => {
    const unsub = subscribeToSentFriendRequests(user.id, (sent) => {
      setSentRequests(sent);
    });
    return () => unsub();
  }, [user.id]);

  // 3. Fetch all registered students from Firebase & seeds
  useEffect(() => {
    fetchRegisteredStudents(user.id).then((list) => {
      if (list && list.length > 0) {
        setStudents(list);
      }
    });
  }, [user.id]);

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
    ? getDirectConversationId(user.id, selectedContact.id)
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
      });
    } else if (selectedGroup && effectiveUserId) {
      const grpId = selectedGroup.id;
      setCurrentDisappearingTimer(getDisappearingTimer(grpId));
      setIsCurrentChatLocked(isChatLocked(grpId));
      markMessagesAsRead(true, grpId, effectiveUserId);

      unsub = subscribeToGroupMessages(selectedGroup.id, (msgs) => {
        const filtered = filterDisappearingMessages(msgs, grpId, effectiveUserId);
        setMessages(filtered);
      });
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
    }
    setSelectedContact(null);
    setSelectedGroup(null);
  };

  // Open Contact chat with PIN check
  const handleOpenContactChat = (contact: ChatContact) => {
    const convId = getDirectConversationId(user.id, contact.id);
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

  // Verify PIN to unlock chat
  const handleVerifyPin = () => {
    if (verifyChatPin(pinInput)) {
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
      setPinError('Galat PIN! Sahi PIN darj karein (Default: 1234)');
    }
  };

  // Change PIN handler
  const handleChangePin = () => {
    if (newPinInput.length !== 4 || !/^\d{4}$/.test(newPinInput)) {
      setNewPinError('PIN 4 digits ka hona chahiye (e.g. 1234)');
      return;
    }
    setChatPin(newPinInput);
    setShowChangePinModal(false);
    setNewPinInput('');
    setNewPinError(null);
    showToast('🔒 Chat Lock PIN update ho gaya!');
  };

  // Handle message deletion
  const handleDeleteMessage = async (mode: 'FOR_ME' | 'FOR_EVERYONE') => {
    if (!deletingMessage || !activeChatContextId) return;

    await deleteChatMessage(
      !!selectedGroup,
      activeChatContextId,
      deletingMessage.id,
      user.id,
      mode
    );

    if (mode === 'FOR_ME') {
      setMessages((prev) => prev.filter((m) => m.id !== deletingMessage.id));
      showToast('🗑️ Message deleted for you');
    } else {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === deletingMessage.id
            ? {
                ...m,
                text: '🚫 This message was deleted',
                isDeletedForEveryone: true,
                type: 'TEXT' as const,
              }
            : m
        )
      );
      showToast('🚫 Message deleted for everyone');
    }
    setDeletingMessage(null);
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
  }, [messages, isRecordingVoice]);

  // Helper: check if a user is a confirmed friend
  const isFriendWith = (targetUserId: string): boolean => {
    if (targetUserId === 'peer_iic_ai_tutor') return true; // AI Tutor is always friendly
    return friends.some((f) => f.id === targetUserId);
  };

  // Helper: check if a user is blocked
  const isUserBlocked = (targetUserId: string): boolean => {
    return blockedUsers.some((b) => b.id === targetUserId);
  };

  // Helper: check if outgoing request is pending
  const hasPendingSentRequest = (targetUserId: string): boolean => {
    const cleanTarget = sanitizeRtdbKey(targetUserId);
    if (sentRequests.some((r) => (r.toId === targetUserId || sanitizeRtdbKey(r.toId) === cleanTarget) && r.status === 'PENDING')) {
      return true;
    }
    const raw = localStorage.getItem('nsta_friend_requests');
    if (!raw) return false;
    try {
      const all: FriendRequest[] = JSON.parse(raw);
      return all.some((r) => r.fromId === user.id && (r.toId === targetUserId || sanitizeRtdbKey(r.toId) === cleanTarget) && r.status === 'PENDING');
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

  // Handle Send Friend Request
  const handleSendFriendRequest = async (targetStudent: ChatContact) => {
    if (!targetStudent || targetStudent.id === user.id || sendingReqIds.has(targetStudent.id)) return;
    if (friends.length >= totalFriendLimit) {
      setShowFriendLimitModal(true);
      return;
    }
    setSendingReqIds((prev) => new Set(prev).add(targetStudent.id));
    try {
      const newReq = await sendFriendRequest(
        {
          id: effectiveUserId,
          name: user.name || 'Student',
          photoURL: user.photoURL || (user as any).avatarUrl || '',
          role: user.role || 'STUDENT',
        },
        {
          id: targetStudent.id,
          name: targetStudent.name,
          photoURL: targetStudent.photoURL || '',
        }
      );
      setSentRequests((prev) => [newReq, ...prev.filter((r) => r.toId !== targetStudent.id)]);
      showToast(`🚀 Friend request sent to ${targetStudent.name}!`);
      setFriendReqPromptStudent(null);
      setStudents((prev) => [...prev]);
    } catch (err) {
      console.warn('Error sending friend request:', err);
      showToast('Friend request bhejte waqt error aaya.');
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
    await cancelFriendRequest(user.id, toUserId);
    setSentRequests((prev) => prev.filter((r) => r.toId !== toUserId));
    showToast(`Request to ${toName} cancelled.`);
  };

  // Handle Accept Friend Request
  const handleAcceptRequest = async (req: FriendRequest) => {
    if (friends.length >= totalFriendLimit) {
      setShowFriendLimitModal(true);
      return;
    }
    await acceptFriendRequest(
      {
        id: user.id,
        name: user.name || 'Student',
        photoURL: user.photoURL || (user as any).avatarUrl,
      },
      {
        id: req.fromId,
        name: req.fromName,
        photoURL: req.fromPhoto,
      }
    );
    showToast(`🎉 ${req.fromName} ke sath dosti ho gayi! Chat unlock ho chuki hai.`);
    setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));
    // Auto open chat with new friend
    setSelectedContact({
      id: req.fromId,
      name: req.fromName,
      photoURL: req.fromPhoto,
      isOnline: true,
      statusText: 'Friend 🤝 · Chat unlocked',
    });
    setSelectedGroup(null);
  };

  // Handle Decline Friend Request
  const handleRejectRequest = async (req: FriendRequest) => {
    await rejectFriendRequest(user.id, req.fromId);
    setFriendRequests((prev) => prev.filter((r) => r.id !== req.id));
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
          senderName: replyingTo.senderName,
          text: replyingTo.text,
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

  // Handle Voice Note Simulation
  const handleToggleVoiceRecord = () => {
    const userPhoto = user.photoURL || (user as any).avatarUrl;
    if (isRecordingVoice) {
      clearInterval(recordingTimerRef.current);
      setIsRecordingVoice(false);
      const duration = Math.max(2, recordingSeconds);
      setRecordingSeconds(0);

      if (totalDailyMsgLimit !== Infinity) {
        const today = getTodayStr();
        const nextSent = dailyMessagesSent + 1;
        setDailyMessagesSent(nextSent);
        try {
          localStorage.setItem(`nsta_daily_msg_${user.id}_${today}`, String(nextSent));
        } catch {}
      }

      const voiceText = `🎙️ Voice Note (${duration}s)`;
      if (selectedContact) {
        sendPrivateMessage(
          user.id,
          user.name || 'Student',
          userPhoto,
          selectedContact.id,
          voiceText,
          'VOICE',
          { voiceDuration: duration }
        );
      } else if (selectedGroup) {
        sendGroupMessage(
          selectedGroup.id,
          user.id,
          user.name || 'Student',
          userPhoto,
          voiceText,
          'VOICE',
          { voiceDuration: duration }
        );
      }
    } else {
      if (totalDailyMsgLimit !== Infinity && dailyMessagesSent >= totalDailyMsgLimit) {
        setShowMessageLimitModal(true);
        return;
      }
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  // Handle Quick Attachment
  const handleSendQuickAttachment = (type: 'DOUBT' | 'NOTE' | 'MCQ', content: string) => {
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
    if (selectedContact) {
      sendPrivateMessage(
        user.id,
        user.name || 'Student',
        userPhoto,
        selectedContact.id,
        content,
        'DOUBT'
      );
    } else if (selectedGroup) {
      sendGroupMessage(
        selectedGroup.id,
        user.id,
        user.name || 'Student',
        userPhoto,
        content,
        'DOUBT'
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
      if (st.id === user.id) return false;
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
          if (!st.isOnline) return false;
        } else if (findFriendClassFilter === 'OFFLINE') {
          if (st.isOnline) return false;
        } else {
          const cl = (st.classLevel || '').toLowerCase();
          if (!cl.includes(findFriendClassFilter.toLowerCase())) {
            return false;
          }
        }
      }
      return true;
    });

    const onlineCount = students.filter((s) => s.id !== user.id && s.isOnline).length;
    const offlineCount = students.filter((s) => s.id !== user.id && !s.isOnline).length;
    const ultraCount = students.filter((s) => s.id !== user.id && getStudentSubscriptionTier(s) === 'ULTRA').length;
    const basicCount = students.filter((s) => s.id !== user.id && getStudentSubscriptionTier(s) === 'BASIC').length;
    const freeCount = students.filter((s) => s.id !== user.id && getStudentSubscriptionTier(s) === 'FREE').length;

    return (
      <div className="space-y-3 p-1">
        {/* Header Section */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <UserPlus size={15} />
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
              const isFriend = friends.some((f) => f.id === student.id);
              const isBlocked = isUserBlocked(student.id);
              const isSent = sentRequests.some((r) => r.toId === student.id);
              const incomingReq = friendRequests.find((r) => r.fromId === student.id);
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
                      {student.isOnline ? (
                        <div
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"
                          title="Online"
                        />
                      ) : (
                        <div
                          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-slate-400 border-2 border-white dark:border-slate-900 rounded-full"
                          title="Offline"
                        />
                      )}
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
                        {student.isOnline ? (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                            <span>Offline {student.lastSeen ? `• ${formatTime(student.lastSeen)}` : ''}</span>
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
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                        >
                          Chat 💬
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
                  onClick={() => setShowNewGroupModal(true)}
                  className="p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors"
                  title="New Study Group"
                >
                  <Plus size={20} />
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
                onClick={() => setActiveTab('FIND_FRIENDS')}
                className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors relative flex items-center justify-center gap-1.5 ${
                  activeTab === 'FIND_FRIENDS'
                    ? 'text-white border-b-2 border-emerald-400 bg-purple-950/40'
                    : 'text-purple-300/70 hover:text-white'
                }`}
              >
                <UserPlus size={14} />
                <span>STUDENTS</span>
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
                {selectedContact?.isOnline && (
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
                    selectedContact.isOnline ? (
                      <span className="text-emerald-400 font-semibold">online</span>
                    ) : (
                      'active on Nsta Messenger'
                    )
                  ) : (
                    `${selectedGroup?.memberCount || 1} members · tap for info`
                  )}
                </p>
              </div>
            </div>

            {/* Quick action buttons on chat header */}
            <div className="flex items-center gap-1">
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

              {/* Chat Lock Button (Snapchat-style locking) */}
              <button
                onClick={() => {
                  if (activeChatContextId) {
                    const locked = toggleChatLock(activeChatContextId);
                    setIsCurrentChatLocked(locked);
                    showToast(locked ? '🔒 Chat Locked with PIN' : '🔓 Chat Unlocked');
                  }
                }}
                className={`p-2 rounded-full hover:bg-white/10 transition-colors ${
                  isCurrentChatLocked ? 'bg-rose-500/25 text-rose-300' : 'text-white'
                }`}
                title={isCurrentChatLocked ? 'Chat Locked (Tap to Unlock)' : 'Lock Chat with PIN'}
              >
                {isCurrentChatLocked ? <Lock size={17} /> : <Unlock size={17} />}
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
                          if (activeChatContextId) {
                            const locked = toggleChatLock(activeChatContextId);
                            setIsCurrentChatLocked(locked);
                            showToast(locked ? '🔒 Chat Locked (PIN Protected)' : '🔓 Chat Unlocked');
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Lock size={14} className="text-indigo-500" />
                        <span>{isCurrentChatLocked ? 'Unlock Group' : 'Lock Group (PIN)'}</span>
                      </button>
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setShowChangePinModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <KeyRound size={14} className="text-slate-400" />
                        <span>Set / Change Chat PIN</span>
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

                      {/* Lock Chat / Snapchat Vanish Lock */}
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          if (activeChatContextId) {
                            const locked = toggleChatLock(activeChatContextId);
                            setIsCurrentChatLocked(locked);
                            showToast(locked ? '🔒 Chat Locked (PIN Protected)' : '🔓 Chat Unlocked');
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <Lock size={14} className="text-indigo-500" />
                        <span>{isCurrentChatLocked ? 'Unlock Chat' : 'Lock Chat (PIN)'}</span>
                      </button>

                      {/* Set / Change PIN */}
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          setShowChangePinModal(true);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                      >
                        <KeyRound size={14} className="text-slate-400" />
                        <span>Set / Change Chat PIN</span>
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

            {/* TAB 1: CONFIRMED CHATS (FRIENDS ONLY) */}
            {activeTab === 'CHATS' && (
              <div className="relative min-h-full pb-20">
                {/* Friend Quota Status Strip */}
                <div className="mx-4 mt-2.5 p-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                      🤝
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>Friends Quota:</span>
                        <span className="text-purple-700 dark:text-purple-300 font-black">
                          {friends.length} / {totalFriendLimit}
                        </span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 bg-purple-200/60 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 rounded">
                          {currentTier}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-500 dark:text-slate-400">
                        Free: 10 · Basic: 20 · Ultra: 40 friends
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFriendLimitModal(true)}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg shadow-sm active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>+10 Friends</span>
                  </button>
                </div>
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
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredFriends.map((contact) => {
                      const convId = getDirectConversationId(user.id, contact.id);
                      const isLocked = isChatLocked(convId);
                      const disTimer = getDisappearingTimer(convId);

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
                            {contact.isOnline && (
                              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                <span>{contact.name}</span>
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
                                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.2 rounded">
                                  Friend 🤝
                                </span>
                              </h4>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {contact.isOnline ? 'Online' : 'Active'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                              <CheckCheck size={14} className="text-purple-500 flex-shrink-0" />
                              <span>{contact.statusText || 'Tap to chat privately...'}</span>
                            </p>
                          </div>
                        </div>

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
                )}

                {/* Search Results: Classmates to send friend requests to */}
                {searchQuery.trim() && (
                  <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-900/50">
                    <div className="px-4 pb-2 flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <UserPlus size={13} />
                        <span>Classmates & Students (Friend Request Bhejein)</span>
                      </span>
                    </div>
                    {filteredStudents.filter((st) => st.id !== user.id && !friends.some((f) => f.id === st.id)).length === 0 ? (
                      <p className="text-center py-3 text-xs text-slate-400">
                        "{searchQuery}" se koi aur student nahi mila.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredStudents
                          .filter((st) => st.id !== user.id && !friends.some((f) => f.id === st.id))
                          .map((st) => {
                            const isBlocked = isUserBlocked(st.id);
                            const isSent = sentRequests.some((r) => r.toId === st.id);
                            const incomingReq = friendRequests.find((r) => r.fromId === st.id);
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
                                  ) : isSent ? (
                                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">Sent ⏳</span>
                                  ) : incomingReq ? (
                                    <button
                                      onClick={() => handleAcceptRequest(incomingReq)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                                    >
                                      Accept ✅
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSendFriendRequest(st)}
                                      disabled={isSending}
                                      className="px-2.5 py-1 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
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
                          const recipientStudent = students.find((s) => s.id === req.toId);
                          const recipientTier = recipientStudent ? getStudentSubscriptionTier(recipientStudent) : 'FREE';

                          return (
                          <div
                            key={req.id}
                            className={`p-3.5 rounded-2xl border shadow-sm flex items-center justify-between gap-3 ${
                              recipientTier === 'ULTRA'
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
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                                  ⏳ Request pending approval
                                </p>
                                <span className="text-[9px] text-slate-400">
                                  {formatTime(req.timestamp)}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleCancelSentRequest(req.toId, req.toName || 'User')}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-all border border-rose-200 dark:border-rose-900/50"
                            >
                              Cancel ✕
                            </button>
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
              {messages.map((msg) => {
                const isMe = isSameUser(msg.senderId, effectiveUserId);

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-3 py-2 shadow-xs relative text-slate-900 dark:text-white ${
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

                      {/* System Message */}
                      {msg.type === 'SYSTEM' ? (
                        <p className="text-[11px] italic text-center py-1 opacity-90">
                          {msg.text}
                        </p>
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
                      ) : (
                        <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}

                      {/* Footer: Timestamp, Disappearing status, and Read Receipts (Sent / Delivered / Seen) */}
                      <div className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${isMe ? 'text-white/80' : 'text-slate-400'}`}>
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
                        <div className="absolute -bottom-2 right-2 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-[11px] flex items-center gap-0.5">
                          {Object.values(msg.reactions).map((emoji, idx) => (
                            <span key={idx}>{emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Reaction & Action Bar on Hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-0.5 px-1.5 py-0.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs rounded-full shadow-sm border border-slate-200/60 dark:border-slate-700/60">
                      {['❤️', '👍', '😂', '👏', '💡'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="hover:scale-125 transition-transform text-xs p-0.5"
                        >
                          {emoji}
                        </button>
                      ))}

                      {/* Message Delete Action Button */}
                      {!msg.isDeletedForEveryone && (
                        <button
                          onClick={() => setDeletingMessage(msg)}
                          className="hover:scale-110 transition-transform text-xs p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full ml-1"
                          title="Message Delete Karein (For me / For everyone)"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Doubt / Notes Attachment Flyout */}
            {showAttachmentMenu && (
              <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto z-20">
                <button
                  onClick={() => handleSendQuickAttachment('DOUBT', '📐 Mujhe is question ke formula calculation me doubt hai. Koi step explain kar sakta hai?')}
                  className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-xl text-xs font-bold border border-amber-200 flex-shrink-0 flex items-center gap-1"
                >
                  <span>💡 Ask Doubt</span>
                </button>
                <button
                  onClick={() => handleSendQuickAttachment('NOTE', '📚 Chapter ke key short notes maine review kar liye hain. Kisi ko chahiye toh batayein!')}
                  className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-800 dark:text-blue-200 rounded-xl text-xs font-bold border border-blue-200 flex-shrink-0 flex items-center gap-1"
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
              {/* Daily Message Quota Status */}
              {totalDailyMsgLimit !== Infinity ? (
                <div className="flex items-center justify-between pb-2 mb-1 px-1 text-[11px] border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <span>💬 Daily Quota:</span>
                    <span className={dailyMessagesSent >= totalDailyMsgLimit ? 'text-rose-600 font-black' : 'text-purple-700 dark:text-purple-300 font-bold'}>
                      {dailyMessagesSent} / {totalDailyMsgLimit} msgs
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded font-semibold">
                      {currentTier}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMessageLimitModal(true)}
                    className="text-purple-700 dark:text-purple-300 hover:text-purple-900 dark:hover:text-purple-100 text-[10px] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>+10 Limit (100 🪙 / 10 💎)</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between pb-1.5 mb-1 px-1 text-[10px] border-b border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                  <span className="flex items-center gap-1">
                    <Crown size={12} className="text-amber-500" />
                    <span>Ultra Plan · Unlimited Daily Messages</span>
                  </span>
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
              ) : isRecordingVoice ? (
                <div className="flex items-center justify-between px-3 py-2 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">
                      Recording Voice... ({recordingSeconds}s)
                    </span>
                  </div>
                  <button
                    onClick={handleToggleVoiceRecord}
                    className="px-3 py-1 bg-gradient-to-r from-rose-600 to-red-600 hover:opacity-90 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    Send Voice
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 text-slate-500 hover:text-purple-600 transition-colors"
                    title="Emojis"
                  >
                    <Smile size={20} />
                  </button>

                  <button
                    onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    className="p-2 text-slate-500 hover:text-purple-600 transition-colors"
                    title="Share Doubt or Notes"
                  >
                    <Paperclip size={20} />
                  </button>

                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                      }}
                      placeholder={
                        selectedGroup
                          ? `Message ${selectedGroup.name}...`
                          : `Message ${selectedContact?.name.split(' ')[0]}...`
                      }
                      className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl px-4 py-2 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>

                  {inputText.trim() ? (
                    <button
                      onClick={handleSendMessage}
                      className="w-10 h-10 rounded-full bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 flex-shrink-0"
                      title="Send"
                    >
                      <Send size={18} className="ml-0.5" />
                    </button>
                  ) : (
                    <button
                      onClick={handleToggleVoiceRecord}
                      className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 flex-shrink-0"
                      title="Record Voice Note"
                    >
                      <Mic size={18} />
                    </button>
                  )}
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
                  Free: 50/day · Basic: 200/day · Ultra: Unlimited
                </div>
              </div>

              {/* Expansion Deal Box */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-slate-900 border border-purple-200 dark:border-purple-800/60 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-xs text-purple-900 dark:text-purple-200 uppercase tracking-wide">
                    <Zap size={14} className="text-amber-500" />
                    <span>+10 Daily Messages Unlock Karein</span>
                  </div>
                  <span className="text-[10px] font-black px-1.5 py-0.5 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded-md">
                    Instant
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
                  <span className={userDiamonds >= 10 ? 'text-cyan-600 dark:text-cyan-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    💎 {userDiamonds} Diamonds
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
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
                  <span>100 Credits se Unlock Karein (+10 Messages)</span>
                </button>

                {/* Option 2: 10 Diamonds */}
                <button
                  type="button"
                  onClick={() => handleExpandLimit('MESSAGE', 'DIAMONDS')}
                  disabled={isExpandingLimit || userDiamonds < 10}
                  className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    userDiamonds >= 10
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Gem size={14} />
                  <span>10 Diamonds se Unlock Karein (+10 Messages)</span>
                </button>

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
                  Free: 10 friends · Basic: 20 friends · Ultra: 40 friends
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
                    Permanent
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
                  <span className={userDiamonds >= 10 ? 'text-cyan-600 dark:text-cyan-400 font-black' : 'text-rose-600 dark:text-rose-400 font-black'}>
                    💎 {userDiamonds} Diamonds
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
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

                {/* Option 2: 10 Diamonds */}
                <button
                  type="button"
                  onClick={() => handleExpandLimit('FRIEND', 'DIAMONDS')}
                  disabled={isExpandingLimit || userDiamonds < 10}
                  className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    userDiamonds >= 10
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white cursor-pointer'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  <Gem size={14} />
                  <span>10 Diamonds se Unlock Karein (+10 Friends)</span>
                </button>

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
                {/* Delete for everyone (Allowed if sender is current user or group creator) */}
                {(deletingMessage.senderId === user.id || selectedGroup?.creatorId === user.id) && (
                  <button
                    onClick={() => handleDeleteMessage('FOR_EVERYONE')}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Ban size={15} />
                    <span>Delete for Everyone (Sabke liye delete karein)</span>
                  </button>
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
                  { label: 'Snapchat Vanish Mode', ms: -1, desc: 'Chat dekhne (seen) ke baad aur back jane par turant delete!' },
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

        {/* ─── MODAL 3: CHAT LOCK PIN PROMPT (SNAPCHAT STYLE LOCKING) ─────── */}
        {showPinModal && (
          <div className="fixed inset-0 z-[380] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Lock size={30} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">Chat Locked 🔒</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Yeh chat PIN se protected hai. Khodne ke liye 4-digit PIN darj karein:
                </p>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5">
                  (Default PIN: 1234)
                </p>
              </div>

              <div className="py-2">
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyPin();
                  }}
                  placeholder="• • • •"
                  className="w-36 text-center text-2xl tracking-[0.4em] font-bold py-2.5 px-4 bg-slate-100 dark:bg-slate-800 border-2 border-purple-400 dark:border-purple-600 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 mx-auto block"
                  autoFocus
                />
                {pinError && (
                  <p className="text-xs text-rose-500 font-bold mt-2 animate-bounce">
                    {pinError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleVerifyPin}
                  className="w-full py-2.5 bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <Unlock size={14} />
                  <span>Chat Unlock Karein</span>
                </button>
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPendingUnlockContext(null);
                    setPinInput('');
                    setPinError(null);
                  }}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── MODAL 4: SET / CHANGE CHAT PIN ─────────────────────────── */}
        {showChangePinModal && (
          <div className="fixed inset-0 z-[380] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in fade-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound size={26} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Set / Change Chat PIN</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Locked chats ko kholne ke liye naya 4-digit PIN banayein:
                </p>
              </div>

              <div className="py-1">
                <input
                  type="password"
                  maxLength={4}
                  value={newPinInput}
                  onChange={(e) => {
                    setNewPinInput(e.target.value);
                    setNewPinError(null);
                  }}
                  placeholder="Naya 4-Digit PIN"
                  className="w-40 text-center text-xl tracking-[0.3em] font-bold py-2.5 px-3 bg-slate-100 dark:bg-slate-800 border-2 border-indigo-400 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mx-auto block"
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
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  Save Naya PIN
                </button>
                <button
                  onClick={() => {
                    setShowChangePinModal(false);
                    setNewPinInput('');
                    setNewPinError(null);
                  }}
                  className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Also export alias as NstaMessengerModal for seamless modern naming
export const NstaMessengerModal = WhatsAppChatModal;
