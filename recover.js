const fs = require('fs');
const path = require('path');

const cursorHistoryPath = path.join(process.env.HOME, 'Library/Application Support/Cursor/User/History');
if (!fs.existsSync(cursorHistoryPath)) {
  console.log("No Cursor history found at " + cursorHistoryPath);
  process.exit(1);
}

const workspaceDir = '/Users/sunghoon/Desktop/AHA/web/aha-v5';

// Read the actual file bytes to detect corruption, bypassing stale stat sizes
function findEmptyFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === '.next') continue;
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findEmptyFiles(fullPath, fileList);
    } else {
      const ext = path.extname(fullPath);
      if (['.ts', '.tsx', '.css', '.js', '.mjs', '.json'].includes(ext)) {
        try {
          const content = fs.readFileSync(fullPath);
          // If the actual read content is completely empty, it's wiped!
          if (content.length === 0) {
            fileList.push(fullPath);
          }
        } catch(e) {}
      }
    }
  }
  return fileList;
}

const emptyFiles = findEmptyFiles(workspaceDir);
console.log(`Found ${emptyFiles.length} completely empty files to recover:`);
emptyFiles.forEach(f => console.log(' - ' + path.relative(workspaceDir, f)));

const historyFolders = fs.readdirSync(cursorHistoryPath)
  .filter(f => fs.statSync(path.join(cursorHistoryPath, f)).isDirectory());

let restoredCount = 0;

for (const emptyFile of emptyFiles) {
  let bestContent = null;
  let maxTime = 0;

  for (const folder of historyFolders) {
    const folderPath = path.join(cursorHistoryPath, folder);
    const entriesFile = path.join(folderPath, 'entries.json');
    if (fs.existsSync(entriesFile)) {
      try {
        const entries = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
        if (entries.resource && entries.resource.endsWith(path.basename(emptyFile))) {
          // Double check path match
          if (entries.resource.includes(emptyFile.replace(workspaceDir, ''))) {
            for (const entry of entries.entries) {
              const entryPath = path.join(folderPath, entry.id);
              if (fs.existsSync(entryPath)) {
                const content = fs.readFileSync(entryPath, 'utf8');
                // Ensure it's not restoring another empty blob
                if (content.trim().length > 50 && entry.timestamp > maxTime) {
                  bestContent = content;
                  maxTime = entry.timestamp;
                }
              }
            }
          }
        }
      } catch (e) { }
    }
  }

  if (bestContent) {
    fs.writeFileSync(emptyFile, bestContent, 'utf8');
    restoredCount++;
    console.log(`✅ Restored: ${emptyFile.replace(workspaceDir + '/', '')} (From ${new Date(maxTime).toLocaleString()})`);
  } else {
    console.log(`❌ No backup found in Cursor history for: ${emptyFile.replace(workspaceDir + '/', '')}`);
  }
}

console.log(`Recovery complete. Restored ${restoredCount} out of ${emptyFiles.length} files.`);
