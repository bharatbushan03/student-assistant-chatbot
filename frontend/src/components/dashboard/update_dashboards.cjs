const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'c:/Users/dell/Desktop/student-assistant-chatbot/frontend/src/components/dashboard/StudentDashboard.jsx',
  'c:/Users/dell/Desktop/student-assistant-chatbot/frontend/src/components/dashboard/FacultyDashboard.jsx'
];

filesToUpdate.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Make panel cards use p-5 per specification
    content = content.replace(/className="panel-card p-4"/g, 'className="panel-card p-5"');
    content = content.replace(/className="panel-card p-4 lg:col-span-2"/g, 'className="panel-card p-5 lg:col-span-2"');
    
    // Update StatCard icon layout
    content = content.replace(/className={`rounded-2xl p-2 \${accentClass}`}/g, 'className="rounded p-2 bg-primary/10 text-primary"');
    
    // Update Dashboard headers to text-base (16px) per spec instead of text-lg
    content = content.replace(/className="text-lg font-semibold text-foreground"/g, 'className="text-base font-semibold text-foreground"');
    
    // Update Profile / Chat layout typography equivalents if they exist in these files
    content = content.replace(/tracking-\[0\.12em\]/g, 'tracking-normal'); // Normal letter spacing
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
