const crypto = require('crypto');
const key = crypto.randomBytes(16).toString('hex');
console.log(key);
console.log('Length:', key.length);
