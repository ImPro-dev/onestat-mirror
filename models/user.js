const { Schema, model } = require('mongoose');


const userSchema = new Schema({
  firstname: {
    type: String, unique: false, required: [true, 'Please enter FirstName']
  },
  lastname: {
    type: String, unique: false, required: [true, 'Please enter LasttName']
  },
  email: {
    type: String, unique: true, required: [true, 'Please enter email']
  },
  password: {
    type: String, required: [true, 'Please enter password']
  },
  telegram: {
    type: String, unique: false, required: false
  },
  position: {
    type: String, required: true
  },
  webID: {
    type: String, unique: true, required: false
  },
  role: {
    type: String, required: true, enum: ['admin', 'manager', 'user']
  }
}, { timestamps: true });


module.exports = model('User', userSchema);
