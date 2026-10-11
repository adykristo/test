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

// Real submitted example: PG4 = 0%, essay = 100%, weights 40:60 -> 60.
const actual = [{type:'pg4',earnedPoints:0,maxPoints:1},{type:'esai',earnedPoints:10,maxPoints:10}];
assert.equal(g.calculateFinal({questions:actual,weights,publish:true}).finalScore,60);
// Support every assessed question type and MCMA/category partial scoring.
const mixed = [
 {type:'pg4',earnedPoints:1,maxPoints:1},
 {type:'pg5',earnedPoints:0,maxPoints:1},
 {type:'mcma',earnedPoints:.5,maxPoints:1},
 {type:'kategori',earnedPoints:.75,maxPoints:1},
 {type:'isian',earnedPoints:1,maxPoints:1},
 {type:'esai',earnedPoints:7,maxPoints:10}
];
const equalWeights={pg4:20,pg5:10,mcma:20,kategori:20,isian:10,esai:20};
assert.equal(g.calculateFinal({questions:mixed,weights:equalWeights,publish:true}).finalScore,69);
assert.equal(g.calculateFinal({questions:[{type:'esai',earnedPoints:null,maxPoints:10}],weights:{esai:100}}).finalScore,null);
assert.throws(()=>g.calculateFinal({questions:[{type:'esai',earnedPoints:11,maxPoints:10}],weights:{esai:100}}));
assert.throws(()=>g.validateWeights({pg4:-1,esai:101},['pg4','esai']));
assert.equal(g.certificateEligible({published:true,completed:true,finalScore:74.99}),false);
assert.equal(g.certificateEligible({published:true,completed:true,finalScore:75}),true);

console.log('V15 grading unit tests passed');
