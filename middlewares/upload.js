const multer = require('multer');
const fs = require('fs');

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { webID } = req.session.user;
    const path = `./uploads/${webID}`;
    fs.mkdirSync(path, { recursive: true });
    return cb(null, path);
  },
  filename: (req, file, cb) => {
    let prefix;
    const ext = file.originalname.split('.').pop();
    const counter = req.fileCounter = (req.fileCounter || 0) + 1;

    switch (file.fieldname) {
      case 'fb_stat':
        prefix = '___FB';

        cb(null, `${prefix}_${counter}.${ext}`);
        break;
      case 'keitaro_stat_conversions':
        prefix = '___keitaroConversions';
        cb(null, `${prefix}.${ext}`);
        break;
      case 'keitaro_stat_clicks':
        prefix = '___keitaroClicks';
        cb(null, `${prefix}.${ext}`);
        break;
      default:
        prefix = 'file';
    }
  }
});


// Create the multer instance
const upload = multer({ storage: storage });

module.exports = upload;
