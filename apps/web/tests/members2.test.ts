import { test, expect } from '@playwright/test';
const fs = require('fs');

test('load members page bypassing login by directly generating dom.html', async ({ page }) => {
    // Just inject enough to skip auth, or we can just let it crash on /members
    page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', exp => console.log('BROWSER EXCEPTION:', exp));

    // We can just visit /login and log the DOM to see why it timed out.
    await page.goto('http://localhost:8080/login');
    await page.fill('input[type="email"]', 'seed.admin@fittrack.com');
    await page.fill('input[type="password"]', 'Password123!');

    // Use generic button
    await page.click('button:has-text("SIGN IN"), button:has-text("Log in"), button[type="submit"]');

    console.log("Clicked! Waiting for navigation");
    await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(e => console.log("Did not reach dashboard"));

    await page.goto('http://localhost:8080/members');
    await page.waitForTimeout(3000);

    const html = await page.content();
    fs.writeFileSync('dom.html', html);

    if (html.includes('Application error')) {
        console.log('CRASH Application error found in DOM');
    }
});