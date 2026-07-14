/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FieldValue {
  value: any; // string | number | boolean | string[] | null
  confidence: number; // 0.0 to 1.0
  sourceSnippet: string; // Transcript text snippet where the value was found
  audioTimestamp?: number; // Offset in seconds
  status: 'empty' | 'green' | 'yellow' | 'red'; // Status mapping (Green: High confidence, Yellow: Needs confirm, Red: Invalid)
  lastModifiedBy: 'system' | 'user';
  isConfirmed: boolean;
}

export interface QuestionDefinition {
  id: string;
  label: string;
  section: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'boolean';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  validationRules?: {
    min?: number;
    max?: number;
    pattern?: string;
    errorMsg: string;
  };
}

export interface SurveySession {
  id: string;
  respondentName: string;
  villageName: string;
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'completed' | 'synced';
  gps?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  answers: Record<string, FieldValue>;
  fullTranscript: Array<{
    speaker: 'Enumerator' | 'Respondent' | 'Woman 1' | 'Woman 2' | 'Unknown';
    text: string;
    timestamp: number; // in seconds
    confidence: number;
  }>;
  audioBlob?: Blob | ArrayBuffer;
  signatures?: {
    enumerator: string; // Base64
    respondent: string; // Base64
  };
  photos?: Array<{
    id: string;
    base64: string;
    caption: string;
    timestamp: number;
  }>;
}

export interface SyncLog {
  id?: number;
  surveyId: string;
  timestamp: number;
  status: 'success' | 'failed';
  errorMessage?: string;
}

