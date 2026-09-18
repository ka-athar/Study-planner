/**
 * Google Classroom API Integration Service
 * Complies with Google Workspace REST standards using bearer tokens from googleAuthService.
 */

import { getOrRequestWorkspaceToken, getCachedWorkspaceToken } from './googleAuthService';
import { Subject, Chapter, Topic, StudyPlan, StudyPlanTopic, TestResult, StorageVault } from '../types';
import type { IndexedTopic } from './topicLinker';

export const getOrRequestClassroomToken = getOrRequestWorkspaceToken;
export const getCachedClassroomToken = getCachedWorkspaceToken;

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  alternateLink?: string;
  courseState?: string;
}

export type GoogleClassroomCourse = ClassroomCourse;

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  materials?: Array<{
    driveFile?: {
      driveFile: {
        id: string;
        title: string;
        alternateLink: string;
      };
    };
    link?: {
      url: string;
      title?: string;
    };
    youtubeVideo?: {
      id: string;
      title: string;
      alternateLink: string;
    };
  }>;
  state?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  dueDate?: {
    year: number;
    month: number;
    day: number;
  };
  dueTime?: {
    hours?: number;
    minutes?: number;
  };
  maxPoints?: number;
  workType?: string;
  topicId?: string;
}

export interface ClassroomCourseMaterial {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  materials?: Array<{
    driveFile?: {
      driveFile: {
        id: string;
        title: string;
        alternateLink: string;
      };
    };
    link?: {
      url: string;
      title?: string;
    };
  }>;
  alternateLink?: string;
  topicId?: string;
}

export interface ClassroomAnnouncement {
  id: string;
  courseId: string;
  text: string;
  alternateLink?: string;
  creationTime?: string;
}

export interface ClassroomTopic {
  id: string;
  courseId: string;
  name: string;
}

/**
 * Lists all active Google Classroom courses for the signed-in student/user.
 */
export async function listClassroomCourses(tokenOverride?: string): Promise<ClassroomCourse[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=30', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`Classroom courses fetch returned status ${response.status}`, err);
      return [];
    }

    const data = await response.json();
    return data.courses || [];
  } catch (error) {
    console.warn('Network error fetching Classroom courses:', error);
    return [];
  }
}

/**
 * Lists all coursework (assignments, homework, projects) for a specific course.
 */
export async function listCourseWork(courseId: string, tokenOverride?: string): Promise<ClassroomCourseWork[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?courseWorkStates=PUBLISHED&pageSize=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.courseWork || [];
  } catch {
    return [];
  }
}

/**
 * Lists coursework materials (reading materials, slides, lecture notes).
 */
export async function listCourseMaterials(courseId: string, tokenOverride?: string): Promise<ClassroomCourseMaterial[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWorkMaterials?courseWorkMaterialStates=PUBLISHED&pageSize=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.courseWorkMaterial || [];
  } catch {
    return [];
  }
}

/**
 * Lists announcements and updates posted in the Classroom stream.
 */
