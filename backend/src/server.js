require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
let helmet;
try { helmet = require('helmet'); } catch (_) { helmet = null; }
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// Helmet security headers (graceful fallback)
if (helmet) app.use(helmet({ contentSecurityPolicy: false }));

// CORS — env-driven allow list
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use(generalLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));

app.use('/api/ai', require('./routes/crisisDetection'));

app.use('/api/ai', require('./routes/agenticPlanning'));

app.use('/api/ai', require('./routes/sentimentEscalate'));

app.use('/api/ai', require('./routes/stressTesting'));

app.use('/api/ai', require('./routes/postcrisisLearn'));
app.use('/api/ai-advanced', require('./routes/aiAdvanced'));
app.use('/api/crisis-incidents', require('./routes/crisisIncidents'));
app.use('/api/media-monitoring', require('./routes/mediaMonitoring'));
// Alias for media mentions / coverage / dashboard
app.use('/api/media', require('./routes/mediaMonitoring'));
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
app.use('/api/export', require('./routes/exportRoutes'));

const PORT = process.env.PORT || 3001;

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-all-major-functions-lack-ai-endpoints-missing-generate-respo', require('./routes/gap_all_major_functions_lack_ai_endpoints_missing_generate_respo'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-real-time-alert-system-for-crisis-detection', require('./routes/gap_no_real_time_alert_system_for_crisis_detection'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-limited-integration-with-media-monitoring-apis-meltwater-bra', require('./routes/gap_limited_integration_with_media_monitoring_apis_meltwater_bra'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-webhooks', require('./routes/gap_no_webhooks'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-limited-push-notification-distribution-beyond-plumbing-stubs', require('./routes/gap_limited_push_notification_distribution_beyond_plumbing_stubs'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-approval-workflow-for-crisis-responses', require('./routes/gap_no_approval_workflow_for_crisis_responses'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-payment-billing-module', require('./routes/gap_no_payment_billing_module'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
