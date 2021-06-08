'use strict';

module.exports = (queryStr, params) => {
  if (!params) return queryStr;

  for (let key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      let val = params[key];
      if (typeof val === 'string' || val instanceof String) {
        // escaping to prevent n1ql injection
        // see https://blog.couchbase.com/couchbase-and-n1ql-security-centeredgesoftware/
        val = val.replace(/'/g, "''");
        val = val.replace(/`/g, '``');
        val = `'${val}'`;
      } else {
        val = JSON.stringify(val);
      }
      let re = new RegExp('\\$' + key, 'g');
      queryStr = queryStr.replace(re, val);
    }
  }
  return queryStr;
};
