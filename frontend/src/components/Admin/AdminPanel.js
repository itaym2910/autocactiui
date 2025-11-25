import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/apiService';
import './AdminPanel.css';

const AdminPanel = ({ isOpen, onClose, currentUser }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getUsers();
      setUsers(response.data); 
    } catch (err) {
      setError(t('admin.errorFetch') || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handlePrivilegeChange = async (userId, newPrivilege) => {
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, privilege: newPrivilege } : u));

    try {
      await api.changeUserPrivilege(userId, newPrivilege);
    } catch (err) {
      setError(t('admin.errorUpdate') || "Update failed");
      setUsers(previousUsers); 
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2>{t('admin.title') || "User Management"}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {error && (
          <div className="admin-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <div className="admin-content custom-scrollbar">
          {loading ? (
            <div className="admin-loading">
              <div className="spinner"></div>
              <p>{t('app.loading') || "Loading..."}</p>
            </div>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>{t('admin.username') || "User"}</th>
                  <th>{t('admin.privilege') || "Role"}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isMe = currentUser && user.id === currentUser.id;
                  return (
                    <tr key={user.id} className={isMe ? "row-me" : ""}>
                      <td>
                        <div className="user-info">
                          <span className="user-name">{user.username}</span>
                          {isMe && <span className="me-badge">{t('admin.me') || "You"}</span>}
                        </div>
                      </td>
                      <td>
                        <div className="select-wrapper">
                          <select 
                            value={user.privilege}
                            onChange={(e) => handlePrivilegeChange(user.id, e.target.value)}
                            disabled={isMe} 
                            className={`privilege-select role-${user.privilege}`}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;