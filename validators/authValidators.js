// validators/authValidators.js
'use strict';

const { body } = require('express-validator');

const changePasswordRules = [
  body('currentPassword').trim().notEmpty().withMessage('Вкажіть поточний пароль'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Новий пароль має містити мінімум 8 символів')
    .matches(/[A-Za-z]/).withMessage('Новий пароль має містити літери')
    .matches(/[0-9]/).withMessage('Новий пароль має містити цифри'),
  body('confirmPassword')
    .custom((v, { req }) => v === req.body.newPassword)
    .withMessage('Підтвердження пароля не збігається'),
];

module.exports = { changePasswordRules };
