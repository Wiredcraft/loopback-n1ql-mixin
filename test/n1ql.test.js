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
  }, { mixins: { 'N1ql': true } });
  Book.app = app;
  before('Prepare', async() => {
    await Book.boot();
    await Ds.autoupdate();
    await Book.create({ name: 'name', title: 'title', extra: { author: { name: 'foo' } } });
    await Book.create({ name: 'name2', title: 'title2', extra: { author: { name: 'bar' } } });
    await wait(200);
  });
  after('Clear', async() => {
    await Book.destroyAll();
  });
  it('should support single eql query', async() => {
    const books = await Book.query({ where: { name: 'name' } });
    expect(books.total).to.be.eql(1);
  });

  it('should support nested document query', async() => {
    const books = await Book.query({ where: { 'extra.author.name': 'foo' } });
    expect(books.total).to.be.eql(1);
  });
});
