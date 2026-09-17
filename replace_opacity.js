const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
        callback(path.join(dir, f));
      }
    }
  });
}

let modifiedFiles = 0;

walkDir('./app', processFile);
walkDir('./components', processFile);

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('text-white/50')) {
    const newContent = content.replace(/text-white\/50/g, 'text-[#858585]');
    fs.writeFileSync(filePath, newContent, 'utf8');
    modifiedFiles++;
    console.log(`Modified: ${filePath}`);
  }
}

console.log(`Done! Modified ${modifiedFiles} files.`);
