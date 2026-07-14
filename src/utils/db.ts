/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from 'dexie';
import { type SurveySession, type SyncLog, PREDEFINED_QUESTIONS, type FieldValue } from '../types';

class SurveyDatabase extends Dexie {
  surveys!: Table<SurveySession>;
  syncLogs!: Table<SyncLog>;

  constructor() {
    super('SurveyDatabase');
    this.version(1).stores({
      surveys: 'id, respondentName, villageName, createdAt, updatedAt, status',
      syncLogs: '++id, surveyId, timestamp, status'
    });
  }
}

export const db = new SurveyDatabase();

// Initialize default answers structure for a new survey
export function createDefaultAnswers(): Record<string, FieldValue> {
  const answers: Record<string, FieldValue> = {};
  for (const q of PREDEFINED_QUESTIONS) {
    answers[q.id] = {
      value: q.type === 'multiselect' ? [] : q.type === 'boolean' ? null : '',
      confidence: 1.0,
      sourceSnippet: '',
      status: 'empty',
      lastModifiedBy: 'user',
      isConfirmed: false
    };
  }
  return answers;
}

// Service helper methods
export async function saveSurvey(survey: SurveySession): Promise<string> {
  survey.updatedAt = Date.now();
  await db.surveys.put(survey);
  return survey.id;
}

export async function getSurvey(id: string): Promise<SurveySession | undefined> {
  return await db.surveys.get(id);
}

export async function listSurveys(): Promise<SurveySession[]> {
  return await db.surveys.orderBy('updatedAt').reverse().toArray();
}

export async function deleteSurvey(id: string): Promise<void> {
  await db.surveys.delete(id);
}

export async function addSyncLog(log: SyncLog): Promise<number> {
  return await db.syncLogs.add(log);
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  return await db.syncLogs.toArray();
}

// Validation logic for active question
export function validateField(fieldId: string, value: any): { isValid: boolean; errorMsg?: string } {
  const q = PREDEFINED_QUESTIONS.find(item => item.id === fieldId);
  if (!q) return { isValid: true };

  // If required and empty
  if (q.required) {
    if (value === null || value === undefined || value === '') {
      return { isValid: false, errorMsg: `${q.label} is required.` };
    }
    if (Array.isArray(value) && value.length === 0) {
      return { isValid: false, errorMsg: `${q.label} is required.` };
    }
  }

  if (q.validationRules) {
    const numVal = Number(value);
    if (q.validationRules.min !== undefined && numVal < q.validationRules.min) {
      return { isValid: false, errorMsg: q.validationRules.errorMsg };
    }
    if (q.validationRules.max !== undefined && numVal > q.validationRules.max) {
      return { isValid: false, errorMsg: q.validationRules.errorMsg };
    }
  }

  return { isValid: true };
}

// Cross-field Validation Checks
export interface CrossValidationIssue {
  fields: string[];
  severity: 'warning' | 'error';
  message: string;
}

export function runCrossValidation(answers: Record<string, FieldValue>): CrossValidationIssue[] {
  const issues: CrossValidationIssue[] = [];

  const ageVal = Number(answers['age']?.value);
  const maritalVal = answers['marital_status']?.value;
  const householdSize = Number(answers['household_size']?.value);
  const dependents = Number(answers['dependents_count']?.value);
  const ownsLand = answers['owns_agricultural_land']?.value;
  const landRegName = answers['land_registered_name']?.value;
  const ownNameLand = answers['has_land_in_own_name']?.value;
  const femaleWages = Number(answers['female_wages']?.value);
  const maleWages = Number(answers['male_wages']?.value);
  const dailyFarmHours = Number(answers['daily_hours_farm']?.value);
  const dailyChoresHours = Number(answers['daily_hours_chores']?.value);
  const dailyCareHours = Number(answers['daily_hours_care']?.value);
  const dailyRestHours = Number(answers['daily_hours_rest']?.value);

  // 1. Child marriage or inconsistent marital status
  if (ageVal > 0 && ageVal < 18 && maritalVal && maritalVal !== 'single') {
    issues.push({
      fields: ['age', 'marital_status'],
      severity: 'warning',
      message: `Respondent age is ${ageVal} (under 18) but marital status is '${maritalVal}'. Flagged for verification.`
    });
  }

  // 2. Dependents count greater than household size
  if (householdSize > 0 && dependents > householdSize) {
    issues.push({
      fields: ['household_size', 'dependents_count'],
      severity: 'error',
      message: `Dependents count (${dependents}) cannot exceed total household size (${householdSize}).`
    });
  }

  // 3. Land registration details inconsistent with land ownership
  if (ownsLand === false && (landRegName && landRegName !== 'none')) {
    issues.push({
      fields: ['owns_agricultural_land', 'land_registered_name'],
      severity: 'warning',
      message: `Household is marked as NOT owning agricultural land, but Land Registered Name is set to '${landRegName}'.`
    });
  }

  // 4. Land in own name yes, but land registered name is 'none'
  if (ownNameLand === true && landRegName === 'none') {
    issues.push({
      fields: ['land_registered_name', 'has_land_in_own_name'],
      severity: 'error',
      message: `Land is marked in respondent's own name, but land registered details say 'none'.`
    });
  }

  // 5. Unreasonable wage disparity (e.g. female wages are less than half of male wages)
  if (femaleWages > 0 && maleWages > 0 && femaleWages < maleWages * 0.5) {
    issues.push({
      fields: ['female_wages', 'male_wages'],
      severity: 'warning',
      message: `Wage disparity: Females earn Rs. ${femaleWages} while males earn Rs. ${maleWages} daily (females earn < 50%). Please verify if accurate.`
    });
  }

  // 6. Total active daily hours exceeds 24
  const totalHours = dailyFarmHours + dailyChoresHours + dailyCareHours + dailyRestHours;
  if (totalHours > 24) {
    issues.push({
      fields: ['daily_hours_farm', 'daily_hours_chores', 'daily_hours_care', 'daily_hours_rest'],
      severity: 'error',
      message: `Total daily allocated hours (${totalHours} hrs) exceeds 24 hours. Please re-apportion.`
    });
  }

  return issues;
}
