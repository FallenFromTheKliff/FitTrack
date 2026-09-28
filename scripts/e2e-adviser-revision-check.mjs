import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const rootDir = process.cwd();
const runStamp = new Date().toISOString().replace(/[:.]/g, '-');
const artifactDir = path.join(
  rootDir,
  '.artifacts',
  'qa',
  `adviser-e2e-${runStamp}`,
);
const tempDir = path.join(artifactDir, 'tmp');
process.env.TEMP = tempDir;
process.env.TMP = tempDir;
process.env.TMPDIR = tempDir;

await mkdir(tempDir, { recursive: true });

const require = createRequire(import.meta.url);
const playwrightSearchRoots = [
  path.join(
    rootDir,
    'node_modules',
    '.pnpm',
    'playwright@1.59.0-alpha-1771104257000',
    'node_modules',
  ),
  path.join(rootDir, 'node_modules', '.pnpm', 'playwright@1.58.2', 'node_modules'),
  path.join(rootDir, 'node_modules'),
];
const playwrightEntry = require.resolve('playwright', {
  paths: playwrightSearchRoots,
});
const { chromium } = require(playwrightEntry);

const baseUrl = 'http://127.0.0.1:8080';
const credentials = {
  admin: {
    email: 'seed.admin@fittrack.com',
    loginRoute: '/login',
    password: 'SeedAdmin!2026',
  },
  coach: {
    email: 'seed.coach@fittrack.com',
    loginRoute: '/login',
    password: 'SeedMember!2026',
  },
  member: {
    email: 'seed.member.active@fittrack.com',
    loginRoute: '/member-login',
    password: 'SeedMember!2026',
  },
};

const destructiveNamePattern =
  /delete|archive|deactivate|suspend|approve|reject|cancel booking|confirm payment|verify payment|sign out|logout/i;
const safeOpenNamePattern =
  /details|view|edit profile|manage availability|new coach booking|create|add|filter|search|calendar|more/i;
const safeCloseNamePattern = /close|cancel|back|dismiss|esc/i;

const results = {
  artifactDir,
  checks: [],
  console: [],
  failedRequests: [],
  httpErrors: [],
  skipped: [],
  startedAt: new Date().toISOString(),
};

function record(check) {
  results.checks.push({
    at: new Date().toISOString(),
    ...check,
  });
}

function normalizeName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

async function screenshot(page, label) {
  const safeLabel = label.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  const file = path.join(artifactDir, `${String(results.checks.length).padStart(3, '0')}-${safeLabel}.png`);
  await page.screenshot({ fullPage: true, path: file });
  return file;
}

async function visibleText(page) {
  return normalizeName(
    await page.locator('body').evaluate((body) => body.innerText.slice(0, 6000)),
  );
}

async function inventory(page) {
  return page.evaluate(() => {
    const selectors = [
      'button',
      'a[href]',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[role="dialog"]',
      '[aria-haspopup]',
      '[aria-expanded]',
    ].join(',');

    return Array.from(document.querySelectorAll(selectors))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none'
        );
      })
      .slice(0, 180)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          ariaExpanded: element.getAttribute('aria-expanded'),
          ariaHaspopup: element.getAttribute('aria-haspopup'),
          disabled:
            element.disabled === true ||
            element.getAttribute('aria-disabled') === 'true',
          name:
            element.getAttribute('aria-label') ||
            element.innerText ||
            element.getAttribute('placeholder') ||
            element.getAttribute('name') ||
            element.getAttribute('href') ||
            element.tagName,
          role: element.getAttribute('role') || element.tagName.toLowerCase(),
          tag: element.tagName.toLowerCase(),
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
  });
}

