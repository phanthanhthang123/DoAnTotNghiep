import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/provider/auth-context";
import {
  getChatSocket,
  isUserOnline,
  useAllUsersQuery,
  useChatRealtime,
  useConversationsQuery,
  useCreateDirectConversationMutation,
  useCreateGroupConversationMutation,
  useAddGroupMembersMutation,
  useRemoveGroupMemberMutation,
  useLeaveGroupMutation,
  useUpdateGroupTitleMutation,
  useDismissGroupMutation,
  useMessagesQuery,
  useOnlineUsers,
  useTypingState,
} from "@/hooks/use-chat";
import { Phone, Video } from "lucide-react";
import { MoreHorizontal, Pin, Pencil, Trash2, Plus, Users, LogOut, UserPlus } from "lucide-react";
import type { Conversation, Message, User } from "@/type";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

function chatUserInitials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
}

function getAvatarBgColor(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "bg-slate-200 text-slate-700 border-slate-300";
  const colors = [
    "bg-red-100 text-red-700 border-red-200",
    "bg-orange-100 text-orange-700 border-orange-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-green-100 text-green-700 border-green-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-cyan-100 text-cyan-700 border-cyan-200",
    "bg-sky-100 text-sky-700 border-sky-200",
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-violet-100 text-violet-700 border-violet-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
    "bg-pink-100 text-pink-700 border-pink-200",
    "bg-rose-100 text-rose-700 border-rose-200",
  ];
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = n.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

const ChatPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get("workspaceId");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchUserQuery, setSearchUserQuery] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Group creation states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Group member list & actions states
  const [isMemberListOpen, setIsMemberListOpen] = useState(false);
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [newMemberSearchQuery, setNewMemberSearchQuery] = useState("");
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");

  const [activeCallUserId, setActiveCallUserId] = useState<string | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingFromUserId, setIncomingFromUserId] = useState<string | null>(null);
  const [incomingMode, setIncomingMode] = useState<"audio" | "video">("audio");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const messageScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const { data: users = [] } = useAllUsersQuery();
  const { data: conversations = [] } = useConversationsQuery(workspaceId);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const { mutateAsync: createDirectConversation } = useCreateDirectConversationMutation();
  const { mutateAsync: createGroupConversation } = useCreateGroupConversationMutation();
  const { mutateAsync: addGroupMembers } = useAddGroupMembersMutation();
  const { mutateAsync: removeGroupMember } = useRemoveGroupMemberMutation();
  const { mutateAsync: leaveGroup } = useLeaveGroupMutation();
  const { mutateAsync: updateGroupTitle } = useUpdateGroupTitleMutation();
  const { mutateAsync: dismissGroup } = useDismissGroupMutation();

  const isOwnerOfActiveGroup = useMemo(() => {
    if (!activeConversation || activeConversation.type !== "group") return false;
    const currentMember = activeConversation.members?.find((m) => String(m.user_id) === String(user?.id));
    return currentMember?.role === "owner" || String(activeConversation?.created_by) === String(user?.id);
  }, [activeConversation, user?.id]);

  const usersNotInGroup = useMemo(() => {
    if (!activeConversation) return [];
    const memberIds = activeConversation.members?.map((m) => String(m.user_id)) || [];
    const q = newMemberSearchQuery.trim().toLowerCase();
    const candidates = users.filter((u) => !memberIds.includes(String(u.id)));
    if (!q) return candidates;
    return candidates.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, activeConversation, newMemberSearchQuery]);

  const handleToggleNewMember = (userId: string) => {
    setSelectedNewMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMembers = async () => {
    if (!activeConversationId || selectedNewMembers.length === 0) return;
    try {
      await addGroupMembers({ conversationId: activeConversationId, memberIds: selectedNewMembers });
      setSelectedNewMembers([]);
      setNewMemberSearchQuery("");
      setIsAddMemberDialogOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!activeConversationId) return;
    if (!confirm("Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm?")) return;
    try {
      await removeGroupMember({ conversationId: activeConversationId, targetUserId });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConversationId) return;
    if (!confirm("Bạn có chắc chắn muốn rời khỏi nhóm này?")) return;
    try {
      await leaveGroup({ conversationId: activeConversationId });
      setActiveConversationId(null);
      setIsMemberListOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateGroupName = async () => {
    if (!activeConversationId || !newGroupNameInput.trim()) return;
    try {
      await updateGroupTitle({ conversationId: activeConversationId, title: newGroupNameInput.trim() });
      setIsEditingGroupName(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissGroup = async () => {
    if (!activeConversationId) return;
    if (!confirm("Bạn có chắc chắn muốn giải tán nhóm này? Tất cả tin nhắn và thành viên sẽ bị xóa vĩnh viễn.")) return;
    try {
      await dismissGroup({ conversationId: activeConversationId });
      setActiveConversationId(null);
      setIsMemberListOpen(false);
    } catch (err) {
      console.error(err);
    }
  };


  // Filter workspace members for group creation list
  const filteredGroupMembers = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    const otherUsers = users.filter((u) => u.id !== user?.id);
    if (!q) return otherUsers;
    return otherUsers.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
    );
  }, [users, memberSearchQuery, user?.id]);

  const handleToggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim() || selectedMembers.length === 0) return;
    try {
      const res = (await createGroupConversation({
        title: groupTitle.trim(),
        memberIds: selectedMembers,
        workspaceId,
      })) as any;
      if (res?.response?.id) {
        setActiveConversationId(res.response.id);
      }
      // Reset form
      setGroupTitle("");
      setSelectedMembers([]);
      setMemberSearchQuery("");
      setIsGroupModalOpen(false);
    } catch (err) {
      console.error("Error creating group:", err);
    }
  };
  const socket = useChatRealtime(activeConversationId);
  const { onlineUserIds, lastSeenAtByUserId } = useOnlineUsers();
  const typingUserIds = useTypingState(activeConversationId);
  const [, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleDismissed = (payload: { conversationId: string }) => {
      if (payload.conversationId === activeConversationId) {
        alert("Nhóm chat này đã bị giải tán bởi trưởng nhóm.");
        setActiveConversationId(null);
        setIsMemberListOpen(false);
      }
    };
    socket.on("conversation:dismissed", handleDismissed);
    return () => {
      socket.off("conversation:dismissed", handleDismissed);
    };
  }, [socket, activeConversationId]);

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter users by typing search query
  const filteredUsers = useMemo(() => {
    const q = searchUserQuery.trim().toLowerCase();
    if (!q) return [];
    return users.filter(
      (u) =>
        u.id !== user?.id &&
        (u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    );
  }, [users, searchUserQuery, user?.id]);


  /** Gộp avatar/username từ API users + members hội thoại (tránh mất sender sau socket / cache cũ). */
  const userDirectory = useMemo(() => {
    const map = new Map<string, Partial<User>>();
    users.forEach((u) => {
      map.set(u.id, {
        id: u.id,
        username: u.username,
        email: u.email,
        avatarUrl: u.avatarUrl,
      });
    });
    if (user?.id) {
      const prev = map.get(user.id) || {};
      map.set(user.id, {
        ...prev,
        id: user.id,
        username: user.username ?? prev.username,
        email: user.email ?? prev.email,
        avatarUrl: user.avatarUrl ?? prev.avatarUrl,
      });
    }
    const mergeMembers = (c: Conversation | null) => {
      c?.members?.forEach((m) => {
        if (!m.user) return;
        const prev = map.get(m.user_id) || {};
        map.set(m.user_id, {
          ...prev,
          id: m.user_id,
          username: m.user.username ?? prev.username,
          email: m.user.email ?? prev.email,
          avatarUrl: m.user.avatarUrl ?? prev.avatarUrl,
        });
      });
    };
    mergeMembers(activeConversation);
    conversations.forEach((c) => mergeMembers(c));
    return map;
  }, [users, user, activeConversation, conversations]);

  const resolveChatProfile = (senderId: string, senderFromMsg?: Message["sender"]) => {
    const cached = userDirectory.get(senderId);
    return {
      username: senderFromMsg?.username || cached?.username || "Unknown",
      avatarUrl: senderFromMsg?.avatarUrl ?? cached?.avatarUrl ?? null,
    };
  };

  const { data: messages = [] } = useMessagesQuery(activeConversationId);
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      if (aTime === bTime) return a.id.localeCompare(b.id);
      return aTime - bTime;
    });
  }, [messages]);
  const pinnedMessages = useMemo(
    () =>
      sortedMessages
        .filter((m) => m.is_pinned)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sortedMessages]
  );
  const latestPinnedMessage = pinnedMessages[0] || null;

  useEffect(() => {
    if (!activeConversationId && conversations.length) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (activeConversationId) {
      socket.emit("message:read", { conversationId: activeConversationId });
    }
  }, [activeConversationId, socket]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeConversationId]);

  const scrollMessagesToBottom = () => {
    const container = messageScrollContainerRef.current;
    const viewport = container?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
      return;
    }
    messageEndRef.current?.scrollIntoView({ block: "end" });
  };

  useEffect(() => {
    if (!activeConversationId || !shouldAutoScrollRef.current) return;
    if (sortedMessages.length === 0) return;
    const frame = requestAnimationFrame(() => {
      scrollMessagesToBottom();
      setTimeout(scrollMessagesToBottom, 0);
      setTimeout(scrollMessagesToBottom, 120);
      shouldAutoScrollRef.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeConversationId, sortedMessages.length]);

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.type === "group") return conversation.title || "Nhóm";
    const other = conversation.members?.find((m) => m.user_id !== user?.id)?.user;
    return other?.username || "Direct chat";
  };

  const getOtherUser = (conversation: Conversation): User | null => {
    const other = conversation.members?.find((m) => m.user_id !== user?.id)?.user;
    return other || null;
  };

  const getPresenceText = (targetUserId?: string | null) => {
    if (!targetUserId) return "Offline";
    if (isUserOnline(onlineUserIds, targetUserId)) return "Online";
    const lastSeen = lastSeenAtByUserId[String(targetUserId)];
    if (!lastSeen) return "Offline";
    const minutes = Math.max(1, Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000));
    return `Offline ${minutes} phút trước`;
  };

  const activeOtherForHeader = activeConversation ? getOtherUser(activeConversation) : null;
  const headerDirectPeer =
    activeConversation?.type === "direct" && activeOtherForHeader
      ? resolveChatProfile(activeOtherForHeader.id, activeOtherForHeader)
      : null;

  const handleSendMessage = async () => {
    if (!activeConversationId || !messageInput.trim()) return;
    shouldAutoScrollRef.current = true;
    socket.emit("message:send", { conversationId: activeConversationId, content: messageInput.trim() });
    socket.emit("typing:stop", { conversationId: activeConversationId });
    setMessageInput("");
  };

  const handleStartEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditingText(content);
  };

  const handleSaveEditMessage = () => {
    if (!activeConversationId || !editingMessageId || !editingText.trim()) return;
    socket.emit("message:edit", {
      conversationId: activeConversationId,
      messageId: editingMessageId,
      content: editingText.trim(),
    });
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!activeConversationId) return;
    socket.emit("message:delete", {
      conversationId: activeConversationId,
      messageId,
    });
  };

  const handleTogglePinMessage = (messageId: string, nextPinned: boolean) => {
    if (!activeConversationId) return;
    socket.emit("message:pin", {
      conversationId: activeConversationId,
      messageId,
      isPinned: nextPinned,
    });
  };

  const focusMessageById = (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setFocusedMessageId(messageId);
    setShowPinnedPanel(false);
    setTimeout(() => {
      setFocusedMessageId((prev) => (prev === messageId ? null : prev));
    }, 1800);
  };

  const formatMessageTime = (iso?: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const startPeer = async (isVideo: boolean, toUserId: string, conversationId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc:ice-candidate", {
          toUserId,
          candidate: event.candidate,
          conversationId,
        });
      }
    };
    return pc;
  };

  const startCall = async (mode: "audio" | "video") => {
    if (!activeConversation) return;
    const other = getOtherUser(activeConversation);
    if (!other) return;

    setActiveCallUserId(other.id);
    socket.emit("call:invite", {
      conversationId: activeConversation.id,
      toUserId: other.id,
      mode,
    });

    const pc = await startPeer(mode === "video", other.id, activeConversation.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc:offer", {
      toUserId: other.id,
      offer,
      conversationId: activeConversation.id,
      mode,
    });
  };

  const endCall = () => {
    if (activeConversationId && activeCallUserId) {
      socket.emit("call:end", { conversationId: activeConversationId, toUserId: activeCallUserId });
    }
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setActiveCallUserId(null);
    setIsIncomingCall(false);
    setIncomingFromUserId(null);
  };

  useEffect(() => {
    const socketInstance = getChatSocket();
    const onIncomingCall = (payload: { fromUserId: string; mode: "audio" | "video" }) => {
      setIncomingFromUserId(payload.fromUserId);
      setIncomingMode(payload.mode);
      setIsIncomingCall(true);
    };

    const onOffer = async (payload: {
      fromUserId: string;
      offer: RTCSessionDescriptionInit;
      conversationId: string;
      mode?: "audio" | "video";
    }) => {
      try {
        const useVideo = payload.mode === "video";
        const pc = await startPeer(useVideo, payload.fromUserId, payload.conversationId);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketInstance.emit("webrtc:answer", {
          toUserId: payload.fromUserId,
          answer,
          conversationId: payload.conversationId,
        });
      } catch (error) {
        console.error("Failed to handle offer:", error);
      }
    };

    const onAnswer = async (payload: { answer: RTCSessionDescriptionInit }) => {
      if (!peerRef.current) return;
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
    };

    const onIce = async (payload: { candidate: RTCIceCandidateInit }) => {
      if (!peerRef.current) return;
      await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
    };

    const onCallEnded = () => endCall();

    socketInstance.on("call:incoming", onIncomingCall);
    socketInstance.on("webrtc:offer", onOffer);
    socketInstance.on("webrtc:answer", onAnswer);
    socketInstance.on("webrtc:ice-candidate", onIce);
    socketInstance.on("call:ended", onCallEnded);

    return () => {
      socketInstance.off("call:incoming", onIncomingCall);
      socketInstance.off("webrtc:offer", onOffer);
      socketInstance.off("webrtc:answer", onAnswer);
      socketInstance.off("webrtc:ice-candidate", onIce);
      socketInstance.off("call:ended", onCallEnded);
    };
  }, [incomingMode]);

  return (
    <div className="h-full rounded-lg border overflow-hidden bg-white">
      <div className="grid grid-cols-12 h-full min-h-0">
        <div className="col-span-4 border-r p-3 min-h-0">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Tin nhắn</h2>
            <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" title="Tạo nhóm chat">
                  <Users className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                  <DialogTitle>Tạo nhóm chat mới</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Tên nhóm</label>
                    <Input
                      placeholder="Nhập tên nhóm..."
                      value={groupTitle}
                      onChange={(e) => setGroupTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600">
                        Chọn thành viên ({selectedMembers.length})
                      </label>
                    </div>
                    <Input
                      placeholder="Tìm thành viên..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <ScrollArea className="h-48 border rounded-md p-2 bg-slate-50/50">
                      <div className="space-y-1.5">
                        {filteredGroupMembers.length > 0 ? (
                          filteredGroupMembers.map((u) => {
                            const isChecked = selectedMembers.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleToggleMember(u.id)}
                                className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-slate-100 rounded transition-colors text-left text-xs"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleToggleMember(u.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={u.avatarUrl || undefined} alt={u.username || ""} />
                                  <AvatarFallback className="text-[9px]">
                                    {chatUserInitials(u.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                  <p className="font-medium text-slate-800">{u.username}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-center text-xs text-muted-foreground py-4">
                            Không tìm thấy thành viên
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
                <DialogFooter className="sm:justify-end gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsGroupModalOpen(false);
                      setGroupTitle("");
                      setSelectedMembers([]);
                      setMemberSearchQuery("");
                    }}
                  >
                    Hủy
                  </Button>
                  <Button onClick={handleCreateGroup} disabled={!groupTitle.trim() || selectedMembers.length === 0}>
                    Tạo nhóm
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div ref={searchContainerRef} className="relative mt-3">
            <Input
              placeholder="Tìm kiếm thành viên..."
              value={searchUserQuery}
              onChange={(e) => {
                setSearchUserQuery(e.target.value);
                setIsSearchDropdownOpen(true);
              }}
              onFocus={() => setIsSearchDropdownOpen(true)}
              className="w-full text-sm h-9"
            />
            {isSearchDropdownOpen && searchUserQuery.trim() !== "" && (
              <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto z-50 bg-white border rounded-md shadow-lg p-1">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={async () => {
                        setSearchUserQuery("");
                        setIsSearchDropdownOpen(false);
                        const res = (await createDirectConversation({ targetUserId: u.id, workspaceId })) as any;
                        if (res?.response?.id) {
                          setActiveConversationId(res.response.id);
                        }
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 rounded flex items-center gap-2 transition-colors"
                    >
                      <Avatar className="h-7 w-7 rounded-full border border-slate-200">
                        <AvatarImage src={u.avatarUrl || undefined} alt={u.username || ""} />
                        <AvatarFallback className="text-[10px] font-semibold">
                          {chatUserInitials(u.username)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 truncate">
                        <p className="font-semibold text-slate-800 text-xs">{u.username}</p>
                        <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Không tìm thấy thành viên
                  </div>
                )}
              </div>
            )}
          </div>
          <Separator className="my-3" />
          <ScrollArea className="h-[calc(100%-96px)]">
            <div className="space-y-2 pr-2">
              {conversations.map((conversation) => {
                const other = getOtherUser(conversation);
                const isOnline = other ? isUserOnline(onlineUserIds, other.id) : false;
                const presenceText =
                  conversation.type === "direct"
                    ? getPresenceText(other?.id)
                    : isOnline
                      ? "Online"
                      : "Offline";
                const directPeer = conversation.type === "direct" ? other : null;
                const listPeerUi = directPeer ? resolveChatProfile(directPeer.id, directPeer) : null;
                const title = getConversationTitle(conversation);
                const initials = chatUserInitials(title);
                const bgClass = getAvatarBgColor(title);
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full text-left p-2 rounded border ${activeConversationId === conversation.id ? "bg-blue-50 border-blue-200" : "hover:bg-muted"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className={`h-10 w-10 min-h-10 min-w-10 shrink-0 rounded-full border ${bgClass}`}>
                          {listPeerUi?.avatarUrl && (
                            <AvatarImage
                              src={listPeerUi.avatarUrl}
                              alt={title}
                            />
                          )}
                          <AvatarFallback className="text-xs font-semibold bg-transparent">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm truncate">{title}</span>
                      </div>
                      {!!conversation.unreadCount && <Badge variant="destructive">{conversation.unreadCount}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate max-w-[220px]">
                      {conversation.lastMessage?.content || "Chưa có tin nhắn"}
                    </div>
                    {conversation.type === "direct" && (
                      <div className="mt-1">
                        <Badge variant={isOnline ? "default" : "outline"}>{presenceText}</Badge>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="col-span-8 flex flex-col h-full min-h-0">
          {activeConversation ? (
            <>
              <div className="border-b p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {(() => {
                    const activeTitle = getConversationTitle(activeConversation);
                    const activeInitials = chatUserInitials(activeTitle);
                    const activeBg = getAvatarBgColor(activeTitle);

                    return (
                      <Avatar className={`h-11 w-11 shrink-0 rounded-full border ${activeBg}`}>
                        {headerDirectPeer?.avatarUrl && (
                          <AvatarImage
                            src={headerDirectPeer.avatarUrl}
                            alt={activeTitle}
                          />
                        )}
                        <AvatarFallback className="text-sm font-semibold bg-transparent">
                          {activeInitials}
                        </AvatarFallback>
                      </Avatar>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{getConversationTitle(activeConversation)}</p>
                    <div className="text-xs text-muted-foreground">
                      {typingUserIds.length > 0 ? (
                        "Đang nhập..."
                      ) : activeConversation.type === "direct" ? (
                        getPresenceText(getOtherUser(activeConversation)?.id)
                      ) : (
                        <button
                          onClick={() => setIsMemberListOpen(true)}
                          className="hover:underline text-blue-600 font-medium flex items-center gap-1"
                        >
                          Nhóm · {activeConversation.members?.length || 0} thành viên
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {activeConversation.type === "direct" && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => startCall("audio")}>
                      <Phone className="size-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => startCall("video")}>
                      <Video className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {pinnedMessages.length > 0 && latestPinnedMessage && (
                <div className="border-b bg-amber-50/60 px-3 py-2">
                  <button
                    className="w-full flex items-center justify-between gap-3 text-left"
                    onClick={() => setShowPinnedPanel((prev) => !prev)}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                        <Pin className="size-3.5" />
                        Tin nhắn đã ghim ({pinnedMessages.length})
                      </p>
                      <p className="text-xs text-slate-700 truncate mt-1">
                        {latestPinnedMessage.sender?.username || "User"}: {latestPinnedMessage.content}
                      </p>
                    </div>
                    <Badge variant="outline">{showPinnedPanel ? "Ẩn" : "Xem"}</Badge>
                  </button>

                  {showPinnedPanel && (
                    <div className="mt-2 rounded border border-amber-200 bg-white max-h-52 overflow-y-auto">
                      {pinnedMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className="px-3 py-2 border-b last:border-b-0 hover:bg-amber-50/60"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button className="min-w-0 text-left flex-1" onClick={() => focusMessageById(msg.id)}>
                              <p className="text-[11px] text-slate-500 truncate">
                                {msg.sender?.username || "User"} · {formatMessageTime(msg.createdAt)}
                              </p>
                              <p className="text-xs text-slate-800 truncate">{msg.content}</p>
                            </button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs shrink-0"
                              onClick={() => handleTogglePinMessage(msg.id, false)}
                            >
                              Bỏ ghim
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isIncomingCall && (
                <div className="p-3 bg-amber-50 border-b flex items-center justify-between">
                  <p className="text-sm">
                    Cuộc gọi {incomingMode === "video" ? "video" : "thoại"} đến từ user {incomingFromUserId}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (incomingFromUserId && activeConversationId) {
                          socket.emit("call:accept", {
                            conversationId: activeConversationId,
                            toUserId: incomingFromUserId,
                          });
                          setActiveCallUserId(incomingFromUserId);
                          setIsIncomingCall(false);
                        }
                      }}
                    >
                      Nhận
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (incomingFromUserId && activeConversationId) {
                          socket.emit("call:reject", {
                            conversationId: activeConversationId,
                            toUserId: incomingFromUserId,
                          });
                        }
                        setIsIncomingCall(false);
                      }}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              )}

              {activeCallUserId && (
                <div className="p-3 border-b bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Đang trong cuộc gọi</span>
                    <Button variant="destructive" size="sm" onClick={endCall}>
                      Kết thúc
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded bg-black h-36" />
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded bg-black h-36" />
                  </div>
                </div>
              )}

              <div ref={messageScrollContainerRef} className="flex-1 min-h-0">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-3 pb-2">
                    {sortedMessages.map((message) => {
                      if (message.type === "system") {
                        return (
                          <div key={message.id} className="flex justify-center w-full my-1.5">
                            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60 shadow-sm">
                              {message.content}
                            </span>
                          </div>
                        );
                      }

                      const mine = message.sender_id === user?.id;
                      const isEditing = editingMessageId === message.id;
                      const profile = mine
                        ? {
                          username: user?.username || "Bạn",
                          avatarUrl: user?.avatarUrl ?? null,
                        }
                        : resolveChatProfile(message.sender_id, message.sender);

                      const bubble = (
                        <div
                          className={`max-w-[min(70vw,28rem)] rounded-lg px-3 py-2 text-sm ${mine ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"
                            }`}
                        >
                          {!mine && (
                            <div className="text-[11px] opacity-70 mb-1">{profile.username}</div>
                          )}
                          {isEditing ? (
                            <div className="space-y-2">
                              <Input
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="bg-white text-slate-900 h-8"
                              />
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="bg-white text-slate-900 hover:bg-slate-100"
                                  onClick={() => setEditingMessageId(null)}
                                >
                                  Hủy
                                </Button>
                                <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-500" onClick={handleSaveEditMessage}>
                                  Lưu
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>{message.content}</div>
                          )}
                          <div className={`mt-1 text-[11px] ${mine ? "text-blue-100" : "text-slate-500"}`}>
                            {formatMessageTime(message.createdAt)}
                            {message.edited_at ? " · đã chỉnh sửa" : ""}
                            {message.is_pinned ? " · đã ghim" : ""}
                          </div>
                        </div>
                      );

                      const menu = !isEditing ? (
                        <div className="shrink-0 self-start opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={mine ? "start" : "end"}>
                              {mine ? (
                                <DropdownMenuItem onClick={() => handleStartEditMessage(message.id, message.content)}>
                                  <Pencil className="size-4 mr-2" /> Chỉnh sửa
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() => handleTogglePinMessage(message.id, !message.is_pinned)}
                              >
                                <Pin className="size-4 mr-2" /> {message.is_pinned ? "Bỏ ghim" : "Ghim"}
                              </DropdownMenuItem>
                              {mine ? (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="size-4 mr-2" /> Xóa
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null;

                      return (
                        <div
                          key={message.id}
                          ref={(el) => {
                            messageRefs.current[message.id] = el;
                          }}
                          className={`flex w-full group ${mine ? "justify-end" : "justify-start"
                            } ${focusedMessageId === message.id ? "ring-2 ring-amber-300 rounded-md" : ""}`}
                        >
                          {mine ? (
                            <div className="flex max-w-[min(92%,36rem)] flex-row-reverse items-end gap-2">
                              <Avatar className="h-10 w-10 min-h-10 min-w-10 shrink-0 rounded-full border border-slate-200 bg-muted">
                                <AvatarImage src={profile.avatarUrl || undefined} alt={profile.username || ""} />
                                <AvatarFallback className="text-xs font-semibold">
                                  {chatUserInitials(profile.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex min-w-0 flex-row-reverse items-start gap-1">
                                {bubble}
                                {menu}
                              </div>
                            </div>
                          ) : (
                            <div className="flex max-w-[min(92%,36rem)] items-end gap-2">
                              <Avatar className="h-10 w-10 min-h-10 min-w-10 shrink-0 rounded-full border border-slate-200 bg-muted">
                                <AvatarImage src={profile.avatarUrl || undefined} alt={profile.username || ""} />
                                <AvatarFallback className="text-xs font-semibold">
                                  {chatUserInitials(profile.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex min-w-0 items-start gap-1">
                                {bubble}
                                {menu}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </div>
                </ScrollArea>
              </div>

              <div className="p-3 border-t flex gap-2 bg-white min-w-0">
                <Input
                  className="flex-1 min-w-0"
                  placeholder="Nhập tin nhắn..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    if (activeConversationId) {
                      socket.emit("typing:start", { conversationId: activeConversationId });
                    }
                  }}
                  onBlur={() => {
                    if (activeConversationId) socket.emit("typing:stop", { conversationId: activeConversationId });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                />
                <Button className="shrink-0 min-w-16" onClick={handleSendMessage} disabled={!messageInput.trim()}>
                  Gửi
                </Button>
              </div>

              {/* Dialog hiển thị danh sách thành viên nhóm */}
              <Dialog open={isMemberListOpen} onOpenChange={setIsMemberListOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                  <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
                    <DialogTitle>Thành viên nhóm ({activeConversation.members?.length || 0})</DialogTitle>
                    {isOwnerOfActiveGroup && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1 h-8"
                        onClick={() => setIsAddMemberDialogOpen(true)}
                      >
                        <UserPlus className="size-3.5" /> Thêm
                      </Button>
                    )}
                  </DialogHeader>

                  {isOwnerOfActiveGroup && (
                    <div className="p-3 bg-slate-50 rounded-md border border-slate-200 mb-2 space-y-2 mt-2">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cấu hình nhóm</p>
                      {isEditingGroupName ? (
                        <div className="flex gap-2">
                          <Input
                            value={newGroupNameInput}
                            onChange={(e) => setNewGroupNameInput(e.target.value)}
                            placeholder="Nhập tên nhóm mới..."
                            className="bg-white h-8 text-xs flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-blue-600 text-white hover:bg-blue-500"
                            onClick={handleUpdateGroupName}
                            disabled={!newGroupNameInput.trim() || newGroupNameInput.trim() === activeConversation.title}
                          >
                            Lưu
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs bg-white text-slate-800"
                            onClick={() => setIsEditingGroupName(false)}
                          >
                            Hủy
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-[200px]">{activeConversation.title}</span>
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs bg-white hover:bg-slate-100 flex items-center gap-1"
                              onClick={() => {
                                setNewGroupNameInput(activeConversation.title || "");
                                setIsEditingGroupName(true);
                              }}
                            >
                              <Pencil className="size-3" /> Đổi tên
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-xs flex items-center gap-1 bg-red-600 text-white hover:bg-red-500"
                              onClick={handleDismissGroup}
                            >
                              <Trash2 className="size-3" /> Giải tán
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <ScrollArea className="max-h-80 pr-2 mt-2">
                    <div className="space-y-2">
                      {activeConversation.members?.map((m) => {
                        const mUser = m.user;
                        if (!mUser) return null;
                        const isMe = mUser.id === user?.id;
                        const isOnline = isUserOnline(onlineUserIds, mUser.id);
                        const presenceText = getPresenceText(mUser.id);
                        return (
                          <div key={m.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={mUser.avatarUrl || undefined} alt={mUser.username || ""} />
                                <AvatarFallback className="text-[10px] font-semibold">
                                  {chatUserInitials(mUser.username)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                  <span>{mUser.username}</span>
                                  {isMe && <span className="text-[10px] text-slate-400 font-normal">(Bạn)</span>}
                                  {m.role === "owner" && <Badge variant="secondary" className="text-[9px] px-1 py-0 scale-90">Trưởng nhóm</Badge>}
                                </div>
                                <p className="text-[10px] text-slate-500 truncate">{mUser.email}</p>
                                <div className="text-[9px] mt-0.5 flex items-center">
                                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${isOnline ? "bg-green-500" : "bg-slate-400"}`}></span>
                                  <span>{presenceText}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions on members */}
                            <div className="flex gap-1 shrink-0 items-center">
                              {isOwnerOfActiveGroup && !isMe && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleRemoveMember(mUser.id)}
                                  title="Xóa thành viên khỏi nhóm"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                              {isMe && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 flex items-center gap-1"
                                  onClick={handleLeaveGroup}
                                >
                                  <LogOut className="size-3" /> Rời nhóm
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsMemberListOpen(false)}>Đóng</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Dialog thêm thành viên vào nhóm */}
              <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
                <DialogContent className="sm:max-w-md bg-white">
                  <DialogHeader>
                    <DialogTitle>Thêm thành viên vào nhóm</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <Input
                      placeholder="Tìm kiếm thành viên..."
                      value={newMemberSearchQuery}
                      onChange={(e) => setNewMemberSearchQuery(e.target.value)}
                      className="h-8 text-xs"
                    />
                    <ScrollArea className="h-48 border rounded-md p-2 bg-slate-50/50">
                      <div className="space-y-1.5">
                        {usersNotInGroup.length > 0 ? (
                          usersNotInGroup.map((u) => {
                            const isChecked = selectedNewMembers.includes(u.id);
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleToggleNewMember(u.id)}
                                className="w-full flex items-center gap-3 px-2 py-1.5 hover:bg-slate-100 rounded transition-colors text-left text-xs"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => handleToggleNewMember(u.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={u.avatarUrl || undefined} alt={u.username || ""} />
                                  <AvatarFallback className="text-[9px]">
                                    {chatUserInitials(u.username)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                  <p className="font-medium text-slate-800">{u.username}</p>
                                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-center text-xs text-muted-foreground py-4">
                            Không có thành viên mới để thêm
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  <DialogFooter className="sm:justify-end gap-2 sm:gap-0">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddMemberDialogOpen(false);
                        setSelectedNewMembers([]);
                        setNewMemberSearchQuery("");
                      }}
                    >
                      Hủy
                    </Button>
                    <Button onClick={handleAddMembers} disabled={selectedNewMembers.length === 0}>
                      Thêm thành viên ({selectedNewMembers.length})
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">Chọn hội thoại để bắt đầu</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
