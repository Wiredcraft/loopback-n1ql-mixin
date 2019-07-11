'use strict';

const createError = require('http-errors');

const N1qlQuery = require('couchbase').N1qlQuery;
global.Promise = require('bluebird');
const getFieldName = (key) => key !== 'id' && key || 'TOSTRING(META().id)';
const escape = (str) => str.replace(/\./g, '_');
const symbols = {
  nlike: 'NOT LIKE',
  like: 'LIKE',
  gt: '>',
  gte: '>=',
  lt: '<',
  inq: 'IN',
  lte: '<=',
  neq: '!='
};

/**
 * Normalize the Where filters
 *
 * @param {object} data Condition object
*/
const normalize = (data) => {
  const ands = data.and || [];
  const ors = data.or || [];
  delete data.and;
  delete data.or;
  if (Array.isArray(ands)) {
    if (Object.keys(data).length > 0) {
      ands.push(data);
    }
  }
  return [ands, ors];
};
/**
 * An counter
 */
const counter = () => {
  let num = 0;
  return () => {
    num += 1;
    return num;
  };
};

/**
* Generate Where N1QL Clause
*
* @param {object} where Where object
*/
const generateWhere = (where, params) => {
  const stack = [];
  const index = counter();

  /**
   * Support Regexp Search
   */
  const regexp = (key, value, params) => {
    const name = escape(`regexp_${key}_${index()}`);
    const field = getFieldName(key);
    const ql = `REGEX_LIKE(${field}, $${name})`;
    if (value instanceof RegExp) {
      params[name] = value.source;
      return ql;
    }
    if (typeof value === 'string') {
      params[name] = value;
      return ql;
    }
    throw createError(400, 'invalid regexp');
  };
  /**
   * Support Comparison
   */
  const comparison = (op) => {
    return (key, value, params) => {
      const name = escape(`${op}_${key}_${index()}`);
      const field = getFieldName(key);
      params[name] = value;
      return `${field} ${symbols[op]} $${name}`;
    };
  };

  const neq = (key, value, params) => {
    const field = getFieldName(key);
    if (value === null) return `${field} IS NOT NULL`;
    const name = escape(`neq_${key}_${index()}`);
    params[name] = value;
    return `${field} != $${name}`;
  };

  const arrayContains = (key, value, params) => {
    const name = escape(`ARRAY_CONTAINS_${key}_${index()}`);
    const field = getFieldName(key);
    params[name] = value;
    return `ARRAY_CONTAINS(${field}, $${name})`;
  };
  const operators = {
    like: comparison('like'),
    nlike: comparison('nlike'),
    gt: comparison('gt'),
    gte: comparison('gte'),
    lt: comparison('lt'),
    inq: comparison('inq'),
    lte: comparison('lte'),
    neq: neq,
    ne: neq,
    array_contains: arrayContains,
    regexp
  };
  const generateClause = (data) => {
    return Object.keys(data).map(key => {
      const name = escape(`${key}_${index()}`);
      const value = data[key];
      const field = getFieldName(key);
      if (Array.isArray(value)) {
        params[name] = value;
        return `${field} IN $${name}`;
      }
      if (value === null) {
        return `${key} IS NULL`;
      }
      if (typeof value === 'object') {
        return Object.keys(value).map(e => {
          if (!operators.hasOwnProperty(e)) {
            throw createError(400, 'invalid comparison op');
          }
          const op = operators[e];
          const v = value[e];
          return op(key, v, params);
        }).join(' AND ');
      }
      params[name] = value;
      return `${field}=$${name}`;
    });
  };

  const render = (data, op) => {
    if (Array.isArray(data)) {
      return data.map(e => { return render(e, op); }).join(op);
    }
    if (Object.keys(data).length === 0) {
      return;
    }
    return '(' + generateClause(data).join(op) + ')';
  };

  const walk = (data, op = ' AND ') => {
    if (data.hasOwnProperty('and') || data.hasOwnProperty('or')) {
      const result = [];
      const [ands, ors] = normalize(data);
      stack.push(ors);
      const andStr = walk(ands);
      const orStr = walk(stack.pop(), op = ' OR ');
      if (andStr) {
        result.push(andStr);
      }
      if (orStr) {
        result.push(orStr);
      }
      return '(' + result.join(op) + ')';
    } else {
      return render(data, op);
    }
  };
  return walk(where);
};

