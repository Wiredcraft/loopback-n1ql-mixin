'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
app.logger = console;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('Square bracket escape test', () => {
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
    user: String, type: String,
    title: String, type: String,
    tags: Array, type: Array
  }, { mixins: { 'N1ql': { primary: true } } });
  Book.app = app;
  before('Prepare', async() => {
    await Ds.autoupdate();
    await Book.create({ user: 'name', title: 'title', tags: ['sci-fi', 'war'] });
    await Book.create({ user: 'name2', title: 'title2', tags: [{ name: 'tragedy' }, { name: 'war' }] });
    let count = 0;
    while (count === 0) {
      count = await Book.sum();
      await wait(400);
    }
  });
  after('Clear', async() => {
    await Book.destroyAll();
  });
  describe('query method', () => {
    it('should support access array type query', async() => {
      const books = await Book.query({ where: { 'tags[0]': 'sci-fi' }, order: ['user ASC'] });
      expect(books.length).to.be.eql(1);
      expect(books[0].user).to.be.eql('name');
    });

    it('should support access array type query II ', async() => {
      const books = await Book.query({ where: { 'tags[0].name': 'tragedy' }, order: ['user ASC'] });
      expect(books.length).to.be.eql(1);
      expect(books[0].user).to.be.eql('name2');
    });

    it('should return empty result', async() => {
      const books = await Book.query({ where: { 'tags[0]': 'war' }, order: ['user ASC'] });
      expect(books.length).to.be.eql(0);
    });
  });

  describe('count method', () => {
    it('should support inq query', async() => {
      const books = await Book.sum({ where: { 'tags[0]': 'sci-fi' } });
      expect(books).to.be.eql(1);
    });

    it('should return ZERO', async() => {
      const books = await Book.sum({ where: { 'tags[0]': 'war' } });
      expect(books).to.be.eql(0);
    });
  });
});
