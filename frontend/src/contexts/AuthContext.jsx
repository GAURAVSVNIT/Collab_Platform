import { createContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const savedToken = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');
        
        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const response = await fetch('/api/v1/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      // Check if response has content before trying to parse JSON
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      }

      if (response.ok) {
        setUser(data.data.user);
        setToken(data.data.accessToken);
        localStorage.setItem('token', data.data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        return { success: true };
      } else {
        return { success: false, error: data.message || `Login failed (${response.status})` };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please check if the server is running.' };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const response = await fetch('/api/v1/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      // Check if response has content before trying to parse JSON
      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        if (text) {
          data = JSON.parse(text);
        }
      }

      if (response.ok) {
        setUser(data.data);
        setToken(data.data.accessToken || data.data.token);
        localStorage.setItem('token', data.data.accessToken || data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data));
        return { success: true };
      } else {
        return { success: false, error: data.message || `Signup failed (${response.status})` };
      }
    } catch (error) {
      console.error('Signup error:', error);
      return { success: false, error: 'Network error. Please check if the server is running.' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    logout,
    isAuthenticated: !!user && !!token,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
