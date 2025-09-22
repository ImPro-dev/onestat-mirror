'use strict';

const { Schema, model } = require('mongoose');

const offerSchema = new Schema({
  firstname: {
    type: String,
    unique: false,
    required: [true, 'Please enter FirstName']
  }
});


module.exports = model('Offer', offerSchema);
