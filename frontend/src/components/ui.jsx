import { FiMessageSquare } from 'react-icons/fi';
export function Brand({ compact = false }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <FiMessageSquare />
      </span>
      {!compact && (
        <span>
          Chatter<span className="brand-light">Sphere</span>
          <sup aria-hidden="true">✳</sup>
        </span>
      )}
    </div>
  );
}
export function Avatar({ user, online, large = false }) {
  const initials = (user?.fullName || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join('');
  const hue = [...(user?.username || '')].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 5;
  return (
    <span className={`avatar avatar-${hue} ${large ? 'avatar-large' : ''}`} aria-hidden="true">
      {initials}
      {online && <i className="online-dot" />}
    </span>
  );
}
export function ErrorNotice({ children, retry }) {
  return (
    <div className="error-notice" role="alert">
      <span>{children}</span>
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
