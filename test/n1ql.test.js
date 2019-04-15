'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
app.logger = console;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('N1ql test', () => {
  const Ds = app.dataSource(
    'couchbase5', {
      cluster: {
        url: 'couchbase://localhost',
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
  const Book = Ds.createModel('Book', {
    name: String, type: String,
    title: String, type: String,
    extra: Object, type: Object
  }, { mixins: { 'N1ql': true }, indexes:
    { name_index: { 'name': 1 },
      extra_author_index: { 'extra.author.name': 1 } } }
  );
  Book.app = app;
  before('Prepare', async() => {
    await Ds.autoupdate();
    await Book.create({ name: 'name', title: 'title', extra: { author: { name: 'foo' } } });
    await Book.create({ name: 'name2', title: 'title2', extra: { author: { name: 'bar' } } });
    await wait(200);
  });
  after('Clear', async() => {
    await Book.destroyAll();
  });

  describe('index', () => {
    it('should contains name index', async() => {
      const indexes = (await Book.getConnector()
        .manager()
        .call('getIndexesAsync')).map(i => i.name);
      expect(indexes).to.be.eql(['Book', 'extra_author_index', 'name_index']);
    });
  });
  describe('query method', () => {
    it('should support single eql query', async() => {
      const books = await Book.query({ where: { name: 'name' } });
      expect(books.length).to.be.eql(1);
    });

    it('should support nested document query', async() => {
      const books = await Book.query({ where: { 'extra.author.name': 'foo' } });
      expect(books.length).to.be.eql(1);
    });
  });

  describe('count method', () => {
    it('should support single eql query', async() => {
      const books = await Book.sum({ where: { name: 'name' } });
      expect(books).to.be.eql(1);
    });

    it('should support nested document query', async() => {
      const books = await Book.sum({ where: { 'extra.author.name': 'foo' } });
      expect(books).to.be.eql(1);
    });
  });
});
