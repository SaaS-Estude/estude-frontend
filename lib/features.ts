// Enable a module after its Go API and UI pass the migration acceptance gate.
// These flags describe rollout status; authorization is always checked by the server.
export const FEATURES = {
  aiQuestions: true, // G10
  classAnalysis: true, // G10
  examAnalysis: true, // G11
  studyCoach: true, // G10
  learningSupport: true, // G11
};
