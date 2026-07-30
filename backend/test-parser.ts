import { parseQuizText } from './src/utils/parser';

// Mock text data mimicking a standard teacher plain text upload
const sampleQuizContent = `
1. What is the capital of India?
A. Mumbai
B. Chennai
C. New Delhi ✅
D. Kolkata

Which language runs in the browser?
A. Python
B. Java
C. JavaScript ✅
D. C++

Is Node.js a programming language?
A. True
B. False ✅
`;

const malformedQuizContent = `
Question with no checkmark?
A. Option 1
B. Option 2
`;

function runTests() {
  console.log('🧪 Starting Quiz Parser Verification Tests...\n');

  // Test 1: Successful parsing
  console.log('--- Test 1: Standard Parsing ---');
  const result1 = parseQuizText(sampleQuizContent);
  
  if (result1.errors.length > 0) {
    console.error('❌ Test 1 failed with unexpected errors:', result1.errors);
    process.exit(1);
  }

  if (result1.questions.length !== 3) {
    console.error(`❌ Test 1 failed: Expected 3 questions, got ${result1.questions.length}`);
    process.exit(1);
  }

  // Check Question 1 (MCQ)
  const q1 = result1.questions[0];
  console.log(`Question 1: "${q1.text}" (Type: ${q1.type})`);
  q1.options.forEach((o, idx) => {
    console.log(`  - Option ${idx + 1}: "${o.text}" | Correct: ${o.isCorrect}`);
  });
  
  const q1Correct = q1.options.find(o => o.isCorrect);
  if (!q1Correct || q1Correct.text !== 'New Delhi') {
    console.error('❌ Test 1 failed: Correct option text check failed.');
    process.exit(1);
  }
  if (q1Correct.text.includes('✅')) {
    console.error('❌ Test 1 failed: Correct mark ✅ was not stripped.');
    process.exit(1);
  }

  // Check Question 3 (True/False)
  const q3 = result1.questions[2];
  console.log(`Question 3: "${q3.text}" (Type: ${q3.type})`);
  if (q3.type !== 'TRUE_FALSE') {
    console.error(`❌ Test 1 failed: Expected Question 3 type to be TRUE_FALSE, got ${q3.type}`);
    process.exit(1);
  }

  console.log('✅ Test 1 passed successfully.\n');

  // Test 2: Validation errors for malformed content
  console.log('--- Test 2: Malformed Check ---');
  const result2 = parseQuizText(malformedQuizContent);
  console.log('Questions parsed:', result2.questions.length);
  console.log('Errors caught:', result2.errors);
  
  if (result2.errors.length === 0) {
    console.error('❌ Test 2 failed: Expected validation warning for missing correct check ✅');
    process.exit(1);
  }
  console.log('✅ Test 2 passed successfully.\n');

  console.log('🎉 ALL PARSER TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests();
