'use strict';

const loopback = require('loopback');
const chai = require('chai');
const expect = chai.expect;
global.Promise = require('bluebird');
const app = loopback();
app.logger = console;
describe('Create Index test', () => {
  it('should be success when you index at document id', async() => {
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
    Ds.createModel('Book', {
      name: String, type: String,
      title: String, type: String,
      extra: Object, type: Object
    }, { mixins: { 'N1ql': { primary: true, deferred: false, drop: true } }, indexes:
      { name_test_index: { 'name': -1, 'id': -1 } } }
    );
    let error;
    try {
      await Ds.autoupdate();
    } catch (err) {
      error = err;
    }
    expect(error).to.be.undefined;
  });
  it('should be success when use true as options', async() => {
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
    Ds.createModel('Book', {
      name: String, type: String,
      title: String, type: String,
      extra: Object, type: Object
    }, { mixins: { 'N1ql': true }, indexes:
      { name_test_index: { 'name': -1, 'id': -1 } } }
    );
    let error;
    try {
      await Ds.autoupdate();
    } catch (err) {
      error = err;
    }
    expect(error).to.be.undefined;
  });
  it('should be failed when add a index for without correct RABC role/permission', async() => {
    let error;
    const Ds2 = app.dataSource(
      'couchbase5', {
        cluster: {
          url: 'localhost',
          username: 'test',
          password: 'testpass',
          options: {}
        },
        bucket: {
          name: 'test_index',
          operationTimeout: 60 * 1000
        }
      });
    Ds2.createModel('Food', {
      name: String, type: String,
      type: String, type: String,
      extra: Object, type: Object
    }, { mixins: { 'N1ql': true }, indexes: { source_index: { keys: { 'source': 1 } } } });
    try {
      await Ds2.autoupdate();
    } catch (err) {
      error = err;
    }
    expect(error.message).to.be
      .equal('User does not have credentials to run index operations.\
 Add role query_manage_index on test_index to allow the query to run.');
  });
});
