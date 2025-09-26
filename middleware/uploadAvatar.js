// middleware/uploadAvatar.js
'use strict';
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// --- Multer (in-memory) ---
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    if (!ok) return cb(new Error('Дозволені формати: JPG, PNG, WebP'));
    cb(null, true);
  }
});

// --- Guard-обгортка для upload.single('avatar') ---
function avatarUploadGuard(fieldName = 'avatar') {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        req.flash('userError', err.message || 'Помилка завантаження файлу.');
        return res.redirect(`/users/${req.params.id}/avatar/upload`);
      }
      if (!req.file) {
        req.flash('userError', 'Файл не отримано.');
        return res.redirect(`/users/${req.params.id}/avatar/upload`);
      }
      next();
    });
  };
}

// --- Обробка та збереження ---
async function processAndSaveAvatar(userId, buffer) {
  const outDir = path.join(__dirname, '..', 'uploads', 'avatars');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `${userId}.webp`);
  await sharp(buffer)
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 82 })
    .toFile(outPath);
}

module.exports = { upload, avatarUploadGuard, processAndSaveAvatar };
