import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as api from '../../services/apiService';
import './AdminPanel.css';

const AdminPanel = ({ isOpen, onClose, currentUser }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch users when popup opens
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
      // Adjust this based on whether your API returns [users] or { data: [users] }
      setUsers(response.data || response); 
    } catch (err) {
      console.error(err);
      setError(t('admin.errorFetch'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrivilegeChange = async (userId, newPrivilege) => {
    // 1. Optimistic Update (update UI immediately)
    const previousUsers = [...users];
    setUsers(users.map(u => u.id === userId ? { ...u, privilege: newPrivilege } : u));

    try {
      // 2. Call API: PUT /users/change-privileges/{id}/{privilege}
      await api.changeUserPrivilege(userId, newPrivilege);
    } catch (err) {
      console.error(err);
      setError(t('admin.errorUpdate'));
      setUsers(previousUsers); // Revert on error
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-header">
          <h2>{t('admin.title')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-content">
          {loading ? (
            <p className="loading-text">{t('app.loading')}</p>
          ) : (
            <table className="user-table">
              <thead>
                <tr>
                  <th>{t('admin.username')}</th>
                  <th>{t('admin.privilege')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <span style={{fontSize: '1.2em'}}>👤</span>
                        {user.username}
                        {currentUser && user.id === currentUser.id && (
                          <span className="me-badge">{t('admin.me')}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <select 
                        value={user.privilege} // Assumes your DB column is named 'privilege'
                        onChange={(e) => handlePrivilegeChange(user.id, e.target.value)}
                        disabled={currentUser && user.id === currentUser.id} // Prevent locking yourself out
                        className="privilege-select"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option> {/* Add other roles if you have them */}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="admin-footer">
            <button className="secondary" onClick={onClose}>{t('common.close') || "Close"}</button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;