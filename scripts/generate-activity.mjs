import fs from 'node:fs';
import path from 'node:path';

const USERNAME = '05rdev';
// GH_TOKEN is a Personal Access Token with 'repo' scope that can read private projects
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const hasPrivateAccess = Boolean(process.env.GH_TOKEN);

async function fetchContributionDays() {
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionYears
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  if (TOKEN) {
    try {
      console.log(`[Activity Generator] Querying GitHub GraphQL API for @${USERNAME} (Private access: ${hasPrivateAccess ? 'ENABLED (via GH_TOKEN)' : 'PUBLIC ONLY (using GITHUB_TOKEN)'})...`);
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'User-Agent': '05rDev-Activity-Bot',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables: { login: USERNAME } })
      });
      const json = await res.json();
      if (!json.errors && json.data?.user?.contributionsCollection) {
        const cal = json.data.user.contributionsCollection.contributionCalendar;
        const days = cal.weeks.flatMap(w => w.contributionDays);
        console.log(`[Activity Generator] Successfully fetched via GraphQL API.`);
        return { total: cal.totalContributions, days };
      } else if (json.errors) {
        console.warn(`[Activity Generator] GraphQL API returned errors:`, json.errors[0]?.message);
      }
    } catch (err) {
      console.warn(`[Activity Generator] GraphQL request failed (${err.message}). Trying fallback endpoint...`);
    }
  }

  // Fallback endpoint
  console.log(`[Activity Generator] Fetching from public contributions provider for @${USERNAME}...`);
  const res = await fetch(`https://github-contributions-api.jogruber.de/v4/${USERNAME}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch contribution data: HTTP ${res.status}`);
  }
  const data = await res.json();
  const total = Object.values(data.total || {}).reduce((acc, cur) => acc + cur, 0);
  return { total, days: data.contributions || [] };
}

function calculateStreaks(days) {
  if (!days || days.length === 0) {
    return { longestStreak: 0, currentStreak: 0 };
  }

  // Sort dates ascending
  days.sort((a, b) => a.date.localeCompare(b.date));

  let longestStreak = 0;
  let tempStreak = 0;

  for (const day of days) {
    const count = day.count ?? day.contributionCount ?? 0;
    if (count > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  // Calculate Current Streak working backwards from today
  const todayStr = new Date().toISOString().split('T')[0];
  const pastDays = days.filter(d => d.date <= todayStr);
  const rev = [...pastDays].reverse();

  let currentStreak = 0;
  let i = 0;

  // If user hasn't made a contribution yet today, start checking from yesterday
  if (rev.length > 0 && (rev[0].count ?? rev[0].contributionCount ?? 0) === 0) {
    i = 1;
  }

  while (i < rev.length && (rev[i].count ?? rev[i].contributionCount ?? 0) > 0) {
    currentStreak++;
    i++;
  }

  return { longestStreak, currentStreak };
}

async function run() {
  try {
    const { total, days } = await fetchContributionDays();
    const { longestStreak, currentStreak } = calculateStreaks(days);

    console.log(`[Activity Generator] Results -> Total: ${total}, Current Streak: ${currentStreak}, Longest Streak: ${longestStreak}`);

    const svgPath = path.resolve('activity.svg');
    if (!fs.existsSync(svgPath)) {
      throw new Error(`Could not find template file at ${svgPath}`);
    }

    let svg = fs.readFileSync(svgPath, 'utf-8');

    // Replace metric text elements based on id
    svg = svg.replace(/(id="stat-total"[^>]*>)([\s\S]*?)(<\/text>)/, `$1\n        ${total}+\n      $3`);
    svg = svg.replace(/(id="stat-current"[^>]*>)([\s\S]*?)(<\/text>)/, `$1\n        ${currentStreak}\n      $3`);
    svg = svg.replace(/(id="stat-longest"[^>]*>)([\s\S]*?)(<\/text>)/, `$1\n        ${longestStreak}\n      $3`);

    // Output to dist/activity.svg (for GitHub Pages / output branch)
    const distDir = path.resolve('dist');
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(path.join(distDir, 'activity.svg'), svg, 'utf-8');
    console.log(`[Activity Generator] Saved dist/activity.svg`);

    // Also update root activity.svg
    fs.writeFileSync(svgPath, svg, 'utf-8');
    console.log(`[Activity Generator] Updated root activity.svg`);

  } catch (err) {
    console.error(`[Activity Generator] Error:`, err);
    process.exit(1);
  }
}

run();
