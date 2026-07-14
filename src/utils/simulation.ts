import { PREDEFINED_QUESTIONS } from '../types';

export function simulateTranscriptExtraction(transcript: string, currentAnswers: any) {
  const extractedFields: any[] = [];
  const text = transcript.toLowerCase();
  
  if (text.includes('paitalis') || text.includes('45')) {
    extractedFields.push({
      fieldId: 'age',
      value: 45,
      confidence: 0.96,
      sourceSnippet: transcript,
      status: 'green'
    });
  }

  if (text.includes('pati') || text.includes('husband') || text.includes('land')) {
    extractedFields.push({
      fieldId: 'owns_agricultural_land',
      value: true,
      confidence: 0.98,
      sourceSnippet: transcript,
      status: 'green'
    });
    extractedFields.push({
      fieldId: 'land_registered_name',
      value: 'Husband',
      confidence: 0.95,
      sourceSnippet: transcript,
      status: 'green'
    });
  }
  
  if (text.includes('bank') && (text.includes('haan') || text.includes('yes'))) {
    extractedFields.push({
      fieldId: 'has_bank_account',
      value: true,
      confidence: 0.98,
      sourceSnippet: transcript,
      status: 'green'
    });
  }

  return {
    extractedFields,
    speaker: 'Respondent',
    reasoning: 'Fallback simulated logic'
  };
}
