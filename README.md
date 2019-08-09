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
    "N1ql": true
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
