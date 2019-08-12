'use strict';

const loopback = require('loopback');
const chai = require('chai');
const expect = chai.expect;
global.Promise = require('bluebird');
const app = loopback();
app.logger = console;
describe('Create Index test', () => {
  it('should be failed when add a index for an undefined field', async() => {
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
