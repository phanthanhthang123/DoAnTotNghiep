import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchData, postData, updateData, deleteData } from "@/lib/fetch-utlis";
import type { Conversation, Message, User } from "@/type";
import { io, type Socket } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1";
const SOCKET_BASE = API_BASE.replace("/api/v1", "");

let socketRef: Socket | null = null;

export const getChatSocket = () => {
  if (socketRef) return socketRef;
  const token = localStorage.getItem("token");
  socketRef = io(SOCKET_BASE, {
    transports: ["websocket"],
    auth: { token },
  });
  return socketRef;
};

export const disconnectChatSocket = () => {
  if (socketRef) {
    socketRef.disconnect();
    socketRef = null;
  }
};

/** So sánh userId với danh sách online (server có thể gửi id dạng string/number). */
export const isUserOnline = (onlineUserIds: string[], userId?: string | null) => {
  if (userId == null || userId === "") return false;
  const sid = String(userId);
  return onlineUserIds.some((id) => String(id) === sid);
};

export const useConversationsQuery = (workspaceId?: string | null) => {
  let userId: string | null = null;
  try {
    const raw = localStorage.getItem("user");
    if (raw) {
      const parsed = JSON.parse(raw);
      userId = parsed?.id || null;
    }
  } catch {
    userId = null;
  }

  return useQuery<Conversation[]>({
    queryKey: ["chat-conversations", userId, workspaceId],
    queryFn: async () => {
      const query = workspaceId ? `?workspaceId=${workspaceId}` : "";
      const res = await fetchData<{ err: number; response: Conversation[] }>(`/chat/conversations${query}`);
      return res?.response || [];
    },
    enabled: !!userId,
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
};

export const useMessagesQuery = (conversationId?: string | null) => {
  return useQuery<Message[]>({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      const res = await fetchData<{ err: number; response: Message[] }>(
        `/chat/conversations/${conversationId}/messages`
      );
      return res?.response || [];
    },
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
  });
};

export const useAllUsersQuery = () => {
  return useQuery<User[]>({
    queryKey: ["chat-users"],
    queryFn: async () => {
      const res = await fetchData<{ err: number; response: User[] }>("/auth/users");
      return res?.response || [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
};

export const useCreateDirectConversationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { targetUserId: string; workspaceId?: string | null }) =>
      postData("/chat/conversations/direct", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
};

export const useCreateGroupConversationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { title: string; memberIds: string[]; workspaceId?: string | null }) =>
      postData("/chat/conversations/group", payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
};

export const useAddGroupMembersMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversationId: string; memberIds: string[] }) =>
      postData(`/chat/conversations/${payload.conversationId}/members/add`, { memberIds: payload.memberIds }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.conversationId] });
    },
  });
};

export const useRemoveGroupMemberMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversationId: string; targetUserId: string }) =>
      postData(`/chat/conversations/${payload.conversationId}/members/remove`, { targetUserId: payload.targetUserId }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.conversationId] });
    },
  });
};

export const useLeaveGroupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversationId: string }) =>
      postData(`/chat/conversations/${payload.conversationId}/members/leave`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
};

export const useUpdateGroupTitleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversationId: string; title: string }) =>
      updateData(`/chat/conversations/${payload.conversationId}/title`, { title: payload.title }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.conversationId] });
    },
  });
};

export const useDismissGroupMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversationId: string }) =>
      deleteData(`/chat/conversations/${payload.conversationId}/dismiss`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
};

export const useSendMessageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversationId: string; content: string }) =>
      postData(`/chat/conversations/${payload.conversationId}/messages`, { content: payload.content }),
    onSuccess: async (_res, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", variables.conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
};

export const useTypingState = (conversationId?: string | null) => {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  useEffect(() => {
    const socket = getChatSocket();
    const onTyping = (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (!conversationId || payload.conversationId !== conversationId) return;
      setTypingUserIds((prev) => {
        if (payload.isTyping) return prev.includes(payload.userId) ? prev : [...prev, payload.userId];
        return prev.filter((id) => id !== payload.userId);
      });
    };
    socket.on("typing:update", onTyping);
    return () => {
      socket.off("typing:update", onTyping);
    };
  }, [conversationId]);
  return typingUserIds;
};

export const useOnlineUsers = () => {
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [lastSeenAtByUserId, setLastSeenAtByUserId] = useState<Record<string, string>>({});
  useEffect(() => {
    const socket = getChatSocket();
    const onPresence = (payload: { onlineUserIds: string[]; lastSeenAtByUserId?: Record<string, string> }) => {
      setOnlineUserIds((payload.onlineUserIds || []).map((id) => String(id)));
      const normalized: Record<string, string> = {};
      Object.entries(payload.lastSeenAtByUserId || {}).forEach(([k, v]) => {
        normalized[String(k)] = v;
      });
      setLastSeenAtByUserId(normalized);
    };
    socket.on("presence:update", onPresence);
    socket.emit("presence:sync");
    return () => {
      socket.off("presence:update", onPresence);
    };
  }, []);
  return { onlineUserIds, lastSeenAtByUserId };
};

export const useChatRealtime = (conversationId?: string | null) => {
  const queryClient = useQueryClient();
  const socket = useMemo(() => getChatSocket(), []);

  useEffect(() => {
    if (!conversationId) return;
    socket.emit("conversation:join", { conversationId });
  }, [conversationId, socket]);

  useEffect(() => {
    const onMessage = (payload: { conversationId: string; message: Message }) => {
      queryClient.setQueryData<Message[]>(["chat-messages", payload.conversationId], (old) => {
        const prev = old || [];
        if (prev.some((m) => m.id === payload.message.id)) return prev;
        return [...prev, payload.message];
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };

    const onReadUpdated = (payload: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-messages", payload.conversationId] });
    };

    const onMessageUpdated = (payload: { conversationId: string; message: Message }) => {
      queryClient.setQueryData<Message[]>(["chat-messages", payload.conversationId], (old) => {
        const prev = old || [];
        return prev.map((m) => (m.id === payload.message.id ? payload.message : m));
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };

    const onMessageDeleted = (payload: { conversationId: string; messageId: string }) => {
      queryClient.setQueryData<Message[]>(["chat-messages", payload.conversationId], (old) => {
        const prev = old || [];
        return prev.filter((m) => m.id !== payload.messageId);
      });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };

    const onRenamed = (payload: { conversationId: string; title: string }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };

    const onDismissed = (payload: { conversationId: string }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };

    socket.on("message:new", onMessage);
    socket.on("message:read:updated", onReadUpdated);
    socket.on("message:updated", onMessageUpdated);
    socket.on("message:pinned", onMessageUpdated);
    socket.on("message:deleted", onMessageDeleted);
    socket.on("conversation:renamed", onRenamed);
    socket.on("conversation:dismissed", onDismissed);
    return () => {
      socket.off("message:new", onMessage);
      socket.off("message:read:updated", onReadUpdated);
      socket.off("message:updated", onMessageUpdated);
      socket.off("message:pinned", onMessageUpdated);
      socket.off("message:deleted", onMessageDeleted);
      socket.off("conversation:renamed", onRenamed);
      socket.off("conversation:dismissed", onDismissed);
    };
  }, [queryClient, socket]);

  return socket;
};

export const useUnreadChatCount = (workspaceId?: string | null) => {
  const { data: conversations = [] } = useConversationsQuery(workspaceId);
  const totalUnread = conversations.reduce((sum, c) => sum + Number(c.unreadCount || 0), 0);
  return totalUnread;
};