module.exports = (Model) => {
  const createIndex = async(index) => {
    return Promise.map(Object.keys(index), async(name) => {
      const value = index[name];
      let keys;
      if (value === true) {
        // name = '${field}_index'
        // eg: name = 'type_index'
        const key = name.slice(0, -6);
        return await Model.getConnector()
          .manager()
          .call('createIndexAsync', name, [key], { deferred: true, ignoreIfExists: true });
      } else if (typeof value === 'object') {
        if (value.hasOwnProperty('keys')) {
          keys = Object.keys(value.keys);
        } else {
          keys = Object.keys(value);
        }
        if (! keys.includes('_type')) keys.push('_type');
        return await Model.getConnector()
          .manager()
          .call('createIndexAsync', name, keys, { deferred: true, ignoreIfExists: true });
      };
    }, { concurrency: 1 });
  };

  const autoupdate = Model.getConnector().autoupdate;
  Model.getConnector().autoupdate = function(models, callback) {
    return Model.boot().then(() => {
      return autoupdate.bind(this)(models, callback);
    }).catch(callback);
  };
  Model.boot = async() => {
    await createIndex(Model.definition.indexes());
    return await Model.getConnector()
      .manager()
      .call('createPrimaryIndexAsync', { name: Model.modelName, ignoreIfExists: true });
  };

  Model.sum = async(filters = {}) => {
    const { logger } = Model.app;
    const bucketName = Model.dataSource.settings.bucket.name;
    const params = {};
    let countQL = `SELECT COUNT(META().id) as total from \`${bucketName}\` WHERE _type='${Model.modelName}'`;
    if (filters.where) {
      countQL += ' AND ' + generateWhere(filters.where, params);
    }

    logger.info({
      query: countQL,
      params: params,
      message: 'sum query'
    });
    return (await Model.getConnector().connect()
      .call('queryAsync', N1qlQuery.fromString(countQL), params))[0].total;
  };
  Model.query = async(filters = {}) => {
    const { logger } = Model.app;
    const bucketName = Model.dataSource.settings.bucket.name;
    const params = {};
    let fields = '*';
    if (filters.fields) {
      fields = filters.fields.join(',');
    }
    fields += ',TOSTRING(META().id) AS id';
    let ql = `SELECT ${fields} from \`${bucketName}\` WHERE _type='${Model.modelName}'`;
    if (filters.where) {
      ql += ' AND ' + generateWhere(filters.where, params);
    }
    if (filters.order) {
      var orders = filters.order;
      if (typeof orders === 'string') {
        orders = [orders];
      }
      if (!Array.isArray(orders)) {
        throw createError(400, 'invalid parameter: the order should be a Array');
      }
      orders.forEach(order => {
        if (!(order.endsWith('ASC') || order.endsWith('DESC'))) {
          throw createError(400, 'invalid parameter: the order\' value should ends with ASC|DESC');
        }
      });
      ql += ` ORDER BY ${orders.join(',')}`;
    }

    if (filters.limit) {
      const limit = parseInt(filters.limit);
      if (isNaN(limit) || limit < 0) {
        throw createError(400, 'invalid parameter: limit');
      }
      ql += ` LIMIT ${limit}`;
    }

    if (filters.skip) {
      const skip = parseInt(filters.skip);
      if (isNaN(skip) || skip < 0) {
        throw createError(400, 'invalid parameter: limit');
      }
      ql += ` OFFSET ${skip}`;
    }
    logger.info({
      query: ql,
      params: params,
      message: 'query'
    });
    return await Model
      .getConnector()
      .connect()
      .call('queryAsync', N1qlQuery.fromString(ql), params)
      .map(res => {
        // The returns construct is { test_bucket: {}}
        // need to be unpacked
        if (res.hasOwnProperty(bucketName)) {
          const obj = res[bucketName];
          obj.id = res.id;
          return obj;
        }
        return res;
      })
      .map(res => {
        if (Model.settings.hidden) {
          Model.settings.hidden.forEach(e => {
            if (res.hasOwnProperty(e)) {
              delete res[e];
            }
          });
        }
        return res;
      });
  };
};

