import fs from 'node:fs';
import path from 'node:path';

export function generateNeuralMatrixSVG({ total = 0, days = [], currentStreak = 0, longestStreak = 0, username = '05rdev' }) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayMap = new Map((days || []).map(d => [d.date, d.count ?? d.contributionCount ?? 0]));

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayDayOfWeek = today.getUTCDay(); // 0: Sun ... 6: Sat

  // Align with 53 weeks (columns), Sun-Sat
  const curSunday = new Date(today);
  curSunday.setUTCDate(today.getUTCDate() - todayDayOfWeek);

  const startSunday = new Date(curSunday);
  startSunday.setUTCDate(curSunday.getUTCDate() - 52 * 7);

  // Month Labels
  const monthLabels = [];
  let lastMonth = -1;
  for (let col = 0; col < 53; col++) {
    const colDate = new Date(startSunday);
    colDate.setUTCDate(startSunday.getUTCDate() + col * 7);
    const m = colDate.getUTCMonth();
    if (m !== lastMonth && colDate.getUTCDate() <= 14) {
      monthLabels.push({
        x: 64 + col * 13.5,
        name: monthNames[m]
      });
      lastMonth = m;
    }
  }

  // Collect Active Nodes & Weekly Activity for ECG Waveform
  let cellsSvg = '';
  let ripplesSvg = '';
  const activeNodes = [];
  const weeklyCounts = new Array(53).fill(0);
  let peakDay = 0;

  for (let col = 0; col < 53; col++) {
    for (let row = 0; row < 7; row++) {
      const cellDate = new Date(startSunday);
      cellDate.setUTCDate(startSunday.getUTCDate() + (col * 7 + row));
      const dateStr = cellDate.toISOString().split('T')[0];

      // Future days beyond today
      if (dateStr > todayStr) continue;

      const count = dayMap.get(dateStr) || 0;
      if (count > peakDay) peakDay = count;
      weeklyCounts[col] += count;

      const x = 64 + col * 13.5;
      const y = 68 + row * 13.5;

      let fill = '#0b1324';
      let stroke = '#15243d';
      let strokeWidth = '0.8';
      let extraClass = '';
      let filter = '';

      if (count > 0) {
        activeNodes.push({ x: x + 5, y: y + 5, count, dateStr, col });

        if (count >= 10) {
          fill = '#ff416c';
          stroke = '#ff758c';
          filter = 'filter="url(#glowPink)"';
          extraClass = 'class="pulse-node-pink"';
        } else if (count >= 6) {
          fill = '#9b51e0';
          stroke = '#c084fc';
          filter = 'filter="url(#glowPurple)"';
          extraClass = 'class="pulse-node-purple"';
        } else if (count >= 3) {
          fill = '#00f2fe';
          stroke = '#38bdf8';
          filter = 'filter="url(#glowCyan)"';
          extraClass = 'class="pulse-node-cyan"';
        } else {
          fill = '#0284c7';
          stroke = '#38bdf8';
          strokeWidth = '1.2';
          extraClass = 'class="pulse-node-cyan"';
          filter = 'filter="url(#glowCyanSoft)"';
        }

        // Radar scanner impact ripple ring
        ripplesSvg += `    <circle class="impact-ripple" cx="${x + 5}" cy="${y + 5}" r="7" stroke="#00f2fe" fill="none" stroke-width="1.2" opacity="0.6" />\n`;
      }

      cellsSvg += `    <rect x="${x}" y="${y}" width="10" height="10" rx="2.5" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${filter} ${extraClass}>
      <title>${dateStr}: ${count} contributions</title>
    </rect>\n`;
    }
  }

  // Neural Connection Synapse Lines between active clusters (strictly real clusters)
  let neuralConnectionsSvg = '';
  if (activeNodes.length >= 2) {
    const segments = [];
    for (let i = 1; i < activeNodes.length; i++) {
      const prev = activeNodes[i - 1];
      const curr = activeNodes[i];
      // Only connect if within adjacent weeks (cluster)
      if (Math.abs(curr.col - prev.col) <= 3) {
        segments.push(`M ${prev.x} ${prev.y} L ${curr.x} ${curr.y}`);
      }
    }
    if (segments.length > 0) {
      const pathD = segments.join(' ');
      neuralConnectionsSvg = `
    <!-- Neural Synapse Connections (Real Activity Clusters) -->
    <path d="${pathD}" fill="none" stroke="#00f2fe" stroke-width="1.5" stroke-opacity="0.55" stroke-dasharray="3, 5" class="synapse-stream" />
    <path d="${pathD}" fill="none" stroke="url(#matrixAurora)" stroke-width="1.2" stroke-opacity="0.4" />
    `;
    }
  }

  // ECG Activity Signal Waveform across the 53 weeks (100% Real Commits Data)
  const waveBaseY = 198;
  let ecgPoints = [];
  let ecgAreaPoints = [];
  ecgAreaPoints.push(`64,${waveBaseY}`);

  for (let col = 0; col < 53; col++) {
    const x = 64 + col * 13.5 + 5;
    const c = weeklyCounts[col];

    if (c > 0) {
      // ECG spike strictly based on actual week's contributions
      const spikeHeight = Math.min(24, 6 + c * 5);
      ecgPoints.push(`${x - 3},${waveBaseY}`);
      ecgPoints.push(`${x - 1},${waveBaseY + 2}`);
      ecgPoints.push(`${x},${waveBaseY - spikeHeight}`);
      ecgPoints.push(`${x + 1.5},${waveBaseY + 3}`);
      ecgPoints.push(`${x + 3},${waveBaseY}`);

      ecgAreaPoints.push(`${x - 3},${waveBaseY}`);
      ecgAreaPoints.push(`${x - 1},${waveBaseY + 2}`);
      ecgAreaPoints.push(`${x},${waveBaseY - spikeHeight}`);
      ecgAreaPoints.push(`${x + 1.5},${waveBaseY + 3}`);
      ecgAreaPoints.push(`${x + 3},${waveBaseY}`);
    } else {
      // True flat baseline when zero contributions in that week
      ecgPoints.push(`${x},${waveBaseY}`);
      ecgAreaPoints.push(`${x},${waveBaseY}`);
    }
  }

  const lastColX = 64 + 52 * 13.5 + 5;
  ecgAreaPoints.push(`${lastColX},${waveBaseY}`);

  const ecgPathD = 'M ' + ecgPoints.join(' L ');
  const ecgAreaD = 'M ' + ecgAreaPoints.join(' L ') + ' Z';

  const activeNodesCount = activeNodes.length;

  // Month Labels SVG
  const monthLabelsSvg = monthLabels
    .map(m => `<text x="${m.x}" y="59" class="font-mono" font-size="8" fill="#586f91" letter-spacing="0.5">${m.name}</text>`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 260" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="matrixBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060911" />
      <stop offset="50%" stop-color="#0b1120" />
      <stop offset="100%" stop-color="#070a14" />
    </linearGradient>

    <!-- Aurora Holographic Accent Gradient -->
    <linearGradient id="matrixAurora" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f2fe" />
      <stop offset="35%" stop-color="#4facfe" />
      <stop offset="70%" stop-color="#9b51e0" />
      <stop offset="100%" stop-color="#ff416c" />
    </linearGradient>

    <!-- Laser Scanning Beam Gradient -->
    <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00f2fe" stop-opacity="0" />
      <stop offset="50%" stop-color="#00f2fe" stop-opacity="0.06" />
      <stop offset="90%" stop-color="#00f2fe" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#00f2fe" stop-opacity="0.85" />
    </linearGradient>

    <!-- ECG Gradient Area Fill -->
    <linearGradient id="ecgAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#00f2fe" stop-opacity="0.0" />
    </linearGradient>

    <!-- Radial Nebula Blurs for Background Glow -->
    <radialGradient id="nebulaCyan" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#00f2fe" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="nebulaPurple" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#9b51e0" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#9b51e0" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="nebulaPink" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff416c" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ff416c" stop-opacity="0" />
    </radialGradient>

    <!-- Background Grid Dots -->
    <pattern id="matrixDotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.6" fill="#4facfe" opacity="0.08" />
    </pattern>

    <!-- Glow Filters -->
    <filter id="glowCyan" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="glowCyanSoft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="glowPurple" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="glowPink" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="laserGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <style><![CDATA[
      /* Perimeter Light Circuit Stream */
      .matrix-stream {
        stroke-dasharray: 14, 200;
        animation: streamFlow 10s linear infinite;
      }
      @keyframes streamFlow {
        to { stroke-dashoffset: -856; }
      }

      /* Nebula Float Motion */
      .nebula-float-1 {
        animation: nebulaMove1 16s ease-in-out infinite alternate;
      }
      @keyframes nebulaMove1 {
        0% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(35px, -12px) scale(1.1); }
        100% { transform: translate(-20px, 8px) scale(0.95); }
      }

      .nebula-float-2 {
        animation: nebulaMove2 13s ease-in-out infinite alternate;
      }
      @keyframes nebulaMove2 {
        0% { transform: translate(0, 0) scale(1); }
        50% { transform: translate(-25px, 15px) scale(1.08); }
        100% { transform: translate(25px, -10px) scale(0.98); }
      }

      /* Radar Sweep Needle & Pulse */
      .radar-sweep-needle {
        transform-origin: 38px 28px;
        animation: radarSpin 3.5s linear infinite;
      }
      @keyframes radarSpin {
        to { transform: rotate(360deg); }
      }

      .radar-pulse {
        animation: radarPing 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        transform-origin: 38px 28px;
      }
      @keyframes radarPing {
        0% { r: 3px; opacity: 1; stroke-width: 1px; }
        70% { r: 13px; opacity: 0; stroke-width: 2px; }
        100% { r: 15px; opacity: 0; stroke-width: 0; }
      }

      /* Quantum Laser Scanning Beam Sweep */
      .scanner-beam-group {
        animation: laserScan 6.5s cubic-bezier(0.35, 0, 0.25, 1) infinite;
      }
      @keyframes laserScan {
        0% { transform: translateX(0px); opacity: 0; }
        4% { opacity: 1; }
        92% { opacity: 1; }
        98% { transform: translateX(718px); opacity: 0; }
        100% { transform: translateX(718px); opacity: 0; }
      }

      /* Neural Synapse Data Packet Stream */
      .synapse-stream {
        animation: dataFlow 1.6s linear infinite;
      }
      @keyframes dataFlow {
        to { stroke-dashoffset: -32; }
      }

      /* Impact Ripple on Active Nodes */
      .impact-ripple {
        animation: rippleBreathe 2.4s cubic-bezier(0.25, 1, 0.5, 1) infinite;
        transform-origin: center;
      }
      @keyframes rippleBreathe {
        0% { transform: scale(0.9); opacity: 0.8; stroke-width: 1.2px; }
        70% { transform: scale(1.5); opacity: 0; stroke-width: 0.4px; }
        100% { transform: scale(1.6); opacity: 0; }
      }

      /* Active Node Breathing Pulses */
      .pulse-node-cyan {
        animation: nodeBreatheCyan 2.8s ease-in-out infinite alternate;
      }
      @keyframes nodeBreatheCyan {
        0% { filter: drop-shadow(0 0 2px rgba(0, 242, 254, 0.4)); opacity: 0.85; }
        100% { filter: drop-shadow(0 0 8px rgba(0, 242, 254, 1)); opacity: 1; }
      }

      .pulse-node-purple {
        animation: nodeBreathePurple 2.4s ease-in-out infinite alternate;
      }
      @keyframes nodeBreathePurple {
        0% { filter: drop-shadow(0 0 2px rgba(155, 81, 224, 0.4)); }
        100% { filter: drop-shadow(0 0 8px rgba(155, 81, 224, 1)); }
      }

      .pulse-node-pink {
        animation: nodeBreathePink 2s ease-in-out infinite alternate;
      }
      @keyframes nodeBreathePink {
        0% { filter: drop-shadow(0 0 3px rgba(255, 65, 108, 0.5)); }
        100% { filter: drop-shadow(0 0 10px rgba(255, 65, 108, 1)); }
      }

      /* Sci-Fi Text Glitch */
      .glitch-text {
        animation: textGlitch 9s infinite;
      }
      @keyframes textGlitch {
        0%, 93%, 100% { transform: skew(0deg); opacity: 1; filter: none; }
        94% { transform: skew(2.5deg); opacity: 0.85; filter: drop-shadow(-1.5px 0 #ff416c) drop-shadow(1.5px 0 #00f2fe); }
        95% { transform: skew(-2deg); opacity: 0.95; }
        96% { transform: skew(0deg); opacity: 1; filter: none; }
      }

      /* ECG Cardiogram Glow Pulse */
      .ecg-line {
        animation: ecgPulse 3s ease-in-out infinite alternate;
      }
      @keyframes ecgPulse {
        0% { stroke: #00f2fe; filter: drop-shadow(0 0 2px rgba(0, 242, 254, 0.4)); }
        100% { stroke: #4facfe; filter: drop-shadow(0 0 6px rgba(79, 172, 254, 0.8)); }
      }

      .font-mono { font-family: 'SF Mono', 'Fira Code', 'Roboto Mono', Consolas, monospace; }
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    ]]></style>
  </defs>

  <!-- Base Canvas -->
  <rect width="840" height="260" rx="14" fill="url(#matrixBg)" />
  <rect width="840" height="260" rx="14" fill="url(#matrixDotGrid)" />

  <!-- Floating Deep Space Aurora Nebula Blobs -->
  <g class="nebula-float-1">
    <ellipse cx="220" cy="110" rx="160" ry="60" fill="url(#nebulaCyan)" />
  </g>
  <g class="nebula-float-2">
    <ellipse cx="640" cy="130" rx="170" ry="70" fill="url(#nebulaPurple)" />
    <ellipse cx="440" cy="100" rx="140" ry="50" fill="url(#nebulaPink)" />
  </g>

  <!-- Outer Border Frame -->
  <path d="M 24,10 L 816,10 Q 830,10 830,24 L 830,236 Q 830,250 816,250 L 24,250 Q 10,250 10,236 L 10,24 Q 10,10 24,10 Z"
        fill="none" stroke="#1d283f" stroke-width="1.2" />

  <!-- Animated Circuit Stream -->
  <path class="matrix-stream" d="M 24,10 L 816,10 Q 830,10 830,24 L 830,236 Q 830,250 816,250 L 24,250 Q 10,250 10,236 L 10,24 Q 10,10 24,10 Z"
        fill="none" stroke="url(#matrixAurora)" stroke-width="2" stroke-linecap="round" />

  <!-- Top Telemetry Header -->
  <g transform="translate(0, 0)">
    <!-- Rotating Radar with Target Reticle -->
    <circle cx="38" cy="28" r="10" fill="none" stroke="#1b2a44" stroke-width="1" />
    <circle cx="38" cy="28" r="5" fill="none" stroke="#1b2a44" stroke-width="0.8" />
    <circle class="radar-pulse" cx="38" cy="28" r="3.5" fill="none" stroke="#00f2fe" />
    <circle cx="38" cy="28" r="2.5" fill="#00f2fe" />
    
    <!-- Rotating radar sweep ray -->
    <line class="radar-sweep-needle" x1="38" y1="28" x2="38" y2="18" stroke="#00f2fe" stroke-width="1.2" stroke-linecap="round" filter="url(#glowCyanSoft)" />

    <!-- Glitch Heading -->
    <text x="56" y="32" class="font-mono glitch-text" font-size="10" font-weight="700" fill="#00f2fe" letter-spacing="1.5">
      QUANTUM_NEURAL_GRID // SYSTEM_CONTRIBUTION_MATRIX
    </text>

    <!-- Telemetry Badges Right (100% Real GitHub Metrics) -->
    <text x="806" y="32" class="font-mono" font-size="8.5" fill="#7186a6" letter-spacing="1.2" text-anchor="end">
      TOTAL: <tspan fill="#00f2fe" font-weight="700">${total}</tspan> | ACTIVE: <tspan fill="#4facfe" font-weight="700">${activeNodesCount}D</tspan> | PEAK: <tspan fill="#ff416c" font-weight="700">${peakDay}/DAY</tspan> | STREAK: <tspan fill="#00f2fe" font-weight="700">${currentStreak}D</tspan>
    </text>

    <!-- Dividing accent line -->
    <line x1="28" y1="46" x2="812" y2="46" stroke="#1d283f" stroke-width="1" />
  </g>

  <!-- Month Labels -->
  <g>
    ${monthLabelsSvg}
  </g>

  <!-- Day of Week Labels (Mon, Wed, Fri) -->
  <g class="font-mono" font-size="8" fill="#586f91" text-anchor="end">
    <text x="54" y="90">Mon</text>
    <text x="54" y="117">Wed</text>
    <text x="54" y="144">Fri</text>
  </g>

  <!-- Neural Connection Synapses between Active Nodes -->
${neuralConnectionsSvg}

  <!-- Neural Matrix Grid Cells -->
  <g>
${cellsSvg}  </g>

  <!-- Impact Ripple Circles around Active Nodes -->
  <g>
${ripplesSvg}  </g>

  <!-- Sweeping Laser Scanline Beam Group -->
  <g class="scanner-beam-group">
    <!-- Semi-transparent Phosphor Wave behind Laser Line -->
    <rect x="24" y="64" width="40" height="98" fill="url(#laserBeamGrad)" />

    <!-- Sharp Laser Beam Line -->
    <line x1="64" y1="62" x2="64" y2="164" stroke="#00f2fe" stroke-width="1.8" filter="url(#laserGlow)" />
    
    <!-- Laser Optical Emitter Nodes -->
    <circle cx="64" cy="62" r="2.2" fill="#ffffff" filter="url(#laserGlow)" />
    <circle cx="64" cy="164" r="2.2" fill="#ffffff" filter="url(#laserGlow)" />
  </g>

  <!-- Activity Signal / Heartbeat Waveform (ECG Pulse) Section -->
  <g transform="translate(0, 0)">
    <!-- Cardiogram Area Gradient Fill -->
    <path d="${ecgAreaD}" fill="url(#ecgAreaGrad)" />

    <!-- Cardiogram Main Glowing Line -->
    <path d="${ecgPathD}" fill="none" stroke-width="1.5" class="ecg-line" stroke-linejoin="round" />

    <!-- Left Telemetry Label for ECG -->
    <text x="36" y="196" class="font-mono" font-size="7.5" font-weight="700" fill="#4facfe" letter-spacing="1">
      ACTIVITY_SIGNAL
    </text>
    <text x="36" y="206" class="font-mono" font-size="6.5" fill="#586f91">
      LIVE_CARDIOGRAM
    </text>
  </g>

  <!-- Footer Technical Telemetry Bar & Legend -->
  <g transform="translate(0, 214)">
    <!-- Dividing line -->
    <line x1="28" y1="0" x2="812" y2="0" stroke="#1d283f" stroke-width="1" />

    <!-- Charge Level Legend -->
    <g transform="translate(36, 16)">
      <text x="0" y="7" class="font-mono" font-size="7.5" fill="#6982a5" letter-spacing="0.5">CONTRIBUTIONS:</text>
      
      <text x="96" y="7" class="font-mono" font-size="7" fill="#475569">LESS</text>
      <rect x="124" y="0" width="8" height="8" rx="2" fill="#0b1324" stroke="#15243d" stroke-width="0.8" />
      <rect x="136" y="0" width="8" height="8" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="0.8" />
      <rect x="148" y="0" width="8" height="8" rx="2" fill="#00f2fe" stroke="#38bdf8" stroke-width="0.8" filter="url(#glowCyan)" />
      <rect x="160" y="0" width="8" height="8" rx="2" fill="#9b51e0" stroke="#c084fc" stroke-width="0.8" filter="url(#glowPurple)" />
      <rect x="172" y="0" width="8" height="8" rx="2" fill="#ff416c" stroke="#ff758c" stroke-width="0.8" filter="url(#glowPink)" />
      <text x="186" y="7" class="font-mono" font-size="7" fill="#ff416c">MORE</text>
    </g>

    <!-- Telemetry Status Right (100% Real Stats) -->
    <text x="806" y="23" class="font-mono" font-size="7.5" fill="#586f91" letter-spacing="1" text-anchor="end">
      TOTAL_CONTRIBUTIONS: <tspan fill="#00f2fe" font-weight="700">${total}</tspan> | CURRENT_STREAK: <tspan fill="#4facfe" font-weight="700">${currentStreak}D</tspan> | LONGEST_STREAK: <tspan fill="#00f2fe" font-weight="700">${longestStreak}D</tspan> // ${username.toUpperCase()}::QUANTUM_CORE
    </text>
  </g>
</svg>`;
}
