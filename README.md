# loopback-n1ql-mixin

[![NPM](https://nodei.co/npm/loopback-n1ql-mixin.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/loopback-n1ql-mixin/)

[![Build Status](https://travis-ci.com/Wiredcraft/loopback-n1ql-mixin.svg?branch=master)](https://travis-ci.com/Wiredcraft/loopback-n1ql-mixin)

Loopback Couchbase N1QL mixin



### Install

```sh
yarn add  loopback-n1ql-mixin
```





### Server Config

Modify `server/model-config.json` as following:

```json
{
  "_meta": {
    "sources": [
      "loopback/common/models",
      "loopback/server/models",
      "../common/models",
      "./models"
    ],
    "mixins": [
      "loopback/common/mixins",
      "../node_modules/loopback-n1ql-mixin/lib",
      "../common/mixins"
    ]
  }
}
```



### Model Config

Add `N1ql` into model config as following:

```json
  {
    "name": "Book",
    "properties": {
      "name": {
        "type": "string",
      }
    },
    "mixins": {
      "N1ql" : true
    }
  }

```

### Index

The mixin support create the [primary index](https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/createprimaryindex.html) and specifc index that is defined in [model definition json](https://loopback.io/doc/en/lb3/Model-definition-JSON-file.html#indexes).

A example:

```json
{
  "name": "Example",
  "base": "PersistedModel",
  "mixins": {
    "N1ql": {
      "primary": false,
      "drop": false,
      "deferred": true  
    }
  },
  "indexes": {
    "status_type": {
        "keys": {
          "type": 1,
          "_type": 1,
          "status": 1,
          "createdAt": 1
        }
    },
  },
  "properties": {},
  "validations": [],
  "relations": {},
  "acls": [],
  "methods": {}
}
```

**Warning**: Indexes will not be automatically created or updated for you. You must run `autoupdate` to create/update indexes!

### Options

- `primary`: Create primary index, default: false. 
  
  > <em>**Avoid Primary Keys in Production** 
  — [CouchBase Index Best Practices](https://blog.couchbase.com/indexing-best-practices/)</em>
  
- `drop`: Drop old same name index, default: false. 
  If drop is false, the autoupdate will **never** update the index even you have changed the index fields
 
- `deferred`: Create index or primary index in defer queue.

  > With defer_build set to TRUE, then the CREATE INDEX operation queues the task for building the index but immediately pauses the building of the index of type GSI. Index building requires an expensive scan operation. Deferring building of the index with multiple indexes can optimize the expensive scan operation. Admins can defer building multiple indexes and, using the BUILD INDEX statement, multiple indexes to be built efficiently with one efficient scan of bucket data.
  
  **An known issue:** The index may keep in `created` status without any progress. You have to execute [build index](https://docs.couchbase.com/server/current/n1ql/n1ql-language-reference/build-index.html) to kick off the building process.
  
  
### Usage

- #### Query

  ```js
  const books = await Book.query({ where: { name: { like: '%For%' } }});
  assert books[0].name === 'For bar';
  ```

  

- #### Count

  ```js
  const total = await Book.sum({ where: { name: { like: '%For%' } }});
  assert total === 10;
  ```

- #### Query Options

  - Force to use dedicated index
    In [some scenarios]() you may need to specifc a index to fulfill your query.
    ```js
    const books = await Book.query({ where: { name: { like: '%For%' } }}, { index: 'name_createdAt_index'});
    assert books[0].name === 'For bar';
    ```



### Support Query

The `query` and `count` accept the loopback filter parameter. Check the loopback filter [doc](https://loopback.io/doc/en/lb3/Working-with-data.html). **Not all the filters are supportted.**The support query approachings as following.


filter  | N1QL 
---|----
Where Basic Filter | ✔️ 
AND & OR operator |  ✔️ 
Range Query | ✔️ 
inq | ✔️ 
near | ✖️ 
not like | ✔️
regexp | ✔️* 
Like Query | ✔️ 
Limit Filter | ✔️ 
Skip Filter |  ✔️ 
Order Filter |  ✔️ 
Include Filter | Not yet
Fields Filter | ✔️ 
Node API | ✔️ 
REST API | ✔️
SQL Inject | Safe * 

### Extra Filter

#### Any filter

Couchbase Support a nested document. There will be a case, when the document looks like as follows:
```js
{
  "type": "book",
  "name": "Galaxy Express 999",
  "tags": [{
    "name": "sf",
     "id": 001
  }, {
    "name": "galaxy",
    "id": 991
  }]
}
```

You have to use `any filter` to access the document. The filter will be like as follows:

```js
Book.query({
  where: {
    "tags.*.id": "001"
  }
})
```

#### xlike

Base on this [post](https://dzone.com/articles/a-couchbase-index-technique-for-like-predicates-wi) implemented a fuzzy search filter on text field.

First of all, you need to create a xlike index as follows:
```json
{
 "indexes": {
    "status_type": {
        "keys": {
          "title": "xlike"
        }
    },
  }
}
```

Then enjoy the xlike as follows:
```js
Book.query({
  where: {
    title: {
      xlike: 'galaxy'
    }
  }
})
```

### >>[FAQ](https://github.com/Wiredcraft/loopback-n1ql-mixin/wiki/FAQ) <<
Check out FAQ when you meet any issue.

#### Notes:


- Regexp: The CouchBase use Golang to implement the pattern matching.  [Supported Syntax](https://github.com/google/re2/wiki/Syntax)
There are two examples:
```JS
 Person.query({ where: { name: { regexp: '^C+.*' } } });
```
```JS
 Person.query({ where: { name: { regexp: /^C+.*/ } } });
```

- SQL injection: The n1ql is generated via concatenating the string. But the parameters do not include in the query. The parameters will be escaped by CouchBase itself. For the reason, it's free from SQL injection.


- Only `ready` status index can be used.


