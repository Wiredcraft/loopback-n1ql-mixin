'use strict';

const loopback = require('loopback');
const N1ql = require('../lib/n1ql');
const expect = require('chai').expect;
const app = loopback();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
describe('N1ql query option', () => {
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
  before('Prepare', async() => {
    await Ds.autoupdate();
    await Book.create({ name: 'name', title: 'title', extra: { author: { name: 'foo' } } });
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
    it('should choose index', async() => {
      const books = await Book.query(
        { where: { name: 'name' } }, { index: 'name_index' });
      expect(books.length).to.be.eql(1);
      expect(books[0].name).to.be.eql('name');
    });
    it('should throw a error when index not found', async() => {
      let error;
      try {
        await Book.query(
          { where: { name: 'name' } }, { index: 'name_index2' });
      } catch (err) {
        error = err;
      }
      expect(error.message).to.be.eql('GSI index name_index2 not found.');
    });
  });

  describe('count method', () => {
    it('should choose index', async() => {
      const total = await Book.sum({ where: { name: 'name' } }, { index: 'name_index' });
      expect(total).to.be.eql(1);
    });

    it('should throw a error when index not found', async() => {
      let error;
      try {
        await Book.sum(
          { where: { name: 'name' } }, { index: 'name_index2' });
      } catch (err) {
        error = err;
      }
      expect(error.message).to.be.eql('GSI index name_index2 not found.');
    });
  });
});
