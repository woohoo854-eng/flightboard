const path = require('path');
const { loadNotableRules, getNotableFlightInfo } = require('./notable');

const rulesPath = path.join(__dirname, 'data', 'notable-rules.json');
loadNotableRules(rulesPath);

const tests = [
  {
    name: 'Widebody',
    input: { typecode: 'B789' },
    expectedReason: 'Wide-body long-haul'
  },
  {
    name: 'Private jet',
    input: { typecode: 'GLEX' },
    expectedReason: 'Private jet'
  },
  {
    name: 'Cargo',
    input: { typecode: 'B74F' },
    expectedReason: 'Cargo / special'
  },
  {
    name: 'Special registration',
    input: { registration: 'N747BA' },
    expectedReason: 'Boeing Dreamlifter'
  },
  {
    name: 'High altitude',
    input: { altitude: 42000 },
    expectedReason: 'High altitude'
  },
  {
    name: 'Climb',
    input: { verticalRate: 3500 },
    expectedReason: 'Aggressive climb/descent'
  },
  {
    name: 'Descent',
    input: { verticalRate: -3500 },
    expectedReason: 'Aggressive climb/descent'
  },
  {
    name: 'Nothing',
    input: { typecode: 'B738', altitude: 30000, verticalRate: 200 },
    expectedReason: null
  },
  {
    name: 'Null safety',
    input: { typecode: null, registration: null },
    expectedReason: null
  },
  {
    name: 'Order precedence',
    input: { typecode: 'B789', altitude: 42000 },
    expectedReason: 'Wide-body long-haul'
  }
];

let passed = 0;
console.log('Running notable-flight tests...');
for (const testCase of tests) {
  const result = getNotableFlightInfo(testCase.input);
  const got = result.notableReason;
  const pass = got === testCase.expectedReason;
  const mark = pass ? '✓' : '✗';
  if (pass) {
    passed += 1;
  }

  console.log(`${mark} ${testCase.name}: expected=${JSON.stringify(testCase.expectedReason)}, got=${JSON.stringify(got)}`);
}

const total = tests.length;
console.log('');
if (passed === total) {
  console.log(`PASS ${passed}/${total} tests`);
  process.exit(0);
} else {
  console.log(`FAIL ${passed}/${total} tests`);
  process.exit(1);
}