async function geometryIssues(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const issues = [];
    const candidates = Array.from(
      document.querySelectorAll('main, section, article, [role="dialog"], table, [data-ui], button, input, select'),
    );

    for (const element of candidates) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const name =
        element.getAttribute('aria-label') ||
        element.getAttribute('data-ui') ||
        element.textContent?.trim().slice(0, 80) ||
        element.tagName;
      if (rect.right > viewportWidth + 6) {
        issues.push({
          kind: 'horizontal-overflow',
          name,
          right: Math.round(rect.right),
          viewportWidth,
        });
      }
      if (rect.left < -6) {
        issues.push({
          kind: 'offscreen-left',
          left: Math.round(rect.left),
          name,
        });
      }
      if (
        element.scrollWidth > element.clientWidth + 8 &&
        !['TABLE', 'TBODY', 'THEAD', 'TR'].includes(element.tagName)
      ) {
        issues.push({
          clientWidth: element.clientWidth,
          kind: 'internal-horizontal-scroll',
          name,
          scrollWidth: element.scrollWidth,
        });
      }
      if (
        element.getAttribute('role') === 'dialog' &&
        rect.height > viewportHeight - 48 &&
        getComputedStyle(element).overflowY === 'visible'
      ) {
        issues.push({
          height: Math.round(rect.height),
          kind: 'dialog-missing-scroll-owner',
          name,
          viewportHeight,
        });
      }
    }
    return issues.slice(0, 80);
  });
}

