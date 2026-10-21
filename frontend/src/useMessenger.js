import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api } from './api';
import { useChat } from './store';

function mergeMessages(current, incoming) {
  return [
    ...new Map([...current, ...incoming].map((message) => [message._id, message])).values(),
  ].sort((a, b) => a._id.localeCompare(b._id));
}
export default function useMessenger(user) {
  const selected = useChat((s) => s.selected);
  const [conversations, setConversations] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [query, setQuery] = useState('');
  const [directoryCursor, setDirectoryCursor] = useState(null);
  const [online, setOnline] = useState([]);
  const [connection, setConnection] = useState('connecting');
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [revision, setRevision] = useState(0);
  const selection = useRef(selected);
  selection.current = selected;
  const currentQuery = useRef(query);
  currentQuery.current = query;
  const incoming = useRef([]);
  const fetchConversations = useCallback(async () => {
    try {
      const list = await api('/conversations');
      setConversations(list);
      setListError('');
    } catch (e) {
      setListError(e.message);
    }
  }, []);
  useEffect(() => {
    fetchConversations();
    const socket = io({ withCredentials: true });
    socket.on('connect', () => {
      setConnection('connected');
      setRevision((n) => n + 1);
      fetchConversations();
    });
    socket.on('disconnect', (reason) => {
      setOnline([]);
      setConnection('disconnected');
      if (reason === 'io server disconnect') window.dispatchEvent(new Event('session-expired'));
    });
    socket.on('connect_error', (e) => {
      setConnection('disconnected');
      if (e.message === 'Unauthorized') window.dispatchEvent(new Event('session-expired'));
    });
    socket.on('getOnlineUsers', setOnline);
    socket.on('newMessage', (message) => {
      incoming.current = [...incoming.current.slice(-200), message];
      const otherId = message.senderId === user._id ? message.receiverId : message.senderId;
      if (selection.current?._id === otherId) setMessages((list) => mergeMessages(list, [message]));
      else if (message.receiverId === user._id) useChat.getState().notify(otherId);
      fetchConversations();
    });
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        setRevision((n) => n + 1);
        fetchConversations();
      }
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      socket.disconnect();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user._id, fetchConversations]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setDirectoryLoading(true);
      try {
        const data = await api(`/users?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        setDirectory(data.users);
        setDirectoryCursor(data.nextCursor);
        setListError('');
      } catch (e) {
        if (e.name !== 'AbortError') setListError(e.message);
      } finally {
        if (!controller.signal.aborted) setDirectoryLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, revision]);
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setMessages([]);
    setCursor(null);
    api(`/messages/${selected._id}`, { signal: controller.signal })
      .then((data) => {
        const recent = incoming.current.filter(
          (m) =>
            (m.senderId === user._id && m.receiverId === selected._id) ||
            (m.senderId === selected._id && m.receiverId === user._id),
        );
        setMessages(mergeMessages(data.messages, recent));
        setCursor(data.nextCursor);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selected?._id, revision, user._id]);
  async function loadOlder() {
    const id = selected?._id;
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const data = await api(`/messages/${id}?before=${cursor}`);
      if (selection.current?._id === id) {
        setMessages((list) => mergeMessages(data.messages, list));
        setCursor(data.nextCursor);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      if (selection.current?._id === id) setLoading(false);
    }
  }
  async function loadMoreUsers() {
    if (!directoryCursor || directoryLoading) return;
    const captured = query;
    setDirectoryLoading(true);
    try {
      const data = await api(`/users?q=${encodeURIComponent(query)}&after=${directoryCursor}`);
      if (captured === currentQuery.current) {
        setDirectory((list) => [
          ...new Map([...list, ...data.users].map((u) => [u._id, u])).values(),
        ]);
        setDirectoryCursor(data.nextCursor);
      }
    } catch (e) {
      setListError(e.message);
    } finally {
      setDirectoryLoading(false);
    }
  }
  async function send(id, text, clientMessageId) {
    const saved = await api(`/messages/send/${id}`, {
      method: 'POST',
      body: { message: text, clientMessageId },
    });
    if (selection.current?._id === id) setMessages((list) => mergeMessages(list, [saved]));
    fetchConversations();
    return saved;
  }
  return {
    conversations,
    directory,
    query,
    setQuery,
    directoryCursor,
    loadMoreUsers,
    directoryLoading,
    online,
    connection,
    messages,
    cursor,
    loadOlder,
    loading,
    error,
    listError,
    send,
    retry: () => setRevision((n) => n + 1),
  };
}
