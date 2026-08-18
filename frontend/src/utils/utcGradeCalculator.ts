/**
 * UTC Grade Calculator & Conversion Utility
 * Converts 10-point scale grades to UTC 4.0 scale GPA, Letter Grades, and computes weighted totals.
 */

export interface UTCGradeResult {
  score10: number;
  gpa4: number;
  letterGrade: string;
  classification: string;
  isPass: boolean;
  color: string;
}

/**
 * Calculate UTC Letter Grade, 4.0 GPA, and Classification from a 10-point score
 */
export function convertScoreToUTCGrade(score10: number): UTCGradeResult {
  const score = Math.max(0, Math.min(10, Math.round(score10 * 10) / 10));

  if (score >= 8.5) {
    return {
      score10: score,
      gpa4: 4.0,
      letterGrade: 'A',
      classification: 'Xuất Sắc / Giỏi',
      isPass: true,
      color: '#16a34a', // green
    };
  } else if (score >= 7.8) {
    return {
      score10: score,
      gpa4: 3.5,
      letterGrade: 'B+',
      classification: 'Khá Giỏi',
      isPass: true,
      color: '#2563eb', // blue
    };
  } else if (score >= 7.0) {
    return {
      score10: score,
      gpa4: 3.0,
      letterGrade: 'B',
      classification: 'Khá',
      isPass: true,
      color: '#0284c7', // light blue
    };
  } else if (score >= 6.3) {
    return {
      score10: score,
      gpa4: 2.5,
      letterGrade: 'C+',
      classification: 'Trung Bình Khá',
      isPass: true,
      color: '#d97706', // amber
    };
  } else if (score >= 5.5) {
    return {
      score10: score,
      gpa4: 2.0,
      letterGrade: 'C',
      classification: 'Trung Bình',
      isPass: true,
      color: '#ca8a04', // yellow-amber
    };
  } else if (score >= 4.8) {
    return {
      score10: score,
      gpa4: 1.5,
      letterGrade: 'D+',
      classification: 'Trung Bình Yếu',
      isPass: true,
      color: '#ea580c', // orange
    };
  } else if (score >= 4.0) {
    return {
      score10: score,
      gpa4: 1.0,
      letterGrade: 'D',
      classification: 'Yếu',
      isPass: true,
      color: '#d97706', // warning amber
    };
  } else {
    return {
      score10: score,
      gpa4: 0.0,
      letterGrade: 'F',
      classification: 'Kém (Không Đạt)',
      isPass: false,
      color: '#dc2626', // red
    };
  }
}

/**
 * Calculate Weighted Final Score according to UTC Standard:
 * - Supervisor Score (GVHD): 40%
 * - Reviewer / External Examiner Score (Phản Biện): 20%
 * - Committee Panel Score (Hội Đồng): 40%
 */
export function calculateUTCWeightedScore(
  supervisorScore: number,
  reviewerScore: number,
  committeeScore: number
): UTCGradeResult {
  const weightedTotal =
    supervisorScore * 0.4 + reviewerScore * 0.2 + committeeScore * 0.4;
  return convertScoreToUTCGrade(weightedTotal);
}
