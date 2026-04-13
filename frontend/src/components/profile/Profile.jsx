import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { User, Mail, IdCard, GraduationCap, Layers, Camera, Save, X, Lock, Briefcase } from 'lucide-react';

const Profile = () => {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    college_id: '',
    section: '',
    semester: '',
    project: '',
    profile_picture: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [previewImage, setPreviewImage] = useState(null);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
    if (user) {
      setFormData({
        name: user.name || '',
        college_id: user.college_id || '',
        section: user.section || '',
        semester: user.semester || '',
        project: user.project || '',
        profile_picture: user.profile_picture || ''
      });
      if (user.profile_picture) {
        setPreviewImage(user.profile_picture);
      }
    }
  }, [user, loading, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size should be less than 5MB' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setPreviewImage(base64);
        setFormData(prev => ({ ...prev, profile_picture: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const { data } = await api.put('/auth/profile', formData);
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setIsEditing(false);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to update profile'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        name: user.name || '',
        college_id: user.college_id || '',
        section: user.section || '',
        semester: user.semester || '',
        project: user.project || '',
        profile_picture: user.profile_picture || ''
      });
      setPreviewImage(user.profile_picture || null);
    }
    setIsEditing(false);
    setMessage({ type: '', text: '' });
  };

  const handleChangePassword = async () => {
    setMessage({ type: '', text: '' });

    if (passwordData.new_password.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setMessage({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }

    if (passwordData.current_password === passwordData.new_password) {
      setMessage({ type: 'error', text: 'New password must be different from current password.' });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { data } = await api.post('/auth/change-password', passwordData);
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setPasswordData({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.detail || 'Failed to change password'
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-sm font-bold text-accent-foreground">
              M
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">Profile</p>
              <p className="text-sm text-muted-foreground">Account details and password</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-2xl border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Back to Chat
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="panel-card overflow-hidden">
          <div className="relative h-28 bg-muted/55">
            <div className="absolute -bottom-16 left-8">
              <div className="relative">
                <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-card bg-card">
                  {previewImage ? (
                    <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={48} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 rounded-full bg-primary p-2 text-primary-foreground shadow-sm hover:bg-primary/90"
                    title="Change profile picture"
                  >
                    <Camera size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          <div className="px-8 pb-8 pt-4">
            <div className="mb-6 flex justify-end gap-2">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="secondary-button"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="secondary-button"
                  >
                    <X size={16} className="inline-block mr-1" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="primary-button disabled:opacity-50"
                  >
                    <Save size={16} className="inline-block mr-1" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>

            {message.text && (
              <div className={`mb-6 rounded-2xl p-4 text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                  : 'bg-red-500/10 border border-red-500/20 text-red-500'
              }`}>
                {message.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Mail size={16} />
                  Email Address
                </label>
                <div className="rounded-2xl bg-muted/55 px-4 py-3 text-foreground">
                  {user?.email || 'N/A'}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <User size={16} />
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    className="soft-input"
                  />
                ) : (
                  <div className="rounded-2xl bg-muted/55 px-4 py-3 text-foreground">
                    {formData.name || 'Not set'}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <IdCard size={16} />
                  College ID
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="college_id"
                    value={formData.college_id}
                    onChange={handleInputChange}
                    placeholder="e.g., 2023BCA001"
                    className="soft-input"
                  />
                ) : (
                  <div className="rounded-2xl bg-muted/55 px-4 py-3 text-foreground">
                    {formData.college_id || 'Not set'}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Layers size={16} />
                  Section
                </label>
                {isEditing ? (
                  <select
                    name="section"
                    value={formData.section}
                    onChange={handleInputChange}
                    className="soft-input"
                  >
                    <option value="">Select Section</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                    <option value="E">Section E</option>
                  </select>
                ) : (
                  <div className="rounded-2xl bg-muted/55 px-4 py-3 text-foreground">
                    {formData.section ? `Section ${formData.section}` : 'Not set'}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <GraduationCap size={16} />
                  Semester
                </label>
                {isEditing ? (
                  <select
                    name="semester"
                    value={formData.semester}
                    onChange={handleInputChange}
                    className="soft-input"
                  >
                    <option value="">Select Semester</option>
                    <option value="1">Semester 1</option>
                    <option value="2">Semester 2</option>
                    <option value="3">Semester 3</option>
                    <option value="4">Semester 4</option>
                    <option value="5">Semester 5</option>
                    <option value="6">Semester 6</option>
                    <option value="7">Semester 7</option>
                    <option value="8">Semester 8</option>
                  </select>
                ) : (
                  <div className="rounded-2xl bg-muted/55 px-4 py-3 text-foreground">
                    {formData.semester ? `Semester ${formData.semester}` : 'Not set'}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Briefcase size={16} />
                  Project
                </label>
                {isEditing ? (
                  <textarea
                    name="project"
                    value={formData.project}
                    onChange={handleInputChange}
                    placeholder="Enter your current project title or details"
                    rows={3}
                    className="soft-input min-h-28"
                  />
                ) : (
                  <div className="rounded-2xl bg-muted/55 px-4 py-3 text-foreground whitespace-pre-wrap">
                    {formData.project || 'Not set'}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">Change Password</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Keep your account secure by updating your password regularly.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <Lock size={16} />
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="current_password"
                    value={passwordData.current_password}
                    onChange={handlePasswordInputChange}
                    autoComplete="current-password"
                    placeholder="Enter current password"
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <Lock size={16} />
                    New Password
                  </label>
                  <input
                    type="password"
                    name="new_password"
                    value={passwordData.new_password}
                    onChange={handlePasswordInputChange}
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    className="soft-input"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                    <Lock size={16} />
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordInputChange}
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    className="soft-input"
                  />
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={isChangingPassword}
                  className="primary-button mt-6 w-auto disabled:opacity-50"
                >
                  {isChangingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card px-4 py-4 text-center text-sm text-muted-foreground">
          Your profile information helps us personalize your learning experience.
        </div>
      </main>
    </div>
  );
};

export default Profile;
