'use strict';

const { validationResult } = require('express-validator');

/**
 * Wrap express-validator rules to flash + redirect back
 */
function validate(rules) {
  return async (req, res, next) => {
    // Виконаємо правила (вони можуть бути async)
    await Promise.all(rules.map(rule => rule.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const messages = errors.array().map(err => err.msg);

      // Flash-повідомлення у твоєму форматі
      req.flash('userError', messages);

      // Якщо є referer — повертаємось, інакше на /dashboard
      return res.redirect(req.header('Referer') || '/dashboard');
    }

    next();
  };
}

module.exports = { validate };
