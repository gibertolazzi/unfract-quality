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
  let newContent = content;
  
  newContent = newContent.replace(/text-white\/40/g, 'text-[#858585]');
  newContent = newContent.replace(/text-white\/30/g, 'text-[#858585]');
  newContent = newContent.replace(/text-white\/20/g, 'text-[#858585]');
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    modifiedFiles++;
    console.log(`Modified: ${filePath}`);
  }
}

console.log(`Done! Modified ${modifiedFiles} files.`);
