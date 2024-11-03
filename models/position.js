const { Schema, model } = require('mongoose');


const positionSchema = new Schema({
  firstname: {
    type: String,
    unique: false,
    required: [true, 'Please enter FirstName']
  }
});


module.exports = model('UserPosition', positionSchema);
