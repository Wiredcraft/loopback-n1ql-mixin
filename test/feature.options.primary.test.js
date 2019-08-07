'use strict';

const loopback = require('loopback');
const chai = require('chai');
const expect = chai.expect;
global.Promise = require('bluebird');
const app = loopback();
app.logger = console;
describe('Index option Primary test', () => {
  it('should not create a primary index when primary is false', async() => {
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
    const Shoe = Ds.createModel('Shoe', {
      name: String, type: String,
      type: String, type: String,
      extra: Object, type: Object
    }, { mixins: { 'N1ql': { primary: false } }, indexes: { } });
    const Box = Ds.createModel('Box', {
      name: String, type: String,
      type: String, type: String,
      extra: Object, type: Object
    }, { mixins: { 'N1ql': { primary: true } }, indexes: { } });
    await Ds.autoupdate();
    let indexes = await Shoe.rawQuery('select * from system:indexes where name = "Shoe" AND is_primary = true', {});
    expect(indexes).to.be.eql([]);
    indexes = await Box.rawQuery('select * from system:indexes where name = "Box" AND is_primary = true', {});
    expect(indexes.length).to.be.eql(1);
  });
});
