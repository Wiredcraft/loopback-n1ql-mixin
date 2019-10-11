'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
app.logger = console;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('keyword escape test', () => {
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
  const User = Ds.createModel('User', {
    user: String, type: String,
    title: String, type: String,
    tags: Array, type: Array
  }, {
    indexes: {
      user_idx: {
        keys: {
          user: 1
        }
      }
    },
    mixins: { 'N1ql': { primary: true } }
  });
  User.app = app;
  before('Prepare', async() => {
    await Ds.autoupdate();
    await User.create({ user: 'name', title: 'title', tags: ['sci-fi', 'war'] });
    await User.create({ user: 'name2', title: 'title2', tags: [{ name: 'sci-fi' }, { name: 'war' }] });
    await wait(300); // Couchbase have a read delay. We have to waiting for couchbase updated index
  });
  after('Clear', async() => {
    await User.destroyAll();
  });
  describe('query method', () => {
    it('should support inq query', async() => {
      const users = await User.query({ where: { user: { inq: ['name', 'name2'] } }, order: ['user ASC'] });
      expect(users.length).to.be.eql(2);
      expect(users[0].user).to.be.eql('name');
    });

    it('should return empty result', async() => {
      const users = await User.query({ where: { user: { inq: ['not_exists', 'not_exists2'] } }, order: ['user ASC'] });
      expect(users.length).to.be.eql(0);
    });

    it('should return ONLY one result', async() => {
      const users = await User.query({ where: { user: { inq: ['not_exists', 'name'] } }, order: ['user ASC'] });
      expect(users.length).to.be.eql(1);
      expect(users[0].user).to.be.eql('name');
    });
  });

  describe('count method', () => {
    it('should support inq query', async() => {
      const users = await User.sum({ where: { user: { inq: ['name', 'name2'] } } });
      expect(users).to.be.eql(2);
    });

    it('should return ZERO', async() => {
      const users = await User.sum({ where: { user: { inq: ['not_exists', 'not_exists2'] } } });
      expect(users).to.be.eql(0);
    });

    it('should return 1', async() => {
      const users = await User.sum({ where: { user: { inq: ['not_exists', 'name'] } } });
      expect(users).to.be.eql(1);
    });
  });
});
