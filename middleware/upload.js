const multer = require('multer');

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    let fileName;
    switch (file.fieldname) {
      case 'fb_stat':
        fileName = '___FB'
        break;
      case 'keitaro_stat_conversions':
        fileName = '___keitaroConversions'
        break;
      case 'keitaro_stat_clicks':
        fileName = '___keitaroClicks'
        break;
      default:
        break;
    }
    cb(null, fileName + '.csv');
  }
});

// Create the multer instance
const upload = multer({ storage: storage });

module.exports = upload;
