'use strict';

const { body } = require('express-validator');

/**
 * Create: includes rateAmount; cap/postclick allow empty; link optional URL
 */
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

  body('postclick')
    .customSanitizer(v => v === '' ? null : v)
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Постклік має бути ≥ 0'),

  // link: allow empty; if present must be a URL
  body('link')
    .customSanitizer(v => v === '' ? undefined : v)
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Некоректне посилання'),
];

/**
 * Update: no rateAmount here (rate handled separately)
 */
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

  body('postclick')
    .customSanitizer(v => v === '' ? null : v)
    .optional({ checkFalsy: true })
    .isInt({ min: 0 })
    .withMessage('Постклік має бути ≥ 0'),

  body('link')
    .customSanitizer(v => v === '' ? undefined : v)
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage('Некоректне посилання'),
];

/**
 * UpdateRate (details page): validates amount and optional valid-from date.
 * Field names aligned with controllers: newRateAmount, newRateValidFrom.
 */
module.exports.updateRate = [
  body('newRateAmount')
    .isFloat({ min: 0 })
    .withMessage('Ставка має бути >= 0'),
  body('newRateValidFrom')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Невірна дата початку дії'),
];
