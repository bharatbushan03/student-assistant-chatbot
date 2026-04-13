const fs = require('fs');

const filePath = 'c:/Users/dell/Desktop/student-assistant-chatbot/frontend/src/components/profile/Profile.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const targetAvatarHTML = `<div className="relative h-28 bg-muted/55">
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
          </div>`;

const replaceAvatarHTML = `<div className="flex items-center gap-4 p-8 pb-0 mb-6">
            <div className="relative">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-card">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary text-white text-lg font-semibold">
                    {user?.name?.charAt(0)?.toUpperCase() || 'M'}
                  </div>
                )}
              </div>
            </div>
            {isEditing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="secondary-button !py-1.5 !px-3 font-semibold text-xs"
                title="Change profile picture"
              >
                Upload Photo
              </button>
            )}
          </div>`;

if (content.includes(targetAvatarHTML)) {
    content = content.replace(targetAvatarHTML, replaceAvatarHTML);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated Avatar block in Profile.jsx');
} else {
    console.log('Target avatar substring not found exactly.');
}
