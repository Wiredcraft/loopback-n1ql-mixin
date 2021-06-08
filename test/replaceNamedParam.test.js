/* eslint-disable max-len */
'use strict';

const replaceNamedParam = require('../lib/replaceNamedParam');
const expect = require('chai').expect;

describe('replaceNamedParam test', () => {
  it('should replace named parameter with their value: single parameter', async() => {
    const ql = "SELECT COUNT(META().id) as total from `products`  WHERE _type='Product' AND ( ANY array_element IN SUFFIXES(LOWER(`name`)) SATISFIES array_element like $param_2 END)";
    const pa = { param_2: '%耳环%' };
    const res = replaceNamedParam(ql, pa);
    expect(res).to.be.eql("SELECT COUNT(META().id) as total from `products`  WHERE _type='Product' AND ( ANY array_element IN SUFFIXES(LOWER(`name`)) SATISFIES array_element like '%耳环%' END)");
  });
  it('should replace named parameter with their value: multiple parameters', async() => {
    const ql = "SELECT *,TOSTRING(META().id) AS id from `products`  WHERE _type='Product' AND ( `name` = $param_1 AND  ARRAY_CONTAINS(`tags`, $param_3) AND  `user` IN $param_5) ORDER BY `updatedAt` DESC LIMIT 25";
    const pa = { param_1: '耳环', param_3: 'sci-fi', param_5: ['name', 'name2'] };
    const res = replaceNamedParam(ql, pa);
    expect(res).to.be.eql("SELECT *,TOSTRING(META().id) AS id from `products`  WHERE _type='Product' AND ( `name` = '耳环' AND  ARRAY_CONTAINS(`tags`, 'sci-fi') AND  `user` IN [\"name\",\"name2\"]) ORDER BY `updatedAt` DESC LIMIT 25");
  });
  it('should replace named parameter with their value and do escaping for single quote', async() => {
    const ql = "SELECT COUNT(META().id) as total from `products`  WHERE _type='Product' AND ( ANY array_element IN SUFFIXES(LOWER(`name`)) SATISFIES array_element like $param_2 END)";
    const pa = { param_2: "' OR '1'='1" };
    const res = replaceNamedParam(ql, pa);
    expect(res).to.be.eql("SELECT COUNT(META().id) as total from `products`  WHERE _type='Product' AND ( ANY array_element IN SUFFIXES(LOWER(`name`)) SATISFIES array_element like ''' OR ''1''=''1' END)");
  });
});