export const PREDEFINED_QUESTIONS: QuestionDefinition[] = [
  // SECTION 1: Respondent Details
  {
    id: 'respondent_name',
    label: '1. Respondent Name',
    section: 'Respondent Details',
    type: 'text',
    required: true,
    placeholder: 'Enter name of female farmer'
  },
  {
    id: 'address',
    label: '2. Address (village, block, district)',
    section: 'Respondent Details',
    type: 'text',
    required: true,
    placeholder: 'e.g., Ramgarh Village, Chhatarpur Block, Varanasi District'
  },
  {
    id: 'age',
    label: '3. Age',
    section: 'Respondent Details',
    type: 'number',
    required: true,
    placeholder: 'Enter age in years',
    validationRules: {
      min: 15,
      max: 120,
      errorMsg: 'Age must be between 15 and 120'
    }
  },
  {
    id: 'marital_status',
    label: '4. Marital Status',
    section: 'Respondent Details',
    type: 'select',
    options: ['single', 'married', 'widowed', 'separated', 'abandoned'],
    required: true
  },
  {
    id: 'education',
    label: '5. Education (class till which you studied)',
    section: 'Respondent Details',
    type: 'select',
    options: ['illiterate', 'primary', 'secondary', 'higher secondary', 'graduate and above'],
    required: true
  },
  {
    id: 'religion',
    label: '6. Religion',
    section: 'Respondent Details',
    type: 'text',
    required: true,
    placeholder: 'e.g., Hindu, Muslim, Christian, Sikh, Other'
  },
  {
    id: 'social_category',
    label: '7. Social Category',
    section: 'Respondent Details',
    type: 'select',
    options: ['General', 'OBC', 'SC', 'ST', 'Not applicable'],
    required: true
  },
  {
    id: 'household_size',
    label: '8. Household Size',
    section: 'Respondent Details',
    type: 'number',
    required: true,
    placeholder: 'Total family members',
    validationRules: {
      min: 1,
      max: 30,
      errorMsg: 'Size must be between 1 and 30'
    }
  },
  {
    id: 'dependents_count',
    label: '8b. Dependents (children below 10 or elderly)',
    section: 'Respondent Details',
    type: 'number',
    placeholder: 'Number of dependents',
    validationRules: {
      min: 0,
      max: 20,
      errorMsg: 'Dependents cannot exceed 20'
    }
  },
  {
    id: 'head_of_household',
    label: '9. Head of Household',
    section: 'Respondent Details',
    type: 'text',
    required: true,
    placeholder: 'Who is the head of your family?'
  },

  // SECTION 2: Primary Occupation & Land
  {
    id: 'primary_occupation',
    label: '10. Primary Occupation',
    section: 'Primary Occupation & Land',
    type: 'select',
    options: ['cultivator', 'labourer', 'both', 'allied activities(livestock, dairy, poultry, fisheries)'],
    required: true
  },
  {
    id: 'farming_type',
    label: '10b. Type of Farming',
    section: 'Primary Occupation & Land',
    type: 'select',
    options: ['subsistence', 'commercial', 'both'],
    required: true
  },
  {
    id: 'decision_maker_sow',
    label: '10c. Who takes the decision to sow?',
    section: 'Primary Occupation & Land',
    type: 'text',
    placeholder: 'e.g., Self, Husband, Jointly, Father-in-law'
  },
  {
    id: 'owns_agricultural_land',
    label: '11. Does your household own agricultural land?',
    section: 'Primary Occupation & Land',
    type: 'boolean',
    required: true
  },
  {
    id: 'land_registered_name',
    label: '11b. In whose name is the land registered?',
    section: 'Primary Occupation & Land',
    type: 'select',
    options: ['self', 'husband', 'father in law', 'jointly', 'none']
  },
  {
    id: 'has_land_in_own_name',
    label: '11c. Do you have land in your name?',
    section: 'Primary Occupation & Land',
    type: 'boolean'
  },
  {
    id: 'land_own_name_reason',
    label: '11d. If not, reason (only if comfortable)',
    section: 'Primary Occupation & Land',
    type: 'text',
    placeholder: 'Reason for no registered land in own name'
  },

  // SECTION 3: Activities, Earning & Wages
  {
    id: 'farm_activities',
    label: '12. Which farm activities do you perform? (Select all that apply)',
    section: 'Activities, Earning & Wages',
    type: 'multiselect',
    options: [
      'Sowing/transplanting',
      'Weeding',
      'Harvesting',
      'Application of fertilizer',
      'Irrigation management',
      'Post-harvest processing/storage',
      'Marketing/selling the produce',
      'Livestock management',
      'Farm decision making'
    ]
  },
  {
    id: 'involvement_increased_5_10_years',
    label: '13. Has your involvement in the farms increased in the past 5-10 years?',
    section: 'Activities, Earning & Wages',
    type: 'boolean'
  },
  {
    id: 'main_reason_farm_work',
    label: '14. Main reason for you to work in the farms',
    section: 'Activities, Earning & Wages',
    type: 'select',
    options: [
      'Male member migrated for work',
      'Male member took up non-farm job but not migrated',
      'Death/illness/disability of male earning member',
      'Increasing poverty/debt',
      'Personal choice',
      'Farming is the main occupation of the family',
      'Other'
    ]
  },
  {
    id: 'approx_farm_earning',
    label: '15. Approximate annual earning from the farm (INR)',
    section: 'Activities, Earning & Wages',
    type: 'number',
    placeholder: 'Amount in Rupees',
    validationRules: {
      min: 0,
      errorMsg: 'Earnings must be positive'
    }
  },
  {
    id: 'female_wages',
    label: '16a. Average daily wage earned by females (INR)',
    section: 'Activities, Earning & Wages',
    type: 'number',
    placeholder: 'Wages in Rs/day',
    validationRules: {
      min: 0,
      errorMsg: 'Wages must be positive'
    }
  },
  {
    id: 'male_wages',
    label: '16b. Average daily wage earned by males (INR)',
    section: 'Activities, Earning & Wages',
    type: 'number',
    placeholder: 'Wages in Rs/day',
    validationRules: {
      min: 0,
      errorMsg: 'Wages must be positive'
    }
  },
  {
    id: 'differential_wages_reason',
    label: '16c. Reason for differential wages',
    section: 'Activities, Earning & Wages',
    type: 'text',
    placeholder: 'Reason for wage disparity, if any'
  },
  {
    id: 'main_expenditure_source',
    label: '16d. Main expenditure accrued through earnings',
    section: 'Activities, Earning & Wages',
    type: 'select',
    options: ['Education of children', 'household expenditure', 'clearing off debt', 'medication', 'other']
  },

  // SECTION 4: Time Allocation & Migration
  {
    id: 'days_worked_per_month',
    label: '17. How many days per month do you work in the fields?',
    section: 'Time Allocation & Migration',
    type: 'number',
    placeholder: 'Days worked per month',
    validationRules: {
      min: 0,
      max: 31,
      errorMsg: 'Days must be between 0 and 31'
    }
  },
  {
    id: 'daily_hours_farm',
    label: '17a. Daily hours in farm/productive work',
    section: 'Time Allocation & Migration',
    type: 'number',
    placeholder: 'Hours per day',
    validationRules: {
      min: 0,
      max: 24,
      errorMsg: 'Hours must be between 0 and 24'
    }
  },
  {
    id: 'daily_hours_chores',
    label: '17b. Daily hours in household chores (cooking, cleaning, fetching water)',
    section: 'Time Allocation & Migration',
    type: 'number',
    placeholder: 'Hours per day',
    validationRules: {
      min: 0,
      max: 24,
      errorMsg: 'Hours must be between 0 and 24'
    }
  },
  {
    id: 'daily_hours_care',
    label: '17c. Daily hours in child/elderly care',
    section: 'Time Allocation & Migration',
    type: 'number',
    placeholder: 'Hours per day',
    validationRules: {
      min: 0,
      max: 24,
      errorMsg: 'Hours must be between 0 and 24'
    }
  },
  {
    id: 'daily_hours_rest',
    label: '17d. Daily hours in rest and personal care',
    section: 'Time Allocation & Migration',
    type: 'number',
    placeholder: 'Hours per day',
    validationRules: {
      min: 0,
      max: 24,
      errorMsg: 'Hours must be between 0 and 24'
    }
  },
  {
    id: 'domestic_shares_who',
    label: '17e. Who else in the household shares domestic responsibilities?',
    section: 'Time Allocation & Migration',
    type: 'select',
    options: ['No one', 'daughter', 'mother in law', 'husband', 'other']
  },
  {
    id: 'other_income_source',
    label: '18. Any other source of income to the family?',
    section: 'Time Allocation & Migration',
    type: 'boolean'
  },
  {
    id: 'adult_male_migrated',
    label: '19. Has any adult male of your household migrated outside for work?',
    section: 'Time Allocation & Migration',
    type: 'boolean'
  },
  {
    id: 'migrated_relation',
    label: '20a. If yes, relation to you?',
    section: 'Time Allocation & Migration',
    type: 'select',
    options: ['husband', 'son', 'brother', 'other', 'none']
  },
  {
    id: 'migrated_destination',
    label: '20b. Where did the person migrate?',
    section: 'Time Allocation & Migration',
    type: 'select',
    options: ['Same state', 'other state', 'abroad', 'none']
  },

  // SECTION 5: Loans, Bank Accounts & Credit
  {
    id: 'family_loan_exists',
    label: '21. Does your family have any loan and what was the source of it?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'loan_source',
    label: '21b. Source of loan (if any)',
    section: 'Loans, Bank Accounts & Credit',
    type: 'text',
    placeholder: 'e.g., Local moneylender, NABARD/Cooperative Bank, SHG, relatives'
  },
  {
    id: 'has_bank_account',
    label: '22. Do you have a bank account?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'access_to_credit',
    label: '23. Do you have access to credit?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'access_kisan_credit_card',
    label: '23a. Access to Kisan credit card?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'part_of_shg',
    label: '23b. Part of Self-Help Group (SHG)?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'part_of_fpo',
    label: '23c. Member of Farmer Producer Organisation (FPO)?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'aware_gov_schemes',
    label: '24. Are you aware of the schemes of the government?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },
  {
    id: 'scheme_info_source',
    label: '24b. Source of such scheme information',
    section: 'Loans, Bank Accounts & Credit',
    type: 'text',
    placeholder: 'e.g., Panchayat, Radio, SHG, neighbors, mobile'
  },
  {
    id: 'availed_subsidy_benefit',
    label: '25. Have you availed any government subsidy/scheme benefit in your name?',
    section: 'Loans, Bank Accounts & Credit',
    type: 'boolean'
  },

  // SECTION 6: Decisions, Challenges & Empowerment
  {
    id: 'participates_planning_committee',
    label: '26. Do you participate in the village or block level agricultural planning committee?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'boolean'
  },
  {
    id: 'formal_agri_training',
    label: '27. Have you received any formal agricultural training?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'boolean'
  },
  {
    id: 'increased_role_decision_making',
    label: '28a. Is your increased role in farming also leading to an increase in your decision making power in the family?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'boolean'
  },
  {
    id: 'farming_meaning',
    label: '28b. Is farming a sign of opportunity or compulsion due to distress?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'select',
    options: ['genuine opportunity', 'just compulsion due to distress', 'both', 'not sure']
  },
  {
    id: 'aware_market_prices',
    label: '29a. Do you have any information about agricultural prices prevailing in the markets?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'boolean'
  },
  {
    id: 'mandi_selling_responsible',
    label: '29b. Who is responsible for selling the produce in mandis?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'select',
    options: ['Male member of the family', 'middlemen', 'FPO acquiring', 'self', 'other']
  },
  {
    id: 'single_biggest_challenge',
    label: '30. What according to you is the single biggest challenge faced as women in farming?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'text',
    placeholder: 'e.g., Lack of land ownership, physical labor, no credit access, low wages'
  },
  {
    id: 'empowerment_measure_needed',
    label: '30b. What would be an empowerment measure or support needed urgently to improve your conditions?',
    section: 'Decisions, Challenges & Empowerment',
    type: 'text',
    placeholder: 'e.g., direct subsidies, training workshops, borewell facilities'
  },
  {
    id: 'credit_urgency_focus',
    label: '30c. Urgent support area in terms of access',
    section: 'Decisions, Challenges & Empowerment',
    type: 'multiselect',
    options: ['Irrigation', 'Training', 'Mechanisation of agriculture', 'Others']
  }
];
