'use strict';

const { winston } = require('./nodebb');


module.exports = {
	verbose: msg => winston.verbose('[plugin/group-post-mark]', msg),
	error: msg => winston.error('[plugin/group-post-mark]', msg),
	warn: msg => winston.warn('[plugin/group-post-mark]', msg),
};
