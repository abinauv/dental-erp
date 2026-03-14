import { readFileSync } from 'fs';
const raw = readFileSync(process.argv[2], 'utf8');
const d = JSON.parse(raw);
console.log(`Total: ${d.numTotalTests} | Pass: ${d.numPassedTests} | Fail: ${d.numFailedTests}`);
console.log(`Suites: ${d.numTotalTestSuites} total, ${d.numPassedTestSuites} passed, ${d.numFailedTestSuites} failed\n`);
for (const s of d.testResults) {
  const fails = s.assertionResults.filter(a => a.status === 'failed');
  if (fails.length) {
    const name = s.name.replace(/.*dental-erp[\\/]/, '');
    console.log(`--- ${name} ---`);
    for (const f of fails) console.log(`  FAIL: ${f.fullName}`);
  }
}
