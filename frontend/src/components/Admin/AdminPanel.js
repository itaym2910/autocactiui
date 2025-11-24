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
    <div className="admin-overlay">
      <div className="admin-modal">
        <div className="admin-header">
          <h2>{t('admin.title') || "User Management"}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && <div className="admin-error">{error}</div>}

        <div className="admin-content">
          {loading ? (
            <p>{t('app.loading')}</p>
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
                      {user.username}
                      {currentUser && user.id === currentUser.id && (
                        <span className="me-badge">{t('admin.me')}</span>
                      )}
                    </td>
                    <td>
                      <select 
                        value={user.privilege}
                        onChange={(e) => handlePrivilegeChange(user.id, e.target.value)}
                        disabled={currentUser && user.id === currentUser.id} 
                        className="privilege-select"
                      >
                        <option value="user">User (Restricted Upload)</option>
                        <option value="admin">Admin (Full Access)</option>
                        <option value="viewer">Viewer (No Upload)</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;