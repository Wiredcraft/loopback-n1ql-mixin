'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
app.logger = console;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('Issue#12 Test', () => {
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
    tags: Array, type: Array
  }, { mixins: { 'N1ql': true } });
  Book.app = app;
  before('Prepare', async() => {
    await Ds.autoupdate();
    await Book.create({ name: 'name', title: null, tags: ['sci-fi', 'war'] });
    await Book.create({ name: 'name2', title: 'title', tags: [{ name: 'sci-fi' }, { name: 'war' }] });
    await wait(300); // Couchbase have a read delay. We have to waiting for couchbase updated index
  });
  after('Clear', async() => {
    await Book.destroyAll();
  });
  describe('query method', () => {
    it('should find null value book', async() => {
      const books = await Book.query({ where: { title: null }, order: ['name ASC'] });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name');
    });

    it('should find NOT null result', async() => {
      const books = await Book.query({ where: { title: { neq: null } }, order: ['name ASC'] });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name2');
    });
  });

  describe('count method', () => {
    it('should return 1 for null value book', async() => {
      const books = await Book.sum({ where: { title: null } });
      expect(books).to.be.eql(1);
    });

    it('should return 1 for NOT null value book', async() => {
      const books = await Book.sum({ where: { title: { neq: null } } });
      expect(books).to.be.eql(1);
    });
  });
});
