export interface ParsedOption {
  text: string;
  isCorrect: boolean;
  order: number;
}

export interface ParsedQuestion {
  text: string;
  type: 'MCQ' | 'MULTI_SELECT' | 'TRUE_FALSE' | 'FILL_IN' | 'SHORT_ANSWER' | 'POLL';
  options: ParsedOption[];
  timeLimit: number;
  points: number;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

/**
 * Parses raw text input into a list of structured questions.
 * Looks for question blocks and options.
 * Correct answers should be marked with a ✅ emoji or checkmark.
 */
export function parseQuizText(text: string): ParseResult {
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/);
  
  let currentQuestion: ParsedQuestion | null = null;
  let optionIndex = 0;

  // Regular expression to match option prefixes like "A.", "B)", "a.", etc.
  const optionRegex = /^([A-H])[\.\)]\s+(.+)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const optionMatch = line.match(optionRegex);

    if (optionMatch) {
      if (!currentQuestion) {
        errors.push(`Line ${i + 1}: Found option "${line}" before any question text.`);
        continue;
      }
      
      const optionLetter = optionMatch[1].toUpperCase();
      let optionText = optionMatch[2].trim();
      let isCorrect = false;

      // Check for checkmark markers
      if (optionText.includes('✅') || optionText.includes('✔️') || optionText.includes('[x]')) {
        isCorrect = true;
        // Clean up the checkmark indicators
        optionText = optionText
          .replace('✅', '')
          .replace('✔️', '')
          .replace('[x]', '')
          .trim();
      }

      currentQuestion.options.push({
        text: optionText,
        isCorrect,
        order: optionIndex++
      });
    } else {
      // Check if we need to save the active question and start a new one
      if (currentQuestion && currentQuestion.options.length > 0) {
        // Run validations on the previous question before pushing
        validateQuestion(currentQuestion, questions.length + 1, errors);
        questions.push(currentQuestion);
        currentQuestion = null;
      }

      // If we already have a question block but no options have been defined yet,
      // it means this might be a multi-line question.
      if (currentQuestion) {
        currentQuestion.text += '\n' + line;
      } else {
        // Start a new question
        // Clean question numbers like "1.", "Q1:", "Question 1:"
        let cleanText = line.replace(/^\d+[\.\)]\s*/, '').replace(/^(Q|Question)\s*\d+[\.\s:]*\s*/i, '').trim();
        
        currentQuestion = {
          text: cleanText,
          type: 'MCQ', // Will refine type based on options later
          options: [],
          timeLimit: 30, // Default 30 seconds
          points: 100 // Default 100 points
        };
        optionIndex = 0;
      }
    }
  }

  // Push the final question if it exists
  if (currentQuestion) {
    validateQuestion(currentQuestion, questions.length + 1, errors);
    questions.push(currentQuestion);
  }

  // Auto-detect question types and correct options
  for (const q of questions) {
    // Detect question type
    const correctCount = q.options.filter(o => o.isCorrect).length;
    
    // Check if it looks like True/False
    const isTrueFalse = q.options.length === 2 && 
      q.options.some(o => o.text.toLowerCase() === 'true') && 
      q.options.some(o => o.text.toLowerCase() === 'false');

    if (isTrueFalse) {
      q.type = 'TRUE_FALSE';
    } else if (correctCount > 1) {
      q.type = 'MULTI_SELECT';
    } else if (q.options.length === 0) {
      // If no options, default to SHORT_ANSWER / FILL_IN
      q.type = 'SHORT_ANSWER';
    } else {
      q.type = 'MCQ';
    }
  }

  return { questions, errors };
}

function validateQuestion(q: ParsedQuestion, index: number, errors: string[]) {
  if (!q.text) {
    errors.push(`Question ${index}: Question text is empty.`);
    return;
  }

  if (q.options.length > 0) {
    const correctCount = q.options.filter(o => o.isCorrect).length;
    if (correctCount === 0) {
      errors.push(`Question ${index}: "${q.text.substring(0, 30)}..." has options but no correct answer is marked with ✅.`);
    }
  }
}
