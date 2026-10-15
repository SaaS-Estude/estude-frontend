export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXCUSED';

export interface ActivityProgress {
  id: string;
  type: 'RESOURCE' | 'ASSIGNMENT' | 'EXAM';
  title: string;
  required: boolean;
  rule: string;
  status: ProgressStatus;
  completedAt: string | null;
  late?: boolean;
}

export interface LessonProgress {
  id: string;
  title: string;
  required: boolean;
  status: ProgressStatus;
  percent: number;
  completedActivities: number;
  requiredActivities: number;
  requirementRevision: number;
  completedRevision: number | null;
  completedAt: string | null;
  protectedByPriorRevision: boolean;
  activities: ActivityProgress[];
}

export interface TopicProgress {
  id: string;
  name: string;
  status: ProgressStatus;
  percent: number;
  completedLessons: number;
  requiredLessons: number;
  lessons: LessonProgress[];
}

export interface StudentCourseProgress {
  classId: string;
  subjectId: string;
  studentId: string;
  percent: number;
  completedLessons: number;
  requiredLessons: number;
  inProgressLessons: number;
  notStartedLessons: number;
  topics: TopicProgress[];
}

export interface TeacherCourseProgress {
  classId: string;
  subjectId: string;
  students: Array<Omit<StudentCourseProgress, 'classId' | 'subjectId'> & {
    fullName: string;
    accountName: string;
  }>;
}
