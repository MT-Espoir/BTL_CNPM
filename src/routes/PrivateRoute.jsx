import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * @param {ReactNode} children - Nội dung cần bảo vệ
 * @param {string} redirectPath - Trang sẽ redirect nếu chưa login
 */
const PrivateRoute = ({ children, redirectPath = '/' }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Block student role from manager routes
  const adminPaths = ['/manager', '/manager-device', '/manager-system', '/usage-report', '/user-verification'];
  if (user?.role?.toLowerCase() === 'student' &&
      adminPaths.some(path => location.pathname.startsWith(path))) {
    // Redirect students to home
    return <Navigate to="/home" replace />;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  return children;
};

export default PrivateRoute;
