export const COURSE_RESOURCE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mp3,.m4a,.wav';

const mimeByExtension: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
};

export function courseResourceContentType(file: File): string {
  const extension = file.name.toLowerCase().split('.').pop() ?? '';
  const expected = mimeByExtension[extension];
  if (!expected) throw new Error('Loại file chưa được hỗ trợ');
  if (file.size < 1 || file.size > 50 * 1024 * 1024) throw new Error('Mỗi file phải từ 1 byte đến 50 MiB');
  // Browsers differ on Office/media MIME. The server verifies the uploaded bytes at finalize.
  if (file.type && file.type !== expected && file.type !== 'application/octet-stream' &&
    file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed')
    throw new Error('MIME của file không khớp đuôi file');
  return expected;
}
