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
} from 'lucide-react';
import { ref, onValue, set, remove, push, update } from 'firebase/database';
import { rtdb } from '../firebase';
import { uploadImageToImgBB } from '../services/imgbbService';
import { ImageCropper } from './ImageCropper';
import { User } from '../types';

export interface PostComment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userRole?: string;
  userTier?: 'FREE' | 'BASIC' | 'ULTRA' | string;
  text: string;
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
  language?: string;
  createdAt: number;
  likes?: Record<string, boolean>; // userId -> true
  comments?: Record<string, PostComment>;
}

interface CommunityPostFeedProps {
  user: User;
  isAdmin?: boolean;
  onClose?: () => void;
}

export const CommunityPostFeed: React.FC<CommunityPostFeedProps> = ({
  user,
  isAdmin = false,
}) => {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'POPULAR' | 'IMAGES' | 'MINE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Creator State
  const [postText, setPostText] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isCroppingPostImage, setIsCroppingPostImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  // Active Expanded Comments (Set of postIds)
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [isSubmittingComment, setIsSubmittingComment] = useState<Record<string, boolean>>({});

  // Fullscreen Image Lightbox
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Status Alerts
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!postText.trim() && !selectedImageFile) {
      showToast('⚠️ Kripya kuch text likhein ya photo attach karein!');
      return;
    }

    setIsSubmitting(true);
    let uploadedImageUrl = '';

    try {
      if (selectedImageFile) {
        setIsUploadingImage(true);
        uploadedImageUrl = await uploadImageToImgBB(selectedImageFile, `post_${user.id}_${Date.now()}`);
        setIsUploadingImage(false);
      }

      const postsRef = ref(rtdb, 'community_posts');
      const newPostRef = push(postsRef);
      const newPostId = newPostRef.key;

      if (!newPostId) {
        throw new Error('Failed to generate post ID');
      }

      const newPostData: Record<string, any> = {
        userId: user.id || 'anonymous',
        userName: user.name || 'Anonymous Student',
        userPhoto: user.photoURL || '',
        userRole: user.role || 'STUDENT',
        userTier: userTier || 'FREE',
        text: postText.trim(),
        createdAt: Date.now(),
      };

      if (uploadedImageUrl && uploadedImageUrl.trim()) {
        newPostData.imageUrl = uploadedImageUrl.trim();
      }

      await set(newPostRef, newPostData);

      // Reset Form
      setPostText('');
      handleClearImage();
      setShowComposer(false);
      showToast('🎉 Aapka post safaltapoorvak publish ho gaya!');
    } catch (err: any) {
      console.error('[CommunityPostFeed] Post creation failed:', err);
      showToast(`❌ Post upload fail ho gaya: ${err.message || 'Error'}`);
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  // Toggle Like Handler
  const handleToggleLike = async (post: CommunityPost) => {
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

  // Toggle Comments Drawer
  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  // Submit Comment
  const handleAddComment = async (postId: string) => {
    const text = (commentInputs[postId] || '').trim();
    if (!text) return;

    setIsSubmittingComment((prev) => ({ ...prev, [postId]: true }));
    try {
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

      await set(newCommentRef, commentData);

      // Clear input
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
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
        await remove(ref(rtdb, `community_posts/${postId}`));
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

  // Filter Posts
  const filteredPosts = posts.filter((post) => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = (post.text || '').toLowerCase().includes(q);
      const matchAuthor = (post.userName || '').toLowerCase().includes(q);
      if (!matchText && !matchAuthor) return false;
    }

    if (activeFilter === 'MINE') return post.userId === user.id;
    if (activeFilter === 'IMAGES') return !!post.imageUrl;
    return true;
  });

  if (activeFilter === 'POPULAR') {
    filteredPosts.sort((a, b) => {
      const likesA = Object.keys(a.likes || {}).length;
      const likesB = Object.keys(b.likes || {}).length;
      return likesB - likesA;
    });
  }

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
    <div id="community-post-feed" className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
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

      {/* Top Header Strip */}
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

        <button
          onClick={() => setShowComposer(!showComposer)}
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Sparkles size={13} />
          <span>{showComposer ? 'Close' : 'Naya Post'}</span>
        </button>
      </div>

      {/* Post Composer Card */}
      {showComposer && (
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
              </div>
            </div>

            {/* Action buttons inside composer */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="community-post-image-input"
                />
                <label
                  htmlFor="community-post-image-input"
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Camera size={14} className="text-purple-600 dark:text-purple-400" />
                  <span>{selectedImageFile ? 'Change Photo' : 'Photo Add Karein'}</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPostText('');
                    handleClearImage();
                    setShowComposer(false);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (!postText.trim() && !selectedImageFile)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSubmitting || (!postText.trim() && !selectedImageFile)
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

      {/* Filter and Search Bar */}
      <div className="p-2.5 bg-white dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts by topic or student name..."
              className="w-full bg-slate-100 dark:bg-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'ALL'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Posts ({posts.length})
          </button>
          <button
            onClick={() => setActiveFilter('POPULAR')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === 'POPULAR'
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Sparkles size={11} />
            <span>Most Liked</span>
          </button>
          <button
            onClick={() => setActiveFilter('IMAGES')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
              activeFilter === 'IMAGES'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Image size={11} />
            <span>Photos Only</span>
          </button>
          <button
            onClick={() => setActiveFilter('MINE')}
            className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === 'MINE'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            My Posts
          </button>
        </div>
      </div>

      {/* Posts Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={28} className="animate-spin text-purple-600" />
            <p className="text-xs font-semibold">Community posts load ho rahe hain...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center text-2xl mx-auto shadow-inner">
              📝
            </div>
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              {searchQuery ? 'Koi matching post nahi mila' : 'Abhi tak koi post nahi hai!'}
            </h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Aap pehla post daal kar shuruat karein! Chahe study question ho, notes ya photo.
            </p>
            <button
              onClick={() => setShowComposer(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 transition-all"
            >
              Pehla Post Likhein 🚀
            </button>
          </div>
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
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all hover:border-purple-300 dark:hover:border-purple-800/60"
              >
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
                      </div>

                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {formatPostTime(post.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Post Actions: Delete */}
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

                {/* Post Body: Text */}
                {post.text && (
                  <div className="px-4 pb-3">
                    <p className="text-xs md:text-sm text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap select-text">
                      {post.text}
                    </p>
                  </div>
                )}

                {/* Post Body: Image Attachment */}
                {post.imageUrl && (
                  <div className="px-3 pb-3">
                    <div
                      className="relative overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 group cursor-pointer"
                      onClick={() => setLightboxImageUrl(post.imageUrl!)}
                    >
                      <img
                        src={post.imageUrl}
                        alt="Post Attachment"
                        className="w-full max-h-96 object-cover object-center group-hover:scale-[1.01] transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute bottom-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 size={14} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Post Action Metrics Bar */}
                <div className="px-4 py-2 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Like Button */}
                    <button
                      onClick={() => handleToggleLike(post)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-125 ${
                        isLikedByMe
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500 hover:text-rose-500'
                      }`}
                    >
                      <Heart
                        size={16}
                        className={isLikedByMe ? 'fill-rose-500 text-rose-500 animate-bounce' : ''}
                      />
                      <span>{likeCount}</span>
                    </button>

                    {/* Comments Toggle Button */}
                    <button
                      onClick={() => toggleComments(post.id)}
                      className={`flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                        isCommentsOpen
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-slate-500 hover:text-purple-600'
                      }`}
                    >
                      <MessageCircle size={16} />
                      <span>{commentsList.length} Comments</span>
                      {isCommentsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Share button */}
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(
                          `Post by ${post.userName}: ${post.text || 'Photo Post'}`
                        );
                        showToast('📋 Post text copy ho gaya!');
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    title="Share Post"
                  >
                    <Share2 size={14} />
                  </button>
                </div>

                {/* Comments Section Drawer */}
                {isCommentsOpen && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 space-y-3">
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
                                <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap mt-0.5">
                                  {comm.text}
                                </p>
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

                    {/* New Comment Input */}
                    <div className="flex items-center gap-2 pt-1">
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
                        placeholder="Apna comment likhein..."
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      />
                      <button
                        onClick={() => handleAddComment(post.id)}
                        disabled={
                          isSubmittingComment[post.id] || !(commentInputs[post.id] || '').trim()
                        }
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center ${
                          (commentInputs[post.id] || '').trim()
                            ? 'bg-purple-600 hover:bg-purple-700 cursor-pointer active:scale-95'
                            : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isSubmittingComment[post.id] ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
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
    </div>
  );
};
