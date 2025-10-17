'use strict';

const { body } = require('express-validator');

// Create: includes rateAmount; cap/link allow empty
module.exports.create = [
  body('offerName').trim().notEmpty().withMessage('Вкажіть назву оферу'),
  body('country').isMongoId().withMessage('Оберіть GEO'),
  body('source').isMongoId().withMessage('Оберіть джерело'),
  body('model').isMongoId().withMessage('Оберіть модель'),
  body('targetConversion').isMongoId().withMessage('Оберіть цільову конверсію'),

  body('rateAmount')
    .isFloat({ min: 0 })
    .withMessage('Ставка має бути >= 0'),

  body('cap')
    .customSanitizer(v => v === '' ? null : v)
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Капа має бути >= 0'),

  // link: allow empty; if present must be a URL
  body('link')
    .customSanitizer(v => v === '' ? undefined : v)
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Некоректне посилання'),
];

// Update: no rateAmount here (rate handled separately in step 3)
module.exports.update = [
  body('offerName').trim().notEmpty().withMessage('Вкажіть назву оферу'),
  body('country').isMongoId().withMessage('Оберіть GEO'),
  body('source').isMongoId().withMessage('Оберіть джерело'),
  body('model').isMongoId().withMessage('Оберіть модель'),
  body('targetConversion').isMongoId().withMessage('Оберіть цільову конверсію'),

  body('cap')
    .customSanitizer(v => v === '' ? null : v)
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Капа має бути >= 0'),

  body('link')
    .customSanitizer(v => v === '' ? undefined : v)
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Некоректне посилання'),
];

// UpdateRate: validate amount and optional effectiveFrom (date)
module.exports.updateRate = [
  body('rateAmount')
    .isFloat({ min: 0 })
    .withMessage('Ставка має бути >= 0'),
  body('effectiveFrom')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Невірна дата початку дії'),
];
