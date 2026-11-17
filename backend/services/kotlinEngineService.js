const { execFile } = require('child_process');
const path = require('path');

const JAR_PATH = path.resolve(__dirname, '../../kotlin-engine/build/LifeLinkEngine.jar');
const JAVA_CMD = process.env.JAVA_BIN || 'java';

/**
 * Run the Kotlin AI Triage & Dispatch Engine
 * @param {Object} params
 * @param {string} params.bloodGroup - e.g. "O-", "A+"
 * @param {number} params.units - required units
 * @param {string} params.priority - "critical", "high", "medium"
 * @param {number} [params.patientAge] - age in years
 * @param {string} [params.condition] - clinical indication
 * @returns {Promise<Object>}
 */
function runKotlinTriage({ bloodGroup = 'O-', units = 2, priority = 'critical', patientAge = 40, condition = 'Trauma Surgery' }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-jar',
      JAR_PATH,
      '--triage',
      bloodGroup,
      String(units),
      priority,
      String(patientAge),
      condition,
    ];

    execFile(JAVA_CMD, args, (error, stdout, stderr) => {
      if (error) {
        console.warn('Kotlin engine process warning, falling back to built-in rules:', stderr || error.message);
        // Fallback in case of environment issue
        return resolve({
          engine: 'LifeLink Kotlin Fallback',
          urgencyScore: priority === 'critical' ? 95 : priority === 'high' ? 75 : 45,
          priorityLevel: priority.toUpperCase(),
          dispatchStrategy: priority === 'critical' ? 'CODE_RED_MULTI_DISPATCH' : 'PRIORITY_LOCAL_RESERVE',
          recommendedRadiusKm: priority === 'critical' ? 35.0 : 20.0,
          estimatedArrivalTargetMin: priority === 'critical' ? 25 : 45,
          compatibleBloodGroups: bloodGroup === 'O-' ? ['O-'] : ['O-', bloodGroup],
        });
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (parseErr) {
        console.error('Failed to parse Kotlin engine output:', stdout);
        resolve({
          engine: 'LifeLink Kotlin Output Parser Fallback',
          rawOutput: stdout,
        });
      }
    });
  });
}

/**
 * Run the Kotlin AI Demand Forecasting Engine
 * @returns {Promise<Object>}
 */
function runKotlinForecast() {
  return new Promise((resolve) => {
    const args = ['-jar', JAR_PATH, '--forecast'];

    execFile(JAVA_CMD, args, (error, stdout, stderr) => {
      if (error) {
        console.warn('Kotlin forecast warning:', stderr || error.message);
        return resolve(null);
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        console.error('Failed to parse Kotlin forecast output:', stdout);
        resolve(null);
      }
    });
  });
}

/**
 * Check Blood Compatibility via Kotlin Engine
 */
function checkKotlinCompatibility(donorGroup, recipientGroup) {
  return new Promise((resolve) => {
    const args = ['-jar', JAR_PATH, '--compat', donorGroup, recipientGroup];

    execFile(JAVA_CMD, args, (error, stdout) => {
      if (error) {
        return resolve({ compatible: donorGroup === 'O-' || donorGroup === recipientGroup });
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        resolve({ compatible: donorGroup === recipientGroup });
      }
    });
  });
}

module.exports = {
  runKotlinTriage,
  runKotlinForecast,
  checkKotlinCompatibility,
};
