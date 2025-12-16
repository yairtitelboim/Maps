/**
 * GRDA Q&A API Endpoint
 * 
 * Provides an API endpoint for querying the GRDA document Q&A system.
 * This endpoint uses the Python Q&A system via subprocess calls.
 * 
 * Usage:
 * POST /api/grda-qa
 * Body: { "query": "What are the permit requirements?", "vertical": "permits", "k": 5 }
 */

const { spawn } = require('child_process');
const path = require('path');

const GRDA_QA_SCRIPT = path.join(__dirname, '..', 'scripts', 'grda', 'grda_qa_system.py');
const PROCESSED_DIR = path.join(__dirname, '..', 'data', 'grda', 'processed');

/**
 * Query the GRDA Q&A system
 * @param {string} query - The question to ask
 * @param {string} vertical - Optional document vertical filter
 * @param {number} k - Number of documents to retrieve
 * @returns {Promise<Object>} - Query result with answer and sources
 */
async function queryGRDA(query, vertical = null, k = 5) {
  return new Promise((resolve, reject) => {
    const args = [
      GRDA_QA_SCRIPT,
      '--query', query,
      '--k', k.toString(),
      '--json'  // Output JSON for API
    ];

    if (vertical) {
      args.push('--vertical', vertical);
    }

    const pythonProcess = spawn('python3', args, {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PYTHONPATH: path.join(__dirname, '..')
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr || stdout}`));
        return;
      }

      try {
        // The Python script with --json flag outputs only JSON
        // Try to parse the entire stdout as JSON first
        const trimmed = stdout.trim();
        if (!trimmed) {
          reject(new Error('Empty response from Python script'));
          return;
        }

        // Try parsing as JSON
        try {
          const result = JSON.parse(trimmed);
          resolve(result);
        } catch (parseError) {
          // If direct parse fails, try to extract JSON from output
          const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            resolve(result);
          } else {
            // If no JSON found, return the text output as answer
            resolve({
              answer: trimmed,
              sources: [],
              raw_output: trimmed,
              warning: 'Could not parse JSON response'
            });
          }
        }
      } catch (error) {
        reject(new Error(`Failed to parse response: ${error.message}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
  });
}

/**
 * Express route handler for GRDA Q&A
 */
async function handleGRDAQuery(req, res) {
  try {
    const { query, vertical, k = 5 } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required parameter: query'
      });
    }

    const result = await queryGRDA(query, vertical, k);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('GRDA Q&A error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  queryGRDA,
  handleGRDAQuery
};

