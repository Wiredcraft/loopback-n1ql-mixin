'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
app.logger = console;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('N1QL Array function array_contains test', () => {
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
    await Book.create({ name: 'name', title: 'title', tags: ['sci-fi', 'war'] });
    await Book.create({ name: 'name2', title: 'title2', tags: [{ name: 'sci-fi' }, { name: 'war' }] });
    await wait(300); // Couchbase have a read delay. We have to waiting for couchbase updated index
  });
  after('Clear', async() => {
    await Book.destroyAll();
  });
  describe('query method', () => {
    it('should support array_contains query', async() => {
      const books = await Book.query({ where: { tags: { array_contains: 'sci-fi' } } });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name');
    });

    it('should support array_contains with document query', async() => {
      const books = await Book.query({ where: { tags: { array_contains: { name: 'war' } } } });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name2');
    });
  });

  describe('count method', () => {
    it('should support array_contains query', async() => {
      const books = await Book.sum({ where: { tags: { array_contains: 'sci-fi' } } });
      expect(books).to.be.eql(1);
    });

    it('should support nested document query', async() => {
      const books = await Book.sum({ where: { tags: { array_contains: { name: 'war' } } } });
      expect(books).to.be.eql(1);
    });
  });
});
