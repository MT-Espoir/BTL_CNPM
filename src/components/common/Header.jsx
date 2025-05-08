import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './Header.css';
import logoIcon from '../../assets/logo.png';
import userAvatar from '../../assets/avatar.jpg';
import { FaBell } from 'react-icons/fa';
import NotificationPanel from './NotificationPanel';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // Add useLocation hook to track current path
  const { user, logout, isAuthenticated } = useAuth();
  const userMenuRef = useRef(null);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  const navigateToManager = () => {
    setShowUserMenu(false);
    navigate('/manager');
  };

  // Function to check if a link is active
  const isActive = (path) => {
    if (path === '/home' && location.pathname === '/') {
      return true;
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="header">
      <div className="logo-container">
        <img src={logoIcon} alt="HCMUT Logo" className="bk-logo" />
        <div className="logo-text">
          <span className="logo-title">HCMUT</span>
          <span className="logo-subtitle">Booking room</span>
        </div>
      </div>

      <nav className="main-nav">
        <ul>
          <li><Link to="/home" className={isActive('/home') ? 'active' : ''}>Home</Link></li>
          <li><Link to="/room-search" className={isActive('/room-search') ? 'active' : ''}>Tìm phòng</Link></li>
          <li><Link to="/myroom" className={isActive('/myroom') ? 'active' : ''}>My Rooms</Link></li>
          <li><Link to="/user-about" className={isActive('/user-about') ? 'active' : ''}>About</Link></li>
        </ul>
      </nav>

      <div className="user-actions">
        {isAuthenticated && (
          <>
            <div className="notification-icon" onClick={() => setShowNotifications(!showNotifications)}>
              <FaBell />
              <span className="notification-badge">3</span>
            </div>

            <div className="user-info" ref={userMenuRef}>
              <div className="avatar-container">
                <img 
                  src={userAvatar} 
                  alt="User" 
                  className="avatar" 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                />
                
                {showUserMenu && (
                  <div className="user-dropdown-menu">
                    {/* Only show Manager option to non-student roles */}
                    {user?.role?.toLowerCase() !== 'student' && (
                      <div className="user-dropdown-item" onClick={navigateToManager}>
                        Manager
                      </div>
                    )}
                    <div className="user-dropdown-item" onClick={handleLogout}>
                      Logout
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {showNotifications && <NotificationPanel />}
    </header>
  );
};

export default Header;