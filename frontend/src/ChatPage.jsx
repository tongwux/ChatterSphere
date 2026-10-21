import { useEffect, useRef, useState } from 'react';
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiCheck,
  FiChevronDown,
  FiCompass,
  FiEdit3,
  FiInfo,
  FiLogOut,
  FiMessageSquare,
  FiSearch,
  FiSend,
  FiShield,
  FiSmile,
  FiX,
  FiZap,
} from 'react-icons/fi';
import { api } from './api';
import { Avatar, Brand, ErrorNotice } from './components/ui';
import { useChat } from './store';
import useMessenger from './useMessenger';

const time = (date) =>
  new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const day = (date) =>
  new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).format(
    new Date(date),
  );

function Composer({ recipient, send }) {
  const drafts = useChat((s) => s.drafts);
  const draft = useChat((s) => s.draft);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const input = useRef(null);
  const text = drafts[recipient._id] || '';
  async function submit(event) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    const outgoing = text;
    const retry = useChat.getState().attempts[recipient._id];
    const id = retry?.text === outgoing ? retry.id : crypto.randomUUID();
    useChat.getState().attempt(recipient._id, { text: outgoing, id });
    setSending(true);
    setError('');
    try {
      await send(recipient._id, outgoing, id);
      if (useChat.getState().drafts[recipient._id] === outgoing) draft(recipient._id, '');
      useChat.getState().attempt(recipient._id, null);
      input.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }
  return (
    <form className="composer-area" onSubmit={submit}>
      {error && <ErrorNotice>{error} Your draft is saved here; send again to retry.</ErrorNotice>}
      <div className="composer">
        <div className="emoji-wrap">
          <button
            className="icon-button"
            type="button"
            aria-label="Add emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen(!emojiOpen)}
          >
            <FiSmile />
          </button>
          {emojiOpen && (
            <div className="emoji-picker">
              {['👋', '😊', '✨', '🙌', '💚', '🎉'].map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  aria-label={`Insert ${emoji}`}
                  onClick={() => {
                    draft(recipient._id, (text + emoji).slice(0, 4000));
                    setEmojiOpen(false);
                    input.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={input}
          rows={1}
          aria-label="Message"
          placeholder={`Message ${recipient.fullName.split(' ')[0]}…`}
          maxLength={4000}
          value={text}
          onChange={(e) => {
            draft(recipient._id, e.target.value);
            setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(e);
            }
          }}
        />
        <button
          className="send-button"
          aria-label="Send message"
          type="submit"
          disabled={sending || !text.trim()}
        >
          {sending ? <span className="spinner" /> : <FiSend />}
        </button>
      </div>
      <div className="composer-hint">
        <span>Enter to send · Shift + Enter for a new line</span>
        <span>
          {text.length > 3500 ? (
            `${text.length}/4000`
          ) : (
            <>
              <FiShield /> Just between you two
            </>
          )}
        </span>
      </div>
    </form>
  );
}

function Conversation({ user, messenger }) {
  const selected = useChat((s) => s.selected);
  const select = useChat((s) => s.select);
  const scroll = useRef(null);
  const bottom = useRef(null);
  const previous = useRef({ id: null, last: null });
  const [newBelow, setNewBelow] = useState(false);
  const last = messenger.messages.at(-1)?._id;
  useEffect(() => {
    if (!scroll.current || !last) return;
    const changed = previous.current.id !== selected?._id;
    const el = scroll.current;
    if (
      changed ||
      el.scrollHeight - el.scrollTop - el.clientHeight < 250 ||
      messenger.messages.at(-1)?.senderId === user._id
    ) {
      bottom.current?.scrollIntoView({ behavior: changed ? 'instant' : 'smooth', block: 'end' });
      setNewBelow(false);
    } else if (previous.current.last !== last) setNewBelow(true);
    previous.current = { id: selected?._id, last };
  }, [last, selected?._id, user._id, messenger.messages]);
  async function older() {
    const el = scroll.current;
    const height = el.scrollHeight;
    await messenger.loadOlder();
    requestAnimationFrame(() => {
      if (scroll.current === el) el.scrollTop += el.scrollHeight - height;
    });
  }
  if (!selected)
    return (
      <section className="chat-panel welcome-panel">
        <div className="welcome-top">
          <span>
            <i className="tiny-dot" /> YOUR EVERYDAY CONNECTION
          </span>
          <span>EST. 2024</span>
        </div>
        <div className="welcome-content">
          <div className="welcome-illustration">
            <div className="welcome-orbit" />
            <span className="big-chat">
              <FiMessageSquare />
            </span>
            <span className="little-chat">
              <FiSmile />
            </span>
            <span className="welcome-star">✳</span>
            <span className="welcome-hello">hello, there.</span>
          </div>
          <div className="eyebrow muted">GOOD CONVERSATIONS START WITH YOU</div>
          <h1>
            Make room for
            <br />
            <em>a little connection.</em>
          </h1>
          <p>
            Pick a person, say hello, and see where it goes.
            <br />
            Your next great conversation is one message away.
          </p>
          <button
            className="primary-button welcome-cta"
            onClick={() => document.getElementById('people-search')?.focus()}
          >
            <FiEdit3 /> Start a conversation <FiArrowUpRight />
          </button>
        </div>
        <div className="welcome-bottom">
          <span>
            <FiZap /> In the moment
          </span>
          <span>
            <FiShield /> Made for just you two
          </span>
          <span>
            <FiSmile /> A space to be yourself
          </span>
        </div>
      </section>
    );
  const isOnline = messenger.online.includes(selected._id);
  return (
    <section
      className="chat-panel conversation-panel"
      aria-label={`Conversation with ${selected.fullName}`}
    >
      <header className="conversation-header">
        <button
          className="icon-button back-button"
          aria-label="Back to conversations"
          onClick={() => select(null)}
        >
          <FiArrowLeft />
        </button>
        <Avatar user={selected} online={isOnline} />
        <div className="conversation-person">
          <h2>{selected.fullName}</h2>
          <span>
            <i className={isOnline ? 'tiny-dot' : 'tiny-dot offline-dot'} />
            {isOnline ? 'Online now' : 'Offline · Messages will be here when they return'}
          </span>
        </div>
        <span className="private-badge">
          <FiShield /> Private conversation
        </span>
      </header>
      <div
        className="message-scroll"
        ref={scroll}
        onScroll={() => {
          const el = scroll.current;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) setNewBelow(false);
        }}
      >
        <div className="conversation-intro">
          <Avatar user={selected} large />
          <h3>{selected.fullName}</h3>
          <span>@{selected.username}</span>
          <p>This is the beginning of your conversation. Say something good.</p>
        </div>
        {messenger.cursor && (
          <button className="load-older" disabled={messenger.loading} onClick={older}>
            {messenger.loading ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}
        {messenger.loading && !messenger.messages.length && (
          <p className="empty-copy" role="status">
            Loading your conversation…
          </p>
        )}
        {messenger.error && <ErrorNotice retry={messenger.retry}>{messenger.error}</ErrorNotice>}
        <div className="messages" role="log" aria-live="polite" aria-relevant="additions">
          {messenger.messages.map((message, index, messages) => {
            const mine = message.senderId === user._id;
            const showDate =
              !index || day(messages[index - 1].createdAt) !== day(message.createdAt);
            return (
              <div key={message._id}>
                {showDate && (
                  <div className="day-divider">
                    <span>{day(message.createdAt)}</span>
                  </div>
                )}
                <div className={`message-row ${mine ? 'mine' : ''}`}>
                  {!mine && <Avatar user={selected} />}
                  <div className="message-content">
                    <div className="message-bubble">{message.message}</div>
                    <div className="message-meta">
                      <time dateTime={message.createdAt}>{time(message.createdAt)}</time>
                      {mine && (
                        <span title="Saved to server">
                          <FiCheck /> Sent
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottom} />
      </div>
      {newBelow && (
        <button
          className="new-below"
          onClick={() => {
            bottom.current?.scrollIntoView({ behavior: 'smooth' });
            setNewBelow(false);
          }}
        >
          New messages <FiChevronDown />
        </button>
      )}
      <Composer key={selected._id} recipient={selected} send={messenger.send} />
    </section>
  );
}

export default function ChatPage({ user, onSignedOut }) {
  const messenger = useMessenger(user);
  const selected = useChat((s) => s.selected);
  const select = useChat((s) => s.select);
  const unread = useChat((s) => s.unread);
  const [tab, setTab] = useState('messages');
  const [about, setAbout] = useState(false);
  const modal = useRef(null);
  useEffect(() => {
    if (about) modal.current?.showModal();
  }, [about]);
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  async function signOut() {
    setSigningOut(true);
    setLogoutError('');
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
      onSignedOut();
    } catch (e) {
      if (e.status === 401) onSignedOut();
      else setLogoutError(e.message);
    } finally {
      setSigningOut(false);
    }
  }
  const search = messenger.query.trim();
  const peopleMode = tab === 'people' || Boolean(search);
  const people = peopleMode
    ? messenger.directory.map((person) => ({ user: person }))
    : messenger.conversations;
  return (
    <div className={`chat-layout ${selected ? 'has-selection' : ''}`}>
      <nav className="rail" aria-label="Main navigation">
        <Brand compact />
        <div className="rail-nav">
          <button
            className={`rail-button ${tab === 'messages' ? 'active' : ''}`}
            aria-label="Messages"
            onClick={() => {
              setTab('messages');
              messenger.setQuery('');
            }}
          >
            <FiMessageSquare />
          </button>
          <button
            className={`rail-button ${tab === 'people' ? 'active' : ''}`}
            aria-label="Discover people"
            onClick={() => {
              setTab('people');
              messenger.setQuery('');
            }}
          >
            <FiCompass />
          </button>
        </div>
        <div className="rail-bottom">
          <button
            className="rail-button"
            aria-label="About ChatterSphere"
            onClick={() => setAbout(true)}
          >
            <FiInfo />
          </button>
          <span title={user.fullName}>
            <Avatar user={user} />
          </span>
        </div>
      </nav>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="sidebar-heading">
          <div>
            <span className="eyebrow muted">YOUR LITTLE CORNER</span>
            <h1>
              {tab === 'people' ? 'Find your people' : 'Conversations'}
              <span className="heading-dot">.</span>
            </h1>
          </div>
          <button
            className="new-chat"
            aria-label="New conversation"
            onClick={() => {
              setTab('people');
              document.getElementById('people-search')?.focus();
            }}
          >
            <FiEdit3 />
          </button>
        </div>
        <label className="search-field">
          <FiSearch />
          <input
            id="people-search"
            type="search"
            aria-label="Search people"
            placeholder="Search people…"
            value={messenger.query}
            onChange={(e) => messenger.setQuery(e.target.value)}
          />
        </label>
        <div className="list-tabs">
          <button
            className={tab === 'messages' && !search ? 'active' : ''}
            onClick={() => {
              setTab('messages');
              messenger.setQuery('');
            }}
          >
            Messages <span>{messenger.conversations.length}</span>
          </button>
          <button className={peopleMode ? 'active' : ''} onClick={() => setTab('people')}>
            People
          </button>
          <span className="live-label">
            <i
              className={messenger.connection === 'connected' ? 'tiny-dot' : 'tiny-dot offline-dot'}
            />
            {messenger.connection === 'connected' ? 'LIVE' : 'RECONNECTING'}
          </span>
        </div>
        <div className="people-list">
          <div className="list-caption">
            {peopleMode ? 'SOMEONE NEW, SOMETHING GOOD' : 'A LITTLE HELLO GOES A LONG WAY'}
          </div>
          {messenger.listError && (
            <ErrorNotice retry={messenger.retry}>{messenger.listError}</ErrorNotice>
          )}
          {people.map(({ user: person, lastMessage }) => (
            <button
              key={person._id}
              className={`person-row ${selected?._id === person._id ? 'selected' : ''}`}
              onClick={() => select(person)}
            >
              <Avatar user={person} online={messenger.online.includes(person._id)} />
              <div className="person-text">
                <div className="person-title">
                  <strong>{person.fullName}</strong>
                  {lastMessage && <time>{time(lastMessage.createdAt)}</time>}
                </div>
                <div className="person-preview">
                  <span>
                    {lastMessage
                      ? `${lastMessage.senderId === user._id ? 'You: ' : ''}${lastMessage.message}`
                      : `@${person.username}`}
                  </span>
                  {unread[person._id] > 0 && <b className="unread-badge">{unread[person._id]}</b>}
                </div>
              </div>
            </button>
          ))}
          {!people.length && !messenger.listError && (
            <div className="list-empty">
              <FiMessageSquare />
              <h3>
                {peopleMode
                  ? messenger.directoryLoading
                    ? 'Looking for your people…'
                    : 'No people found'
                  : 'Your story starts here.'}
              </h3>
              <p>
                {peopleMode
                  ? 'Try another name, or invite someone to create an account.'
                  : 'Find someone in People and send your first hello.'}
              </p>
              {!peopleMode && (
                <button className="text-button" onClick={() => setTab('people')}>
                  Discover people <FiArrowUpRight />
                </button>
              )}
            </div>
          )}
          {peopleMode && messenger.directoryCursor && (
            <button
              className="load-older"
              disabled={messenger.directoryLoading}
              onClick={messenger.loadMoreUsers}
            >
              Show more people
            </button>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="connection-note">
            <FiZap />
            <p>
              Better together.<span>Good things begin with a conversation.</span>
            </p>
          </div>
          {logoutError && <ErrorNotice>{logoutError}</ErrorNotice>}
          <div className="account-row">
            <Avatar user={user} />
            <div>
              <strong>{user.fullName}</strong>
              <span>@{user.username}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Sign out"
              disabled={signingOut}
              onClick={signOut}
            >
              <FiLogOut />
            </button>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <div className="workspace-top">
          <span>
            <span className="breadcrumb">YOUR SPACE</span>
            <span className="breadcrumb-slash">/</span>{' '}
            {selected ? selected.fullName : 'A place to connect'}
          </span>
          <button className="text-button" onClick={() => setAbout(true)}>
            A little about this space <FiArrowUpRight />
          </button>
        </div>
        {messenger.connection !== 'connected' && (
          <div className="connection-banner" role="status">
            {messenger.connection === 'connecting'
              ? 'Connecting to live chat…'
              : 'Live chat disconnected. Reconnecting automatically; your drafts are kept.'}
          </div>
        )}
        <Conversation user={user} messenger={messenger} />
        <footer className="workspace-footer">
          <span>LESS NOISE. MORE CONNECTION.</span>
          <span>
            Made with a little intention. <span className="footer-star">✳</span>
          </span>
        </footer>
      </main>
      {about && (
        <dialog
          ref={modal}
          className="about-modal"
          aria-labelledby="about-title"
          onCancel={(e) => {
            e.preventDefault();
            setAbout(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbout(false);
          }}
        >
          <button
            autoFocus
            className="icon-button modal-close"
            aria-label="Close about"
            onClick={() => setAbout(false)}
          >
            <FiX />
          </button>
          <Brand />
          <h2 id="about-title">Built for a little connection.</h2>
          <p>
            ChatterSphere is a working portfolio project by Tong Wu. Create an account, find another
            person, and chat in real time.
          </p>
          <p>
            Messages are stored in MongoDB. Authenticated sessions keep conversations between their
            participants. Messages are not end-to-end encrypted; the service operator can access
            stored data.
          </p>
          <div className="about-stack">React · Express · MongoDB · Socket.io</div>
          <p className="small-note">
            Rebuilt from an MIT-licensed tutorial foundation by Burak (2024). This showcase supports
            one-to-one text conversations on a single server.
          </p>
          <button className="primary-button" onClick={() => setAbout(false)}>
            Back to conversations <FiArrowUpRight />
          </button>
        </dialog>
      )}
    </div>
  );
}
