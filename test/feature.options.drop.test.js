'use strict';

const loopback = require('loopback');
const chai = require('chai');
const N1ql = require('../lib/n1ql');
const expect = chai.expect;
global.Promise = require('bluebird');
const app = loopback();
app.logger = console;
describe('Index Option Drop test', () => {
  const Ds = app.dataSource(
    'couchbase5', {
      cluster: {
        url: 'localhost',
        username: 'Administrator',
        password: 'password',
        options: {}
      },
      bucket: {
        name: 'test_bucket',
        operationTimeout: 60 * 1000
      }
    });
  app.loopback.modelBuilder.mixins.define('N1ql', N1ql);
  const Department = Ds.createModel('Department', {
    name: String, type: String,
    type: String, type: String,
    extra: Object, type: Object
  }, { mixins: { 'N1ql': { primary: false, drop: true } }, indexes: { dep_name: { name: 1 } } });

  it('should drop old index and create a new one', async() => {
    try {
      await Department.rawQuery('create index dep_name on `test_bucket`(type) with {"defer_build": true }');
    } catch (err) {
      if (err.message.indexOf('already exist') < 0) {
        throw err;
      }
    }
    await Ds.autoupdate();
    const indexes = await Department.rawQuery('select * from system:indexes where name = "dep_name"');
    expect(indexes.length).to.be.eql(1);
    const index = indexes[0];
    expect(index.indexes.index_key).to.be.eqls(['`name`']);
  });

  it('should not drop old primary index', async() => {
    try {
      await Department.rawQuery('create primary index Department on `test_bucket` with {"defer_build": true }');
    } catch (err) {
      if (err.message.indexOf('already exist') < 0) {
        throw err;
      }
    }
    await Ds.autoupdate();
    const indexes = await Department
      .rawQuery('select * from system:indexes where name = "Department" and is_primary = true');
    expect(indexes.length).to.be.eql(1);
  });
});