export async function listCourseAnnouncements(courseId: string, tokenOverride?: string): Promise<ClassroomAnnouncement[]> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return [];
  }

  try {
    const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/announcements?announcementStates=PUBLISHED&pageSize=20`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.announcements || [];
  } catch {
    return [];
  }
}

/**
 * Converts a Google Classroom course, its topics, and assignments into a StudyOS Subject hierarchy
 * and scheduled StudyPlan tasks.
 */
export function convertClassroomToStudyOS(
  course: ClassroomCourse,
  courseWorks: ClassroomCourseWork[],
  materials: ClassroomCourseMaterial[] = []
): {
  subject: Subject;
  tasks: StudyPlanTopic[];
} {
  const subjectId = `subject-classroom-${course.id}`;
  const colorOptions = ['#4F46E5', '#2563EB', '#0D9488', '#059669', '#D97706', '#DC2626', '#7C3AED'];
  const assignedColor = colorOptions[Math.abs(course.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % colorOptions.length];

  // Group coursework & materials into chapters
  const assignmentsChapterId = `chap-cw-${course.id}`;
  const materialsChapterId = `chap-mat-${course.id}`;

  const assignmentTopics: Topic[] = courseWorks.map((cw) => {
    let dueString = '';
    if (cw.dueDate) {
      const month = String(cw.dueDate.month).padStart(2, '0');
      const day = String(cw.dueDate.day).padStart(2, '0');
      dueString = `${cw.dueDate.year}-${month}-${day}`;
    }

    return {
      id: `top-cw-${cw.id}`,
      name: cw.title,
      status: 'Not Started',
      estimatedMinutes: 90,
      weakNotes: dueString ? `Due: ${dueString}` : undefined,
      subtopics: [
        {
          id: `sub-${cw.id}-1`,
          name: cw.description ? cw.description.slice(0, 80) + '...' : 'Assignment overview & requirements',
          completed: false
        },
        {
          id: `sub-${cw.id}-2`,
          name: 'Core problem solving & drafting',
          completed: false
        },
        {
          id: `sub-${cw.id}-3`,
          name: 'Final review & submission check',
          completed: false
        }
      ]
    };
  });

  const materialTopics: Topic[] = materials.map((mat) => ({
    id: `top-mat-${mat.id}`,
    name: mat.title,
    status: 'Not Started',
    estimatedMinutes: 60,
    subtopics: [
      {
        id: `sub-mat-${mat.id}-1`,
        name: 'Initial reading & slide comprehension',
        completed: false
      },
      {
        id: `sub-mat-${mat.id}-2`,
        name: 'Concept notes and summary extraction',
        completed: false
      }
    ]
  }));

  const chapters: Chapter[] = [];

  if (assignmentTopics.length > 0) {
    chapters.push({
      id: assignmentsChapterId,
      name: 'Classroom Coursework & Assignments',
      topics: assignmentTopics
    });
  }

  if (materialTopics.length > 0) {
    chapters.push({
      id: materialsChapterId,
      name: 'Course Resources & Lecture Notes',
      topics: materialTopics
    });
  }

  if (chapters.length === 0) {
    chapters.push({
      id: `chap-main-${course.id}`,
      name: 'General Syllabus & Modules',
      topics: [
        {
          id: `top-gen-${course.id}`,
          name: course.descriptionHeading || 'Introduction & Course Foundations',
          status: 'Not Started',
          estimatedMinutes: 120,
          subtopics: [
            { id: `sub-gen-1`, name: 'Course orientation & objectives', completed: false },
            { id: `sub-gen-2`, name: 'Module 1 core concepts', completed: false }
          ]
        }
      ]
    });
  }

  const subject: Subject = {
    id: subjectId,
    name: course.name,
    icon: '🏫',
    color: assignedColor,
    description: course.descriptionHeading || course.section || 'Google Classroom Course',
    chapters
  };

  // Create StudyPlan tasks from coursework items with due dates
  const tasks: StudyPlanTopic[] = courseWorks.map((cw, idx) => {
    let dueInfo = 'Classroom coursework';
    if (cw.dueDate) {
      const month = String(cw.dueDate.month).padStart(2, '0');
      const day = String(cw.dueDate.day).padStart(2, '0');
      dueInfo = `Due ${cw.dueDate.year}-${month}-${day}`;
    }

    return {
      id: `top-cw-${cw.id || idx}`,
      subjectName: course.name,
      chapterName: 'Classroom Coursework & Assignments',
      topicName: cw.title,
      estimatedMinutes: 90,
      priority: 'High',
      reason: dueInfo,
      completed: false
    };
  });

  return { subject, tasks };
}

/**
 * Creates a new Course in Google Classroom.
 */
export async function createClassroomCourse(
  accessToken: string,
  course: { name: string; section?: string; descriptionHeading?: string; description?: string; room?: string }
): Promise<GoogleClassroomCourse> {
  const payload: any = {
    name: course.name,
    section: course.section || 'Academic Syllabus & StudyOS Vault',
    descriptionHeading: course.descriptionHeading || 'StudyOS Integrated Subject Hub',
    description: course.description || 'Comprehensive subject coursework, revision plans, test vault benchmarks, and lecture notes synced from StudyOS.',
    room: course.room || 'Room 101',
    ownerId: 'me',
    courseState: 'ACTIVE'
  };

  let response = await fetch('https://classroom.googleapis.com/v1/courses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    // If ACTIVE state failed due to student permissions, retry with PROVISIONED
    const err = await response.json().catch(() => ({}));
    if (response.status === 400 || response.status === 403) {
      const retryPayload = { ...payload, courseState: 'PROVISIONED' };
      const retryResponse = await fetch('https://classroom.googleapis.com/v1/courses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(retryPayload)
      });
      if (retryResponse.ok) {
        return await retryResponse.json();
      }
    }
    const msg = err.error?.message || `Failed to create Classroom Course (${response.status})`;
    throw new Error(msg);
  }

  return await response.json();
}

/**
 * Creates a Coursework / Assignment item in a Google Classroom Course.
 */
export async function createClassroomCourseWork(
  accessToken: string,
  courseId: string,
  work: { title: string; description?: string; maxPoints?: number; topicId?: string; workType?: string }
): Promise<any> {
  const payload: any = {
    title: work.title,
    description: work.description || 'Study topic & active recall milestone.',
    workType: work.workType || 'ASSIGNMENT',
    state: 'PUBLISHED',
    maxPoints: work.maxPoints ?? 100
  };

  if (work.topicId) {
    payload.topicId = work.topicId;
  }

  const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.warn(`Could not create coursework in classroom:`, err);
    return null;
  }

  return await response.json();
}

/**
 * Posts an announcement or study summary to a Google Classroom Course stream.
 */
export async function createClassroomAnnouncement(
  accessToken: string,
  courseId: string,
  text: string
): Promise<any> {
  const response = await fetch(`https://classroom.googleapis.com/v1/courses/${courseId}/announcements`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      state: 'PUBLISHED'
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.warn(`Could not create announcement:`, err);
    return null;
  }

  return await response.json();
}

