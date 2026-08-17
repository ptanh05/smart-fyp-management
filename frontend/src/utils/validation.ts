/**
 * Validation utility functions for form inputs.
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates email format.
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates that a string is not empty after trimming.
 */
export const isNotEmpty = (value: string | undefined | null): boolean => {
  return value !== null && value !== undefined && value.trim().length > 0;
};

/**
 * Validates that a number is within a range.
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Validates that a date is not in the past.
 */
export const isNotPastDate = (dateString: string): boolean => {
  if (!dateString) return true; // Empty is handled by required check
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
};

/**
 * Validates that a date is in the future.
 */
export const isFutureDate = (dateString: string): boolean => {
  if (!dateString) return true;
  const date = new Date(dateString);
  const today = new Date();
  return date > today;
};

/**
 * Validates minimum string length.
 */
export const hasMinLength = (value: string, minLength: number): boolean => {
  return value.trim().length >= minLength;
};

/**
 * Validates maximum string length.
 */
export const hasMaxLength = (value: string, maxLength: number): boolean => {
  return value.length <= maxLength;
};

/**
 * Validates external evaluation form data.
 */
export const validateEvaluationForm = (data: {
  project_completion: number;
  code_quality: number;
  functionality: number;
  understanding_of_technology: number;
  problem_solving: number;
  innovation: number;
  presentation_clarity: number;
  communication: number;
  time_management: number;
  documentation_completeness: number;
  documentation_quality: number;
  qa_response: number;
}): ValidationResult => {
  const errors: Record<string, string> = {};
  
  const ratingFields = [
    { field: 'project_completion', label: 'Project Completion' },
    { field: 'code_quality', label: 'Code Quality' },
    { field: 'functionality', label: 'Functionality' },
    { field: 'understanding_of_technology', label: 'Understanding of Technology' },
    { field: 'problem_solving', label: 'Problem Solving' },
    { field: 'innovation', label: 'Innovation' },
    { field: 'presentation_clarity', label: 'Presentation Clarity' },
    { field: 'communication', label: 'Communication' },
    { field: 'time_management', label: 'Time Management' },
    { field: 'documentation_completeness', label: 'Documentation Completeness' },
    { field: 'documentation_quality', label: 'Documentation Quality' },
    { field: 'qa_response', label: 'Q&A Response' },
  ];

  // Check that at least some ratings have been provided
  const allZero = ratingFields.every(
    ({ field }) => (data as Record<string, number>)[field] === 0
  );
  
  if (allZero) {
    errors.general = 'Please provide ratings for at least some criteria before submitting.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Validates external group creation form.
 */
export const validateExternalGroupForm = (data: {
  name: string;
  external_examiner?: number | null;
  semester: string;
  max_groups: number;
  evaluation_date?: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (!isNotEmpty(data.name)) {
    errors.name = 'Group name is required';
  } else if (!hasMinLength(data.name, 3)) {
    errors.name = 'Group name must be at least 3 characters';
  } else if (!hasMaxLength(data.name, 100)) {
    errors.name = 'Group name must be less than 100 characters';
  }

  if (!data.external_examiner) {
    errors.external_examiner = 'Please select an external examiner';
  }

  if (!isInRange(data.max_groups, 1, 50)) {
    errors.max_groups = 'Max groups must be between 1 and 50';
  }

  if (data.evaluation_date && !isNotPastDate(data.evaluation_date)) {
    errors.evaluation_date = 'Evaluation date cannot be in the past';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Sanitizes a string by removing potentially dangerous characters.
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim();
};

/**
 * Formats validation errors for display.
 */
export const formatErrors = (errors: Record<string, string>): string => {
  return Object.values(errors).join('\n');
};
