'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('N1ql Any query test', () => {
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
  const Book = Ds.createModel('Book', {
    name: String, type: String,
    title: String, type: String,
    authors: Array, type: Array
  }, { mixins: { 'N1ql': { primary: true, deferred: false } }, indexes:
    { name_index: { 'name': 1 } }
  });
  Book.app = app;
  before('Prepare', async() => {
    await Ds.autoupdate();
    await Book.create(
      { name: 'name',
        title: 'title',
        authors: [{ name: 'foo', title: 'Mr' }, { name: 'bar', title: 'Mrs' }]
      });
    await Book.create({ name: 'name2', title: 'title2', extra: { author: { name: 'bar' } } });
    let count = 0;
    while (count === 0) {
      count = await Book.sum();
      await wait(200);
    }
  });
  after('Clear', async() => {
    await Book.destroyAll();
  });

  describe('query method', () => {
    it('should support nested document query', async() => {
      const books = await Book.query({ where: { 'authors.*.name': 'foo' } });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name');
    });
  });

  describe('count method', () => {
    it('should support nested document query', async() => {
      const books = await Book.sum({ where: { 'authors.*.name': 'foo' } });
      expect(books).to.be.eql(1);
    });
  });
});
