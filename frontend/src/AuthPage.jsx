import { useState } from 'react';
import {
  FiArrowUpRight,
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLock,
  FiZap,
  FiCheck,
  FiMessageCircle,
} from 'react-icons/fi';
import { api } from './api';
import { Avatar, Brand, ErrorNotice } from './components/ui';

export default function AuthPage({ onAuthenticated }) {
  const [signup, setSignup] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  function field(key, value) {
    setForm((s) => ({ ...s, [key]: value }));
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onAuthenticated(
        await api(`/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: form }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <div className="eyebrow">
            <span className="tiny-dot" /> MADE FOR REAL CONNECTION
          </div>
          <h1>
            A little closer.
            <br />
            <span>One hello</span>
            <br />
            at a time.
          </h1>
          <p>
            A space for the everyday catch-ups,
            <br className="desktop-break" /> the big ideas, and everything in between.
          </p>
          <div className="conversation-art" aria-label="An illustration of a friendly conversation">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="art-star">✳</span>
            <div className="art-message first">
              <Avatar user={{ fullName: 'Alex Morgan', username: 'alex' }} />
              <div>
                <span>Alex</span>
                <p>Good conversations start here.</p>
              </div>
              <small>10:24</small>
            </div>
            <div className="art-message second">
              <div>
                <span>You</span>
                <p>
                  Let’s make something great. <FiZap />
                </p>
              </div>
              <FiCheck />
            </div>
            <div className="art-message third">
              <span className="typing">
                <i />
                <i />
                <i />
              </span>
              <span>A little connection goes a long way.</span>
            </div>
          </div>
          <div className="story-features">
            <span>
              <FiZap /> Real-time conversations
            </span>
            <span>
              <FiLock /> Private by design
            </span>
          </div>
        </div>
        <div className="story-footer">
          <span>A small space. Endless possibilities.</span>
          <FiArrowUpRight />
        </div>
      </section>
      <main className="auth-main">
        <div className="project-label">
          <span className="tiny-dot" /> A REAL-TIME MESSAGING PROJECT
        </div>
        <div className="auth-form-wrap">
          <span className="hello-icon">
            <FiMessageCircle />
          </span>
          <div className="eyebrow muted">YOUR PEOPLE, JUST A MESSAGE AWAY</div>
          <h2>{signup ? 'Make yourself at home.' : 'Welcome back.'}</h2>
          <p className="auth-subtitle">
            {signup
              ? 'Create an account. Start a conversation.'
              : 'Pick up where your conversations left off.'}
          </p>
          <div className="auth-tabs" aria-label="Account access">
            <button
              className={!signup ? 'active' : ''}
              onClick={() => {
                setSignup(false);
                setError('');
              }}
            >
              Sign in
            </button>
            <button
              className={signup ? 'active' : ''}
              onClick={() => {
                setSignup(true);
                setError('');
              }}
            >
              Create account
            </button>
          </div>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Full name
                <input
                  name="fullName"
                  autoComplete="name"
                  placeholder="e.g. Alex Morgan"
                  required
                  minLength={2}
                  maxLength={60}
                  value={form.fullName}
                  onChange={(e) => field('fullName', e.target.value)}
                />
              </label>
            )}
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="Your username"
                required
                pattern="[a-z0-9_]{3,24}"
                title="3–24 lowercase letters, numbers or underscores"
                value={form.username}
                onChange={(e) => field('username', e.target.value)}
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  type={show ? 'text' : 'password'}
                  placeholder={signup ? 'At least 10 characters' : 'Your password'}
                  required
                  minLength={signup ? 10 : 1}
                  maxLength={72}
                  value={form.password}
                  onChange={(e) => field('password', e.target.value)}
                />
                <button
                  type="button"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  onClick={() => setShow(!show)}
                >
                  {show ? <FiEyeOff /> : <FiEye />}
                </button>
              </span>
            </label>
            {signup && (
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  autoComplete="new-password"
                  type={show ? 'text' : 'password'}
                  placeholder="One more time"
                  required
                  minLength={10}
                  maxLength={72}
                  value={form.confirmPassword}
                  onChange={(e) => field('confirmPassword', e.target.value)}
                />
              </label>
            )}
            {error && <ErrorNotice>{error}</ErrorNotice>}
            <button className="primary-button" disabled={busy} type="submit">
              {busy ? 'One moment…' : signup ? 'Create your account' : 'Step inside'}
              {!busy && <FiArrowRight />}
            </button>
          </form>
          <p className="auth-note">
            <FiLock /> Your conversations are only visible to you and their recipient.
          </p>
          <div className="portfolio-note">
            BUILT TO CONNECT <span>React · Node.js · MongoDB · Socket.io</span>
          </div>
        </div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} ChatterSphere</span>
          <span>
            A portfolio project by Tong Wu <FiArrowUpRight />
          </span>
        </footer>
      </main>
    </div>
  );
}
