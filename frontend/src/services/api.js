import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export const login = (email, password) => api.post('/auth/login', { email, password });

// ---- Crisis Incidents ----
export const getCrisisIncidents = () => api.get('/crisis-incidents');
export const getCrisisIncident = (id) => api.get(`/crisis-incidents/${id}`);
export const createCrisisIncident = (data) => api.post('/crisis-incidents', data);
export const updateCrisisIncident = (id, data) => api.put(`/crisis-incidents/${id}`, data);
export const deleteCrisisIncident = (id) => api.delete(`/crisis-incidents/${id}`);

// ---- Media Monitoring ----
export const getMediaMonitoring = () => api.get('/media-monitoring');
export const getMediaMonitoringItem = (id) => api.get(`/media-monitoring/${id}`);
export const createMediaMonitoring = (data) => api.post('/media-monitoring', data);
export const updateMediaMonitoring = (id, data) => api.put(`/media-monitoring/${id}`, data);
export const deleteMediaMonitoring = (id) => api.delete(`/media-monitoring/${id}`);

// ---- Stakeholders ----
export const getStakeholders = () => api.get('/stakeholders');
export const getStakeholder = (id) => api.get(`/stakeholders/${id}`);
export const createStakeholder = (data) => api.post('/stakeholders', data);
export const updateStakeholder = (id, data) => api.put(`/stakeholders/${id}`, data);
export const deleteStakeholder = (id) => api.delete(`/stakeholders/${id}`);

// ---- Response Templates ----
export const getResponseTemplates = () => api.get('/response-templates');
export const getResponseTemplate = (id) => api.get(`/response-templates/${id}`);
export const createResponseTemplate = (data) => api.post('/response-templates', data);
export const updateResponseTemplate = (id, data) => api.put(`/response-templates/${id}`, data);
export const deleteResponseTemplate = (id) => api.delete(`/response-templates/${id}`);

// ---- Press Releases ----
export const getPressReleases = () => api.get('/press-releases');
export const getPressRelease = (id) => api.get(`/press-releases/${id}`);
export const createPressRelease = (data) => api.post('/press-releases', data);
export const updatePressRelease = (id, data) => api.put(`/press-releases/${id}`, data);
export const deletePressRelease = (id) => api.delete(`/press-releases/${id}`);
export const generatePressRelease = (data) => api.post('/press-releases/generate', data);

// ---- Social Media ----
export const getSocialMedia = () => api.get('/social-media');
export const getSocialMediaItem = (id) => api.get(`/social-media/${id}`);
export const createSocialMedia = (data) => api.post('/social-media', data);
export const updateSocialMedia = (id, data) => api.put(`/social-media/${id}`, data);
export const deleteSocialMedia = (id) => api.delete(`/social-media/${id}`);
export const generateSocialMedia = (data) => api.post('/social-media/generate', data);

// ---- Sentiment Analysis ----
export const getSentimentAnalyses = () => api.get('/sentiment-analysis');
export const getSentimentAnalysis = (id) => api.get(`/sentiment-analysis/${id}`);
export const createSentimentAnalysis = (data) => api.post('/sentiment-analysis', data);
export const updateSentimentAnalysis = (id, data) => api.put(`/sentiment-analysis/${id}`, data);
export const deleteSentimentAnalysis = (id) => api.delete(`/sentiment-analysis/${id}`);
export const analyzeSentiment = (data) => api.post('/sentiment-analysis/analyze', data);

// ---- Crisis Simulations ----
export const getCrisisSimulations = () => api.get('/crisis-simulations');
export const getCrisisSimulation = (id) => api.get(`/crisis-simulations/${id}`);
export const createCrisisSimulation = (data) => api.post('/crisis-simulations', data);
export const updateCrisisSimulation = (id, data) => api.put(`/crisis-simulations/${id}`, data);
export const deleteCrisisSimulation = (id) => api.delete(`/crisis-simulations/${id}`);

// ---- Communication Logs ----
export const getCommunicationLogs = () => api.get('/communication-logs');
export const getCommunicationLog = (id) => api.get(`/communication-logs/${id}`);
export const createCommunicationLog = (data) => api.post('/communication-logs', data);
export const updateCommunicationLog = (id, data) => api.put(`/communication-logs/${id}`, data);
export const deleteCommunicationLog = (id) => api.delete(`/communication-logs/${id}`);

// ---- Team Members ----
export const getTeamMembers = () => api.get('/team-members');
export const getTeamMember = (id) => api.get(`/team-members/${id}`);
export const createTeamMember = (data) => api.post('/team-members', data);
export const updateTeamMember = (id, data) => api.put(`/team-members/${id}`, data);
export const deleteTeamMember = (id) => api.delete(`/team-members/${id}`);

// ---- Incident Timelines ----
export const getIncidentTimelines = () => api.get('/incident-timelines');
export const getIncidentTimeline = (id) => api.get(`/incident-timelines/${id}`);
export const createIncidentTimeline = (data) => api.post('/incident-timelines', data);
export const updateIncidentTimeline = (id, data) => api.put(`/incident-timelines/${id}`, data);
export const deleteIncidentTimeline = (id) => api.delete(`/incident-timelines/${id}`);

// ---- Risk Assessments ----
export const getRiskAssessments = () => api.get('/risk-assessments');
export const getRiskAssessment = (id) => api.get(`/risk-assessments/${id}`);
export const createRiskAssessment = (data) => api.post('/risk-assessments', data);
export const updateRiskAssessment = (id, data) => api.put(`/risk-assessments/${id}`, data);
export const deleteRiskAssessment = (id) => api.delete(`/risk-assessments/${id}`);
export const generateRiskAssessment = (data) => api.post('/risk-assessments/generate', data);

// ---- Talking Points ----
export const getTalkingPoints = () => api.get('/talking-points');
export const getTalkingPoint = (id) => api.get(`/talking-points/${id}`);
export const createTalkingPoint = (data) => api.post('/talking-points', data);
export const updateTalkingPoint = (id, data) => api.put(`/talking-points/${id}`, data);
export const deleteTalkingPoint = (id) => api.delete(`/talking-points/${id}`);
export const generateTalkingPoints = (data) => api.post('/talking-points/generate', data);

// ---- Post-Crisis Analysis ----
export const getPostCrisisAnalyses = () => api.get('/post-crisis-analysis');
export const getPostCrisisAnalysis = (id) => api.get(`/post-crisis-analysis/${id}`);
export const createPostCrisisAnalysis = (data) => api.post('/post-crisis-analysis', data);
export const updatePostCrisisAnalysis = (id, data) => api.put(`/post-crisis-analysis/${id}`, data);
export const deletePostCrisisAnalysis = (id) => api.delete(`/post-crisis-analysis/${id}`);
export const generatePostCrisisAnalysis = (data) => api.post('/post-crisis-analysis/generate', data);

export default api;
