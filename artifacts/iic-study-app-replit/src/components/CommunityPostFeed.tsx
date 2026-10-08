import React, { useState, useEffect, useRef } from 'react';
import {
  Image,
  Send,
  Heart,
  MessageCircle,
  Share2,
  Trash2,
  X,
  Sparkles,
  Camera,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Globe,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Crown,
  Zap,
  Shield,
  Crop,
  Download,
  ArrowLeft,
  Megaphone,
  Flag,
  Edit3,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  Lightbulb,
  Eye,
  Clock,
  ShieldCheck,
  MessageSquare,
  Video,
  Wrench,
  Rocket,
} from 'lucide-react';
import { ref, onValue, set, remove, push, update } from 'firebase/database';
import {
  rtdb,
  subscribeSuggestions,
  saveSuggestion,
  adminReplySuggestion,
  resolvesuggestion,
  markSuggestionOpenedByAdmin,
  deleteSuggestion,
  reactToSuggestion,
} from '../firebase';
import { uploadImageToImgBB, compressImage } from '../services/imgbbService';
import { uploadToCloudinary, getOptimizedVideoUrl } from '../services/cloudinaryService';
import { resolveTelegramUrl } from '../services/telegramStorageService';
import { ImageCropper } from './ImageCropper';
import { GuestRestrictionModal } from './GuestRestrictionModal';
import { notifyCommunityUpdateInBackground } from './NotificationManager';
import { User } from '../types';
import { useAppTheme } from '../utils/themeContext';
import { getLevelInfo } from '../utils/levelSystem';

export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userRole?: string;
  userTier?: 'FREE' | 'BASIC' | 'ULTRA' | string;
  text: string;
  imageUrl?: string;
  createdAt: number;
}

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userRole?: string;
  userTier?: 'FREE' | 'BASIC' | 'ULTRA' | string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  isHd?: boolean;
  language?: string;
  isOfficial?: boolean;
  category?: string;
  createdAt: number;
  likes?: Record<string, boolean>; // userId -> true
  comments?: Record<string, PostComment>;
  reports?: Record<string, { userId: string; userName?: string; reason?: string; createdAt: number }>;
  status?: 'ACTIVE' | 'UNDER_REVIEW' | 'APPROVED' | 'RESOLVED' | 'REPLIED' | string;
  underReviewAt?: number;
  verifiedBy?: string;
  verifiedAt?: number;
  isEdited?: boolean;
  editedAt?: number;
  isSuggestionItem?: boolean;
  originalSuggestionId?: string;
  adminReply?: string;
  adminReplyAt?: string;
  adminTag?: string;
  adminOpened?: boolean;
  adminOpenedAt?: string;
  lessonTitle?: string;
  pageNo?: string | number;
}

interface CommunityPostFeedProps {
  user: User;
  isAdmin?: boolean;
  onClose?: () => void;
  isEmbedded?: boolean;
  initialFilter?: FilterType;
  externalSearchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  externalShowComposer?: boolean;
  onShowComposerChange?: (show: boolean) => void;
  onUserUpdate?: (user: User) => void;
  onSwitchToTools?: () => void;
  onSwitchToInfo?: () => void;
  communityBackgroundImage?: string;
  communityBackgroundOpacity?: number;
}

type FilterType = 'ALL' | 'OFFICIAL' | 'BUG_REPORT' | 'DOUBT' | 'MINE' | 'UNDER_REVIEW' | 'NOTES_FIX';

