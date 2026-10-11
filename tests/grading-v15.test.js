/* Run: node tests/grading-v15.test.js */
const assert = require('node:assert/strict');
const g = require('../member/js/kf-grading-v15.js');
const weights = {pg4:40, esai:60};
const base = [{type:'pg4',earnedPoints:4,maxPoints:5},{type:'esai',earnedPoints:6,maxPoints:10}];
assert.equal(g.calculateFinal({questions:base,weights,publish:true}).finalScore,68);
assert.equal(g.calculateFinal({questions:[base[0],{type:'esai',earnedPoints:null,maxPoints:10}],weights}).ready,false);
assert.throws(()=>g.calculateFinal({questions:[base[0],{type:'esai',earnedPoints:null,maxPoints:10}],weights,publish:true}));
assert.throws(()=>g.validateWeights({pg4:40,esai:50},['pg4','esai']));
assert.throws(()=>g.scoreQuestion({type:'mcma',earnedPoints:6,maxPoints:5}));
assert.equal(g.certificateEligible({published:true,completed:true,finalScore:75}),true);
assert.equal(g.certificateEligible({published:false,completed:true,finalScore:100}),false);
assert.equal(g.certificateEligible({published:true,completed:false,finalScore:100}),false);
console.log('V15 grading unit tests passed');
