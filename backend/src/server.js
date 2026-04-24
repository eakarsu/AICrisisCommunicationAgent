require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/crisis-incidents', require('./routes/crisisIncidents'));
app.use('/api/media-monitoring', require('./routes/mediaMonitoring'));
app.use('/api/stakeholders', require('./routes/stakeholders'));
app.use('/api/response-templates', require('./routes/responseTemplates'));
app.use('/api/press-releases', require('./routes/pressReleases'));
app.use('/api/social-media', require('./routes/socialMedia'));
app.use('/api/sentiment-analysis', require('./routes/sentimentAnalysis'));
app.use('/api/crisis-simulations', require('./routes/crisisSimulations'));
app.use('/api/communication-logs', require('./routes/communicationLogs'));
app.use('/api/team-members', require('./routes/teamMembers'));
app.use('/api/incident-timelines', require('./routes/incidentTimelines'));
app.use('/api/risk-assessments', require('./routes/riskAssessments'));
app.use('/api/talking-points', require('./routes/talkingPoints'));
app.use('/api/post-crisis-analysis', require('./routes/postCrisisAnalysis'));

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
