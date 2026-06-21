import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

export default function UserMenu({ onSignInClick }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!user) {
    return (
      <button className="user-menu-signin" onClick={onSignInClick}
        aria-label="Sign in to save your progress">
        Sign In
      </button>
    )
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu-trigger" onClick={() => setOpen(o => !o)}
        aria-haspopup="true" aria-expanded={open}
        aria-label={`User menu for ${user.displayName || user.email}`}>
        {user.photoURL
          ? <img src={user.photoURL} alt="" className="user-avatar" width={28} height={28} />
          : <span className="user-avatar-fallback">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>}
        <span className="user-display-name">{user.displayName?.split(' ')[0] || 'You'}</span>
        <span aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-info">
            <div className="user-menu-name">{user.displayName || 'User'}</div>
            <div className="user-menu-email">{user.email}</div>
          </div>
          <hr className="user-menu-divider" />
          <button className="user-menu-item" role="menuitem"
            onClick={() => { setOpen(false); logout() }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
