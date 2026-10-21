import { useEffect, useState } from 'react';
import { api } from './api';
import { useChat } from './store';
import { Brand, ErrorNotice } from './components/ui';
import AuthPage from './AuthPage';
import ChatPage from './ChatPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api('/auth/me', { signal: controller.signal })
      .then(setUser)
      .catch((e) => {
        if (e.name !== 'AbortError' && e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  function clearSession() {
    useChat.getState().reset();
    setUser(null);
  }
  useEffect(() => {
    window.addEventListener('session-expired', clearSession);
    return () => window.removeEventListener('session-expired', clearSession);
  }, []);
  if (loading || error)
    return (
      <main className="boot-screen">
        <Brand />
        {error ? (
          <ErrorNotice retry={() => setRetry((n) => n + 1)}>{error}</ErrorNotice>
        ) : (
          <p role="status">Making a little room for connection…</p>
        )}
      </main>
    );
  return user ? (
    <ChatPage key={user._id} user={user} onSignedOut={clearSession} />
  ) : (
    <AuthPage onAuthenticated={setUser} />
  );
}