/**
 * Dumps an entire Subject structure (chapters, topics, test vault records, correction prompts) into Google Classroom.
 */
export async function dumpSubjectToGoogleClassroom(
  accessToken: string,
  subject: Subject,
  testResults: any[] = [],
  notes: any[] = []
): Promise<{ success: boolean; course: GoogleClassroomCourse; courseworkCount: number; courseUrl?: string }> {
  // 1. Create or Find Course
  const course = await createClassroomCourse(accessToken, {
    name: `${subject.name} - StudyOS Syllabus & Vault`,
    section: `${subject.chapters?.length || 0} Chapters | Complete Academic Track`,
    descriptionHeading: `Mastery Hub for ${subject.name}`,
    description: `Complete syllabus tracking, test scores, error correction prompts, and lecture summaries for ${subject.name}.`
  });

  let courseworkCount = 0;

  // 2. Add Coursework for each chapter
  if (subject.chapters && subject.chapters.length > 0) {
    for (const ch of subject.chapters) {
      const topicTitles = ch.topics?.map(t => `• ${t.name} (${t.status || 'Not Started'})`).join('\n') || 'Chapter Overview';
      const desc = `Chapter Outline & Topics:\n${topicTitles}\n\nEstimated Study Duration: ${ch.topics?.reduce((acc, t) => acc + (t.estimatedMinutes || 60), 0) || 120} minutes.`;
      
      const res = await createClassroomCourseWork(accessToken, course.id, {
        title: `📖 ${ch.name}`,
        description: desc,
        maxPoints: 100
      });
      if (res) courseworkCount++;
    }
  }

  // 3. Post Announcement for Test Vault & Correction Prompts
  const subjectTests = testResults.filter(t => t.subjectName?.toLowerCase() === subject.name.toLowerCase());
  if (subjectTests.length > 0) {
    const testListStr = subjectTests.map((t, idx) => {
      const num = t.testNumber || `#${idx + 1}`;
      const prompts = t.correctionPrompts?.length ? `\n   🎯 Correction Prompts: ${t.correctionPrompts.slice(0, 2).join(' | ')}` : '';
      return `• [${num}] ${t.testName} - Score: ${t.score} (Mistakes: ${t.mistakes || 'None logged'})${prompts}`;
    }).join('\n\n');

    await createClassroomAnnouncement(
      accessToken,
      course.id,
      `🏆 Subject Test Vault & Remediation Tracker for ${subject.name}:\n\n${testListStr}`
    );
  }

  return {
    success: true,
    course,
    courseworkCount,
    courseUrl: course.alternateLink
  };
}

