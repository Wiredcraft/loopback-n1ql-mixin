'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
app.logger = console;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('Xlike test', () => {
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
  const Novel = Ds.createModel('Novel', {
    user: String, type: String,
    title: String, type: String,
    tags: Array, type: Array
  }, {
    mixins: { 'N1ql': { primary: true, deferred: false, drop: true } },
    indexes: { title_index: { keys: { title: 'xlike', user: -1 } } }
  });
  Novel.app = app;
  before('Prepare', async() => {
    await Ds.autoupdate();
    await Novel.create({
      user: 'name',
      title: 'The Guide to the Galaxy',
      tags: ['sci-fi', 'war'] });
    await Novel.create({
      user: 'name2',
      title: 'the Quick Brown Fox jumps over the Lazy Dog ',
      tags: [{ name: 'tragedy' }, { name: 'war' }] });
    let count = 0;
    while (count === 0) {
      count = await Novel.sum();
      await wait(400);
    }
  });
  after('Clear', async() => {
    await Novel.destroyAll();
  });
  describe('indexes', () => {
    it('should create suffix index', async() =>{
      const indexes = await Novel
        .rawQuery('select * from system:indexes where name = "title_index"');
      expect(indexes.length).to.be.eql(1);
      expect(indexes[0].indexes.index_key).to.be.eqls([
        '(distinct (array `elem` for `elem` in suffixes(lower(`title`)) end))',
        '`user` DESC'
      ]);
    });
  });
  describe('query method', () => {
    it('should support query by xlike', async() => {
      const books = await Novel.query({ where: { title: { xlike: 'galaxy' } }, order: ['user ASC'] });
      expect(books.length).to.be.eql(1);
      expect(books[0].user).to.be.eql('name');
    });

    it('should support query by xlike II ', async() => {
      const books = await Novel.query({ where: { title: { xlike: 'fox' } }, order: ['user ASC'] });
      expect(books.length).to.be.eql(1);
      expect(books[0].user).to.be.eql('name2');
    });

    it('should return empty result', async() => {
      const books = await Novel.query({ where: { title: { xlike: 'book' } }, order: ['user ASC'] });
      expect(books.length).to.be.eql(0);
    });
  });

  describe('count method', () => {
    it('should support xlike query', async() => {
      const books = await Novel.sum({ where: { title: { xlike: 'galaxy' } } });
      expect(books).to.be.eql(1);
    });

    it('should return ZERO', async() => {
      const books = await Novel.sum({ where: { title: { xlike: 'book' } } });
      expect(books).to.be.eql(0);
    });
  });
});
