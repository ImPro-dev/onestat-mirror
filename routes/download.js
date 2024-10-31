const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../config/statConfig')
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, function (req, res, next) {
  const { webID } = req.session.user;
  // const path = `./uploads/${webID}`
  var filePath = path.join(__dirname, '..', 'download', webID, config.OneStatFileName);
  if (fs.existsSync(filePath)) {
    res.download(filePath, config.OneStatFileName, (err) => {
      if (err) {
        console.error('Error while sending the file:', err);
        res.status(500).send('Could not download the file.');
      }
    });
  } else {
    res.status(404).send('CSV file not found');
  }
});

module.exports = router;
