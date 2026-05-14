const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
let PDFDocument;
try { PDFDocument = require('pdfkit'); } catch (_) { PDFDocument = null; }

// GET /api/export/crisis-report/:incident_id
// Returns a PDF with the incident timeline, communications, and resolution summary
router.get('/crisis-report/:incident_id', async (req, res) => {
  if (!PDFDocument) {
    return res.status(501).json({ error: 'PDF export not available: pdfkit not installed.' });
  }

  try {
    const { incident_id } = req.params;

    // Fetch all data in parallel
    const [incidentResult, timelineResult, commsResult, pressResult, sentimentResult] =
      await Promise.all([
        pool.query('SELECT * FROM crisis_incidents WHERE id = $1', [incident_id]),
        pool.query(
          'SELECT * FROM incident_timelines WHERE crisis_id = $1 ORDER BY timestamp ASC',
          [incident_id]
        ),
        pool.query(
          'SELECT * FROM communication_logs WHERE crisis_id = $1 ORDER BY created_at ASC',
          [incident_id]
        ),
        pool.query(
          'SELECT * FROM press_releases WHERE crisis_id = $1 ORDER BY created_at ASC',
          [incident_id]
        ).catch(() => ({ rows: [] })),
        pool.query(
          'SELECT * FROM media_monitoring WHERE incident_id = $1 ORDER BY created_at ASC',
          [incident_id]
        ).catch(() => ({ rows: [] })),
      ]);

    if (incidentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const incident = incidentResult.rows[0];
    const timeline = timelineResult.rows;
    const comms = commsResult.rows;
    const press = pressResult.rows;
    const media = sentimentResult.rows;

    // Build PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="crisis-report-${incident_id}.pdf"`
    );
    doc.pipe(res);

    // ── Cover ────────────────────────────────────────────────────────────────
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('CRISIS INCIDENT REPORT', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(incident.title, { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(11)
      .font('Helvetica')
      .text(`Report generated: ${new Date().toLocaleString()}`, { align: 'center' })
      .moveDown(2);

    // ── Incident Summary ─────────────────────────────────────────────────────
    doc.fontSize(14).font('Helvetica-Bold').text('1. INCIDENT SUMMARY').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);

    const summaryFields = [
      ['Incident ID', incident.id],
      ['Status', (incident.status || 'N/A').toUpperCase()],
      ['Severity', (incident.severity || 'N/A').toUpperCase()],
      ['Category', incident.category || 'N/A'],
      ['Location', incident.location || 'N/A'],
      ['Lead Responder', incident.lead_responder || 'N/A'],
      ['Created At', incident.created_at ? new Date(incident.created_at).toLocaleString() : 'N/A'],
      ['Last Updated', incident.updated_at ? new Date(incident.updated_at).toLocaleString() : 'N/A'],
    ];

    doc.fontSize(10).font('Helvetica');
    for (const [label, value] of summaryFields) {
      doc.text(`${label}: `, { continued: true }).font('Helvetica-Bold').text(String(value)).font('Helvetica');
    }
    doc.moveDown(0.5);

    if (incident.description) {
      doc.fontSize(11).font('Helvetica-Bold').text('Description:').moveDown(0.2);
      doc.fontSize(10).font('Helvetica').text(incident.description, { align: 'justify' }).moveDown(1);
    }

    // ── Incident Timeline ────────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('2. INCIDENT TIMELINE').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);

    if (timeline.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No timeline events recorded.').moveDown();
    } else {
      doc.fontSize(10).font('Helvetica');
      for (const event of timeline) {
        const ts = event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A';
        doc
          .font('Helvetica-Bold')
          .text(`[${ts}] ${event.event_title || 'Event'}`, { continued: false })
          .font('Helvetica');
        if (event.event_description) {
          doc.text(`   ${event.event_description}`);
        }
        if (event.event_type || event.impact_level) {
          doc.text(
            `   Type: ${event.event_type || 'N/A'} | Impact: ${event.impact_level || 'N/A'}`
          );
        }
        doc.moveDown(0.4);
      }
    }

    // ── Communications Log ───────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('3. COMMUNICATIONS LOG').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);

    if (comms.length === 0) {
      doc.fontSize(10).font('Helvetica').text('No communications logged.').moveDown();
    } else {
      doc.fontSize(10).font('Helvetica');
      for (const log of comms) {
        const ts = log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A';
        doc
          .font('Helvetica-Bold')
          .text(`[${ts}] ${log.channel || 'N/A'} — ${log.direction || 'outbound'}`)
          .font('Helvetica');
        doc.text(`   From: ${log.sender || 'N/A'} → To: ${log.recipient || 'N/A'}`);
        if (log.message) {
          const preview = log.message.length > 200 ? log.message.substring(0, 200) + '...' : log.message;
          doc.text(`   Message: ${preview}`);
        }
        doc.moveDown(0.4);
      }
    }

    // ── Press Releases ───────────────────────────────────────────────────────
    if (press.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('4. PRESS RELEASES').moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      for (const pr of press) {
        doc.font('Helvetica-Bold').text(pr.title || 'Untitled').font('Helvetica');
        doc.text(`Status: ${pr.status || 'N/A'} | Created: ${pr.created_at ? new Date(pr.created_at).toLocaleString() : 'N/A'}`);
        if (pr.content) {
          const preview = pr.content.length > 300 ? pr.content.substring(0, 300) + '...' : pr.content;
          doc.text(preview, { align: 'justify' });
        }
        doc.moveDown(0.5);
      }
    }

    // ── Media Coverage ───────────────────────────────────────────────────────
    if (media.length > 0) {
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('5. MEDIA COVERAGE SNAPSHOT').moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);

      const sentimentCount = media.reduce((acc, m) => {
        acc[m.sentiment] = (acc[m.sentiment] || 0) + 1;
        return acc;
      }, {});

      doc.fontSize(10).font('Helvetica');
      doc.text(`Total mentions: ${media.length}`);
      for (const [s, c] of Object.entries(sentimentCount)) {
        doc.text(`  ${s || 'Unknown'}: ${c}`);
      }
      doc.moveDown(0.5);

      for (const mention of media.slice(0, 20)) {
        doc.font('Helvetica-Bold').text(mention.title || mention.source || 'N/A').font('Helvetica');
        doc.text(`Source: ${mention.source || 'N/A'} | Sentiment: ${mention.sentiment || 'N/A'} | Reach: ${mention.reach || 'N/A'}`);
        doc.moveDown(0.3);
      }
      if (media.length > 20) {
        doc.text(`... and ${media.length - 20} more mentions.`);
      }
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('REPORT SUMMARY').moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Incident: ${incident.title}`);
    doc.text(`Final Status: ${(incident.status || 'N/A').toUpperCase()}`);
    doc.text(`Final Severity: ${(incident.severity || 'N/A').toUpperCase()}`);
    doc.text(`Timeline Events: ${timeline.length}`);
    doc.text(`Communications Logged: ${comms.length}`);
    doc.text(`Press Releases: ${press.length}`);
    doc.text(`Media Mentions: ${media.length}`);
    doc.moveDown(1);
    doc.fontSize(9).fillColor('gray').text('Generated by AI Crisis Communication Agent', { align: 'center' });

    doc.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