/**
 * Automatically syncs and posts a recorded test result to the respective Google Classroom course.
 * Incorporates multiple topics (e.g. 3.1, 3.2, 3.3), test score, student difficulties,
 * and AI remediation prompts into both Coursework and Stream Announcement.
 */
export async function postTestToGoogleClassroom(
  accessToken: string,
  params: {
    test: Omit<TestResult, 'id'> | TestResult;
    subject: Subject;
    matchedTopics?: IndexedTopic[];
    includePrompts?: boolean;
  }
): Promise<{
  success: boolean;
  course: GoogleClassroomCourse;
  courseworkId?: string;
  announcementId?: string;
  courseUrl?: string;
  message: string;
}> {
  const { test, subject, matchedTopics = [], includePrompts = true } = params;

  // 1. Find or create matching course for subject
  let courses: GoogleClassroomCourse[] = [];
  try {
    courses = await listClassroomCourses(accessToken);
  } catch (e) {
    console.warn("Could not list classroom courses:", e);
  }

  let course = courses.find(c => 
    c.name.toLowerCase() === subject.name.toLowerCase() ||
    c.name.toLowerCase().includes(subject.name.toLowerCase()) ||
    subject.name.toLowerCase().includes(c.name.toLowerCase())
  );

  if (!course) {
    course = await createClassroomCourse(accessToken, {
      name: `${subject.name} - Academic Syllabus & Vault`,
      section: `${subject.chapters?.length || 0} Chapters | StudyOS Classroom`,
      descriptionHeading: `StudyOS Classroom for ${subject.name}`,
      description: `Official StudyOS Academic Hub for ${subject.name}. Includes tests, syllabus topic evaluations, mistake correction prompts, and mastery milestones.`
    });
  }

  // 2. Format multi-topic breakdown
  let topicsFormatted = '';
  if (matchedTopics.length > 0) {
    topicsFormatted = matchedTopics.map(t => `• Topic ${t.topicNumber}: ${t.topicName} (${t.chapterName})`).join('\n');
  } else if (test.topicNumber || test.topicName) {
    topicsFormatted = `• ${test.topicNumber ? `Topic ${test.topicNumber}` : ''} ${test.topicName || ''}`.trim();
  } else if (test.struggledTopics && test.struggledTopics.length > 0) {
    topicsFormatted = test.struggledTopics.map(st => `• ${st}`).join('\n');
  } else {
    topicsFormatted = `• General ${subject.name} Curriculum`;
  }

  // 3. Format description with difficulties and prompts
  const testTitle = test.testName || `Test on ${subject.name}`;
  const scoreSummary = `${test.score || (test.percentage ? test.percentage + '%' : 'Graded')}`;
  const mistakesSummary = test.mistakes ? test.mistakes : 'No specific errors recorded.';

  let promptLines = '';
  if (includePrompts && test.correctionPrompts && test.correctionPrompts.length > 0) {
    promptLines = `\n\n🎯 AI Remediation & Practice Prompts:\n` +
      test.correctionPrompts.map((p, i) => `${i + 1}. "${p}"`).join('\n');
  }

  const detailedDescription = `
📝 TEST DETAILS & ASSESSMENT
• Subject: ${subject.name}
• Test Number: ${test.testNumber || 'Unit Assessment'}
• Marks / Score: ${scoreSummary}
• Date: ${test.date || new Date().toISOString().split('T')[0]}

📚 INCORPORATED SYLLABUS TOPICS:
${topicsFormatted}

⚠️ RECORDED DIFFICULTIES & WHAT WENT WRONG:
${mistakesSummary}
${test.analysis?.weakConcept ? `\n🔍 Diagnostic Concept Gap: ${test.analysis.weakConcept}` : ''}
${test.analysis?.whatToRevise ? `\n📖 Recommended Revision: ${test.analysis.whatToRevise}` : ''}
${promptLines}
`.trim();

  // 4. Create Coursework item
  let courseworkRes = null;
  try {
    courseworkRes = await createClassroomCourseWork(accessToken, course.id, {
      title: `📝 ${testTitle} [Score: ${scoreSummary}]`,
      description: detailedDescription,
      maxPoints: test.totalMarks || 100
    });
  } catch (e) {
    console.warn("Failed to create coursework item:", e);
  }

  // 5. Post Announcement on Class Stream
  let announcementRes = null;
  const announcementText = `📢 TEST RECORDED: ${testTitle} (${subject.name})\n\n📊 Score: ${scoreSummary}\n📅 Date: ${test.date || new Date().toISOString().split('T')[0]}\n\nIncorporated Topics:\n${topicsFormatted}\n\nDifficulties/Mistakes:\n${mistakesSummary}${promptLines}`;
  try {
    announcementRes = await createClassroomAnnouncement(accessToken, course.id, announcementText);
  } catch (e) {
    console.warn("Failed to post announcement:", e);
  }

  return {
    success: true,
    course,
    courseworkId: courseworkRes?.id,
    announcementId: announcementRes?.id,
    courseUrl: course.alternateLink || `https://classroom.google.com/c/${course.id}`,
    message: `Successfully posted test to Google Classroom: "${course.name}"`
  };
}

