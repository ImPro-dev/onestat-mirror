const { Schema, model } = require('mongoose');


const userSchema = new Schema({
  name: {
    type: String,
    unique: false,
    required: [true, 'Please enter name']
  },
  email: {
    type: String,
    unique: true,
    required: [true, 'Please enter email']
  },
  password: {
    type: String,
    required: [true, 'Please enter password']
  },
  webID: {
    type: String,
    unique: true,
    required: [true, 'Please enter web ID']
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'manager', 'user']
  }
}, { timestamps: true });


module.exports = model('User', userSchema);