async function login(page, role) {
  const credential = credentials[role];
  await page.goto(`${baseUrl}${credential.loginRoute}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const emailInput = page
    .locator(
      'input[type="email"], input[name*="email" i], input[placeholder*="email" i]',
    )
    .first();
  const passwordInput = page.locator('input[type="password"]').first();
  await emailInput.fill(credential.email);
  await passwordInput.fill(credential.password);
  await page
    .getByRole('button', { name: /sign in|log in|login/i })
    .first()
    .click();
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  record({
    role,
    route: credential.loginRoute,
    status: 'logged-in',
    url: page.url(),
  });
}

async function goRoute(page, role, route, viewport, label) {
  await page.setViewportSize(viewport);
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
  const shot = await screenshot(page, `${role}-${label}-initial`);
  const controls = await inventory(page);
  const issues = await geometryIssues(page);
  const text = await visibleText(page);
  record({
    controls: controls.slice(0, 70),
    geometryIssues: issues,
    label,
    role,
    route,
    screenshot: shot,
    status: 'route-loaded',
    textPreview: text.slice(0, 1200),
    url: page.url(),
    viewport,
  });
}

async function clickText(page, role, route, label, pattern, options = {}) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
  const target = page.getByText(pattern, { exact: false }).first();
  if ((await target.count()) === 0) {
    results.skipped.push({ label, reason: 'text-not-found', role, route });
    return false;
  }
  try {
    await target.click({ timeout: 5000 });
  } catch (error) {
    results.skipped.push({
      error: error.message,
      label,
      reason: 'click-failed',
      role,
      route,
    });
    return false;
  }
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(options.waitMs ?? 600);
  const shot = await screenshot(page, `${role}-${label}`);
  record({
    controls: (await inventory(page)).slice(0, 60),
    geometryIssues: await geometryIssues(page),
    label,
    role,
    route,
    screenshot: shot,
    status: 'clicked',
    textPreview: (await visibleText(page)).slice(0, 1200),
  });
  return true;
}

async function closeAnyDialog(page, role, route, label) {
  const dialog = page.locator('[role="dialog"], .fixed, .modal').first();
  const hasDialog = (await dialog.count()) > 0 && (await dialog.isVisible().catch(() => false));
  if (!hasDialog) return;

  const closeButton = page
    .getByRole('button', { name: safeCloseNamePattern })
    .last();
  if ((await closeButton.count()) > 0) {
    await closeButton.click().catch(() => {});
  } else {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await page.waitForTimeout(400);
  record({
    label: `${label}: close dialog`,
    role,
    route,
    status: 'dialog-close-attempted',
  });
}

async function exerciseSafeButtons(page, role, route, label, limit = 6) {
  const controls = await inventory(page);
  const candidates = controls
    .filter((control) => {
      const name = normalizeName(control.name);
      return (
        !control.disabled &&
        (control.tag === 'button' || control.role === 'button') &&
        safeOpenNamePattern.test(name) &&
        !destructiveNamePattern.test(name)
      );
    })
    .slice(0, limit);

  for (const candidate of candidates) {
    const name = normalizeName(candidate.name);
    const button = page.getByRole('button', { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if ((await button.count()) === 0) {
      results.skipped.push({ label, name, reason: 'safe-button-not-found-by-role', role, route });
      continue;
    }
    await button.click({ timeout: 5000 }).catch((error) => {
      results.skipped.push({ error: error.message, label, name, reason: 'safe-button-click-failed', role, route });
    });
    await page.waitForTimeout(700);
    const shot = await screenshot(page, `${role}-${label}-${name}`);
    record({
      geometryIssues: await geometryIssues(page),
      label: `${label}: ${name}`,
      role,
      route,
      screenshot: shot,
      status: 'safe-control-exercised',
      textPreview: (await visibleText(page)).slice(0, 1000),
    });
    await closeAnyDialog(page, role, route, `${label}: ${name}`);
    await page.keyboard.press('Escape').catch(() => {});
  }

  for (const control of controls) {
    const name = normalizeName(control.name);
    if (!control.disabled && destructiveNamePattern.test(name)) {
      results.skipped.push({
        label,
        name,
        reason: 'destructive-or-external-side-effect-control-not-mutated',
        role,
        route,
      });
    }
  }
}

async function checkAnalytics(page) {
  await goRoute(page, 'admin', '/analytics', { width: 1440, height: 900 }, 'analytics');
  await clickText(page, 'admin', '/analytics', 'analytics: performance tab', /Performance KPIs/i);
  await clickText(page, 'admin', '/analytics', 'analytics: range tab', /Range Insights/i);
  await clickText(page, 'admin', '/analytics', 'analytics: revenue tab', /Revenue/i);
  await clickText(page, 'admin', '/analytics', 'analytics: all sections tab', /All Sections/i);

  const dateInputs = page.locator('input[type="date"]');
  if ((await dateInputs.count()) >= 2) {
    await dateInputs.nth(0).fill('2026-03-01');
    await dateInputs.nth(1).fill('2026-07-26');
    const applyRangeButton = page.getByRole('button', { name: /apply range/i });
    if (await applyRangeButton.isEnabled()) {
      await applyRangeButton.click();
    } else {
      results.skipped.push({
        label: 'analytics date range apply',
        reason: 'apply-disabled-after-date-mutation',
        role: 'admin',
        route: '/analytics',
      });
    }
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(800);
    record({
      geometryIssues: await geometryIssues(page),
      label: 'analytics: date range apply',
      role: 'admin',
      route: '/analytics',
      screenshot: await screenshot(page, 'admin-analytics-date-range-applied'),
      status: 'date-range-tested',
      textPreview: (await visibleText(page)).slice(0, 1200),
    });
  } else {
    results.skipped.push({
      label: 'analytics date range',
      reason: 'date-inputs-not-found',
      role: 'admin',
      route: '/analytics',
    });
  }
}

async function checkGymOperations(page) {
  await goRoute(page, 'admin', '/schedule', { width: 1440, height: 900 }, 'gym-operations');

  await clickText(page, 'admin', '/schedule', 'gym: month calendar', /Month Calendar/i);
  const calendarButtons = page.locator('[data-ui="gym-operations-month-calendar"] button');
  if ((await calendarButtons.count()) > 0) {
    await calendarButtons.nth(Math.min(8, (await calendarButtons.count()) - 1)).click();
    await page.waitForTimeout(800);
    record({
      geometryIssues: await geometryIssues(page),
      label: 'gym: calendar day modal/open state',
      role: 'admin',
      route: '/schedule',
      screenshot: await screenshot(page, 'admin-gym-calendar-day-modal'),
      status: 'calendar-day-tested',
      textPreview: (await visibleText(page)).slice(0, 1200),
    });
    await closeAnyDialog(page, 'admin', '/schedule', 'gym calendar');
  } else {
    results.skipped.push({ label: 'gym calendar day modal', reason: 'calendar-buttons-not-found', role: 'admin', route: '/schedule' });
  }

  await clickText(page, 'admin', '/schedule', 'gym: coach schedule subtab', /Coach Schedule/i);
  await exerciseSafeButtons(page, 'admin', '/schedule', 'gym coach schedule', 4);
  await clickText(page, 'admin', '/schedule', 'gym: venue bookings subtab', /Venue Bookings/i);
  await exerciseSafeButtons(page, 'admin', '/schedule', 'gym venue bookings', 4);
  await clickText(page, 'admin', '/schedule', 'gym: coaches tab', /^Coaches$/i);
  await exerciseSafeButtons(page, 'admin', '/schedule', 'gym coaches', 8);
  await clickText(page, 'admin', '/schedule', 'gym: appointments tab', /Appointments/i);
  await exerciseSafeButtons(page, 'admin', '/schedule', 'gym appointments', 6);
}

async function checkMilestones(page) {
  await goRoute(page, 'admin', '/milestones', { width: 1440, height: 900 }, 'milestones');
  await exerciseSafeButtons(page, 'admin', '/milestones', 'milestones', 8);
  await clickText(page, 'admin', '/milestones', 'milestones: evidence/review tab if present', /Evidence|Review|Submissions/i);
}

async function checkExerciseLab(page) {
  await goRoute(page, 'admin', '/exercise-lab', { width: 1440, height: 900 }, 'exercise-lab');
  await exerciseSafeButtons(page, 'admin', '/exercise-lab', 'exercise lab', 8);
  const text = await visibleText(page);
  const expectedExercises = [
    'Cable Fly',
    'Barbell Bench Press',
    'Leg Extension',
    'Lat Pulldown',
    'Dumbbell Biceps Curl',
  ];
  record({
    expectedExercises,
    foundExercises: expectedExercises.filter((exercise) => text.includes(exercise)),
    label: 'exercise lab: conventional exercise visibility',
    role: 'admin',
    route: '/exercise-lab',
    status: 'exercise-data-checked',
  });
}

async function checkMemberWorkout(page) {
  await login(page, 'member');
  await goRoute(page, 'member', '/workout', { width: 390, height: 844 }, 'member-workout-mobile-web');
  const combobox = page.locator('[role="combobox"], select, button[aria-haspopup="listbox"]').first();
  if ((await combobox.count()) > 0) {
    await combobox.click().catch(() => {});
    await page.waitForTimeout(500);
    record({
      geometryIssues: await geometryIssues(page),
      label: 'member workout: split selector open',
      role: 'member',
      route: '/workout',
      screenshot: await screenshot(page, 'member-workout-split-selector-open'),
      status: 'split-selector-opened',
      textPreview: (await visibleText(page)).slice(0, 1200),
    });
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    results.skipped.push({ label: 'member workout split selector', reason: 'combobox-not-found', role: 'member', route: '/workout' });
  }
  await exerciseSafeButtons(page, 'member', '/workout', 'member workout', 5);
}

async function checkCoach(page) {
  await login(page, 'coach');
  await goRoute(page, 'coach', '/schedule', { width: 1440, height: 900 }, 'coach-schedule');
  await exerciseSafeButtons(page, 'coach', '/schedule', 'coach schedule', 8);
}

const browser = await chromium.launch({
  channel: process.env.FITTRACK_E2E_BROWSER_CHANNEL || 'chrome',
  headless: true,
});
const context = await browser.newContext({
  acceptDownloads: false,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();

page.on('console', (message) => {
  const text = message.text();
  if (/webpack|favicon|Download the React DevTools/i.test(text)) return;
  results.console.push({
    location: message.location(),
    text,
    type: message.type(),
  });
});
page.on('requestfailed', (request) => {
  results.failedRequests.push({
    failure: request.failure()?.errorText,
    method: request.method(),
    url: request.url(),
  });
});
page.on('response', (response) => {
  const status = response.status();
  if (status >= 400) {
    results.httpErrors.push({
      status,
      url: response.url(),
    });
  }
});

try {
  await login(page, 'admin');
  await checkAnalytics(page);
  await checkGymOperations(page);
  await checkMilestones(page);
  await checkExerciseLab(page);
  await checkMemberWorkout(page);
  await checkCoach(page);
} finally {
  results.finishedAt = new Date().toISOString();
  await writeFile(
    path.join(artifactDir, 'e2e-report.json'),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}

const hardIssues = results.checks.flatMap((check) =>
  (check.geometryIssues ?? []).map((issue) => ({
    label: check.label,
    role: check.role,
    route: check.route,
    ...issue,
  })),
);

console.log(JSON.stringify({
  artifactDir,
  checks: results.checks.length,
  console: results.console.length,
  failedRequests: results.failedRequests.length,
  hardGeometryIssues: hardIssues.length,
  httpErrors: results.httpErrors.length,
  skipped: results.skipped.length,
}, null, 2));
