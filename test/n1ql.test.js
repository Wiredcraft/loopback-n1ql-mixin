'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('N1ql test', () => {
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
    extra: Object, type: Object
  }, { mixins: { 'N1ql': { primary: true, deferred: false } }, indexes:
    { name_index: { 'name': 1 },
      extra_author_index: { 'extra.author.name': 1 } } }
  );
  Book.app = app;
  let book1;
  before('Prepare', async() => {
    await Ds.autoupdate();
    book1 = await Book.create({ name: 'name', title: 'title', extra: { author: { name: 'foo' } } });
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
  describe('filter object modified issue', () => {
    it('should not modify the filter', async() => {
      const filter = { where: { and: [{ 'extra.author.name': 'foo' }] } };
      let books = await Book.query(filter);
      expect(books.length).to.be.eql(1);
      books = await Book.query(filter);
      expect(books.length).to.be.eql(1);
    });
  });
  describe('query method', () => {
    it('should support single eql query', async() => {
      const books = await Book.query({ where: { name: 'name' } });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name');
    });

    it('should support empty query', async() => {
      const books = await Book.query({ where: {} });
      expect(books.length).to.be.eql(2);
    });

    it('should support nested document query', async() => {
      const books = await Book.query({ where: { 'extra.author.name': 'foo' } });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name');
    });

    it('should support query by id', async() => {
      const books = await Book.query({ where: { id: book1.id } });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql(book1.name);
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
