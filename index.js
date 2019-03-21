'use strict';

const createError = require('http-errors');

const N1qlQuery = require('couchbase').N1qlQuery;

const symbols = {
  nlike: 'NOT LIKE',
  like: 'LIKE',
  gt: '>',
  gte: '>=',
  lt: '<',
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
  const regexp = function(key, value, params) {
    const name = `regexp_${key}_${index()}`.replace('.', '_');
    if (key === 'id') {
      key = 'TOSTRING(META().id)';
    }
    const ql = `REGEX_LIKE(${key}, $${name})`;
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
  const comparison = function(op) {
    return function(key, value, params) {
      const name = `${op}_${key}_${index()}`.replace('.', '_');
      if (key === 'id') {
        key = 'TOSTRING(META().id)';
      }
      params[name] = value;
      return `${key} ${symbols[op]} $${name}`;
    };
  };

  const operators = {
    like: comparison('like'),
    nlike: comparison('nlike'),
    gt: comparison('gt'),
    gte: comparison('gte'),
    lt: comparison('lt'),
    lte: comparison('lte'),
    neq: comparison('neq'),
    ne: comparison('neq'),
    regexp
  };
  const generateClause = (data) => {
    return Object.keys(data).map(key => {
      const name = `${key}_${index()}`.replace('.', '_');
      const value = data[key];
      if (Array.isArray(value)) {
        params[name] = value;
        if (key === 'id') {
          key = 'TOSTRING(META().id)';
        }
        return `${key} IN $${name}`;
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
      } else {
        params[name] = value;
        if (key === 'id') {
          key = 'TOSTRING(META().id)';
        }
        return `${key}=$${name}`;
      }
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
  Model.boot = async() => {
    return Model.getConnector()
      .manager()
      .call('createPrimaryIndexAsync', { name: Model.modelName, ignoreIfExists: true });
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
    let countQL = `SELECT COUNT(META().id) as total from \`${bucketName}\` WHERE _type='${Model.modelName}'`;
    if (filters.where) {
      ql += ' AND ' + generateWhere(filters.where, params);
      countQL += ' AND ' + generateWhere(filters.where, params);
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
    logger.info({
      query: countQL,
      params: params,
      message: 'count query'
    });
    const data = await Model
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
    const total = (await Model.getConnector().connect()
      .call('queryAsync', N1qlQuery.fromString(countQL), params))[0].total;
    return { data: data, total: total };
  };
};
