const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  let isAuthenticated = req.session.isAuthenticated;
  let token = req.session.token;

  if (!isAuthenticated) {
    req.session.destroy();
    return res.redirect('/auth');
  }

  // try {
  //   const decode = jwt.verify(token, process.env.JWT_SECRET);
  // } catch (error) {
  //   console.log(error)
  // }



  next();
}