export const CommunityPostFeed: React.FC<CommunityPostFeedProps> = ({
  user,
  isAdmin = false,
  isEmbedded = false,
  initialFilter,
  onClose,
  externalSearchQuery,
  onSearchQueryChange,
  externalShowComposer,
  onShowComposerChange,
  onUserUpdate,
  onSwitchToTools,
  onSwitchToInfo,
  communityBackgroundImage,
  communityBackgroundOpacity,
}) => {
  const isGuestUser = !user?.email && user?.provider !== 'email' && user?.provider !== 'google' && !!(user?.isGuest || user?.isAnonymous || user?.role === 'GUEST');
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [guestModalContext, setGuestModalContext] = useState('Community Interaction');
  const { appTheme } = useAppTheme();
  const isAdminOrSubUser =
    isAdmin ||
    user.role === 'ADMIN' ||
    user.role === 'SUB_ADMIN' ||
    user.role === 'SUBADMIN' ||
    user.role?.toLowerCase() === 'admin' ||
    user.role?.toLowerCase() === 'subadmin';

  // All community features are permanently unlocked (Level Roadmap removed)
  const isBugReportUnlocked = true;
  const isDoubtUnlocked = true;
  const isPostsUnlocked = true;

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter || 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Creator State
  const [postText, setPostText] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [isHdQuality, setIsHdQuality] = useState(false);
  const [isOfficialPost, setIsOfficialPost] = useState(false);
  const [postCategory, setPostCategory] = useState<'GENERAL' | 'DOUBT' | 'BUG_REPORT'>('GENERAL');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCroppingPostImage, setIsCroppingPostImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  // Notes Fix / Suggestions integration state
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [adminReplyPostId, setAdminReplyPostId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState<string>('');
  const [inlineAdminReplyInputs, setInlineAdminReplyInputs] = useState<Record<string, string>>({});
  const [adminReplyStatus, setAdminReplyStatus] = useState<'open' | 'replied' | 'resolved'>('resolved');
  const [adminReplyTag, setAdminReplyTag] = useState<string>('Galti Sudhar Di');
  const [isSubmittingAdminReply, setIsSubmittingAdminReply] = useState<boolean>(false);

  const isComposerOpen = externalShowComposer !== undefined ? externalShowComposer : showComposer;
  const setComposerOpen = (val: boolean) => {
    if (val && isGuestUser) {
      setGuestModalContext('Community Post Creation');
      setGuestModalOpen(true);
      return;
    }
    setShowComposer(val);
    onShowComposerChange?.(val);
  };

  // Active Expanded Comments (Set of postIds)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<Record<string, boolean>>({});
  const [commentImageFiles, setCommentImageFiles] = useState<Record<string, File | null>>({});
  const [commentImagePreviews, setCommentImagePreviews] = useState<Record<string, string | null>>({});
  const [croppingCommentPostId, setCroppingCommentPostId] = useState<string | null>(null);

  // Fullscreen Image Lightbox
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Status Alerts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Report Modal State
  const [reportingPost, setReportingPost] = useState<CommunityPost | null>(null);
  const [reportReason, setReportReason] = useState<string>('Inappropriate / Abusive content');
  const [reportCustomNote, setReportCustomNote] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);

  // Edit Post Modal State
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [editCategory, setEditCategory] = useState<'GENERAL' | 'DOUBT' | 'BUG_REPORT'>('GENERAL');
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [isEditHd, setIsEditHd] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const userTier: 'FREE' | 'BASIC' | 'ULTRA' =
    user.isPremium && user.subscriptionLevel === 'ULTRA'
      ? 'ULTRA'
      : user.isPremium
      ? 'BASIC'
      : 'FREE';

  // Listen to RTDB community_posts
  useEffect(() => {
    setLoading(true);
    const postsRef = ref(rtdb, 'community_posts');
    const unsubscribe = onValue(
      postsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rawData = snapshot.val();
          const parsed: CommunityPost[] = Object.entries(rawData).map(([id, val]: [string, any]) => ({
            id,
            ...val,
          }));
          // Sort newest first
          parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setPosts(parsed);
        } else {
          setPosts([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[CommunityPostFeed] Error fetching posts:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen to RTDB suggestions for Notes Fix integration
  useEffect(() => {
    const unsub = subscribeSuggestions((items) => {
      setSuggestions(items || []);
    });
    return () => unsub();
  }, []);

  // Auto-mark suggestions as opened by Admin when viewed in NOTES_FIX filter
  useEffect(() => {
    if (!isAdminOrSubUser || activeFilter !== 'NOTES_FIX') return;
    suggestions.forEach((s) => {
      if (!s.adminOpened && s.id) {
        markSuggestionOpenedByAdmin(s.id).catch(() => {});
      }
    });
  }, [isAdminOrSubUser, activeFilter, suggestions]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Image Selection Handler
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: max 10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('⚠️ Image size maximum 10MB honi chahiye!');
      return;
    }

    setSelectedImageFile(file);
    const preview = URL.createObjectURL(file);
    setImagePreviewUrl(preview);
    setShowComposer(true);
  };

  const handleClearImage = () => {
    setSelectedImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsCroppingPostImage(false);
    setIsHdQuality(false);
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB Telegram Cloud storage limit
    if (file.size > MAX_VIDEO_SIZE) {
      showToast('⚠️ Video size maximum 50MB tak ho sakti hai (Cloud storage limit 50MB hai)!');
      return;
    }
    setSelectedVideoFile(file);
    const preview = URL.createObjectURL(file);
    setVideoPreviewUrl(preview);
    setShowComposer(true);
  };

  const handleClearVideo = () => {
    setSelectedVideoFile(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
    setVideoUploadProgress(0);
  };

  const handleCropPostImageComplete = async (croppedBase64: string) => {
    try {
      const res = await fetch(croppedBase64);
      const blob = await res.blob();
      const fileName = selectedImageFile ? `cropped_${selectedImageFile.name}` : `cropped_${Date.now()}.jpg`;
      const newFile = new File([blob], fileName, { type: 'image/jpeg' });
      setSelectedImageFile(newFile);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      const newPreview = URL.createObjectURL(newFile);
      setImagePreviewUrl(newPreview);
      setIsCroppingPostImage(false);
      showToast('✂️ Photo crop ho gayi!');
    } catch (err) {
      console.error('Crop failed:', err);
      setIsCroppingPostImage(false);
    }
  };

  // Submit Post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuestUser) {
      setGuestModalContext('Community Post Creation');
      setGuestModalOpen(true);
      return;
    }
    if (!postText.trim() && !selectedImageFile && !selectedVideoFile) {
      showToast('⚠️ Kripya kuch text likhein, photo ya video attach karein!');
      return;
    }

    setIsSubmitting(true);
    let uploadedImageUrl = '';
    let uploadedVideoUrl = '';

    try {
      if (selectedImageFile) {
        setIsUploadingImage(true);
        try {
          uploadedImageUrl = await uploadImageToImgBB(
            selectedImageFile,
            `post_${user.id}_${Date.now()}`,
            { isHd: isHdQuality }
          );
        } catch (imgErr) {
          console.warn('[CommunityPostFeed] Telegram image upload failed, falling back to local compressed:', imgErr);
          try {
            uploadedImageUrl = await compressImage(selectedImageFile, 960, 960, 0.75);
          } catch {}
        }
        setIsUploadingImage(false);
      }

      if (selectedVideoFile) {
        setIsUploadingVideo(true);
        setVideoUploadProgress(1);
        try {
          const cloudRes = await uploadToCloudinary(selectedVideoFile, 'video', (pct) => {
            setVideoUploadProgress(pct);
          });
          uploadedVideoUrl = cloudRes.secure_url || cloudRes.url;
        } catch (vidErr: any) {
          let vMsg = vidErr?.message || 'Video upload fail ho gaya';
          if (
            vMsg.includes('Unexpected end of JSON') ||
            vMsg.includes('Failed to execute') ||
            vMsg.includes('SyntaxError')
          ) {
            vMsg = 'Storage server se response nahi mila. Kripya apna internet connection check karein ya chhota video upload karein.';
          }
          throw new Error(vMsg);
        } finally {
          setIsUploadingVideo(false);
        }
      }

      const postsRef = ref(rtdb, 'community_posts');
      const newPostRef = push(postsRef);
      const newPostId = newPostRef.key;

      if (!newPostId) {
        throw new Error('Failed to generate post ID');
      }

      const isOfficialAnnouncement = isOfficialPost || (isAdminOrSubUser && isOfficialPost);

      const newPostData: Record<string, any> = {
        userId: user.id || 'anonymous',
        userName: user.name || 'Anonymous Student',
        userPhoto: user.photoURL || '',
        userRole: user.role || 'STUDENT',
        userTier: userTier || 'FREE',
        text: postText.trim(),
        createdAt: Date.now(),
        category: isOfficialAnnouncement ? 'OFFICIAL' : postCategory,
        ...(isHdQuality ? { isHd: true } : {}),
        ...(isOfficialAnnouncement ? { isOfficial: true } : {}),
      };

      if (uploadedImageUrl && uploadedImageUrl.trim()) {
        newPostData.imageUrl = uploadedImageUrl.trim();
      }
      if (uploadedVideoUrl && uploadedVideoUrl.trim()) {
        newPostData.videoUrl = uploadedVideoUrl.trim();
      }

      await set(newPostRef, newPostData);

      // Also register into suggestions for coins & admin resolution tracking
      if (postCategory === 'NOTES_FIX') {
        try {
          await saveSuggestion({
            id: newPostId,
            text: postText.trim(),
            imageUrl: (uploadedImageUrl && uploadedImageUrl.trim()) ? uploadedImageUrl.trim() : undefined,
            uid: user.id || 'anonymous',
            userName: user.name || 'Anonymous Student',
            createdAt: new Date().toISOString(),
            lessonTitle: 'Community Notes Fix',
          });
        } catch (suggErr) {
          console.warn('Sync to suggestion error (non-fatal):', suggErr);
        }
      }

      // Reset Form
      setPostText('');
      handleClearImage();
      handleClearVideo();
      setIsHdQuality(false);
      setIsOfficialPost(false);
      setPostCategory('GENERAL');
      setComposerOpen(false);
      showToast('🎉 Aapka post safaltapoorvak publish ho gaya!');
    } catch (err: any) {
      console.error('[CommunityPostFeed] Post creation failed:', err);
      let errMsg = err?.message || 'Error';
      if (
        errMsg.includes('Unexpected end of JSON') ||
        errMsg.includes('Failed to execute') ||
        errMsg.includes('SyntaxError')
      ) {
        errMsg = 'Storage server se response nahi mila. Kripya apna internet connection check karein ya chhota file upload karein.';
      }
      showToast(`❌ Post upload fail ho gaya: ${errMsg}`);
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
      setIsUploadingVideo(false);
    }
  };

  // Toggle Like Handler
  const handleToggleLike = async (post: CommunityPost) => {
    if (isGuestUser) {
      setGuestModalContext('Post Like Karna');
      setGuestModalOpen(true);
      return;
    }
    if (post.id.startsWith('sugg_')) {
      const suggId = post.id.replace('sugg_', '');
      await reactToSuggestion(suggId, user.id, 'like');
      return;
    }

    const isLiked = !!(post.likes && post.likes[user.id]);
    const likeRef = ref(rtdb, `community_posts/${post.id}/likes/${user.id}`);

    try {
      if (isLiked) {
        await remove(likeRef);
      } else {
        await set(likeRef, true);
      }
    } catch (err) {
      console.error('[CommunityPostFeed] Error updating like:', err);
    }
  };

  // Admin Submit Inline Reply for Notes Fix
  const handleAdminSubmitReply = async (post: CommunityPost) => {
    const textToSubmit = ((typeof inlineAdminReplyInputs !== 'undefined' && inlineAdminReplyInputs ? inlineAdminReplyInputs[post.id] : '') || adminReplyText || '').trim();
    if (!textToSubmit) {
      showToast('⚠️ Kripya reply text likhein!');
      return;
    }
    const suggId = post.originalSuggestionId || (post.isSuggestionItem ? post.id.replace('sugg_', '') : post.id);
    setIsSubmittingAdminReply(true);
    try {
      if (post.isSuggestionItem || post.originalSuggestionId) {
        await adminReplySuggestion(suggId, textToSubmit, adminReplyTag, adminReplyStatus);
      } else {
        const postRef = ref(rtdb, `community_posts/${post.id}`);
        await update(postRef, {
          adminReply: textToSubmit,
          adminReplyAt: new Date().toISOString(),
          adminTag: adminReplyTag,
          status: adminReplyStatus === 'resolved' ? 'RESOLVED' : 'REPLIED',
        });
      }
      showToast('✅ Admin reply safaltapoorvak bhej diya gaya!');
      setAdminReplyPostId(null);
      setAdminReplyText('');
      setInlineAdminReplyInputs((prev) => ({ ...prev, [post.id]: '' }));
    } catch (e: any) {
      console.error('Error sending admin reply:', e);
      showToast('❌ Reply bhejne me error aaya: ' + (e.message || ''));
    } finally {
      setIsSubmittingAdminReply(false);
    }
  };

  // Admin Quick Resolve for Notes Fix
  const handleAdminResolveDirect = async (post: CommunityPost) => {
    const suggId = post.originalSuggestionId || (post.isSuggestionItem ? post.id.replace('sugg_', '') : post.id);
    try {
      if (post.isSuggestionItem || post.originalSuggestionId) {
        await resolvesuggestion(suggId);
      }
      const postRef = ref(rtdb, `community_posts/${post.id.replace('sugg_', '')}`);
      await update(postRef, { status: 'RESOLVED' }).catch(() => {});
      showToast('🎯 Galti Resolve mark ho gayi!');
    } catch (e: any) {
      console.error('Error resolving:', e);
      showToast('❌ Error marking resolved');
    }
  };

  // Toggle Comments Drawer
  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  // Comment Image Selection Handler
  const handleCommentImageSelect = (postId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('⚠️ Image size maximum 10MB honi chahiye!');
      return;
    }

    if (commentImagePreviews[postId]) {
      URL.revokeObjectURL(commentImagePreviews[postId]!);
    }

    const preview = URL.createObjectURL(file);
    setCommentImageFiles((prev) => ({ ...prev, [postId]: file }));
    setCommentImagePreviews((prev) => ({ ...prev, [postId]: preview }));
    e.target.value = '';
  };

  const handleClearCommentImage = (postId: string) => {
    if (commentImagePreviews[postId]) {
      URL.revokeObjectURL(commentImagePreviews[postId]!);
    }
    setCommentImageFiles((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setCommentImagePreviews((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
  };

  const handleCropCommentImageComplete = async (croppedBase64: string) => {
    if (!croppingCommentPostId) return;
    const postId = croppingCommentPostId;
    try {
      const res = await fetch(croppedBase64);
      const blob = await res.blob();
      const origFile = commentImageFiles[postId];
      const fileName = origFile ? `cropped_${origFile.name}` : `cropped_comment_${Date.now()}.jpg`;
      const newFile = new File([blob], fileName, { type: 'image/jpeg' });

      if (commentImagePreviews[postId]) {
        URL.revokeObjectURL(commentImagePreviews[postId]!);
      }
      const newPreview = URL.createObjectURL(newFile);
      setCommentImageFiles((prev) => ({ ...prev, [postId]: newFile }));
      setCommentImagePreviews((prev) => ({ ...prev, [postId]: newPreview }));
      setCroppingCommentPostId(null);
      showToast('✂️ Comment photo crop ho gayi!');
    } catch (err) {
      console.error('Crop comment image failed:', err);
      setCroppingCommentPostId(null);
    }
  };

  // Submit Comment
  const handleAddComment = async (postId: string) => {
    if (isGuestUser) {
      setGuestModalContext('Comment Karna');
      setGuestModalOpen(true);
      return;
    }
    const text = (commentInputs[postId] || '').trim();
    const imageFile = commentImageFiles[postId];
    if (!text && !imageFile) return;

    const targetPost = allCommunityPosts.find((p) => p.id === postId);
    if (targetPost && isPostNotesFix(targetPost)) {
      showToast('⚠️ Notes Fix reports par comments allowed nahi hain.');
      return;
    }

    setIsSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      let uploadedImageUrl = '';
      if (imageFile) {
        try {
          uploadedImageUrl = await uploadImageToImgBB(
            imageFile,
            `comment_${user.id}_${Date.now()}`
          );
        } catch (cImgErr) {
          console.warn('[CommunityPostFeed] Comment image upload fallback:', cImgErr);
          try {
            uploadedImageUrl = await compressImage(imageFile, 800, 800, 0.72);
          } catch {}
        }
      }

      const commentsRef = ref(rtdb, `community_posts/${postId}/comments`);
      const newCommentRef = push(commentsRef);
      const commentId = newCommentRef.key;

      if (!commentId) throw new Error('Failed to generate comment ID');

      const commentData: Record<string, any> = {
        id: commentId,
        userId: user.id || 'anonymous',
        userName: user.name || 'Student',
        userPhoto: user.photoURL || '',
        userRole: user.role || 'STUDENT',
        userTier: userTier || 'FREE',
        text,
        createdAt: Date.now(),
      };

      if (uploadedImageUrl && uploadedImageUrl.trim()) {
        commentData.imageUrl = uploadedImageUrl.trim();
      }

      await set(newCommentRef, commentData);

      if (targetPost?.userId && targetPost.userId !== user.id) {
        void notifyCommunityUpdateInBackground({
          recipientIds: [targetPost.userId],
          senderId: user.id,
          senderName: user.name || 'NSTA Student',
          body: `${user.name || 'Kisi student'} ne aapke community post par comment kiya hai.`,
          url: '/?open=community',
        });
      }

      // Clear input & image preview
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      handleClearCommentImage(postId);
    } catch (err: any) {
      console.error('[CommunityPostFeed] Error adding comment:', err);
      showToast('❌ Comment bhejna fail ho gaya');
    } finally {
      setIsSubmittingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  // Delete Post (Author or Admin)
  const handleDeletePost = async (postId: string, postUserId: string) => {
    const canDelete = isAdmin || user.role === 'ADMIN' || user.role === 'SUB_ADMIN' || user.id === postUserId;
    if (!canDelete) {
      showToast('⚠️ Aap sirf apna hi post delete kar sakte hain!');
      return;
    }

    if (window.confirm('Kya aap is post ko delete karna chahte hain?')) {
      try {
        if (postId.startsWith('sugg_')) {
          await deleteSuggestion(postId.replace('sugg_', ''));
        } else {
          await remove(ref(rtdb, `community_posts/${postId}`));
        }
        showToast('🗑️ Post delete ho gaya');
      } catch (err) {
        console.error('[CommunityPostFeed] Error deleting post:', err);
        showToast('❌ Post delete nahi ho paya');
      }
    }
  };

  // Delete Comment (Author or Admin)
  const handleDeleteComment = async (postId: string, commentId: string, commentUserId: string) => {
    const canDelete = isAdmin || user.role === 'ADMIN' || user.role === 'SUB_ADMIN' || user.id === commentUserId;
    if (!canDelete) return;

    try {
      await remove(ref(rtdb, `community_posts/${postId}/comments/${commentId}`));
    } catch (err) {
      console.error('[CommunityPostFeed] Error deleting comment:', err);
    }
  };

  // Check if post is under review (3+ reports or status is UNDER_REVIEW)
  const isPostUnderReview = (post: CommunityPost) => {
    const reportCount = Object.keys(post.reports || {}).length;
    return post.status === 'UNDER_REVIEW' || (reportCount >= 3 && post.status !== 'APPROVED');
  };

  const underReviewPostsCount = posts.filter(isPostUnderReview).length;

  // Open Report Dialog
  const handleOpenReport = (post: CommunityPost) => {
    if (post.userId === user.id) {
      showToast('⚠️ Aap apna khud ka post report nahi kar sakte!');
      return;
    }
    const alreadyReported = Boolean(post.reports && post.reports[user.id]);
    if (alreadyReported) {
      showToast('⚠️ Aap is post ko pehle hi report kar chuke hain.');
      return;
    }
    setReportingPost(post);
    setReportReason('Inappropriate / Abusive content');
    setReportCustomNote('');
  };

  // Submit Report Handler
  const handleSubmitReport = async () => {
    if (!reportingPost) return;
    setIsSubmittingReport(true);
    try {
      const postRef = ref(rtdb, `community_posts/${reportingPost.id}`);
      const currentReports = reportingPost.reports || {};
      const newReports = {
        ...currentReports,
        [user.id]: {
          userId: user.id,
          userName: user.name || 'Student',
          reason: reportCustomNote.trim()
            ? `${reportReason} - ${reportCustomNote.trim()}`
            : reportReason,
          createdAt: Date.now(),
        },
      };
      const totalReports = Object.keys(newReports).length;
      const updates: Record<string, any> = {
        reports: newReports,
      };

      // When 3 or more reports are accumulated, send to review mode
      if (totalReports >= 3 && reportingPost.status !== 'APPROVED') {
        updates.status = 'UNDER_REVIEW';
        updates.underReviewAt = Date.now();
      }

      await update(postRef, updates);

      if (totalReports >= 3) {
        showToast('⚠️ Is post par 3 reports aayi hain. Yeh Review Mode me chala gaya hai aur Admin verify karega tabhi dikhega.');
      } else {
        showToast(`🚩 Post report ho gaya (${totalReports}/3 reports). Hamari team review karegi.`);
      }
      setReportingPost(null);
    } catch (err: any) {
      console.error('[CommunityPostFeed] Error submitting report:', err);
      showToast('❌ Report bhejne me error aaya: ' + (err.message || 'Error'));
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Admin Verify & Approve Post Handler
  const handleVerifyPost = async (post: CommunityPost) => {
    if (!isAdminOrSubUser) return;
    try {
      const postRef = ref(rtdb, `community_posts/${post.id}`);
      await update(postRef, {
        status: 'APPROVED',
        verifiedBy: user.name || 'Admin',
        verifiedAt: Date.now(),
        reports: null, // Clear reports so post is fully approved and clean
      });
      showToast('✅ Post verify ho gaya! Ab yeh sabhi students ko dikhega.');
    } catch (err: any) {
      console.error('[CommunityPostFeed] Error verifying post:', err);
      showToast('❌ Post verify karne me error aaya');
    }
  };

  // Start Edit Post Handler
  const handleStartEdit = (post: CommunityPost) => {
    if (post.userId !== user.id && !isAdminOrSubUser) {
      showToast('⚠️ Aap sirf apna hi post edit kar sakte hain!');
      return;
    }
    setEditingPost(post);
    setEditText(post.text || '');
    setEditCategory(
      post.category === 'DOUBT'
        ? 'DOUBT'
        : post.category === 'BUG_REPORT'
        ? 'BUG_REPORT'
        : 'GENERAL'
    );
    setIsEditHd(post.isHd || false);
    setEditImageFile(null);
    setEditImagePreview(post.imageUrl || null);
  };

  // Edit Image Selection Handler
  const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('⚠️ Image size maximum 10MB honi chahiye!');
      return;
    }
    setEditImageFile(file);
    const preview = URL.createObjectURL(file);
    setEditImagePreview(preview);
    e.target.value = '';
  };

  // Remove Image during Edit
  const handleRemoveEditImage = () => {
    setEditImageFile(null);
    if (editImagePreview && editImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreview);
    }
    setEditImagePreview(null);
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
  };

  // Save Post Edits
  const handleSaveEdit = async () => {
    if (!editingPost) return;
    if (!editText.trim() && !editImagePreview && !editImageFile) {
      showToast('⚠️ Post me text ya photo hona zaroori hai!');
      return;
    }
    setIsSavingEdit(true);
    try {
      let finalImageUrl = editImagePreview;
      if (editImageFile) {
        try {
          finalImageUrl = await uploadImageToImgBB(
            editImageFile,
            `edit_${user.id}_${Date.now()}`,
            { isHd: isEditHd }
          );
        } catch (eImgErr) {
          console.warn('[CommunityPostFeed] Edit image upload fallback:', eImgErr);
          try {
            finalImageUrl = await compressImage(editImageFile, 960, 960, 0.75);
          } catch {}
        }
      }
      const postRef = ref(rtdb, `community_posts/${editingPost.id}`);
      const updates: Record<string, any> = {
        text: editText.trim(),
        category: editCategory,
        imageUrl: finalImageUrl || null,
        isEdited: true,
        editedAt: Date.now(),
        ...(isEditHd ? { isHd: true } : { isHd: null }),
      };
      await update(postRef, updates);
      showToast('✏️ Aapka post safaltapoorvak update ho gaya!');
      setEditingPost(null);
    } catch (err: any) {
      console.error('[CommunityPostFeed] Error updating post:', err);
      showToast('❌ Post update fail ho gaya: ' + (err.message || 'Error'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Check if post is Official (by Admin or SubAdmin or marked official)
  const isPostOfficial = (post: CommunityPost) => {
    const role = (post.userRole || '').toUpperCase();
    const tier = (post.userTier || '').toUpperCase();
    const name = (post.userName || '').toLowerCase();
    return (
      post.isOfficial === true ||
      post.category === 'OFFICIAL' ||
      role === 'ADMIN' ||
      role === 'SUB_ADMIN' ||
      role === 'SUBADMIN' ||
      tier === 'ADMIN' ||
      name.includes('admin') ||
      name.includes('iic official')
    );
  };

  const isPostNotesFix = (post: CommunityPost) => {
    if (
      post.category === 'NOTES_FIX' ||
      post.category === 'NOTE_CORRECTION' ||
      post.category === 'SUGGESTION' ||
      post.isSuggestionItem
    ) return true;
    const txt = (post.text || '').toLowerCase();
    return (
      txt.includes('note fix') ||
      txt.includes('notes fix') ||
      txt.includes('fix note') ||
      txt.includes('fix notes') ||
      txt.includes('correction') ||
      txt.includes('galti') ||
      txt.includes('mistake') ||
      txt.includes('spelling') ||
      txt.includes('page no')
    );
  };

  const isPostBugReport = (post: CommunityPost) => {
    if (
      post.category === 'BUG_REPORT' ||
      post.category === 'BUG'
    ) return true;
    const txt = (post.text || '').toLowerCase();
    return (
      txt.includes('bug') ||
      txt.includes('glitch') ||
      txt.includes('error') ||
      txt.includes('issue') ||
      txt.includes('problem') ||
      txt.includes('kharaabi') ||
      txt.includes('kharabi') ||
      txt.includes('not working') ||
      txt.includes('chalti nahi')
    );
  };

  const isPostDoubt = (post: CommunityPost) => {
    if (post.category === 'DOUBT' || post.category === 'QUESTION') return true;
    const txt = (post.text || '').toLowerCase();
    return (
      txt.includes('doubt') ||
      txt.includes('sawal') ||
      txt.includes('question') ||
      txt.includes('madad') ||
      txt.includes('help') ||
      txt.includes('kaise') ||
      txt.includes('batao') ||
      txt.includes('solve') ||
      txt.includes('formula') ||
      txt.includes('answer')
    );
  };

  // Combine regular community posts with notes fix suggestions
  const allCommunityPosts = React.useMemo(() => {
    const suggestionPosts: CommunityPost[] = (suggestions || []).map((s) => ({
      id: `sugg_${s.id}`,
      originalSuggestionId: s.id,
      userId: s.uid || 'anonymous',
      userName: s.userName || 'Student',
      userPhoto: '',
      userRole: 'STUDENT',
      userTier: (s.isVip || s.tier === 'VIP') ? 'ULTRA' : 'FREE',
      text: s.lessonTitle
        ? `[📖 ${s.lessonTitle}${s.pageNo ? ` • Page ${s.pageNo}` : ''}] ${s.text}`
        : s.text,
      imageUrl: s.imageUrl,
      category: 'NOTES_FIX',
      createdAt: s.createdAt ? new Date(s.createdAt).getTime() : Date.now(),
      likes: s.likedBy || {},
      status: s.status === 'resolved' ? 'RESOLVED' : s.status === 'replied' ? 'REPLIED' : 'ACTIVE',
      adminReply: s.adminReply,
      adminReplyAt: s.adminReplyAt,
      adminTag: s.adminTag,
      adminOpened: s.adminOpened,
      adminOpenedAt: s.adminOpenedAt,
      isSuggestionItem: true,
      lessonTitle: s.lessonTitle,
      pageNo: s.pageNo,
    }));

    const combined = [...posts, ...suggestionPosts];
    combined.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return combined;
  }, [posts, suggestions]);

  const officialPostsCount = allCommunityPosts.filter(isPostOfficial).length;

  // Filter Posts
  const filteredPosts = allCommunityPosts.filter((post) => {
    const underReview = isPostUnderReview(post);

    // If post is in review mode:
    // Only Admin OR Post Author can see it!
    // Regular students cannot see it until admin verifies.
    if (underReview && !isAdminOrSubUser && post.userId !== user.id) {
      return false;
    }

    // Search query filter (from external header search or local)
    const effectiveSearch = (externalSearchQuery !== undefined ? externalSearchQuery : searchQuery).trim();
    if (effectiveSearch) {
      const q = effectiveSearch.toLowerCase();
      const matchText = (post.text || '').toLowerCase().includes(q);
      const matchAuthor = (post.userName || '').toLowerCase().includes(q);
      const matchCategory = (post.category || '').toLowerCase().includes(q);
      if (!matchText && !matchAuthor && !matchCategory) return false;
    }

    if (activeFilter === 'UNDER_REVIEW') return underReview && !isPostNotesFix(post);
    if (activeFilter === 'OFFICIAL') return isPostOfficial(post) && !isPostNotesFix(post);
    if (activeFilter === 'BUG_REPORT') return isPostBugReport(post) && !isPostNotesFix(post);
    if (activeFilter === 'NOTES_FIX') return isPostNotesFix(post);
    if (activeFilter === 'DOUBT') return isPostDoubt(post) && !isPostNotesFix(post);
    if (activeFilter === 'MINE') return post.userId === user.id && !isPostNotesFix(post);
    return !isPostNotesFix(post);
  });

  const formatPostTime = (timestamp: number) => {
    if (!timestamp) return 'Just now';
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(timestamp).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      id="community-post-feed"
      data-wallpaper-active={communityBackgroundImage ? "true" : undefined}
      className={`flex flex-col h-full overflow-hidden relative ${
        communityBackgroundImage ? 'bg-transparent text-slate-800 dark:text-slate-100' : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      {/* Background Wallpaper (Admin Configured Live Wallpaper) */}
      {communityBackgroundImage && (
        <div
          className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
          style={{
            backgroundImage: `url(${resolveTelegramUrl(communityBackgroundImage)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: typeof communityBackgroundOpacity === 'number' ? communityBackgroundOpacity : 0.22,
          }}
        />
      )}
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs font-semibold px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 border border-slate-700">
          <Sparkles size={14} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Lightbox for Fullscreen Image View */}
      {lightboxImageUrl && (
        <div
          id="post-image-lightbox"
          className="fixed inset-0 z-[1200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
          <img
            src={lightboxImageUrl}
            alt="Fullscreen Preview"
            className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Top Header Strip — hidden when embedded inside UniversalChat to maximize vertical screen space */}
      {!isEmbedded && (
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Community Feed</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 font-bold">
                  Free • Basic • Ultra
                </span>
              </h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Sabhi students photo aur text post kar sakte hain!
              </p>
            </div>
          </div>

          {activeFilter !== 'NOTES_FIX' && (isPostsUnlocked || user.role === 'ADMIN') && (
            <button
              onClick={() => {
                setComposerOpen(!isComposerOpen);
              }}
              className="h-7 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Sparkles size={12} />
              <span>{isComposerOpen ? 'Close' : 'Naya Post'}</span>
            </button>
          )}
        </div>
      )}

      {/* Guest Mode Informational Banner */}
      {isGuestUser && (
        <div className="mx-3 my-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2.5 text-amber-300 min-w-0">
            <Eye size={17} className="text-amber-400 shrink-0" />
            <p className="text-[11px] leading-tight">
              <strong>Guest Mode:</strong> Aap sabhi posts aur messages padh sakte hain. Post, like ya comment karne ke liye Google se link karein.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setGuestModalContext('Community Access'); setGuestModalOpen(true); }}
            className="px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-900 font-black text-[11px] shrink-0 hover:bg-amber-300 transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            Link Google
          </button>
        </div>
      )}

      {/* Post Composer Card */}
      {isComposerOpen && (
        <div className="p-3 bg-white dark:bg-slate-900 border-b border-purple-200 dark:border-purple-900/50 shadow-sm shrink-0 animate-in fade-in">
          <form onSubmit={handleCreatePost} className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-purple-600 p-[1.5px] shrink-0">
                <div className="w-full h-full rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    (user.name || 'S').charAt(0).toUpperCase()
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <textarea
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  placeholder="Apne vichar, padhai ka sawal, notes ya doubt share karein..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />

                {/* Attached Image Preview */}
                {imagePreviewUrl && (
                  <div className="relative mt-2 inline-block group">
                    <img
                      src={imagePreviewUrl}
                      alt="Upload Preview"
                      className="w-36 h-28 object-cover rounded-xl border border-purple-300 dark:border-purple-700 shadow-sm"
                    />
                    {isHdQuality && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-emerald-600/90 text-white rounded text-[9px] font-black shadow-xs flex items-center gap-0.5 border border-emerald-400/50">
                        <Sparkles size={9} className="text-amber-300" /> HD
                      </div>
                    )}
                    <div className="absolute -top-2 -right-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCroppingPostImage(true)}
                        className="p-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md cursor-pointer transition-transform hover:scale-105"
                        title="Photo Crop Karein"
                      >
                        <Crop size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={handleClearImage}
                        className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md cursor-pointer transition-transform hover:scale-105"
                        title="Hataayein"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {isUploadingImage && (
                      <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center text-white text-[10px] font-bold">
                        <Loader2 size={16} className="animate-spin text-purple-400 mb-1" />
                        <span>Uploading...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Attached Video Preview */}
                {videoPreviewUrl && (
                  <div className="relative mt-2 inline-block group w-56">
                    <video
                      src={videoPreviewUrl}
                      controls
                      playsInline
                      className="w-56 h-32 object-cover rounded-xl border border-indigo-400 bg-black shadow-sm"
                    />
                    {!isUploadingVideo && (
                      <button
                        type="button"
                        onClick={handleClearVideo}
                        className="absolute -top-2 -right-2 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-md cursor-pointer transition-transform hover:scale-105"
                        title="Video Hataayein"
                      >
                        <X size={12} />
                      </button>
                    )}
                    {isUploadingVideo && (
                      <div className="absolute inset-0 bg-black/75 rounded-xl flex flex-col items-center justify-center text-white text-[10px] font-bold p-3">
                        <Loader2 size={16} className="animate-spin text-sky-400 mb-1" />
                        <span>Uploading Video... {videoUploadProgress}%</span>
                        <div className="w-full h-1.5 bg-white/20 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-sky-400 transition-all duration-300" style={{ width: `${videoUploadProgress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Post Category Selection (General, Doubt, Bugs Report) */}
            <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar">
              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">Category:</span>
              <button
                type="button"
                onClick={() => setPostCategory('GENERAL')}
                className={`h-6 px-2.5 rounded-md text-[10.5px] font-semibold transition-all cursor-pointer ${
                  postCategory === 'GENERAL'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                General
              </button>
              <button
                type="button"
                onClick={() => setPostCategory('DOUBT')}
                className={`h-6 px-2.5 rounded-md text-[10.5px] font-semibold transition-all cursor-pointer ${
                  postCategory === 'DOUBT'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                ❓ Doubt
              </button>
              <button
                type="button"
                onClick={() => setPostCategory('BUG_REPORT')}
                className={`h-6 px-2.5 rounded-md text-[10.5px] font-semibold transition-all cursor-pointer ${
                  postCategory === 'BUG_REPORT'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                🐛 Bugs Report
              </button>
            </div>

            {/* HD Mode Information Tip */}
            {selectedImageFile && (
              <div className="mt-1">
                {isHdQuality ? (
                  <div className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-lg flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1 font-semibold">
                      <Sparkles size={12} className="text-emerald-500" />
                      HD Mode Active: Ultra-clear high resolution photo upload
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsHdQuality(false)}
                      className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Turn Off
                    </button>
                  </div>
                ) : (
                  <div className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700 rounded-lg flex items-center justify-between text-[11px] text-slate-500">
                    <span>💡 Notes, handwritten formula ya book pages hain?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsHdQuality(true);
                        showToast('✨ HD Quality ON: Photo high-resolution me upload hogi!');
                      }}
                      className="font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Sparkles size={11} /> Turn HD ON
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Admin / Subadmin Official Notice Toggle */}
            {isAdminOrSubUser && (
              <label className="flex items-center gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isOfficialPost}
                  onChange={(e) => setIsOfficialPost(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 cursor-pointer"
                />
                <span className="text-xs font-black text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <Megaphone size={13} className="text-amber-600 shrink-0" />
                  <span>📢 Official Notice / App Update banayein (Admin / SubAdmin)</span>
                </span>
              </label>
            )}

            {/* Action buttons inside composer */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Camera size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>{selectedImageFile ? 'Change Photo' : 'Photo Add Karein'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    videoInputRef.current?.click();
                  }}
                  className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Video size={14} className="text-sky-600 dark:text-sky-400" />
                  <span>{selectedVideoFile ? 'Change Video' : 'Video Add Karein'}</span>
                </button>

                {/* HD Quality Toggle Button */}
                {selectedImageFile && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isHdQuality;
                      setIsHdQuality(next);
                      showToast(
                        next
                          ? '✨ HD Quality ON: Photo high-resolution (3200px) me upload hogi!'
                          : '⚡ Standard Quality mode active.'
                      );
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 ${
                      isHdQuality
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs ring-1 ring-emerald-400'
                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                    }`}
                    title={isHdQuality ? 'HD Active: High Resolution' : 'Click karke HD Quality on karein'}
                  >
                    <Sparkles size={13} className={isHdQuality ? 'text-amber-300 animate-pulse' : 'text-slate-400'} />
                    <span>HD</span>
                    {isHdQuality && (
                      <span className="text-[9px] bg-emerald-800/80 px-1 py-0.2 rounded text-white font-black">
                        ON
                      </span>
                    )}
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{
                    position: 'fixed',
                    top: '-1000px',
                    left: '-1000px',
                    width: '1px',
                    height: '1px',
                    opacity: 0.01,
                    pointerEvents: 'auto',
                  }}
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  accept="video/*"
                  onChange={handleVideoSelect}
                  style={{
                    position: 'fixed',
                    top: '-1000px',
                    left: '-1000px',
                    width: '1px',
                    height: '1px',
                    opacity: 0.01,
                    pointerEvents: 'auto',
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPostText('');
                    handleClearImage();
                    handleClearVideo();
                    setComposerOpen(false);
                  }}
                  className="h-7 px-2.5 text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!postText.trim() && !selectedImageFile && !selectedVideoFile)}
                  className={`h-7 px-3 rounded-lg text-[11px] font-bold text-white shadow-2xs flex items-center gap-1 transition-all cursor-pointer ${
                    isSubmitting || (!postText.trim() && !selectedImageFile && !selectedVideoFile)
                      ? 'bg-purple-400/50 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 active:scale-95'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Posting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Post Karein</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Filter Chips Bar — Scrollable, slim, sleek professional button sizes (30-40% thinner) */}
      <div className="w-full px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-1.5 overflow-x-auto scroll-smooth touch-pan-x flex-nowrap scrollbar-none">
        {/* 1. All (Unlocks at Level 3 (iv) with posts) */}
        {(isPostsUnlocked || isAdminOrSubUser) && (
          <button
            type="button"
            onClick={() => setActiveFilter('ALL')}
            className={`h-7 px-3 shrink-0 flex items-center justify-center text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
              activeFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs font-bold ring-1 ring-purple-400/50'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:text-slate-950 dark:hover:text-white'
            }`}
            title="All Posts"
          >
            <span>All</span>
          </button>
        )}

        {/* 2. Official (Always available in Community) */}
        <button
          type="button"
          onClick={() => setActiveFilter('OFFICIAL')}
          className={`h-7 px-3 shrink-0 flex items-center justify-center text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
            activeFilter === 'OFFICIAL'
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs font-bold ring-1 ring-amber-400'
              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/80 hover:bg-amber-100'
          }`}
          title="Official Notices"
        >
          <span>Official</span>
        </button>

        {/* 3. Bugs Report (Unlocks at Level 3 (ii)) */}
        {(isBugReportUnlocked || isAdminOrSubUser) && (
          <button
            type="button"
            onClick={() => setActiveFilter('BUG_REPORT')}
            className={`h-7 px-3 shrink-0 flex items-center justify-center gap-1 text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
              activeFilter === 'BUG_REPORT'
                ? 'bg-rose-600 text-white shadow-xs font-bold ring-1 ring-rose-400/50'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:text-slate-950 dark:hover:text-white'
            }`}
            title="Bugs Report"
          >
            <span>Bugs Report</span>
          </button>
        )}

        {/* 4. Doubt (Unlocks at Level 3 (iii)) */}
        {(isDoubtUnlocked || isAdminOrSubUser) && (
          <button
            type="button"
            onClick={() => setActiveFilter('DOUBT')}
            className={`h-7 px-3 shrink-0 flex items-center justify-center gap-1 text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
              activeFilter === 'DOUBT'
                ? 'bg-blue-600 text-white shadow-xs font-bold ring-1 ring-blue-400/50'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:text-slate-950 dark:hover:text-white'
            }`}
            title="Doubt Posts"
          >
            <span>Doubt</span>
          </button>
        )}

        {/* 5. My Post (Unlocks at Level 3 (iv)) */}
        {(isPostsUnlocked || isAdminOrSubUser) && (
          <button
            type="button"
            onClick={() => setActiveFilter('MINE')}
            className={`h-7 px-3 shrink-0 flex items-center justify-center gap-1 text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
              activeFilter === 'MINE'
                ? 'bg-emerald-600 text-white shadow-xs font-bold ring-1 ring-emerald-400/50'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:text-slate-950 dark:hover:text-white'
            }`}
            title="My Post"
          >
            <span>My Post</span>
          </button>
        )}

        {/* 6. Review Mode (Admin / SubAdmin Queue) */}
        {isAdminOrSubUser && (
          <button
            type="button"
            onClick={() => setActiveFilter('UNDER_REVIEW')}
            className={`h-7 px-3 shrink-0 flex items-center justify-center gap-1.2 text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
              activeFilter === 'UNDER_REVIEW'
                ? 'bg-amber-500 text-slate-950 shadow-xs font-bold ring-1 ring-amber-400'
                : underReviewPostsCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : 'bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:text-slate-950 dark:hover:text-white'
            }`}
            title="Review Queue (3+ Reports or Flagged)"
          >
            <ShieldAlert size={13} />
            <span>Review</span>
            {underReviewPostsCount > 0 && (
              <span className="bg-amber-600 text-white text-[9.5px] font-black px-1.2 py-0.2 rounded-full">
                {underReviewPostsCount}
              </span>
            )}
          </button>
        )}

        {/* 7. Notes Fix */}
        <button
          type="button"
          onClick={() => setActiveFilter('NOTES_FIX')}
          className={`h-7 px-3 shrink-0 flex items-center justify-center gap-1.2 text-[11.5px] font-semibold rounded-lg transition-all cursor-pointer select-none whitespace-nowrap shadow-2xs active:scale-95 ${
            activeFilter === 'NOTES_FIX'
              ? 'bg-amber-500 text-slate-950 shadow-xs font-bold ring-1 ring-amber-400'
              : 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100'
          }`}
          title="Notes Fix"
        >
          <Lightbulb size={13} className="shrink-0" />
          <span>Notes Fix</span>
        </button>
      </div>

      {/* Bugs Report Banner */}
      {activeFilter === 'BUG_REPORT' && (
        <div className="mx-2.5 mt-2 p-2.5 rounded-xl bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-amber-500/10 border border-rose-300/40 dark:border-rose-900/40 flex items-center justify-between gap-2 shadow-2xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                <span>Bugs & Glitches Report Feed</span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold">Community</span>
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                App me koi dikkat, crash ya bug aaye toh report karein!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPostCategory('BUG_REPORT');
              setComposerOpen(true);
            }}
            className="h-6.5 px-2.5 rounded-md bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-[10.5px] font-bold shrink-0 transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <span>+ Report Bug</span>
          </button>
        </div>
      )}

      {/* Notes Fix Feed Banner */}
      {activeFilter === 'NOTES_FIX' && (
        <div className="mx-2.5 mt-2 p-2.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-orange-500/10 border border-amber-300/40 dark:border-amber-900/40 flex items-center justify-between gap-2 shadow-2xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Lightbulb size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-[11.5px] font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                <span>Notes & MCQ Fix Feed</span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">Verified Reports</span>
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Sirf Notes ya MCQ se report ki gayi galtiyan & admin direct replies yahan dikhte hain.
              </p>
            </div>
          </div>
          <span className="px-2 py-0.8 rounded-md bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/30 text-[10px] font-bold shrink-0">
            Notes / MCQ Only
          </span>
        </div>
      )}

      {/* Posts Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-4 pb-safe">
        {/* Official Notices Banner in OFFICIAL tab */}
        {activeFilter === 'OFFICIAL' && (
          <div className="p-3 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-300 dark:border-amber-700/60 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Megaphone size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <span>Official App Notices &amp; Updates</span>
                <span className="text-[9px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.2 rounded font-black">Admin Only</span>
              </h4>
              <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 font-medium leading-tight">
                Yahan Admin aur SubAdmin ke dwara bheje gaye app-related zaroori notices aur updates aayenge.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={28} className="animate-spin text-purple-600" />
            <p className="text-xs font-semibold">Community posts load ho rahe hain...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          activeFilter === 'OFFICIAL' ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900/60 rounded-3xl border border-amber-200 dark:border-amber-900/50 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl mx-auto shadow-inner">
                📢
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Abhi tak koi Official Notice nahi hai
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Admin aur SubAdmin jab bhi app se sambandhit koi zaroori notice ya update bhejenge, wo yahan show hoga.
              </p>
              {isAdminOrSubUser && (
                <button
                  onClick={() => {
                    setIsOfficialPost(true);
                    setComposerOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  📢 Naya Official Notice Bhejo
                </button>
              )}
            </div>
          ) : activeFilter === 'NOTES_FIX' ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center text-lg mx-auto shadow-2xs">
                💡
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                Abhi tak koi Notes / MCQ Fix report nahi hai
              </h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Notes padhte samay ya MCQ solve karte samay 'Report / Suggest Fix' par click karke galti bhej sakte hain.
              </p>
            </div>
          ) : activeFilter === 'BUG_REPORT' ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-slate-900/60 rounded-2xl border border-rose-200 dark:border-rose-900/50 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center text-lg mx-auto shadow-2xs">
                🐛
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                Abhi tak koi Bug Report nahi hai
              </h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Agar app me koi dikkat ya error aaye toh report karein.
              </p>
              <button
                onClick={() => {
                  setPostCategory('BUG_REPORT');
                  setComposerOpen(true);
                }}
                className="h-7 px-3 bg-gradient-to-r from-rose-600 to-red-600 text-white text-[11px] font-bold rounded-lg shadow-2xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center justify-center"
              >
                + Report Bug
              </button>
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center text-2xl mx-auto shadow-inner">
                📝
              </div>
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                {(externalSearchQuery || searchQuery) ? 'Koi matching post nahi mila' : 'Abhi tak koi post nahi hai!'}
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Aap pehla post daal kar shuruat karein! Chahe study question ho, notes ya photo.
              </p>
              <button
                onClick={() => setComposerOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 transition-all cursor-pointer"
              >
                Pehla Post Likhein 🚀
              </button>
            </div>
          )
        ) : (
          filteredPosts.map((post) => {
            const isLikedByMe = !!(post.likes && post.likes[user.id]);
            const likeCount = Object.keys(post.likes || {}).length;
            const commentsList = Object.values(post.comments || {}).sort(
              (a, b) => a.createdAt - b.createdAt
            );
            const isCommentsOpen = !!expandedComments[post.id];
            const canDelete =
              isAdmin ||
              user.role === 'ADMIN' ||
              user.role === 'SUB_ADMIN' ||
              user.id === post.userId;

            return (
              <div
                key={post.id}
                id={`post-card-${post.id}`}
                className={`bg-white dark:bg-slate-900 border rounded-2xl shadow-xs overflow-hidden transition-all hover:border-purple-300 dark:hover:border-purple-800/60 ${
                  isPostUnderReview(post)
                    ? 'border-amber-400 dark:border-amber-700/80 ring-1 ring-amber-400/40'
                    : 'border-slate-200/90 dark:border-slate-800'
                }`}
              >
                {/* Under Review Notice Banner */}
                {isPostUnderReview(post) && (
                  isAdminOrSubUser ? (
                    <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 text-white p-3 text-xs font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm border-b border-amber-600">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={18} className="text-yellow-200 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black uppercase tracking-wider text-[11px] bg-black/25 px-1.5 py-0.5 rounded">
                              ⚠️ Review Mode ({Object.keys(post.reports || {}).length} Reports)
                            </span>
                            <span className="text-[10px] text-yellow-100">Normal students se hidden hai</span>
                          </div>
                          <p className="text-[10px] text-amber-100 mt-1">
                            Reports:{' '}
                            {Object.values(post.reports || {})
                              .map((r) => r.reason)
                              .filter(Boolean)
                              .slice(0, 2)
                              .join(' • ') || 'Reported by users'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleVerifyPost(post)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] font-black rounded-xl shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                          title="Verify karein aur sabhi students ko dikhayein"
                        >
                          <CheckCircle size={13} />
                          <span>Verify / Approve</span>
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id, post.userId)}
                          className="px-3 py-1.5 bg-black/40 hover:bg-rose-600 active:scale-95 text-white text-[11px] font-black rounded-xl shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                          title="Post delete karein"
                        >
                          <Trash2 size={13} />
                          <span>Hatao</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-900/60 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2 font-medium">
                      <AlertCircle size={16} className="text-amber-600 shrink-0" />
                      <span className="text-[11px] leading-tight">
                        ⚠️ <strong>Review Mode:</strong> Is post par 3 reports aayi hain aur yeh filhaal baaki students ke liye hidden hai. Admin verify karega tab public hoga. Aap chahe to Edit se apna post sudhar sakte hain.
                      </span>
                    </div>
                  )
                )}

                {/* Official Notice Ribbon on card */}
                {isPostOfficial(post) && (
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white px-3.5 py-1.5 text-[10px] font-black flex items-center justify-between tracking-wide shadow-xs">
                    <span className="flex items-center gap-1.5">
                      <Megaphone size={12} className="fill-white" /> 📢 OFFICIAL NOTICE • APP UPDATE
                    </span>
                    <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                      Verified Admin
                    </span>
                  </div>
                )}

                {/* Notes Fix & Bug Report Real-time Status Banner (Opened / Replied / Resolved / Pending) */}
                {((post as any).isSuggestionItem || post.category === 'NOTES_FIX' || post.category === 'BUG_REPORT' || post.category === 'NOTE_CORRECTION' || post.adminReply || (post as any).adminOpened) && (
                  <div
                    className={`px-3.5 py-2 border-b flex items-center justify-between gap-2 text-xs font-black ${
                      post.status === 'RESOLVED' || post.status === 'resolved'
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300'
                        : post.adminReply || post.status === 'REPLIED' || post.status === 'replied'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                        : (post as any).adminOpened
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-300'
                        : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {post.status === 'RESOLVED' || post.status === 'resolved' ? (
                        <>
                          <ShieldCheck size={14} className="shrink-0 text-purple-600 dark:text-purple-400" />
                          <span className="truncate font-bold">🎯 Admin ne Resolve / Sudhar Diya Hai</span>
                        </>
                      ) : post.adminReply || post.status === 'REPLIED' || post.status === 'replied' ? (
                        <>
                          <MessageSquare size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <span className="truncate font-bold">✅ Admin ne Dekh Kar Reply Diya Hai</span>
                        </>
                      ) : (post as any).adminOpened ? (
                        <>
                          <Eye size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
                          <span className="truncate font-bold">👁️ Admin ne Open Kar Liya Hai (Review Chalu Hai)</span>
                        </>
                      ) : (
                        <>
                          <Clock size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="truncate font-bold">⏳ Admin ne Abhi Open Nahi Kiya (Pending Review)</span>
                        </>
                      )}
                    </div>
                    <span className="text-[9.5px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0 bg-white/90 dark:bg-slate-900/90 shadow-2xs">
                      {post.status === 'RESOLVED' || post.status === 'resolved'
                        ? 'RESOLVED'
                        : post.adminReply || post.status === 'REPLIED' || post.status === 'replied'
                        ? 'REPLIED'
                        : (post as any).adminOpened
                        ? 'OPENED'
                        : 'PENDING'}
                    </span>
                  </div>
                )}
                {/* Post Author Bar */}
                <div className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 p-[1.5px] shrink-0">
                      <div className="w-full h-full rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center overflow-hidden">
                        {post.userPhoto ? (
                          <img
                            src={post.userPhoto}
                            alt={post.userName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (post.userName || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-slate-900 dark:text-white truncate">
                          {post.userName}
                        </span>

                        {/* Tier Badge */}
                        {post.userTier === 'ULTRA' ? (
                          <span className="text-[9px] bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                            <Crown size={9} className="fill-slate-950" /> ULTRA
                          </span>
                        ) : post.userTier === 'BASIC' ? (
                          <span className="text-[9px] bg-blue-500 text-white font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                            <Zap size={9} className="fill-white" /> BASIC
                          </span>
                        ) : (
                          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold px-1.5 py-0.2 rounded-md">
                            FREE
                          </span>
                        )}

                        {(post.userRole === 'ADMIN' || post.userRole === 'SUB_ADMIN') && (
                          <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                            <Shield size={9} /> ADMIN
                          </span>
                        )}

                        {post.category === 'BUG_REPORT' && (
                          <span className="text-[9px] bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 font-bold px-1.5 py-0.2 rounded-md border border-rose-200 dark:border-rose-900/60">
                            🐛 Bug Report
                          </span>
                        )}
                        {((post as any).isSuggestionItem || post.category === 'NOTES_FIX' || post.category === 'NOTE_CORRECTION') && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded-md border border-amber-300 dark:border-amber-900/60 flex items-center gap-0.5">
                            <Lightbulb size={9} className="shrink-0" /> Notes Fix
                          </span>
                        )}
                        {post.category === 'DOUBT' && (
                          <span className="text-[9px] bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold px-1.5 py-0.2 rounded-md border border-blue-200 dark:border-blue-900/60">
                            ❓ Doubt
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                        <span>{formatPostTime(post.createdAt)}</span>
                        {post.isEdited && (
                          <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/60 px-1 py-0.2 rounded border border-purple-200 dark:border-purple-800/40">
                            Edited
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Post Actions: Edit, Report, Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Edit button: for Post Author or Admin */}
                    {(post.userId === user.id || isAdminOrSubUser) && (
                      <button
                        onClick={() => handleStartEdit(post)}
                        className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        title="Post Edit Karein"
                      >
                        <Edit3 size={14} />
                      </button>
                    )}

                    {/* Report button: for Non-Author users */}
                    {post.userId !== user.id && (
                      <button
                        onClick={() => handleOpenReport(post)}
                        className={`p-1.5 transition-colors cursor-pointer rounded-lg flex items-center gap-1 text-[10px] font-bold ${
                          Boolean(post.reports && post.reports[user.id])
                            ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 cursor-default'
                            : 'text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                        title={
                          Boolean(post.reports && post.reports[user.id])
                            ? 'Aap is post ko report kar chuke hain'
                            : 'Post Report Karein (Anuchit content rokne ke liye)'
                        }
                      >
                        <Flag
                          size={13}
                          className={
                            Boolean(post.reports && post.reports[user.id])
                              ? 'fill-amber-600 text-amber-600'
                              : ''
                          }
                        />
                        {Boolean(post.reports && post.reports[user.id]) && <span>Reported</span>}
                      </button>
                    )}

                    {/* Delete button: for Author or Admin */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeletePost(post.id, post.userId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Post Delete Karein"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Post Body: Text */}
                {post.text && (
                  <div className="px-4 pb-3">
                    <p className="text-xs md:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap select-text">
                      {post.text}
                    </p>
                  </div>
                )}

                {/* Post Body: Image Attachment */}
                {(post.imageUrl || (post as any).mediaUrl) && (
                  <div className="px-3 pb-3">
                    <div
                      className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 group cursor-pointer min-h-[120px]"
                      onClick={() => setLightboxImageUrl(resolveTelegramUrl(post.imageUrl || (post as any).mediaUrl))}
                    >
                      {post.isHd && (
                        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/75 backdrop-blur-xs text-white rounded text-[10px] font-black border border-white/20 flex items-center gap-1 shadow-xs pointer-events-none">
                          <span className="text-amber-300 text-[9px]">✨</span> HD
                        </div>
                      )}
                      <img
                        src={resolveTelegramUrl(post.imageUrl || (post as any).mediaUrl)}
                        alt={post.text ? post.text.slice(0, 30) : 'Post Image'}
                        className="w-full max-h-96 object-cover object-center group-hover:scale-[1.01] transition-transform duration-300 bg-slate-900/10"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const raw = post.imageUrl || (post as any).mediaUrl;
                          if (raw && !target.dataset.retried) {
                            target.dataset.retried = '1';
                            target.src = raw;
                          }
                        }}
                      />
                      <div className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-bold">
                        {post.isHd && <span className="text-emerald-400 text-[9px] font-black mr-0.5">HD</span>}
                        <Maximize2 size={14} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Post Body: Video Attachment */}
                {(post.videoUrl || (post as any).video) && (
                  <div className="px-3 pb-3">
                    <div className="relative overflow-hidden rounded-xl bg-black border border-slate-800">
                      <video
                        src={resolveTelegramUrl(getOptimizedVideoUrl(post.videoUrl || (post as any).video))}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full max-h-96 object-contain"
                        onError={(e) => {
                          const target = e.currentTarget;
                          const raw = post.videoUrl || (post as any).video;
                          if (raw && !target.dataset.retried) {
                            target.dataset.retried = '1';
                            target.src = raw;
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Lesson / Note Reference if provided */}
                {(post.lessonTitle || post.pageNo) && (
                  <div className="mx-3.5 mb-2.5 px-3 py-1.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
                    <span className="font-bold shrink-0">📖 Note Reference:</span>
                    <span className="truncate">{post.lessonTitle || 'Lesson'}</span>
                    {post.pageNo && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-200/70 dark:bg-amber-800/70 font-black text-[10px] shrink-0">
                        Page {post.pageNo}
                      </span>
                    )}
                  </div>
                )}

                {/* Inline Admin Reply Box - Shown right under the report without any separate page/popup */}
                {post.adminReply && (
                  <div className="mx-3.5 mb-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/70 dark:from-emerald-950/50 dark:via-teal-950/40 dark:to-emerald-950/50 border border-emerald-300/80 dark:border-emerald-800/80 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                          ✓
                        </span>
                        <span className="text-[11px] font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1">
                          <span>Admin Official Reply</span>
                          {post.adminTag && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-800/80 text-emerald-950 dark:text-emerald-100 font-extrabold uppercase">
                              {post.adminTag}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                        {post.status === 'RESOLVED' || post.status === 'resolved' ? 'Resolved 🎯' : 'Replied ✅'}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-950 dark:text-emerald-100 leading-relaxed font-medium whitespace-pre-wrap pl-6 select-text">
                      {post.adminReply}
                    </p>
                  </div>
                )}

                {/* Admin Quick Action Controls: Reply & Resolve inline directly on card */}
                {isAdminOrSubUser && ((post as any).isSuggestionItem || post.category === 'NOTES_FIX' || post.category === 'BUG_REPORT') && (
                  <div className="mx-3.5 mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Shield size={12} className="text-purple-600" /> Admin Response:
                      </span>
                      {post.status !== 'RESOLVED' && post.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleAdminResolveDirect(post)}
                          className="h-6 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center gap-1"
                        >
                          <CheckCircle size={10} />
                          <span>Mark Resolved (+5 Coins)</span>
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={(typeof inlineAdminReplyInputs !== 'undefined' && inlineAdminReplyInputs ? inlineAdminReplyInputs[post.id] : '') || ''}
                        onChange={(e) =>
                          typeof setInlineAdminReplyInputs === 'function' &&
                          setInlineAdminReplyInputs((prev) => ({
                            ...(prev || {}),
                            [post.id]: e.target.value,
                          }))
                        }
                        placeholder={post.adminReply ? "Update admin reply..." : "Student ko reply likhein..."}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md px-2.5 py-1 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleAdminSubmitReply(post)}
                        className="h-6.5 px-2.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-[10.5px] font-bold shadow-2xs cursor-pointer active:scale-95 transition-all flex items-center gap-1 shrink-0"
                      >
                        <Send size={10} />
                        <span>Reply</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Post Action Metrics Bar */}
                <div className="px-3.5 py-1.5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Like Button */}
                    <button
                      onClick={() => handleToggleLike(post)}
                      className={`flex items-center gap-1 text-[11.5px] font-semibold transition-all cursor-pointer active:scale-110 ${
                        isLikedByMe
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 hover:text-rose-500'
                      }`}
                    >
                      <Heart
                        size={14}
                        className={isLikedByMe ? 'fill-rose-500 text-rose-500' : ''}
                      />
                      <span>{likeCount}</span>
                    </button>

                    {/* Comments Toggle Button — Only for normal posts, completely hidden for Notes Fix */}
                    {!isPostNotesFix(post) ? (
                      <button
                        onClick={() => toggleComments(post.id)}
                        className={`flex items-center gap-1 text-[11.5px] font-semibold transition-all cursor-pointer ${
                          isCommentsOpen
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-slate-500 hover:text-purple-600'
                        }`}
                      >
                        <MessageCircle size={14} />
                        <span>{commentsList.length} Comments</span>
                        {isCommentsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    ) : (
                      <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80 font-medium flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        🔒 Official Review
                      </span>
                    )}
                  </div>

                  {/* Share button */}
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(
                          `Post by ${post.userName}: ${post.text || 'Post'}`
                        );
                        showToast('📋 Link copy ho gaya!');
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Share Post"
                  >
                    <Share2 size={13} />
                  </button>
                </div>

                {/* Comments Section Drawer — Never shown for Notes Fix */}
                {isCommentsOpen && !isPostNotesFix(post) && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                    {/* Comments List */}
                    {commentsList.length === 0 ? (
                      <p className="text-center text-[11px] text-slate-400 py-3">
                        Abhi koi comment nahi hai. Pehla comment karein!
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {commentsList.map((comm) => (
                          <div
                            key={comm.id}
                            className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-start justify-between gap-2"
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 overflow-hidden">
                                {comm.userPhoto ? (
                                  <img
                                    src={comm.userPhoto}
                                    alt={comm.userName}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  (comm.userName || 'S').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-slate-900 dark:text-white">
                                    {comm.userName}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {formatPostTime(comm.createdAt)}
                                  </span>
                                </div>
                                {comm.text && (
                                  <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap mt-0.5 break-words">
                                    {comm.text}
                                  </p>
                                )}
                                {comm.imageUrl && (
                                  <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 max-w-[240px] group bg-slate-900/10">
                                    <img
                                      src={resolveTelegramUrl(comm.imageUrl)}
                                      alt="Comment attachment"
                                      className="max-h-48 w-full object-cover rounded-lg cursor-pointer hover:opacity-95 transition-opacity"
                                      onClick={() => setLightboxImageUrl(resolveTelegramUrl(comm.imageUrl) || null)}
                                      loading="lazy"
                                      onError={(e) => {
                                        const target = e.currentTarget;
                                        if (comm.imageUrl && !target.dataset.retried) {
                                          target.dataset.retried = '1';
                                          target.src = comm.imageUrl;
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImageUrl(resolveTelegramUrl(comm.imageUrl) || null)}
                                      className="absolute bottom-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 text-white rounded-md text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                                      title="Bada karein"
                                    >
                                      <Maximize2 size={11} />
                                      <span>Zoom</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>

                            {(isAdmin || user.id === comm.userId) && (
                              <button
                                onClick={() => handleDeleteComment(post.id, comm.id, comm.userId)}
                                className="text-slate-400 hover:text-rose-500 p-0.5 shrink-0"
                                title="Delete comment"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Preview of attached comment photo */}
                    {commentImagePreviews[post.id] && (
                      <div className="flex items-center gap-2 p-1.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl">
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-purple-300 dark:border-purple-700 shrink-0 bg-black/5">
                          <img
                            src={commentImagePreviews[post.id]!}
                            alt="Comment Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 truncate">
                            Photo attached
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <button
                              type="button"
                              onClick={() => setCroppingCommentPostId(post.id)}
                              className="px-2 py-0.5 text-[10px] font-medium bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700 rounded-md flex items-center gap-1 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer shadow-2xs"
                              title="Photo crop karein"
                            >
                              <Crop size={10} /> Crop
                            </button>
                            <button
                              type="button"
                              onClick={() => handleClearCommentImage(post.id)}
                              className="px-2 py-0.5 text-[10px] font-medium bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 rounded-md flex items-center gap-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer shadow-2xs"
                              title="Photo hatayein"
                            >
                              <X size={10} /> Hatayein
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* New Comment Input */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="file"
                        id={`comment-file-${post.id}`}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleCommentImageSelect(post.id, e)}
                      />
                      <label
                        htmlFor={`comment-file-${post.id}`}
                        className={`w-7 h-7 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                          commentImageFiles[post.id]
                            ? 'bg-purple-100 dark:bg-purple-950/60 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300'
                        }`}
                        title="Comment me photo add karein"
                      >
                        <Camera size={13} />
                      </label>
                      <input
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [post.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddComment(post.id);
                        }}
                        placeholder={
                          commentImageFiles[post.id]
                            ? 'Photo ke sath caption likhein...'
                            : 'Apna comment likhein...'
                        }
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={
                          isSubmittingComment[post.id] ||
                          (!((commentInputs[post.id] || '').trim()) && !commentImageFiles[post.id])
                        }
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-bold text-white shadow-2xs transition-all flex items-center justify-center ${
                          ((commentInputs[post.id] || '').trim()) || commentImageFiles[post.id]
                            ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer active:scale-95'
                            : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                        title="Comment bhejein"
                      >
                        {isSubmittingComment[post.id] ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Send size={11} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Interactive In-App Image Cropper */}
      {isCroppingPostImage && imagePreviewUrl && (
        <ImageCropper
          imageSrc={imagePreviewUrl}
          title="Post Photo Crop Karein"
          saveButtonText="Crop Apply Karein ✅"
          onCropComplete={handleCropPostImageComplete}
          onCancel={() => setIsCroppingPostImage(false)}
        />
      )}

      {/* Interactive In-App Image Cropper for Comment Photo */}
      {croppingCommentPostId && commentImagePreviews[croppingCommentPostId] && (
        <ImageCropper
          imageSrc={commentImagePreviews[croppingCommentPostId]!}
          title="Comment Photo Crop Karein"
          saveButtonText="Crop Apply Karein ✅"
          onCropComplete={handleCropCommentImageComplete}
          onCancel={() => setCroppingCommentPostId(null)}
        />
      )}

      {/* Fullscreen Image Lightbox with Download */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in select-none"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="absolute top-4 right-4 flex items-center gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImageUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="community_post_image.jpg"
              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-lg active:scale-95"
              title="Photo Download / Full Size me Dekhein"
            >
              <Download size={20} />
            </a>
            <button
              type="button"
              onClick={() => setLightboxImageUrl(null)}
              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full transition-colors cursor-pointer shadow-lg active:scale-95"
              title="Band Karein"
            >
              <X size={20} />
            </button>
          </div>

          <div
            className="max-w-5xl max-h-[85vh] relative flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolveTelegramUrl(lightboxImageUrl)}
              alt="Photo Fullscreen View"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Post Report Modal */}
      {reportingPost && (
        <div
          className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isSubmittingReport && setReportingPost(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm">
                <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Flag size={16} />
                </div>
                <span>Community Post Report Karein</span>
              </div>
              <button
                disabled={isSubmittingReport}
                onClick={() => setReportingPost(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed">
              ⚠️ <strong>Community Suraksha Niyam:</strong> Kisi bhi galat ya abusive post par <strong>3 reports</strong> aane par post turant <strong>Review Mode</strong> me chala jayega aur Admin verify karega tabhi public me dikhega.
            </div>

            {/* Reasons List */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Report ka karan chunein:
              </label>
              {[
                'Ashleel / Abusive bhasha ya galat vyavhar',
                'Spam / Prachar / Fake content',
                'Galat ya misleading study material ya questions',
                'Harassment ya kisi student ko pareshan karna',
                'Koi anya niyam ullanghan',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                    reportReason === reason
                      ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-400 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-black shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{reason}</span>
                  {reportReason === reason && <CheckCircle size={15} className="text-rose-600 shrink-0" />}
                </button>
              ))}
            </div>

            {/* Additional custom explanation note */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                Anya vivaran / Note (optional):
              </label>
              <textarea
                value={reportCustomNote}
                onChange={(e) => setReportCustomNote(e.target.value)}
                placeholder="Agar kuch aur batana chahein to yahan likhein..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSubmittingReport}
                onClick={() => setReportingPost(null)}
                className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingReport}
                onClick={handleSubmitReport}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSubmittingReport ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Bheja ja raha hai...</span>
                  </>
                ) : (
                  <>
                    <Flag size={14} />
                    <span>Report Submit Karein</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post Edit Modal */}
      {editingPost && (
        <div
          className="fixed inset-0 z-[1100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isSavingEdit && setEditingPost(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black text-sm">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Edit3 size={16} />
                </div>
                <span>Apna Post Edit Karein</span>
              </div>
              <button
                disabled={isSavingEdit}
                onClick={() => setEditingPost(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Category selection */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Category:
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditCategory('GENERAL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editCategory === 'GENERAL'
                      ? 'bg-purple-600 text-white shadow-xs font-black'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  General
                </button>
                <button
                  type="button"
                  onClick={() => setEditCategory('DOUBT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editCategory === 'DOUBT'
                      ? 'bg-blue-600 text-white shadow-xs font-black'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  ❓ Doubt
                </button>
                <button
                  type="button"
                  onClick={() => setEditCategory('BUG_REPORT')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    editCategory === 'BUG_REPORT'
                      ? 'bg-rose-600 text-white shadow-xs font-black'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  🐛 Bugs Report
                </button>
              </div>
            </div>

            {/* Post Textarea */}
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Post Text:
              </label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Post ka text likhein ya badlein..."
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs md:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Attached Photo Controls */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                Photo Attachment:
              </label>
              {editImagePreview ? (
                <div className="relative inline-block rounded-2xl overflow-hidden border border-purple-300 dark:border-purple-800 shadow-sm">
                  <img
                    src={editImagePreview}
                    alt="Edit Preview"
                    className="max-h-44 w-auto object-contain rounded-2xl bg-black/5 dark:bg-black/40"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveEditImage}
                    className="absolute top-2 right-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg active:scale-95 transition-all cursor-pointer"
                    title="Photo Hatayein"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    ref={editFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleEditImageSelect}
                  />
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-700 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Camera size={16} />
                    <span>Nayi Photo Lagayein / Upload Karein</span>
                  </button>
                </div>
              )}
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => setEditingPost(null)}
                className="px-3.5 py-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 active:scale-95 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Changes Save Karein</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Restriction & Google Binding Modal */}
      <GuestRestrictionModal
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        currentUser={user}
        onUserUpdated={(updated) => {
          if (onUserUpdate) onUserUpdate(updated);
        }}
        featureName={guestModalContext}
        customMessage="Guest Account me Community par post likhna, like ya comment karna allowed nahi hai. Apne account ko Google se bind karein taaki aapka profile hamesha verified rahe!"
      />
    </div>
  );
};