export interface ClassroomFileAttachment {
  id: string;
  title: string;
  alternateLink: string;
  mimeType?: string;
  fileType: 'driveFile' | 'link' | 'youtube';
}

export interface DetectedClassroomUpload {
  id: string;
  courseId: string;
  courseName: string;
  itemType: 'coursework' | 'material' | 'announcement';
  title: string;
  description?: string;
  updateTime?: string;
  dueDate?: string;
  alternateLink?: string;
  fileAttachments: ClassroomFileAttachment[];
  isNew: boolean;
  matchedSubjectId?: string;
  matchedSubjectName?: string;
}

export interface ClassroomSyncResult {
  allCourses: ClassroomCourse[];
  unlinkedCourses: ClassroomCourse[];
  linkedCourses: Array<{ course: ClassroomCourse; subject: Subject }>;
  detectedUploads: DetectedClassroomUpload[];
  newUploadCount: number;
}

const SEEN_UPLOADS_STORAGE_KEY = 'studyos_classroom_seen_uploads_v1';

export function getSeenClassroomUploadIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_UPLOADS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markClassroomUploadAsSeen(uploadId: string): void {
  try {
    const seen = getSeenClassroomUploadIds();
    if (!seen.includes(uploadId)) {
      seen.push(uploadId);
      localStorage.setItem(SEEN_UPLOADS_STORAGE_KEY, JSON.stringify(seen.slice(-200)));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Fetches all Google Classroom courses and inspects them for coursework, materials,
 * announcements, and newly uploaded files.
 */
export async function fetchClassroomCoursesAndUploads(
  subjects: Subject[],
  tokenOverride?: string
): Promise<ClassroomSyncResult> {
  const token = tokenOverride || getCachedWorkspaceToken();
  if (!token) {
    return {
      allCourses: [],
      unlinkedCourses: [],
      linkedCourses: [],
      detectedUploads: [],
      newUploadCount: 0
    };
  }

  const courses = await listClassroomCourses(token);
  const seenIds = new Set(getSeenClassroomUploadIds());

  const unlinkedCourses: ClassroomCourse[] = [];
  const linkedCourses: Array<{ course: ClassroomCourse; subject: Subject }> = [];

  courses.forEach(course => {
    const matchedSubject = subjects.find(s => 
      s.id === `subject-classroom-${course.id}` ||
      s.name.toLowerCase() === course.name.toLowerCase() ||
      s.name.toLowerCase().includes(course.name.toLowerCase()) ||
      course.name.toLowerCase().includes(s.name.toLowerCase())
    );

    if (matchedSubject) {
      linkedCourses.push({ course, subject: matchedSubject });
    } else {
      unlinkedCourses.push(course);
    }
  });

  const detectedUploads: DetectedClassroomUpload[] = [];

  // Inspect both linked courses and top unlinked courses for coursework and materials
  const coursesToInspect = [...linkedCourses.map(l => ({ ...l.course, matchedSubject: l.subject })), ...unlinkedCourses.slice(0, 5)];

  for (const c of coursesToInspect) {
    try {
      const [cWorks, cMaterials, cAnnouncements] = await Promise.all([
        listCourseWork(c.id, token).catch(() => []),
        listCourseMaterials(c.id, token).catch(() => []),
        listCourseAnnouncements(c.id, token).catch(() => [])
      ]);

      const matchedSubject = 'matchedSubject' in c ? (c as any).matchedSubject as Subject | undefined : undefined;

      // 1. Process Coursework (Assignments & homework)
      cWorks.forEach(cw => {
        const fileAttachments: ClassroomFileAttachment[] = [];
        (cw.materials || []).forEach((m, idx) => {
          if (m.driveFile?.driveFile) {
            fileAttachments.push({
              id: m.driveFile.driveFile.id || `df-${cw.id}-${idx}`,
              title: m.driveFile.driveFile.title || 'Attached Document',
              alternateLink: m.driveFile.driveFile.alternateLink || '',
              fileType: 'driveFile'
            });
          } else if (m.link) {
            fileAttachments.push({
              id: `link-${cw.id}-${idx}`,
              title: m.link.title || m.link.url,
              alternateLink: m.link.url,
              fileType: 'link'
            });
          } else if (m.youtubeVideo) {
            fileAttachments.push({
              id: m.youtubeVideo.id || `yt-${cw.id}-${idx}`,
              title: m.youtubeVideo.title || 'Lecture Video',
              alternateLink: m.youtubeVideo.alternateLink || '',
              fileType: 'youtube'
            });
          }
        });

        // Check if already in the subject's topics
        let alreadyInSubject = false;
        if (matchedSubject) {
          alreadyInSubject = matchedSubject.chapters.some(ch =>
            ch.topics.some(t => t.id === `top-cw-${cw.id}` || t.name.toLowerCase() === cw.title.toLowerCase())
          );
        }

        let dueString = '';
        if (cw.dueDate) {
          const month = String(cw.dueDate.month).padStart(2, '0');
          const day = String(cw.dueDate.day).padStart(2, '0');
          dueString = `${cw.dueDate.year}-${month}-${day}`;
        }

        const isNew = !alreadyInSubject && !seenIds.has(cw.id);

        detectedUploads.push({
          id: cw.id,
          courseId: c.id,
          courseName: c.name,
          itemType: 'coursework',
          title: cw.title,
          description: cw.description,
          updateTime: cw.updateTime || cw.creationTime,
          dueDate: dueString || undefined,
          alternateLink: cw.alternateLink,
          fileAttachments,
          isNew,
          matchedSubjectId: matchedSubject?.id,
          matchedSubjectName: matchedSubject?.name
        });
      });

      // 2. Process Course Materials (Lecture notes, reading materials, PDFs)
      cMaterials.forEach(mat => {
        const fileAttachments: ClassroomFileAttachment[] = [];
        (mat.materials || []).forEach((m, idx) => {
          if (m.driveFile?.driveFile) {
            fileAttachments.push({
              id: m.driveFile.driveFile.id || `df-mat-${mat.id}-${idx}`,
              title: m.driveFile.driveFile.title || 'Attached Reading Material',
              alternateLink: m.driveFile.driveFile.alternateLink || '',
              fileType: 'driveFile'
            });
          } else if (m.link) {
            fileAttachments.push({
              id: `link-mat-${mat.id}-${idx}`,
              title: m.link.title || m.link.url,
              alternateLink: m.link.url,
              fileType: 'link'
            });
          }
        });

        let alreadyInSubject = false;
        if (matchedSubject) {
          alreadyInSubject = matchedSubject.chapters.some(ch =>
            ch.topics.some(t => t.id === `top-mat-${mat.id}` || t.name.toLowerCase() === mat.title.toLowerCase())
          );
        }

        const isNew = !alreadyInSubject && !seenIds.has(mat.id);

        detectedUploads.push({
          id: mat.id,
          courseId: c.id,
          courseName: c.name,
          itemType: 'material',
          title: mat.title,
          description: mat.description,
          alternateLink: mat.alternateLink,
          fileAttachments,
          isNew,
          matchedSubjectId: matchedSubject?.id,
          matchedSubjectName: matchedSubject?.name
        });
      });

      // 3. Process Announcements (only those with attached files or links)
      cAnnouncements.forEach(ann => {
        if (!ann.text) return;
        const isNew = !seenIds.has(ann.id);
        detectedUploads.push({
          id: ann.id,
          courseId: c.id,
          courseName: c.name,
          itemType: 'announcement',
          title: ann.text.slice(0, 75) + (ann.text.length > 75 ? '...' : ''),
          description: ann.text,
          updateTime: ann.creationTime,
          alternateLink: ann.alternateLink,
          fileAttachments: [],
          isNew,
          matchedSubjectId: matchedSubject?.id,
          matchedSubjectName: matchedSubject?.name
        });
      });

    } catch (err) {
      console.warn(`Error inspecting uploads for course ${c.name}:`, err);
    }
  }

  const newUploadCount = detectedUploads.filter(u => u.isNew).length;

  return {
    allCourses: courses,
    unlinkedCourses,
    linkedCourses,
    detectedUploads,
    newUploadCount
  };
}

/**
 * Extracts data from a detected Google Classroom upload (coursework or material)
 * and updates the subject's chapters, topics, and creates storage vault document records.
 */
export function extractAndApplyClassroomUpload(params: {
  upload: DetectedClassroomUpload;
  subject: Subject;
  effectiveUid: string;
}): {
  updatedSubject: Subject;
  newVaults: StorageVault[];
  notification: string;
} {
  const { upload, subject, effectiveUid } = params;
  markClassroomUploadAsSeen(upload.id);

  // 1. Create Topic from coursework or material
  const topicId = upload.itemType === 'coursework' ? `top-cw-${upload.id}` : `top-mat-${upload.id}`;
  const filesListStr = upload.fileAttachments.map(f => `📄 ${f.title}`).join(', ');

  const newTopic: Topic = {
    id: topicId,
    name: upload.title,
    status: 'Not Started',
    estimatedMinutes: upload.itemType === 'coursework' ? 90 : 60,
    weakNotes: upload.dueDate 
      ? `Due: ${upload.dueDate}${filesListStr ? ` • Files: ${filesListStr}` : ''}`
      : (filesListStr ? `Attached: ${filesListStr}` : undefined),
    subtopics: [
      {
        id: `sub-${upload.id}-1`,
        name: upload.description ? upload.description.slice(0, 90) + '...' : 'Review requirements & attached documents',
        completed: false
      },
      {
        id: `sub-${upload.id}-2`,
        name: 'Solve practice problems & write concept notes',
        completed: false
      }
    ]
  };

  // Determine which chapter to attach to
  const chapterName = upload.itemType === 'coursework' 
    ? 'Classroom Coursework & Assignments' 
    : 'Course Resources & Lecture Notes';

  let chapterUpdated = false;
  const updatedChapters = subject.chapters.map(ch => {
    if (ch.name.toLowerCase() === chapterName.toLowerCase()) {
      chapterUpdated = true;
      // Filter out duplicate topic if existing
      const cleanTopics = ch.topics.filter(t => t.id !== topicId && t.name.toLowerCase() !== upload.title.toLowerCase());
      return {
        ...ch,
        topics: [newTopic, ...cleanTopics]
      };
    }
    return ch;
  });

  if (!chapterUpdated) {
    updatedChapters.push({
      id: `chap-${upload.itemType}-${Date.now()}`,
      name: chapterName,
      topics: [newTopic]
    });
  }

  const updatedSubject: Subject = {
    ...subject,
    chapters: updatedChapters
  };

  // 2. Create StorageVault records for any attached files so they show up under Course Materials
  const newVaults: StorageVault[] = [];
  upload.fileAttachments.forEach((f, idx) => {
    newVaults.push({
      id: `vault-cw-${upload.id}-${idx}`,
      userId: effectiveUid,
      name: f.title,
      subjectName: subject.name,
      chapterName,
      category: 'coursework',
      color: '#4D7C5D',
      icon: f.fileType === 'youtube' ? '🎥' : '📄',
      description: f.alternateLink 
        ? `Classroom attachment from "${upload.title}": ${f.alternateLink}`
        : `Uploaded coursework file for ${upload.title}`,
      createdAt: new Date().toISOString(),
      metadata: {
        instructor: 'Google Classroom',
        cohortOrSemester: subject.name,
        courseCode: upload.courseName,
        benchmarkNotes: `Extracted from Google Classroom on ${new Date().toLocaleDateString()}`
      }
    });
  });

  const notification = `Extracted "${upload.title}" into ${subject.name} syllabus (${upload.fileAttachments.length} files attached).`;

  return {
    updatedSubject,
    newVaults,
    notification
  };
}

/**
 * Imports a Google Classroom course that is NOT currently in the syllabus,
 * extracting all its coursework, materials, topics, and attached Drive files.
 */
export async function importUnlinkedClassroomCourse(params: {
  course: ClassroomCourse;
  accessToken: string;
  effectiveUid: string;
}): Promise<{
  newSubject: Subject;
  newVaults: StorageVault[];
  notification: string;
}> {
  const { course, accessToken, effectiveUid } = params;

  const [cWorks, cMaterials] = await Promise.all([
    listCourseWork(course.id, accessToken).catch(() => []),
    listCourseMaterials(course.id, accessToken).catch(() => [])
  ]);

  const { subject } = convertClassroomToStudyOS(course, cWorks, cMaterials);

  // Extract all file attachments from both coursework and materials into StorageVaults
  const newVaults: StorageVault[] = [];

  const allItems = [...cWorks, ...cMaterials];
  allItems.forEach((item, itemIdx) => {
    (item.materials || []).forEach((m, mIdx) => {
      const fileTitle = m.driveFile?.driveFile?.title || m.link?.title || m.youtubeVideo?.title;
      const fileLink = m.driveFile?.driveFile?.alternateLink || m.link?.url || m.youtubeVideo?.alternateLink;
      if (fileTitle) {
        newVaults.push({
          id: `vault-imp-${course.id}-${itemIdx}-${mIdx}`,
          userId: effectiveUid,
          name: fileTitle,
          subjectName: subject.name,
          chapterName: 'Classroom Coursework & Materials',
          category: 'Textbook & Coursework',
          color: subject.color || '#4D7C5D',
          icon: m.youtubeVideo ? '🎥' : '📄',
          description: fileLink || `Attached in ${item.title}`,
          createdAt: new Date().toISOString(),
          metadata: {
            instructor: course.ownerId,
            courseCode: course.name,
            benchmarkNotes: `Extracted from Google Classroom (${course.name})`
          }
        });
      }
    });
  });

  const notification = `Added "${course.name}" from Google Classroom with ${subject.chapters.length} chapters and ${newVaults.length} extracted materials!`;

  return {
    newSubject: subject,
    newVaults,
    notification
  };
}

