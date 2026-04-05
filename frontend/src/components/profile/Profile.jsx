import React, { useState, useContext, useEffect, useRef } from 'react';
import { AuthContext } from '../../context/auth-context';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { User, Mail, IdCard, GraduationCap, Layers, Camera, Save, X } from 'lucide-react';

const Profile = () => {
  const { user, loading } = useContext(AuthContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    college_id: '',
    section: '',
    semester: '',
    profile_picture: ''
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [previewImage, setPreviewImage] = useState(null);

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
        profile_picture: user.profile_picture || ''
      });
      setPreviewImage(user.profile_picture || null);
    }
    setIsEditing(false);
    setMessage({ type: '', text: '' });
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
      {/* Header */}
      <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="font-semibold text-lg bg-clip-text text-transparent bg-gradient-to-r from-primary to-ring">
            Miety AI
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to Chat
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-card rounded-2xl border border-border shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="relative h-32 bg-gradient-to-r from-primary/20 to-accent/20">
            <div className="absolute -bottom-16 left-8">
              <div className="relative">
                <div className="w-32 h-32 rounded-full border-4 border-card bg-muted overflow-hidden">
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
                    className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
                    title="Change profile picture"
                  >
                    <Camera size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Profile Info */}
          <div className="pt-20 pb-8 px-8">
            {/* Action Bar */}
            <div className="flex justify-end gap-2 mb-6">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/10 transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                  >
                    <X size={16} className="inline-block mr-1" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    <Save size={16} className="inline-block mr-1" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              )}
            </div>

            {/* Message */}
            {message.text && (
              <div className={`mb-6 p-4 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                  : 'bg-red-500/10 border border-red-500/20 text-red-500'
              }`}>
                {message.text}
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-6">
              {/* Email (Read-only) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Mail size={16} />
                  Email Address
                </label>
                <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                  {user?.email || 'N/A'}
                </div>
              </div>

              {/* Name */}
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
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                ) : (
                  <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                    {formData.name || 'Not set'}
                  </div>
                )}
              </div>

              {/* College ID */}
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
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                ) : (
                  <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                    {formData.college_id || 'Not set'}
                  </div>
                )}
              </div>

              {/* Section */}
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
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  >
                    <option value="">Select Section</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                    <option value="E">Section E</option>
                  </select>
                ) : (
                  <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                    {formData.section ? `Section ${formData.section}` : 'Not set'}
                  </div>
                )}
              </div>

              {/* Semester */}
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
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
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
                  <div className="px-4 py-3 bg-muted rounded-lg text-foreground">
                    {formData.semester ? `Semester ${formData.semester}` : 'Not set'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border text-sm text-muted-foreground text-center">
          Your profile information helps us personalize your learning experience.
        </div>
      </main>
    </div>
  );
};

export default Profile;
