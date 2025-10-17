// services/sanitizeService.js
'use strict';

// EN-only comments per project rules
const sanitizeHtml = require('sanitize-html');

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'i', 'strong', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'blockquote', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'a', 'span'
];

const ALLOWED_ATTRS = {
  a: ['href', 'target', 'rel'],
  span: ['class']
};

const ALLOWED_SCHEMES = ['http', 'https', 'mailto'];

function cleanHtml(input) {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ALLOWED_SCHEMES,
    transformTags: {
      a: (tagName, attribs) => {
        const out = { ...attribs };
        if (!out.target) out.target = '_blank';
        out.rel = 'noopener noreferrer nofollow';
        return { tagName, attribs: out };
      }
    },
    allowVulnerableTags: false,
    disallowedTagsMode: 'discard',
  });
}

module.exports = { cleanHtml };
